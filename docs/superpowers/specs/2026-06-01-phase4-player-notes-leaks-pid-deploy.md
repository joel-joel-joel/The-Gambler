# Phase 4 Design Spec — Player Notes + Leaks + PID Viewer + Deploy

**Date:** 2026-06-01
**Status:** Approved

---

## 1. Opponent Player Profiles

### Database: `PlayerProfile` table

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | auto-increment |
| name | String | required, unique per user |
| user_id | String | default "default" |
| tendency_tags | Text | JSON array, e.g. `["Tight","Aggressive"]` |
| vpip_estimate | Integer | nullable, 0–100 |
| pfr_estimate | Integer | nullable, 0–100 |
| notes | Text | free-form markdown |
| key_hands | Text | JSON array of hand descriptions |
| created_at | DateTime | UTC |
| updated_at | DateTime | UTC |

**Tendency tags vocabulary:** Tight, Loose, Aggressive, Passive, Calling Station, Bluffer, Nit, LAG, TAG, Maniac, Rock, Fish, Shark

### Service: `opponent_service.py`

- `create_opponent(db, name, user_id, ...)` — create new profile
- `get_opponent(db, opponent_id)` — get by ID
- `list_opponents(db, user_id)` — list all for user
- `update_opponent(db, opponent_id, ...)` — partial update
- `delete_opponent(db, opponent_id)` — remove profile

### Router: `opponents.py`

- `POST /api/opponents` — create opponent
- `GET /api/opponents` — list all opponents
- `GET /api/opponents/{id}` — get single opponent
- `PUT /api/opponents/{id}` — update opponent
- `DELETE /api/opponents/{id}` — delete opponent

### Frontend: Players Page

A dedicated page accessible from the header navigation. Shows:
- List view: opponent cards with name, tags, VPIP/PFR
- Detail/edit view: full profile with tendency tag selector, stat inputs, notes editor, key hands
- "Add Player" button

---

## 2. Leak Tracking

### Database: `LeakRecord` table

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | auto-increment |
| user_id | String | default "default" |
| description | Text | what the leak is |
| category | String | e.g. "preflop", "postflop", "tilt", "sizing" |
| ev_impact | String | "high", "medium", "low" |
| status | String | "active", "improving", "resolved" |
| source | String | "ai" or "manual" |
| session_id | Integer | nullable, session that identified it |
| evidence | Text | nullable, specific hand/pattern that shows the leak |
| created_at | DateTime | UTC |
| updated_at | DateTime | UTC |

### Service: `leak_service.py`

- `create_leak(db, description, category, ...)` — create manually
- `list_leaks(db, user_id, status_filter)` — list leaks, optionally filtered by status
- `update_leak(db, leak_id, ...)` — update status, description, etc.
- `delete_leak(db, leak_id)` — remove
- `generate_leaks_from_session(db, session_id)` — AI analyzes session rounds and creates structured leak records

### Router: `leaks.py`

- `POST /api/leaks` — create leak manually
- `GET /api/leaks` — list leaks (optional `?status=active`)
- `PUT /api/leaks/{id}` — update leak
- `DELETE /api/leaks/{id}` — delete leak

### Integration with session-end flow

In `finalize_session()`, after generating the PID update, also call `generate_leaks_from_session()` which:
1. Sends round data to AI with a structured prompt
2. AI returns JSON array of leak objects
3. Each becomes a LeakRecord with source="ai" and session_id set

### Frontend: Leaks on My Game page

- Leak cards ranked by EV impact (high first)
- Color-coded status badges: red=active, yellow=improving, green=resolved
- Click to edit status/description
- "Add Leak" button for manual entry

---

## 3. PID Viewer + History

### Database: `PIDHistory` table

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | auto-increment |
| user_id | String | default "default" |
| version | Integer | matches PIDRecord.version at time of snapshot |
| pid_markdown | Text | full markdown content |
| trigger | String | what caused the update, e.g. "session_end", "manual_edit" |
| session_id | Integer | nullable, if triggered by session end |
| created_at | DateTime | UTC |

### Service changes

Modify `pid_service.save_pid()` to also insert a `PIDHistory` row with the old content before overwriting.

Add:
- `list_pid_versions(db, user_id)` — list all versions (id, version, trigger, created_at)
- `get_pid_version(db, history_id)` — get a specific historical snapshot

### Router changes

Add to existing `pid.py`:
- `GET /api/pid/history` — list version metadata
- `GET /api/pid/history/{id}` — get full historical version

### Frontend: PID Viewer on My Game page

- Read/edit PID markdown (textarea with preview)
- Save button triggers manual edit
- Version history sidebar: list of versions with timestamps
- Click a version to view it (read-only)

---

## 4. Frontend Navigation

### Tab System

Header gains navigation tabs: **Calculator** | **Players** | **My Game**

- Active tab: gold underline indicator, `text-gold font-semibold`
- Inactive tabs: `text-stone-400 hover:text-stone-200`
- Chat sidebar stays persistent across all tabs
- Mobile: tabs below header, horizontally scrollable if needed

### Routing

Simple state-based routing via Zustand (no react-router). A `navigationStore` with `activeTab: 'calculator' | 'players' | 'myGame'` controls which page renders in the main content area.

---

## 5. Docker Compose Deployment

### Structure

```
docker-compose.yml
frontend/Dockerfile
backend/Dockerfile
nginx/nginx.conf
```

### Services

- **frontend**: multi-stage build (node → nginx), serves static files
- **backend**: Python 3.12, uvicorn, serves API
- **nginx**: reverse proxy, routes `/api/*` and `/ws/*` to backend, everything else to frontend

### Config

- Backend reads from environment variables in docker-compose
- SQLite database persisted via volume mount
- No external database service needed
