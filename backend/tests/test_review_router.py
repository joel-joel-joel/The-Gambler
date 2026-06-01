import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, get_db, SessionRecord, RoundRecord
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


client = TestClient(app)


def _create_session_with_rounds():
    db = TestSession()
    session_rec = SessionRecord(user_id="default", is_active=0, total_rounds=2)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)
    sid = session_rec.id
    rounds_data = [
        {"hole_cards": ["Ah", "Kh"], "community_cards": ["2h", "7h", "Td"], "pot_size": 100, "result": "lost", "profit": -50},
        {"hole_cards": ["Qc", "Qd"], "community_cards": ["2s", "5d", "8c"], "pot_size": 80, "result": "won", "profit": 80},
    ]
    for i, rd in enumerate(rounds_data):
        db.add(RoundRecord(
            session_id=sid, round_number=i + 1,
            hole_cards=json.dumps(rd["hole_cards"]),
            community_cards=json.dumps(rd["community_cards"]),
            pot_size=rd["pot_size"],
            result=rd["result"],
            profit=rd["profit"],
        ))
    db.commit()
    db.close()
    return sid


def test_generate_review():
    sid = _create_session_with_rounds()
    resp = client.post(f"/api/sessions/{sid}/review")
    assert resp.status_code == 200
    data = resp.json()
    assert "hands" in data
    assert len(data["hands"]) <= 3
    for hand in data["hands"]:
        assert len(hand["questions"]) == 4


def test_generate_review_session_not_found():
    resp = client.post("/api/sessions/9999/review")
    assert resp.status_code == 404


def test_check_review_answer():
    resp = client.post("/api/sessions/1/review/check", json={
        "hand_index": 0,
        "question_index": 0,
        "correct_answer": 9.0,
        "user_answer": 9.0,
        "answer_type": "integer",
        "tolerance": 0.0,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_correct"] is True


def test_check_review_answer_wrong():
    resp = client.post("/api/sessions/1/review/check", json={
        "hand_index": 0,
        "question_index": 0,
        "correct_answer": 9.0,
        "user_answer": 5.0,
        "answer_type": "integer",
        "tolerance": 0.0,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_correct"] is False
