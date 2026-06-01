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


client = TestClient(app)


@pytest.fixture
def session_id():
    resp = client.post("/api/sessions")
    return resp.json()["id"]


def test_save_round(session_id):
    response = client.post(
        "/api/rounds",
        json={
            "session_id": session_id,
            "hole_cards": ["Ah", "Kd"],
            "community_cards": ["7h", "2d", "9c"],
            "pot_size": 200,
            "result": "won",
            "profit": 120,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["round_number"] == 1
    assert data["hole_cards"] == ["Ah", "Kd"]


def test_list_rounds(session_id):
    client.post("/api/rounds", json={"session_id": session_id, "hole_cards": ["Ah", "Kd"]})
    client.post("/api/rounds", json={"session_id": session_id, "hole_cards": ["Qs", "Jh"]})
    response = client.get(f"/api/rounds?session_id={session_id}")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_round(session_id):
    create_resp = client.post(
        "/api/rounds",
        json={"session_id": session_id, "hole_cards": ["Ah", "Kd"]},
    )
    round_id = create_resp.json()["id"]
    response = client.get(f"/api/rounds/{round_id}")
    assert response.status_code == 200
    assert response.json()["hole_cards"] == ["Ah", "Kd"]


def test_delete_round(session_id):
    create_resp = client.post(
        "/api/rounds",
        json={"session_id": session_id, "hole_cards": ["Ah", "Kd"]},
    )
    round_id = create_resp.json()["id"]
    response = client.delete(f"/api/rounds/{round_id}")
    assert response.status_code == 200
    get_resp = client.get(f"/api/rounds/{round_id}")
    assert get_resp.status_code == 404
