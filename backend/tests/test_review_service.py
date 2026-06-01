"""Tests for the session review service."""

import json

import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, RoundRecord, SessionRecord
from app.services.review_service import check_review_answer, generate_review


test_engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


def _create_session_with_rounds(db, rounds_data):
    """Helper to create a session with multiple rounds."""
    session_rec = SessionRecord(
        user_id="default", is_active=0, total_rounds=len(rounds_data)
    )
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)
    for i, rd in enumerate(rounds_data):
        db.add(
            RoundRecord(
                session_id=session_rec.id,
                round_number=i + 1,
                hole_cards=json.dumps(rd["hole_cards"]),
                community_cards=json.dumps(rd["community_cards"]),
                num_players=rd.get("num_players", 2),
                position=rd.get("position"),
                pot_size=rd["pot_size"],
                result=rd.get("result", "lost"),
                profit=rd.get("profit", 0.0),
            )
        )
    db.commit()
    return session_rec.id


def test_generate_review_with_rounds():
    """Review of a session with 4 rounds returns up to 3 hands, each with 4 questions."""
    db = TestSession()
    try:
        rounds_data = [
            {
                "hole_cards": ["Ah", "Kh"],
                "community_cards": ["Qh", "Jh", "2c"],
                "pot_size": 200.0,
                "result": "lost",
                "profit": -100.0,
            },
            {
                "hole_cards": ["7d", "2s"],
                "community_cards": ["Ac", "Kd", "Qs"],
                "pot_size": 150.0,
                "result": "folded",
                "profit": 0.0,
            },
            {
                "hole_cards": ["Td", "9d"],
                "community_cards": ["8d", "7c", "2h"],
                "pot_size": 100.0,
                "result": "won",
                "profit": 80.0,
            },
            {
                "hole_cards": ["5s", "3c"],
                "community_cards": ["As", "Kc", "Qd"],
                "pot_size": 120.0,
                "result": "lost",
                "profit": -60.0,
            },
        ]
        session_id = _create_session_with_rounds(db, rounds_data)
        result = generate_review(db, session_id)

        assert "hands" in result
        assert len(result["hands"]) <= 3

        for hand in result["hands"]:
            assert "questions" in hand
            assert len(hand["questions"]) == 4
            assert "round_number" in hand
            assert "hole_cards" in hand
            assert "community_cards" in hand
            assert "ev_gap" in hand
            assert "equity" in hand
            assert "pot_odds" in hand
    finally:
        db.close()


def test_generate_review_empty_session():
    """Review of an empty session returns an empty hands list."""
    db = TestSession()
    try:
        session_rec = SessionRecord(user_id="default", is_active=0, total_rounds=0)
        db.add(session_rec)
        db.commit()
        db.refresh(session_rec)

        result = generate_review(db, session_rec.id)

        assert result == {"hands": []}
    finally:
        db.close()


def test_review_questions_have_correct_types():
    """Each of the 4 questions has the expected answer_type."""
    db = TestSession()
    try:
        rounds_data = [
            {
                "hole_cards": ["Ah", "Kh"],
                "community_cards": ["Qh", "Jh", "2c"],
                "pot_size": 200.0,
                "result": "won",
                "profit": 150.0,
            },
        ]
        session_id = _create_session_with_rounds(db, rounds_data)
        result = generate_review(db, session_id)

        assert len(result["hands"]) == 1
        questions = result["hands"][0]["questions"]

        assert questions[0]["answer_type"] == "integer"
        assert questions[0]["tolerance"] == 0
        assert questions[1]["answer_type"] == "percentage"
        assert questions[1]["tolerance"] == 5.0
        assert questions[2]["answer_type"] == "percentage"
        assert questions[2]["tolerance"] == 2.0
        assert questions[3]["answer_type"] == "decision"
        assert questions[3]["tolerance"] == 0
    finally:
        db.close()


def test_check_review_answer():
    """Exact match returns is_correct=True."""
    result = check_review_answer(
        correct_answer=9.0, user_answer=9.0, answer_type="integer", tolerance=0
    )
    assert result["is_correct"] is True
    assert result["correct_answer"] == 9.0
    assert result["explanation"] is None


def test_check_review_answer_with_tolerance():
    """Answer within tolerance returns is_correct=True."""
    result = check_review_answer(
        correct_answer=36.0, user_answer=34.0, answer_type="percentage", tolerance=5.0
    )
    assert result["is_correct"] is True
    assert result["correct_answer"] == 36.0


def test_check_review_answer_wrong():
    """Answer outside tolerance returns is_correct=False."""
    result = check_review_answer(
        correct_answer=33.3, user_answer=50.0, answer_type="percentage", tolerance=2.0
    )
    assert result["is_correct"] is False
    assert result["correct_answer"] == 33.3
    assert result["explanation"] is None


def test_rounds_without_community_cards_skipped():
    """Rounds with fewer than 3 community cards are skipped."""
    db = TestSession()
    try:
        rounds_data = [
            {
                "hole_cards": ["Ah", "Kd"],
                "community_cards": [],
                "pot_size": 100.0,
                "result": "won",
            },
            {
                "hole_cards": ["Qh", "Jh"],
                "community_cards": ["Td"],
                "pot_size": 80.0,
                "result": "lost",
            },
        ]
        session_id = _create_session_with_rounds(db, rounds_data)
        result = generate_review(db, session_id)

        assert result == {"hands": []}
    finally:
        db.close()


def test_rounds_with_zero_pot_skipped():
    """Rounds with pot_size=0 are skipped."""
    db = TestSession()
    try:
        rounds_data = [
            {
                "hole_cards": ["Ah", "Kd"],
                "community_cards": ["7h", "2d", "9c"],
                "pot_size": 0.0,
                "result": "folded",
            },
        ]
        session_id = _create_session_with_rounds(db, rounds_data)
        result = generate_review(db, session_id)

        assert result == {"hands": []}
    finally:
        db.close()


def test_check_review_answer_decision_correct():
    """Decision answer 1.0 (call) matches correct answer of 1.0."""
    result = check_review_answer(
        correct_answer=1.0, user_answer=1.0, answer_type="decision", tolerance=0
    )
    assert result["is_correct"] is True


def test_check_review_answer_decision_wrong():
    """Decision answer 0.0 (fold) does not match correct answer of 1.0 (call)."""
    result = check_review_answer(
        correct_answer=1.0, user_answer=0.0, answer_type="decision", tolerance=0
    )
    assert result["is_correct"] is False
