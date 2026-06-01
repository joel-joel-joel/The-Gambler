# Phase 1: Core Calculator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working poker odds calculator with a FastAPI backend (equity, EV, pot odds, outs, SPR, MDF, bluff math, recommendation) and a React frontend (card selector, game inputs, quick entry bar, results panel, tooltips, cheat sheet).

**Architecture:** FastAPI backend exposes a single `/api/calculate` endpoint that accepts hand/board/game state and returns all poker metrics. React frontend with Zustand state management sends inputs to the API on every change and renders results. The poker engine uses the `eval7` library for Monte Carlo equity simulation. Frontend and backend are separate directories with independent dependency management.

**Tech Stack:** Python 3.12, FastAPI, eval7, uvicorn | React 18, TypeScript, Vite, Zustand, Tailwind CSS

---

## File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app, CORS, root route
│   ├── config.py                # Settings via pydantic-settings
│   ├── routers/
│   │   ├── __init__.py
│   │   └── calculate.py         # POST /api/calculate, POST /api/parse-quick-entry
│   └── services/
│       ├── __init__.py
│       ├── poker_engine.py      # All poker math functions
│       ├── quick_entry_parser.py # Parse shorthand notation
│       └── recommendation.py    # CALL/RAISE/FOLD logic
├── tests/
│   ├── __init__.py
│   ├── test_poker_engine.py
│   ├── test_recommendation.py
│   ├── test_quick_entry_parser.py
│   └── test_calculate_router.py
├── requirements.txt
└── .env.example

frontend/
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Router + layout shell
│   ├── store/
│   │   └── gameStore.ts         # Zustand store: cards, inputs, results
│   ├── hooks/
│   │   └── usePokerCalculator.ts # Debounced API calls on input change
│   ├── components/
│   │   ├── CardSelector.tsx     # 52-card visual grid picker
│   │   ├── GameInputs.tsx       # Pot, bet, position, players, stacks
│   │   ├── QuickEntryBar.tsx    # Shorthand text input for Live Mode
│   │   ├── ResultsPanel.tsx     # All metrics rendered with tooltips
│   │   ├── MetricTooltip.tsx    # Reusable (?) tooltip popover
│   │   └── CheatSheet.tsx       # Collapsible mental math reference
│   ├── utils/
│   │   ├── cardUtils.ts         # Card formatting, validation helpers
│   │   └── tooltipData.ts       # Hardcoded tooltip content per metric
│   └── types.ts                 # Shared TypeScript interfaces
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Task 1: Backend Project Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create backend directory structure**

```bash
mkdir -p backend/app/routers backend/app/services backend/tests
touch backend/app/__init__.py backend/app/routers/__init__.py backend/app/services/__init__.py backend/tests/__init__.py
```

- [ ] **Step 2: Write requirements.txt**

Create `backend/requirements.txt`:

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
eval7==0.1.9
pydantic==2.9.0
pydantic-settings==2.5.0
python-dotenv==1.0.1
pytest==8.3.0
httpx==0.27.0
```

- [ ] **Step 3: Write .env.example**

Create `backend/.env.example`:

```bash
MONTE_CARLO_ITERATIONS=10000
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 4: Write config.py**

Create `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    monte_carlo_iterations: int = 10000
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 5: Write main.py with health check**

Create `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(title="The Gambler API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Write a test for the health endpoint**

Create `backend/tests/test_calculate_router.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 7: Install dependencies and run test**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest tests/test_calculate_router.py::test_health_check -v
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend with FastAPI, health endpoint, and config"
```

---

## Task 2: Poker Engine — Core Math Functions

**Files:**
- Create: `backend/app/services/poker_engine.py`
- Create: `backend/tests/test_poker_engine.py`

- [ ] **Step 1: Write failing tests for pot odds, EV, SPR, MDF, bluff break-even**

Create `backend/tests/test_poker_engine.py`:

```python
from app.services.poker_engine import (
    calculate_pot_odds,
    calculate_pot_odds_ratio,
    calculate_ev,
    calculate_spr,
    calculate_mdf,
    calculate_bluff_break_even,
    calculate_fold_equity,
    calculate_effective_stack,
    rule_of_2_4,
)


def test_pot_odds_percentage():
    result = calculate_pot_odds(bet_to_call=20, pot_size=100)
    assert abs(result - 16.67) < 0.01


def test_pot_odds_ratio():
    result = calculate_pot_odds_ratio(bet_to_call=20, pot_size=100)
    assert result == "6:1"


def test_ev_positive():
    result = calculate_ev(equity=0.40, pot_size=100, bet_to_call=50)
    assert abs(result - 30.0) < 0.01


def test_ev_negative():
    result = calculate_ev(equity=0.15, pot_size=100, bet_to_call=50)
    assert result < 0


def test_spr():
    result = calculate_spr(effective_stack=200, pot_size=50)
    assert result == 4.0


def test_spr_zero_pot():
    result = calculate_spr(effective_stack=200, pot_size=0)
    assert result == float("inf")


def test_mdf():
    result = calculate_mdf(bet_size=100, pot_size=100)
    assert abs(result - 0.50) < 0.01


def test_bluff_break_even():
    result = calculate_bluff_break_even(bluff_size=75, pot_size=100)
    assert abs(result - 0.4286) < 0.01


def test_fold_equity():
    result = calculate_fold_equity(fold_probability=0.40, pot_size=100)
    assert abs(result - 40.0) < 0.01


def test_effective_stack():
    result = calculate_effective_stack(your_stack=500, villain_stack=300, bb=2)
    assert result["effective_stack"] == 300
    assert result["effective_stack_bb"] == 150
    assert result["stack_depth"] == "deep"


def test_effective_stack_short():
    result = calculate_effective_stack(your_stack=40, villain_stack=500, bb=2)
    assert result["effective_stack"] == 40
    assert result["effective_stack_bb"] == 20
    assert result["stack_depth"] == "short"


def test_rule_of_4_flop():
    result = rule_of_2_4(outs=9, street="flop")
    assert result == 36.0


def test_rule_of_2_turn():
    result = rule_of_2_4(outs=9, street="turn")
    assert result == 18.0


def test_rule_of_2_4_cap():
    result = rule_of_2_4(outs=30, street="flop")
    assert result == 100.0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_poker_engine.py -v
```

Expected: FAIL — `ImportError: cannot import name 'calculate_pot_odds'`

- [ ] **Step 3: Implement all math functions**

Create `backend/app/services/poker_engine.py`:

```python
import eval7


def calculate_pot_odds(bet_to_call: float, pot_size: float) -> float:
    return (bet_to_call / (pot_size + bet_to_call)) * 100


def calculate_pot_odds_ratio(bet_to_call: float, pot_size: float) -> str:
    if bet_to_call == 0:
        return "inf:1"
    ratio = (pot_size + bet_to_call) / bet_to_call
    return f"{ratio:.0f}:1"


def calculate_ev(equity: float, pot_size: float, bet_to_call: float) -> float:
    pot_after_call = pot_size + bet_to_call
    return (equity * pot_after_call) - ((1 - equity) * bet_to_call)


def calculate_spr(effective_stack: float, pot_size: float) -> float:
    if pot_size == 0:
        return float("inf")
    return effective_stack / pot_size


def calculate_mdf(bet_size: float, pot_size: float) -> float:
    return 1 - (bet_size / (pot_size + bet_size))


def calculate_bluff_break_even(bluff_size: float, pot_size: float) -> float:
    return bluff_size / (pot_size + bluff_size)


def calculate_fold_equity(fold_probability: float, pot_size: float) -> float:
    return fold_probability * pot_size


def calculate_effective_stack(
    your_stack: float, villain_stack: float, bb: float = 1
) -> dict:
    eff = min(your_stack, villain_stack)
    eff_bb = eff / bb if bb > 0 else 0
    if eff_bb < 25:
        depth = "short"
    elif eff_bb < 80:
        depth = "medium"
    else:
        depth = "deep"
    return {
        "effective_stack": eff,
        "effective_stack_bb": eff_bb,
        "stack_depth": depth,
    }


def rule_of_2_4(outs: int, street: str) -> float:
    if street == "flop":
        return min(outs * 4, 100)
    elif street == "turn":
        return min(outs * 2, 100)
    return 0.0


def calculate_equity(
    hole_cards: list[str],
    community_cards: list[str],
    num_players: int = 2,
    iterations: int = 10000,
) -> float:
    hand = [eval7.Card(c) for c in hole_cards]
    board = [eval7.Card(c) for c in community_cards]

    deck = eval7.Deck()
    known_cards = hand + board
    remaining = [c for c in deck.cards if c not in known_cards]

    wins = 0
    ties = 0
    total = 0

    import random

    for _ in range(iterations):
        random.shuffle(remaining)
        cards_needed = 5 - len(board)
        opponents_cards_needed = 2 * (num_players - 1)
        total_needed = cards_needed + opponents_cards_needed

        if total_needed > len(remaining):
            break

        sim_board = board + remaining[:cards_needed]
        my_hand = eval7.evaluate(hand + sim_board)

        all_beat = True
        any_tie = False
        idx = cards_needed
        for _ in range(num_players - 1):
            opp_hand = remaining[idx : idx + 2]
            idx += 2
            opp_score = eval7.evaluate(opp_hand + sim_board)
            if opp_score > my_hand:
                all_beat = False
                break
            elif opp_score == my_hand:
                any_tie = True

        if all_beat:
            if any_tie:
                ties += 1
            else:
                wins += 1
        total += 1

    if total == 0:
        return 0.0
    return (wins + ties * 0.5) / total


HAND_TIERS = {
    1: ["AA", "KK"],
    2: ["QQ", "JJ", "AKs"],
    3: ["TT", "AQs", "AKo", "AJs"],
    4: ["99", "AQo", "ATs", "KQs"],
    5: ["88", "77", "KJs", "KTs", "QJs", "AJo", "ATo"],
    6: ["66", "55", "KQo", "KJo", "QTs", "JTs"],
    7: ["44", "33", "22", "T9s", "98s", "87s", "76s", "65s", "KTo", "QJo"],
    8: ["J9s", "T8s", "97s", "86s", "75s", "54s", "Q9s"],
}


def get_preflop_hand_tier(hole_cards: list[str]) -> int | None:
    rank_order = "23456789TJQKA"
    r1 = hole_cards[0][0]
    r2 = hole_cards[1][0]
    s1 = hole_cards[0][1]
    s2 = hole_cards[1][1]

    if rank_order.index(r1) < rank_order.index(r2):
        r1, r2 = r2, r1

    suited = s1 == s2
    if r1 == r2:
        hand_str = r1 + r2
    elif suited:
        hand_str = r1 + r2 + "s"
    else:
        hand_str = r1 + r2 + "o"

    for tier, hands in HAND_TIERS.items():
        if hand_str in hands:
            return tier
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_poker_engine.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/poker_engine.py backend/tests/test_poker_engine.py
git commit -m "feat: implement poker math engine (pot odds, EV, SPR, MDF, equity, tiers)"
```

---

## Task 3: Poker Engine — Outs Detection

**Files:**
- Modify: `backend/app/services/poker_engine.py`
- Modify: `backend/tests/test_poker_engine.py`

- [ ] **Step 1: Write failing tests for outs detection**

Append to `backend/tests/test_poker_engine.py`:

```python
from app.services.poker_engine import detect_outs


def test_flush_draw_outs():
    hole = ["Ah", "Kh"]
    board = ["7h", "2h", "9c"]
    result = detect_outs(hole, board)
    assert result["total_outs"] == 9
    assert any(d["draw_type"] == "flush_draw" for d in result["draws"])


def test_open_ended_straight_draw():
    hole = ["Jh", "Td"]
    board = ["9c", "8d", "2h"]
    result = detect_outs(hole, board)
    assert any(d["draw_type"] == "open_ended_straight" for d in result["draws"])
    straight_draw = next(
        d for d in result["draws"] if d["draw_type"] == "open_ended_straight"
    )
    assert straight_draw["outs"] == 8


def test_gutshot_straight_draw():
    hole = ["Ah", "Kd"]
    board = ["Qc", "Jd", "5h"]
    result = detect_outs(hole, board)
    assert any(d["draw_type"] == "gutshot_straight" for d in result["draws"])


def test_overcards():
    hole = ["Ah", "Kd"]
    board = ["7c", "5d", "2h"]
    result = detect_outs(hole, board)
    assert any(d["draw_type"] == "overcards" for d in result["draws"])
    overcard_draw = next(
        d for d in result["draws"] if d["draw_type"] == "overcards"
    )
    assert overcard_draw["outs"] == 6


def test_no_draws_on_river():
    hole = ["Ah", "Kd"]
    board = ["7c", "5d", "2h", "9s", "Jc"]
    result = detect_outs(hole, board)
    assert result["total_outs"] == 0


def test_combo_draw():
    hole = ["Jh", "Th"]
    board = ["9h", "8h", "2c"]
    result = detect_outs(hole, board)
    assert result["total_outs"] >= 15
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_poker_engine.py::test_flush_draw_outs -v
```

Expected: FAIL — `ImportError: cannot import name 'detect_outs'`

- [ ] **Step 3: Implement outs detection**

Add to `backend/app/services/poker_engine.py`:

```python
def detect_outs(hole_cards: list[str], community_cards: list[str]) -> dict:
    if len(community_cards) >= 5:
        return {"draws": [], "total_outs": 0, "outs_cards": []}

    rank_order = "23456789TJQKA"
    all_cards = hole_cards + community_cards
    dead_cards = set(all_cards)

    draws = []
    outs_cards = set()

    suits = {}
    for card in all_cards:
        suit = card[1]
        suits[suit] = suits.get(suit, 0) + 1

    for suit, count in suits.items():
        if count == 4:
            for rank in rank_order:
                card = rank + suit
                if card not in dead_cards:
                    outs_cards.add(card)
            draws.append({"draw_type": "flush_draw", "outs": 9})
            break

    ranks = sorted(set(rank_order.index(c[0]) for c in all_cards))

    def has_oesd():
        for i in range(len(ranks) - 3):
            window = ranks[i : i + 4]
            if window[-1] - window[0] == 3 and len(set(window)) == 4:
                low_card = window[0] - 1
                high_card = window[-1] + 1
                count = 0
                if low_card >= 0:
                    count += 1
                if high_card <= 12:
                    count += 1
                if count == 2:
                    return True
        return False

    def has_gutshot():
        for start in range(9):
            needed = set(range(start, start + 5))
            have = needed.intersection(ranks)
            if len(have) == 4:
                missing_rank = (needed - have).pop()
                missing_rank_char = rank_order[missing_rank]
                for suit in "shdc":
                    card = missing_rank_char + suit
                    if card not in dead_cards:
                        outs_cards.add(card)
                return True
        if set([8, 9, 10, 11, 12]).intersection(ranks) and len(
            set([8, 9, 10, 11, 12]).intersection(ranks)
        ) == 4:
            return True
        return False

    if has_oesd():
        draws.append({"draw_type": "open_ended_straight", "outs": 8})
    elif has_gutshot():
        draws.append({"draw_type": "gutshot_straight", "outs": 4})

    board_ranks = [rank_order.index(c[0]) for c in community_cards]
    if board_ranks:
        max_board_rank = max(board_ranks)
        hole_ranks = [rank_order.index(c[0]) for c in hole_cards]
        overcards = [r for r in hole_ranks if r > max_board_rank]
        if len(overcards) >= 2:
            draws.append({"draw_type": "overcards", "outs": 6})
        elif len(overcards) == 1:
            draws.append({"draw_type": "one_overcard", "outs": 3})

    seen_outs = set()
    total_outs = 0
    for draw in draws:
        draw_type = draw["draw_type"]
        if draw_type not in seen_outs:
            seen_outs.add(draw_type)
            total_outs += draw["outs"]

    total_outs = min(total_outs, 20)

    return {
        "draws": draws,
        "total_outs": total_outs,
        "outs_cards": list(outs_cards),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_poker_engine.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/poker_engine.py backend/tests/test_poker_engine.py
git commit -m "feat: add outs detection (flush, OESD, gutshot, overcards, combos)"
```

---

## Task 4: Recommendation Engine

**Files:**
- Create: `backend/app/services/recommendation.py`
- Create: `backend/tests/test_recommendation.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_recommendation.py`:

```python
from app.services.recommendation import recommend


def test_strong_hand_raises():
    action, reason = recommend(
        equity=0.75,
        equity_required=0.25,
        ev_call=50.0,
        spr=5.0,
        street="flop",
        outs=0,
    )
    assert action == "RAISE"


def test_good_equity_raises():
    action, reason = recommend(
        equity=0.60,
        equity_required=0.30,
        ev_call=25.0,
        spr=5.0,
        street="flop",
        outs=0,
    )
    assert action == "RAISE"


def test_low_spr_committed():
    action, reason = recommend(
        equity=0.48,
        equity_required=0.30,
        ev_call=15.0,
        spr=2.5,
        street="flop",
        outs=0,
    )
    assert action == "RAISE"


def test_positive_ev_calls():
    action, reason = recommend(
        equity=0.38,
        equity_required=0.30,
        ev_call=10.0,
        spr=8.0,
        street="flop",
        outs=0,
    )
    assert action == "CALL"


def test_borderline_calls():
    action, reason = recommend(
        equity=0.27,
        equity_required=0.30,
        ev_call=-2.0,
        spr=6.0,
        street="flop",
        outs=4,
    )
    assert action == "CALL"


def test_drawing_hand_calls():
    action, reason = recommend(
        equity=0.20,
        equity_required=0.33,
        ev_call=-5.0,
        spr=8.0,
        street="flop",
        outs=9,
    )
    assert action == "CALL"


def test_weak_hand_folds():
    action, reason = recommend(
        equity=0.12,
        equity_required=0.33,
        ev_call=-20.0,
        spr=8.0,
        street="turn",
        outs=2,
    )
    assert action == "FOLD"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_recommendation.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement recommendation engine**

Create `backend/app/services/recommendation.py`:

```python
def recommend(
    equity: float,
    equity_required: float,
    ev_call: float,
    spr: float,
    street: str,
    outs: int,
) -> tuple[str, str]:
    if ev_call > 0 and equity > equity_required:
        if equity > 0.70:
            return "RAISE", "Strong hand — build the pot"
        elif equity > 0.55:
            return "RAISE", "Good equity — apply pressure"
        elif spr < 3 and equity > 0.45:
            return "RAISE", "Low SPR — you're committed, get it in"
        else:
            return "CALL", "+EV call but not strong enough to raise"
    elif equity > equity_required * 0.85:
        return "CALL", "Borderline — consider implied odds and position"
    elif outs >= 9 and street == "flop":
        return "CALL", f"Drawing hand with {outs} outs (~{outs*4}%). Consider implied odds"
    else:
        return "FOLD", f"Need {equity_required:.0%} equity, only have {equity:.0%}"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_recommendation.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/recommendation.py backend/tests/test_recommendation.py
git commit -m "feat: add recommendation engine (CALL/RAISE/FOLD logic)"
```

---

## Task 5: Quick Entry Parser

**Files:**
- Create: `backend/app/services/quick_entry_parser.py`
- Create: `backend/tests/test_quick_entry_parser.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_quick_entry_parser.py`:

```python
from app.services.quick_entry_parser import parse_quick_entry


def test_basic_suited():
    result = parse_quick_entry("AKs 150 40")
    assert result["hole_cards"] is not None
    assert len(result["hole_cards"]) == 2
    assert result["pot_size"] == 150
    assert result["bet_to_call"] == 40


def test_specific_suits():
    result = parse_quick_entry("QhJd 200 75 btn")
    assert result["hole_cards"] == ["Qh", "Jd"]
    assert result["pot_size"] == 200
    assert result["bet_to_call"] == 75
    assert result["position"] == "BTN"


def test_pocket_pair():
    result = parse_quick_entry("99 80 20 6p")
    assert result["hole_cards"][0][0] == "9"
    assert result["hole_cards"][1][0] == "9"
    assert result["pot_size"] == 80
    assert result["bet_to_call"] == 20
    assert result["num_players"] == 6


def test_offsuit():
    result = parse_quick_entry("AKo 100 50")
    assert result["hole_cards"] is not None
    assert result["hole_cards"][0][1] != result["hole_cards"][1][1]


def test_position_parsing():
    for pos in ["btn", "co", "mp", "utg", "sb", "bb"]:
        result = parse_quick_entry(f"AKs 100 50 {pos}")
        assert result["position"] == pos.upper()


def test_confidence_high_with_specific_cards():
    result = parse_quick_entry("AhKd 100 50")
    assert result["confidence"] >= 0.95


def test_confidence_lower_with_assumptions():
    result = parse_quick_entry("AKs 100 50")
    assert result["confidence"] < 1.0
    assert len(result["assumptions"]) > 0


def test_empty_input():
    result = parse_quick_entry("")
    assert result["hole_cards"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_quick_entry_parser.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement the parser**

Create `backend/app/services/quick_entry_parser.py`:

```python
import re

POSITIONS = {"btn", "co", "mp", "utg", "sb", "bb"}
RANKS = set("23456789TJQKA")
SUITS = set("shdc")

DEFAULT_SUITS_SUITED = [("s", "s"), ("h", "h"), ("d", "d"), ("c", "c")]
DEFAULT_SUITS_OFFSUIT = [("s", "h"), ("d", "c"), ("h", "s"), ("c", "d")]


def parse_quick_entry(input_str: str) -> dict:
    result = {
        "hole_cards": None,
        "pot_size": None,
        "bet_to_call": None,
        "position": None,
        "num_players": None,
        "confidence": 0.0,
        "assumptions": [],
    }

    if not input_str or not input_str.strip():
        return result

    tokens = input_str.strip().split()
    if not tokens:
        return result

    hand_token = tokens[0]
    hole_cards = _parse_hand(hand_token, result)
    result["hole_cards"] = hole_cards

    numbers = []
    for token in tokens[1:]:
        token_lower = token.lower()

        if token_lower in POSITIONS:
            result["position"] = token_lower.upper()
            continue

        player_match = re.match(r"(\d+)p(?:layers?)?", token_lower)
        if player_match:
            result["num_players"] = int(player_match.group(1))
            continue

        try:
            numbers.append(float(token))
        except ValueError:
            continue

    if len(numbers) >= 1:
        result["pot_size"] = numbers[0]
    if len(numbers) >= 2:
        result["bet_to_call"] = numbers[1]

    confidence = 1.0
    if result["hole_cards"] is None:
        confidence = 0.0
    elif len(result["assumptions"]) > 0:
        confidence -= 0.05 * len(result["assumptions"])

    result["confidence"] = max(0.0, confidence)
    return result


def _parse_hand(token: str, result: dict) -> list[str] | None:
    if len(token) == 4:
        r1, s1, r2, s2 = token[0].upper(), token[1].lower(), token[2].upper(), token[3].lower()
        if r1 in RANKS and s1 in SUITS and r2 in RANKS and s2 in SUITS:
            return [r1 + s1, r2 + s2]

    if len(token) == 3:
        r1, r2 = token[0].upper(), token[1].upper()
        modifier = token[2].lower()
        if r1 in RANKS and r2 in RANKS:
            if modifier == "s":
                result["assumptions"].append(f"Assigned default suits: {r1}s{r2}s")
                return [r1 + "s", r2 + "s"]
            elif modifier == "o":
                result["assumptions"].append(f"Assigned default suits: {r1}s{r2}h")
                return [r1 + "s", r2 + "h"]

    if len(token) == 2:
        r1, r2 = token[0].upper(), token[1].upper()
        if r1 in RANKS and r2 in RANKS:
            if r1 == r2:
                result["assumptions"].append(f"Pocket pair: {r1}s{r2}h")
                return [r1 + "s", r2 + "h"]
            else:
                result["assumptions"].append(f"Assumed offsuit: {r1}s{r2}h")
                return [r1 + "s", r2 + "h"]

    return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_quick_entry_parser.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/quick_entry_parser.py backend/tests/test_quick_entry_parser.py
git commit -m "feat: add quick entry parser (shorthand notation → structured data)"
```

---

## Task 6: Calculate API Router

**Files:**
- Create: `backend/app/routers/calculate.py`
- Modify: `backend/app/main.py` (register router)
- Modify: `backend/tests/test_calculate_router.py`

- [ ] **Step 1: Write failing integration test**

Append to `backend/tests/test_calculate_router.py`:

```python
def test_calculate_endpoint():
    response = client.post(
        "/api/calculate",
        json={
            "hole_cards": ["Ah", "Kd"],
            "community_cards": ["7h", "2d", "9c"],
            "num_players": 2,
            "pot_size": 100,
            "bet_to_call": 50,
            "position": "CO",
            "your_stack": 500,
            "villain_stack": 500,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "equity" in data
    assert "ev" in data
    assert "pot_odds" in data
    assert "pot_odds_ratio" in data
    assert "equity_required" in data
    assert "outs" in data
    assert "rule_of_2_4" in data
    assert "recommendation" in data
    assert "spr" in data
    assert "mdf" in data
    assert data["recommendation"]["action"] in ["CALL", "RAISE", "FOLD"]


def test_calculate_preflop():
    response = client.post(
        "/api/calculate",
        json={
            "hole_cards": ["Ah", "Kd"],
            "community_cards": [],
            "num_players": 6,
            "pot_size": 15,
            "bet_to_call": 10,
            "position": "BTN",
            "your_stack": 200,
            "villain_stack": 200,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["preflop_hand_tier"] is not None


def test_parse_quick_entry_endpoint():
    response = client.post(
        "/api/parse-quick-entry",
        json={"input": "AKs 150 40 btn"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["hole_cards"] is not None
    assert data["pot_size"] == 150
    assert data["bet_to_call"] == 40
    assert data["position"] == "BTN"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_calculate_router.py::test_calculate_endpoint -v
```

Expected: FAIL — 404 or route not found

- [ ] **Step 3: Create the router with request/response schemas**

Create `backend/app/routers/calculate.py`:

```python
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.services.poker_engine import (
    calculate_pot_odds,
    calculate_pot_odds_ratio,
    calculate_ev,
    calculate_spr,
    calculate_mdf,
    calculate_bluff_break_even,
    calculate_effective_stack,
    calculate_equity,
    detect_outs,
    get_preflop_hand_tier,
    rule_of_2_4,
)
from app.services.recommendation import recommend
from app.services.quick_entry_parser import parse_quick_entry

router = APIRouter(prefix="/api")


class CalculateRequest(BaseModel):
    hole_cards: list[str]
    community_cards: list[str] = []
    num_players: int = 2
    pot_size: float = 0
    bet_to_call: float = 0
    position: str | None = None
    your_stack: float | None = None
    villain_stack: float | None = None


class QuickEntryRequest(BaseModel):
    input: str


@router.post("/calculate")
def calculate(req: CalculateRequest):
    street = _infer_street(len(req.community_cards))

    equity = calculate_equity(
        req.hole_cards,
        req.community_cards,
        req.num_players,
        settings.monte_carlo_iterations,
    )

    pot_odds = calculate_pot_odds(req.bet_to_call, req.pot_size) if req.bet_to_call > 0 else 0.0
    pot_odds_ratio = calculate_pot_odds_ratio(req.bet_to_call, req.pot_size) if req.bet_to_call > 0 else "N/A"
    equity_required = pot_odds / 100 if pot_odds > 0 else 0.0
    ev = calculate_ev(equity, req.pot_size, req.bet_to_call) if req.bet_to_call > 0 else 0.0

    outs_data = detect_outs(req.hole_cards, req.community_cards)
    rule_2_4 = rule_of_2_4(outs_data["total_outs"], street)

    eff_stack = None
    spr = None
    mdf_val = None
    bet_pot_pct = None

    if req.your_stack and req.villain_stack:
        eff_stack = calculate_effective_stack(req.your_stack, req.villain_stack)
        if req.pot_size > 0:
            spr = calculate_spr(eff_stack["effective_stack"], req.pot_size)

    if req.bet_to_call > 0 and req.pot_size > 0:
        mdf_val = calculate_mdf(req.bet_to_call, req.pot_size)
        bet_pot_pct = (req.bet_to_call / req.pot_size) * 100

    preflop_tier = None
    if street == "preflop":
        preflop_tier = get_preflop_hand_tier(req.hole_cards)

    action, reason = recommend(
        equity=equity,
        equity_required=equity_required,
        ev_call=ev,
        spr=spr if spr is not None else 10.0,
        street=street,
        outs=outs_data["total_outs"],
    )

    return {
        "equity": round(equity * 100, 1),
        "ev": round(ev, 2),
        "pot_odds": round(pot_odds, 1),
        "pot_odds_ratio": pot_odds_ratio,
        "equity_required": round(equity_required * 100, 1),
        "outs": outs_data,
        "rule_of_2_4": rule_2_4,
        "hand_rank": None,
        "spr": round(spr, 2) if spr else None,
        "mdf": round(mdf_val * 100, 1) if mdf_val else None,
        "bet_pot_percentage": round(bet_pot_pct, 1) if bet_pot_pct else None,
        "effective_stack": eff_stack,
        "preflop_hand_tier": preflop_tier,
        "recommendation": {"action": action, "reason": reason},
        "street": street,
    }


@router.post("/parse-quick-entry")
def parse_entry(req: QuickEntryRequest):
    return parse_quick_entry(req.input)


def _infer_street(community_count: int) -> str:
    if community_count == 0:
        return "preflop"
    elif community_count == 3:
        return "flop"
    elif community_count == 4:
        return "turn"
    else:
        return "river"
```

- [ ] **Step 4: Register the router in main.py**

Update `backend/app/main.py` — add after the CORS middleware:

```python
from app.routers.calculate import router as calculate_router

app.include_router(calculate_router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_calculate_router.py -v
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/calculate.py backend/app/main.py backend/tests/test_calculate_router.py
git commit -m "feat: add /api/calculate and /api/parse-quick-entry endpoints"
```

---

## Task 7: Frontend Project Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/types.ts`

- [ ] **Step 1: Scaffold with Vite**

```bash
cd "/Users/joelong/Documents/SWE-Projects/The Gambler"
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install zustand tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Tailwind**

Update `frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

Replace `frontend/src/index.css` contents with:

```css
@import "tailwindcss";
```

- [ ] **Step 3: Create shared types**

Create `frontend/src/types.ts`:

```typescript
export interface Card {
  rank: string;
  suit: string;
  code: string; // e.g. "Ah", "Kd"
}

export interface GameState {
  holeCards: string[];
  communityCards: string[];
  numPlayers: number;
  potSize: number;
  betToCall: number;
  position: string | null;
  yourStack: number | null;
  villainStack: number | null;
}

export interface OutsData {
  draws: { draw_type: string; outs: number }[];
  total_outs: number;
  outs_cards: string[];
}

export interface EffectiveStack {
  effective_stack: number;
  effective_stack_bb: number;
  stack_depth: string;
}

export interface CalculationResult {
  equity: number;
  ev: number;
  pot_odds: number;
  pot_odds_ratio: string;
  equity_required: number;
  outs: OutsData;
  rule_of_2_4: number;
  hand_rank: string | null;
  spr: number | null;
  mdf: number | null;
  bet_pot_percentage: number | null;
  effective_stack: EffectiveStack | null;
  preflop_hand_tier: number | null;
  recommendation: { action: string; reason: string };
  street: string;
}

export interface QuickEntryResult {
  hole_cards: string[] | null;
  pot_size: number | null;
  bet_to_call: number | null;
  position: string | null;
  num_players: number | null;
  confidence: number;
  assumptions: string[];
}
```

- [ ] **Step 4: Write App.tsx shell**

Replace `frontend/src/App.tsx`:

```typescript
import { CardSelector } from "./components/CardSelector";
import { GameInputs } from "./components/GameInputs";
import { QuickEntryBar } from "./components/QuickEntryBar";
import { ResultsPanel } from "./components/ResultsPanel";
import { CheatSheet } from "./components/CheatSheet";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">The Gambler</h1>
      </header>
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <QuickEntryBar />
        <CardSelector />
        <GameInputs />
        <ResultsPanel />
        <CheatSheet />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create placeholder components (so it compiles)**

Create `frontend/src/components/` with one-line placeholder files:

```bash
mkdir -p frontend/src/components frontend/src/hooks frontend/src/store frontend/src/utils
```

Create `frontend/src/components/CardSelector.tsx`:
```typescript
export function CardSelector() {
  return <div>CardSelector placeholder</div>;
}
```

Create `frontend/src/components/GameInputs.tsx`:
```typescript
export function GameInputs() {
  return <div>GameInputs placeholder</div>;
}
```

Create `frontend/src/components/QuickEntryBar.tsx`:
```typescript
export function QuickEntryBar() {
  return <div>QuickEntryBar placeholder</div>;
}
```

Create `frontend/src/components/ResultsPanel.tsx`:
```typescript
export function ResultsPanel() {
  return <div>ResultsPanel placeholder</div>;
}
```

Create `frontend/src/components/CheatSheet.tsx`:
```typescript
export function CheatSheet() {
  return <div>CheatSheet placeholder</div>;
}
```

- [ ] **Step 6: Verify it compiles and runs**

```bash
cd frontend
npm run dev -- --open
```

Expected: Browser opens with "The Gambler" header and placeholder text. Kill the dev server.

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React, TypeScript, Tailwind"
```

---

## Task 8: Zustand Store + API Hook

**Files:**
- Create: `frontend/src/store/gameStore.ts`
- Create: `frontend/src/hooks/usePokerCalculator.ts`

- [ ] **Step 1: Create the Zustand store**

Create `frontend/src/store/gameStore.ts`:

```typescript
import { create } from "zustand";
import type { CalculationResult, GameState } from "../types";

interface GameStore extends GameState {
  results: CalculationResult | null;
  isLoading: boolean;
  error: string | null;

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

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  results: null,
  isLoading: false,
  error: null,

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
  resetAll: () => set({ ...initialState, results: null, error: null }),
}));
```

- [ ] **Step 2: Create the calculator hook with debounced API calls**

Create `frontend/src/hooks/usePokerCalculator.ts`:

```typescript
import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import type { CalculationResult } from "../types";

export function usePokerCalculator() {
  const {
    holeCards,
    communityCards,
    numPlayers,
    potSize,
    betToCall,
    position,
    yourStack,
    villainStack,
    setResults,
    setIsLoading,
    setError,
  } = useGameStore();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (holeCards.length < 2) {
      setResults(null);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hole_cards: holeCards,
            community_cards: communityCards,
            num_players: numPlayers,
            pot_size: potSize,
            bet_to_call: betToCall,
            position,
            your_stack: yourStack,
            villain_stack: villainStack,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data: CalculationResult = await response.json();
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Calculation failed");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    holeCards,
    communityCards,
    numPlayers,
    potSize,
    betToCall,
    position,
    yourStack,
    villainStack,
  ]);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/gameStore.ts frontend/src/hooks/usePokerCalculator.ts
git commit -m "feat: add Zustand game store and debounced API hook"
```

---

## Task 9: Card Selector Component

**Files:**
- Modify: `frontend/src/components/CardSelector.tsx`
- Modify: `frontend/src/utils/cardUtils.ts`

- [ ] **Step 1: Create card utility helpers**

Create `frontend/src/utils/cardUtils.ts`:

```typescript
export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;

export const SUIT_SYMBOLS: Record<string, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

export const SUIT_COLORS: Record<string, string> = {
  s: "text-gray-100",
  h: "text-red-500",
  d: "text-blue-400",
  c: "text-green-400",
};

export function allCards(): string[] {
  const cards: string[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      cards.push(rank + suit);
    }
  }
  return cards;
}

export function formatCard(code: string): { rank: string; suit: string; symbol: string; color: string } {
  const rank = code[0];
  const suit = code[1];
  return {
    rank,
    suit,
    symbol: SUIT_SYMBOLS[suit],
    color: SUIT_COLORS[suit],
  };
}
```

- [ ] **Step 2: Implement CardSelector**

Replace `frontend/src/components/CardSelector.tsx`:

```typescript
import { useGameStore } from "../store/gameStore";
import { RANKS, SUITS, SUIT_SYMBOLS, SUIT_COLORS } from "../utils/cardUtils";

export function CardSelector() {
  const { holeCards, communityCards, setHoleCards, setCommunityCards } = useGameStore();

  const selectedCards = new Set([...holeCards, ...communityCards]);

  function handleCardClick(card: string) {
    if (selectedCards.has(card)) {
      if (holeCards.includes(card)) {
        setHoleCards(holeCards.filter((c) => c !== card));
      } else {
        setCommunityCards(communityCards.filter((c) => c !== card));
      }
      return;
    }

    if (holeCards.length < 2) {
      setHoleCards([...holeCards, card]);
    } else if (communityCards.length < 5) {
      setCommunityCards([...communityCards, card]);
    }
  }

  function handleClear() {
    setHoleCards([]);
    setCommunityCards([]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span>
            Hole: {holeCards.length}/2{" "}
            {holeCards.map((c) => c[0] + SUIT_SYMBOLS[c[1]]).join(" ")}
          </span>
          <span>
            Board: {communityCards.length}/5{" "}
            {communityCards.map((c) => c[0] + SUIT_SYMBOLS[c[1]]).join(" ")}
          </span>
        </div>
        <button
          onClick={handleClear}
          className="text-sm px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-13 gap-1">
        {RANKS.map((rank) =>
          SUITS.map((suit) => {
            const card = rank + suit;
            const isSelected = selectedCards.has(card);
            const isHole = holeCards.includes(card);
            const isCommunity = communityCards.includes(card);

            return (
              <button
                key={card}
                onClick={() => handleCardClick(card)}
                className={`
                  w-8 h-10 text-xs font-bold rounded border flex flex-col items-center justify-center
                  ${isHole ? "bg-blue-600 border-blue-400" : ""}
                  ${isCommunity ? "bg-green-700 border-green-400" : ""}
                  ${!isSelected ? "bg-gray-800 border-gray-600 hover:bg-gray-700" : ""}
                  ${SUIT_COLORS[suit]}
                `}
              >
                <span>{rank}</span>
                <span className="text-[10px]">{SUIT_SYMBOLS[suit]}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CardSelector.tsx frontend/src/utils/cardUtils.ts
git commit -m "feat: add 52-card visual grid selector with hole/community distinction"
```

---

## Task 10: Game Inputs Component

**Files:**
- Modify: `frontend/src/components/GameInputs.tsx`

- [ ] **Step 1: Implement GameInputs**

Replace `frontend/src/components/GameInputs.tsx`:

```typescript
import { useGameStore } from "../store/gameStore";

const POSITIONS = ["UTG", "MP", "CO", "BTN", "SB", "BB"] as const;

export function GameInputs() {
  const {
    numPlayers,
    potSize,
    betToCall,
    position,
    yourStack,
    villainStack,
    setNumPlayers,
    setPotSize,
    setBetToCall,
    setPosition,
    setYourStack,
    setVillainStack,
  } = useGameStore();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Pot Size</label>
        <div className="flex gap-1">
          <input
            type="number"
            value={potSize || ""}
            onChange={(e) => setPotSize(Number(e.target.value))}
            placeholder="0"
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
          />
          <div className="flex gap-0.5">
            {[10, 50, 100].map((inc) => (
              <button
                key={inc}
                onClick={() => setPotSize(potSize + inc)}
                className="px-1.5 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
              >
                +{inc}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Bet to Call</label>
        <input
          type="number"
          value={betToCall || ""}
          onChange={(e) => setBetToCall(Number(e.target.value))}
          placeholder="0"
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Players</label>
        <input
          type="number"
          min={2}
          max={10}
          value={numPlayers}
          onChange={(e) => setNumPlayers(Number(e.target.value))}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Position</label>
        <div className="flex flex-wrap gap-1">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosition(position === pos ? null : pos)}
              className={`px-2 py-1 text-xs rounded ${
                position === pos
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Your Stack</label>
        <input
          type="number"
          value={yourStack ?? ""}
          onChange={(e) => setYourStack(e.target.value ? Number(e.target.value) : null)}
          placeholder="Optional"
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Villain Stack</label>
        <input
          type="number"
          value={villainStack ?? ""}
          onChange={(e) => setVillainStack(e.target.value ? Number(e.target.value) : null)}
          placeholder="Optional"
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/GameInputs.tsx
git commit -m "feat: add game inputs (pot, bet, players, position, stacks)"
```

---

## Task 11: Quick Entry Bar Component

**Files:**
- Modify: `frontend/src/components/QuickEntryBar.tsx`

- [ ] **Step 1: Implement QuickEntryBar**

Replace `frontend/src/components/QuickEntryBar.tsx`:

```typescript
import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import type { QuickEntryResult } from "../types";

export function QuickEntryBar() {
  const [input, setInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const { setHoleCards, setPotSize, setBetToCall, setPosition, setNumPlayers } = useGameStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      const response = await fetch("/api/parse-quick-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) throw new Error("Parse failed");

      const data: QuickEntryResult = await response.json();

      if (data.hole_cards) setHoleCards(data.hole_cards);
      if (data.pot_size !== null) setPotSize(data.pot_size);
      if (data.bet_to_call !== null) setBetToCall(data.bet_to_call);
      if (data.position) setPosition(data.position);
      if (data.num_players !== null) setNumPlayers(data.num_players);

      if (data.assumptions.length > 0) {
        setToast(data.assumptions[0]);
        setTimeout(() => setToast(null), 4000);
      }

      setInput("");
    } catch {
      setToast("Failed to parse input");
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Quick entry: "AKs 150 40 btn 6p"'
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
          autoFocus
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-500"
        >
          Go
        </button>
      </form>
      {toast && (
        <div className="absolute top-full mt-2 left-0 bg-yellow-900 text-yellow-100 text-xs px-3 py-1.5 rounded">
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/QuickEntryBar.tsx
git commit -m "feat: add quick entry bar with shorthand parsing"
```

---

## Task 12: Tooltip Data + MetricTooltip Component

**Files:**
- Create: `frontend/src/utils/tooltipData.ts`
- Create: `frontend/src/components/MetricTooltip.tsx`

- [ ] **Step 1: Create tooltip data**

Create `frontend/src/utils/tooltipData.ts`:

```typescript
export interface TooltipContent {
  title: string;
  what: string;
  formula: string;
  example: string;
  mentalMath: string;
}

export const tooltips: Record<string, TooltipContent> = {
  equity: {
    title: "Equity",
    what: "Your probability of winning the hand if it goes to showdown.",
    formula: "Equity = (Simulated Wins + Ties/2) / Total Simulations",
    example: "You hold A♠K♠ on Q♠7♠3♦. Monte Carlo shows you win ~45% of the time.",
    mentalMath: "Use the Rule of 2 & 4: count outs, multiply by 4 on the flop or 2 on the turn.",
  },
  ev: {
    title: "Expected Value (EV)",
    what: "The average amount you'd win or lose if you made this decision thousands of times.",
    formula: "EV = (Equity × Pot After Call) − ((1 − Equity) × Bet to Call)",
    example: "Pot $100, bet $50, equity 40%. EV = (0.40 × $150) − (0.60 × $50) = +$30.",
    mentalMath: "Quick check: are my pot odds better than my equity? If yes, it's +EV.",
  },
  pot_odds: {
    title: "Pot Odds",
    what: "What percentage of the new pot you're paying to call.",
    formula: "Pot Odds = Bet ÷ (Pot + Bet)",
    example: "Call $20 into $100 pot → you pay 20/120 = 16.7%.",
    mentalMath: "Bet ÷ (Pot + Bet). Quick: half-pot bet = 25%, pot bet = 33%.",
  },
  pot_odds_ratio: {
    title: "Pot Odds Ratio",
    what: "For every $1 you risk, how much you stand to win.",
    formula: "Ratio = (Pot + Bet) : Bet",
    example: "Pot $100, bet $20 → ratio is 6:1. You risk $1 to win $6.",
    mentalMath: "Divide pot by bet. $100 pot, $25 bet = 5:1.",
  },
  equity_required: {
    title: "Equity Required",
    what: "Minimum equity needed to break even on a call.",
    formula: "Same as pot odds percentage",
    example: "Pot odds are 25% → you need at least 25% equity to call profitably.",
    mentalMath: "Same number as pot odds %. If your equity > this number, call.",
  },
  outs: {
    title: "Outs",
    what: "Cards remaining in the deck that improve your hand to a likely winner.",
    formula: "Count cards that complete your draw",
    example: "Flush draw = 9 outs (13 of your suit minus 4 you can see).",
    mentalMath: "Memorize: flush=9, OESD=8, gutshot=4, overcards=6.",
  },
  rule_of_2_4: {
    title: "Rule of 2 & 4",
    what: "Quick way to convert outs into approximate equity without a calculator.",
    formula: "Flop: Outs × 4. Turn: Outs × 2.",
    example: "9 outs (flush draw). Flop: 9 × 4 = 36%. Turn: 9 × 2 = 18%.",
    mentalMath: "This IS the mental math. Flush=36%/18%, OESD=32%/16%, gutshot=16%/8%.",
  },
  spr: {
    title: "Stack-to-Pot Ratio (SPR)",
    what: "How deep your effective stack is relative to the pot.",
    formula: "SPR = Effective Stack ÷ Pot Size",
    example: "You have $200 behind, pot is $50. SPR = 4. Top pair is strong enough to stack off.",
    mentalMath: "SPR < 3 = go with top pair. SPR > 13 = need very strong hands or big draws.",
  },
  mdf: {
    title: "Minimum Defense Frequency (MDF)",
    what: "How often you must call to prevent villain from profiting by bluffing with any two cards.",
    formula: "MDF = 1 − (Bet ÷ (Pot + Bet))",
    example: "Villain bets $100 into $100 pot. MDF = 50%. Call at least 50% of your range.",
    mentalMath: "Pot-size bet = defend 50%. Half-pot bet = defend 67%.",
  },
  bluff_break_even: {
    title: "Bluff Break-Even %",
    what: "How often your bluff needs to make the opponent fold to be profitable.",
    formula: "Break-Even = Bluff Size ÷ (Pot + Bluff Size)",
    example: "Bluff $75 into $100. Break-even = 75/175 = 43%.",
    mentalMath: "Half-pot bluff needs to work 33%. Pot-size bluff needs to work 50%.",
  },
  recommendation: {
    title: "Recommendation",
    what: "Suggested action based on your equity vs equity required, EV, and stack depth.",
    formula: "If EV > 0 and equity > required → CALL/RAISE. Otherwise → FOLD.",
    example: "Equity 40%, required 25%, EV +$30 → CALL (or RAISE if very strong).",
    mentalMath: "Compare two numbers: your equity vs equity required. Higher = call/raise.",
  },
};
```

- [ ] **Step 2: Create MetricTooltip component**

Create `frontend/src/components/MetricTooltip.tsx`:

```typescript
import { useState } from "react";
import { tooltips } from "../utils/tooltipData";

interface MetricTooltipProps {
  metricKey: string;
}

export function MetricTooltip({ metricKey }: MetricTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tip = tooltips[metricKey];

  if (!tip) return null;

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ml-1 w-4 h-4 rounded-full bg-gray-600 text-[10px] text-gray-300 hover:bg-gray-500 inline-flex items-center justify-center"
      >
        ?
      </button>
      {isOpen && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl text-xs">
          <h4 className="font-bold text-white mb-1">{tip.title}</h4>
          <p className="text-gray-300 mb-2">{tip.what}</p>
          <div className="space-y-1.5 text-gray-400">
            <p>
              <span className="text-gray-500">Formula:</span> {tip.formula}
            </p>
            <p>
              <span className="text-gray-500">Example:</span> {tip.example}
            </p>
            <p className="text-yellow-300">
              <span className="text-gray-500">Mental math:</span> {tip.mentalMath}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-1 right-2 text-gray-500 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/tooltipData.ts frontend/src/components/MetricTooltip.tsx
git commit -m "feat: add educational tooltips with formula, example, and mental math"
```

---

## Task 13: Results Panel Component

**Files:**
- Modify: `frontend/src/components/ResultsPanel.tsx`

- [ ] **Step 1: Implement ResultsPanel**

Replace `frontend/src/components/ResultsPanel.tsx`:

```typescript
import { useGameStore } from "../store/gameStore";
import { usePokerCalculator } from "../hooks/usePokerCalculator";
import { MetricTooltip } from "./MetricTooltip";

export function ResultsPanel() {
  usePokerCalculator();

  const { results, isLoading, error, holeCards } = useGameStore();

  if (holeCards.length < 2) {
    return (
      <div className="text-center text-gray-500 py-8">
        Select 2 hole cards to see calculations
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center text-gray-400 py-8">Calculating...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 py-8">{error}</div>;
  }

  if (!results) return null;

  const actionColors: Record<string, string> = {
    CALL: "bg-yellow-600",
    RAISE: "bg-green-600",
    FOLD: "bg-red-600",
  };

  return (
    <div className="space-y-4">
      {/* Recommendation — most prominent */}
      <div
        className={`${actionColors[results.recommendation.action] || "bg-gray-700"} rounded-xl p-4 text-center`}
      >
        <div className="text-3xl font-black tracking-wide">
          {results.recommendation.action}
        </div>
        <div className="text-sm opacity-80 mt-1">{results.recommendation.reason}</div>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Equity"
          value={`${results.equity}%`}
          metricKey="equity"
        />
        <MetricCard
          label="EV"
          value={`${results.ev >= 0 ? "+" : ""}$${results.ev.toFixed(2)}`}
          metricKey="ev"
          highlight={results.ev >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Pot Odds"
          value={`${results.pot_odds}%`}
          metricKey="pot_odds"
        />
        <MetricCard
          label="Pot Odds Ratio"
          value={results.pot_odds_ratio}
          metricKey="pot_odds_ratio"
        />
        <MetricCard
          label="Equity Required"
          value={`${results.equity_required}%`}
          metricKey="equity_required"
        />
        <MetricCard
          label="Outs"
          value={`${results.outs.total_outs}`}
          metricKey="outs"
          subtitle={results.outs.draws.map((d) => d.draw_type.replace(/_/g, " ")).join(", ") || "none"}
        />
        <MetricCard
          label="Rule of 2 & 4"
          value={`~${results.rule_of_2_4}%`}
          metricKey="rule_of_2_4"
        />
        {results.preflop_hand_tier && (
          <MetricCard
            label="Hand Tier"
            value={`Tier ${results.preflop_hand_tier}`}
            metricKey="recommendation"
          />
        )}
      </div>

      {/* Study metrics (SPR, MDF, etc.) */}
      {(results.spr !== null || results.mdf !== null) && (
        <div className="border-t border-gray-700 pt-3">
          <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Sizing & Pressure
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {results.spr !== null && (
              <MetricCard label="SPR" value={`${results.spr}`} metricKey="spr" />
            )}
            {results.mdf !== null && (
              <MetricCard label="MDF" value={`${results.mdf}%`} metricKey="mdf" />
            )}
            {results.bet_pot_percentage !== null && (
              <MetricCard
                label="Bet/Pot"
                value={`${results.bet_pot_percentage}%`}
                metricKey="bluff_break_even"
              />
            )}
            {results.effective_stack && (
              <MetricCard
                label="Eff. Stack"
                value={`${results.effective_stack.effective_stack_bb} BB`}
                metricKey="spr"
                subtitle={results.effective_stack.stack_depth}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  metricKey: string;
  subtitle?: string;
  highlight?: "green" | "red";
}

function MetricCard({ label, value, metricKey, subtitle, highlight }: MetricCardProps) {
  const highlightClass =
    highlight === "green"
      ? "text-green-400"
      : highlight === "red"
        ? "text-red-400"
        : "text-white";

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center text-xs text-gray-400 mb-1">
        {label}
        <MetricTooltip metricKey={metricKey} />
      </div>
      <div className={`text-lg font-bold ${highlightClass}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ResultsPanel.tsx
git commit -m "feat: add results panel with all metrics, tooltips, and recommendation"
```

---

## Task 14: Cheat Sheet Component

**Files:**
- Modify: `frontend/src/components/CheatSheet.tsx`

- [ ] **Step 1: Implement CheatSheet**

Replace `frontend/src/components/CheatSheet.tsx`:

```typescript
import { useState } from "react";

export function CheatSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-sm text-gray-300 hover:text-white"
      >
        <span className="font-medium">Mental Math Cheat Sheet</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 text-xs text-gray-300">
          <section>
            <h4 className="font-bold text-white mb-1">Equity from Outs</h4>
            <ul className="space-y-0.5">
              <li>Flop → River: Outs × 4</li>
              <li>Turn → River: Outs × 2</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">Common Outs</h4>
            <ul className="space-y-0.5">
              <li>Flush draw: 9 | OESD: 8 | Gutshot: 4 | Overcards: 6</li>
              <li>Flush + OESD: 15 (monster draw ~54% on flop)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">Pot Odds Shortcut</h4>
            <ul className="space-y-0.5">
              <li>1/3 pot bet → need 25% equity</li>
              <li>1/2 pot bet → need 25% equity</li>
              <li>2/3 pot bet → need 28.5% equity</li>
              <li>3/4 pot bet → need 30% equity</li>
              <li>Pot-size bet → need 33% equity</li>
              <li>2× pot bet → need 40% equity</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">SPR Guide</h4>
            <ul className="space-y-0.5">
              <li>{"SPR < 3: Go with top pair+. Stack-off territory."}</li>
              <li>SPR 3–6: Top pair is good. Be cautious with marginal.</li>
              <li>SPR 7–13: Need two pair+ or strong draws.</li>
              <li>{"> 13: Deep stacked. Speculative hands gain value."}</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">Combos</h4>
            <ul className="space-y-0.5">
              <li>Pocket pair: 6 | Suited: 4 | Offsuit: 12</li>
              <li>Total AK: 16 combos (4 suited + 12 offsuit)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">Bluff Math</h4>
            <p>Break-even % = Bluff Size ÷ (Pot + Bluff Size)</p>
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CheatSheet.tsx
git commit -m "feat: add collapsible mental math cheat sheet"
```

---

## Task 15: Integration Test — Full Stack

**Files:**
- Modify: `frontend/src/App.tsx` (already done)
- No new files — this is a manual verification task

- [ ] **Step 1: Start the backend**

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 2: Start the frontend (in a separate terminal)**

```bash
cd frontend
npm run dev
```

- [ ] **Step 3: Manual verification in browser**

Open http://localhost:5173 and verify:

1. Quick entry: type `AKs 150 40 btn` and press Enter — hole cards, pot, bet, and position should populate
2. Card selector: click two cards for hole cards (turns blue), click 3 more for flop (turns green)
3. Game inputs: change pot/bet values — results should auto-recalculate after 300ms
4. Results panel: shows recommendation (CALL/RAISE/FOLD) prominently with all metrics
5. Tooltips: click (?) on any metric — shows what/formula/example/mental math
6. Cheat sheet: click to expand — shows all mental math shortcuts
7. Clear button: resets card selections

- [ ] **Step 4: Run all backend tests**

```bash
cd backend
pytest -v
```

Expected: All tests pass

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 1 — Core Calculator (frontend + backend integration)"
```

---

## Spec Coverage Verification

| Spec Requirement | Task |
|-----------------|------|
| Backend poker engine with eval7 | Tasks 2, 3 |
| Equity (Monte Carlo) | Task 2 |
| EV calculation | Task 2 |
| Pot odds (% and ratio) | Task 2 |
| Outs detection | Task 3 |
| Rule of 2 & 4 | Task 2 |
| SPR | Task 2 |
| MDF | Task 2 |
| Bluff break-even | Task 2 |
| Fold equity | Task 2 |
| Effective stack | Task 2 |
| Preflop hand tier | Task 2 |
| Recommendation engine | Task 4 |
| Quick entry parser | Task 5 |
| API endpoints (/api/calculate, /api/parse-quick-entry) | Task 6 |
| Frontend card selector | Task 9 |
| Game state inputs (pot, bet, players, position, stacks) | Task 10 |
| Quick entry bar | Task 11 |
| Results panel with auto-calculation | Task 13 |
| Educational tooltips (what, formula, example, mentalMath) | Task 12 |
| Mental math cheat sheet (collapsible) | Task 14 |
| Frontend ↔ Backend wiring | Task 8 (hook), Task 15 (verification) |
