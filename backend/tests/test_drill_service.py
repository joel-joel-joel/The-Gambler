"""Tests for the drill service — scenario generation, answer checking, progress tracking."""

import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SkillProgress, DrillAttempt
from app.models.drill_schemas import SKILL_ORDER
from app.services.drill_service import (
    _pending_drills,
    check_answer,
    generate_drill,
    get_all_progress,
    get_drill_history,
    initialize_progress,
    suggest_focus,
)


test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    # Clear pending drills between tests
    _pending_drills.clear()


def _get_db():
    return TestSession()


# ---------------------------------------------------------------------------
# initialize_progress
# ---------------------------------------------------------------------------


def test_initialize_progress():
    """Creates 6 rows: outs is active, the rest are locked."""
    db = _get_db()
    result = initialize_progress(db, user_id="default")
    assert len(result) == 6

    all_rows = db.query(SkillProgress).filter_by(user_id="default").all()
    assert len(all_rows) == 6

    statuses = {r.skill: r.status for r in all_rows}
    assert statuses["outs"] == "active"
    assert statuses["rule_of_2_4"] == "locked"
    assert statuses["pot_odds"] == "locked"
    assert statuses["the_decision"] == "locked"
    assert statuses["spr_commitment"] == "locked"
    assert statuses["bluff_math"] == "locked"
    db.close()


def test_initialize_progress_idempotent():
    """Calling initialize_progress twice does not duplicate rows."""
    db = _get_db()
    initialize_progress(db, user_id="default")
    initialize_progress(db, user_id="default")

    all_rows = db.query(SkillProgress).filter_by(user_id="default").all()
    assert len(all_rows) == 6
    db.close()


# ---------------------------------------------------------------------------
# generate_drill — one test per skill
# ---------------------------------------------------------------------------


def test_generate_outs_drill():
    """Outs drill returns valid drill_id, scenario with cards, answer_type integer."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    result = generate_drill(db, skill="outs", user_id="default")

    assert "drill_id" in result
    assert result["answer_type"] == "integer"
    assert "hole_cards" in result["scenario"]
    assert "community_cards" in result["scenario"]
    assert len(result["scenario"]["hole_cards"]) == 2
    assert len(result["scenario"]["community_cards"]) in (3, 4)
    assert "question_text" in result
    assert result["drill_id"] in _pending_drills
    db.close()


def test_generate_rule_of_2_4_drill():
    """Rule of 2&4 drill requires outs graduated first, answer_type percentage."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    # Unlock rule_of_2_4 by graduating outs
    outs_progress = db.query(SkillProgress).filter_by(
        user_id="default", skill="outs"
    ).first()
    outs_progress.status = "graduated"
    r24_progress = db.query(SkillProgress).filter_by(
        user_id="default", skill="rule_of_2_4"
    ).first()
    r24_progress.status = "active"
    db.commit()

    result = generate_drill(db, skill="rule_of_2_4", user_id="default")

    assert result["answer_type"] == "percentage"
    assert "outs" in result["scenario"]
    assert "street" in result["scenario"]
    assert result["drill_id"] in _pending_drills
    db.close()


def test_generate_pot_odds_drill():
    """Pot odds drill has pot_size and bet_to_call in scenario."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    # Set pot_odds to active
    po_progress = db.query(SkillProgress).filter_by(
        user_id="default", skill="pot_odds"
    ).first()
    po_progress.status = "active"
    db.commit()

    result = generate_drill(db, skill="pot_odds", user_id="default")

    assert result["answer_type"] == "percentage"
    assert "pot_size" in result["scenario"]
    assert "bet_to_call" in result["scenario"]
    assert result["scenario"]["pot_size"] >= 20
    assert result["scenario"]["bet_to_call"] >= 10
    db.close()


def test_generate_the_decision_drill():
    """The decision drill has answer_type decision, includes equity and pot odds."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    # Set the_decision to active
    td_progress = db.query(SkillProgress).filter_by(
        user_id="default", skill="the_decision"
    ).first()
    td_progress.status = "active"
    db.commit()

    result = generate_drill(db, skill="the_decision", user_id="default")

    assert result["answer_type"] == "decision"
    assert "equity_pct" in result["scenario"]
    assert "pot_odds_pct" in result["scenario"]
    assert "hole_cards" in result["scenario"]
    db.close()


def test_generate_spr_commitment_drill():
    """SPR drill has your_stack in scenario, answer_type decimal."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    spr_progress = db.query(SkillProgress).filter_by(
        user_id="default", skill="spr_commitment"
    ).first()
    spr_progress.status = "active"
    db.commit()

    result = generate_drill(db, skill="spr_commitment", user_id="default")

    assert result["answer_type"] == "decimal"
    assert "your_stack" in result["scenario"]
    assert "pot_size" in result["scenario"]
    db.close()


def test_generate_bluff_math_drill():
    """Bluff math drill has bluff_size in scenario, answer_type percentage."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    bm_progress = db.query(SkillProgress).filter_by(
        user_id="default", skill="bluff_math"
    ).first()
    bm_progress.status = "active"
    db.commit()

    result = generate_drill(db, skill="bluff_math", user_id="default")

    assert result["answer_type"] == "percentage"
    assert "bluff_size" in result["scenario"]
    assert "pot_size" in result["scenario"]
    db.close()


def test_generate_locked_skill_raises():
    """Attempting to generate a drill for a locked skill raises ValueError."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    with pytest.raises(ValueError, match="locked"):
        generate_drill(db, skill="rule_of_2_4", user_id="default")
    db.close()


# ---------------------------------------------------------------------------
# check_answer
# ---------------------------------------------------------------------------


def test_check_answer_correct_outs():
    """Correct answer saves DrillAttempt and updates SkillProgress."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    drill = generate_drill(db, skill="outs", user_id="default")
    correct_answer = _pending_drills[drill["drill_id"]]["correct_answer"]

    result = check_answer(
        db,
        drill_id=drill["drill_id"],
        user_answer=correct_answer,
        response_time_ms=3000,
    )

    assert result["is_correct"] is True
    assert result["correct_answer"] == correct_answer

    # Verify DrillAttempt was saved
    attempts = db.query(DrillAttempt).filter_by(skill="outs").all()
    assert len(attempts) == 1
    assert attempts[0].is_correct == 1

    # Verify SkillProgress updated
    progress = db.query(SkillProgress).filter_by(
        user_id="default", skill="outs"
    ).first()
    assert progress.total_attempts == 1
    assert progress.correct_count == 1
    assert progress.current_accuracy == 1.0
    db.close()


def test_check_answer_incorrect_outs():
    """Incorrect answer still saves attempt, updates counts correctly."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    drill = generate_drill(db, skill="outs", user_id="default")
    correct_answer = _pending_drills[drill["drill_id"]]["correct_answer"]

    # Give a deliberately wrong answer
    wrong_answer = correct_answer + 5

    result = check_answer(
        db,
        drill_id=drill["drill_id"],
        user_answer=wrong_answer,
        response_time_ms=5000,
    )

    assert result["is_correct"] is False

    # Verify counts
    progress = db.query(SkillProgress).filter_by(
        user_id="default", skill="outs"
    ).first()
    assert progress.total_attempts == 1
    assert progress.correct_count == 0
    assert progress.current_accuracy == 0.0
    db.close()


def test_check_answer_tolerance_pot_odds():
    """Answer within tolerance (2%) counts as correct for pot_odds."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    # Set pot_odds to active
    po = db.query(SkillProgress).filter_by(
        user_id="default", skill="pot_odds"
    ).first()
    po.status = "active"
    db.commit()

    drill = generate_drill(db, skill="pot_odds", user_id="default")
    correct_answer = _pending_drills[drill["drill_id"]]["correct_answer"]

    # Answer within 2% tolerance
    result = check_answer(
        db,
        drill_id=drill["drill_id"],
        user_answer=correct_answer + 1.5,
        response_time_ms=4000,
    )

    assert result["is_correct"] is True

    # Now test outside tolerance
    drill2 = generate_drill(db, skill="pot_odds", user_id="default")
    correct2 = _pending_drills[drill2["drill_id"]]["correct_answer"]

    result2 = check_answer(
        db,
        drill_id=drill2["drill_id"],
        user_answer=correct2 + 3.0,
        response_time_ms=4000,
    )

    assert result2["is_correct"] is False
    db.close()


def test_check_answer_invalid_drill_id():
    """ValueError raised for unknown drill_id."""
    db = _get_db()

    with pytest.raises(ValueError, match="not found"):
        check_answer(db, drill_id="nonexistent-id", user_answer=5.0, response_time_ms=1000)
    db.close()


# ---------------------------------------------------------------------------
# get_all_progress
# ---------------------------------------------------------------------------


def test_get_all_progress():
    """Returns 6 skills in SKILL_ORDER."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    progress_list = get_all_progress(db, user_id="default")

    assert len(progress_list) == 6
    assert [p["skill"] for p in progress_list] == SKILL_ORDER
    assert progress_list[0]["status"] == "active"
    assert progress_list[1]["status"] == "locked"
    db.close()


# ---------------------------------------------------------------------------
# get_drill_history
# ---------------------------------------------------------------------------


def test_get_drill_history():
    """Returns recent attempts for a skill."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    # Generate and answer a few drills
    for _ in range(3):
        drill = generate_drill(db, skill="outs", user_id="default")
        correct = _pending_drills[drill["drill_id"]]["correct_answer"]
        check_answer(db, drill["drill_id"], correct, 2000)

    history = get_drill_history(db, skill="outs", limit=10, user_id="default")

    assert len(history) == 3
    assert all(h["skill"] == "outs" for h in history)
    # Most recent first
    assert history[0]["id"] > history[1]["id"]
    db.close()


# ---------------------------------------------------------------------------
# suggest_focus
# ---------------------------------------------------------------------------


def test_suggest_focus():
    """Suggests 'outs' as the first active skill (the only one initially active)."""
    db = _get_db()
    initialize_progress(db, user_id="default")

    suggestion = suggest_focus(db, user_id="default")

    assert suggestion["suggested_skill"] == "outs"
    assert "reason" in suggestion
    db.close()
