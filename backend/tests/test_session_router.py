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


def test_start_session():
    response = client.post("/api/sessions")
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is True
    assert "id" in data


def test_get_active_session():
    client.post("/api/sessions")
    response = client.get("/api/sessions/active")
    assert response.status_code == 200
    assert response.json()["is_active"] is True


def test_get_active_session_none():
    response = client.get("/api/sessions/active")
    assert response.status_code == 404


def test_end_session():
    create_resp = client.post("/api/sessions")
    session_id = create_resp.json()["id"]
    response = client.post(f"/api/sessions/{session_id}/end")
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_list_sessions():
    client.post("/api/sessions")
    client.post("/api/sessions")
    response = client.get("/api/sessions")
    assert response.status_code == 200
    assert len(response.json()) == 2
