import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, PlayerProfile
from app.services.opponent_service import (
    create_opponent,
    get_opponent,
    list_opponents,
    update_opponent,
    delete_opponent,
)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_create_opponent(db):
    opp = create_opponent(db, name="Mike", user_id="default", tendency_tags=["Tight", "Aggressive"])
    assert opp.id is not None
    assert opp.name == "Mike"
    tags = json.loads(opp.tendency_tags)
    assert "Tight" in tags
    assert "Aggressive" in tags


def test_get_opponent(db):
    opp = create_opponent(db, name="Sarah", user_id="default")
    fetched = get_opponent(db, opp.id)
    assert fetched is not None
    assert fetched.name == "Sarah"


def test_get_opponent_not_found(db):
    assert get_opponent(db, 999) is None


def test_list_opponents(db):
    create_opponent(db, name="Player1", user_id="default")
    create_opponent(db, name="Player2", user_id="default")
    create_opponent(db, name="Player3", user_id="other")
    result = list_opponents(db, "default")
    assert len(result) == 2


def test_update_opponent(db):
    opp = create_opponent(db, name="Old Name", user_id="default")
    updated = update_opponent(db, opp.id, name="New Name", vpip_estimate=45)
    assert updated.name == "New Name"
    assert updated.vpip_estimate == 45


def test_update_opponent_not_found(db):
    result = update_opponent(db, 999, name="X")
    assert result is None


def test_delete_opponent(db):
    opp = create_opponent(db, name="ToDelete", user_id="default")
    assert delete_opponent(db, opp.id) is True
    assert get_opponent(db, opp.id) is None


def test_delete_opponent_not_found(db):
    assert delete_opponent(db, 999) is False
