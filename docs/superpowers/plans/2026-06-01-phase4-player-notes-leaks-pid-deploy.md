# Phase 4: Player Notes + Leaks + PID Viewer + Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opponent profiles, structured leak tracking, PID viewer with version history, tab navigation, and Docker deployment.

**Architecture:** Four new backend subsystems (opponents, leaks, PID history, Docker) + frontend navigation tabs with three pages. All new DB tables use SQLAlchemy create_all. Session-end flow extended to generate leaks. PID save extended to snapshot history.

**Tech Stack:** FastAPI, SQLAlchemy + SQLite, React 18 + Zustand + Tailwind v3, Docker + nginx

**Spec:** `docs/superpowers/specs/2026-06-01-phase4-player-notes-leaks-pid-deploy.md`

---

### Task 1: PlayerProfile DB Model + Opponent Service

**Files:**
- Modify: `backend/app/models/database.py`
- Create: `backend/app/services/opponent_service.py`
- Create: `backend/tests/test_opponent_service.py`

**Scene-setting:** The database models live in `backend/app/models/database.py`. There are existing models: `PIDRecord`, `SessionRecord`, `RoundRecord`, `RoundCondensed`. All use SQLAlchemy's `DeclarativeBase` with `Base` as the base class. The database is SQLite with `create_all` on startup. All service functions take a `db: Session` as the first argument.

- [ ] **Step 1: Add PlayerProfile model to database.py**

Add after the `RoundCondensed` class in `backend/app/models/database.py`:

```python
class PlayerProfile(Base):
    __tablename__ = "player_profiles"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    user_id = Column(String, nullable=False, default="default")
    tendency_tags = Column(Text, nullable=False, default="[]")
    vpip_estimate = Column(Integer, nullable=True)
    pfr_estimate = Column(Integer, nullable=True)
    notes = Column(Text, nullable=False, default="")
    key_hands = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Write failing tests for opponent_service**

Create `backend/tests/test_opponent_service.py`:

```python
import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, PlayerProfile
from app.services.opponent_service import (
    create_opponent,
    get_opponent,
    list_opponents,
    update_opponent,
    delete_opponent,
)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_create_opponent(db):
    opp = create_opponent(db, name="Mike", user_id="default", tendency_tags=["Tight", "Aggressive"])
    assert opp.id is not None
    assert opp.name == "Mike"
    tags = json.loads(opp.tendency_tags)
    assert "Tight" in tags
    assert "Aggressive" in tags


def test_get_opponent(db):
    opp = create_opponent(db, name="Sarah", user_id="default")
    fetched = get_opponent(db, opp.id)
    assert fetched is not None
    assert fetched.name == "Sarah"


def test_get_opponent_not_found(db):
    assert get_opponent(db, 999) is None


def test_list_opponents(db):
    create_opponent(db, name="Player1", user_id="default")
    create_opponent(db, name="Player2", user_id="default")
    create_opponent(db, name="Player3", user_id="other")
    result = list_opponents(db, "default")
    assert len(result) == 2


def test_update_opponent(db):
    opp = create_opponent(db, name="Old Name", user_id="default")
    updated = update_opponent(db, opp.id, name="New Name", vpip_estimate=45)
    assert updated.name == "New Name"
    assert updated.vpip_estimate == 45


def test_update_opponent_not_found(db):
    result = update_opponent(db, 999, name="X")
    assert result is None


def test_delete_opponent(db):
    opp = create_opponent(db, name="ToDelete", user_id="default")
    assert delete_opponent(db, opp.id) is True
    assert get_opponent(db, opp.id) is None


def test_delete_opponent_not_found(db):
    assert delete_opponent(db, 999) is False
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_opponent_service.py -v`
Expected: FAIL — `opponent_service` module does not exist.

- [ ] **Step 4: Implement opponent_service.py**

Create `backend/app/services/opponent_service.py`:

```python
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import PlayerProfile


def create_opponent(
    db: Session,
    name: str,
    user_id: str = "default",
    tendency_tags: list[str] | None = None,
    vpip_estimate: int | None = None,
    pfr_estimate: int | None = None,
    notes: str = "",
    key_hands: list[str] | None = None,
) -> PlayerProfile:
    opp = PlayerProfile(
        name=name,
        user_id=user_id,
        tendency_tags=json.dumps(tendency_tags or []),
        vpip_estimate=vpip_estimate,
        pfr_estimate=pfr_estimate,
        notes=notes,
        key_hands=json.dumps(key_hands or []),
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)
    return opp


def get_opponent(db: Session, opponent_id: int) -> PlayerProfile | None:
    return db.query(PlayerProfile).filter(PlayerProfile.id == opponent_id).first()


def list_opponents(db: Session, user_id: str = "default") -> list[PlayerProfile]:
    return (
        db.query(PlayerProfile)
        .filter(PlayerProfile.user_id == user_id)
        .order_by(PlayerProfile.name)
        .all()
    )


def update_opponent(db: Session, opponent_id: int, **kwargs) -> PlayerProfile | None:
    opp = get_opponent(db, opponent_id)
    if opp is None:
        return None

    if "tendency_tags" in kwargs and isinstance(kwargs["tendency_tags"], list):
        kwargs["tendency_tags"] = json.dumps(kwargs["tendency_tags"])
    if "key_hands" in kwargs and isinstance(kwargs["key_hands"], list):
        kwargs["key_hands"] = json.dumps(kwargs["key_hands"])

    for key, value in kwargs.items():
        if hasattr(opp, key):
            setattr(opp, key, value)

    opp.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(opp)
    return opp


def delete_opponent(db: Session, opponent_id: int) -> bool:
    opp = get_opponent(db, opponent_id)
    if opp is None:
        return False
    db.delete(opp)
    db.commit()
    return True
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_opponent_service.py -v`
Expected: 8 PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/database.py backend/app/services/opponent_service.py backend/tests/test_opponent_service.py
git commit -m "feat: add PlayerProfile model and opponent CRUD service"
```

---

### Task 2: Opponent REST Router

**Files:**
- Create: `backend/app/routers/opponents.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_opponent_router.py`

**Scene-setting:** Existing routers follow a pattern: Pydantic request models, `Depends(get_db)` for DB session, helper `_to_dict()` function for serialization. See `backend/app/routers/sessions.py` for the pattern. The router is registered in `backend/app/main.py` with `app.include_router(router)`. JSON fields (`tendency_tags`, `key_hands`) are stored as JSON strings in the DB but should be returned as parsed arrays in the API response.

- [ ] **Step 1: Write failing tests for opponent router**

Create `backend/tests/test_opponent_router.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, get_db
from app.main import app


@pytest.fixture
def client():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_create_opponent(client):
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


def test_list_opponents(client):
    client.post("/api/opponents", json={"name": "P1"})
    client.post("/api/opponents", json={"name": "P2"})
    resp = client.get("/api/opponents")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_opponent(client):
    create_resp = client.post("/api/opponents", json={"name": "Solo"})
    opp_id = create_resp.json()["id"]
    resp = client.get(f"/api/opponents/{opp_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Solo"


def test_update_opponent(client):
    create_resp = client.post("/api/opponents", json={"name": "Old"})
    opp_id = create_resp.json()["id"]
    resp = client.put(f"/api/opponents/{opp_id}", json={"name": "New", "vpip_estimate": 50})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"
    assert resp.json()["vpip_estimate"] == 50


def test_delete_opponent(client):
    create_resp = client.post("/api/opponents", json={"name": "Bye"})
    opp_id = create_resp.json()["id"]
    resp = client.delete(f"/api/opponents/{opp_id}")
    assert resp.status_code == 200
    get_resp = client.get(f"/api/opponents/{opp_id}")
    assert get_resp.status_code == 404


def test_get_opponent_not_found(client):
    resp = client.get("/api/opponents/999")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_opponent_router.py -v`
Expected: FAIL — router module does not exist or routes not found.

- [ ] **Step 3: Implement opponent router**

Create `backend/app/routers/opponents.py`:

```python
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.opponent_service import (
    create_opponent,
    get_opponent,
    list_opponents,
    update_opponent,
    delete_opponent,
)

router = APIRouter()


class CreateOpponentRequest(BaseModel):
    name: str
    tendency_tags: list[str] = []
    vpip_estimate: int | None = None
    pfr_estimate: int | None = None
    notes: str = ""
    key_hands: list[str] = []


class UpdateOpponentRequest(BaseModel):
    name: str | None = None
    tendency_tags: list[str] | None = None
    vpip_estimate: int | None = None
    pfr_estimate: int | None = None
    notes: str | None = None
    key_hands: list[str] | None = None


def _opponent_to_dict(opp) -> dict:
    return {
        "id": opp.id,
        "name": opp.name,
        "user_id": opp.user_id,
        "tendency_tags": json.loads(opp.tendency_tags) if opp.tendency_tags else [],
        "vpip_estimate": opp.vpip_estimate,
        "pfr_estimate": opp.pfr_estimate,
        "notes": opp.notes,
        "key_hands": json.loads(opp.key_hands) if opp.key_hands else [],
        "created_at": opp.created_at.isoformat() if opp.created_at else None,
        "updated_at": opp.updated_at.isoformat() if opp.updated_at else None,
    }


@router.post("/api/opponents")
def create_opponent_endpoint(req: CreateOpponentRequest, db: Session = Depends(get_db)):
    opp = create_opponent(
        db,
        name=req.name,
        tendency_tags=req.tendency_tags,
        vpip_estimate=req.vpip_estimate,
        pfr_estimate=req.pfr_estimate,
        notes=req.notes,
        key_hands=req.key_hands,
    )
    return _opponent_to_dict(opp)


@router.get("/api/opponents")
def list_opponents_endpoint(db: Session = Depends(get_db)):
    opponents = list_opponents(db)
    return [_opponent_to_dict(o) for o in opponents]


@router.get("/api/opponents/{opponent_id}")
def get_opponent_endpoint(opponent_id: int, db: Session = Depends(get_db)):
    opp = get_opponent(db, opponent_id)
    if opp is None:
        raise HTTPException(status_code=404, detail="Opponent not found")
    return _opponent_to_dict(opp)


@router.put("/api/opponents/{opponent_id}")
def update_opponent_endpoint(opponent_id: int, req: UpdateOpponentRequest, db: Session = Depends(get_db)):
    updates = req.model_dump(exclude_none=True)
    opp = update_opponent(db, opponent_id, **updates)
    if opp is None:
        raise HTTPException(status_code=404, detail="Opponent not found")
    return _opponent_to_dict(opp)


@router.delete("/api/opponents/{opponent_id}")
def delete_opponent_endpoint(opponent_id: int, db: Session = Depends(get_db)):
    success = delete_opponent(db, opponent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Opponent not found")
    return {"deleted": True}
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/app/main.py` imports:
```python
from app.routers.opponents import router as opponents_router
```

Add to the `include_router` section:
```python
app.include_router(opponents_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_opponent_router.py -v`
Expected: 6 PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/opponents.py backend/app/main.py backend/tests/test_opponent_router.py
git commit -m "feat: add opponent profiles REST API endpoints"
```

---

### Task 3: LeakRecord DB Model + Leak Service

**Files:**
- Modify: `backend/app/models/database.py`
- Create: `backend/app/services/leak_service.py`
- Create: `backend/tests/test_leak_service.py`

**Scene-setting:** Same database.py pattern. The leak service needs both manual CRUD and an AI-powered generation function. The AI function should call `chat_with_ai` from `backend/app/services/ai_service.py` (async, takes system_prompt + user_message strings, returns string). The AI should return a JSON array of leak objects. Parse that and create LeakRecord rows. Fall back gracefully if AI is not configured or returns bad JSON.

- [ ] **Step 1: Add LeakRecord model to database.py**

Add after the `PlayerProfile` class in `backend/app/models/database.py`:

```python
class LeakRecord(Base):
    __tablename__ = "leaks"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, default="default")
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False, default="general")
    ev_impact = Column(String, nullable=False, default="medium")
    status = Column(String, nullable=False, default="active")
    source = Column(String, nullable=False, default="manual")
    session_id = Column(Integer, nullable=True)
    evidence = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Write failing tests for leak_service**

Create `backend/tests/test_leak_service.py`:

```python
import json
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, LeakRecord
from app.services.leak_service import (
    create_leak,
    list_leaks,
    update_leak,
    delete_leak,
    generate_leaks_from_session,
)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_create_leak(db):
    leak = create_leak(db, description="Calling too wide preflop", category="preflop", ev_impact="high")
    assert leak.id is not None
    assert leak.description == "Calling too wide preflop"
    assert leak.category == "preflop"
    assert leak.ev_impact == "high"
    assert leak.status == "active"
    assert leak.source == "manual"


def test_list_leaks(db):
    create_leak(db, description="Leak 1")
    create_leak(db, description="Leak 2")
    create_leak(db, description="Leak 3", status="resolved")
    all_leaks = list_leaks(db)
    assert len(all_leaks) == 3
    active_leaks = list_leaks(db, status_filter="active")
    assert len(active_leaks) == 2


def test_update_leak(db):
    leak = create_leak(db, description="Old", status="active")
    updated = update_leak(db, leak.id, status="improving", description="Updated")
    assert updated.status == "improving"
    assert updated.description == "Updated"


def test_update_leak_not_found(db):
    assert update_leak(db, 999, status="resolved") is None


def test_delete_leak(db):
    leak = create_leak(db, description="Gone")
    assert delete_leak(db, leak.id) is True
    assert delete_leak(db, leak.id) is False


@pytest.mark.asyncio
async def test_generate_leaks_from_session(db):
    ai_response = json.dumps([
        {"description": "Overfolding to river bets", "category": "postflop", "ev_impact": "high", "evidence": "Folded river in 3 of 4 spots"},
        {"description": "Not c-betting enough", "category": "postflop", "ev_impact": "medium", "evidence": "Checked flop 60% of time as PFR"},
    ])

    with patch("app.services.leak_service.chat_with_ai", new_callable=AsyncMock, return_value=ai_response):
        leaks = await generate_leaks_from_session(db, session_id=1)

    assert len(leaks) == 2
    assert leaks[0].source == "ai"
    assert leaks[0].session_id == 1
    assert leaks[0].category == "postflop"


@pytest.mark.asyncio
async def test_generate_leaks_bad_ai_response(db):
    with patch("app.services.leak_service.chat_with_ai", new_callable=AsyncMock, return_value="not json"):
        leaks = await generate_leaks_from_session(db, session_id=1)

    assert leaks == []
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_leak_service.py -v`
Expected: FAIL — `leak_service` module does not exist.

- [ ] **Step 4: Implement leak_service.py**

Create `backend/app/services/leak_service.py`:

```python
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import LeakRecord
from app.services.ai_service import chat_with_ai
from app.services.round_service import list_rounds


def create_leak(
    db: Session,
    description: str,
    category: str = "general",
    ev_impact: str = "medium",
    status: str = "active",
    source: str = "manual",
    session_id: int | None = None,
    evidence: str | None = None,
    user_id: str = "default",
) -> LeakRecord:
    leak = LeakRecord(
        user_id=user_id,
        description=description,
        category=category,
        ev_impact=ev_impact,
        status=status,
        source=source,
        session_id=session_id,
        evidence=evidence,
    )
    db.add(leak)
    db.commit()
    db.refresh(leak)
    return leak


def list_leaks(
    db: Session,
    user_id: str = "default",
    status_filter: str | None = None,
) -> list[LeakRecord]:
    query = db.query(LeakRecord).filter(LeakRecord.user_id == user_id)
    if status_filter:
        query = query.filter(LeakRecord.status == status_filter)
    return query.order_by(LeakRecord.created_at.desc()).all()


def update_leak(db: Session, leak_id: int, **kwargs) -> LeakRecord | None:
    leak = db.query(LeakRecord).filter(LeakRecord.id == leak_id).first()
    if leak is None:
        return None
    for key, value in kwargs.items():
        if hasattr(leak, key):
            setattr(leak, key, value)
    leak.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(leak)
    return leak


def delete_leak(db: Session, leak_id: int) -> bool:
    leak = db.query(LeakRecord).filter(LeakRecord.id == leak_id).first()
    if leak is None:
        return False
    db.delete(leak)
    db.commit()
    return True


def _rounds_to_text(db: Session, session_id: int) -> str:
    rounds = list_rounds(db, session_id)
    round_dicts = []
    for r in rounds:
        round_dicts.append({
            "round_number": r.round_number,
            "hole_cards": json.loads(r.hole_cards),
            "community_cards": json.loads(r.community_cards),
            "position": r.position,
            "pot_size": r.pot_size,
            "result": r.result,
            "profit": r.profit,
        })
    return json.dumps(round_dicts, indent=2)


async def generate_leaks_from_session(
    db: Session,
    session_id: int,
    user_id: str = "default",
) -> list[LeakRecord]:
    rounds_text = _rounds_to_text(db, session_id)

    prompt = (
        "Analyze these poker session rounds and identify player leaks.\n\n"
        f"Rounds:\n{rounds_text}\n\n"
        "Return a JSON array of leak objects. Each object must have:\n"
        '- "description": short description of the leak\n'
        '- "category": one of "preflop", "postflop", "tilt", "sizing", "general"\n'
        '- "ev_impact": one of "high", "medium", "low"\n'
        '- "evidence": specific hand/pattern evidence\n\n'
        "Return ONLY the JSON array, no other text."
    )

    raw = await chat_with_ai(
        "You are a poker leak analyst. Return only valid JSON.",
        prompt,
    )

    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        leak_data = json.loads(raw)
    except json.JSONDecodeError:
        return []

    if not isinstance(leak_data, list):
        return []

    created = []
    for item in leak_data:
        if not isinstance(item, dict) or "description" not in item:
            continue
        leak = create_leak(
            db,
            description=item["description"],
            category=item.get("category", "general"),
            ev_impact=item.get("ev_impact", "medium"),
            source="ai",
            session_id=session_id,
            evidence=item.get("evidence"),
            user_id=user_id,
        )
        created.append(leak)

    return created
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_leak_service.py -v`
Expected: 7 PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/database.py backend/app/services/leak_service.py backend/tests/test_leak_service.py
git commit -m "feat: add LeakRecord model and leak CRUD service with AI generation"
```

---

### Task 4: Leak REST Router

**Files:**
- Create: `backend/app/routers/leaks.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_leak_router.py`

**Scene-setting:** Same router pattern as opponents. Register in main.py. The router needs both sync CRUD endpoints and one async endpoint that triggers AI leak generation.

- [ ] **Step 1: Write failing tests for leak router**

Create `backend/tests/test_leak_router.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, get_db
from app.main import app


@pytest.fixture
def client():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_create_leak(client):
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


def test_list_leaks(client):
    client.post("/api/leaks", json={"description": "L1"})
    client.post("/api/leaks", json={"description": "L2"})
    resp = client.get("/api/leaks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_leaks_with_status_filter(client):
    client.post("/api/leaks", json={"description": "Active"})
    client.post("/api/leaks", json={"description": "Resolved", "status": "resolved"})
    resp = client.get("/api/leaks?status=active")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_update_leak(client):
    create_resp = client.post("/api/leaks", json={"description": "Before"})
    leak_id = create_resp.json()["id"]
    resp = client.put(f"/api/leaks/{leak_id}", json={"status": "improving"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "improving"


def test_delete_leak(client):
    create_resp = client.post("/api/leaks", json={"description": "Bye"})
    leak_id = create_resp.json()["id"]
    resp = client.delete(f"/api/leaks/{leak_id}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_leak_router.py -v`
Expected: FAIL

- [ ] **Step 3: Implement leak router**

Create `backend/app/routers/leaks.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.leak_service import (
    create_leak,
    list_leaks,
    update_leak,
    delete_leak,
)

router = APIRouter()


class CreateLeakRequest(BaseModel):
    description: str
    category: str = "general"
    ev_impact: str = "medium"
    status: str = "active"


class UpdateLeakRequest(BaseModel):
    description: str | None = None
    category: str | None = None
    ev_impact: str | None = None
    status: str | None = None
    evidence: str | None = None


def _leak_to_dict(leak) -> dict:
    return {
        "id": leak.id,
        "user_id": leak.user_id,
        "description": leak.description,
        "category": leak.category,
        "ev_impact": leak.ev_impact,
        "status": leak.status,
        "source": leak.source,
        "session_id": leak.session_id,
        "evidence": leak.evidence,
        "created_at": leak.created_at.isoformat() if leak.created_at else None,
        "updated_at": leak.updated_at.isoformat() if leak.updated_at else None,
    }


@router.post("/api/leaks")
def create_leak_endpoint(req: CreateLeakRequest, db: Session = Depends(get_db)):
    leak = create_leak(
        db,
        description=req.description,
        category=req.category,
        ev_impact=req.ev_impact,
        status=req.status,
    )
    return _leak_to_dict(leak)


@router.get("/api/leaks")
def list_leaks_endpoint(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    leaks = list_leaks(db, status_filter=status)
    return [_leak_to_dict(l) for l in leaks]


@router.put("/api/leaks/{leak_id}")
def update_leak_endpoint(leak_id: int, req: UpdateLeakRequest, db: Session = Depends(get_db)):
    updates = req.model_dump(exclude_none=True)
    leak = update_leak(db, leak_id, **updates)
    if leak is None:
        raise HTTPException(status_code=404, detail="Leak not found")
    return _leak_to_dict(leak)


@router.delete("/api/leaks/{leak_id}")
def delete_leak_endpoint(leak_id: int, db: Session = Depends(get_db)):
    success = delete_leak(db, leak_id)
    if not success:
        raise HTTPException(status_code=404, detail="Leak not found")
    return {"deleted": True}
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/app/main.py` imports:
```python
from app.routers.leaks import router as leaks_router
```

Add to the `include_router` section:
```python
app.include_router(leaks_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_leak_router.py -v`
Expected: 5 PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/leaks.py backend/app/main.py backend/tests/test_leak_router.py
git commit -m "feat: add leaks REST API endpoints"
```

---

### Task 5: PID History Model + Service + Router

**Files:**
- Modify: `backend/app/models/database.py`
- Modify: `backend/app/services/pid_service.py`
- Modify: `backend/app/routers/pid.py`
- Create: `backend/tests/test_pid_history.py`

**Scene-setting:** The PID system already works: `PIDRecord` stores current PID, `pid_service.py` has `get_pid()` and `save_pid()`, `pid.py` router has `GET /api/pid` and `PUT /api/pid`. We need to add a `PIDHistory` table and modify `save_pid()` to snapshot the old PID before overwriting. Then add history list/detail endpoints to the existing router.

- [ ] **Step 1: Add PIDHistory model to database.py**

Add after the `PIDRecord` class in `backend/app/models/database.py`:

```python
class PIDHistory(Base):
    __tablename__ = "pid_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, default="default")
    version = Column(Integer, nullable=False)
    pid_markdown = Column(Text, nullable=False)
    trigger = Column(String, nullable=False, default="manual_edit")
    session_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Write failing tests**

Create `backend/tests/test_pid_history.py`:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.models.database import Base, PIDRecord, PIDHistory, get_db
from app.services.pid_service import get_pid, save_pid, list_pid_versions, get_pid_version
from app.main import app


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def client():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_pid_history.py -v`
Expected: FAIL — `PIDHistory` and `list_pid_versions`/`get_pid_version` don't exist yet.

- [ ] **Step 4: Modify pid_service.py to snapshot history**

Replace the full content of `backend/app/services/pid_service.py`:

```python
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import PIDRecord, PIDHistory

DEFAULT_PID = """# Player Intelligence Document
Last updated: Never

## Player Profile Summary
- Sessions played: 0
- Total rounds tracked: 0
- Overall profit/loss: $0
- Primary style: Unknown (not enough data)

## Strengths
(No data yet — play some sessions to build your profile)

## Leaks
(No data yet)

## Improvement Roadmap
### Currently Working On
- Play your first session to start tracking
"""


def get_pid(db: Session, user_id: str = "default") -> str:
    record = db.query(PIDRecord).filter_by(user_id=user_id).first()
    if record is None:
        return DEFAULT_PID
    return record.pid_markdown


def save_pid(
    db: Session,
    user_id: str,
    pid_markdown: str,
    trigger: str = "manual_edit",
    session_id: int | None = None,
) -> PIDRecord:
    record = db.query(PIDRecord).filter_by(user_id=user_id).first()
    if record is None:
        record = PIDRecord(
            user_id=user_id,
            pid_markdown=pid_markdown,
            version=1,
        )
        db.add(record)
    else:
        history = PIDHistory(
            user_id=user_id,
            version=record.version,
            pid_markdown=record.pid_markdown,
            trigger=trigger,
            session_id=session_id,
        )
        db.add(history)

        record.pid_markdown = pid_markdown
        record.version += 1
        record.last_updated = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record


def list_pid_versions(db: Session, user_id: str = "default") -> list[PIDHistory]:
    return (
        db.query(PIDHistory)
        .filter(PIDHistory.user_id == user_id)
        .order_by(PIDHistory.version.desc())
        .all()
    )


def get_pid_version(db: Session, history_id: int) -> PIDHistory | None:
    return db.query(PIDHistory).filter(PIDHistory.id == history_id).first()
```

- [ ] **Step 5: Add history endpoints to pid router**

Replace `backend/app/routers/pid.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.pid_service import get_pid, save_pid, list_pid_versions, get_pid_version

router = APIRouter()


class PIDUpdateRequest(BaseModel):
    pid_markdown: str


@router.get("/api/pid")
def read_pid(db: Session = Depends(get_db)):
    markdown = get_pid(db, "default")
    return {"pid_markdown": markdown}


@router.put("/api/pid")
def update_pid(req: PIDUpdateRequest, db: Session = Depends(get_db)):
    record = save_pid(db, "default", req.pid_markdown, trigger="manual_edit")
    return {"pid_markdown": record.pid_markdown, "version": record.version}


@router.get("/api/pid/history")
def list_pid_history(db: Session = Depends(get_db)):
    versions = list_pid_versions(db, "default")
    return [
        {
            "id": v.id,
            "version": v.version,
            "trigger": v.trigger,
            "session_id": v.session_id,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in versions
    ]


@router.get("/api/pid/history/{history_id}")
def get_pid_history_version(history_id: int, db: Session = Depends(get_db)):
    version = get_pid_version(db, history_id)
    if version is None:
        raise HTTPException(status_code=404, detail="PID version not found")
    return {
        "id": version.id,
        "version": version.version,
        "pid_markdown": version.pid_markdown,
        "trigger": version.trigger,
        "session_id": version.session_id,
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }
```

- [ ] **Step 6: Update session_end_service to pass trigger/session_id to save_pid**

In `backend/app/services/session_end_service.py`, change the `save_pid` call in `finalize_session`:

```python
save_pid(db, user_id, updated_pid, trigger="session_end", session_id=session_id)
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_pid_history.py tests/test_pid_service.py tests/test_pid_router.py -v`
Expected: ALL PASSED

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/database.py backend/app/services/pid_service.py backend/app/routers/pid.py backend/app/services/session_end_service.py backend/tests/test_pid_history.py
git commit -m "feat: add PID version history with snapshots on every save"
```

---

### Task 6: Integrate Leak Generation into Session-End Flow

**Files:**
- Modify: `backend/app/services/session_end_service.py`
- Create: `backend/tests/test_session_end_leaks.py`

**Scene-setting:** The session-end flow lives in `backend/app/services/session_end_service.py`. The `finalize_session()` function currently: builds stats → generates AI summary → updates PID → returns result. We need to also call `generate_leaks_from_session()` from `leak_service.py` after the PID update. The function is async.

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_session_end_leaks.py`:

```python
import json
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord, RoundRecord, LeakRecord
from app.services.session_end_service import finalize_session


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _seed_session_with_rounds(db):
    session_rec = SessionRecord(user_id="default", is_active=1)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)

    round_rec = RoundRecord(
        session_id=session_rec.id,
        round_number=1,
        hole_cards=json.dumps(["Ah", "Kh"]),
        community_cards=json.dumps(["Qh", "Jh", "Th"]),
        result="won",
        profit=50.0,
        pot_size=100.0,
    )
    db.add(round_rec)
    db.commit()
    return session_rec.id


@pytest.mark.asyncio
async def test_finalize_session_generates_leaks(db):
    session_id = _seed_session_with_rounds(db)

    leak_json = json.dumps([
        {"description": "Test leak", "category": "preflop", "ev_impact": "high", "evidence": "Some evidence"}
    ])

    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.side_effect = [
            "Good session summary.",
            "Updated PID content here.",
            leak_json,
        ]
        with patch("app.services.leak_service.chat_with_ai", new_callable=AsyncMock, return_value=leak_json):
            result = await finalize_session(db, session_id)

    assert result["leaks_generated"] >= 0
    leaks = db.query(LeakRecord).filter(LeakRecord.session_id == session_id).all()
    assert len(leaks) >= 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_session_end_leaks.py -v`
Expected: FAIL — `leaks_generated` key not in result.

- [ ] **Step 3: Add leak generation to finalize_session**

In `backend/app/services/session_end_service.py`, add the import at the top:

```python
from app.services.leak_service import generate_leaks_from_session
```

Then modify `finalize_session()` to add leak generation after the PID update and before the return:

```python
async def finalize_session(db: Session, session_id: int, user_id: str = "default") -> dict:
    stats = build_session_stats(db, session_id)

    summary = await generate_session_summary(db, session_id)

    current_pid = get_pid(db, user_id)
    updated_pid = await generate_pid_update(db, session_id, current_pid)
    save_pid(db, user_id, updated_pid, trigger="session_end", session_id=session_id)

    leaks = await generate_leaks_from_session(db, session_id, user_id)

    session_rec = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if session_rec:
        session_rec.total_rounds = stats["total_rounds"]
        session_rec.total_profit = stats["total_profit"]
        session_rec.ai_summary = summary
        db.commit()

    return {
        "stats": stats,
        "summary": summary,
        "pid_updated": True,
        "leaks_generated": len(leaks),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_session_end_leaks.py -v`
Expected: PASSED

Also run existing session-end tests to check no regressions:
Run: `cd backend && python -m pytest tests/test_session_end_service.py -v`
Expected: PASSED (existing tests still pass — they mock chat_with_ai and won't be affected by the new leak call since it's a separate mock)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/session_end_service.py backend/tests/test_session_end_leaks.py
git commit -m "feat: generate AI-detected leaks on session end"
```

---

### Task 7: Frontend Navigation Store + Tab Component

**Files:**
- Create: `frontend/src/store/navigationStore.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/types.ts`

**Scene-setting:** The frontend is a single-page React 18 app with Zustand for state management. Currently everything renders in one view. We need a simple tab navigation system. The design system uses Dark+Gold: `bg-surface-deep` background, `text-gold` for active tab, `text-stone-400` for inactive, `border-gold` for active underline. See `design-system/the-gambler/MASTER.md` for all tokens. The chat sidebar (in `<aside>`) must stay visible on all tabs.

- [ ] **Step 1: Add navigation type to types.ts**

Add to `frontend/src/types.ts`:

```typescript
export type TabId = "calculator" | "players" | "myGame";
```

- [ ] **Step 2: Create navigation store**

Create `frontend/src/store/navigationStore.ts`:

```typescript
import { create } from "zustand";
import type { TabId } from "../types";

interface NavigationStore {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activeTab: "calculator",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
```

- [ ] **Step 3: Update App.tsx with tab navigation and page routing**

Replace `frontend/src/App.tsx`:

```tsx
import { CardSelector } from "./components/CardSelector";
import { GameInputs } from "./components/GameInputs";
import { QuickEntryBar } from "./components/QuickEntryBar";
import { ResultsPanel } from "./components/ResultsPanel";
import { CheatSheet } from "./components/CheatSheet";
import { RoundHistory } from "./components/RoundHistory";
import { ChatSidebar } from "./components/ChatSidebar";
import { UndoBanner } from "./components/UndoBanner";
import { SessionBar } from "./components/SessionBar";
import { PlayersPage } from "./pages/PlayersPage";
import { MyGamePage } from "./pages/MyGamePage";
import { useNavigationStore } from "./store/navigationStore";
import type { TabId } from "./types";

const TABS: { id: TabId; label: string }[] = [
  { id: "calculator", label: "Calculator" },
  { id: "players", label: "Players" },
  { id: "myGame", label: "My Game" },
];

function TabNav() {
  const { activeTab, setActiveTab } = useNavigationStore();
  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200 cursor-pointer ${
            activeTab === tab.id
              ? "text-gold border-b-2 border-gold"
              : "text-stone-400 hover:text-stone-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function MainContent() {
  const { activeTab } = useNavigationStore();
  switch (activeTab) {
    case "calculator":
      return (
        <div className="space-y-6">
          <QuickEntryBar />
          <CardSelector />
          <GameInputs />
          <ResultsPanel />
          <CheatSheet />
          <RoundHistory />
        </div>
      );
    case "players":
      return <PlayersPage />;
    case "myGame":
      return <MyGamePage />;
  }
}

export default function App() {
  return (
    <div className="min-h-screen bg-surface-deep text-stone-200">
      <header className="p-4 border-b border-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold tracking-wide text-gold">The Gambler</h1>
          <TabNav />
        </div>
        <SessionBar />
      </header>
      <div className="flex">
        <main className="flex-1 max-w-4xl mx-auto p-4">
          <MainContent />
        </main>
        <aside className="hidden md:block w-80 flex-shrink-0">
          <ChatSidebar />
        </aside>
      </div>
      <UndoBanner />
      <div className="md:hidden">
        <ChatSidebar />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create placeholder page components**

Create `frontend/src/pages/PlayersPage.tsx`:

```tsx
export function PlayersPage() {
  return (
    <div className="text-stone-400 text-center py-12">
      <p className="text-lg">Players page — coming next task</p>
    </div>
  );
}
```

Create `frontend/src/pages/MyGamePage.tsx`:

```tsx
export function MyGamePage() {
  return (
    <div className="text-stone-400 text-center py-12">
      <p className="text-lg">My Game page — coming next task</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/navigationStore.ts frontend/src/App.tsx frontend/src/types.ts frontend/src/pages/PlayersPage.tsx frontend/src/pages/MyGamePage.tsx
git commit -m "feat: add tab navigation with Calculator, Players, My Game pages"
```

---

### Task 8: Players Page Frontend

**Files:**
- Create: `frontend/src/hooks/useOpponents.ts`
- Modify: `frontend/src/pages/PlayersPage.tsx`
- Modify: `frontend/src/types.ts`

**Scene-setting:** The Players page needs to fetch opponents from `GET /api/opponents`, display them as cards, and allow create/edit/delete. API calls follow the pattern in `frontend/src/hooks/usePokerCalculator.ts` and `frontend/src/hooks/useSession.ts` — fetch functions with error handling. The design system: `bg-surface` for cards, `bg-gold text-stone-900` for primary buttons, `text-stone-200` for text, `border-surface-raised` for borders. Tendency tags render as chips: `bg-surface-raised text-stone-300 rounded px-2 py-0.5 text-xs`.

- [ ] **Step 1: Add OpponentData type to types.ts**

Add to `frontend/src/types.ts`:

```typescript
export interface OpponentData {
  id: number;
  name: string;
  user_id: string;
  tendency_tags: string[];
  vpip_estimate: number | null;
  pfr_estimate: number | null;
  notes: string;
  key_hands: string[];
  created_at: string | null;
  updated_at: string | null;
}
```

- [ ] **Step 2: Create useOpponents hook**

Create `frontend/src/hooks/useOpponents.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import type { OpponentData } from "../types";

const API_BASE = "/api/opponents";

export function useOpponents() {
  const [opponents, setOpponents] = useState<OpponentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOpponents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(API_BASE);
      if (!resp.ok) throw new Error("Failed to fetch opponents");
      const data = await resp.json();
      setOpponents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createOpponent = useCallback(async (data: Partial<OpponentData>) => {
    const resp = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to create opponent");
    const created = await resp.json();
    setOpponents((prev) => [...prev, created]);
    return created;
  }, []);

  const updateOpponent = useCallback(async (id: number, data: Partial<OpponentData>) => {
    const resp = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to update opponent");
    const updated = await resp.json();
    setOpponents((prev) => prev.map((o) => (o.id === id ? updated : o)));
    return updated;
  }, []);

  const deleteOpponent = useCallback(async (id: number) => {
    const resp = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!resp.ok) throw new Error("Failed to delete opponent");
    setOpponents((prev) => prev.filter((o) => o.id !== id));
  }, []);

  useEffect(() => {
    fetchOpponents();
  }, [fetchOpponents]);

  return { opponents, isLoading, error, createOpponent, updateOpponent, deleteOpponent, fetchOpponents };
}
```

- [ ] **Step 3: Implement PlayersPage**

Replace `frontend/src/pages/PlayersPage.tsx`:

```tsx
import { useState } from "react";
import { useOpponents } from "../hooks/useOpponents";
import type { OpponentData } from "../types";

const TENDENCY_OPTIONS = [
  "Tight", "Loose", "Aggressive", "Passive", "Calling Station",
  "Bluffer", "Nit", "LAG", "TAG", "Maniac", "Rock", "Fish", "Shark",
];

function OpponentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<OpponentData>;
  onSave: (data: Partial<OpponentData>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tendency_tags ?? []);
  const [vpip, setVpip] = useState(initial?.vpip_estimate?.toString() ?? "");
  const [pfr, setPfr] = useState(initial?.pfr_estimate?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      tendency_tags: tags,
      vpip_estimate: vpip ? parseInt(vpip) : null,
      pfr_estimate: pfr ? parseInt(pfr) : null,
      notes,
    });
  };

  return (
    <div className="bg-surface rounded-lg p-4 space-y-4 border border-surface-raised">
      <div>
        <label className="block text-xs text-stone-400 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
          placeholder="Player name or alias"
        />
      </div>
      <div>
        <label className="block text-xs text-stone-400 mb-1">Tendency Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {TENDENCY_OPTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors duration-200 ${
                tags.includes(tag)
                  ? "bg-gold text-stone-900 font-semibold"
                  : "bg-surface-raised text-stone-300 hover:bg-surface-hover"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs text-stone-400 mb-1">VPIP %</label>
          <input
            value={vpip}
            onChange={(e) => setVpip(e.target.value)}
            type="number"
            min="0"
            max="100"
            className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm font-mono text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
            placeholder="0-100"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-stone-400 mb-1">PFR %</label>
          <input
            value={pfr}
            onChange={(e) => setPfr(e.target.value)}
            type="number"
            min="0"
            max="100"
            className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm font-mono text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
            placeholder="0-100"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-stone-400 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200 resize-none"
          placeholder="Free-form notes about this player..."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-surface-raised text-stone-300 rounded hover:bg-surface-hover transition-colors duration-200 cursor-pointer text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer text-sm"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function OpponentCard({
  opponent,
  onEdit,
  onDelete,
}: {
  opponent: OpponentData;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-raised">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-stone-200 font-semibold">{opponent.name}</h3>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="text-xs text-stone-400 hover:text-stone-200 cursor-pointer transition-colors duration-200"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-300 cursor-pointer transition-colors duration-200"
          >
            Delete
          </button>
        </div>
      </div>
      {opponent.tendency_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {opponent.tendency_tags.map((tag) => (
            <span key={tag} className="bg-surface-raised text-stone-300 rounded px-2 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}
      {(opponent.vpip_estimate !== null || opponent.pfr_estimate !== null) && (
        <div className="flex gap-4 text-xs text-stone-400 mb-2">
          {opponent.vpip_estimate !== null && (
            <span>VPIP: <span className="font-mono text-stone-200">{opponent.vpip_estimate}%</span></span>
          )}
          {opponent.pfr_estimate !== null && (
            <span>PFR: <span className="font-mono text-stone-200">{opponent.pfr_estimate}%</span></span>
          )}
        </div>
      )}
      {opponent.notes && (
        <p className="text-xs text-stone-400 mt-1 line-clamp-2">{opponent.notes}</p>
      )}
    </div>
  );
}

export function PlayersPage() {
  const { opponents, isLoading, error, createOpponent, updateOpponent, deleteOpponent } = useOpponents();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleCreate = async (data: Partial<OpponentData>) => {
    await createOpponent(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: Partial<OpponentData>) => {
    if (editingId !== null) {
      await updateOpponent(editingId, data);
      setEditingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteOpponent(id);
  };

  if (isLoading) {
    return <p className="text-stone-400 text-center py-12">Loading opponents...</p>;
  }

  if (error) {
    return <p className="text-red-400 text-center py-12">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-stone-200">Opponent Profiles</h2>
        {!showForm && editingId === null && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-gold text-stone-900 font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer text-sm"
          >
            Add Player
          </button>
        )}
      </div>

      {showForm && (
        <OpponentForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {opponents.length === 0 && !showForm && (
        <p className="text-stone-500 text-center py-8">No opponents tracked yet. Add your first player above.</p>
      )}

      <div className="grid gap-3">
        {opponents.map((opp) =>
          editingId === opp.id ? (
            <OpponentForm
              key={opp.id}
              initial={opp}
              onSave={handleUpdate}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <OpponentCard
              key={opp.id}
              opponent={opp}
              onEdit={() => setEditingId(opp.id)}
              onDelete={() => handleDelete(opp.id)}
            />
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/hooks/useOpponents.ts frontend/src/pages/PlayersPage.tsx
git commit -m "feat: add Players page with opponent profiles CRUD UI"
```

---

### Task 9: My Game Page Frontend (PID Viewer + Leaks)

**Files:**
- Create: `frontend/src/hooks/usePID.ts`
- Create: `frontend/src/hooks/useLeaks.ts`
- Modify: `frontend/src/pages/MyGamePage.tsx`
- Modify: `frontend/src/types.ts`

**Scene-setting:** The My Game page has two sections: PID viewer/editor and leak list. PID endpoints: `GET /api/pid` returns `{pid_markdown}`, `PUT /api/pid` takes `{pid_markdown}`, `GET /api/pid/history` returns array of `{id, version, trigger, session_id, created_at}`, `GET /api/pid/history/{id}` returns full snapshot. Leak endpoints: `GET /api/leaks` returns array, `POST /api/leaks`, `PUT /api/leaks/{id}`, `DELETE /api/leaks/{id}`. Design system tokens same as before.

- [ ] **Step 1: Add LeakData and PIDVersion types to types.ts**

Add to `frontend/src/types.ts`:

```typescript
export interface LeakData {
  id: number;
  user_id: string;
  description: string;
  category: string;
  ev_impact: string;
  status: string;
  source: string;
  session_id: number | null;
  evidence: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PIDVersion {
  id: number;
  version: number;
  trigger: string;
  session_id: number | null;
  created_at: string | null;
}

export interface PIDVersionFull extends PIDVersion {
  pid_markdown: string;
}
```

- [ ] **Step 2: Create usePID hook**

Create `frontend/src/hooks/usePID.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import type { PIDVersion, PIDVersionFull } from "../types";

export function usePID() {
  const [pidMarkdown, setPidMarkdown] = useState("");
  const [versions, setVersions] = useState<PIDVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPID = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/pid");
      if (!resp.ok) throw new Error("Failed to fetch PID");
      const data = await resp.json();
      setPidMarkdown(data.pid_markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const savePID = useCallback(async (markdown: string) => {
    const resp = await fetch("/api/pid", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid_markdown: markdown }),
    });
    if (!resp.ok) throw new Error("Failed to save PID");
    const data = await resp.json();
    setPidMarkdown(data.pid_markdown);
    await fetchVersions();
    return data;
  }, []);

  const fetchVersions = useCallback(async () => {
    try {
      const resp = await fetch("/api/pid/history");
      if (!resp.ok) return;
      const data = await resp.json();
      setVersions(data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchVersion = useCallback(async (historyId: number): Promise<PIDVersionFull | null> => {
    try {
      const resp = await fetch(`/api/pid/history/${historyId}`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchPID();
    fetchVersions();
  }, [fetchPID, fetchVersions]);

  return { pidMarkdown, versions, isLoading, error, savePID, fetchVersion, fetchPID };
}
```

- [ ] **Step 3: Create useLeaks hook**

Create `frontend/src/hooks/useLeaks.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import type { LeakData } from "../types";

export function useLeaks() {
  const [leaks, setLeaks] = useState<LeakData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/leaks");
      if (!resp.ok) throw new Error("Failed to fetch leaks");
      const data = await resp.json();
      setLeaks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createLeak = useCallback(async (data: Partial<LeakData>) => {
    const resp = await fetch("/api/leaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to create leak");
    const created = await resp.json();
    setLeaks((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateLeak = useCallback(async (id: number, data: Partial<LeakData>) => {
    const resp = await fetch(`/api/leaks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error("Failed to update leak");
    const updated = await resp.json();
    setLeaks((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  }, []);

  const deleteLeak = useCallback(async (id: number) => {
    const resp = await fetch(`/api/leaks/${id}`, { method: "DELETE" });
    if (!resp.ok) throw new Error("Failed to delete leak");
    setLeaks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  useEffect(() => {
    fetchLeaks();
  }, [fetchLeaks]);

  return { leaks, isLoading, error, createLeak, updateLeak, deleteLeak, fetchLeaks };
}
```

- [ ] **Step 4: Implement MyGamePage**

Replace `frontend/src/pages/MyGamePage.tsx`:

```tsx
import { useState } from "react";
import { usePID } from "../hooks/usePID";
import { useLeaks } from "../hooks/useLeaks";
import type { PIDVersionFull, LeakData } from "../types";

const EV_IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-red-800 text-red-200",
  improving: "bg-amber-800 text-amber-200",
  resolved: "bg-emerald-800 text-emerald-200",
};

function PIDSection() {
  const { pidMarkdown, versions, isLoading, savePID, fetchVersion } = usePID();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [viewingVersion, setViewingVersion] = useState<PIDVersionFull | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const startEdit = () => {
    setDraft(pidMarkdown);
    setEditing(true);
    setViewingVersion(null);
  };

  const handleSave = async () => {
    await savePID(draft);
    setEditing(false);
  };

  const handleViewVersion = async (historyId: number) => {
    const version = await fetchVersion(historyId);
    if (version) {
      setViewingVersion(version);
      setEditing(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-raised">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-stone-200 font-semibold">Player Intelligence Document</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-stone-400 hover:text-stone-200 cursor-pointer transition-colors duration-200"
          >
            {showHistory ? "Hide History" : `History (${versions.length})`}
          </button>
          {!editing && !viewingVersion && (
            <button
              onClick={startEdit}
              className="px-2 py-1 bg-gold text-stone-900 text-xs font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {showHistory && versions.length > 0 && (
        <div className="mb-3 border border-surface-raised rounded p-2 space-y-1">
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => handleViewVersion(v.id)}
              className={`w-full text-left px-2 py-1 text-xs rounded cursor-pointer transition-colors duration-200 ${
                viewingVersion?.id === v.id
                  ? "bg-gold-700 text-stone-100"
                  : "text-stone-400 hover:bg-surface-hover hover:text-stone-200"
              }`}
            >
              v{v.version} — {v.trigger} — {v.created_at ? new Date(v.created_at).toLocaleDateString() : "unknown"}
            </button>
          ))}
        </div>
      )}

      {viewingVersion && (
        <div className="mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-stone-400">
              Viewing v{viewingVersion.version} ({viewingVersion.trigger})
            </span>
            <button
              onClick={() => setViewingVersion(null)}
              className="text-xs text-gold hover:text-gold-400 cursor-pointer transition-colors duration-200"
            >
              Back to current
            </button>
          </div>
          <pre className="bg-surface-deep rounded p-3 text-xs text-stone-300 whitespace-pre-wrap font-mono overflow-auto max-h-96">
            {viewingVersion.pid_markdown}
          </pre>
        </div>
      )}

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            className="w-full bg-surface-deep border border-surface-raised rounded px-3 py-2 text-xs font-mono text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200 resize-none"
          />
          <div className="flex gap-2 justify-end mt-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1 bg-surface-raised text-stone-300 text-xs rounded hover:bg-surface-hover cursor-pointer transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-gold text-stone-900 text-xs font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        !viewingVersion && (
          <pre className="bg-surface-deep rounded p-3 text-xs text-stone-300 whitespace-pre-wrap font-mono overflow-auto max-h-96">
            {isLoading ? "Loading..." : pidMarkdown}
          </pre>
        )
      )}
    </div>
  );
}

function LeaksSection() {
  const { leaks, isLoading, createLeak, updateLeak, deleteLeak } = useLeaks();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newImpact, setNewImpact] = useState("medium");

  const sortedLeaks = [...leaks].sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, improving: 1, resolved: 2 };
    const sDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (sDiff !== 0) return sDiff;
    return (EV_IMPACT_ORDER[a.ev_impact] ?? 3) - (EV_IMPACT_ORDER[b.ev_impact] ?? 3);
  });

  const handleAdd = async () => {
    if (!newDesc.trim()) return;
    await createLeak({ description: newDesc.trim(), category: newCategory, ev_impact: newImpact });
    setNewDesc("");
    setShowAddForm(false);
  };

  const cycleStatus = async (leak: LeakData) => {
    const next: Record<string, string> = { active: "improving", improving: "resolved", resolved: "active" };
    await updateLeak(leak.id, { status: next[leak.status] ?? "active" });
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-surface-raised">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-stone-200 font-semibold">My Leaks</h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-2 py-1 bg-gold text-stone-900 text-xs font-semibold rounded hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
          >
            Add Leak
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-3 bg-surface-deep rounded p-3 space-y-2 border border-surface-raised">
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full bg-surface border border-surface-raised rounded px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-gold transition-colors duration-200"
            placeholder="Describe the leak..."
          />
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-surface border border-surface-raised rounded px-2 py-1 text-xs text-stone-300 focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="general">General</option>
              <option value="preflop">Preflop</option>
              <option value="postflop">Postflop</option>
              <option value="tilt">Tilt</option>
              <option value="sizing">Sizing</option>
            </select>
            <select
              value={newImpact}
              onChange={(e) => setNewImpact(e.target.value)}
              className="bg-surface border border-surface-raised rounded px-2 py-1 text-xs text-stone-300 focus:outline-none focus:border-gold cursor-pointer"
            >
              <option value="high">High EV</option>
              <option value="medium">Medium EV</option>
              <option value="low">Low EV</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 bg-surface-raised text-stone-300 text-xs rounded hover:bg-surface-hover cursor-pointer transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1 bg-gold text-stone-900 text-xs font-semibold rounded hover:bg-gold-400 cursor-pointer transition-colors duration-200"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-stone-400 text-xs">Loading leaks...</p>}

      {sortedLeaks.length === 0 && !isLoading && (
        <p className="text-stone-500 text-xs text-center py-4">
          No leaks tracked yet. Play sessions to get AI-detected leaks, or add manually.
        </p>
      )}

      <div className="space-y-2">
        {sortedLeaks.map((leak) => (
          <div key={leak.id} className="flex items-start gap-3 bg-surface-deep rounded p-3">
            <button
              onClick={() => cycleStatus(leak)}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors duration-200 flex-shrink-0 ${STATUS_COLORS[leak.status] ?? "bg-surface-raised text-stone-300"}`}
              title="Click to change status"
            >
              {leak.status}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-200">{leak.description}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-stone-500">{leak.category}</span>
                <span className={`text-xs ${leak.ev_impact === "high" ? "text-red-400" : leak.ev_impact === "medium" ? "text-amber-400" : "text-stone-400"}`}>
                  {leak.ev_impact} EV
                </span>
                {leak.source === "ai" && <span className="text-xs text-gold">AI-detected</span>}
              </div>
              {leak.evidence && <p className="text-xs text-stone-500 mt-1">{leak.evidence}</p>}
            </div>
            <button
              onClick={() => deleteLeak(leak.id)}
              className="text-xs text-stone-500 hover:text-red-400 cursor-pointer transition-colors duration-200 flex-shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MyGamePage() {
  return (
    <div className="space-y-6">
      <PIDSection />
      <LeaksSection />
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/hooks/usePID.ts frontend/src/hooks/useLeaks.ts frontend/src/pages/MyGamePage.tsx
git commit -m "feat: add My Game page with PID viewer/editor and leak tracking UI"
```

---

### Task 10: Docker Compose Deployment

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `nginx/nginx.conf`
- Create: `docker-compose.yml`

**Scene-setting:** The backend runs on `uvicorn app.main:app --host 0.0.0.0 --port 8000`. The frontend builds with `npm run build` and outputs to `dist/`. Nginx serves the frontend static files and proxies `/api/` and `/ws/` to the backend. SQLite database file should be persisted via a Docker volume. The backend expects `GEMINI_API_KEY` and `DATABASE_URL` env vars. CORS can be set to allow the nginx frontend origin.

- [ ] **Step 1: Create backend Dockerfile**

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create frontend Dockerfile**

Create `frontend/Dockerfile`:

```dockerfile
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
```

- [ ] **Step 3: Create nginx config**

Create `nginx/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Create docker-compose.yml**

Create `docker-compose.yml` in the project root:

```yaml
services:
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=sqlite:///./data/poker.db
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - CORS_ORIGINS=http://localhost
    volumes:
      - poker-data:/app/data

  frontend:
    build: ./frontend
    depends_on:
      - backend
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"

volumes:
  poker-data:
```

- [ ] **Step 5: Verify Dockerfiles are valid (syntax check)**

Run: `cd "/Users/joelong/Documents/SWE-Projects/The Gambler" && cat docker-compose.yml && echo "---" && cat backend/Dockerfile && echo "---" && cat frontend/Dockerfile && echo "---" && cat nginx/nginx.conf`
Expected: all files display correctly with no syntax issues

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile nginx/nginx.conf
git commit -m "feat: add Docker Compose deployment with nginx reverse proxy"
```

---

### Task 11: Run Full Test Suite + Final Verification

**Files:** None (verification only)

**Scene-setting:** All backend tests should pass. Frontend should build cleanly. This task verifies no regressions from the new models and service changes.

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && python -m pytest -v`
Expected: ALL tests pass (previous 92 + new ~30 = ~120+ tests)

- [ ] **Step 2: Build frontend**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: No TypeScript errors, successful build

- [ ] **Step 3: Fix any failures**

If any tests fail or the build breaks, fix the issues.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve test/build issues from Phase 4 integration"
```

---

## Dependency Graph

```
Task 1 (PlayerProfile model + service) → Task 2 (Opponent router)
Task 1 → Task 3 (LeakRecord model + service) → Task 4 (Leak router)
Task 5 (PID history) — independent
Task 3 → Task 6 (Integrate leaks into session-end)
Task 7 (Navigation) → Task 8 (Players page) — needs Task 2 backend
Task 7 → Task 9 (My Game page) — needs Tasks 4, 5 backend
Task 10 (Docker) — independent
Task 11 (Full test suite) — after all others
```

**Parallelizable groups:**
- Tasks 1+5+10 can run in parallel (independent DB models/services)
- Tasks 2+3 can run in parallel after Task 1 (but both touch database.py — Task 3 adds LeakRecord. If Task 1 already committed, Task 3 is safe)
- Tasks 4+6 after Task 3
- Task 7 after Tasks 2+4+5 (needs backend ready)
- Tasks 8+9 after Task 7
- Task 11 last
