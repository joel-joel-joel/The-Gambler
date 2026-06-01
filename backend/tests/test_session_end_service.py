import json
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord
from app.services.round_service import save_round
from app.services.session_end_service import (
    build_session_stats,
    generate_session_summary,
    generate_pid_update,
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
def session_with_rounds(db):
    s = SessionRecord(user_id="default")
    db.add(s)
    db.commit()
    save_round(db, s.id, hole_cards=["Ah", "Kd"], result="won", profit=120.0, pot_size=200.0)
    save_round(db, s.id, hole_cards=["Qs", "Jh"], result="lost", profit=-50.0, pot_size=100.0)
    save_round(db, s.id, hole_cards=["9s", "9c"], result="won", profit=80.0, pot_size=160.0)
    return s.id


def test_build_session_stats(db, session_with_rounds):
    stats = build_session_stats(db, session_with_rounds)
    assert stats["total_rounds"] == 3
    assert stats["total_profit"] == 150.0
    assert stats["rounds_won"] == 2
    assert stats["rounds_lost"] == 1


@pytest.mark.asyncio
async def test_generate_session_summary(db, session_with_rounds):
    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = "Solid session. Won 2/3 hands for +$150. Strong hand selection."
        summary = await generate_session_summary(db, session_with_rounds)
        assert "150" in summary or "Solid" in summary
        mock_ai.assert_called_once()


@pytest.mark.asyncio
async def test_generate_pid_update(db, session_with_rounds):
    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = "# Player Intelligence Document\nUpdated after session."
        pid = await generate_pid_update(db, session_with_rounds, current_pid="# Old PID")
        assert "Player Intelligence Document" in pid
        mock_ai.assert_called_once()
