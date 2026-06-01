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


def test_create_opponent():
    resp = client.post("/api/opponents", json={
        "name": "Mike",
        "tendency_tags": ["Tight", "Aggressive"],
        "vpip_estimate": 20,
        "pfr_estimate": 15,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Mike"
    assert "Tight" in data["tendency_tags"]
    assert data["vpip_estimate"] == 20


def test_list_opponents():
    client.post("/api/opponents", json={"name": "P1"})
    client.post("/api/opponents", json={"name": "P2"})
    resp = client.get("/api/opponents")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_opponent():
    create_resp = client.post("/api/opponents", json={"name": "Solo"})
    opp_id = create_resp.json()["id"]
    resp = client.get(f"/api/opponents/{opp_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Solo"


def test_update_opponent():
    create_resp = client.post("/api/opponents", json={"name": "Old"})
    opp_id = create_resp.json()["id"]
    resp = client.put(f"/api/opponents/{opp_id}", json={"name": "New", "vpip_estimate": 50})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"
    assert resp.json()["vpip_estimate"] == 50


def test_delete_opponent():
    create_resp = client.post("/api/opponents", json={"name": "Bye"})
    opp_id = create_resp.json()["id"]
    resp = client.delete(f"/api/opponents/{opp_id}")
    assert resp.status_code == 200
    get_resp = client.get(f"/api/opponents/{opp_id}")
    assert get_resp.status_code == 404


def test_get_opponent_not_found():
    resp = client.get("/api/opponents/999")
    assert resp.status_code == 404
