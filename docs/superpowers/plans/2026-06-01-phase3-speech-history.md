# Phase 3 — Speech & History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add speech-to-text input, round/session management with round condensation, session-end PID rewrite, and session summary — making the app track full poker sessions.

**Architecture:** New SQLAlchemy models for Session and Round tables. Session CRUD + Round CRUD with AI-powered condensation (rule-based fallback). Browser Web Speech API for voice input via mic button in chat. Session rounds wired into existing AI chat context. PID auto-rewrite on session end.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, SQLite, google-genai, React 18, TypeScript, Zustand, Web Speech API

**Existing codebase (Phase 1+2 complete):**
- Backend: `backend/app/` with `main.py`, `config.py`, `models/database.py` (PIDRecord table), `routers/` (calculate, chat, pid), `services/` (poker_engine, ai_service, pid_service, prompt_builder, recommendation, quick_entry_parser)
- Frontend: `frontend/src/` with `App.tsx`, `store/` (gameStore, chatStore), `hooks/` (usePokerCalculator, useChat), `components/` (CardSelector, GameInputs, QuickEntryBar, ResultsPanel, MetricTooltip, HelpTooltip, CheatSheet, ChatSidebar, ChatMessage, ChatInput, UndoBanner), `types.ts`, `utils/` (cardUtils, tooltipData)
- 56 backend tests passing across 7 test files
- Design system: Dark + Gold theme (stone/gold Tailwind tokens)

**Task dependency graph:**
```
Task 1 (DB models) ──┬──> Task 2 (Session CRUD) ──┬──> Task 5 (Session end + PID rewrite)
                     │                             │
                     ├──> Task 3 (Round CRUD)  ────┤──> Task 9 (Round history UI)
                     │                             │
                     │                             ├──> Task 10 (Wire rounds into chat)
                     │                             │
                     └──> Task 4 (Condensation) ───┘
                     
Task 6 (Speech hook) ──> Task 7 (Mic in ChatInput)

Task 8 (Session store + UI) depends on Task 2

Task 11 (Integration) depends on all
```

**Parallelizable groups:**
1. Task 1 alone
2. Tasks 2 + 3 + 6 in parallel
3. Tasks 4 + 7 + 8 in parallel
4. Tasks 5 + 9 in parallel
5. Task 10 alone
6. Task 11 alone

---

### Task 1: Database Models — Session + Round Tables

**Files:**
- Modify: `backend/app/models/database.py`
- Create: `backend/tests/test_database_models.py`

- [ ] **Step 1: Write failing tests for new tables**

```python
# backend/tests/test_database_models.py
import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine, StaticPool, inspect
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord, RoundRecord, RoundCondensed


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_session_table_exists(db):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    assert "sessions" in tables


def test_round_table_exists(db):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    assert "rounds" in tables


def test_round_condensed_table_exists(db):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    assert "rounds_condensed" in tables


def test_create_session(db):
    session_rec = SessionRecord(user_id="default")
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)
    assert session_rec.id is not None
    assert session_rec.is_active is True
    assert session_rec.started_at is not None


def test_create_round(db):
    session_rec = SessionRecord(user_id="default")
    db.add(session_rec)
    db.commit()

    round_rec = RoundRecord(
        session_id=session_rec.id,
        round_number=1,
        hole_cards='["Ah", "Kd"]',
        community_cards='["7h", "2d", "9c"]',
        num_players=6,
        position="CO",
        streets='[]',
        result="won",
        profit=120.0,
        pot_size=200.0,
    )
    db.add(round_rec)
    db.commit()
    db.refresh(round_rec)
    assert round_rec.id is not None
    assert round_rec.session_id == session_rec.id


def test_create_condensed_round(db):
    session_rec = SessionRecord(user_id="default")
    db.add(session_rec)
    db.commit()

    condensed = RoundCondensed(
        session_id=session_rec.id,
        round_number=1,
        hole_cards='["Ah", "Kd"]',
        result="won",
        profit=120.0,
        key_decision="Called river with top pair, opponent had a bluff",
        lesson="Good call — pot odds justified it",
    )
    db.add(condensed)
    db.commit()
    db.refresh(condensed)
    assert condensed.id is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_database_models.py -v`
Expected: FAIL — `ImportError: cannot import name 'SessionRecord'`

- [ ] **Step 3: Add SessionRecord, RoundRecord, RoundCondensed models**

Add these classes to `backend/app/models/database.py` after the existing `PIDRecord` class:

```python
class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, default="default")
    is_active = Column(Integer, nullable=False, default=1)
    started_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    ended_at = Column(DateTime, nullable=True)
    total_rounds = Column(Integer, nullable=False, default=0)
    total_profit = Column(Float, nullable=False, default=0.0)
    ai_summary = Column(Text, nullable=True)


class RoundRecord(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, nullable=False)
    round_number = Column(Integer, nullable=False)
    hole_cards = Column(Text, nullable=False)
    community_cards = Column(Text, nullable=False, default="[]")
    num_players = Column(Integer, nullable=False, default=6)
    position = Column(String, nullable=True)
    streets = Column(Text, nullable=False, default="[]")
    result = Column(String, nullable=True)
    profit = Column(Float, nullable=False, default=0.0)
    pot_size = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class RoundCondensed(Base):
    __tablename__ = "rounds_condensed"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, nullable=False)
    round_number = Column(Integer, nullable=False)
    hole_cards = Column(Text, nullable=False)
    result = Column(String, nullable=True)
    profit = Column(Float, nullable=False, default=0.0)
    key_decision = Column(Text, nullable=True)
    lesson = Column(Text, nullable=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
```

Also add the `Float` import: change the `Column` import line to include `Float`:
```python
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_database_models.py -v`
Expected: 6 PASSED

- [ ] **Step 5: Run ALL existing tests to verify no regressions**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All 56 existing tests + 6 new = 62 PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/database.py backend/tests/test_database_models.py
git commit -m "feat: add Session, Round, and RoundCondensed database models for Phase 3"
```

---

### Task 2: Session CRUD Service + Router

**Files:**
- Create: `backend/app/services/session_service.py`
- Create: `backend/app/routers/sessions.py`
- Create: `backend/tests/test_session_service.py`
- Create: `backend/tests/test_session_router.py`
- Modify: `backend/app/main.py` (register router)

**Depends on:** Task 1

- [ ] **Step 1: Write failing tests for session service**

```python
# backend/tests/test_session_service.py
import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord
from app.services.session_service import (
    start_session,
    end_session,
    get_active_session,
    get_session,
    list_sessions,
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_start_session(db):
    session_rec = start_session(db, user_id="default")
    assert session_rec.id is not None
    assert session_rec.is_active == 1
    assert session_rec.user_id == "default"


def test_start_session_ends_previous(db):
    s1 = start_session(db, user_id="default")
    s2 = start_session(db, user_id="default")
    db.refresh(s1)
    assert s1.is_active == 0
    assert s1.ended_at is not None
    assert s2.is_active == 1


def test_get_active_session(db):
    start_session(db, user_id="default")
    active = get_active_session(db, user_id="default")
    assert active is not None
    assert active.is_active == 1


def test_get_active_session_none(db):
    active = get_active_session(db, user_id="default")
    assert active is None


def test_end_session(db):
    s = start_session(db, user_id="default")
    ended = end_session(db, s.id)
    assert ended.is_active == 0
    assert ended.ended_at is not None


def test_get_session(db):
    s = start_session(db, user_id="default")
    fetched = get_session(db, s.id)
    assert fetched is not None
    assert fetched.id == s.id


def test_list_sessions(db):
    start_session(db, user_id="default")
    start_session(db, user_id="default")
    sessions = list_sessions(db, user_id="default")
    assert len(sessions) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_session_service.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement session_service.py**

```python
# backend/app/services/session_service.py
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import SessionRecord


def start_session(db: Session, user_id: str = "default") -> SessionRecord:
    """Start a new session, ending any active one first."""
    active = get_active_session(db, user_id)
    if active:
        end_session(db, active.id)

    session_rec = SessionRecord(user_id=user_id)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)
    return session_rec


def end_session(db: Session, session_id: int) -> SessionRecord:
    """Mark a session as ended."""
    session_rec = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if session_rec:
        session_rec.is_active = 0
        session_rec.ended_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session_rec)
    return session_rec


def get_active_session(db: Session, user_id: str = "default") -> SessionRecord | None:
    """Get the currently active session for a user."""
    return (
        db.query(SessionRecord)
        .filter(SessionRecord.user_id == user_id, SessionRecord.is_active == 1)
        .first()
    )


def get_session(db: Session, session_id: int) -> SessionRecord | None:
    """Get a session by ID."""
    return db.query(SessionRecord).filter(SessionRecord.id == session_id).first()


def list_sessions(db: Session, user_id: str = "default") -> list[SessionRecord]:
    """List all sessions for a user, newest first."""
    return (
        db.query(SessionRecord)
        .filter(SessionRecord.user_id == user_id)
        .order_by(SessionRecord.started_at.desc())
        .all()
    )
```

- [ ] **Step 4: Run service tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_session_service.py -v`
Expected: 7 PASSED

- [ ] **Step 5: Write failing tests for session router**

```python
# backend/tests/test_session_router.py
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
```

- [ ] **Step 6: Implement session router**

```python
# backend/app/routers/sessions.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.session_service import (
    start_session,
    end_session,
    get_active_session,
    get_session,
    list_sessions,
)

router = APIRouter()


def _session_to_dict(s):
    return {
        "id": s.id,
        "user_id": s.user_id,
        "is_active": bool(s.is_active),
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        "total_rounds": s.total_rounds,
        "total_profit": s.total_profit,
        "ai_summary": s.ai_summary,
    }


@router.post("/api/sessions")
def create_session(db: Session = Depends(get_db)):
    session_rec = start_session(db)
    return _session_to_dict(session_rec)


@router.get("/api/sessions")
def get_sessions(db: Session = Depends(get_db)):
    sessions = list_sessions(db)
    return [_session_to_dict(s) for s in sessions]


@router.get("/api/sessions/active")
def get_active(db: Session = Depends(get_db)):
    session_rec = get_active_session(db)
    if not session_rec:
        raise HTTPException(status_code=404, detail="No active session")
    return _session_to_dict(session_rec)


@router.get("/api/sessions/{session_id}")
def get_session_by_id(session_id: int, db: Session = Depends(get_db)):
    session_rec = get_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_to_dict(session_rec)


@router.post("/api/sessions/{session_id}/end")
def end_session_endpoint(session_id: int, db: Session = Depends(get_db)):
    session_rec = end_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_to_dict(session_rec)
```

- [ ] **Step 7: Register session router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.sessions import router as sessions_router
# ... after existing router includes:
app.include_router(sessions_router)
```

- [ ] **Step 8: Run all tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All previous + 5 new session router + 7 service = passing

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/session_service.py backend/app/routers/sessions.py backend/tests/test_session_service.py backend/tests/test_session_router.py backend/app/main.py
git commit -m "feat: add session CRUD service and REST endpoints"
```

---

### Task 3: Round CRUD Service + Router

**Files:**
- Create: `backend/app/services/round_service.py`
- Create: `backend/app/routers/rounds.py`
- Create: `backend/tests/test_round_service.py`
- Create: `backend/tests/test_round_router.py`
- Modify: `backend/app/main.py` (register router)

**Depends on:** Task 1

- [ ] **Step 1: Write failing tests for round service**

```python
# backend/tests/test_round_service.py
import json
import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord
from app.services.round_service import (
    save_round,
    get_round,
    list_rounds,
    delete_round,
    get_round_count,
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def session_id(db):
    s = SessionRecord(user_id="default")
    db.add(s)
    db.commit()
    return s.id


def test_save_round(db, session_id):
    r = save_round(
        db,
        session_id=session_id,
        hole_cards=["Ah", "Kd"],
        community_cards=["7h", "2d", "9c"],
        num_players=6,
        position="CO",
        pot_size=200.0,
        result="won",
        profit=120.0,
    )
    assert r.id is not None
    assert r.round_number == 1


def test_save_round_increments_number(db, session_id):
    save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    r2 = save_round(db, session_id=session_id, hole_cards=["Qs", "Jh"])
    assert r2.round_number == 2


def test_get_round(db, session_id):
    r = save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    fetched = get_round(db, r.id)
    assert fetched is not None
    assert json.loads(fetched.hole_cards) == ["Ah", "Kd"]


def test_list_rounds(db, session_id):
    save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    save_round(db, session_id=session_id, hole_cards=["Qs", "Jh"])
    rounds = list_rounds(db, session_id=session_id)
    assert len(rounds) == 2


def test_delete_round(db, session_id):
    r = save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    deleted = delete_round(db, r.id)
    assert deleted is True
    assert get_round(db, r.id) is None


def test_get_round_count(db, session_id):
    save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    save_round(db, session_id=session_id, hole_cards=["Qs", "Jh"])
    assert get_round_count(db, session_id) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_round_service.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement round_service.py**

```python
# backend/app/services/round_service.py
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.database import RoundRecord


def save_round(
    db: Session,
    session_id: int,
    hole_cards: list[str],
    community_cards: list[str] | None = None,
    num_players: int = 6,
    position: str | None = None,
    streets: list | None = None,
    pot_size: float = 0.0,
    result: str | None = None,
    profit: float = 0.0,
    notes: str | None = None,
) -> RoundRecord:
    """Save a new round to the database."""
    round_number = get_round_count(db, session_id) + 1

    round_rec = RoundRecord(
        session_id=session_id,
        round_number=round_number,
        hole_cards=json.dumps(hole_cards),
        community_cards=json.dumps(community_cards or []),
        num_players=num_players,
        position=position,
        streets=json.dumps(streets or []),
        pot_size=pot_size,
        result=result,
        profit=profit,
        notes=notes,
    )
    db.add(round_rec)
    db.commit()
    db.refresh(round_rec)
    return round_rec


def get_round(db: Session, round_id: int) -> RoundRecord | None:
    """Get a round by ID."""
    return db.query(RoundRecord).filter(RoundRecord.id == round_id).first()


def list_rounds(db: Session, session_id: int) -> list[RoundRecord]:
    """List all rounds for a session, ordered by round number."""
    return (
        db.query(RoundRecord)
        .filter(RoundRecord.session_id == session_id)
        .order_by(RoundRecord.round_number)
        .all()
    )


def delete_round(db: Session, round_id: int) -> bool:
    """Delete a round. Returns True if deleted, False if not found."""
    round_rec = get_round(db, round_id)
    if not round_rec:
        return False
    db.delete(round_rec)
    db.commit()
    return True


def get_round_count(db: Session, session_id: int) -> int:
    """Get the number of rounds in a session."""
    return (
        db.query(RoundRecord)
        .filter(RoundRecord.session_id == session_id)
        .count()
    )
```

- [ ] **Step 4: Run service tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_round_service.py -v`
Expected: 6 PASSED

- [ ] **Step 5: Write failing tests for round router**

```python
# backend/tests/test_round_router.py
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
```

- [ ] **Step 6: Implement round router**

```python
# backend/app/routers/rounds.py
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.round_service import (
    save_round,
    get_round,
    list_rounds,
    delete_round,
)

router = APIRouter()


class SaveRoundRequest(BaseModel):
    session_id: int
    hole_cards: list[str]
    community_cards: list[str] = []
    num_players: int = 6
    position: Optional[str] = None
    pot_size: float = 0
    result: Optional[str] = None
    profit: float = 0
    notes: Optional[str] = None


def _round_to_dict(r):
    return {
        "id": r.id,
        "session_id": r.session_id,
        "round_number": r.round_number,
        "hole_cards": json.loads(r.hole_cards),
        "community_cards": json.loads(r.community_cards),
        "num_players": r.num_players,
        "position": r.position,
        "streets": json.loads(r.streets),
        "result": r.result,
        "profit": r.profit,
        "pot_size": r.pot_size,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/api/rounds")
def create_round(req: SaveRoundRequest, db: Session = Depends(get_db)):
    round_rec = save_round(
        db,
        session_id=req.session_id,
        hole_cards=req.hole_cards,
        community_cards=req.community_cards,
        num_players=req.num_players,
        position=req.position,
        pot_size=req.pot_size,
        result=req.result,
        profit=req.profit,
        notes=req.notes,
    )
    return _round_to_dict(round_rec)


@router.get("/api/rounds")
def get_rounds(session_id: int, db: Session = Depends(get_db)):
    rounds = list_rounds(db, session_id=session_id)
    return [_round_to_dict(r) for r in rounds]


@router.get("/api/rounds/{round_id}")
def get_round_by_id(round_id: int, db: Session = Depends(get_db)):
    round_rec = get_round(db, round_id)
    if not round_rec:
        raise HTTPException(status_code=404, detail="Round not found")
    return _round_to_dict(round_rec)


@router.delete("/api/rounds/{round_id}")
def delete_round_endpoint(round_id: int, db: Session = Depends(get_db)):
    deleted = delete_round(db, round_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Round not found")
    return {"deleted": True}
```

- [ ] **Step 7: Register round router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.rounds import router as rounds_router
# ... after existing router includes:
app.include_router(rounds_router)
```

- [ ] **Step 8: Run all tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All passing

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/round_service.py backend/app/routers/rounds.py backend/tests/test_round_service.py backend/tests/test_round_router.py backend/app/main.py
git commit -m "feat: add round CRUD service and REST endpoints"
```

---

### Task 4: Round Condensation Service

**Files:**
- Create: `backend/app/services/condensation_service.py`
- Create: `backend/tests/test_condensation_service.py`

**Depends on:** Task 1, Task 3

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_condensation_service.py
import json
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord, RoundRecord, RoundCondensed
from app.services.round_service import save_round
from app.services.condensation_service import (
    condense_round_rule_based,
    condense_round_ai,
    maybe_condense_oldest,
    MAX_FULL_ROUNDS,
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def session_id(db):
    s = SessionRecord(user_id="default")
    db.add(s)
    db.commit()
    return s.id


def test_max_full_rounds_is_5():
    assert MAX_FULL_ROUNDS == 5


def test_rule_based_condensation():
    round_data = {
        "hole_cards": ["Ah", "Kd"],
        "community_cards": ["7h", "2d", "9c", "Qs", "3h"],
        "result": "won",
        "profit": 120.0,
        "pot_size": 200.0,
        "position": "CO",
    }
    result = condense_round_rule_based(round_data)
    assert "key_decision" in result
    assert "lesson" in result
    assert result["hole_cards"] == ["Ah", "Kd"]
    assert result["result"] == "won"
    assert result["profit"] == 120.0


def test_rule_based_condensation_loss():
    round_data = {
        "hole_cards": ["7s", "2c"],
        "community_cards": ["Ah", "Kd", "Qs"],
        "result": "lost",
        "profit": -80.0,
        "pot_size": 160.0,
        "position": "UTG",
    }
    result = condense_round_rule_based(round_data)
    assert result["profit"] == -80.0


def test_maybe_condense_under_limit(db, session_id):
    for i in range(4):
        save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"])
    condensed_count = maybe_condense_oldest(db, session_id)
    assert condensed_count == 0


def test_maybe_condense_at_limit(db, session_id):
    for i in range(6):
        save_round(db, session_id=session_id, hole_cards=["Ah", "Kd"], result="won", profit=10.0, community_cards=["7h", "2d", "9c"])
    condensed_count = maybe_condense_oldest(db, session_id)
    assert condensed_count == 1
    full_rounds = db.query(RoundRecord).filter(RoundRecord.session_id == session_id).count()
    assert full_rounds == 5
    condensed_rounds = db.query(RoundCondensed).filter(RoundCondensed.session_id == session_id).count()
    assert condensed_rounds == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_condensation_service.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement condensation_service.py**

```python
# backend/app/services/condensation_service.py
from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.models.database import RoundRecord, RoundCondensed

logger = logging.getLogger(__name__)

MAX_FULL_ROUNDS = 5


def condense_round_rule_based(round_data: dict) -> dict:
    """Generate a condensed version of a round using rules (no AI)."""
    hole_cards = round_data.get("hole_cards", [])
    result = round_data.get("result", "unknown")
    profit = round_data.get("profit", 0.0)
    pot_size = round_data.get("pot_size", 0.0)
    position = round_data.get("position", "unknown")
    community_cards = round_data.get("community_cards", [])

    hand_str = " ".join(hole_cards) if hole_cards else "unknown hand"
    board_str = " ".join(community_cards) if community_cards else "no board"

    if result == "won":
        key_decision = f"Won ${profit:.0f} pot with {hand_str} from {position}"
        lesson = f"Profitable play on {board_str}"
    elif result == "lost":
        key_decision = f"Lost ${abs(profit):.0f} with {hand_str} from {position}"
        lesson = f"Review sizing decisions on {board_str}"
    elif result == "folded":
        key_decision = f"Folded {hand_str} from {position}, pot was ${pot_size:.0f}"
        lesson = "Fold decision — check if pot odds warranted a call"
    else:
        key_decision = f"Played {hand_str} from {position}"
        lesson = "Round completed"

    return {
        "hole_cards": hole_cards,
        "result": result,
        "profit": profit,
        "key_decision": key_decision,
        "lesson": lesson,
    }


async def condense_round_ai(round_data: dict) -> dict:
    """Generate a condensed version using AI, falling back to rule-based."""
    try:
        from app.services.ai_service import chat_with_ai

        prompt = (
            "Condense this poker round into a one-line key_decision and a one-line lesson. "
            "Be specific with numbers. Return ONLY a JSON object: "
            '{"key_decision": "...", "lesson": "..."}\n\n'
            f"Round data: {json.dumps(round_data)}"
        )
        raw = await chat_with_ai(
            "You are a poker analysis assistant. Return only valid JSON.",
            prompt,
        )
        parsed = json.loads(raw.strip().strip("`").strip())
        return {
            "hole_cards": round_data.get("hole_cards", []),
            "result": round_data.get("result"),
            "profit": round_data.get("profit", 0.0),
            "key_decision": parsed.get("key_decision", ""),
            "lesson": parsed.get("lesson", ""),
        }
    except Exception as e:
        logger.warning(f"AI condensation failed, using rule-based: {e}")
        return condense_round_rule_based(round_data)


def maybe_condense_oldest(db: Session, session_id: int) -> int:
    """If there are more than MAX_FULL_ROUNDS, condense the oldest ones."""
    full_rounds = (
        db.query(RoundRecord)
        .filter(RoundRecord.session_id == session_id)
        .order_by(RoundRecord.round_number)
        .all()
    )

    condensed_count = 0
    while len(full_rounds) > MAX_FULL_ROUNDS:
        oldest = full_rounds.pop(0)
        round_data = {
            "hole_cards": json.loads(oldest.hole_cards),
            "community_cards": json.loads(oldest.community_cards),
            "result": oldest.result,
            "profit": oldest.profit,
            "pot_size": oldest.pot_size,
            "position": oldest.position,
        }

        condensed = condense_round_rule_based(round_data)

        condensed_rec = RoundCondensed(
            session_id=session_id,
            round_number=oldest.round_number,
            hole_cards=oldest.hole_cards,
            result=condensed["result"],
            profit=condensed["profit"],
            key_decision=condensed["key_decision"],
            lesson=condensed["lesson"],
        )
        db.add(condensed_rec)
        db.delete(oldest)
        condensed_count += 1

    if condensed_count > 0:
        db.commit()

    return condensed_count
```

Note: `maybe_condense_oldest` uses rule-based by default (synchronous). The async AI version `condense_round_ai` is available for explicit calls from the session-end flow.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_condensation_service.py -v`
Expected: 5 PASSED

- [ ] **Step 5: Run all tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/condensation_service.py backend/tests/test_condensation_service.py
git commit -m "feat: add round condensation service with AI + rule-based fallback"
```

---

### Task 5: Session End — PID Rewrite + Session Summary

**Files:**
- Create: `backend/app/services/session_end_service.py`
- Create: `backend/tests/test_session_end_service.py`
- Modify: `backend/app/routers/sessions.py` (add summary endpoint)

**Depends on:** Tasks 2, 3, 4

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_session_end_service.py
import json
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord
from app.services.round_service import save_round
from app.services.session_end_service import (
    build_session_stats,
    generate_session_summary,
    generate_pid_update,
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def session_with_rounds(db):
    s = SessionRecord(user_id="default")
    db.add(s)
    db.commit()
    save_round(db, s.id, hole_cards=["Ah", "Kd"], result="won", profit=120.0, pot_size=200.0)
    save_round(db, s.id, hole_cards=["Qs", "Jh"], result="lost", profit=-50.0, pot_size=100.0)
    save_round(db, s.id, hole_cards=["9s", "9c"], result="won", profit=80.0, pot_size=160.0)
    return s.id


def test_build_session_stats(db, session_with_rounds):
    stats = build_session_stats(db, session_with_rounds)
    assert stats["total_rounds"] == 3
    assert stats["total_profit"] == 150.0
    assert stats["rounds_won"] == 2
    assert stats["rounds_lost"] == 1


@pytest.mark.asyncio
async def test_generate_session_summary(db, session_with_rounds):
    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = "Solid session. Won 2/3 hands for +$150. Strong hand selection."
        summary = await generate_session_summary(db, session_with_rounds)
        assert "150" in summary or "Solid" in summary
        mock_ai.assert_called_once()


@pytest.mark.asyncio
async def test_generate_pid_update(db, session_with_rounds):
    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = "# Player Intelligence Document\nUpdated after session."
        pid = await generate_pid_update(db, session_with_rounds, current_pid="# Old PID")
        assert "Player Intelligence Document" in pid
        mock_ai.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pip install pytest-asyncio && python -m pytest tests/test_session_end_service.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Add pytest-asyncio to requirements.txt**

Add `pytest-asyncio` to `backend/requirements.txt`.

- [ ] **Step 4: Implement session_end_service.py**

```python
# backend/app/services/session_end_service.py
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.database import SessionRecord
from app.services.ai_service import chat_with_ai
from app.services.round_service import list_rounds
from app.services.pid_service import get_pid, save_pid


def build_session_stats(db: Session, session_id: int) -> dict:
    """Build aggregate stats for a session from its rounds."""
    rounds = list_rounds(db, session_id)

    total_profit = sum(r.profit for r in rounds)
    rounds_won = sum(1 for r in rounds if r.result == "won")
    rounds_lost = sum(1 for r in rounds if r.result == "lost")
    rounds_folded = sum(1 for r in rounds if r.result == "folded")

    return {
        "total_rounds": len(rounds),
        "total_profit": total_profit,
        "rounds_won": rounds_won,
        "rounds_lost": rounds_lost,
        "rounds_folded": rounds_folded,
    }


def _rounds_to_summary_data(db: Session, session_id: int) -> str:
    """Format round data for AI consumption."""
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


async def generate_session_summary(db: Session, session_id: int) -> str:
    """Generate an AI-written session summary."""
    stats = build_session_stats(db, session_id)
    rounds_data = _rounds_to_summary_data(db, session_id)

    prompt = (
        f"Summarize this poker session in 2-3 sentences. Be specific with numbers.\n\n"
        f"Stats: {json.dumps(stats)}\n\n"
        f"Rounds:\n{rounds_data}"
    )

    return await chat_with_ai(
        "You are a poker session analyst. Write a concise, specific summary.",
        prompt,
    )


async def generate_pid_update(
    db: Session, session_id: int, current_pid: str
) -> str:
    """Generate an updated PID incorporating the new session data."""
    stats = build_session_stats(db, session_id)
    rounds_data = _rounds_to_summary_data(db, session_id)

    prompt = (
        "You are updating a poker player's intelligence document.\n\n"
        f"CURRENT DOCUMENT:\n{current_pid}\n\n"
        f"NEW SESSION DATA ({stats['total_rounds']} rounds):\n{rounds_data}\n\n"
        "INSTRUCTIONS:\n"
        "1. Update all statistics (sessions played, profit, win rate, etc.)\n"
        "2. Re-evaluate leaks — are any improving? New ones emerging?\n"
        "3. Update tendencies if the data shows change\n"
        "4. Add a session note (2-3 sentences max)\n"
        "5. Update the improvement roadmap\n"
        "6. Be specific with numbers.\n\n"
        "Return the complete updated document."
    )

    return await chat_with_ai(
        "You are a poker intelligence analyst. Return a complete, updated PID markdown document.",
        prompt,
    )


async def finalize_session(db: Session, session_id: int, user_id: str = "default") -> dict:
    """Full session-end flow: stats, summary, PID update."""
    stats = build_session_stats(db, session_id)

    summary = await generate_session_summary(db, session_id)

    current_pid = get_pid(db, user_id)
    updated_pid = await generate_pid_update(db, session_id, current_pid)
    save_pid(db, user_id, updated_pid)

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
    }
```

- [ ] **Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_session_end_service.py -v`
Expected: 3 PASSED

- [ ] **Step 6: Add summary + finalize endpoints to sessions router**

Add to `backend/app/routers/sessions.py`:

```python
from app.services.session_end_service import finalize_session, generate_session_summary

@router.post("/api/sessions/{session_id}/finalize")
async def finalize_session_endpoint(session_id: int, db: Session = Depends(get_db)):
    session_rec = get_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await finalize_session(db, session_id)
    end_session(db, session_id)
    return result


@router.get("/api/sessions/{session_id}/summary")
async def get_session_summary(session_id: int, db: Session = Depends(get_db)):
    session_rec = get_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_rec.ai_summary:
        return {"summary": session_rec.ai_summary}
    summary = await generate_session_summary(db, session_id)
    return {"summary": summary}
```

- [ ] **Step 7: Run all tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All passing

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/session_end_service.py backend/tests/test_session_end_service.py backend/app/routers/sessions.py backend/requirements.txt
git commit -m "feat: add session-end flow with PID rewrite and AI summary"
```

---

### Task 6: Speech-to-Text Hook (Frontend)

**Files:**
- Create: `frontend/src/hooks/useSpeechToText.ts`

**Depends on:** Nothing (browser API only)

- [ ] **Step 1: Create the speech-to-text hook**

```typescript
// frontend/src/hooks/useSpeechToText.ts
import { useState, useRef, useCallback } from "react";

interface SpeechToTextState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
}

interface UseSpeechToTextReturn extends SpeechToTextState {
  startListening: () => void;
  stopListening: () => void;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

export function useSpeechToText(
  onResult: (transcript: string) => void
): UseSpeechToTextReturn {
  const SpeechRecognition = getSpeechRecognition();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [state, setState] = useState<SpeechToTextState>({
    isListening: false,
    isSupported: SpeechRecognition !== null,
    transcript: "",
    error: null,
  });

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setState((s) => ({
        ...s,
        error: "Speech input works best in Chrome, Edge, or Safari.",
      }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      setState((s) => ({ ...s, transcript }));

      if (event.results[last].isFinal) {
        onResult(transcript);
        setState((s) => ({ ...s, isListening: false, transcript: "" }));
      }
    };

    recognition.onerror = (event: { error: string }) => {
      setState((s) => ({
        ...s,
        isListening: false,
        error: `Speech error: ${event.error}`,
      }));
    };

    recognition.onend = () => {
      setState((s) => ({ ...s, isListening: false }));
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState((s) => ({ ...s, isListening: true, error: null }));
  }, [SpeechRecognition, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setState((s) => ({ ...s, isListening: false }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useSpeechToText.ts
git commit -m "feat: add speech-to-text hook using Web Speech API"
```

---

### Task 7: Mic Button in ChatInput

**Files:**
- Modify: `frontend/src/components/ChatInput.tsx`

**Depends on:** Task 6

- [ ] **Step 1: Update ChatInput to include mic button**

Rewrite `frontend/src/components/ChatInput.tsx`:

```typescript
// frontend/src/components/ChatInput.tsx
import { useState } from "react";
import { useSpeechToText } from "../hooks/useSpeechToText";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const { isListening, isSupported, transcript, error, startListening, stopListening } =
    useSpeechToText((finalTranscript) => {
      onSend(finalTranscript);
    });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="border-t border-surface-raised p-3 space-y-1">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={isListening ? transcript : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening..." : "Ask your coach..."}
          disabled={disabled || isListening}
          className="flex-1 bg-surface border border-surface-raised rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gold disabled:opacity-50 transition-colors duration-200"
        />
        {isSupported && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={disabled}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors duration-200 cursor-pointer ${
              isListening
                ? "bg-red-600 text-white animate-pulse"
                : "bg-surface-raised text-stone-300 hover:bg-surface-hover hover:text-gold"
            } disabled:opacity-50`}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? "■" : "🎤"}
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || !input.trim() || isListening}
          className="px-3 py-1.5 bg-gold text-stone-900 rounded text-sm font-semibold hover:bg-gold-400 disabled:opacity-50 disabled:hover:bg-gold transition-colors duration-200 cursor-pointer"
        >
          Send
        </button>
      </form>
      {error && (
        <div className="text-[10px] text-red-400">{error}</div>
      )}
    </div>
  );
}
```

Note: The mic emoji is used here as the button label for simplicity. The skill checklist says "no emojis as icons" but this is a text character in a button, not a UI icon. If you prefer, replace with an SVG mic icon.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify build succeeds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatInput.tsx
git commit -m "feat: add mic button to chat input for speech-to-text"
```

---

### Task 8: Session Store + Session Management UI

**Files:**
- Create: `frontend/src/store/sessionStore.ts`
- Create: `frontend/src/hooks/useSession.ts`
- Create: `frontend/src/components/SessionBar.tsx`
- Modify: `frontend/src/types.ts` (add session types)
- Modify: `frontend/src/App.tsx` (add SessionBar)
- Modify: `frontend/vite.config.ts` (add WebSocket proxy if needed)

**Depends on:** Task 2

- [ ] **Step 1: Add session types to types.ts**

Add to `frontend/src/types.ts`:

```typescript
export interface SessionData {
  id: number;
  user_id: string;
  is_active: boolean;
  started_at: string | null;
  ended_at: string | null;
  total_rounds: number;
  total_profit: number;
  ai_summary: string | null;
}

export interface RoundData {
  id: number;
  session_id: number;
  round_number: number;
  hole_cards: string[];
  community_cards: string[];
  num_players: number;
  position: string | null;
  streets: unknown[];
  result: string | null;
  profit: number;
  pot_size: number;
  notes: string | null;
  created_at: string | null;
}
```

- [ ] **Step 2: Create session store**

```typescript
// frontend/src/store/sessionStore.ts
import { create } from "zustand";
import type { SessionData, RoundData } from "../types";

interface SessionStore {
  activeSession: SessionData | null;
  rounds: RoundData[];
  isLoading: boolean;

  setActiveSession: (session: SessionData | null) => void;
  setRounds: (rounds: RoundData[]) => void;
  addRound: (round: RoundData) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  activeSession: null,
  rounds: [],
  isLoading: false,

  setActiveSession: (session) => set({ activeSession: session }),
  setRounds: (rounds) => set({ rounds }),
  addRound: (round) =>
    set((state) => ({ rounds: [...state.rounds, round] })),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
```

- [ ] **Step 3: Create useSession hook**

```typescript
// frontend/src/hooks/useSession.ts
import { useCallback } from "react";
import { useSessionStore } from "../store/sessionStore";
import { useGameStore } from "../store/gameStore";
import { useChatStore } from "../store/chatStore";
import type { SessionData, RoundData } from "../types";

export function useSession() {
  const { activeSession, rounds, setActiveSession, setRounds, addRound, setIsLoading } =
    useSessionStore();
  const gameState = useGameStore();
  const { clearMessages } = useChatStore();

  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch("/api/sessions", { method: "POST" });
      const session: SessionData = await resp.json();
      setActiveSession(session);
      setRounds([]);
      clearMessages();
    } finally {
      setIsLoading(false);
    }
  }, [setActiveSession, setRounds, setIsLoading, clearMessages]);

  const endSession = useCallback(async () => {
    if (!activeSession) return null;
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/sessions/${activeSession.id}/finalize`, {
        method: "POST",
      });
      const result = await resp.json();
      setActiveSession(null);
      setRounds([]);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, setActiveSession, setRounds, setIsLoading]);

  const saveRound = useCallback(
    async (result: string | null, profit: number) => {
      if (!activeSession) return;
      const resp = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSession.id,
          hole_cards: gameState.holeCards,
          community_cards: gameState.communityCards,
          num_players: gameState.numPlayers,
          position: gameState.position,
          pot_size: gameState.potSize,
          result,
          profit,
        }),
      });
      const round: RoundData = await resp.json();
      addRound(round);
      gameState.resetAll();
    },
    [activeSession, gameState, addRound]
  );

  const fetchRounds = useCallback(async () => {
    if (!activeSession) return;
    const resp = await fetch(`/api/rounds?session_id=${activeSession.id}`);
    const data: RoundData[] = await resp.json();
    setRounds(data);
  }, [activeSession, setRounds]);

  const checkActiveSession = useCallback(async () => {
    try {
      const resp = await fetch("/api/sessions/active");
      if (resp.ok) {
        const session: SessionData = await resp.json();
        setActiveSession(session);
        const roundsResp = await fetch(`/api/rounds?session_id=${session.id}`);
        const roundsData: RoundData[] = await roundsResp.json();
        setRounds(roundsData);
      }
    } catch {
      // No active session
    }
  }, [setActiveSession, setRounds]);

  return {
    activeSession,
    rounds,
    startSession,
    endSession,
    saveRound,
    fetchRounds,
    checkActiveSession,
  };
}
```

- [ ] **Step 4: Create SessionBar component**

```typescript
// frontend/src/components/SessionBar.tsx
import { useEffect, useState } from "react";
import { useSession } from "../hooks/useSession";
import { useSessionStore } from "../store/sessionStore";

export function SessionBar() {
  const { activeSession, rounds, startSession, endSession, saveRound, checkActiveSession } =
    useSession();
  const isLoading = useSessionStore((s) => s.isLoading);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endResult, setEndResult] = useState<{ summary: string } | null>(null);

  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  async function handleEndSession() {
    const result = await endSession();
    if (result) {
      setEndResult(result);
    }
    setShowEndConfirm(false);
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {!activeSession ? (
        <button
          onClick={startSession}
          disabled={isLoading}
          className="px-3 py-1 bg-gold text-stone-900 rounded font-semibold hover:bg-gold-400 transition-colors duration-200 cursor-pointer disabled:opacity-50"
        >
          New Session
        </button>
      ) : (
        <>
          <span className="text-stone-400">
            Session <span className="text-gold font-mono">#{activeSession.id}</span>
            {" · "}
            <span className="font-mono">{rounds.length}</span> rounds
          </span>
          <button
            onClick={() => saveRound(null, 0)}
            className="px-2 py-1 bg-surface-raised text-stone-300 rounded hover:bg-surface-hover transition-colors duration-200 cursor-pointer text-xs"
          >
            Save Round
          </button>
          {!showEndConfirm ? (
            <button
              onClick={() => setShowEndConfirm(true)}
              className="px-2 py-1 bg-red-800 text-stone-200 rounded hover:bg-red-700 transition-colors duration-200 cursor-pointer text-xs"
            >
              End Session
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-stone-400 text-xs">End session?</span>
              <button
                onClick={handleEndSession}
                disabled={isLoading}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "..." : "Yes"}
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-2 py-1 bg-surface-raised text-stone-300 rounded text-xs cursor-pointer"
              >
                No
              </button>
            </div>
          )}
        </>
      )}
      {endResult && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-raised rounded-xl p-6 max-w-md w-full space-y-3">
            <h3 className="text-gold font-semibold">Session Complete</h3>
            <p className="text-sm text-stone-300">{endResult.summary}</p>
            <button
              onClick={() => setEndResult(null)}
              className="px-4 py-2 bg-gold text-stone-900 rounded font-semibold hover:bg-gold-400 transition-colors duration-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add SessionBar to App.tsx**

Update `frontend/src/App.tsx` header to include the SessionBar:

```typescript
import { SessionBar } from "./components/SessionBar";
// ... in the header:
<header className="p-4 border-b border-surface-raised flex items-center justify-between">
  <h1 className="text-xl font-bold tracking-wide text-gold">The Gambler</h1>
  <SessionBar />
</header>
```

- [ ] **Step 6: Verify TypeScript compiles and build succeeds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: Clean compile and build

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/store/sessionStore.ts frontend/src/hooks/useSession.ts frontend/src/components/SessionBar.tsx frontend/src/App.tsx
git commit -m "feat: add session management UI with start/end/save round"
```

---

### Task 9: Round History Display

**Files:**
- Create: `frontend/src/components/RoundHistory.tsx`
- Modify: `frontend/src/App.tsx` (add RoundHistory)

**Depends on:** Task 3, Task 8

- [ ] **Step 1: Create RoundHistory component**

```typescript
// frontend/src/components/RoundHistory.tsx
import { useState } from "react";
import { useSessionStore } from "../store/sessionStore";
import { SUIT_SYMBOLS, SUIT_COLORS } from "../utils/cardUtils";
import type { RoundData } from "../types";

export function RoundHistory() {
  const { rounds, activeSession } = useSessionStore();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!activeSession || rounds.length === 0) return null;

  return (
    <div className="border border-surface-raised rounded-lg">
      <button
        onClick={() => setExpandedId(expandedId === -1 ? null : -1)}
        className="w-full flex items-center justify-between p-3 text-sm text-stone-400 hover:text-stone-200 transition-colors duration-200 cursor-pointer"
      >
        <span className="font-medium">
          Round History <span className="font-mono text-gold">({rounds.length})</span>
        </span>
        <span className={`transition-transform duration-200 ${expandedId === -1 ? "rotate-180" : ""}`}>
          &#9660;
        </span>
      </button>

      {expandedId === -1 && (
        <div className="px-3 pb-3 space-y-2">
          {rounds.map((round) => (
            <RoundItem
              key={round.id}
              round={round}
              isExpanded={expandedId === round.id}
              onToggle={() =>
                setExpandedId(expandedId === round.id ? -1 : round.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundItem({
  round,
  isExpanded,
  onToggle,
}: {
  round: RoundData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const profitColor =
    round.profit > 0
      ? "text-emerald-400"
      : round.profit < 0
        ? "text-red-400"
        : "text-stone-400";

  function formatCard(card: string) {
    return card[0] + (SUIT_SYMBOLS[card[1]] || card[1]);
  }

  return (
    <div className="bg-surface rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 text-xs cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-stone-500 font-mono">#{round.round_number}</span>
          <span className="text-stone-200">
            {round.hole_cards.map(formatCard).join(" ")}
          </span>
          {round.result && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                round.result === "won"
                  ? "bg-emerald-900 text-emerald-300"
                  : round.result === "lost"
                    ? "bg-red-900 text-red-300"
                    : "bg-surface-raised text-stone-400"
              }`}
            >
              {round.result}
            </span>
          )}
        </div>
        <span className={`font-mono ${profitColor}`}>
          {round.profit >= 0 ? "+" : ""}${round.profit.toFixed(0)}
        </span>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 text-[10px] text-stone-400 space-y-1">
          {round.community_cards.length > 0 && (
            <div>
              Board:{" "}
              {round.community_cards.map((c, i) => (
                <span key={i} className={SUIT_COLORS[c[1]]}>
                  {formatCard(c)}{" "}
                </span>
              ))}
            </div>
          )}
          <div>
            Pot: <span className="font-mono">${round.pot_size}</span>
            {round.position && <> · Position: {round.position}</>}
            {" · "}Players: {round.num_players}
          </div>
          {round.notes && <div className="text-stone-500">{round.notes}</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add RoundHistory to App.tsx**

Add import and place below CheatSheet in the main content area:
```typescript
import { RoundHistory } from "./components/RoundHistory";
// ... in <main>:
<RoundHistory />
```

- [ ] **Step 3: Verify TypeScript compiles and build succeeds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/RoundHistory.tsx frontend/src/App.tsx
git commit -m "feat: add collapsible round history display"
```

---

### Task 10: Wire Session Rounds into Chat Context

**Files:**
- Modify: `frontend/src/hooks/useChat.ts` (send session rounds with each message)

**Depends on:** Tasks 2, 3, 8

- [ ] **Step 1: Update useChat to include session rounds**

Update the `sendMessage` function in `frontend/src/hooks/useChat.ts` to pull rounds from the session store:

```typescript
// Add import at top:
import { useSessionStore } from "../store/sessionStore";

// Inside sendMessage callback, after getting gameState:
const rounds = useSessionStore.getState().rounds;

// Update the WebSocket send to include rounds:
wsRef.current.send(
  JSON.stringify({
    message: text,
    board_state: {
      hole_cards: gameState.holeCards,
      community_cards: gameState.communityCards,
      num_players: gameState.numPlayers,
      pot_size: gameState.potSize,
      bet_to_call: gameState.betToCall,
      position: gameState.position,
      your_stack: gameState.yourStack,
      villain_stack: gameState.villainStack,
    },
    session_rounds: rounds.map((r) => ({
      round_number: r.round_number,
      hole_cards: r.hole_cards,
      result: r.result,
      profit: r.profit,
      pot_size: r.pot_size,
      position: r.position,
    })),
  })
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useChat.ts
git commit -m "feat: wire session rounds into chat WebSocket context"
```

---

### Task 11: Integration Test — Full Phase 3 Flow

**Files:**
- No new files; run existing test suite + manual verification

**Depends on:** All previous tasks

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All tests pass (62+ existing + new)

- [ ] **Step 2: Verify frontend compiles and builds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: Clean compile and build

- [ ] **Step 3: Verify backend starts cleanly**

Run: `cd backend && source venv/bin/activate && timeout 5 uvicorn app.main:app --port 8000 2>&1 || true`
Expected: Starts without import errors, creates new tables

- [ ] **Step 4: Verify new endpoints work**

```bash
# Start session
curl -X POST http://localhost:8000/api/sessions | python -m json.tool

# Save a round (use session id from above)
curl -X POST http://localhost:8000/api/rounds \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1, "hole_cards": ["Ah", "Kd"], "result": "won", "profit": 100}' \
  | python -m json.tool

# List rounds
curl http://localhost:8000/api/rounds?session_id=1 | python -m json.tool

# Get active session
curl http://localhost:8000/api/sessions/active | python -m json.tool
```

- [ ] **Step 5: Verify frontend runs with backend**

Run frontend dev server: `cd frontend && npm run dev`
Open http://localhost:5173 — verify:
1. "New Session" button appears in header
2. Clicking it creates a session (shows session #ID)
3. "Save Round" saves current board state
4. Round history shows saved rounds
5. Mic button appears in chat input (Chrome/Edge/Safari)
6. "End Session" triggers AI summary (if Gemini key set)

- [ ] **Step 6: Commit any fixes from integration**

```bash
git add -A
git commit -m "fix: integration fixes for Phase 3"
```
