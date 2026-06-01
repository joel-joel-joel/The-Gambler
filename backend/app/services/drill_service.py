"""Drill service — scenario generation, answer checking, and progress tracking."""

from __future__ import annotations

import json
import random
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from app.models.database import DrillAttempt, SkillProgress
from app.models.drill_schemas import SKILL_DEFINITIONS, SKILL_ORDER
from app.services.poker_engine import (
    calculate_bluff_break_even,
    calculate_equity,
    calculate_pot_odds,
    calculate_spr,
    detect_outs,
    rule_of_2_4,
)

# In-memory store for pending drills (drill_id -> drill data)
_pending_drills: dict[str, dict] = {}

# All possible ranks and suits for card generation
_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]
_SUITS = ["h", "d", "c", "s"]
_ALL_CARDS = [r + s for r in _RANKS for s in _SUITS]


def _random_cards(count: int, exclude: list[str] | None = None) -> list[str]:
    """Deal random unique cards, excluding any already dealt."""
    available = [c for c in _ALL_CARDS if c not in (exclude or [])]
    return random.sample(available, count)


def initialize_progress(db: Session, user_id: str = "default") -> list[SkillProgress]:
    """Create SkillProgress rows for all 6 skills if they don't already exist.

    The first skill (outs) starts as 'active'; the rest start as 'locked'.
    """
    created = []
    for skill_name in SKILL_ORDER:
        existing = (
            db.query(SkillProgress)
            .filter_by(user_id=user_id, skill=skill_name)
            .first()
        )
        if existing:
            created.append(existing)
            continue

        status = "active" if skill_name == "outs" else "locked"
        progress = SkillProgress(
            user_id=user_id,
            skill=skill_name,
            status=status,
        )
        db.add(progress)
        created.append(progress)

    db.commit()
    return created


def generate_drill(
    db: Session,
    skill: str,
    source: str = "random",
    user_id: str = "default",
) -> dict:
    """Generate a drill scenario for the given skill.

    Raises ValueError if the skill is locked or unknown.
    Returns dict with drill_id, scenario, question_text, answer_type.
    """
    if skill not in SKILL_DEFINITIONS:
        raise ValueError(f"Unknown skill: {skill}")

    # Check that the skill is not locked
    progress = (
        db.query(SkillProgress)
        .filter_by(user_id=user_id, skill=skill)
        .first()
    )
    if progress is None or progress.status == "locked":
        raise ValueError(f"Skill '{skill}' is locked. Complete prerequisites first.")

    generator = _GENERATORS[skill]
    scenario, correct_answer, question_text = generator()

    drill_id = str(uuid.uuid4())
    skill_def = SKILL_DEFINITIONS[skill]

    _pending_drills[drill_id] = {
        "skill": skill,
        "scenario": scenario,
        "correct_answer": correct_answer,
        "question_text": question_text,
        "answer_type": skill_def["answer_type"],
        "tolerance": skill_def["tolerance"],
        "source": source,
        "user_id": user_id,
        "draws": scenario.get("draws", []),
    }

    return {
        "drill_id": drill_id,
        "scenario": scenario,
        "question_text": question_text,
        "answer_type": skill_def["answer_type"],
    }


def check_answer(
    db: Session,
    drill_id: str,
    user_answer: float,
    response_time_ms: int,
) -> dict:
    """Check user's answer against the correct answer for a pending drill.

    Raises ValueError if drill_id is not found.
    Returns dict with is_correct, correct_answer, explanation, accuracy_now, graduated.
    """
    if drill_id not in _pending_drills:
        raise ValueError(f"Drill '{drill_id}' not found. It may have expired or already been answered.")

    drill = _pending_drills.pop(drill_id)
    correct_answer = drill["correct_answer"]
    tolerance = drill["tolerance"]
    skill = drill["skill"]
    user_id = drill["user_id"]

    # Check correctness based on tolerance
    if tolerance == 0:
        is_correct = abs(user_answer - correct_answer) < 0.001
    else:
        is_correct = abs(user_answer - correct_answer) <= tolerance

    # Save DrillAttempt
    attempt = DrillAttempt(
        user_id=user_id,
        skill=skill,
        scenario=json.dumps(drill["scenario"]),
        correct_answer=correct_answer,
        user_answer=user_answer,
        is_correct=1 if is_correct else 0,
        response_time_ms=response_time_ms,
        source=drill["source"],
    )
    db.add(attempt)

    # Update SkillProgress
    progress = (
        db.query(SkillProgress)
        .filter_by(user_id=user_id, skill=skill)
        .first()
    )
    if progress is None:
        raise ValueError(f"No progress record for skill '{skill}'")

    progress.total_attempts += 1
    if is_correct:
        progress.correct_count += 1
    progress.current_accuracy = round(
        progress.correct_count / progress.total_attempts, 4
    )

    # Update average response time
    if progress.total_attempts == 1:
        progress.avg_response_time_ms = response_time_ms
    else:
        # Running average
        prev_total = progress.avg_response_time_ms * (progress.total_attempts - 1)
        progress.avg_response_time_ms = int(
            (prev_total + response_time_ms) / progress.total_attempts
        )

    # Update streak tracking
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime(
        "%Y-%m-%d"
    )

    if progress.last_attempt_date is None:
        progress.streak_days = 1
    elif progress.last_attempt_date == yesterday_str:
        progress.streak_days += 1
    elif progress.last_attempt_date != today_str:
        progress.streak_days = 1
    # If last_attempt_date == today_str, streak stays the same

    progress.last_attempt_date = today_str
    if progress.streak_days > progress.best_streak:
        progress.best_streak = progress.streak_days

    # Check graduation
    graduated = False
    skill_def = SKILL_DEFINITIONS[skill]
    if (
        progress.status == "active"
        and progress.total_attempts >= skill_def["required_attempts"]
        and progress.current_accuracy >= skill_def["graduation_accuracy"]
    ):
        progress.status = "graduated"
        progress.graduated_at = datetime.now(timezone.utc)
        graduated = True
        _unlock_next_skills(db, user_id, skill)

    db.commit()

    # Build explanation
    explanation = _build_explanation(skill, correct_answer, user_answer, is_correct, draws=drill.get("draws"))

    return {
        "is_correct": is_correct,
        "correct_answer": correct_answer,
        "explanation": explanation,
        "accuracy_now": progress.current_accuracy,
        "graduated": graduated,
    }


def get_all_progress(db: Session, user_id: str = "default") -> list[dict]:
    """Return progress for all 6 skills in SKILL_ORDER."""
    result = []
    for skill_name in SKILL_ORDER:
        progress = (
            db.query(SkillProgress)
            .filter_by(user_id=user_id, skill=skill_name)
            .first()
        )
        if progress is None:
            result.append({
                "skill": skill_name,
                "total_attempts": 0,
                "correct_count": 0,
                "current_accuracy": 0.0,
                "status": "locked",
                "streak_days": 0,
                "last_attempt_date": None,
                "best_streak": 0,
                "avg_response_time_ms": 0,
                "graduated_at": None,
            })
        else:
            result.append({
                "skill": progress.skill,
                "total_attempts": progress.total_attempts,
                "correct_count": progress.correct_count,
                "current_accuracy": progress.current_accuracy,
                "status": progress.status,
                "streak_days": progress.streak_days,
                "last_attempt_date": progress.last_attempt_date,
                "best_streak": progress.best_streak,
                "avg_response_time_ms": progress.avg_response_time_ms,
                "graduated_at": (
                    progress.graduated_at.isoformat() if progress.graduated_at else None
                ),
            })
    return result


def get_drill_history(
    db: Session,
    skill: str,
    limit: int = 20,
    user_id: str = "default",
) -> list[dict]:
    """Return recent drill attempts for a skill, most recent first."""
    attempts = (
        db.query(DrillAttempt)
        .filter_by(user_id=user_id, skill=skill)
        .order_by(DrillAttempt.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "skill": a.skill,
            "is_correct": bool(a.is_correct),
            "correct_answer": a.correct_answer,
            "user_answer": a.user_answer,
            "response_time_ms": a.response_time_ms,
            "source": a.source,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in attempts
    ]


def suggest_focus(db: Session, user_id: str = "default") -> dict:
    """Suggest the active skill the user should focus on.

    Returns the active skill with the lowest accuracy. If no active skills,
    returns the first locked skill. If all graduated, returns the last skill.
    """
    active_skills = (
        db.query(SkillProgress)
        .filter_by(user_id=user_id, status="active")
        .all()
    )

    if active_skills:
        worst = min(active_skills, key=lambda s: s.current_accuracy)
        reason = (
            f"Your accuracy on {worst.skill} is {worst.current_accuracy:.0%} — "
            f"keep practicing to reach graduation."
        )
        return {"suggested_skill": worst.skill, "reason": reason}

    # If no active skills, check for locked skills (shouldn't normally happen)
    for skill_name in SKILL_ORDER:
        progress = (
            db.query(SkillProgress)
            .filter_by(user_id=user_id, skill=skill_name)
            .first()
        )
        if progress and progress.status == "locked":
            return {
                "suggested_skill": skill_name,
                "reason": f"Skill '{skill_name}' is locked. Graduate prerequisites first.",
            }

    # All graduated
    last_skill = SKILL_ORDER[-1]
    return {
        "suggested_skill": last_skill,
        "reason": "All skills graduated! Keep sharp with practice.",
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _unlock_next_skills(db: Session, user_id: str, graduated_skill: str) -> None:
    """Unlock the next skill(s) after a graduation.

    Rules:
    - Levels 2-3, 5-6: unlock when the previous level graduates.
    - Level 4 (the_decision): requires levels 1-3 ALL graduated.
    """
    skill_idx = SKILL_ORDER.index(graduated_skill)
    next_idx = skill_idx + 1
    if next_idx >= len(SKILL_ORDER):
        return

    next_skill = SKILL_ORDER[next_idx]

    # Special rule for the_decision (level 4, index 3): needs levels 1-3 graduated
    if next_skill == "the_decision":
        prereqs = SKILL_ORDER[:3]  # outs, rule_of_2_4, pot_odds
        all_graduated = True
        for prereq in prereqs:
            p = (
                db.query(SkillProgress)
                .filter_by(user_id=user_id, skill=prereq)
                .first()
            )
            if p is None or p.status != "graduated":
                all_graduated = False
                break
        if not all_graduated:
            return

    # Unlock the next skill
    next_progress = (
        db.query(SkillProgress)
        .filter_by(user_id=user_id, skill=next_skill)
        .first()
    )
    if next_progress and next_progress.status == "locked":
        next_progress.status = "active"


def _build_explanation(
    skill: str, correct: float, user_answer: float, is_correct: bool,
    draws: list[dict] | None = None,
) -> str:
    """Build an explanation with the reasoning behind the correct answer."""
    prefix = "Correct!" if is_correct else "Incorrect."

    if skill == "outs":
        breakdown = ""
        if draws:
            parts = [d.get("description", f'{d["outs"]} {d["draw_type"]}') for d in draws]
            breakdown = " Breakdown: " + ", ".join(parts) + "."
        return f"{prefix} The answer is {int(correct)} outs.{breakdown}"
    elif skill == "rule_of_2_4":
        return f"{prefix} The answer is {correct:.1f}%. You answered {user_answer:.1f}%."
    elif skill == "pot_odds":
        return f"{prefix} The answer is {correct:.1f}%. You answered {user_answer:.1f}%."
    elif skill == "the_decision":
        correct_action = "call" if correct == 1.0 else "fold"
        user_action = "call" if user_answer == 1.0 else "fold"
        return f"{prefix} The correct decision is {correct_action}. You chose {user_action}."
    elif skill == "spr_commitment":
        return f"{prefix} The answer is {correct:.1f}. You answered {user_answer:.1f}."
    elif skill == "bluff_math":
        return f"{prefix} The answer is {correct:.1f}%. You answered {user_answer:.1f}%."
    else:
        return f"{prefix} The answer is {correct}. You answered {user_answer}."


# ---------------------------------------------------------------------------
# Scenario generators — each returns (scenario_dict, correct_answer, question_text)
# ---------------------------------------------------------------------------


def _generate_outs_drill() -> tuple[dict, float, str]:
    """Generate an outs-counting drill with random cards.

    Re-rolls up to 20 times if the scenario produces 0 outs,
    to ensure the drill is interesting.
    """
    for _ in range(20):
        hole_cards = _random_cards(2)
        num_community = random.choice([3, 4])
        community_cards = _random_cards(num_community, exclude=hole_cards)

        result = detect_outs(hole_cards, community_cards)
        if result["total_outs"] > 0:
            break

    correct_answer = float(result["total_outs"])

    street = "flop" if num_community == 3 else "turn"
    scenario = {
        "hole_cards": hole_cards,
        "community_cards": community_cards,
        "street": street,
        "draws": result["draws"],
    }
    question_text = (
        f"You hold {hole_cards[0]} {hole_cards[1]}. "
        f"The board is {' '.join(community_cards)}. "
        f"How many outs do you have?"
    )
    return scenario, correct_answer, question_text


def _generate_rule_of_2_4_drill() -> tuple[dict, float, str]:
    """Generate a rule of 2&4 drill with random cards.

    Re-rolls to ensure at least 1 out so the drill is meaningful.
    """
    for _ in range(20):
        hole_cards = _random_cards(2)
        num_community = random.choice([3, 4])
        community_cards = _random_cards(num_community, exclude=hole_cards)

        outs_result = detect_outs(hole_cards, community_cards)
        total_outs = outs_result["total_outs"]
        if total_outs > 0:
            break

    street = "flop" if num_community == 3 else "turn"
    correct_answer = rule_of_2_4(total_outs, street)

    scenario = {
        "hole_cards": hole_cards,
        "community_cards": community_cards,
        "street": street,
        "outs": total_outs,
    }
    question_text = (
        f"You have {total_outs} outs on the {street}. "
        f"Using the rule of {'4' if street == 'flop' else '2'}, "
        f"what is your estimated equity percentage?"
    )
    return scenario, correct_answer, question_text


def _generate_pot_odds_drill() -> tuple[dict, float, str]:
    """Generate a pot odds calculation drill."""
    pot_size = random.randrange(20, 510, 10)
    bet_to_call = random.randrange(10, pot_size + 1, 5)

    correct_answer = calculate_pot_odds(bet_to_call, pot_size)

    scenario = {
        "pot_size": pot_size,
        "bet_to_call": bet_to_call,
    }
    question_text = (
        f"The pot is ${pot_size} and you must call ${bet_to_call}. "
        f"What are your pot odds as a percentage?"
    )
    return scenario, correct_answer, question_text


def _generate_the_decision_drill() -> tuple[dict, float, str]:
    """Generate a call/fold decision drill based on equity vs pot odds."""
    hole_cards = _random_cards(2)
    num_community = random.choice([3, 4])
    community_cards = _random_cards(num_community, exclude=hole_cards)

    pot_size = random.randrange(30, 410, 10)
    bet_to_call = random.randrange(10, pot_size + 1, 5)

    equity = calculate_equity(hole_cards, community_cards, num_players=2, iterations=5000)
    equity_pct = equity * 100
    pot_odds_pct = calculate_pot_odds(bet_to_call, pot_size)

    # Decision: call if equity >= pot odds, fold otherwise
    correct_answer = 1.0 if equity_pct >= pot_odds_pct else 0.0

    street = "flop" if num_community == 3 else "turn"
    scenario = {
        "hole_cards": hole_cards,
        "community_cards": community_cards,
        "street": street,
        "pot_size": pot_size,
        "bet_to_call": bet_to_call,
        "equity_pct": round(equity_pct, 1),
        "pot_odds_pct": pot_odds_pct,
    }
    question_text = (
        f"You hold {hole_cards[0]} {hole_cards[1]}. "
        f"Board: {' '.join(community_cards)}. "
        f"Pot is ${pot_size}, bet to call is ${bet_to_call}. "
        f"Your equity is {equity_pct:.1f}%. Pot odds are {pot_odds_pct:.1f}%. "
        f"Should you call (1) or fold (0)?"
    )
    return scenario, correct_answer, question_text


def _generate_spr_commitment_drill() -> tuple[dict, float, str]:
    """Generate an SPR calculation drill."""
    pot_size = random.randrange(20, 310, 10)
    your_stack = random.randrange(50, 1010, 10)

    raw_spr = calculate_spr(your_stack, pot_size)
    correct_answer = round(raw_spr, 1)

    scenario = {
        "pot_size": pot_size,
        "your_stack": your_stack,
    }
    question_text = (
        f"The pot is ${pot_size} and your stack is ${your_stack}. "
        f"What is the Stack-to-Pot Ratio (SPR)? Round to 1 decimal."
    )
    return scenario, correct_answer, question_text


def _generate_bluff_math_drill() -> tuple[dict, float, str]:
    """Generate a bluff break-even frequency drill."""
    pot_size = random.randrange(30, 410, 10)
    max_bluff = int(pot_size * 1.5)
    # Ensure bluff_size >= 15 and is a multiple of 5
    min_bluff = max(15, 15)
    if max_bluff < min_bluff:
        max_bluff = min_bluff
    bluff_size = random.randrange(min_bluff, max_bluff + 1, 5)

    raw_be = calculate_bluff_break_even(bluff_size, pot_size)
    # Convert to percentage and round to 1 decimal
    correct_answer = round(raw_be * 100, 1)

    scenario = {
        "pot_size": pot_size,
        "bluff_size": bluff_size,
    }
    question_text = (
        f"The pot is ${pot_size} and you bluff ${bluff_size}. "
        f"What is the break-even fold frequency as a percentage?"
    )
    return scenario, correct_answer, question_text


# Map skill names to their generator functions
_GENERATORS = {
    "outs": _generate_outs_drill,
    "rule_of_2_4": _generate_rule_of_2_4_drill,
    "pot_odds": _generate_pot_odds_drill,
    "the_decision": _generate_the_decision_drill,
    "spr_commitment": _generate_spr_commitment_drill,
    "bluff_math": _generate_bluff_math_drill,
}
