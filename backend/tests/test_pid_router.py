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


def test_get_pid_returns_default():
    response = client.get("/api/pid")
    assert response.status_code == 200
    data = response.json()
    assert "pid_markdown" in data
    assert "Player Intelligence Document" in data["pid_markdown"]


def test_put_pid_saves_and_returns():
    response = client.put(
        "/api/pid",
        json={"pid_markdown": "# Updated PID\nNew content here"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 1

    response = client.get("/api/pid")
    assert "New content here" in response.json()["pid_markdown"]


def test_put_pid_increments_version():
    client.put("/api/pid", json={"pid_markdown": "Version 1"})
    response = client.put("/api/pid", json={"pid_markdown": "Version 2"})
    assert response.json()["version"] == 2
