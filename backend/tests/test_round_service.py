import json
import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord
from app.services.round_service import (
    save_round,
    get_round,
    list_rounds,
    delete_round,
    get_round_count,
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


def test_save_round(db, session_id):
    r = save_round(
        db,
        session_id=session_id,
        hole_cards=["Ah", "Kd"],
        community_cards=["7h", "2d", "9c"],
        num_players=6,
        position="CO",
        pot_size=200.0,
        result="won",
        profit=120.0,
    )
    assert r.id is not None
    assert r.round_number == 1


def test_save_round_increments_number(db, session_id):
    save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    r2 = save_round(db, session_id=session_id, hole_cards=["Qs", "Jh"])
    assert r2.round_number == 2


def test_get_round(db, session_id):
    r = save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    fetched = get_round(db, r.id)
    assert fetched is not None
    assert json.loads(fetched.hole_cards) == ["Ah", "Kd"]


def test_list_rounds(db, session_id):
    save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    save_round(db, session_id=session_id, hole_cards=["Qs", "Jh"])
    rounds = list_rounds(db, session_id=session_id)
    assert len(rounds) == 2


def test_delete_round(db, session_id):
    r = save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    deleted = delete_round(db, r.id)
    assert deleted is True
    assert get_round(db, r.id) is None


def test_get_round_count(db, session_id):
    save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    save_round(db, session_id=session_id, hole_cards=["Qs", "Jh"])
    assert get_round_count(db, session_id) == 2
