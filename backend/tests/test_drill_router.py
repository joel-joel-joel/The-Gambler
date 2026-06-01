"""Tests for the drills REST API endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, get_db
from app.main import app

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()
    from app.services.drill_service import _pending_drills
    _pending_drills.clear()


client = TestClient(app)


def test_get_progress():
    resp = client.get("/api/drills/progress")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 6
    assert data[0]["skill"] == "outs"
    assert data[0]["status"] == "active"


def test_generate_drill():
    resp = client.post("/api/drills/generate", json={"skill": "outs", "source": "random"})
    assert resp.status_code == 200
    data = resp.json()
    assert "drill_id" in data
    assert "scenario" in data
    assert "question_text" in data
    assert data["answer_type"] == "integer"


def test_generate_locked_skill():
    resp = client.post("/api/drills/generate", json={"skill": "rule_of_2_4", "source": "random"})
    assert resp.status_code == 400


def test_check_drill():
    gen_resp = client.post("/api/drills/generate", json={"skill": "outs", "source": "random"})
    drill_id = gen_resp.json()["drill_id"]
    check_resp = client.post("/api/drills/check", json={
        "drill_id": drill_id,
        "user_answer": 0,
        "response_time_ms": 3000,
    })
    assert check_resp.status_code == 200
    data = check_resp.json()
    assert "is_correct" in data
    assert "correct_answer" in data
    assert "accuracy_now" in data
    assert "graduated" in data


def test_check_invalid_drill_id():
    resp = client.post("/api/drills/check", json={
        "drill_id": "nonexistent",
        "user_answer": 5,
        "response_time_ms": 3000,
    })
    assert resp.status_code == 400


def test_drill_history():
    gen_resp = client.post("/api/drills/generate", json={"skill": "outs", "source": "random"})
    drill_id = gen_resp.json()["drill_id"]
    client.post("/api/drills/check", json={
        "drill_id": drill_id,
        "user_answer": 5,
        "response_time_ms": 3000,
    })
    resp = client.get("/api/drills/history?skill=outs&limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1


def test_focus_suggestion():
    resp = client.get("/api/drills/focus")
    assert resp.status_code == 200
    data = resp.json()
    assert "suggested_skill" in data
    assert "reason" in data
