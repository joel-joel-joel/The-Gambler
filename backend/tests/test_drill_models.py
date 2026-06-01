import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, DrillAttempt, SkillProgress


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


def test_create_drill_attempt():
    db = TestSession()
    attempt = DrillAttempt(
        skill="outs",
        scenario='{"hole_cards": ["Ah", "Kh"], "community_cards": ["2h", "7h", "Td"]}',
        correct_answer=9.0,
        user_answer=9.0,
        is_correct=1,
        response_time_ms=3200,
        source="random",
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    assert attempt.id is not None
    assert attempt.skill == "outs"
    assert attempt.user_id == "default"
    assert attempt.created_at is not None
    db.close()


def test_create_skill_progress():
    db = TestSession()
    progress = SkillProgress(
        skill="outs",
        status="active",
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    assert progress.id is not None
    assert progress.total_attempts == 0
    assert progress.correct_count == 0
    assert progress.current_accuracy == 0.0
    assert progress.streak_days == 0
    assert progress.graduated_at is None
    db.close()


def test_skill_progress_unique_per_user():
    db = TestSession()
    p1 = SkillProgress(skill="outs", user_id="default", status="active")
    db.add(p1)
    db.commit()
    p2 = SkillProgress(skill="outs", user_id="default", status="active")
    db.add(p2)
    with pytest.raises(Exception):
        db.commit()
    db.rollback()
    db.close()
