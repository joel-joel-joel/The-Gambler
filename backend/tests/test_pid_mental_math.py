import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord, RoundRecord, PIDRecord, SkillProgress
from app.services.session_end_service import generate_pid_update


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


@pytest.mark.asyncio
async def test_pid_update_includes_drill_progress():
    db = TestSession()
    session_rec = SessionRecord(user_id="default", total_rounds=1)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)

    db.add(RoundRecord(
        session_id=session_rec.id,
        round_number=1,
        hole_cards='["Ah", "Kh"]',
        community_cards='["2h", "7h", "Td"]',
        pot_size=100,
        result="won",
        profit=50,
    ))
    db.add(SkillProgress(skill="outs", status="graduated", total_attempts=55, correct_count=50, current_accuracy=0.91, avg_response_time_ms=3200))
    db.add(SkillProgress(skill="rule_of_2_4", status="active", total_attempts=30, correct_count=24, current_accuracy=0.80, avg_response_time_ms=6100))
    db.commit()

    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = "Updated PID with mental math section"
        result = await generate_pid_update(db, session_rec.id, "# Current PID")

        call_args = mock_ai.call_args
        user_prompt = call_args[0][1]
        assert "MENTAL MATH PROGRESS" in user_prompt
        assert "outs" in user_prompt.lower()
        assert "rule_of_2_4" in user_prompt.lower() or "rule" in user_prompt.lower()
    db.close()


@pytest.mark.asyncio
async def test_pid_update_no_drill_progress():
    db = TestSession()
    session_rec = SessionRecord(user_id="default", total_rounds=1)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)

    db.add(RoundRecord(
        session_id=session_rec.id,
        round_number=1,
        hole_cards='["Ah", "Kh"]',
        community_cards='["2h", "7h", "Td"]',
        pot_size=100,
        result="won",
        profit=50,
    ))
    db.commit()

    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = "Updated PID without mental math"
        result = await generate_pid_update(db, session_rec.id, "# Current PID")

        call_args = mock_ai.call_args
        user_prompt = call_args[0][1]
        # No drill progress data should be present when no attempts
        assert "MENTAL MATH PROGRESS" not in user_prompt
    db.close()
