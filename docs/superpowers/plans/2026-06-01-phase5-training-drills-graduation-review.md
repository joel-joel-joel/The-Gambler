# Phase 5: Training Drills + Graduation + Session Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete training system with 6 drill skills, graduation tracking, session review with Socratic questions, and live-mode tap-to-reveal for graduated skills.

**Architecture:** Backend drill engine generates random or history-based scenarios using existing `poker_engine.py` functions. Pending drills stored server-side (dict keyed by UUID) to prevent answer leakage. Frontend adds a Training tab with drill runner, graduation tracker, session reviews, and drill history. `ResultsPanel` gets tap-to-reveal for graduated skills.

**Tech Stack:** Python/FastAPI (backend), React 18/TypeScript/Zustand/Tailwind v3 (frontend), eval7 (poker math), SQLAlchemy/SQLite (persistence)

---

## Dependency Graph

```
Task 1 (DB models) ──────────────────┐
                                      ├─→ Task 3 (drill service) ──→ Task 4 (drill router) ──┐
Task 2 (Pydantic schemas) ───────────┘                                                        │
                                                                                               ├─→ Task 7 (frontend types + hooks)
Task 5 (session review service) ──→ Task 6 (session review router) ───────────────────────────┘     │
                                                                                                     │
                                                                                               Task 8 (training store)
                                                                                                     │
                                                                                               Task 9 (Training page + drill runner)
                                                                                                     │
                                                                                               Task 10 (graduation tracker + drill history UI)
                                                                                                     │
                                                                                               Task 11 (session review UI)
                                                                                                     │
                                                                                               Task 12 (tap-to-reveal in ResultsPanel)
                                                                                                     │
                                                                                               Task 13 (PID mental math integration)
```

**Parallel groups:**
- Wave 1: Tasks 1 + 2 (no deps)
- Wave 2: Tasks 3 + 5 (depend on 1+2)
- Wave 3: Tasks 4 + 6 (depend on 3, 5)
- Wave 4: Task 7 (depends on 4+6)
- Wave 5: Task 8 (depends on 7)
- Wave 6: Tasks 9, 10, 11 (depend on 8, can be parallel if careful)
- Wave 7: Task 12 (depends on 8)
- Wave 8: Task 13 (depends on 3)

---

### Task 1: DrillAttempt + SkillProgress Database Models

**Files:**
- Modify: `backend/app/models/database.py`
- Create: `backend/tests/test_drill_models.py`

**Context:** Add two new SQLAlchemy models to the existing `database.py` which already has PIDRecord, PIDHistory, SessionRecord, RoundRecord, RoundCondensed, PlayerProfile, LeakRecord. Follow the same patterns (Column types, default lambdas for datetime).

- [ ] **Step 1: Write failing test for DrillAttempt model**

```python
# backend/tests/test_drill_models.py
import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, DrillAttempt, SkillProgress


test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


def test_create_drill_attempt():
    db = TestSession()
    attempt = DrillAttempt(
        skill="outs",
        scenario='{"hole_cards": ["Ah", "Kh"], "community_cards": ["2h", "7h", "Td"]}',
        correct_answer=9.0,
        user_answer=9.0,
        is_correct=1,
        response_time_ms=3200,
        source="random",
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    assert attempt.id is not None
    assert attempt.skill == "outs"
    assert attempt.user_id == "default"
    assert attempt.created_at is not None
    db.close()


def test_create_skill_progress():
    db = TestSession()
    progress = SkillProgress(
        skill="outs",
        status="active",
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    assert progress.id is not None
    assert progress.total_attempts == 0
    assert progress.correct_count == 0
    assert progress.current_accuracy == 0.0
    assert progress.streak_days == 0
    assert progress.graduated_at is None
    db.close()


def test_skill_progress_unique_per_user():
    db = TestSession()
    p1 = SkillProgress(skill="outs", user_id="default", status="active")
    db.add(p1)
    db.commit()
    # Same skill+user should violate unique constraint
    p2 = SkillProgress(skill="outs", user_id="default", status="active")
    db.add(p2)
    with pytest.raises(Exception):
        db.commit()
    db.rollback()
    db.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv/bin/python -m pytest tests/test_drill_models.py -v`
Expected: ImportError — `DrillAttempt` and `SkillProgress` don't exist yet

- [ ] **Step 3: Implement DrillAttempt and SkillProgress models**

Add to `backend/app/models/database.py` after the `LeakRecord` class:

```python
class DrillAttempt(Base):
    __tablename__ = "drill_attempts"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, default="default")
    skill = Column(String, nullable=False)
    scenario = Column(Text, nullable=False)
    correct_answer = Column(Float, nullable=False)
    user_answer = Column(Float, nullable=False)
    is_correct = Column(Integer, nullable=False, default=0)
    response_time_ms = Column(Integer, nullable=False, default=0)
    explanation = Column(Text, nullable=True)
    source = Column(String, nullable=False, default="random")
    session_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class SkillProgress(Base):
    __tablename__ = "skill_progress"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, default="default")
    skill = Column(String, nullable=False)
    total_attempts = Column(Integer, nullable=False, default=0)
    correct_count = Column(Integer, nullable=False, default=0)
    current_accuracy = Column(Float, nullable=False, default=0.0)
    status = Column(String, nullable=False, default="locked")
    streak_days = Column(Integer, nullable=False, default=0)
    last_attempt_date = Column(String, nullable=True)
    best_streak = Column(Integer, nullable=False, default=0)
    avg_response_time_ms = Column(Integer, nullable=False, default=0)
    graduated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
```

Also add a unique constraint. Add this import at the top of `database.py`:
```python
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, UniqueConstraint
```

And add to SkillProgress class:
```python
    __table_args__ = (UniqueConstraint("user_id", "skill", name="uq_user_skill"),)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv/bin/python -m pytest tests/test_drill_models.py -v`
Expected: 3 passed

- [ ] **Step 5: Run full backend test suite for regressions**

Run: `cd backend && venv/bin/python -m pytest -x -q`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/database.py backend/tests/test_drill_models.py
git commit -m "feat: add DrillAttempt and SkillProgress database models for training system"
```

---

### Task 2: Pydantic Request/Response Schemas for Drills

**Files:**
- Create: `backend/app/models/drill_schemas.py`

**Context:** Pydantic models for all drill API request/response shapes. These will be used by the drill router and session review router. Follow the project's pattern of Pydantic models for all API boundaries.

- [ ] **Step 1: Create schema file**

```python
# backend/app/models/drill_schemas.py
from __future__ import annotations

from pydantic import BaseModel, Field


# --- Skill definitions (constants) ---

SKILL_DEFINITIONS = {
    "outs": {
        "graduation_accuracy": 0.90,
        "required_attempts": 50,
        "tolerance": 0,
        "answer_type": "integer",
        "timer_seconds": 15,
        "order": 1,
    },
    "rule_of_2_4": {
        "graduation_accuracy": 0.85,
        "required_attempts": 50,
        "tolerance": 5.0,
        "answer_type": "percentage",
        "timer_seconds": 15,
        "order": 2,
    },
    "pot_odds": {
        "graduation_accuracy": 0.85,
        "required_attempts": 50,
        "tolerance": 2.0,
        "answer_type": "percentage",
        "timer_seconds": 15,
        "order": 3,
    },
    "the_decision": {
        "graduation_accuracy": 0.80,
        "required_attempts": 30,
        "tolerance": 0,
        "answer_type": "decision",
        "timer_seconds": 15,
        "order": 4,
    },
    "spr_commitment": {
        "graduation_accuracy": 0.80,
        "required_attempts": 30,
        "tolerance": 0.5,
        "answer_type": "decimal",
        "timer_seconds": 15,
        "order": 5,
    },
    "bluff_math": {
        "graduation_accuracy": 0.80,
        "required_attempts": 30,
        "tolerance": 3.0,
        "answer_type": "percentage",
        "timer_seconds": 15,
        "order": 6,
    },
}

SKILL_ORDER = ["outs", "rule_of_2_4", "pot_odds", "the_decision", "spr_commitment", "bluff_math"]


# --- Request schemas ---

class GenerateDrillRequest(BaseModel):
    skill: str = Field(..., description="One of: outs, rule_of_2_4, pot_odds, the_decision, spr_commitment, bluff_math")
    source: str = Field("random", description="'random' or 'history'")


class CheckDrillRequest(BaseModel):
    drill_id: str = Field(..., description="UUID of the pending drill")
    user_answer: float = Field(..., description="User's answer")
    response_time_ms: int = Field(..., description="Time taken in milliseconds")


class ReviewCheckRequest(BaseModel):
    hand_index: int
    question_index: int
    user_answer: float


# --- Response schemas ---

class GenerateDrillResponse(BaseModel):
    drill_id: str
    scenario: dict
    question_text: str
    answer_type: str


class CheckDrillResponse(BaseModel):
    is_correct: bool
    correct_answer: float
    explanation: str | None = None
    accuracy_now: float
    graduated: bool


class SkillProgressResponse(BaseModel):
    skill: str
    total_attempts: int
    correct_count: int
    current_accuracy: float
    status: str
    streak_days: int
    last_attempt_date: str | None = None
    best_streak: int
    avg_response_time_ms: int
    graduated_at: str | None = None


class DrillAttemptResponse(BaseModel):
    id: int
    skill: str
    is_correct: bool
    correct_answer: float
    user_answer: float
    response_time_ms: int
    source: str
    created_at: str | None = None


class FocusSuggestionResponse(BaseModel):
    suggested_skill: str
    reason: str


class ReviewQuestion(BaseModel):
    question_text: str
    correct_answer: float
    answer_type: str
    tolerance: float


class ReviewHand(BaseModel):
    round_number: int
    hole_cards: list[str]
    community_cards: list[str]
    pot_size: float
    bet_to_call: float
    result: str | None
    ev_gap: float
    questions: list[ReviewQuestion]


class SessionReviewResponse(BaseModel):
    hands: list[ReviewHand]


class ReviewCheckResponse(BaseModel):
    is_correct: bool
    correct_answer: float
    explanation: str | None = None
```

- [ ] **Step 2: Verify import works**

Run: `cd backend && venv/bin/python -c "from app.models.drill_schemas import SKILL_DEFINITIONS, SKILL_ORDER, GenerateDrillRequest; print('OK')"` 
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/drill_schemas.py
git commit -m "feat: add Pydantic schemas and skill definitions for drill system"
```

---

### Task 3: Drill Service (Scenario Generation + Answer Checking + Progress)

**Files:**
- Create: `backend/app/services/drill_service.py`
- Create: `backend/tests/test_drill_service.py`

**Context:** This is the core drill engine. It generates scenarios for each of the 6 skills using `poker_engine.py` functions, checks answers with skill-specific tolerances, and manages SkillProgress (including graduation detection and streak tracking). Pending drills are stored in a module-level dict keyed by UUID.

Key poker engine functions available in `backend/app/services/poker_engine.py`:
- `detect_outs(hole_cards, community_cards)` → `{"draws": [...], "total_outs": int, "outs_cards": [...]}`
- `rule_of_2_4(outs, street)` → float percentage
- `calculate_pot_odds(bet_to_call, pot_size)` → float percentage
- `calculate_ev(equity, pot_size, bet_to_call)` → float dollar value
- `calculate_spr(effective_stack, pot_size)` → float ratio
- `calculate_bluff_break_even(bluff_size, pot_size)` → float (0-1 decimal)
- `calculate_equity(hole_cards, community_cards, num_players, iterations)` → float (0-1)

Card format: 2-char strings like "Ah", "Td", "2c". Ranks: 2-9, T, J, Q, K, A. Suits: h, d, c, s.

**Important:** The drill service MUST NOT import or call `chat_with_ai` for explanations during answer checking. Explanations are generated asynchronously by the router layer after the check response is returned. The service is pure math + DB operations.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_drill_service.py
import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SkillProgress, DrillAttempt
from app.services.drill_service import (
    generate_drill,
    check_answer,
    get_all_progress,
    initialize_progress,
    get_drill_history,
    suggest_focus,
    _pending_drills,
)


test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    _pending_drills.clear()


def test_initialize_progress():
    db = TestSession()
    initialize_progress(db)
    progress = db.query(SkillProgress).all()
    assert len(progress) == 6
    outs_prog = db.query(SkillProgress).filter(SkillProgress.skill == "outs").first()
    assert outs_prog.status == "active"
    # All others should be locked
    locked = db.query(SkillProgress).filter(SkillProgress.status == "locked").all()
    assert len(locked) == 5
    db.close()


def test_initialize_progress_idempotent():
    db = TestSession()
    initialize_progress(db)
    initialize_progress(db)
    progress = db.query(SkillProgress).all()
    assert len(progress) == 6
    db.close()


def test_generate_outs_drill():
    db = TestSession()
    initialize_progress(db)
    result = generate_drill(db, "outs", "random")
    assert "drill_id" in result
    assert "scenario" in result
    assert "question_text" in result
    assert result["answer_type"] == "integer"
    assert "hole_cards" in result["scenario"]
    assert "community_cards" in result["scenario"]
    assert result["drill_id"] in _pending_drills
    db.close()


def test_generate_rule_of_2_4_drill():
    db = TestSession()
    initialize_progress(db)
    # Unlock rule_of_2_4 by setting outs to graduated
    outs_prog = db.query(SkillProgress).filter(SkillProgress.skill == "outs").first()
    outs_prog.status = "graduated"
    r24_prog = db.query(SkillProgress).filter(SkillProgress.skill == "rule_of_2_4").first()
    r24_prog.status = "active"
    db.commit()
    result = generate_drill(db, "rule_of_2_4", "random")
    assert result["answer_type"] == "percentage"
    db.close()


def test_generate_pot_odds_drill():
    db = TestSession()
    initialize_progress(db)
    pot_prog = db.query(SkillProgress).filter(SkillProgress.skill == "pot_odds").first()
    pot_prog.status = "active"
    db.commit()
    result = generate_drill(db, "pot_odds", "random")
    assert result["answer_type"] == "percentage"
    assert "pot_size" in result["scenario"]
    assert "bet_to_call" in result["scenario"]
    db.close()


def test_generate_the_decision_drill():
    db = TestSession()
    initialize_progress(db)
    dec_prog = db.query(SkillProgress).filter(SkillProgress.skill == "the_decision").first()
    dec_prog.status = "active"
    db.commit()
    result = generate_drill(db, "the_decision", "random")
    assert result["answer_type"] == "decision"
    db.close()


def test_generate_spr_commitment_drill():
    db = TestSession()
    initialize_progress(db)
    spr_prog = db.query(SkillProgress).filter(SkillProgress.skill == "spr_commitment").first()
    spr_prog.status = "active"
    db.commit()
    result = generate_drill(db, "spr_commitment", "random")
    assert result["answer_type"] == "decimal"
    assert "your_stack" in result["scenario"]
    db.close()


def test_generate_bluff_math_drill():
    db = TestSession()
    initialize_progress(db)
    bluff_prog = db.query(SkillProgress).filter(SkillProgress.skill == "bluff_math").first()
    bluff_prog.status = "active"
    db.commit()
    result = generate_drill(db, "bluff_math", "random")
    assert result["answer_type"] == "percentage"
    db.close()


def test_generate_locked_skill_raises():
    db = TestSession()
    initialize_progress(db)
    with pytest.raises(ValueError, match="locked"):
        generate_drill(db, "rule_of_2_4", "random")
    db.close()


def test_check_answer_correct_outs():
    db = TestSession()
    initialize_progress(db)
    drill = generate_drill(db, "outs", "random")
    correct = _pending_drills[drill["drill_id"]]["correct_answer"]
    result = check_answer(db, drill["drill_id"], correct, 3000)
    assert result["is_correct"] is True
    assert result["correct_answer"] == correct
    # Verify DrillAttempt was saved
    attempt = db.query(DrillAttempt).first()
    assert attempt is not None
    assert attempt.is_correct == 1
    # Verify SkillProgress updated
    prog = db.query(SkillProgress).filter(SkillProgress.skill == "outs").first()
    assert prog.total_attempts == 1
    assert prog.correct_count == 1
    db.close()


def test_check_answer_incorrect_outs():
    db = TestSession()
    initialize_progress(db)
    drill = generate_drill(db, "outs", "random")
    correct = _pending_drills[drill["drill_id"]]["correct_answer"]
    wrong = correct + 5
    result = check_answer(db, drill["drill_id"], wrong, 5000)
    assert result["is_correct"] is False
    prog = db.query(SkillProgress).filter(SkillProgress.skill == "outs").first()
    assert prog.total_attempts == 1
    assert prog.correct_count == 0
    db.close()


def test_check_answer_tolerance_pot_odds():
    db = TestSession()
    initialize_progress(db)
    pot_prog = db.query(SkillProgress).filter(SkillProgress.skill == "pot_odds").first()
    pot_prog.status = "active"
    db.commit()
    drill = generate_drill(db, "pot_odds", "random")
    correct = _pending_drills[drill["drill_id"]]["correct_answer"]
    # Within 2% tolerance
    result = check_answer(db, drill["drill_id"], correct + 1.5, 4000)
    assert result["is_correct"] is True
    db.close()


def test_check_answer_invalid_drill_id():
    db = TestSession()
    with pytest.raises(ValueError, match="not found"):
        check_answer(db, "nonexistent-id", 5.0, 3000)
    db.close()


def test_get_all_progress():
    db = TestSession()
    initialize_progress(db)
    progress = get_all_progress(db)
    assert len(progress) == 6
    assert progress[0]["skill"] == "outs"
    assert progress[0]["status"] == "active"
    db.close()


def test_get_drill_history():
    db = TestSession()
    initialize_progress(db)
    # Generate and check a few drills
    for _ in range(3):
        drill = generate_drill(db, "outs", "random")
        correct = _pending_drills[drill["drill_id"]]["correct_answer"]
        check_answer(db, drill["drill_id"], correct, 3000)
    history = get_drill_history(db, skill="outs", limit=10)
    assert len(history) == 3
    db.close()


def test_suggest_focus():
    db = TestSession()
    initialize_progress(db)
    suggestion = suggest_focus(db)
    assert suggestion["suggested_skill"] == "outs"
    assert len(suggestion["reason"]) > 0
    db.close()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv/bin/python -m pytest tests/test_drill_service.py -v`
Expected: ImportError — `drill_service` doesn't exist

- [ ] **Step 3: Implement drill_service.py**

```python
# backend/app/services/drill_service.py
from __future__ import annotations

import json
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import DrillAttempt, SkillProgress
from app.models.drill_schemas import SKILL_DEFINITIONS, SKILL_ORDER
from app.services.poker_engine import (
    detect_outs,
    rule_of_2_4,
    calculate_pot_odds,
    calculate_ev,
    calculate_equity,
    calculate_spr,
    calculate_bluff_break_even,
)

# Server-side pending drills: {drill_id: {skill, scenario, correct_answer, answer_type, question_text}}
_pending_drills: dict[str, dict] = {}

RANKS = list("23456789") + ["T", "J", "Q", "K", "A"]
SUITS = ["h", "d", "c", "s"]
ALL_CARDS = [r + s for r in RANKS for s in SUITS]


def _random_cards(count: int, exclude: list[str] | None = None) -> list[str]:
    """Pick `count` unique random cards from a 52-card deck, excluding any in `exclude`."""
    available = [c for c in ALL_CARDS if c not in (exclude or [])]
    return random.sample(available, count)


def initialize_progress(db: Session, user_id: str = "default") -> None:
    """Create SkillProgress rows for all 6 skills if they don't exist yet."""
    existing = {
        sp.skill
        for sp in db.query(SkillProgress).filter(SkillProgress.user_id == user_id).all()
    }
    for skill in SKILL_ORDER:
        if skill not in existing:
            status = "active" if skill == "outs" else "locked"
            db.add(SkillProgress(user_id=user_id, skill=skill, status=status))
    db.commit()


def _get_progress(db: Session, skill: str, user_id: str = "default") -> SkillProgress:
    return (
        db.query(SkillProgress)
        .filter(SkillProgress.user_id == user_id, SkillProgress.skill == skill)
        .first()
    )


# --- Scenario generators ---

def _generate_outs_scenario() -> dict:
    hole = _random_cards(2)
    community = _random_cards(random.choice([3, 4]), exclude=hole)
    outs_data = detect_outs(hole, community)
    correct = float(outs_data["total_outs"])
    street = "flop" if len(community) == 3 else "turn"
    return {
        "scenario": {"hole_cards": hole, "community_cards": community, "street": street},
        "question_text": f"How many outs do you have on the {street}?",
        "correct_answer": correct,
        "answer_type": "integer",
    }


def _generate_rule_of_2_4_scenario() -> dict:
    hole = _random_cards(2)
    community = _random_cards(random.choice([3, 4]), exclude=hole)
    outs_data = detect_outs(hole, community)
    total_outs = outs_data["total_outs"]
    street = "flop" if len(community) == 3 else "turn"
    correct = rule_of_2_4(total_outs, street)
    return {
        "scenario": {
            "hole_cards": hole,
            "community_cards": community,
            "street": street,
            "outs": total_outs,
        },
        "question_text": f"You have {total_outs} outs on the {street}. Using the Rule of {'4' if street == 'flop' else '2'}, estimate your equity (%).",
        "correct_answer": correct,
        "answer_type": "percentage",
    }


def _generate_pot_odds_scenario() -> dict:
    pot_size = float(random.randrange(20, 501, 10))
    bet_to_call = float(random.randrange(10, int(pot_size) + 1, 5))
    correct = calculate_pot_odds(bet_to_call, pot_size)
    return {
        "scenario": {"pot_size": pot_size, "bet_to_call": bet_to_call},
        "question_text": f"The pot is ${pot_size:.0f} and you must call ${bet_to_call:.0f}. What are your pot odds (%)?",
        "correct_answer": correct,
        "answer_type": "percentage",
    }


def _generate_the_decision_scenario() -> dict:
    hole = _random_cards(2)
    community = _random_cards(random.choice([3, 4, 5]), exclude=hole)
    pot_size = float(random.randrange(40, 501, 10))
    bet_to_call = float(random.randrange(10, int(pot_size) + 1, 5))
    equity = calculate_equity(hole, community, num_players=2, iterations=5000)
    pot_odds_pct = calculate_pot_odds(bet_to_call, pot_size)
    equity_pct = equity * 100
    # 1.0 = call, 0.0 = fold
    correct = 1.0 if equity_pct >= pot_odds_pct else 0.0
    street = "preflop" if len(community) == 0 else ("flop" if len(community) == 3 else ("turn" if len(community) == 4 else "river"))
    return {
        "scenario": {
            "hole_cards": hole,
            "community_cards": community,
            "pot_size": pot_size,
            "bet_to_call": bet_to_call,
            "street": street,
        },
        "question_text": f"Pot is ${pot_size:.0f}, bet to call is ${bet_to_call:.0f}. Should you call or fold?",
        "correct_answer": correct,
        "answer_type": "decision",
    }


def _generate_spr_commitment_scenario() -> dict:
    pot_size = float(random.randrange(20, 301, 10))
    your_stack = float(random.randrange(50, 1001, 25))
    correct = round(calculate_spr(your_stack, pot_size), 1)
    return {
        "scenario": {"pot_size": pot_size, "your_stack": your_stack},
        "question_text": f"The pot is ${pot_size:.0f} and your stack is ${your_stack:.0f}. What is the SPR?",
        "correct_answer": correct,
        "answer_type": "decimal",
    }


def _generate_bluff_math_scenario() -> dict:
    pot_size = float(random.randrange(30, 401, 10))
    bluff_size = float(random.randrange(15, int(pot_size * 1.5) + 1, 5))
    correct = round(calculate_bluff_break_even(bluff_size, pot_size) * 100, 1)
    return {
        "scenario": {"pot_size": pot_size, "bluff_size": bluff_size},
        "question_text": f"You bluff ${bluff_size:.0f} into a ${pot_size:.0f} pot. What fold frequency (%) do you need to break even?",
        "correct_answer": correct,
        "answer_type": "percentage",
    }


GENERATORS = {
    "outs": _generate_outs_scenario,
    "rule_of_2_4": _generate_rule_of_2_4_scenario,
    "pot_odds": _generate_pot_odds_scenario,
    "the_decision": _generate_the_decision_scenario,
    "spr_commitment": _generate_spr_commitment_scenario,
    "bluff_math": _generate_bluff_math_scenario,
}


def generate_drill(db: Session, skill: str, source: str = "random", user_id: str = "default") -> dict:
    """Generate a drill scenario. Returns {drill_id, scenario, question_text, answer_type}."""
    if skill not in SKILL_DEFINITIONS:
        raise ValueError(f"Unknown skill: {skill}")

    progress = _get_progress(db, skill, user_id)
    if progress and progress.status == "locked":
        raise ValueError(f"Skill '{skill}' is locked. Complete prerequisites first.")

    gen_fn = GENERATORS[skill]
    data = gen_fn()

    drill_id = str(uuid.uuid4())
    _pending_drills[drill_id] = {
        "skill": skill,
        "scenario": data["scenario"],
        "correct_answer": data["correct_answer"],
        "answer_type": data["answer_type"],
        "question_text": data["question_text"],
        "source": source,
        "user_id": user_id,
    }

    return {
        "drill_id": drill_id,
        "scenario": data["scenario"],
        "question_text": data["question_text"],
        "answer_type": data["answer_type"],
    }


def _check_within_tolerance(user_answer: float, correct_answer: float, skill: str) -> bool:
    """Check if user_answer is correct given the skill's tolerance."""
    tolerance = SKILL_DEFINITIONS[skill]["tolerance"]
    answer_type = SKILL_DEFINITIONS[skill]["answer_type"]

    if answer_type == "integer":
        return int(user_answer) == int(correct_answer)
    elif answer_type == "decision":
        return int(user_answer) == int(correct_answer)
    else:
        return abs(user_answer - correct_answer) <= tolerance


def _update_progress(
    db: Session, skill: str, is_correct: bool, response_time_ms: int, user_id: str = "default"
) -> dict:
    """Update SkillProgress after an attempt. Returns {accuracy_now, graduated}."""
    progress = _get_progress(db, skill, user_id)
    if not progress:
        initialize_progress(db, user_id)
        progress = _get_progress(db, skill, user_id)

    progress.total_attempts += 1
    if is_correct:
        progress.correct_count += 1

    progress.current_accuracy = progress.correct_count / progress.total_attempts

    # Rolling average response time
    prev_total = progress.avg_response_time_ms * (progress.total_attempts - 1)
    progress.avg_response_time_ms = int((prev_total + response_time_ms) / progress.total_attempts)

    # Streak tracking
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if progress.last_attempt_date != today:
        if progress.last_attempt_date:
            from datetime import timedelta
            yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
            if progress.last_attempt_date == yesterday:
                progress.streak_days += 1
            else:
                progress.streak_days = 1
        else:
            progress.streak_days = 1
        progress.last_attempt_date = today

    if progress.streak_days > progress.best_streak:
        progress.best_streak = progress.streak_days

    # Graduation check
    skill_def = SKILL_DEFINITIONS[skill]
    graduated = False
    if (
        progress.status == "active"
        and progress.total_attempts >= skill_def["required_attempts"]
        and progress.current_accuracy >= skill_def["graduation_accuracy"]
    ):
        progress.status = "graduated"
        progress.graduated_at = datetime.now(timezone.utc)
        graduated = True
        _unlock_next_skill(db, skill, user_id)

    db.commit()

    return {
        "accuracy_now": round(progress.current_accuracy * 100, 1),
        "graduated": graduated,
    }


def _unlock_next_skill(db: Session, graduated_skill: str, user_id: str = "default") -> None:
    """Unlock the next skill in order after graduation."""
    idx = SKILL_ORDER.index(graduated_skill)
    if idx + 1 < len(SKILL_ORDER):
        next_skill = SKILL_ORDER[idx + 1]
        # For the_decision (index 3), require all of 0-2 graduated
        if next_skill == "the_decision":
            prereqs = SKILL_ORDER[:3]
            all_graduated = all(
                _get_progress(db, s, user_id).status == "graduated" for s in prereqs
            )
            if not all_graduated:
                return
        next_prog = _get_progress(db, next_skill, user_id)
        if next_prog and next_prog.status == "locked":
            next_prog.status = "active"


def check_answer(db: Session, drill_id: str, user_answer: float, response_time_ms: int) -> dict:
    """Check a drill answer. Returns {is_correct, correct_answer, accuracy_now, graduated}."""
    if drill_id not in _pending_drills:
        raise ValueError(f"Drill '{drill_id}' not found or already answered")

    pending = _pending_drills.pop(drill_id)
    skill = pending["skill"]
    correct_answer = pending["correct_answer"]
    user_id = pending["user_id"]
    source = pending["source"]

    is_correct = _check_within_tolerance(user_answer, correct_answer, skill)

    # Save attempt
    attempt = DrillAttempt(
        user_id=user_id,
        skill=skill,
        scenario=json.dumps(pending["scenario"]),
        correct_answer=correct_answer,
        user_answer=user_answer,
        is_correct=1 if is_correct else 0,
        response_time_ms=response_time_ms,
        source=source,
    )
    db.add(attempt)
    db.commit()

    progress_result = _update_progress(db, skill, is_correct, response_time_ms, user_id)

    return {
        "is_correct": is_correct,
        "correct_answer": correct_answer,
        "explanation": None,
        "accuracy_now": progress_result["accuracy_now"],
        "graduated": progress_result["graduated"],
    }


def get_all_progress(db: Session, user_id: str = "default") -> list[dict]:
    """Get progress for all 6 skills, ordered by skill order."""
    initialize_progress(db, user_id)
    rows = db.query(SkillProgress).filter(SkillProgress.user_id == user_id).all()
    by_skill = {r.skill: r for r in rows}

    result = []
    for skill in SKILL_ORDER:
        r = by_skill.get(skill)
        if r:
            result.append({
                "skill": r.skill,
                "total_attempts": r.total_attempts,
                "correct_count": r.correct_count,
                "current_accuracy": round(r.current_accuracy * 100, 1),
                "status": r.status,
                "streak_days": r.streak_days,
                "last_attempt_date": r.last_attempt_date,
                "best_streak": r.best_streak,
                "avg_response_time_ms": r.avg_response_time_ms,
                "graduated_at": r.graduated_at.isoformat() if r.graduated_at else None,
            })
    return result


def get_drill_history(
    db: Session, skill: str | None = None, limit: int = 50, user_id: str = "default"
) -> list[dict]:
    """Get recent drill attempts, optionally filtered by skill."""
    query = db.query(DrillAttempt).filter(DrillAttempt.user_id == user_id)
    if skill:
        query = query.filter(DrillAttempt.skill == skill)
    rows = query.order_by(DrillAttempt.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "skill": r.skill,
            "is_correct": bool(r.is_correct),
            "correct_answer": r.correct_answer,
            "user_answer": r.user_answer,
            "response_time_ms": r.response_time_ms,
            "source": r.source,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


def suggest_focus(db: Session, user_id: str = "default") -> dict:
    """Suggest which skill to practice next."""
    initialize_progress(db, user_id)
    rows = db.query(SkillProgress).filter(SkillProgress.user_id == user_id).all()
    by_skill = {r.skill: r for r in rows}

    # Priority: active skills with lowest accuracy, then most recently unlocked
    active_skills = [s for s in SKILL_ORDER if by_skill.get(s) and by_skill[s].status == "active"]

    if not active_skills:
        return {"suggested_skill": "outs", "reason": "All skills graduated! Keep practicing outs to stay sharp."}

    # Lowest accuracy active skill
    worst = min(active_skills, key=lambda s: by_skill[s].current_accuracy)
    prog = by_skill[worst]

    if prog.total_attempts == 0:
        reason = f"Start practicing {worst.replace('_', ' ')} — it's unlocked and ready!"
    else:
        reason = f"Your {worst.replace('_', ' ')} accuracy is {prog.current_accuracy * 100:.0f}% — needs work to reach graduation."

    return {"suggested_skill": worst, "reason": reason}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && venv/bin/python -m pytest tests/test_drill_service.py -v`
Expected: All tests pass

- [ ] **Step 5: Run full backend test suite**

Run: `cd backend && venv/bin/python -m pytest -x -q`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/drill_service.py backend/tests/test_drill_service.py
git commit -m "feat: implement drill service with 6 skill generators, answer checking, and progress tracking"
```

---

### Task 4: Drill Router (REST API)

**Files:**
- Create: `backend/app/routers/drills.py`
- Create: `backend/tests/test_drill_router.py`
- Modify: `backend/app/main.py` (register router)

**Context:** REST endpoints for drill generation, answer checking, progress, history, and focus suggestion. Uses the drill service from Task 3. The router also handles async AI explanation generation after check (non-blocking — returns check result immediately, explanation is included if it arrives).

The existing test pattern uses module-level `TestClient`, `StaticPool` engine, and `autouse=True` fixture. See `backend/tests/test_leak_router.py` for the exact pattern.

Register the router in `backend/app/main.py` alongside existing routers.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_drill_router.py
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
    # Clear pending drills between tests
    from app.services.drill_service import _pending_drills
    _pending_drills.clear()


client = TestClient(app)


def test_get_progress():
    resp = client.get("/api/drills/progress")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 6
    assert data[0]["skill"] == "outs"
    assert data[0]["status"] == "active"


def test_generate_drill():
    resp = client.post("/api/drills/generate", json={"skill": "outs", "source": "random"})
    assert resp.status_code == 200
    data = resp.json()
    assert "drill_id" in data
    assert "scenario" in data
    assert "question_text" in data
    assert data["answer_type"] == "integer"


def test_generate_locked_skill():
    resp = client.post("/api/drills/generate", json={"skill": "rule_of_2_4", "source": "random"})
    assert resp.status_code == 400


def test_check_drill():
    # Generate first
    gen_resp = client.post("/api/drills/generate", json={"skill": "outs", "source": "random"})
    drill_id = gen_resp.json()["drill_id"]

    # We don't know the correct answer, but we can check any answer
    check_resp = client.post("/api/drills/check", json={
        "drill_id": drill_id,
        "user_answer": 0,
        "response_time_ms": 3000,
    })
    assert check_resp.status_code == 200
    data = check_resp.json()
    assert "is_correct" in data
    assert "correct_answer" in data
    assert "accuracy_now" in data
    assert "graduated" in data


def test_check_invalid_drill_id():
    resp = client.post("/api/drills/check", json={
        "drill_id": "nonexistent",
        "user_answer": 5,
        "response_time_ms": 3000,
    })
    assert resp.status_code == 400


def test_drill_history():
    # Generate and check a drill first
    gen_resp = client.post("/api/drills/generate", json={"skill": "outs", "source": "random"})
    drill_id = gen_resp.json()["drill_id"]
    client.post("/api/drills/check", json={
        "drill_id": drill_id,
        "user_answer": 5,
        "response_time_ms": 3000,
    })

    resp = client.get("/api/drills/history?skill=outs&limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1


def test_focus_suggestion():
    resp = client.get("/api/drills/focus")
    assert resp.status_code == 200
    data = resp.json()
    assert "suggested_skill" in data
    assert "reason" in data
```

- [ ] **Step 2: Implement drills router**

```python
# backend/app/routers/drills.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.drill_schemas import (
    GenerateDrillRequest,
    CheckDrillRequest,
)
from app.services.drill_service import (
    generate_drill,
    check_answer,
    get_all_progress,
    get_drill_history,
    suggest_focus,
)

router = APIRouter()


@router.get("/api/drills/progress")
def get_progress(db: Session = Depends(get_db)):
    return get_all_progress(db)


@router.post("/api/drills/generate")
def generate(body: GenerateDrillRequest, db: Session = Depends(get_db)):
    try:
        return generate_drill(db, body.skill, body.source)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/drills/check")
def check(body: CheckDrillRequest, db: Session = Depends(get_db)):
    try:
        return check_answer(db, body.drill_id, body.user_answer, body.response_time_ms)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/drills/history")
def history(skill: str | None = None, limit: int = 50, db: Session = Depends(get_db)):
    return get_drill_history(db, skill=skill, limit=limit)


@router.get("/api/drills/focus")
def focus(db: Session = Depends(get_db)):
    return suggest_focus(db)
```

- [ ] **Step 3: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.drills import router as drills_router
```
And:
```python
app.include_router(drills_router)
```

- [ ] **Step 4: Run tests**

Run: `cd backend && venv/bin/python -m pytest tests/test_drill_router.py -v`
Expected: All pass

- [ ] **Step 5: Run full backend test suite**

Run: `cd backend && venv/bin/python -m pytest -x -q`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/drills.py backend/tests/test_drill_router.py backend/app/main.py
git commit -m "feat: add drill REST API with generate, check, progress, history, and focus endpoints"
```

---

### Task 5: Session Review Service

**Files:**
- Create: `backend/app/services/review_service.py`
- Create: `backend/tests/test_review_service.py`

**Context:** Pulls rounds from a session, finds the top 3 EV-gap hands, generates 4 Socratic questions per hand using `poker_engine.py`. No AI needed for question generation — it's all deterministic math.

Uses `round_service.list_rounds(db, session_id)` to get `RoundRecord` objects. Each has: `hole_cards` (JSON string of list), `community_cards` (JSON string of list), `pot_size`, `result`, `profit`, `streets` (JSON string), `position`.

The round records store `pot_size` but not `bet_to_call` directly. For the review, we'll need to derive or estimate bet_to_call. Strategy: use `pot_size * 0.5` as a reasonable estimate when no street data is available, or parse from streets JSON if present.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_review_service.py
import json
import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, RoundRecord, SessionRecord
from app.services.review_service import generate_session_review, check_review_answer


test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


def _create_session_with_rounds(db, rounds_data):
    """Helper to create a session with round records."""
    session_rec = SessionRecord(user_id="default", is_active=0, total_rounds=len(rounds_data))
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)

    for i, rd in enumerate(rounds_data):
        round_rec = RoundRecord(
            session_id=session_rec.id,
            round_number=i + 1,
            hole_cards=json.dumps(rd["hole_cards"]),
            community_cards=json.dumps(rd["community_cards"]),
            num_players=rd.get("num_players", 2),
            position=rd.get("position"),
            pot_size=rd["pot_size"],
            result=rd.get("result", "lost"),
            profit=rd.get("profit", 0.0),
        )
        db.add(round_rec)
    db.commit()
    return session_rec.id


def test_generate_review_with_rounds():
    db = TestSession()
    rounds = [
        {"hole_cards": ["Ah", "Kh"], "community_cards": ["2h", "7h", "Td"], "pot_size": 100, "result": "lost", "profit": -50},
        {"hole_cards": ["Qc", "Qd"], "community_cards": ["2s", "5d", "8c"], "pot_size": 80, "result": "won", "profit": 80},
        {"hole_cards": ["9s", "8s"], "community_cards": ["7s", "6d", "2c"], "pot_size": 60, "result": "lost", "profit": -30},
        {"hole_cards": ["Ac", "Td"], "community_cards": ["3h", "4d", "Js"], "pot_size": 120, "result": "lost", "profit": -60},
    ]
    session_id = _create_session_with_rounds(db, rounds)
    review = generate_session_review(db, session_id)

    assert "hands" in review
    assert len(review["hands"]) <= 3
    for hand in review["hands"]:
        assert "questions" in hand
        assert len(hand["questions"]) == 4
        assert "hole_cards" in hand
        assert "community_cards" in hand
        assert "ev_gap" in hand
    db.close()


def test_generate_review_empty_session():
    db = TestSession()
    session_rec = SessionRecord(user_id="default", is_active=0, total_rounds=0)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)
    review = generate_session_review(db, session_rec.id)
    assert review["hands"] == []
    db.close()


def test_review_questions_have_correct_types():
    db = TestSession()
    rounds = [
        {"hole_cards": ["Ah", "Kh"], "community_cards": ["2h", "7h", "Td"], "pot_size": 100, "result": "lost", "profit": -50},
    ]
    session_id = _create_session_with_rounds(db, rounds)
    review = generate_session_review(db, session_id)

    if review["hands"]:
        questions = review["hands"][0]["questions"]
        # Q1: outs (integer), Q2: equity (percentage), Q3: pot odds (percentage), Q4: decision (decision)
        assert questions[0]["answer_type"] == "integer"
        assert questions[1]["answer_type"] == "percentage"
        assert questions[2]["answer_type"] == "percentage"
        assert questions[3]["answer_type"] == "decision"
    db.close()


def test_check_review_answer():
    result = check_review_answer(
        correct_answer=9.0,
        user_answer=9.0,
        answer_type="integer",
        tolerance=0.0,
    )
    assert result["is_correct"] is True


def test_check_review_answer_with_tolerance():
    result = check_review_answer(
        correct_answer=33.3,
        user_answer=34.0,
        answer_type="percentage",
        tolerance=2.0,
    )
    assert result["is_correct"] is True


def test_check_review_answer_wrong():
    result = check_review_answer(
        correct_answer=9.0,
        user_answer=5.0,
        answer_type="integer",
        tolerance=0.0,
    )
    assert result["is_correct"] is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv/bin/python -m pytest tests/test_review_service.py -v`
Expected: ImportError

- [ ] **Step 3: Implement review_service.py**

```python
# backend/app/services/review_service.py
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.database import RoundRecord
from app.services.poker_engine import (
    detect_outs,
    rule_of_2_4,
    calculate_pot_odds,
    calculate_equity,
    calculate_ev,
)


def _estimate_bet_to_call(pot_size: float, streets_json: str) -> float:
    """Estimate bet_to_call from streets data or default to pot_size * 0.5."""
    try:
        streets = json.loads(streets_json) if streets_json else []
        if streets and isinstance(streets, list):
            last_street = streets[-1]
            if isinstance(last_street, dict) and "bet_to_call" in last_street:
                return float(last_street["bet_to_call"])
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return round(pot_size * 0.5, 2)


def _analyze_round(round_rec: RoundRecord) -> dict | None:
    """Analyze a single round for EV gap. Returns None if insufficient data."""
    try:
        hole_cards = json.loads(round_rec.hole_cards)
        community_cards = json.loads(round_rec.community_cards)
    except (json.JSONDecodeError, TypeError):
        return None

    if len(hole_cards) < 2 or len(community_cards) < 3:
        return None

    pot_size = round_rec.pot_size
    if pot_size <= 0:
        return None

    bet_to_call = _estimate_bet_to_call(pot_size, round_rec.streets)

    equity = calculate_equity(hole_cards, community_cards, num_players=2, iterations=5000)
    ev = calculate_ev(equity, pot_size, bet_to_call)
    pot_odds_pct = calculate_pot_odds(bet_to_call, pot_size)
    equity_pct = equity * 100

    optimal_action = "call" if equity_pct >= pot_odds_pct else "fold"
    actual_action = round_rec.result if round_rec.result in ("won", "lost") else "fold"

    # EV gap: how much EV was left on the table
    if optimal_action == "fold" and actual_action != "folded":
        ev_gap = abs(ev)
    elif optimal_action == "call" and round_rec.result == "folded":
        ev_gap = abs(ev)
    else:
        ev_gap = 0.0

    return {
        "round_number": round_rec.round_number,
        "hole_cards": hole_cards,
        "community_cards": community_cards,
        "pot_size": pot_size,
        "bet_to_call": bet_to_call,
        "result": round_rec.result,
        "equity": equity,
        "ev": ev,
        "pot_odds_pct": pot_odds_pct,
        "ev_gap": round(ev_gap, 2),
    }


def _generate_questions(analysis: dict) -> list[dict]:
    """Generate 4 Socratic questions for a reviewed hand."""
    hole_cards = analysis["hole_cards"]
    community_cards = analysis["community_cards"]
    pot_size = analysis["pot_size"]
    bet_to_call = analysis["bet_to_call"]

    # Q1: Outs
    outs_data = detect_outs(hole_cards, community_cards)
    total_outs = outs_data["total_outs"]

    # Q2: Equity via rule of 2&4
    street = "flop" if len(community_cards) == 3 else "turn"
    equity_estimate = rule_of_2_4(total_outs, street)

    # Q3: Pot odds
    pot_odds = calculate_pot_odds(bet_to_call, pot_size)

    # Q4: Decision
    decision = 1.0 if analysis["equity"] * 100 >= pot_odds else 0.0

    return [
        {
            "question_text": "How many outs do you have?",
            "correct_answer": float(total_outs),
            "answer_type": "integer",
            "tolerance": 0.0,
        },
        {
            "question_text": f"Using the Rule of {'4' if street == 'flop' else '2'}, estimate your equity (%).",
            "correct_answer": equity_estimate,
            "answer_type": "percentage",
            "tolerance": 5.0,
        },
        {
            "question_text": "What are the pot odds (%)?",
            "correct_answer": pot_odds,
            "answer_type": "percentage",
            "tolerance": 2.0,
        },
        {
            "question_text": "Should you call or fold?",
            "correct_answer": decision,
            "answer_type": "decision",
            "tolerance": 0.0,
        },
    ]


def generate_session_review(db: Session, session_id: int) -> dict:
    """Generate a session review with top 3 EV-gap hands and Socratic questions."""
    rounds = (
        db.query(RoundRecord)
        .filter(RoundRecord.session_id == session_id)
        .order_by(RoundRecord.round_number)
        .all()
    )

    analyses = []
    for r in rounds:
        analysis = _analyze_round(r)
        if analysis:
            analyses.append(analysis)

    # Sort by EV gap descending, take top 3
    analyses.sort(key=lambda a: a["ev_gap"], reverse=True)
    top_hands = analyses[:3]

    hands = []
    for a in top_hands:
        questions = _generate_questions(a)
        hands.append({
            "round_number": a["round_number"],
            "hole_cards": a["hole_cards"],
            "community_cards": a["community_cards"],
            "pot_size": a["pot_size"],
            "bet_to_call": a["bet_to_call"],
            "result": a["result"],
            "ev_gap": a["ev_gap"],
            "questions": questions,
        })

    return {"hands": hands}


def check_review_answer(
    correct_answer: float, user_answer: float, answer_type: str, tolerance: float
) -> dict:
    """Check a review question answer."""
    if answer_type == "integer":
        is_correct = int(user_answer) == int(correct_answer)
    elif answer_type == "decision":
        is_correct = int(user_answer) == int(correct_answer)
    else:
        is_correct = abs(user_answer - correct_answer) <= tolerance

    return {
        "is_correct": is_correct,
        "correct_answer": correct_answer,
        "explanation": None,
    }
```

- [ ] **Step 4: Run tests**

Run: `cd backend && venv/bin/python -m pytest tests/test_review_service.py -v`
Expected: All pass

- [ ] **Step 5: Run full suite**

Run: `cd backend && venv/bin/python -m pytest -x -q`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/review_service.py backend/tests/test_review_service.py
git commit -m "feat: add session review service with EV-gap analysis and Socratic questions"
```

---

### Task 6: Session Review Router

**Files:**
- Create: `backend/tests/test_review_router.py`
- Modify: `backend/app/routers/sessions.py` (add review endpoints)

**Context:** Add two endpoints to the existing sessions router: `POST /api/sessions/{id}/review` and `POST /api/sessions/{id}/review/check`. The review data is ephemeral (not persisted).

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_review_router.py
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
            session_id=sid,
            round_number=i + 1,
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
    assert "is_correct" in data
```

- [ ] **Step 2: Implement review endpoints in sessions router**

Add to `backend/app/routers/sessions.py`:

Import at top:
```python
from app.services.review_service import generate_session_review, check_review_answer
from pydantic import BaseModel
```

Add a request model and two endpoints:
```python
class ReviewCheckBody(BaseModel):
    hand_index: int
    question_index: int
    correct_answer: float
    user_answer: float
    answer_type: str
    tolerance: float


@router.post("/api/sessions/{session_id}/review")
def review_session(session_id: int, db: Session = Depends(get_db)):
    session_rec = get_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    return generate_session_review(db, session_id)


@router.post("/api/sessions/{session_id}/review/check")
def check_review(session_id: int, body: ReviewCheckBody, db: Session = Depends(get_db)):
    return check_review_answer(
        correct_answer=body.correct_answer,
        user_answer=body.user_answer,
        answer_type=body.answer_type,
        tolerance=body.tolerance,
    )
```

- [ ] **Step 3: Run tests**

Run: `cd backend && venv/bin/python -m pytest tests/test_review_router.py -v`
Expected: All pass

- [ ] **Step 4: Run full suite**

Run: `cd backend && venv/bin/python -m pytest -x -q`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/sessions.py backend/tests/test_review_router.py
git commit -m "feat: add session review endpoints for Socratic hand analysis"
```

---

### Task 7: Frontend TypeScript Types + API Hooks

**Files:**
- Modify: `frontend/src/types.ts` (add training types + update TabId)
- Create: `frontend/src/hooks/useTraining.ts`

**Context:** Add TypeScript interfaces matching the backend drill schemas, and a hook that wraps all drill/review API calls. Follow the exact pattern of `frontend/src/hooks/useLeaks.ts` (useState + useCallback + useEffect). The hook should NOT use Zustand — it returns data and functions directly. The Zustand store (Task 8) will consume this hook's data.

Update `TabId` type to include `"training"`.

- [ ] **Step 1: Add training types to types.ts**

Add to `frontend/src/types.ts`:

Update TabId:
```typescript
export type TabId = "calculator" | "players" | "myGame" | "training";
```

Add new interfaces:
```typescript
export interface DrillScenario {
  hole_cards?: string[];
  community_cards?: string[];
  street?: string;
  outs?: number;
  pot_size?: number;
  bet_to_call?: number;
  your_stack?: number;
  bluff_size?: number;
}

export interface PendingDrill {
  drill_id: string;
  scenario: DrillScenario;
  question_text: string;
  answer_type: string;
}

export interface DrillCheckResult {
  is_correct: boolean;
  correct_answer: number;
  explanation: string | null;
  accuracy_now: number;
  graduated: boolean;
}

export interface SkillProgressData {
  skill: string;
  total_attempts: number;
  correct_count: number;
  current_accuracy: number;
  status: string;
  streak_days: number;
  last_attempt_date: string | null;
  best_streak: number;
  avg_response_time_ms: number;
  graduated_at: string | null;
}

export interface DrillAttemptData {
  id: number;
  skill: string;
  is_correct: boolean;
  correct_answer: number;
  user_answer: number;
  response_time_ms: number;
  source: string;
  created_at: string | null;
}

export interface FocusSuggestion {
  suggested_skill: string;
  reason: string;
}

export interface ReviewQuestion {
  question_text: string;
  correct_answer: number;
  answer_type: string;
  tolerance: number;
}

export interface ReviewHand {
  round_number: number;
  hole_cards: string[];
  community_cards: string[];
  pot_size: number;
  bet_to_call: number;
  result: string | null;
  ev_gap: number;
  questions: ReviewQuestion[];
}

export interface SessionReview {
  hands: ReviewHand[];
}

export interface ReviewCheckResult {
  is_correct: boolean;
  correct_answer: number;
  explanation: string | null;
}
```

- [ ] **Step 2: Create useTraining hook**

```typescript
// frontend/src/hooks/useTraining.ts
import { useState, useCallback } from "react";
import type {
  PendingDrill,
  DrillCheckResult,
  SkillProgressData,
  DrillAttemptData,
  FocusSuggestion,
  SessionReview,
  ReviewCheckResult,
} from "../types";

export function useTraining() {
  const [skillProgress, setSkillProgress] = useState<SkillProgressData[]>([]);
  const [drillHistory, setDrillHistory] = useState<DrillAttemptData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch("/api/drills/progress");
      if (!resp.ok) throw new Error("Failed to fetch progress");
      const data = await resp.json();
      setSkillProgress(data);
      return data as SkillProgressData[];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateDrill = useCallback(async (skill: string, source: string = "random"): Promise<PendingDrill> => {
    const resp = await fetch("/api/drills/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill, source }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || "Failed to generate drill");
    }
    return resp.json();
  }, []);

  const checkDrill = useCallback(async (
    drillId: string,
    userAnswer: number,
    responseTimeMs: number,
  ): Promise<DrillCheckResult> => {
    const resp = await fetch("/api/drills/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drill_id: drillId,
        user_answer: userAnswer,
        response_time_ms: responseTimeMs,
      }),
    });
    if (!resp.ok) throw new Error("Failed to check drill");
    return resp.json();
  }, []);

  const fetchHistory = useCallback(async (skill?: string, limit: number = 20) => {
    const params = new URLSearchParams();
    if (skill) params.set("skill", skill);
    params.set("limit", String(limit));
    const resp = await fetch(`/api/drills/history?${params}`);
    if (!resp.ok) throw new Error("Failed to fetch history");
    const data = await resp.json();
    setDrillHistory(data);
    return data as DrillAttemptData[];
  }, []);

  const fetchFocus = useCallback(async (): Promise<FocusSuggestion> => {
    const resp = await fetch("/api/drills/focus");
    if (!resp.ok) throw new Error("Failed to fetch focus");
    return resp.json();
  }, []);

  const generateReview = useCallback(async (sessionId: number): Promise<SessionReview> => {
    const resp = await fetch(`/api/sessions/${sessionId}/review`, { method: "POST" });
    if (!resp.ok) throw new Error("Failed to generate review");
    return resp.json();
  }, []);

  const checkReviewAnswer = useCallback(async (
    sessionId: number,
    handIndex: number,
    questionIndex: number,
    correctAnswer: number,
    userAnswer: number,
    answerType: string,
    tolerance: number,
  ): Promise<ReviewCheckResult> => {
    const resp = await fetch(`/api/sessions/${sessionId}/review/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hand_index: handIndex,
        question_index: questionIndex,
        correct_answer: correctAnswer,
        user_answer: userAnswer,
        answer_type: answerType,
        tolerance: tolerance,
      }),
    });
    if (!resp.ok) throw new Error("Failed to check review answer");
    return resp.json();
  }, []);

  return {
    skillProgress,
    drillHistory,
    isLoading,
    fetchProgress,
    generateDrill,
    checkDrill,
    fetchHistory,
    fetchFocus,
    generateReview,
    checkReviewAnswer,
  };
}
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/hooks/useTraining.ts
git commit -m "feat: add training TypeScript types and useTraining API hook"
```

---

### Task 8: Training Zustand Store

**Files:**
- Create: `frontend/src/store/trainingStore.ts`

**Context:** Zustand store managing drill state, timer, speed mode, and mental math mode. Follows the pattern in `frontend/src/store/navigationStore.ts` (simple create with set). The store is thin — business logic lives in the hook and components.

- [ ] **Step 1: Create trainingStore.ts**

```typescript
// frontend/src/store/trainingStore.ts
import { create } from "zustand";
import type { PendingDrill, SkillProgressData, DrillAttemptData, DrillCheckResult } from "../types";

interface TrainingStore {
  currentDrill: PendingDrill | null;
  lastResult: DrillCheckResult | null;
  skillProgress: SkillProgressData[];
  drillHistory: DrillAttemptData[];
  isGenerating: boolean;
  isChecking: boolean;
  speedMode: boolean;
  timerActive: boolean;
  timerRemaining: number;
  mentalMathMode: boolean;
  selectedSkill: string;
  drillSource: string;

  setCurrentDrill: (drill: PendingDrill | null) => void;
  setLastResult: (result: DrillCheckResult | null) => void;
  setSkillProgress: (progress: SkillProgressData[]) => void;
  setDrillHistory: (history: DrillAttemptData[]) => void;
  setIsGenerating: (v: boolean) => void;
  setIsChecking: (v: boolean) => void;
  setSpeedMode: (v: boolean) => void;
  setTimerActive: (v: boolean) => void;
  setTimerRemaining: (v: number) => void;
  setMentalMathMode: (v: boolean) => void;
  setSelectedSkill: (skill: string) => void;
  setDrillSource: (source: string) => void;
  graduatedSkills: () => Set<string>;
}

export const useTrainingStore = create<TrainingStore>((set, get) => ({
  currentDrill: null,
  lastResult: null,
  skillProgress: [],
  drillHistory: [],
  isGenerating: false,
  isChecking: false,
  speedMode: false,
  timerActive: false,
  timerRemaining: 15,
  mentalMathMode: false,
  selectedSkill: "outs",
  drillSource: "random",

  setCurrentDrill: (drill) => set({ currentDrill: drill, lastResult: null }),
  setLastResult: (result) => set({ lastResult: result }),
  setSkillProgress: (progress) => set({ skillProgress: progress }),
  setDrillHistory: (history) => set({ drillHistory: history }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsChecking: (v) => set({ isChecking: v }),
  setSpeedMode: (v) => set({ speedMode: v }),
  setTimerActive: (v) => set({ timerActive: v }),
  setTimerRemaining: (v) => set({ timerRemaining: v }),
  setMentalMathMode: (v) => set({ mentalMathMode: v }),
  setSelectedSkill: (skill) => set({ selectedSkill: skill }),
  setDrillSource: (source) => set({ drillSource: source }),
  graduatedSkills: () => {
    const progress = get().skillProgress;
    return new Set(progress.filter((p) => p.status === "graduated").map((p) => p.skill));
  },
}));
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/trainingStore.ts
git commit -m "feat: add training Zustand store for drill state and mental math mode"
```

---

### Task 9: Training Page + Drill Runner UI

**Files:**
- Create: `frontend/src/pages/TrainingPage.tsx`
- Modify: `frontend/src/App.tsx` (add Training tab + import)

**Context:** Main Training page with the Drill Runner section at top. Other sections (graduation tracker, session reviews, drill history) are separate components added in Tasks 10 and 11.

Design tokens from spec:
- Correct feedback: `text-emerald-400` / `bg-emerald-900`
- Incorrect feedback: `text-red-400` / `bg-red-900`
- Card visuals: hole cards `bg-gold-700`, community cards `bg-emerald-900`
- Gold primary button: `bg-gold text-stone-900 hover:bg-gold-400`
- Timer bar: gradient gold to red, `h-1 rounded-full`
- Speed mode toggle: clock icon

Display cards using the `SUIT_SYMBOLS` and `SUIT_COLORS` from `frontend/src/utils/cardUtils.ts` (already exists).

Follow the component patterns from `PlayersPage.tsx` and `MyGamePage.tsx` — functional components with hooks, Tailwind styling, gold/stone theme.

- [ ] **Step 1: Create TrainingPage.tsx with drill runner**

The file should export `TrainingPage` as the main component. It includes:
- Skill selector chips (horizontal)
- Source toggle (Random / From History)
- Speed mode toggle
- Scenario display with card visuals
- Question text and answer input
- Timer bar (when speed mode active)
- Submit button
- Feedback display (correct/incorrect + explanation)
- "Next Drill" button

Import and use `useTraining` hook for API calls and `useTrainingStore` for state. Use `useEffect` to fetch progress on mount.

For the call/fold answer type (`the_decision`), render two toggle buttons instead of a numeric input.

Timer: use `useEffect` with `setInterval` when speed mode is on and a drill is active. Count down from 15. Auto-submit with user_answer=−1 when timer hits 0.

- [ ] **Step 2: Add Training tab to App.tsx**

In `frontend/src/App.tsx`:
- Add import: `import { TrainingPage } from "./pages/TrainingPage";`
- Add to TABS array: `{ id: "training", label: "Training" }`
- Add case to MainContent switch: `case "training": return <TrainingPage />;`

- [ ] **Step 3: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/TrainingPage.tsx frontend/src/App.tsx
git commit -m "feat: add Training page with drill runner UI"
```

---

### Task 10: Graduation Tracker + Drill History UI

**Files:**
- Modify: `frontend/src/pages/TrainingPage.tsx` (add GraduationTracker and DrillHistory sections)

**Context:** Two more sections on the Training page below the drill runner.

**Graduation Tracker:**
- One row per skill, in skill order
- Each row: skill name (readable), progress bar (`h-2 rounded-full`), accuracy in `font-mono`, status badge
- Status badges: graduated = `bg-emerald-800 text-emerald-200`, active = `bg-gold-700 text-stone-100`, locked = `bg-surface-raised text-stone-500`
- Accuracy colored: green if >= threshold, amber if close, red if below
- Streak: flame emoji + days in `font-mono text-amber-400`
- Progress bar fill: `bg-gold`, track: `bg-surface-raised`

**Drill History:**
- Collapsible section (default collapsed), recent 20 attempts
- Each row: skill name, correct/incorrect badge, response time, date
- Correct badge: `bg-emerald-900 text-emerald-200`, incorrect: `bg-red-900 text-red-200`

- [ ] **Step 1: Add GraduationTracker and DrillHistory components to TrainingPage.tsx**

These are internal components within the same file. Export remains `TrainingPage`.

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TrainingPage.tsx
git commit -m "feat: add graduation tracker and drill history sections to Training page"
```

---

### Task 11: Session Review UI

**Files:**
- Modify: `frontend/src/pages/TrainingPage.tsx` (add SessionReviewSection)

**Context:** Section 3 on the Training page. Lists past sessions, allows reviewing them with step-through Socratic questions.

Needs to fetch session list from `GET /api/sessions` (existing endpoint). For each session, show date, rounds played, "Review" button.

Active review flow:
1. Click "Review" → POST `/api/sessions/{id}/review` → get hands with questions
2. Show one hand at a time with scenario
3. Show one question at a time, user answers
4. On answer, POST check to get is_correct + correct_answer
5. Show feedback, then "Next Question" button
6. After 4 questions per hand: "Next Hand" or "See Summary"
7. Summary: recap of all hands with correct/incorrect per question

Uses `useTraining().generateReview()` and `useTraining().checkReviewAnswer()`.

- [ ] **Step 1: Add SessionReviewSection component to TrainingPage.tsx**

Internal component. Fetches sessions via `fetch("/api/sessions")` in a local `useEffect`. Review state managed with local `useState`.

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TrainingPage.tsx
git commit -m "feat: add session review UI with Socratic hand analysis"
```

---

### Task 12: Tap-to-Reveal in ResultsPanel

**Files:**
- Modify: `frontend/src/components/ResultsPanel.tsx`

**Context:** When `mentalMathMode` is true and a metric's corresponding skill is graduated, blur the value and show "Calculate first". On click/tap, reveal with a 200ms transition.

Metric → skill mapping:
- Outs count → `outs`
- Rule of 2 & 4 → `rule_of_2_4`
- Pot odds → `pot_odds`
- Equity Required → `pot_odds` (same skill)
- EV / recommendation → `the_decision`
- SPR → `spr_commitment`
- MDF → `bluff_math`
- Bet/Pot → `bluff_math`

Use `useTrainingStore` to read `mentalMathMode` and `graduatedSkills()`. Add a `skillKey` prop to `MetricCard`. Each card manages its own "revealed" state.

On mount/whenever mentalMathMode changes, fetch progress via the store to populate `graduatedSkills`.

- [ ] **Step 1: Modify MetricCard to support tap-to-reveal**

Add `skillKey` optional prop to `MetricCardProps`. Import `useTrainingStore`. Inside `MetricCard`, check if `mentalMathMode && graduatedSkills.has(skillKey)`. If so, render value with `blur-sm` class and "Calculate first" text below. On click, toggle local `revealed` state. Reset `revealed` when `mentalMathMode` changes or drill changes.

Pass `skillKey` from `ResultsPanel` to each `MetricCard` call based on the mapping above.

Also add `skillKey="outs"` to the `OutsCard` component and apply the same blur logic there.

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ResultsPanel.tsx
git commit -m "feat: add tap-to-reveal for graduated skills in ResultsPanel"
```

---

### Task 13: PID Mental Math Progress Integration

**Files:**
- Modify: `backend/app/services/session_end_service.py`
- Create: `backend/tests/test_pid_mental_math.py`

**Context:** When `finalize_session` runs at session end, include the user's drill progress data in the PID update prompt so the AI writes a "Mental Math Progress" section.

Uses `get_all_progress(db, user_id)` from `drill_service` to get current skill progress. Appends this data to the `generate_pid_update` prompt.

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_pid_mental_math.py
import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, SessionRecord, RoundRecord, PIDRecord, SkillProgress
from app.services.session_end_service import generate_pid_update


test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.mark.asyncio
async def test_pid_update_includes_drill_progress():
    db = TestSession()
    # Create a session with one round
    session_rec = SessionRecord(user_id="default", total_rounds=1)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)

    db.add(RoundRecord(
        session_id=session_rec.id,
        round_number=1,
        hole_cards='["Ah", "Kh"]',
        community_cards='["2h", "7h", "Td"]',
        pot_size=100,
        result="won",
        profit=50,
    ))
    # Add some skill progress
    db.add(SkillProgress(skill="outs", status="graduated", total_attempts=55, correct_count=50, current_accuracy=0.91, avg_response_time_ms=3200))
    db.add(SkillProgress(skill="rule_of_2_4", status="active", total_attempts=30, correct_count=24, current_accuracy=0.80, avg_response_time_ms=6100))
    db.commit()

    with patch("app.services.session_end_service.chat_with_ai", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = "Updated PID with mental math section"
        result = await generate_pid_update(db, session_rec.id, "# Current PID")

        # Check that the AI was called with drill progress in the prompt
        call_args = mock_ai.call_args
        user_prompt = call_args[0][1]  # second positional arg
        assert "Mental Math Progress" in user_prompt or "mental math" in user_prompt.lower()
        assert "outs" in user_prompt.lower()
    db.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv/bin/python -m pytest tests/test_pid_mental_math.py -v`
Expected: FAIL — prompt doesn't include drill progress yet

- [ ] **Step 3: Modify generate_pid_update in session_end_service.py**

Add import at top of `session_end_service.py`:
```python
from app.services.drill_service import get_all_progress
```

In `generate_pid_update`, after building the prompt, add drill progress data:
```python
async def generate_pid_update(
    db: Session, session_id: int, current_pid: str
) -> str:
    stats = build_session_stats(db, session_id)
    rounds_data = _rounds_to_summary_data(db, session_id)

    # Get drill progress for mental math section
    drill_progress = get_all_progress(db)
    drill_section = ""
    if any(p["total_attempts"] > 0 for p in drill_progress):
        lines = ["MENTAL MATH PROGRESS:"]
        for p in drill_progress:
            if p["total_attempts"] > 0:
                lines.append(
                    f"- {p['skill']}: {p['status'].upper()} "
                    f"({p['current_accuracy']:.0f}% accuracy, "
                    f"avg {p['avg_response_time_ms']/1000:.1f}s, "
                    f"{p['total_attempts']} attempts)"
                )
        drill_section = "\n".join(lines) + "\n\n"

    prompt = (
        "You are updating a poker player's intelligence document.\n\n"
        f"CURRENT DOCUMENT:\n{current_pid}\n\n"
        f"NEW SESSION DATA ({stats['total_rounds']} rounds):\n{rounds_data}\n\n"
        f"{drill_section}"
        "INSTRUCTIONS:\n"
        "1. Update all statistics (sessions played, profit, win rate, etc.)\n"
        "2. Re-evaluate leaks — are any improving? New ones emerging?\n"
        "3. Update tendencies if the data shows change\n"
        "4. Add a session note (2-3 sentences max)\n"
        "5. Update the improvement roadmap\n"
        "6. If mental math progress data is provided, include a 'Mental Math Progress' section\n"
        "7. Be specific with numbers.\n\n"
        "Return the complete updated document."
    )

    return await chat_with_ai(
        "You are a poker intelligence analyst. Return a complete, updated PID markdown document.",
        prompt,
    )
```

- [ ] **Step 4: Run tests**

Run: `cd backend && venv/bin/python -m pytest tests/test_pid_mental_math.py -v`
Expected: Pass

- [ ] **Step 5: Run full backend suite**

Run: `cd backend && venv/bin/python -m pytest -x -q`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/session_end_service.py backend/tests/test_pid_mental_math.py
git commit -m "feat: include drill progress in PID updates for mental math tracking"
```

---

## Post-Implementation

After all 13 tasks are complete:
1. Run full backend test suite: `cd backend && venv/bin/python -m pytest -v`
2. Run frontend type check: `cd frontend && npx tsc --noEmit`
3. Run frontend build: `cd frontend && npm run build`
4. Start dev servers and manually test the Training tab end-to-end
5. Push everything to main
