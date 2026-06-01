import json
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord, RoundRecord, RoundCondensed
from app.services.round_service import save_round
from app.services.condensation_service import (
    condense_round_rule_based,
    condense_round_ai,
    maybe_condense_oldest,
    MAX_FULL_ROUNDS,
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def session_id(db):
    s = SessionRecord(user_id="default")
    db.add(s)
    db.commit()
    return s.id


def test_max_full_rounds_is_5():
    assert MAX_FULL_ROUNDS == 5


def test_rule_based_condensation():
    round_data = {
        "hole_cards": ["Ah", "Kd"],
        "community_cards": ["7h", "2d", "9c", "Qs", "3h"],
        "result": "won",
        "profit": 120.0,
        "pot_size": 200.0,
        "position": "CO",
    }
    result = condense_round_rule_based(round_data)
    assert "key_decision" in result
    assert "lesson" in result
    assert result["hole_cards"] == ["Ah", "Kd"]
    assert result["result"] == "won"
    assert result["profit"] == 120.0


def test_rule_based_condensation_loss():
    round_data = {
        "hole_cards": ["7s", "2c"],
        "community_cards": ["Ah", "Kd", "Qs"],
        "result": "lost",
        "profit": -80.0,
        "pot_size": 160.0,
        "position": "UTG",
    }
    result = condense_round_rule_based(round_data)
    assert result["profit"] == -80.0


def test_maybe_condense_under_limit(db, session_id):
    for i in range(4):
        save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    condensed_count = maybe_condense_oldest(db, session_id)
    assert condensed_count == 0


def test_maybe_condense_at_limit(db, session_id):
    for i in range(6):
        save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"], result="won", profit=10.0, community_cards=["7h", "2d", "9c"])
    condensed_count = maybe_condense_oldest(db, session_id)
    assert condensed_count == 1
    full_rounds = db.query(RoundRecord).filter(RoundRecord.session_id == session_id).count()
    assert full_rounds == 5
    condensed_rounds = db.query(RoundCondensed).filter(RoundCondensed.session_id == session_id).count()
    assert condensed_rounds == 1
