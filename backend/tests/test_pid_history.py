import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.models.database import Base, PIDRecord, PIDHistory, get_db
from app.services.pid_service import get_pid, save_pid, list_pid_versions, get_pid_version
from app.main import app

# Shared in-memory engine for service-layer tests
_service_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_ServiceSession = sessionmaker(bind=_service_engine)

# Shared in-memory engine for router tests
_router_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_RouterSession = sessionmaker(bind=_router_engine)


@pytest.fixture
def db():
    Base.metadata.create_all(bind=_service_engine)
    session = _ServiceSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=_service_engine)


def _override_get_db():
    db = _RouterSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    Base.metadata.create_all(bind=_router_engine)
    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=_router_engine)


def test_save_pid_creates_history(db):
    save_pid(db, "default", "Version 1 content")
    save_pid(db, "default", "Version 2 content")
    histories = db.query(PIDHistory).all()
    assert len(histories) == 1
    assert histories[0].pid_markdown == "Version 1 content"
    assert histories[0].version == 1


def test_save_pid_first_time_no_history(db):
    save_pid(db, "default", "First ever PID")
    histories = db.query(PIDHistory).all()
    assert len(histories) == 0


def test_save_pid_with_trigger(db):
    save_pid(db, "default", "V1")
    save_pid(db, "default", "V2", trigger="session_end", session_id=5)
    history = db.query(PIDHistory).first()
    assert history.trigger == "session_end"
    assert history.session_id == 5


def test_list_pid_versions(db):
    save_pid(db, "default", "V1")
    save_pid(db, "default", "V2")
    save_pid(db, "default", "V3")
    versions = list_pid_versions(db, "default")
    assert len(versions) == 2
    assert versions[0].version == 2
    assert versions[1].version == 1


def test_get_pid_version(db):
    save_pid(db, "default", "V1")
    save_pid(db, "default", "V2")
    history = db.query(PIDHistory).first()
    version = get_pid_version(db, history.id)
    assert version is not None
    assert version.pid_markdown == "V1"


def test_pid_history_router_list(client):
    client.put("/api/pid", json={"pid_markdown": "V1"})
    client.put("/api/pid", json={"pid_markdown": "V2"})
    resp = client.get("/api/pid/history")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1


def test_pid_history_router_get_version(client):
    client.put("/api/pid", json={"pid_markdown": "First"})
    client.put("/api/pid", json={"pid_markdown": "Second"})
    list_resp = client.get("/api/pid/history")
    history_id = list_resp.json()[0]["id"]
    resp = client.get(f"/api/pid/history/{history_id}")
    assert resp.status_code == 200
    assert resp.json()["pid_markdown"] == "First"
