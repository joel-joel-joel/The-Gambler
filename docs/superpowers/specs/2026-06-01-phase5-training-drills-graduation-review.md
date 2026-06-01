# Phase 5 Design Spec — Training Drills + Graduation + Session Review

**Date:** 2026-06-01
**Status:** Approved

---

## 1. Database Models

### `DrillAttempt` table

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | auto-increment |
| user_id | String | default "default" |
| skill | String | "outs", "rule_of_2_4", "pot_odds", "the_decision", "spr_commitment", "bluff_math" |
| scenario | Text | JSON: the generated scenario data |
| correct_answer | Float | the actual answer |
| user_answer | Float | what the user entered |
| is_correct | Integer | 0 or 1 |
| response_time_ms | Integer | how long user took |
| explanation | Text | nullable, AI-generated post-answer explanation |
| source | String | "random" or "history" |
| session_id | Integer | nullable, if source is "history" |
| created_at | DateTime | UTC |

### `SkillProgress` table

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | auto-increment |
| user_id | String | default "default" |
| skill | String | unique per user |
| total_attempts | Integer | default 0 |
| correct_count | Integer | default 0 |
| current_accuracy | Float | rolling percentage (0.0–1.0) |
| status | String | "locked", "active", "graduated" |
| streak_days | Integer | consecutive days practiced |
| last_attempt_date | String | nullable, YYYY-MM-DD |
| best_streak | Integer | longest streak ever |
| avg_response_time_ms | Integer | rolling average |
| graduated_at | DateTime | nullable |
| created_at | DateTime | UTC |

### Unlock rules

- Level 1 (`outs`): starts `active`
- Levels 2-6: start `locked`, unlock when the previous level graduates
- Level 4 (`the_decision`) requires levels 1-3 all graduated

---

## 2. Drill Scenario Engine

### Skill definitions

| Skill | Graduation Threshold | Required Attempts | Tolerance | Speed Timer |
|-------|---------------------|-------------------|-----------|-------------|
| outs | 90% accuracy | 50 | exact count | 15s |
| rule_of_2_4 | 85% accuracy | 50 | within 5% of actual | 15s |
| pot_odds | 85% accuracy | 50 | within 2% | 15s |
| the_decision | 80% accuracy | 30 | call/fold match | 15s |
| spr_commitment | 80% accuracy | 30 | within 0.5 SPR | 15s |
| bluff_math | 80% accuracy | 30 | within 3% | 15s |

### Generator pattern

Each skill has a `generate_<skill>_drill()` function:

1. Randomly pick 2 hole cards + 3-4 community cards from a standard 52-card deck
2. Randomize pot size (20–500), bet size (10–250), stack sizes (50–1000) within realistic ranges
3. Call the relevant `poker_engine.py` function to compute the correct answer
4. Return `{ scenario_data, question_text, correct_answer, answer_type }`

**`scenario_data` contains:** hole_cards, community_cards, pot_size, bet_to_call, your_stack (as applicable per skill).

**answer_type:** `"integer"` (outs), `"percentage"` (equity, pot odds, bluff math), `"decision"` (call/fold), `"decimal"` (SPR).

### History-based source

If `source="history"`, pull a random `RoundRecord` from the user's past sessions. Build the scenario from its actual cards, pot, and bet. Fall back to random if no rounds exist.

### Answer checking

Each skill has a `check_<skill>_answer(user_answer, correct_answer)` function that compares using skill-specific tolerance. Returns `is_correct` boolean.

### AI explanation

After checking, optionally call `chat_with_ai()` with the scenario + user answer + correct answer. AI generates a 1-2 sentence explanation. Non-blocking — "correct/incorrect" feedback is instant, explanation appears after.

---

## 3. REST API Endpoints

### Drill router (`/api/drills`)

| Method | Path | Body/Params | Returns |
|--------|------|-------------|---------|
| POST | `/api/drills/generate` | `{ skill, source }` | `{ drill_id, scenario, question_text, answer_type }` |
| POST | `/api/drills/check` | `{ drill_id, user_answer, response_time_ms }` | `{ is_correct, correct_answer, explanation, accuracy_now, graduated }` |
| GET | `/api/drills/progress` | — | Array of SkillProgress per skill |
| GET | `/api/drills/history` | `?skill=outs&limit=50` | Array of recent DrillAttempt rows |
| GET | `/api/drills/focus` | — | `{ suggested_skill, reason }` (AI-powered) |

**Pending drill state:** `/generate` creates a `PendingDrill` stored in a server-side dict keyed by `drill_id` (UUID). `/check` looks it up, validates, saves the DrillAttempt, updates SkillProgress, and deletes the pending entry. The correct answer is never sent to the frontend before the user answers.

### Session review endpoints (added to sessions router)

| Method | Path | Body/Params | Returns |
|--------|------|-------------|---------|
| POST | `/api/sessions/{id}/review` | — | `{ hands: [{ scenario, questions, ev_gap }] }` |
| POST | `/api/sessions/{id}/review/check` | `{ hand_index, question_index, user_answer }` | `{ is_correct, correct_answer, explanation }` |

---

## 4. Session Review Service

### Step 1 — Find top 3 EV-gap hands

- Pull all `RoundRecord` rows for the session
- For each round with hole cards + community cards + pot + bet + result:
  - Recalculate optimal equity via `calculate_equity()`
  - Recalculate EV of calling via `calculate_ev()`
  - Compare optimal action (call if +EV, fold if -EV) to what user did
  - Compute `ev_gap = abs(optimal_ev - actual_ev)`
- Sort by `ev_gap` descending, take top 3

### Step 2 — Generate Socratic questions per hand

Each hand gets 4 sequential questions (deterministic, no AI):

1. "How many outs do you have?" → `detect_outs()`
2. "What's your equity?" → `rule_of_2_4()` or `calculate_equity()`
3. "What are the pot odds?" → `calculate_pot_odds()`
4. "Should you call or fold?" → call if equity > pot_odds, else fold

Each question: `{ question_text, correct_answer, answer_type, tolerance }`.

### Step 3 — AI explanation per hand

After all 4 questions answered, AI generates:
- 2-3 sentence explanation with context (position, implied odds)
- EV left on the table in dollar terms
- Connection to specific leaks if applicable

### Step 4 — Session summary

After all 3 hands reviewed:
- Lessons learned per hand
- PID changes highlighted (reads LeakRecord for the session)
- Suggested drill focus: maps weakest review answers to drill skills

### Storage

Review results are not persisted — generated on demand from round data. Review answers are ephemeral.

---

## 5. Frontend: Training Page

### Navigation

Add "Training" tab to header nav: Calculator | Players | My Game | **Training**. New `TabId` value `"training"`.

### Design system integration

Follows `design-system/the-gambler/MASTER.md`. Training-specific tokens:

| Role | Value | Usage |
|------|-------|-------|
| Correct feedback | `text-emerald-400` / `bg-emerald-900` | Drill correct answer |
| Incorrect feedback | `text-red-400` / `bg-red-900` | Drill wrong answer |
| Partial/close | `text-amber-400` / `bg-amber-900` | Within tolerance but not exact |
| Graduated badge | `bg-emerald-800 text-emerald-200` | Skill completed |
| Active badge | `bg-gold-700 text-stone-100` | Skill in progress |
| Locked badge | `bg-surface-raised text-stone-500` | Skill not yet unlocked |
| Timer bar | gradient `bg-gold` to `bg-red-500` | Countdown |
| Streak flame | `text-amber-400` | Streak icon |
| Progress bar fill | `bg-gold` | Default fill |
| Progress bar track | `bg-surface-raised` | Bar background |

### Page layout (single scrollable page, 4 sections)

**Section 1 — Drill Runner** (top, main action):
- Skill selector: horizontal chips, locked ones `opacity-50 cursor-not-allowed`
- "AI Suggest" button: calls `/api/drills/focus`
- Speed mode toggle (clock icon)
- Scenario display: card visuals (hole cards `bg-gold-700`, community cards `bg-emerald-900`), pot/bet/stack in `font-mono`
- Question text: `text-stone-200 text-lg font-semibold`
- Single input field (numeric or call/fold toggle for `the_decision`)
- Timer bar when speed mode on: `h-1 rounded-full`, gold→red gradient, 15s countdown
- Submit button: gold primary
- Feedback: 100ms scale animation on correct, shake on incorrect, AI explanation fades in
- "Next Drill" button after feedback
- Source toggle: "Random" / "From History"

**Section 2 — Graduation Tracker:**
- One row per skill, in order
- Each row: skill name, progress bar (`h-2 rounded-full`), accuracy `font-mono`, status badge
- Accuracy colored by threshold (green meeting, amber close, red below)
- Streak display: flame icon + days in `font-mono text-amber-400`

**Section 3 — Session Reviews:**
- List of past sessions with review available
- Each: session date, rounds played, "Review" button
- Active review: step-through cards with scenario → questions → feedback → next
- Answer input hidden until question active, reveal with 200ms fade-in
- Navigation: "Next Question" / "Next Hand" / "See Summary"

**Section 4 — Drill History:**
- Collapsible, recent 20 attempts
- Each row: skill, correct/incorrect badge, response time, date

### Zustand store: `trainingStore.ts`

- `currentDrill: PendingDrill | null`
- `skillProgress: SkillProgress[]`
- `drillHistory: DrillAttempt[]`
- `isGenerating: boolean`
- `isChecking: boolean`
- `speedMode: boolean`
- `timerActive: boolean`
- `timerRemaining: number`
- `mentalMathMode: boolean`
- `graduatedSkills: Set<string>` (computed from skillProgress)

---

## 6. Live Mode Tap-to-Reveal

### Metric → skill mapping

| Metric in ResultsPanel | Drill Skill |
|------------------------|------------|
| Outs count | `outs` |
| Rule of 2&4 | `rule_of_2_4` |
| Pot odds | `pot_odds` |
| EV / recommendation | `the_decision` |
| SPR | `spr_commitment` |
| MDF / bluff break-even | `bluff_math` |

### Implementation

- `trainingStore` exposes `graduatedSkills` set and `mentalMathMode` boolean
- `ResultsPanel.tsx` reads both from the store
- For each metric: if `mentalMathMode && graduatedSkills.has(skillKey)`, render value with `blur-sm` class and "Calculate first" label in `text-xs text-stone-500`
- On click/tap: remove blur with `transition-all duration-200`
- "Mental Math Mode" toggle available in Training page header
- On app load, `useTraining` hook fetches `/api/drills/progress` to populate store

No backend changes needed — purely frontend read of existing progress data.

---

## 7. PID Mental Math Progress

### Integration with session-end flow

After drills are available, the PID update prompt (in `session_end_service.py`) includes a section about mental math progress. The AI is given the current `SkillProgress` data and asked to include a "Mental Math Progress" section in the updated PID.

Format in PID:
```
## Mental Math Progress
- Outs Counting: GRADUATED (94% accuracy, avg 3.2s)
- Rule of 2 & 4: 82% accuracy, avg 6.1s, struggling with combo draws
- Pot Odds: 45% accuracy, avg 9.4s, common error: forgetting to add bet to pot
- Speed trend: improving 0.3s/week average
- Drill streak: 12 days (longest: 18 days)
```

This requires passing drill progress data to the existing `generate_pid_update()` function — a small modification to the session-end flow.
