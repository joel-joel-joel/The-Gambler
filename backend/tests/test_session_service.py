import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord
from app.services.session_service import (
    start_session,
    end_session,
    get_active_session,
    get_session,
    list_sessions,
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


def test_start_session(db):
    session_rec = start_session(db, user_id="default")
    assert session_rec.id is not None
    assert session_rec.is_active == 1
    assert session_rec.user_id == "default"


def test_start_session_ends_previous(db):
    s1 = start_session(db, user_id="default")
    s2 = start_session(db, user_id="default")
    db.refresh(s1)
    assert s1.is_active == 0
    assert s1.ended_at is not None
    assert s2.is_active == 1


def test_get_active_session(db):
    start_session(db, user_id="default")
    active = get_active_session(db, user_id="default")
    assert active is not None
    assert active.is_active == 1


def test_get_active_session_none(db):
    active = get_active_session(db, user_id="default")
    assert active is None


def test_end_session(db):
    s = start_session(db, user_id="default")
    ended = end_session(db, s.id)
    assert ended.is_active == 0
    assert ended.ended_at is not None


def test_get_session(db):
    s = start_session(db, user_id="default")
    fetched = get_session(db, s.id)
    assert fetched is not None
    assert fetched.id == s.id


def test_list_sessions(db):
    start_session(db, user_id="default")
    start_session(db, user_id="default")
    sessions = list_sessions(db, user_id="default")
    assert len(sessions) == 2
