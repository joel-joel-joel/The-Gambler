import json
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, LeakRecord
from app.services.leak_service import (
    create_leak,
    list_leaks,
    update_leak,
    delete_leak,
    generate_leaks_from_session,
)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_create_leak(db):
    leak = create_leak(db, description="Calling too wide preflop", category="preflop", ev_impact="high")
    assert leak.id is not None
    assert leak.description == "Calling too wide preflop"
    assert leak.category == "preflop"
    assert leak.ev_impact == "high"
    assert leak.status == "active"
    assert leak.source == "manual"


def test_list_leaks(db):
    create_leak(db, description="Leak 1")
    create_leak(db, description="Leak 2")
    create_leak(db, description="Leak 3", status="resolved")
    all_leaks = list_leaks(db)
    assert len(all_leaks) == 3
    active_leaks = list_leaks(db, status_filter="active")
    assert len(active_leaks) == 2


def test_update_leak(db):
    leak = create_leak(db, description="Old", status="active")
    updated = update_leak(db, leak.id, status="improving", description="Updated")
    assert updated.status == "improving"
    assert updated.description == "Updated"


def test_update_leak_not_found(db):
    assert update_leak(db, 999, status="resolved") is None


def test_delete_leak(db):
    leak = create_leak(db, description="Gone")
    assert delete_leak(db, leak.id) is True
    assert delete_leak(db, leak.id) is False


@pytest.mark.asyncio
async def test_generate_leaks_from_session(db):
    ai_response = json.dumps([
        {"description": "Overfolding to river bets", "category": "postflop", "ev_impact": "high", "evidence": "Folded river in 3 of 4 spots"},
        {"description": "Not c-betting enough", "category": "postflop", "ev_impact": "medium", "evidence": "Checked flop 60% of time as PFR"},
    ])

    with patch("app.services.leak_service.chat_with_ai", new_callable=AsyncMock, return_value=ai_response):
        leaks = await generate_leaks_from_session(db, session_id=1)

    assert len(leaks) == 2
    assert leaks[0].source == "ai"
    assert leaks[0].session_id == 1
    assert leaks[0].category == "postflop"


@pytest.mark.asyncio
async def test_generate_leaks_bad_ai_response(db):
    with patch("app.services.leak_service.chat_with_ai", new_callable=AsyncMock, return_value="not json"):
        leaks = await generate_leaks_from_session(db, session_id=1)

    assert leaks == []
