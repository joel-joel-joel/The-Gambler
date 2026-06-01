"""Session review service — EV-gap analysis and Socratic question generation."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.database import RoundRecord
from app.services.poker_engine import (
    calculate_equity,
    calculate_ev,
    calculate_pot_odds,
    detect_outs,
    rule_of_2_4,
)


def _determine_street(community_cards: list[str]) -> str:
    """Determine the current street from the number of community cards."""
    count = len(community_cards)
    if count <= 3:
        return "flop"
    elif count == 4:
        return "turn"
    else:
        return "river"


def _estimate_bet_to_call(
    pot_size: float,
    streets_json: str | None,
) -> float:
    """Estimate the bet to call from streets data or default to half pot.

    If the streets JSON contains action data with a bet/call amount, use
    the last bet amount found. Otherwise, estimate as 50% of pot size.
    """
    if streets_json:
        try:
            streets = json.loads(streets_json)
            if isinstance(streets, list):
                for street_data in reversed(streets):
                    if isinstance(street_data, dict):
                        # Look for bet_to_call or bet amount in street actions
                        bet = street_data.get("bet_to_call") or street_data.get("bet")
                        if bet and float(bet) > 0:
                            return float(bet)
                        # Check nested actions list
                        actions = street_data.get("actions", [])
                        for action in reversed(actions):
                            if isinstance(action, dict):
                                amount = action.get("amount", 0)
                                if amount and float(amount) > 0:
                                    return float(amount)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    return pot_size * 0.5


def _determine_user_action(round_rec: RoundRecord) -> str | None:
    """Determine the user's action from round data.

    Returns 'call', 'fold', or None if unknown.
    """
    result = round_rec.result
    if result == "folded":
        return "fold"
    if result in ("won", "lost"):
        return "call"
    return None


def generate_review(db: Session, session_id: int) -> dict:
    """Generate a session review with EV-gap analysis and Socratic questions.

    Pulls all rounds for a session, calculates equity/EV/pot odds for each
    qualifying round, identifies the top 3 hands by EV gap, and generates
    4 Socratic questions per hand.

    Args:
        db: Database session.
        session_id: The session to review.

    Returns:
        Dict with "hands" list, each containing round data and questions.
    """
    rounds = (
        db.query(RoundRecord)
        .filter(RoundRecord.session_id == session_id)
        .order_by(RoundRecord.round_number)
        .all()
    )

    analyzed_hands: list[dict] = []

    for round_rec in rounds:
        hole_cards = json.loads(round_rec.hole_cards)
        community_cards = json.loads(round_rec.community_cards)

        # Skip rounds without sufficient data
        if len(hole_cards) < 2 or len(community_cards) < 3 or round_rec.pot_size <= 0:
            continue

        street = _determine_street(community_cards)
        bet_to_call = _estimate_bet_to_call(round_rec.pot_size, round_rec.streets)

        # Calculate poker math
        equity = calculate_equity(
            hole_cards, community_cards, round_rec.num_players, iterations=5000
        )
        equity_pct = equity * 100.0
        pot_odds_pct = calculate_pot_odds(bet_to_call, round_rec.pot_size)
        ev = calculate_ev(equity, round_rec.pot_size, bet_to_call)

        # Determine optimal action
        optimal_action = "call" if equity_pct >= pot_odds_pct else "fold"

        # Determine user's actual action
        user_action = _determine_user_action(round_rec)

        # Calculate EV gap
        if user_action and user_action != optimal_action:
            ev_gap = abs(ev)
        else:
            ev_gap = 0.0

        # Detect outs for question generation
        outs_data = detect_outs(hole_cards, community_cards)
        total_outs = outs_data["total_outs"]
        rule_equity = rule_of_2_4(total_outs, street)

        analyzed_hands.append({
            "round_number": round_rec.round_number,
            "round_id": round_rec.id,
            "hole_cards": hole_cards,
            "community_cards": community_cards,
            "street": street,
            "pot_size": round_rec.pot_size,
            "bet_to_call": bet_to_call,
            "equity": equity_pct,
            "pot_odds": pot_odds_pct,
            "ev": ev,
            "optimal_action": optimal_action,
            "user_action": user_action,
            "ev_gap": ev_gap,
            "total_outs": total_outs,
            "rule_equity": rule_equity,
        })

    # Sort by EV gap descending, take top 3
    analyzed_hands.sort(key=lambda h: h["ev_gap"], reverse=True)
    top_hands = analyzed_hands[:3]

    # Generate Socratic questions for each top hand
    result_hands = []
    for hand in top_hands:
        questions = _generate_questions(hand)
        result_hands.append({
            "round_number": hand["round_number"],
            "round_id": hand["round_id"],
            "hole_cards": hand["hole_cards"],
            "community_cards": hand["community_cards"],
            "street": hand["street"],
            "pot_size": hand["pot_size"],
            "bet_to_call": hand["bet_to_call"],
            "equity": hand["equity"],
            "pot_odds": hand["pot_odds"],
            "ev": hand["ev"],
            "optimal_action": hand["optimal_action"],
            "user_action": hand["user_action"],
            "ev_gap": hand["ev_gap"],
            "questions": questions,
        })

    return {"hands": result_hands}


def _generate_questions(hand: dict) -> list[dict]:
    """Generate 4 Socratic questions for a reviewed hand.

    Questions:
        1. How many outs do you have? (integer, tolerance 0)
        2. Using the Rule of 4/2, estimate your equity (%) (percentage, tolerance 5.0)
        3. What are the pot odds (%)? (percentage, tolerance 2.0)
        4. Should you call or fold? (decision, 1.0=call, 0.0=fold, tolerance 0)
    """
    optimal_decision = 1.0 if hand["optimal_action"] == "call" else 0.0

    return [
        {
            "question": "How many outs do you have?",
            "correct_answer": float(hand["total_outs"]),
            "answer_type": "integer",
            "tolerance": 0,
        },
        {
            "question": "Using the Rule of 4/2, estimate your equity (%)",
            "correct_answer": round(hand["rule_equity"], 1),
            "answer_type": "percentage",
            "tolerance": 5.0,
        },
        {
            "question": "What are the pot odds (%)?",
            "correct_answer": round(hand["pot_odds"], 1),
            "answer_type": "percentage",
            "tolerance": 2.0,
        },
        {
            "question": "Should you call or fold?",
            "correct_answer": optimal_decision,
            "answer_type": "decision",
            "tolerance": 0,
        },
    ]


def check_review_answer(
    correct_answer: float,
    user_answer: float,
    answer_type: str,
    tolerance: float,
) -> dict:
    """Check a user's answer against the correct answer.

    Args:
        correct_answer: The mathematically correct answer.
        user_answer: The user's submitted answer.
        answer_type: One of 'integer', 'percentage', 'decision'.
        tolerance: Acceptable deviation from correct answer.

    Returns:
        Dict with is_correct (bool), correct_answer (float), explanation (None).
    """
    difference = abs(correct_answer - user_answer)
    is_correct = difference <= tolerance

    return {
        "is_correct": is_correct,
        "correct_answer": correct_answer,
        "explanation": None,
    }
