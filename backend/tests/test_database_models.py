import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine, StaticPool, inspect
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord, RoundRecord, RoundCondensed


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


def test_session_table_exists(db):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    assert "sessions" in tables


def test_round_table_exists(db):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    assert "rounds" in tables


def test_round_condensed_table_exists(db):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    assert "rounds_condensed" in tables


def test_create_session(db):
    session_rec = SessionRecord(user_id="default")
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)
    assert session_rec.id is not None
    assert session_rec.is_active
    assert session_rec.started_at is not None


def test_create_round(db):
    session_rec = SessionRecord(user_id="default")
    db.add(session_rec)
    db.commit()

    round_rec = RoundRecord(
        session_id=session_rec.id,
        round_number=1,
        hole_cards='["Ah", "Kd"]',
        community_cards='["7h", "2d", "9c"]',
        num_players=6,
        position="CO",
        streets='[]',
        result="won",
        profit=120.0,
        pot_size=200.0,
    )
    db.add(round_rec)
    db.commit()
    db.refresh(round_rec)
    assert round_rec.id is not None
    assert round_rec.session_id == session_rec.id


def test_create_condensed_round(db):
    session_rec = SessionRecord(user_id="default")
    db.add(session_rec)
    db.commit()

    condensed = RoundCondensed(
        session_id=session_rec.id,
        round_number=1,
        hole_cards='["Ah", "Kd"]',
        result="won",
        profit=120.0,
        key_decision="Called river with top pair, opponent had a bluff",
        lesson="Good call — pot odds justified it",
    )
    db.add(condensed)
    db.commit()
    db.refresh(condensed)
    assert condensed.id is not None
