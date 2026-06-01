import json
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord, RoundRecord, LeakRecord
from app.services.session_end_service import finalize_session


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _seed_session_with_rounds(db):
    session_rec = SessionRecord(user_id="default", is_active=1)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)

    round_rec = RoundRecord(
        session_id=session_rec.id,
        round_number=1,
        hole_cards=json.dumps(["Ah", "Kh"]),
        community_cards=json.dumps(["Qh", "Jh", "Th"]),
        result="won",
        profit=50.0,
        pot_size=100.0,
    )
    db.add(round_rec)
    db.commit()
    return session_rec.id


@pytest.mark.asyncio
async def test_finalize_session_generates_leaks(db):
    session_id = _seed_session_with_rounds(db)

    leak_json = json.dumps([
        {"description": "Test leak", "category": "preflop", "ev_impact": "high", "evidence": "Some evidence"}
    ])

    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.side_effect = [
            "Good session summary.",
            "Updated PID content here.",
        ]
        with patch("app.services.leak_service.chat_with_ai", new_callable=AsyncMock, return_value=leak_json):
            result = await finalize_session(db, session_id)

    assert "leaks_generated" in result
    assert result["leaks_generated"] >= 1
    leaks = db.query(LeakRecord).filter(LeakRecord.session_id == session_id).all()
    assert len(leaks) >= 1
    assert leaks[0].source == "ai"
