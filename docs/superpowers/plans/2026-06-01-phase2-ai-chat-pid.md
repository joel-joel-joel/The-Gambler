# Phase 2: AI Chat + PID — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI poker coaching chat (Gemini-powered) with auto-applying board updates, an undo system, pot tracking via natural language, and a Player Intelligence Document (PID) that persists across sessions in SQLite.

**Architecture:** Backend adds three services: an AI service (provider-agnostic interface, Gemini implementation), a PID service (SQLAlchemy + SQLite CRUD), and a WebSocket chat handler that injects board state + PID into each AI call and returns structured responses with optional `board_update` JSON. Frontend adds a Zustand chat store, a WebSocket hook, a chat sidebar/drawer component, and undo logic that snapshots game state before each auto-apply.

**Tech Stack:** google-genai SDK, FastAPI WebSockets, SQLAlchemy 2.0, SQLite, aiosqlite | React 18, Zustand, Tailwind v3

---

## File Structure

```
backend/
├── app/
│   ├── main.py                      # (modify) add WebSocket route, DB lifespan
│   ├── config.py                    # (modify) add GEMINI_API_KEY, DATABASE_URL
│   ├── models/
│   │   ├── __init__.py
│   │   └── database.py              # SQLAlchemy engine, session, PID table
│   ├── routers/
│   │   ├── chat.py                  # WebSocket /ws/chat endpoint
│   │   └── pid.py                   # REST: GET/PUT /api/pid
│   └── services/
│       ├── ai_service.py            # Provider interface + Gemini implementation
│       ├── pid_service.py           # PID CRUD operations
│       └── prompt_builder.py        # Build system prompt with context injection
├── tests/
│   ├── test_ai_service.py
│   ├── test_pid_service.py
│   ├── test_prompt_builder.py
│   └── test_pid_router.py
└── requirements.txt                 # (modify) add google-genai, sqlalchemy, aiosqlite

frontend/
├── src/
│   ├── types.ts                     # (modify) add ChatMessage, BoardUpdate types
│   ├── store/
│   │   ├── gameStore.ts             # (modify) add undo snapshot methods
│   │   └── chatStore.ts             # Chat messages, WebSocket state
│   ├── hooks/
│   │   └── useChat.ts               # WebSocket connection + message handling
│   ├── components/
│   │   ├── ChatSidebar.tsx          # Sidebar (desktop) / drawer (mobile)
│   │   ├── ChatMessage.tsx          # Single message bubble
│   │   ├── ChatInput.tsx            # Text input + send button
│   │   └── UndoBanner.tsx           # "Undo" toast for auto-applied changes
│   └── App.tsx                      # (modify) add ChatSidebar to layout
```

---

## Task 1: Backend Dependencies + Database Setup

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/database.py`
- Create: `backend/tests/test_pid_service.py` (partial — DB setup test only)

- [ ] **Step 1: Update requirements.txt**

Add to `backend/requirements.txt`:

```
google-genai==1.14.0
sqlalchemy==2.0.35
aiosqlite==0.20.0
```

- [ ] **Step 2: Update config.py**

Replace `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    monte_carlo_iterations: int = 10000
    cors_origins: str = "http://localhost:5173"
    gemini_api_key: str = ""
    database_url: str = "sqlite:///./poker.db"


settings = Settings()
```

- [ ] **Step 3: Update .env.example**

Replace `backend/.env.example`:

```bash
MONTE_CARLO_ITERATIONS=10000
CORS_ORIGINS=http://localhost:5173
GEMINI_API_KEY=your_key_here
DATABASE_URL=sqlite:///./poker.db
```

- [ ] **Step 4: Create database module**

```bash
mkdir -p backend/app/models
touch backend/app/models/__init__.py
```

Create `backend/app/models/database.py`:

```python
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from datetime import datetime, timezone

from app.config import settings


class Base(DeclarativeBase):
    pass


class PIDRecord(Base):
    __tablename__ = "pid"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, unique=True, nullable=False, default="default")
    pid_markdown = Column(Text, nullable=False, default="")
    version = Column(Integer, nullable=False, default=1)
    last_updated = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )


engine = create_engine(
    settings.database_url, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Write a test to verify DB creation**

Create `backend/tests/test_pid_service.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, PIDRecord


def make_test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)


def test_db_creates_pid_table():
    Session = make_test_db()
    with Session() as session:
        record = PIDRecord(user_id="test", pid_markdown="# Test PID", version=1)
        session.add(record)
        session.commit()

        result = session.query(PIDRecord).filter_by(user_id="test").first()
        assert result is not None
        assert result.pid_markdown == "# Test PID"
        assert result.version == 1
```

- [ ] **Step 6: Install dependencies and run test**

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
pytest tests/test_pid_service.py::test_db_creates_pid_table -v
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/app/config.py backend/.env.example backend/app/models/ backend/tests/test_pid_service.py
git commit -m "feat: add database setup with SQLAlchemy, PID table, Gemini deps"
```

---

## Task 2: PID Service (CRUD)

**Files:**
- Create: `backend/app/services/pid_service.py`
- Modify: `backend/tests/test_pid_service.py`

- [ ] **Step 1: Write failing tests for PID CRUD**

Append to `backend/tests/test_pid_service.py`:

```python
from app.services.pid_service import get_pid, save_pid, get_pid_history


def test_get_pid_returns_default_when_empty():
    Session = make_test_db()
    with Session() as session:
        result = get_pid(session, "new_user")
        assert "# Player Intelligence Document" in result


def test_save_pid_creates_new():
    Session = make_test_db()
    with Session() as session:
        save_pid(session, "user1", "# My PID\nSome content")
        result = get_pid(session, "user1")
        assert "Some content" in result


def test_save_pid_increments_version():
    Session = make_test_db()
    with Session() as session:
        save_pid(session, "user1", "Version 1")
        save_pid(session, "user1", "Version 2")
        record = session.query(PIDRecord).filter_by(user_id="user1").first()
        assert record.version == 2
        assert "Version 2" in record.pid_markdown


def test_save_pid_updates_existing():
    Session = make_test_db()
    with Session() as session:
        save_pid(session, "user1", "Original")
        save_pid(session, "user1", "Updated")
        result = get_pid(session, "user1")
        assert result == "Updated"
        count = session.query(PIDRecord).filter_by(user_id="user1").count()
        assert count == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_pid_service.py -v
```

Expected: FAIL — `ImportError: cannot import name 'get_pid'`

- [ ] **Step 3: Implement PID service**

Create `backend/app/services/pid_service.py`:

```python
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import PIDRecord

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


def save_pid(db: Session, user_id: str, pid_markdown: str) -> PIDRecord:
    record = db.query(PIDRecord).filter_by(user_id=user_id).first()
    if record is None:
        record = PIDRecord(
            user_id=user_id,
            pid_markdown=pid_markdown,
            version=1,
        )
        db.add(record)
    else:
        record.pid_markdown = pid_markdown
        record.version += 1
        record.last_updated = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_pid_service.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/pid_service.py backend/tests/test_pid_service.py
git commit -m "feat: add PID service with get/save CRUD operations"
```

---

## Task 3: PID REST Router

**Files:**
- Create: `backend/app/routers/pid.py`
- Create: `backend/tests/test_pid_router.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_pid_router.py`:

```python
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.database import Base, get_db

test_engine = create_engine("sqlite:///:memory:")
TestSession = sessionmaker(bind=test_engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def setup_function():
    Base.metadata.create_all(bind=test_engine)


def teardown_function():
    Base.metadata.drop_all(bind=test_engine)


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
```

- [ ] **Step 2: Create the PID router**

Create `backend/app/routers/pid.py`:

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.pid_service import get_pid, save_pid

router = APIRouter()


class PIDUpdateRequest(BaseModel):
    pid_markdown: str


@router.get("/api/pid")
def read_pid(db: Session = Depends(get_db)):
    markdown = get_pid(db, "default")
    return {"pid_markdown": markdown}


@router.put("/api/pid")
def update_pid(req: PIDUpdateRequest, db: Session = Depends(get_db)):
    record = save_pid(db, "default", req.pid_markdown)
    return {"pid_markdown": record.pid_markdown, "version": record.version}
```

- [ ] **Step 3: Register router and add DB init to main.py**

Replace `backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.database import init_db
from app.routers.calculate import router as calculate_router
from app.routers.pid import router as pid_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="The Gambler API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calculate_router)
app.include_router(pid_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 4: Run tests**

```bash
cd backend
pytest tests/test_pid_router.py -v
```

Expected: All PASS

- [ ] **Step 5: Run all existing tests to check for regressions**

```bash
cd backend
pytest tests/ -v
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/pid.py backend/app/main.py backend/tests/test_pid_router.py
git commit -m "feat: add PID REST endpoints (GET/PUT /api/pid)"
```

---

## Task 4: AI Service (Provider-Agnostic + Gemini)

**Files:**
- Create: `backend/app/services/ai_service.py`
- Create: `backend/tests/test_ai_service.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_ai_service.py`:

```python
import json
from app.services.ai_service import parse_ai_response


def test_parse_response_message_only():
    raw = "With 9 outs you have about 36% equity on the flop."
    result = parse_ai_response(raw)
    assert result["message"] == raw
    assert result["board_update"] is None


def test_parse_response_with_board_update():
    raw = (
        'Updated pot to $135. You need to call $60.\n'
        '{"board_update": {"pot_size": 135, "bet_to_call": 60}}'
    )
    result = parse_ai_response(raw)
    assert "Updated pot" in result["message"]
    assert result["board_update"]["pot_size"] == 135
    assert result["board_update"]["bet_to_call"] == 60


def test_parse_response_with_community_cards():
    raw = (
        'Flop is set.\n'
        '{"board_update": {"community_cards": ["Ah", "7d", "2c"]}}'
    )
    result = parse_ai_response(raw)
    assert result["board_update"]["community_cards"] == ["Ah", "7d", "2c"]


def test_parse_response_malformed_json_ignored():
    raw = "Some response {not valid json"
    result = parse_ai_response(raw)
    assert result["message"] == raw
    assert result["board_update"] is None


def test_parse_response_strips_json_from_message():
    raw = (
        'The pot is now $200.\n'
        '{"board_update": {"pot_size": 200}}'
    )
    result = parse_ai_response(raw)
    assert '{"board_update"' not in result["message"]
    assert "The pot is now $200." in result["message"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_ai_service.py -v
```

Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement AI service**

Create `backend/app/services/ai_service.py`:

```python
import json
import re

from google import genai

from app.config import settings


def create_gemini_client() -> genai.Client | None:
    if not settings.gemini_api_key:
        return None
    return genai.Client(api_key=settings.gemini_api_key)


_client: genai.Client | None = None


def get_client() -> genai.Client | None:
    global _client
    if _client is None:
        _client = create_gemini_client()
    return _client


async def chat_with_ai(system_prompt: str, user_message: str) -> str:
    client = get_client()
    if client is None:
        return (
            "AI is not configured. Set GEMINI_API_KEY in your .env file. "
            "For now, I'll do my best as a placeholder coach: "
            "always check your pot odds against your equity!"
        )

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=user_message,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
            max_output_tokens=500,
        ),
    )
    return response.text


BOARD_UPDATE_PATTERN = re.compile(
    r'\{[\s]*"board_update"[\s]*:[\s]*\{[^}]+\}[\s]*\}', re.DOTALL
)


def parse_ai_response(raw_text: str) -> dict:
    match = BOARD_UPDATE_PATTERN.search(raw_text)
    board_update = None
    message = raw_text

    if match:
        try:
            parsed = json.loads(match.group(0))
            board_update = parsed.get("board_update")
            message = raw_text[: match.start()].strip()
            trailing = raw_text[match.end() :].strip()
            if trailing:
                message = message + "\n" + trailing if message else trailing
        except (json.JSONDecodeError, KeyError):
            pass

    if not message:
        message = raw_text

    return {"message": message, "board_update": board_update}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_ai_service.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai_service.py backend/tests/test_ai_service.py
git commit -m "feat: add AI service with Gemini integration and response parser"
```

---

## Task 5: Prompt Builder

**Files:**
- Create: `backend/app/services/prompt_builder.py`
- Create: `backend/tests/test_prompt_builder.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_prompt_builder.py`:

```python
from app.services.prompt_builder import build_system_prompt


def test_prompt_includes_system_instructions():
    prompt = build_system_prompt(board_state={}, pid="", session_rounds=[])
    assert "poker math coach" in prompt.lower()
    assert "board_update" in prompt


def test_prompt_includes_board_state():
    board = {"hole_cards": ["Ah", "Kd"], "pot_size": 100}
    prompt = build_system_prompt(board_state=board, pid="", session_rounds=[])
    assert "Ah" in prompt
    assert "100" in prompt


def test_prompt_includes_pid():
    pid = "## Leaks\n1. River calling too wide"
    prompt = build_system_prompt(board_state={}, pid=pid, session_rounds=[])
    assert "River calling too wide" in prompt


def test_prompt_includes_session_rounds():
    rounds = [{"round_number": 1, "hole_cards": ["Qh", "Jd"], "result": "won"}]
    prompt = build_system_prompt(board_state={}, pid="", session_rounds=rounds)
    assert "Qh" in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_prompt_builder.py -v
```

Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement prompt builder**

Create `backend/app/services/prompt_builder.py`:

```python
import json


SYSTEM_TEMPLATE = """You are a concise poker math coach embedded in a real-time Hold'em companion app.

CONTEXT (injected per message):
- Current board state: {board_state}
- Player Intelligence Document (your long-term scouting notes on this player): {pid}
- Recent rounds this session: {session_rounds}

RULES:
1. Keep responses under 100 words unless analyzing a full round.
2. Always reference specific numbers: equity %, EV, pot odds.
3. Never say "it depends" without following up with the math.
4. When the user describes game actions via voice or text, auto-apply the update. Return a board_update JSON block on its own line:
   {{"board_update": {{"field": "value"}}}}
   Valid fields: pot_size (number), bet_to_call (number), community_cards (list of card strings like "Ah"), hole_cards (list), num_players (number), position (string).
   If you're uncertain about parsing, apply your best guess AND note the assumption so they can correct it.
5. When analyzing past rounds, identify the specific decision point where EV was left on the table and quantify it.
6. Connect advice to the player's known leaks and improvement goals from the PID.
7. Track mental math usage: if the player asks "what are my outs?" instead of calculating themselves, gently prompt them to try first.

PERSONALITY: Direct, numbers-first, encouraging but honest. No fluff. Think like a patient math tutor at the poker table."""


def build_system_prompt(
    board_state: dict,
    pid: str,
    session_rounds: list,
) -> str:
    board_str = json.dumps(board_state, indent=2) if board_state else "No cards selected"
    pid_str = pid if pid else "No PID data yet"
    rounds_str = json.dumps(session_rounds, indent=2) if session_rounds else "No rounds yet"

    return SYSTEM_TEMPLATE.format(
        board_state=board_str,
        pid=pid_str,
        session_rounds=rounds_str,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_prompt_builder.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/prompt_builder.py backend/tests/test_prompt_builder.py
git commit -m "feat: add prompt builder with board state, PID, and rounds injection"
```

---

## Task 6: WebSocket Chat Endpoint

**Files:**
- Create: `backend/app/routers/chat.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the WebSocket chat router**

Create `backend/app/routers/chat.py`:

```python
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.database import SessionLocal
from app.services.ai_service import chat_with_ai, parse_ai_response
from app.services.pid_service import get_pid
from app.services.prompt_builder import build_system_prompt

router = APIRouter()


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            user_message = data.get("message", "")
            board_state = data.get("board_state", {})
            session_rounds = data.get("session_rounds", [])

            db = SessionLocal()
            try:
                pid = get_pid(db, "default")
            finally:
                db.close()

            system_prompt = build_system_prompt(
                board_state=board_state,
                pid=pid,
                session_rounds=session_rounds,
            )

            raw_response = await chat_with_ai(system_prompt, user_message)
            parsed = parse_ai_response(raw_response)

            await websocket.send_json(parsed)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json(
                {"message": f"Error: {str(e)}", "board_update": None}
            )
        except Exception:
            pass
```

- [ ] **Step 2: Register the WebSocket router in main.py**

Add import and include to `backend/app/main.py` after the existing router includes:

```python
from app.routers.chat import router as chat_router

app.include_router(chat_router)
```

- [ ] **Step 3: Manual verification test**

Start the backend server:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Test with a Python WebSocket client (in a separate terminal):
```python
import asyncio
import websockets
import json

async def test():
    async with websockets.connect("ws://localhost:8000/ws/chat") as ws:
        await ws.send(json.dumps({
            "message": "What are pot odds?",
            "board_state": {"hole_cards": ["Ah", "Kd"], "pot_size": 100},
            "session_rounds": []
        }))
        response = json.loads(await ws.recv())
        print(response)

asyncio.run(test())
```

Expected: A response with `message` and `board_update` fields (board_update may be null for a question).

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/chat.py backend/app/main.py
git commit -m "feat: add WebSocket /ws/chat endpoint with AI + PID context"
```

---

## Task 7: Frontend Chat Types + Chat Store

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/store/chatStore.ts`

- [ ] **Step 1: Add chat types**

Append to `frontend/src/types.ts`:

```typescript
export interface BoardUpdate {
  pot_size?: number;
  bet_to_call?: number;
  community_cards?: string[];
  hole_cards?: string[];
  num_players?: number;
  position?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  boardUpdate: BoardUpdate | null;
  timestamp: number;
}
```

- [ ] **Step 2: Create chat store**

Create `frontend/src/store/chatStore.ts`:

```typescript
import { create } from "zustand";
import type { ChatMessage } from "../types";

interface ChatStore {
  messages: ChatMessage[];
  isConnected: boolean;
  isWaiting: boolean;

  addMessage: (msg: ChatMessage) => void;
  setConnected: (connected: boolean) => void;
  setWaiting: (waiting: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isConnected: false,
  isWaiting: false,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  setConnected: (connected) => set({ isConnected: connected }),
  setWaiting: (waiting) => set({ isWaiting: waiting }),
  clearMessages: () => set({ messages: [] }),
}));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/store/chatStore.ts
git commit -m "feat: add chat types and Zustand chat store"
```

---

## Task 8: Undo Snapshot Logic in Game Store

**Files:**
- Modify: `frontend/src/store/gameStore.ts`

- [ ] **Step 1: Add undo snapshot methods to the game store**

Add to the `GameStore` interface and implementation in `frontend/src/store/gameStore.ts`:

```typescript
import { create } from "zustand";
import type { BoardUpdate, CalculationResult, GameState } from "../types";

interface GameStore extends GameState {
  results: CalculationResult | null;
  isLoading: boolean;
  error: string | null;
  undoSnapshot: GameState | null;

  setHoleCards: (cards: string[]) => void;
  setCommunityCards: (cards: string[]) => void;
  setNumPlayers: (n: number) => void;
  setPotSize: (size: number) => void;
  setBetToCall: (bet: number) => void;
  setPosition: (pos: string | null) => void;
  setYourStack: (stack: number | null) => void;
  setVillainStack: (stack: number | null) => void;
  setResults: (results: CalculationResult | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetAll: () => void;
  applyBoardUpdate: (update: BoardUpdate) => void;
  undo: () => void;
  clearUndo: () => void;
}

const initialState: GameState = {
  holeCards: [],
  communityCards: [],
  numPlayers: 6,
  potSize: 0,
  betToCall: 0,
  position: null,
  yourStack: null,
  villainStack: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  results: null,
  isLoading: false,
  error: null,
  undoSnapshot: null,

  setHoleCards: (cards) => set({ holeCards: cards }),
  setCommunityCards: (cards) => set({ communityCards: cards }),
  setNumPlayers: (n) => set({ numPlayers: n }),
  setPotSize: (size) => set({ potSize: size }),
  setBetToCall: (bet) => set({ betToCall: bet }),
  setPosition: (pos) => set({ position: pos }),
  setYourStack: (stack) => set({ yourStack: stack }),
  setVillainStack: (stack) => set({ villainStack: stack }),
  setResults: (results) => set({ results }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  resetAll: () => set({ ...initialState, results: null, error: null, undoSnapshot: null }),

  applyBoardUpdate: (update) => {
    const state = get();
    const snapshot: GameState = {
      holeCards: state.holeCards,
      communityCards: state.communityCards,
      numPlayers: state.numPlayers,
      potSize: state.potSize,
      betToCall: state.betToCall,
      position: state.position,
      yourStack: state.yourStack,
      villainStack: state.villainStack,
    };

    const changes: Partial<GameState> = {};
    if (update.pot_size !== undefined) changes.potSize = update.pot_size;
    if (update.bet_to_call !== undefined) changes.betToCall = update.bet_to_call;
    if (update.community_cards !== undefined) changes.communityCards = update.community_cards;
    if (update.hole_cards !== undefined) changes.holeCards = update.hole_cards;
    if (update.num_players !== undefined) changes.numPlayers = update.num_players;
    if (update.position !== undefined) changes.position = update.position;

    set({ ...changes, undoSnapshot: snapshot });
  },

  undo: () => {
    const { undoSnapshot } = get();
    if (undoSnapshot) {
      set({ ...undoSnapshot, undoSnapshot: null });
    }
  },

  clearUndo: () => set({ undoSnapshot: null }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/gameStore.ts
git commit -m "feat: add undo snapshot and applyBoardUpdate to game store"
```

---

## Task 9: WebSocket Chat Hook

**Files:**
- Create: `frontend/src/hooks/useChat.ts`

- [ ] **Step 1: Implement the WebSocket chat hook**

Create `frontend/src/hooks/useChat.ts`:

```typescript
import { useEffect, useRef, useCallback } from "react";
import { useChatStore } from "../store/chatStore";
import { useGameStore } from "../store/gameStore";
import type { ChatMessage } from "../types";

export function useChat() {
  const wsRef = useRef<WebSocket | null>(null);
  const { addMessage, setConnected, setWaiting } = useChatStore();
  const { applyBoardUpdate } = useGameStore();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        boardUpdate: data.board_update || null,
        timestamp: Date.now(),
      };

      addMessage(assistantMsg);
      setWaiting(false);

      if (data.board_update) {
        applyBoardUpdate(data.board_update);
      }
    };

    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const gameState = useGameStore.getState();

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        boardUpdate: null,
        timestamp: Date.now(),
      };

      addMessage(userMsg);
      setWaiting(true);

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
          session_rounds: [],
        })
      );
    },
    [addMessage, setWaiting, applyBoardUpdate]
  );

  return { sendMessage };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useChat.ts
git commit -m "feat: add WebSocket chat hook with auto-apply board updates"
```

---

## Task 10: Chat UI Components

**Files:**
- Create: `frontend/src/components/ChatMessage.tsx`
- Create: `frontend/src/components/ChatInput.tsx`
- Create: `frontend/src/components/UndoBanner.tsx`
- Create: `frontend/src/components/ChatSidebar.tsx`

- [ ] **Step 1: Create ChatMessage component**

Create `frontend/src/components/ChatMessage.tsx`:

```typescript
import type { ChatMessage as ChatMessageType } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-700 text-gray-100"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.boardUpdate && (
          <div className="mt-1 pt-1 border-t border-gray-600 text-xs text-green-400">
            Board updated
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ChatInput component**

Create `frontend/src/components/ChatInput.tsx`:

```typescript
import { useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-700">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask your coach..."
        disabled={disabled}
        className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="px-3 py-1.5 bg-blue-600 rounded text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
      >
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create UndoBanner component**

Create `frontend/src/components/UndoBanner.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";

export function UndoBanner() {
  const { undoSnapshot, undo, clearUndo } = useGameStore();
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (!undoSnapshot) {
      setTimeLeft(10);
      return;
    }

    setTimeLeft(10);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearUndo();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [undoSnapshot, clearUndo]);

  if (!undoSnapshot) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 flex items-center gap-3 shadow-xl z-50">
      <span className="text-sm text-gray-300">Board updated by AI</span>
      <button
        onClick={undo}
        className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-500"
      >
        Undo ({timeLeft}s)
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create ChatSidebar component**

Create `frontend/src/components/ChatSidebar.tsx`:

```typescript
import { useRef, useEffect, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

export function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, isConnected, isWaiting } = useChatStore();
  const { sendMessage } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 md:hidden"
      >
        <span className="text-lg">{isOpen ? "×" : "💬"}</span>
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 bg-gray-850 border-l border-gray-700 flex flex-col z-30
          transition-transform duration-200
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          md:translate-x-0 md:static md:h-auto
        `}
        style={{ backgroundColor: "#1a1d23" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Coach</h2>
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white md:hidden"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
          {messages.length === 0 && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Ask your poker coach anything, or describe game actions to update the board.
            </p>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isWaiting && (
            <div className="text-xs text-gray-400 animate-pulse">Thinking...</div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={!isConnected} />
      </div>
    </>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ChatMessage.tsx frontend/src/components/ChatInput.tsx frontend/src/components/UndoBanner.tsx frontend/src/components/ChatSidebar.tsx
git commit -m "feat: add chat UI components (sidebar, messages, input, undo banner)"
```

---

## Task 11: Wire Chat Into App Layout

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update App.tsx to include chat sidebar and undo banner**

Replace `frontend/src/App.tsx`:

```typescript
import { CardSelector } from "./components/CardSelector";
import { GameInputs } from "./components/GameInputs";
import { QuickEntryBar } from "./components/QuickEntryBar";
import { ResultsPanel } from "./components/ResultsPanel";
import { CheatSheet } from "./components/CheatSheet";
import { ChatSidebar } from "./components/ChatSidebar";
import { UndoBanner } from "./components/UndoBanner";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">The Gambler</h1>
      </header>
      <div className="flex">
        <main className="flex-1 max-w-4xl mx-auto p-4 space-y-6">
          <QuickEntryBar />
          <CardSelector />
          <GameInputs />
          <ResultsPanel />
          <CheatSheet />
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire chat sidebar and undo banner into app layout"
```

---

## Task 12: Integration Test — Full Stack Chat

**Files:**
- No new files — manual verification

- [ ] **Step 1: Start the backend**

```bash
cd backend
source venv/bin/activate
GEMINI_API_KEY=your_key_here uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 2: Start the frontend**

```bash
cd frontend
npm run dev
```

- [ ] **Step 3: Verify in browser at http://localhost:5173**

Test these scenarios:

1. **Chat connection**: Green dot next to "Coach" header means WebSocket connected
2. **Basic question**: Type "What are pot odds?" — should get a math-focused response
3. **Board update command**: Select hole cards (Ah, Kd), then type "Player raised to 60, pot is 200" — AI should respond with board_update, pot/bet fields should update in the calculator, undo banner should appear
4. **Undo**: Click "Undo" on the banner — pot/bet should revert to previous values
5. **Undo timeout**: Trigger another board update, wait 10 seconds — undo banner disappears
6. **PID endpoint**: `curl http://localhost:8000/api/pid` — should return default PID
7. **PID update**: `curl -X PUT http://localhost:8000/api/pid -H "Content-Type: application/json" -d '{"pid_markdown": "# Test PID"}'` — should save and return version 1
8. **Mobile drawer**: Resize browser narrow — chat should hide behind a floating button, tap to open as drawer

- [ ] **Step 4: Run all backend tests**

```bash
cd backend
pytest tests/ -v
```

Expected: All tests pass

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 2 — AI Chat + PID (Gemini, WebSocket, undo, auto-apply)"
```

---

## Spec Coverage Verification

| Spec Requirement | Task |
|-----------------|------|
| Gemini API integration | Task 4 |
| Provider-agnostic interface | Task 4 (interface ready for future providers) |
| Prompt engineering (system prompt) | Task 5 |
| WebSocket chat endpoint | Task 6 |
| Chat sidebar (desktop) / drawer (mobile) | Task 10, 11 |
| Chat message history | Task 7, 10 |
| Text input with send | Task 10 |
| Parse AI board_update JSON | Task 4 (parse_ai_response) |
| Auto-apply board updates to calculator UI | Task 9 (useChat hook) |
| Undo button with 10s timeout | Task 8, 10 (UndoBanner) |
| Board state injected into AI context | Task 5, 6, 9 |
| PID create/read/update (SQLite) | Task 1, 2, 3 |
| PID wired into AI system prompt | Task 5, 6 |
| Scenario commands via chat | Task 5 (prompt instructs AI), Task 4 (parser extracts updates) |
| Auto-accumulating pot tracker | Task 5 (prompt instructs AI to track pot changes) |

**Note — deferred to Phase 3 per the original plan:**
- Speech-to-text (Web Speech API)
- Round storage + condensation
- Session end → PID rewrite
- Session summary endpoint
