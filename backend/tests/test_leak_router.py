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


def test_create_leak():
    resp = client.post("/api/leaks", json={
        "description": "Calling too wide",
        "category": "preflop",
        "ev_impact": "high",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Calling too wide"
    assert data["status"] == "active"
    assert data["source"] == "manual"


def test_list_leaks():
    client.post("/api/leaks", json={"description": "L1"})
    client.post("/api/leaks", json={"description": "L2"})
    resp = client.get("/api/leaks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_leaks_with_status_filter():
    client.post("/api/leaks", json={"description": "Active"})
    client.post("/api/leaks", json={"description": "Resolved", "status": "resolved"})
    resp = client.get("/api/leaks?status=active")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_update_leak():
    create_resp = client.post("/api/leaks", json={"description": "Before"})
    leak_id = create_resp.json()["id"]
    resp = client.put(f"/api/leaks/{leak_id}", json={"status": "improving"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "improving"


def test_delete_leak():
    create_resp = client.post("/api/leaks", json={"description": "Bye"})
    leak_id = create_resp.json()["id"]
    resp = client.delete(f"/api/leaks/{leak_id}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
