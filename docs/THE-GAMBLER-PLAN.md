# Poker Odds Companion — MVP Specification

## Project Overview

A real-time poker companion web app for Texas Hold'em. The user plays poker on another device or in person and uses this app to quickly input hand/board/action data and receive instant mathematical analysis: equity, EV, pot odds, and an AI-powered recommendation (call/raise/fold). An AI chat sidebar provides conversational coaching, scenario editing, and post-round analysis.

**Target user:** Intermediate player who knows the rules but wants to develop a mathematical/probabilistic approach to decision-making.

**Core UX principle:** Speed of input is everything. This is a companion app used mid-hand. Every interaction should be optimized for minimum taps/clicks.

**Design principle:** All UI/UX design decisions (colors, fonts, layouts, spacing, responsive breakpoints, component styling) are handled by the `ui-ux-pro-max-skill` design system. This spec defines only what the app does and what UX qualities each feature needs — not how it looks.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite | Fast dev, rich ecosystem, good for interactive UIs |
| Styling | Handled by ui-ux-pro-max-skill | Design system handles all styling decisions |
| State Management | Zustand | Lightweight, minimal boilerplate, perfect for this scale |
| Backend | Python 3.12 + FastAPI | Best ecosystem for poker math + AI API integration |
| Database | SQLite (via SQLAlchemy) | Zero-config, sufficient for single-user, easy to swap to Postgres later |
| AI Chat | Google Gemini Flash 2.0 (free tier) | 15 RPM / 1M TPD free, fast responses, good reasoning. Fallback: Groq (Llama 3.1 70B free tier). Upgrade path: Claude API for best quality |
| Speech-to-Text | Browser Web Speech API | Free, no API key needed, works in Chrome/Edge/Safari |
| Poker Engine | Custom Python + `eval7` library | Hand evaluation, equity Monte Carlo simulation, range parsing via PokerStove syntax |
| Deployment | Railway/Render (backend) + Vercel (frontend) | Cross-device sync requires hosted backend |

---

## Architecture

**Frontend (React PWA)** — installable on phone, works in browser on laptop.
Communicates with backend via REST API + WebSocket (for chat).

**Backend (FastAPI)** — three main services:
- Poker Engine: equity calc, EV, SPR, MDF, Monte Carlo, outs, combos, bluff math, quick-entry parsing
- AI Service: Gemini API wrapper, chat handler, PID manager, drill generator, review generator, context management
- Data Layer: SQLite DB storing rounds (5 full, older condensed), PID (living doc), player profiles, drill progress, session aggregates

**Auth:** Simple PIN-based middleware for single-user deployment. No signup, no email.

**Cross-device:** Backend is single source of truth. Phone (live play) and laptop (study) hit the same API server.

---

## Navigation Structure

Three tabs:

1. **Calculator** — main page, where 90% of time is spent
2. **Training** — drills and graduation tracker
3. **Player Notes** — opponent profiles, self-improvement, PID viewer

Plus one overlay:
- **Session Review** — modal triggered by "End Session" on Calculator page

---

## Page 1: Calculator

### Two Modes

The calculator has a **Live Mode / Study Mode toggle** at the top. The mode switch changes the entire page's information density.

#### Live Mode (default during a session)
Optimized for speed at the table. The user should be able to input a hand and see a recommendation in under 5 seconds.

**Quick Entry Bar:**
A single text input that parses shorthand notation. This is the primary input method in Live Mode — no card grid, no separate fields.
```
AKs 150 40        → hand: A♠K♠, pot: $150, bet to call: $40
QhJd 200 75 btn   → hand: Q♥J♦, pot: $200, bet: $75, position: BTN
99 80 20 6p       → hand: 9♠9♣, pot: $80, bet: $20, 6 players
```
Parsing rules:
- Hand: 2-4 chars. "AKs" = suited, "AKo" = offsuit, "AhKd" = specific suits, "99" = pocket pair
- Numbers: first = pot, second = bet to call
- Position suffix: btn, co, mp, utg, sb, bb
- Player count suffix: "6p" or "6 players"
- Also accepts natural language: "ace king suited, pot 150, facing 40"
- If ambiguous, auto-applies best guess with a toast notification: "Parsed as A♠K♠ — tap to correct"

**Live Mode Results — only 4 metrics shown:**
- Recommendation (CALL / RAISE / FOLD) — must be the most prominent element on screen, immediately visible at a glance
- Equity vs equity required
- EV of calling
- Outs + Rule of 2/4 result (if applicable)
- No SPR, MDF, combos, or other study-level metrics
- Tap the result to expand into full metrics without navigating away

**UX requirements for Live Mode:**
- Must be usable one-handed on a phone in portrait
- Recommendation must be readable from arm's length (large, color-coded)
- Quick entry bar must be immediately focusable — no scrolling or tapping through other UI
- Total taps from app open to seeing a recommendation: ≤ 3 (tap quick entry, type hand, press enter)
- Voice input via mic button should auto-send and auto-apply board updates (no review step)

#### Study Mode
Full-featured UI for post-session review and learning.

**Card Selector:**
- Visual representation of all 52 cards, selectable by tap
- Select hole cards (max 2), then community cards (up to 5)
- Selected cards visually distinguished from available cards
- Used/selected cards cannot be selected again
- Clear button to reset all selections
- On mobile, the selector should adapt to the smaller screen (e.g., rank-then-suit two-step selection instead of a full grid)

**Game State Inputs:**
- Street: Preflop | Flop | Turn | River — auto-inferred from community card count, manually overridable
- Players remaining: 2–10, default 6
- Pot size: numeric input with quick-increment buttons (+10, +50, +100)
- Bet to call: numeric input
- Position: UTG, MP, CO, BTN, SB, BB
- Your stack size (for SPR, effective stack, implied odds)
- Villain stack size (optional, defaults to your stack)

**Results Panel:**
Auto-calculates on every input change. Shows all metrics (see Metrics section below). Each metric has a (?) tooltip icon showing:
1. Plain-English explanation
2. The formula
3. A concrete example with numbers
4. The mental math shortcut for doing it without the app

### Auto-Accumulating Pot Tracker

The pot tracks itself across streets as actions are described via voice or chat. The user should never need to manually re-enter pot size each street.

Example flow:
```
User: "6 players, blinds 1/2, I'm on the button with AhKd"
  → pot = $3, position = BTN, 6 players

User: "I raise to 6"
  → pot = $9, user's investment tracked

User: "Two callers"
  → pot = $21, 3 players remaining

User: "Flop is Qs 7h 2d, first player bets 15"
  → community cards set, pot = $36, bet_to_call = $15, results recalculate

User: "I call, other folds"
  → pot = $51, 2 players remaining
```

The entire hand is narrated through voice/text, and the pot, bet, community cards, and player count all update automatically.

Pot tracking state:
```json
{
  "hand_pot_state": {
    "starting_pot": 3,
    "current_pot": 86,
    "current_bet_to_call": 35,
    "user_invested_this_hand": 21,
    "street_history": [
      { "street": "preflop", "pot_start": 3, "pot_end": 21, "actions": [...] },
      { "street": "flop", "pot_start": 21, "pot_end": 51, "actions": [...] }
    ],
    "players_remaining": 2
  }
}
```

### AI Chat Sidebar

**Functional requirements:**
- Always accessible from the Calculator page (sidebar on desktop, drawer on mobile)
- Chat history scrollable within the current session
- Text input field at the bottom
- Mic button for speech-to-text (Web Speech API)
- Context includes: current board state, session rounds, PID, opponent profiles
- AI is prompted as a poker math coach (see AI Prompts section)

**Voice Input (auto-apply):**
1. User taps mic → recording indicator appears
2. User speaks
3. Transcription auto-sends immediately after speech ends (no review step)
4. AI parses and auto-applies board updates
5. Every auto-applied update shows an "Undo" button (visible for 10 seconds) to revert if transcription was wrong
6. If AI is uncertain about parsing, it applies best guess AND notes the assumption

**Scenario Commands via Chat:**
The AI parses natural language and updates the board state:
- "Player 2 raised to 40" → updates pot and bet-to-call
- "The flop came Ah 7d 2c" → sets community cards
- "What if I had AK instead?" → temporarily swaps hole cards and recalculates
- "Reset the board" → clears all inputs

**AI Response Format:**
```json
{
  "message": "With 9 outs on the turn, you have ~18% equity...",
  "board_update": {
    "pot_size": 140,
    "bet_to_call": 40,
    "community_cards": ["Ah", "7d", "2c"]
  }
}
```
Frontend displays message in chat AND applies board_update to calculator inputs.

**Fallback:** If Web Speech API unavailable (Firefox), show a tooltip: "Speech input works best in Chrome, Edge, or Safari."

### Round History

- Displays a scrollable list of rounds in the current session
- Each round shows: hole cards, result (won/lost/folded), net EV
- Tap a round to view full details
- "New Round" button: saves current state to history, resets inputs
- "End Session" button: triggers session review overlay, then generates PID update and session summary

### Mental Math Cheat Sheet

A collapsible reference panel available in Study Mode containing the quick-reference rules pros use at the table. The goal is for the user to eventually internalize these and not need the app.

**Content (data, not design — the UI skill handles presentation):**

Equity from outs:
- Flop → River: Outs × 4 (e.g., 9 outs = ~36%)
- Turn → River: Outs × 2 (e.g., 9 outs = ~18%)

Common outs:
- Flush draw: 9 | OESD: 8 | Gutshot: 4 | Overcards: 6
- Flush + OESD: 15 (monster draw ~54% on flop)

Pot odds shortcut:
- ⅓ pot bet → need 25% equity to call
- ½ pot bet → need 25% equity to call
- ⅔ pot bet → need 28.5% equity to call
- ¾ pot bet → need 30% equity to call
- Pot-size bet → need 33% equity to call
- 2× pot bet → need 40% equity to call

SPR guide:
- SPR < 3: Go with top pair+. Stack-off territory.
- SPR 3–6: Top pair is good. Be cautious with marginal.
- SPR 7–13: Need two pair+ or strong draws.
- SPR > 13: Deep stacked. Speculative hands gain value.

Combos:
- Pocket pair: 6 combos | Suited hand: 4 combos | Offsuit hand: 12 combos
- Total AK: 16 combos (4 suited + 12 offsuit)

Bluff math:
- Break-even % = Bluff Size ÷ (Pot + Bluff Size)

---

## Metrics

### Core Metrics (always visible)

| Metric | Description | Tooltip | Mental Math Shortcut |
|--------|-------------|---------|----------------------|
| Hand Strength | Current hand ranking (e.g., "Pair of Kings") | "Your best 5-card hand from your 2 hole cards + community cards" | — |
| Equity % | Win probability vs opponent range | "If you played this hand 100 times against a random hand, you'd win ~X times" | Rule of 2 & 4 (see outs) |
| Pot Odds % | What % of the new pot you're paying | "Call $20 into $100 pot → you pay 20/120 = 16.7%" | Bet ÷ (Pot + Bet) |
| Pot Odds Ratio | e.g., "5:1" | "For every $1 you risk, you stand to win $5" | Pot : Bet |
| Equity Required | Minimum equity to break even | "With these pot odds, you need at least X% equity" | Same as pot odds % |
| EV (Expected Value) | +/- dollar value of calling | "EV = (Win% × Won) − (Lose% × Lost). Positive = profitable" | "Am I getting the right price?" |
| Outs | Cards that improve your hand | "9 outs for a flush draw" | Memorize: flush=9, OESD=8, gutshot=4, overcards=6 |
| Rule of 2 & 4 | Quick equity from outs | "Flop: outs × 4. Turn: outs × 2" | **The single most important shortcut in poker** |
| Recommendation | CALL / RAISE / FOLD | Color-coded with brief reasoning | — |

### Sizing & Pressure Metrics (Study Mode only)

| Metric | Description | Tooltip | Mental Math Shortcut |
|--------|-------------|---------|----------------------|
| Bet as % of Pot | Current bet relative to pot | "A $50 bet into $100 is a 50% pot bet" | Common sizes: 33%, 50%, 66%, 75%, 100% |
| SPR (Stack-to-Pot Ratio) | Effective stack ÷ pot size | "SPR < 4 = committed with top pair. SPR > 13 = deep" | Low SPR = go with top pair. High SPR = need strong hands |
| MDF (Min Defense Freq) | How often you must call to prevent villain auto-profiting with bluffs | "If villain bets pot, MDF = 50%" | 1 − (Bet ÷ (Pot + Bet)) |
| Fold Equity | Probability villain folds × pot you'd win | "Villain folds 40%, pot is $100: fold equity = $40" | Bigger bets = more fold equity |
| Break-Even % (bluffs) | How often a bluff needs to work | "Bluff $75 into $100: 75/175 = 43%" | Bluff Size ÷ (Pot + Bluff Size) |

### Contextual Metrics (shown when relevant)

| Metric | When Shown | Description | Mental Math Shortcut |
|--------|------------|-------------|----------------------|
| Implied Odds | Draws detected | Future value if you hit | "How much more can I win?" |
| Reverse Implied Odds | Draws detected | Risk of making hand but losing to better | Beware dominated draws |
| Draw Combo Count | Draws detected | How many combos of outs exist | Pairs=6, suited=4, offsuit=12 |
| Position Advantage | Preflop | Quantified edge from acting last | Later = wider range |
| Preflop Hand Tier | Preflop | Hand strength category (1–8 scale) | Open Tier 1–3 any position, Tier 4+ late position |
| Effective Stack (BB) | Always available | Shortest stack in BB | <25BB = push/fold. >100BB = speculative hands gain value |

---

## Page 2: Training

The purpose of this page is to make the user not need the app. It provides structured drills for practicing mental poker math.

### Drill System

The app generates poker scenarios and asks the user to calculate mentally before revealing the answer.

**6 Progressive Levels (unlock at 80%+ accuracy on previous level):**

**Level 1 — Outs Counting:** Given a hand and board, count the outs.
**Level 2 — Rule of 2 & 4:** Given outs count and street, calculate approximate equity.
**Level 3 — Pot Odds:** Given pot size and bet, calculate pot odds percentage.
**Level 4 — The Decision:** Combine outs → equity → pot odds → call/fold decision. Multi-step.
**Level 5 — SPR & Commitment:** Calculate SPR from stack and pot, determine commitment level.
**Level 6 — Bluff Math:** Calculate bluff break-even percentage, determine if bluff is profitable against given villain type.

Example drill interaction (Level 4):
```
Scenario: You hold A♠5♠ on K♠7♠3♦ (flop). Pot: $80. Villain bets $60.

Step 1: How many outs? → User: 9 ✅
Step 2: Equity (Rule of 4)? → User: 36 ✅
Step 3: Pot odds %? → User: 43 ✅ (60/140 = 42.8%)
Step 4: Call or fold? → User: Fold ✅
AI: "Correct! Equity (36%) < pot odds requirement (43%). However, consider
     implied odds — with a deep-stacked villain, this could be a call."
```

**Drill Settings:**
- Source: Random scenarios OR replay your own past hands from round history
- Difficulty: Auto-adjusts based on accuracy
- Speed mode: Timed drills (15 seconds per question) to simulate live game pressure
- Focus area: AI suggests which drill type to practice based on PID leaks

**Drill UX requirements:**
- Display the scenario (hand, board, pot, bet)
- Show a single input field for the user's answer
- Show immediate feedback (correct/incorrect with explanation)
- Track and display: current streak, overall accuracy, average response time
- Provide actions: next drill, switch level, review past mistakes

### Graduation Tracker

Tracks the user's progress toward not needing the app.

**Skills to Graduate (in order):**

| Skill | Graduation Criteria | What It Unlocks |
|-------|-------------------|-----------------|
| Outs Counting | 90% accuracy over 50 drills | Rule of 2 & 4 drills |
| Rule of 2 & 4 | 85% accuracy (within 5% of actual) over 50 drills | Pot Odds drills |
| Pot Odds | 85% accuracy over 50 drills | Combined Decision drills |
| Combined Decision | 80% accuracy over 30 drills | SPR & Commitment drills |
| SPR & Commitment | 80% accuracy over 30 drills | Bluff Math drills |
| Bluff Math | 80% accuracy over 30 drills | Full graduation |

**Graduation tracker must show:**
- Progress bar per skill (percentage toward graduation)
- Status per skill: graduated ✅, in progress ⏳, locked 🔒
- Current drill streak (consecutive days practiced)
- Average response time trend
- AI-generated note on what to focus on next

**Live Mode integration:**
Once a skill is graduated, the app optionally HIDES that metric in Live Mode. Instead of showing "Equity: 36%", it shows a hidden value the user taps to reveal after calculating mentally. This creates a natural transition: app does the math → app checks your math → you do the math alone.

**Accuracy tracking (stored in PID):**
```markdown
## Mental Math Progress
- Outs Counting: GRADUATED (94% accuracy, avg 3.2s)
- Rule of 2 & 4: 82% accuracy, avg 6.1s, struggling with combo draws
- Pot Odds: 45% accuracy, avg 9.4s, common error: forgetting to add bet to pot
- Speed trend: improving 0.3s/week average
- Drill streak: 12 days (longest: 18 days)
```

---

## Post-Session Guided Review

When the user clicks "End Session," the app offers an interactive walkthrough of the session's key decision points (not just a text summary).

**Flow:**
1. User clicks "End Session"
2. AI identifies the 3 hands with the largest EV gap (difference between what user did and optimal play)
3. For each hand, the AI walks the user through the decision Socratically:
   - Shows the hand scenario (hole cards, board, pot, bet, what the user did)
   - Asks the user to calculate: "How many outs?" → user answers → AI confirms/corrects
   - Then: "What's your equity?" → user answers → AI confirms/corrects
   - Then: "What are the pot odds?" → user answers → AI confirms/corrects
   - Then: "Should you have called?" → user answers → AI confirms/corrects
   - AI adds context: implied odds, position, villain tendencies
   - AI quantifies the EV left on the table
4. After all 3 hands, show session summary:
   - Decisions reviewed and lessons learned
   - PID changes highlighted ("New leak identified" / "Leak #2 improving")
   - Suggested drill focus for next practice session

**UX requirements:**
- The review must be conversational and interactive, not a wall of text
- User must answer each question before seeing the answer
- Navigation between hands (next/previous/skip to summary)
- The review is where deep learning happens — it connects drills to real hands

---

## Page 3: Player Notes & Tendencies

### Opponent Profiles

Track opponent behavior across sessions.

**Per player:**
- Name/alias
- Free-form notes field
- Tendency tags: selectable chips (Tight, Loose, Aggressive, Passive, Bluffs Often, Never Folds, Tilts Easy, etc.)
- VPIP estimate (% of hands voluntarily put money in)
- PFR estimate (pre-flop raise %)
- Aggression notes per street
- Key hands: save notable hands played against them with brief notes

**AI Integration:**
- "Analyze Player X" button → sends player data + recent hands to AI for strategy summary
- "How should I play against this type?" → AI provides positional and sizing advice

### Self-Improvement Section ("My Leaks")

- A list the user and AI can add to (e.g., "I call too wide on the river", "I don't 3-bet enough from the blinds")
- After each session, AI suggests new leaks or confirms fixed ones based on round history
- Improvement tips linked to specific metrics
- Leaks are ranked by estimated EV impact

### PID Viewer

- User can read their full Player Intelligence Document (see PID section below)
- User can manually edit/correct the PID if the AI got something wrong
- Shows version history of PID changes

---

## Data Model

### Round (full detail — last 5)
```json
{
  "id": "uuid",
  "session_id": "uuid",
  "round_number": 1,
  "timestamp": "2026-05-31T14:30:00Z",
  "hole_cards": ["Ah", "Kd"],
  "community_cards": ["7h", "2d", "9c", "Qs", "3h"],
  "num_players": 6,
  "position": "CO",
  "streets": [
    {
      "street": "preflop",
      "pot_before": 15,
      "actions": [
        { "player": "self", "action": "raise", "amount": 30 },
        { "player": "opponent", "action": "call", "amount": 30 }
      ],
      "pot_after": 75,
      "equity_at_decision": 0.65,
      "ev_at_decision": 12.5
    }
  ],
  "result": "won",
  "profit": 120,
  "notes": "Villain called two barrels then folded river"
}
```

### Round (condensed — older than 5)
```json
{
  "id": "uuid",
  "session_id": "uuid",
  "round_number": 1,
  "timestamp": "2026-05-31T14:30:00Z",
  "hole_cards": ["Ah", "Kd"],
  "result": "won",
  "profit": 120,
  "key_decision": "Called river with top pair, opponent had a bluff",
  "lesson": "Good call — pot odds justified it"
}
```

### Player Profile
```json
{
  "id": "uuid",
  "name": "Mike",
  "tags": ["Loose", "Aggressive"],
  "vpip_estimate": 35,
  "pfr_estimate": 25,
  "notes": "Opens wide from late position, folds to 3-bets often",
  "key_hands": [],
  "created_at": "2026-05-31T14:00:00Z"
}
```

### Session Aggregates (kept indefinitely)
```json
{
  "session_id": "uuid",
  "date": "2026-05-31",
  "total_rounds": 45,
  "rounds_won": 12,
  "total_profit": 340,
  "avg_ev_per_decision": 8.5,
  "biggest_pot_won": 280,
  "biggest_pot_lost": 150,
  "fold_percentage": 0.62,
  "vpip": 0.33,
  "ai_session_summary": "Played tight-aggressive. Biggest leak: calling river bets without enough equity."
}
```

---

## API Endpoints

### Poker Engine
```
POST /api/calculate
  Body: { hole_cards, community_cards, num_players, pot_size, bet_to_call,
          position, your_stack, villain_stack }
  Returns: { equity, ev, pot_odds, pot_odds_ratio, equity_required, outs,
             rule_of_2_4, hand_rank, bet_pot_percentage, implied_odds,
             spr, mdf, fold_equity, bluff_break_even, effective_stack_bb,
             preflop_hand_tier, draw_combos, recommendation }

POST /api/outs
  Body: { hole_cards, community_cards }
  Returns: { outs: [{ card, hand_made }], total_outs, rule_of_2, rule_of_4 }
```

### AI Chat
```
WebSocket /ws/chat
  Send: { message, board_state, session_rounds }
  Receive: { message, board_update? }
  Note: PID is loaded server-side and injected into AI context automatically
```

### Player Intelligence Document
```
GET    /api/pid                       — Get current PID markdown
PUT    /api/pid                       — Manual edit to PID (user corrections)
POST   /api/pid/update                — Trigger AI rewrite after session end
GET    /api/pid/history               — Version history of PID changes
```

### Rounds
```
POST   /api/rounds                    — Save a round
GET    /api/rounds?session={id}       — Get rounds for a session
GET    /api/rounds/{id}               — Get round detail
DELETE /api/rounds/{id}               — Delete a round
POST   /api/sessions                  — Start new session
GET    /api/sessions/{id}/summary     — AI-generated session summary
```

### Player Profiles
```
POST   /api/players                   — Create player
GET    /api/players                   — List all players
PUT    /api/players/{id}              — Update player
DELETE /api/players/{id}              — Delete player
POST   /api/players/{id}/analyze      — AI analysis of player tendencies
```

### Quick Entry
```
POST /api/parse-quick-entry
  Body: { input: "AKs 150 40 btn 6p" }
  Returns: { hole_cards, pot_size, bet_to_call, position, num_players,
             confidence: 0.95, assumptions: ["Assigned default suits: A♠K♠"] }
```

### Training Drills
```
POST   /api/drills/generate           — Generate a drill scenario for a given level
  Body: { level: "pot_odds", source: "random" | "history" }
  Returns: { scenario, question, correct_answer, hints }

POST   /api/drills/check              — Check user's answer
  Body: { drill_id, user_answer }
  Returns: { correct, actual_answer, explanation, accuracy_delta }

GET    /api/drills/progress            — Get graduation progress per skill
PUT    /api/drills/progress            — Update accuracy stats after drill

POST   /api/session/review             — Generate guided review for a session
  Body: { session_id }
  Returns: { review_hands: [{ hand_data, ev_gap, ai_questions }], summary }
```

---

## Poker Math Engine — Implementation Details

### Equity Calculation
Use `eval7` library (`pip install eval7`):
- Hand evaluation: `eval7.evaluate(hand)` — returns rank integer, lower is better
- Monte Carlo equity: `eval7.py_hand_vs_range_monte_carlo(hand, range, board, iterations)`
- Range parsing: supports PokerStove syntax (e.g., "AA,KK,AKs,QQ" or "22+,A2s+,KTo+")
- For MVP: equity vs random hand (empty range = all hands)
- Future: equity vs estimated villain range for more accurate calculations
- Run 10,000+ iterations for accuracy, return win probability as percentage

### EV Calculation
```
EV_call = (equity × pot_after_call) - ((1 - equity) × bet_to_call)
EV_fold = 0
EV_raise = requires assumptions about opponent fold frequency (use AI for this)
```

### Pot Odds
```
pot_odds_pct = bet_to_call / (pot_size + bet_to_call)
pot_odds_ratio = (pot_size + bet_to_call) : bet_to_call
```

### Outs Detection
Map draw types to out counts:
- Flush draw: 9 outs
- Open-ended straight draw: 8 outs
- Gutshot straight draw: 4 outs
- Two overcards: 6 outs
- Set to full house: 7 outs
- Flush draw + OESD: 15 outs (monster draw)
Combine and de-duplicate when multiple draws exist.

### Rule of 2 & 4
```python
def rule_of_2_4(outs: int, street: str) -> float:
    if street == "flop":
        return min(outs * 4, 100)
    elif street == "turn":
        return min(outs * 2, 100)
    return 0
```

### SPR (Stack-to-Pot Ratio)
```python
def spr(effective_stack: float, pot_size: float) -> float:
    if pot_size == 0:
        return float('inf')
    return effective_stack / pot_size
```

### MDF (Minimum Defense Frequency)
```python
def mdf(bet_size: float, pot_size: float) -> float:
    return 1 - (bet_size / (pot_size + bet_size))
```

### Bluff Break-Even %
```python
def bluff_break_even(bluff_size: float, pot_size: float) -> float:
    return bluff_size / (pot_size + bluff_size)
```

### Fold Equity
```python
def fold_equity(fold_probability: float, pot_size: float) -> float:
    return fold_probability * pot_size
```

### Effective Stack
```python
def effective_stack(your_stack: float, villain_stack: float, bb: float = 1) -> dict:
    eff = min(your_stack, villain_stack)
    return {
        "effective_stack": eff,
        "effective_stack_bb": eff / bb if bb > 0 else 0,
        "stack_depth": "short" if eff/bb < 25 else "medium" if eff/bb < 80 else "deep"
    }
```

### Preflop Hand Tier
```python
HAND_TIERS = {
    1: ["AA", "KK"],
    2: ["QQ", "JJ", "AKs"],
    3: ["TT", "AQs", "AKo", "AJs"],
    4: ["99", "AQo", "ATs", "KQs"],
    5: ["88", "77", "KJs", "KTs", "QJs", "AJo", "ATo"],
    6: ["66", "55", "KQo", "KJo", "QTs", "JTs", "A9s-A2s"],
    7: ["44", "33", "22", "T9s", "98s", "87s", "76s", "65s", "KTo", "QJo"],
    8: ["J9s", "T8s", "97s", "86s", "75s", "54s", "Q9s", "remaining suited"],
}
```

### Recommendation Engine
```python
def recommend(equity, equity_required, ev_call, spr, street, position, outs):
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

---

## AI Chat — Prompt Engineering

### System Prompt
```
You are a concise poker math coach embedded in a real-time Hold'em companion app.

CONTEXT (injected per message):
- Current board state: {board_state}
- Player Intelligence Document (your long-term scouting notes on this player): {pid}
- Recent rounds this session: {session_rounds}
- Player profiles (opponents): {player_profiles}

RULES:
1. Keep responses under 100 words unless analyzing a full round.
2. Always reference specific numbers: equity %, EV, pot odds.
3. Never say "it depends" without following up with the math.
4. When the user describes game actions via voice or text, auto-apply
   the update. Return a board_update JSON block:
   {"board_update": {"field": "value"}}
   If you're uncertain about parsing, apply your best guess AND note
   the assumption so they can correct it.
5. When analyzing past rounds, identify the specific decision point
   where EV was left on the table and quantify it.
6. Connect advice to the player's known leaks and improvement goals
   from the PID. Example: "This is your river over-calling leak again —
   you've cut it from 55% to 40%, keep folding these."
7. Track mental math usage: if the player asks "what are my outs?"
   instead of calculating themselves, gently prompt them to try first:
   "Quick — count your outs before I tell you. Flush draw = ?"

PERSONALITY: Direct, numbers-first, encouraging but honest.
No fluff. Think like a patient math tutor at the poker table.
```

### Example Interactions
```
User: "Player 3 raised to 60"
AI: "Updated pot to $135, you need to call $60. Pot odds are
     30.8% — you need at least 30.8% equity to break even.
     With your current hand, you have ~42% equity. +EV call."
     {"board_update": {"pot_size": 135, "bet_to_call": 60}}

User: "Analyze last round"
AI: "Round 3: You folded QJs on the button facing a 3-bet.
     Your equity was ~38% vs a typical 3-bet range. Pot odds
     were 25%. This was actually a profitable call — you left
     about $12 in EV on the table."

User: "What are my outs?"
AI: "You have Jh Th on a board of 9c 8d 2h.
     Outs: any Q or 7 for a straight (8 outs — open-ended).
     Rule of 4: ~32% to hit by the river. You need pot odds
     better than 32% to call profitably."
```

---

## Speech-to-Text Implementation

Use the browser-native Web Speech API (free, no API key):

```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Auto-send to chat immediately (no review step)
  sendToChat(transcript);
};
```

---

## Round Memory System

### Strategy
| Category | Storage | Content |
|----------|---------|---------|
| Last 5 rounds | Full JSON in SQLite | All streets, actions, equity snapshots, notes |
| Rounds 6–20 | Condensed in SQLite | Hole cards, result, profit, AI-generated key takeaway |
| Rounds 21+ | Deleted | Session-level aggregate stats retained |

### Condensation Process
When round 6 is saved, round 1 gets condensed:
1. AI generates a one-line "key_decision" and "lesson" from the full round data
2. Full street-by-street data is deleted
3. Condensed version is stored

---

## Player Intelligence Document (PID)

### The Problem
Raw round history doesn't scale. Stuffing 50 rounds into AI context wastes tokens and loses the signal in noise. The AI needs a distilled understanding of the player, not a database dump.

### The Solution
A living markdown document per user account, stored in the database, that the AI reads on every chat message AND writes to after every session. Think of it as the AI's personal scouting notes that get sharper over time.

### Document Structure
```markdown
# Player Intelligence Document
Last updated: 2026-06-15 after Session #23

## Player Profile Summary
- Sessions played: 23
- Total rounds tracked: 412
- Overall profit/loss: +$1,240
- Win rate: 58% of showdowns
- Estimated VPIP: 28% (tightening trend since Session 18)
- Estimated PFR: 19%
- Primary style: TAG (Tight-Aggressive)

## Strengths (AI-identified)
- Strong preflop hand selection
- Good bet sizing on value hands (typically 60–75% pot)
- Improved 3-bet frequency from CO/BTN over last 5 sessions

## Leaks (AI-identified, ranked by EV impact)
1. **River calling too wide** (-$18/session avg) — Calls river bets with
   second pair or worse ~40% of the time. Equity usually <25%.
   TREND: Improving. Was 55% in Sessions 1-10, now 40%.
2. **Insufficient c-bet on dry boards** (-$12/session avg)
3. **Overvalues suited connectors OOP** (-$8/session avg)

## Tendencies by Street
### Preflop
- Opens 22% from EP, 35% from LP
- 3-bets ~8% (slightly below optimal 10-12%)
### Flop
- C-bets 55% (should be 60-70% on dry boards)
### Turn
- Good barrel frequency with strong draws
### River
- Calls too wide (see Leak #1)
- Bluffing frequency: low (~15%), could increase to 25% in position

## Pattern Recognition
- Plays tighter in first 30 minutes (warming up)
- Loosens after winning a big pot (mild tilt toward LAG)
- OOP win rate is 12% lower than IP

## Recent Session Notes
### Session 23 (2026-06-15)
Key hand: Called river shove with KQ on K-high board vs tight player. Lost to AK.
Session profit: -$45.

## Improvement Roadmap
### Currently Working On
- Reduce river call frequency with marginal hands (target: <30%)
- Increase c-bet frequency on dry boards (target: >65%)
### Completed
- ✅ Widen opening range from CO/BTN (was 25%, now 35%) — Session 12
- ✅ Stop open-limping preflop — Session 8
```

### How the PID Updates

**After every session (full rewrite):**
The AI receives the current PID + all rounds from the session and generates an updated PID as a background task when the user clicks "End Session."

```python
async def update_pid_after_session(user_id: str, session_rounds: list):
    current_pid = await db.get_pid(user_id)
    prompt = f"""
    You are updating a poker player's intelligence document.

    CURRENT DOCUMENT:
    {current_pid}

    NEW SESSION DATA ({len(session_rounds)} rounds):
    {json.dumps(session_rounds)}

    INSTRUCTIONS:
    1. Update all statistics (sessions played, profit, win rate, etc.)
    2. Re-evaluate leaks — are any improving? New ones emerging?
    3. Update tendencies if the data shows change
    4. Add a session note (2-3 sentences max)
    5. Update the improvement roadmap
    6. Be specific with numbers. "Calls too wide" is bad.
       "Calls river bets 40% of the time with <25% equity" is good.

    Return the complete updated document.
    """
    updated_pid = await ai_service.generate(prompt)
    await db.save_pid(user_id, updated_pid)
```

### PID Storage
```json
{
  "user_id": "uuid",
  "pid_markdown": "# Player Intelligence Document\n...",
  "version": 23,
  "last_updated": "2026-06-15T18:30:00Z",
  "word_count": 850,
  "sessions_incorporated": 23
}
```

Maximum PID size: ~4,000 words. If it exceeds this, the AI consolidates older session notes and merges redundant observations. The document gets sharper over time, not longer.

---

## Educational Tooltips

Every metric has a (?) icon. Tooltips are hardcoded in the frontend (no API call needed). Each tooltip contains:

```typescript
const tooltips = {
  equity: {
    title: "Equity",
    what: "Your probability of winning the hand if it goes to showdown.",
    formula: "Equity = (Simulated Wins + Ties/2) / Total Simulations",
    example: "You hold A♠K♠ on Q♠J♠3♦. Monte Carlo shows you win ~45% of the time.",
    mentalMath: "Use the Rule of 2 & 4: count outs, multiply by 4 on the flop or 2 on the turn."
  },
  ev: {
    title: "Expected Value (EV)",
    what: "The average amount you'd win or lose if you made this decision thousands of times.",
    formula: "EV = (Equity × Pot After Call) − ((1 − Equity) × Bet to Call)",
    example: "Pot $100, bet $50, equity 40%. EV = (0.40 × $150) − (0.60 × $50) = +$30.",
    mentalMath: "Quick check: are my pot odds better than my equity? If yes, it's +EV."
  },
  spr: {
    title: "Stack-to-Pot Ratio (SPR)",
    what: "How deep your effective stack is relative to the pot.",
    formula: "SPR = Effective Stack ÷ Pot Size",
    example: "You have $200 behind, pot is $50. SPR = 4. Top pair is strong enough to stack off.",
    mentalMath: "SPR < 3 = go with top pair. SPR > 13 = need very strong hands or big draws."
  },
  mdf: {
    title: "Minimum Defense Frequency (MDF)",
    what: "How often you must call to prevent villain from profiting by bluffing with any two cards.",
    formula: "MDF = 1 − (Bet ÷ (Pot + Bet))",
    example: "Villain bets $100 into $100 pot. MDF = 50%. Call at least 50% of your range.",
    mentalMath: "Pot-size bet = defend 50%. Half-pot bet = defend 67%."
  },
  bluffBreakEven: {
    title: "Bluff Break-Even %",
    what: "How often your bluff needs to make the opponent fold to be profitable.",
    formula: "Break-Even = Bluff Size ÷ (Pot + Bluff Size)",
    example: "Bluff $75 into $100. Break-even = 75/175 = 43%.",
    mentalMath: "Half-pot bluff needs to work 33%. Pot-size bluff needs to work 50%."
  },
  ruleOf2And4: {
    title: "Rule of 2 & 4",
    what: "Quick way to convert outs into approximate equity without a calculator.",
    formula: "Flop: Outs × 4. Turn: Outs × 2.",
    example: "9 outs (flush draw). Flop: 9 × 4 = 36%. Turn: 9 × 2 = 18%.",
    mentalMath: "This IS the mental math. Memorize: flush=9(36%/18%), OESD=8(32%/16%), gutshot=4(16%/8%)."
  }
};
```

---

## File & Folder Structure

```
poker-companion/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CardSelector/
│   │   │   ├── Calculator/
│   │   │   ├── Chat/
│   │   │   ├── RoundHistory/
│   │   │   ├── PlayerNotes/
│   │   │   ├── Training/
│   │   │   └── SessionReview/
│   │   ├── hooks/
│   │   │   ├── usePokerCalculator.ts
│   │   │   ├── useChat.ts
│   │   │   ├── useSpeechToText.ts
│   │   │   ├── useRounds.ts
│   │   │   ├── useDrills.ts
│   │   │   └── useQuickEntry.ts
│   │   ├── store/
│   │   │   ├── gameStore.ts
│   │   │   ├── chatStore.ts
│   │   │   ├── roundStore.ts
│   │   │   └── trainingStore.ts
│   │   ├── utils/
│   │   │   ├── cardUtils.ts
│   │   │   └── tooltipData.ts
│   │   ├── pages/
│   │   │   ├── CalculatorPage.tsx
│   │   │   ├── PlayerNotesPage.tsx
│   │   │   └── TrainingPage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   │   ├── schemas.py
│   │   │   └── database.py
│   │   ├── routers/
│   │   │   ├── calculate.py
│   │   │   ├── chat.py
│   │   │   ├── rounds.py
│   │   │   └── players.py
│   │   ├── services/
│   │   │   ├── poker_engine.py
│   │   │   ├── ai_service.py
│   │   │   ├── pid_service.py
│   │   │   ├── drill_service.py
│   │   │   ├── quick_entry_parser.py
│   │   │   └── round_manager.py
│   │   └── prompts/
│   │       └── coach.py
│   ├── requirements.txt
│   └── .env.example
│
├── README.md
└── docker-compose.yml
```

---

## MVP Build Order

### Phase 1 — Core Calculator (Week 1–2)
1. Backend: poker engine with eval7 (equity, EV, pot odds, outs, SPR, MDF, bluff break-even, recommendation)
2. Frontend: card selector + game inputs + quick entry bar
3. Frontend: results panel with auto-calculation (core + contextual metrics)
4. Wire up frontend ↔ backend API
5. Add educational tooltips to all metrics (including mentalMath field)
6. Frontend: collapsible mental math cheat sheet

### Phase 2 — AI Chat + PID (Week 3)
1. Backend: Gemini API integration + prompt engineering
2. Backend: WebSocket chat endpoint
3. Frontend: chat sidebar/drawer with message history
4. Parse AI responses for board_update JSON and auto-apply to UI
5. Implement undo button for auto-applied changes (10s timeout)
6. Implement auto-accumulating pot tracker via chat commands
7. Test scenario commands ("player raised to X", "what if I had Y")
8. Backend: Player Intelligence Document — create, read, update
9. Wire PID into AI system prompt context

### Phase 3 — Speech & History (Week 4)
1. Frontend: speech-to-text with auto-send (no review step)
2. Backend: round storage + condensation logic
3. Frontend: round history display with save/load
4. Backend: session end → AI rewrites PID with new session data
5. Backend: session summary endpoint (AI-generated)
6. Connect chat context to PID + session rounds

### Phase 4 — Player Notes & Polish (Week 5)
1. Backend + Frontend: opponent player profiles CRUD
2. Frontend: tendency tags, VPIP/PFR inputs
3. Frontend: "My Leaks" self-improvement section (seeded from PID)
4. AI integration: opponent analysis, leak detection, improvement roadmap
5. Frontend: PID viewer — let user read and manually edit their intelligence doc
6. Live Mode / Study Mode toggle
7. Deploy: Vercel (frontend) + Railway (backend) with PIN auth

### Phase 5 — Training & Graduation (Week 6)
1. Backend: drill generation service (random + history-based scenarios)
2. Backend: answer checking + accuracy tracking
3. Frontend: drill runner UI (question, input, feedback loop)
4. Frontend: graduation tracker (progress per skill, streaks, unlocks)
5. Backend: post-session guided review (identify top 3 EV-gap hands, generate AI questions)
6. Frontend: review walkthrough UI
7. Integration: graduated skills hide metrics in Live Mode (tap-to-reveal)
8. Integration: PID includes mental math progress section

---

## Free AI API Setup

### Option A: Google Gemini (Recommended)
- Model: `gemini-2.0-flash` (free tier)
- Limits: 15 requests/minute, 1M tokens/day
- Sign up: https://aistudio.google.com/apikey
- SDK: `pip install google-genai`

### Option B: Groq
- Model: `llama-3.1-70b-versatile` (free tier)
- Limits: 30 requests/minute, 14,400 requests/day
- Sign up: https://console.groq.com
- SDK: `pip install groq`

### Option C: Claude API (Upgrade Path)
- Model: `claude-sonnet-4-20250514`
- Best quality reasoning, but paid ($3/1M input tokens)
- SDK: `pip install anthropic`

**The AI service layer should be provider-agnostic** — swapping between Gemini/Groq/Claude is a one-line config change.

```python
class AIService:
    def __init__(self, provider: str = "gemini"):
        self.provider = provider

    async def chat(self, message: str, context: dict) -> dict:
        prompt = build_prompt(message, context)
        if self.provider == "gemini":
            return await self._gemini_chat(prompt)
        elif self.provider == "groq":
            return await self._groq_chat(prompt)
        elif self.provider == "claude":
            return await self._claude_chat(prompt)
```

---

## Environment Variables

```bash
# .env
AI_PROVIDER=gemini               # gemini | groq | claude
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here       # if using Groq
ANTHROPIC_API_KEY=your_key_here  # if using Claude
USER_PIN=your_pin_here           # simple auth for single-user deployment
DATABASE_URL=sqlite:///./poker.db
MONTE_CARLO_ITERATIONS=10000
CORS_ORIGINS=http://localhost:5173
```

---

## Key Assumptions & Decisions

1. **Single-user app** — PIN-protected deployment, no full auth system
2. **Texas Hold'em only** — no Omaha, Stud, etc.
3. **Opponent range = random for MVP** — eval7 supports range parsing for future upgrade
4. **No real-money integration** — this is a calculator, not a poker platform
5. **Deployed from the start** — cross-device sync requires hosted backend (Railway + Vercel free tiers)
6. **PWA** — installable on phone via browser, no app store needed
7. **Browser Speech API** — free but Chrome-dependent, acceptable for MVP
8. **AI is advisory only** — recommendations are probabilistic, not guarantees. Include a disclaimer
9. **UI design handled by ui-ux-pro-max-skill** — this spec defines features and UX requirements, not visual design

---

## UX Requirements Summary

These requirements define what the UI must achieve functionally. The design skill handles how.

| Requirement | Context | Priority |
|-------------|---------|----------|
| Input to recommendation in ≤3 taps | Live Mode on phone | Critical |
| Recommendation visible at a glance from arm's length | Live Mode on phone | Critical |
| Voice commands auto-apply without review step | Live Mode | Critical |
| Undo button for auto-applied changes (10s timeout) | Live Mode | High |
| Card selection must be fast and error-resistant | Both modes | High |
| Chat accessible without leaving calculator | Both modes | High |
| Full metrics expandable from Live Mode without page navigation | Live Mode | High |
| Cheat sheet accessible as quick reference during study | Study Mode | Medium |
| Works on phone (portrait, one-handed) AND laptop | Both modes | Critical |
| Keyboard shortcuts for power users on desktop | Study Mode | Medium |
| Drill feedback is immediate (no page reload) | Training | High |
| Session review is interactive/conversational, not a text dump | Session Review | High |

---

## Future Enhancements (Post-MVP)

- Opponent range editor (hand matrix grid)
- GTO solver integration for more precise equity
- Hand history import from PokerStars/GGPoker
- Multi-table support
- Heads-up display (HUD) overlay mode
- Native mobile app (React Native)
- Multiplayer mode (share a session with study group)
- Bankroll management tracker
- Tournament ICM calculations