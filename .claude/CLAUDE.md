# Poker Odds Companion — CLAUDE.md

## Project Context

This is a real-time poker companion web app for Texas Hold'em. The user plays poker on another device or at a live table and uses this app to input hand/board/action data and receive instant mathematical analysis (equity, EV, pot odds) with an AI-powered recommendation (call/raise/fold). An AI chat sidebar provides live coaching, scenario editing, and post-round analysis.

**The end goal is for the user to NOT need this app.** The app teaches the user to do poker math mentally through progressive drills and a graduation system. Every design and feature decision should support this: calculate → verify → internalize → graduate.

**Target user:** Intermediate player who knows the rules but wants a mathematical/probabilistic approach. They're playing live or on another device and need answers in under 5 seconds.

**Full spec:** Read `poker-calculator-spec.md` in the project root before starting any work. It contains the complete feature set, data models, API endpoints, poker math formulas, AI prompts, and UX requirements. If something in this file conflicts with the spec, the spec wins.

---

## Architecture Rules

This is a two-part app:

**Frontend:** React 18 + TypeScript + Vite + Zustand.
- All UI/UX design decisions are handled by the `ui-ux-pro-max-skill` design system. Do not hardcode colors, fonts, spacing, or layout breakpoints. Use the design system's tokens and components.
- State management via Zustand stores (gameStore, chatStore, roundStore, trainingStore). No prop drilling beyond one level — if a component needs state, use the store.
- AI chat uses WebSocket (`/ws/chat`). All other endpoints use REST.
- Speech-to-text uses the browser Web Speech API (no external service).

**Backend:** Python 3.12 + FastAPI + SQLite.
- Poker math engine uses `eval7` for hand evaluation and equity Monte Carlo simulation. Do NOT use `treys`, `deuces`, or other poker libraries.
- AI integration via Google Gemini Flash 2.0 (free tier). The AI service layer is provider-agnostic — Gemini, Groq, and Claude API are swappable via config.
- Database is SQLite via SQLAlchemy. Single-user app with PIN auth.

**Do not:**
- Add authentication beyond the PIN middleware
- Add a database migration framework for MVP (SQLAlchemy create_all is fine)
- Build a separate admin panel
- Add WebSocket for anything other than chat
- Use server-side rendering

---

## Coding Standards

### General

- Write code that a junior developer can read. Clarity over cleverness.
- Every function does one thing. If a function has "and" in its description, split it.
- No magic numbers. Constants get named and grouped.
- Error messages must be actionable: "Pot size must be positive" not "Invalid input".
- No `any` type in TypeScript. If you're reaching for `any`, the type design is wrong.
- No bare `except` in Python. Catch specific exceptions.

### Python (Backend)

- Type hints on every function signature. Use `from __future__ import annotations`.
- Pydantic models for all request/response schemas. No raw dicts crossing API boundaries.
- Async everywhere in FastAPI routes. The AI service calls are I/O-bound.
- Use `pytest` for testing. Fixtures for database session, test client, mock AI responses.
- Docstrings on all public functions. Format: one-line summary, then parameters if non-obvious.
- Imports: stdlib → third-party → local, separated by blank lines.
- f-strings for string formatting. No `.format()` or `%`.

```python
# Good
async def calculate_equity(
    hole_cards: list[str],
    community_cards: list[str],
    num_opponents: int = 1,
    iterations: int = 10_000,
) -> float:
    """Monte Carlo equity calculation using eval7."""

# Bad
def calc(cards, board, n=1):
    ...
```

### TypeScript (Frontend)

- Functional components only. No class components.
- Custom hooks for any logic that touches an API, WebSocket, or browser API.
- Zustand stores are thin — business logic lives in hooks or utils, not stores.
- Name components after what they show: `ResultsPanel`, `DrillRunner`, `ChatMessage`. Not `Panel1` or `Component`.
- Use TypeScript discriminated unions for state that can be one of several shapes (e.g., drill question states: `loading | active | answered | reviewed`).
- Co-locate tests next to the file they test: `CardSelector.tsx` → `CardSelector.test.tsx`.

```typescript
// Good: discriminated union for drill state
type DrillState =
  | { status: 'loading' }
  | { status: 'active'; scenario: DrillScenario; startTime: number }
  | { status: 'answered'; userAnswer: number; correct: boolean }
  | { status: 'reviewed'; explanation: string };

// Bad: optional fields everywhere
interface DrillState {
  loading?: boolean;
  scenario?: DrillScenario;
  userAnswer?: number;
  correct?: boolean;
  explanation?: string;
}
```

### Testing

Follow TDD when working with superpowers. Red → Green → Refactor.

**Backend tests (pytest):**
- Test the poker math engine exhaustively. These are pure functions with known correct answers — no excuses for missing tests.
- Mock the AI service in all tests. Never call Gemini/Groq/Claude in tests.
- Test API endpoints with FastAPI's TestClient.
- Test edge cases: empty board (preflop equity), all-in (no bet to call), heads-up vs multiway.

**Frontend tests (vitest + testing-library):**
- Test hooks that contain calculation logic.
- Test the quick entry parser thoroughly (it handles ambiguous user input).
- Don't test styling or layout — the design system handles that.
- Test user flows, not implementation details.

**Poker math test examples (these are non-negotiable):**
```python
# Equity: AA vs random hand preflop ≈ 85% (±2%)
# Equity: AA vs KK preflop ≈ 82% (±2%)
# Pot odds: $50 bet into $100 pot = 33.3%
# EV: 40% equity, $100 pot, $50 bet = +$10
# SPR: $200 stack, $50 pot = 4.0
# MDF: pot-size bet = 50%
# Bluff break-even: pot-size bluff = 50%
# Outs: flush draw on flop = 9
# Rule of 4: 9 outs on flop = ~36%
# Rule of 2: 9 outs on turn = ~18%
```

---

## Domain Knowledge

### Poker Terminology

Use these terms consistently in code, comments, and variable names:

- **Hole cards**: the 2 private cards dealt to a player (not "hand cards" or "pocket cards" in code — use `hole_cards`)
- **Community cards**: the 5 shared cards on the board (not "board cards" — use `community_cards`)
- **Street**: preflop, flop, turn, river (not "round" — round is a full hand from deal to showdown)
- **Equity**: win probability as a percentage
- **EV**: expected value in dollar terms
- **Pot odds**: the ratio/percentage of the bet relative to the total pot after calling
- **Outs**: cards remaining in the deck that improve your hand
- **Villain**: the opponent (standard poker term, use in comments and AI prompts, not in user-facing UI)
- **Position**: UTG, MP, CO, BTN, SB, BB — always uppercase in code
- **SPR**: stack-to-pot ratio
- **MDF**: minimum defense frequency
- **VPIP**: voluntarily put money in pot
- **PFR**: preflop raise percentage

### Card Notation

Cards are represented as 2-character strings: rank + suit.
- Ranks: `2, 3, 4, 5, 6, 7, 8, 9, T, J, Q, K, A`
- Suits: `h` (hearts), `d` (diamonds), `c` (clubs), `s` (spades)
- Examples: `Ah` (ace of hearts), `Td` (ten of diamonds), `2c` (two of clubs)

This matches eval7's format. Use this everywhere — API, frontend, database, AI prompts.

### Key Formulas (reference for validation)

```
Pot Odds %     = bet_to_call / (pot + bet_to_call)
Equity Required = pot odds % (you need at least this much equity to call)
EV of calling  = (equity × pot_after_call) - ((1 - equity) × bet_to_call)
SPR            = effective_stack / pot_size
MDF            = 1 - (bet / (pot + bet))
Bluff Break-Even = bluff_size / (pot + bluff_size)
Rule of 4      = outs × 4 (flop, approximate equity to river)
Rule of 2      = outs × 2 (turn, approximate equity to river)
```

---

## File Organization

```
poker-companion/
├── CLAUDE.md              ← you are here
├── poker-calculator-spec.md  ← full product spec, read this first
├── frontend/              ← React + TypeScript + Vite
│   ├── src/
│   │   ├── components/    ← UI components grouped by feature
│   │   ├── hooks/         ← custom hooks (API calls, speech, drills)
│   │   ├── store/         ← Zustand stores
│   │   ├── utils/         ← pure functions, tooltip data, card utils
│   │   └── pages/         ← top-level page components
│   └── ...
├── backend/               ← Python + FastAPI
│   ├── app/
│   │   ├── main.py        ← FastAPI app entry point
│   │   ├── config.py      ← env vars and settings
│   │   ├── models/        ← Pydantic schemas + SQLAlchemy models
│   │   ├── routers/       ← API route handlers
│   │   ├── services/      ← business logic (poker engine, AI, PID, drills)
│   │   └── prompts/       ← AI system prompt templates
│   └── ...
└── docker-compose.yml     ← optional local dev setup
```

**New features go in this order:**
1. Backend service (pure logic, tested)
2. Backend router (API endpoint, tested with TestClient)
3. Frontend hook (API integration)
4. Frontend component (UI, using design system)

---

## AI Service Guidelines

- The AI (Gemini/Groq/Claude) is a poker coach, not a general assistant. If a user asks something unrelated to poker, the AI should redirect.
- Every AI response can optionally include a `board_update` JSON block that the frontend auto-applies. Parse this reliably.
- The Player Intelligence Document (PID) is injected into every AI call's system prompt. It's typically 1,500–3,000 tokens. Don't trim it.
- AI responses should be under 100 words during live play, longer during session review.
- Never send raw round history to the AI. Send the PID (distilled understanding) + current session rounds only.
- The AI service must be provider-agnostic. Switching from Gemini to Claude should be a one-line config change, not a code change.

---

## Common Gotchas

1. **eval7 card format**: `eval7.Card("Ah")` — the string is rank then suit, both characters. Don't pass integers or tuples.
2. **Monte Carlo iterations**: 10,000 is the default. It's fast enough for real-time use (~50ms). Don't drop below 5,000 or accuracy suffers.
3. **Pot odds vs equity required**: These are the same number. Don't calculate them separately and show two different values.
4. **Rule of 2&4 accuracy**: It's an approximation. At 15+ outs it overshoots significantly (15 × 4 = 60% but actual is ~54%). Cap or note this.
5. **Suited vs offsuit**: "AKs" means suited (4 combos), "AKo" means offsuit (12 combos), "AK" means both (16 combos). The quick entry parser must handle all three.
6. **Preflop equity**: With no community cards, eval7 Monte Carlo runs are slower because more cards need to be dealt. Consider caching preflop equity for common matchups.
7. **WebSocket reconnection**: The chat WebSocket will drop on mobile when the phone sleeps. Implement auto-reconnect with exponential backoff.
8. **Speech-to-text**: The Web Speech API is Chrome/Edge/Safari only. Firefox doesn't support it. Detect and show a fallback message.
9. **PID size**: Cap at ~4,000 words. If the AI generates a longer PID, re-prompt it to consolidate.
10. **Board_update parsing**: The AI sometimes wraps JSON in markdown code fences. Strip them before parsing.

---

## Working with Superpowers

This project uses the superpowers framework. Key principles that apply:

- **Brainstorm before building.** Read the spec, understand the feature, then plan the implementation. Don't jump to code.
- **TDD is not optional.** Write the test first. Watch it fail. Then write the code. Especially for poker math — these are pure functions with exact expected outputs.
- **YAGNI.** The spec defines the MVP. Don't add features, abstractions, or "nice to haves" that aren't in the spec. If you think something is missing, flag it — don't silently add it.
- **DRY.** The poker math formulas appear in the spec, the tooltips, the cheat sheet, and the drills. The source of truth is `poker_engine.py`. Everything else references it or its output.
- **Small, reviewable commits.** One feature or fix per commit. The commit message should explain *why*, not *what* (the diff shows *what*).

---

## Build Order Reference

Follow this sequence. Each phase builds on the previous:

1. **Phase 1 (Week 1–2):** Backend poker engine + Frontend calculator + tooltips
2. **Phase 2 (Week 3):** AI chat + WebSocket + PID system + auto-apply
3. **Phase 3 (Week 4):** Speech-to-text + round history + pot tracking + session end
4. **Phase 4 (Week 5):** Player notes + leaks + PID viewer + deploy
5. **Phase 5 (Week 6):** Training drills + graduation + session review

Don't start Phase 2 until Phase 1's tests pass and the calculator works end-to-end.