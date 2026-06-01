# The Gambler

Real-time Texas Hold'em companion. Input your hand, board, and action — get instant equity, EV, pot odds, and an AI coach telling you whether to call, raise, or fold. The goal: teach you to do the math yourself and stop needing the app.

## Run It

**Prerequisites:** Python 3.12+, Node 18+, a [Gemini API key](https://aistudio.google.com/apikey) (free tier works)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
echo "GEMINI_API_KEY=your-key-here" > .env   # skip if .env already exists
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Backend runs on :8000, frontend proxies `/api` to it automatically.

**Docker alternative:**
```bash
GEMINI_API_KEY=your-key docker compose up
# → http://localhost
```

## Features

### Calculator Tab
The main screen. Select your hole cards and community cards (click or type shorthand like `AhKs`), enter pot size, bet to call, and stack sizes. Hit Calculate.

- **Quick Entry Bar** — type natural shorthand: `AhKs flop Td9h2c pot 150 bet 50`
- **Equity** — Monte Carlo simulation (10k iterations) of your win probability
- **Pot Odds** — what equity you need to justify a call
- **EV** — expected value of calling in dollar terms
- **SPR** — stack-to-pot ratio and commitment threshold
- **MDF / Bluff Break-Even** — defense frequency and bluff profitability
- **Outs + Rule of 2&4** — draw counting with approximate equity
- **Recommendation** — call, raise, or fold with color-coded confidence
- **Cheat Sheet** — expandable reference of all poker math formulas
- **Round History** — save and review past hands in the current session

### AI Chat Sidebar
Always visible on desktop, collapsible on mobile. Powered by Gemini Flash 2.0.

- **Live coaching** — ask "should I call?" and get a math-backed answer
- **Auto-apply** — AI responses can update your board/pot/bet automatically (undo within 10s)
- **Scenario editing** — "what if the river is Ah?" or "player raised to 200"
- **Voice input** — click the mic button to speak instead of type (Chrome/Edge/Safari)

### Session Management
Top-right session bar tracks your playing session.

- **Start/End Session** — groups rounds together for review
- **Auto PID update** — AI generates an updated Player Intelligence Document when you end a session
- **Pot tracking** — accumulated pot across the session

### Players Tab
Track opponents and their tendencies.

- **Opponent profiles** — add players with notes, VPIP, PFR, aggression stats
- **Per-player notes** — what you've observed about their play

### My Game Tab
Your poker self-knowledge dashboard.

- **Player Intelligence Document (PID)** — AI-maintained profile of your play style, tendencies, and progress. Versioned with full history. Editable.
- **Leak Tracker** — known weaknesses sorted by EV impact. AI-detected or manually added. Click status to cycle: active → improving → resolved.

### Training Tab
Drills that teach you to do the math without the calculator.

- **6 progressive skills:** Outs → Rule of 2&4 → Pot Odds → The Decision → SPR → Bluff Math
- **Graduation system** — each skill has an accuracy threshold and minimum attempts. Graduate one to unlock the next.
- **Speed mode** — 15-second timer per question
- **Random or history-based** — drills from random scenarios or your actual past hands
- **Session review** — pick a past session, step through the top 3 EV-gap hands with Socratic questions (outs → equity → pot odds → call/fold)
- **Tap-to-reveal** — once you graduate a skill, that metric blurs in the Calculator tab when Mental Math Mode is on. Calculate it yourself, then tap to check.

## How to Use (Typical Flow)

1. **Start a session** (top-right) when you sit down to play
2. **Enter your hand** as you're dealt — use quick entry or click cards
3. **Enter pot/bet** as action happens — or tell the AI chat ("pot is 200, villain bets 75")
4. **Read the recommendation** — call/raise/fold with the math behind it
5. **Save the round** when the hand ends, repeat for the next hand
6. **End the session** when done — AI updates your PID with what it learned
7. **Train** — go to the Training tab, drill your weakest skill, aim to graduate all 6

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v3, Zustand |
| Backend | Python 3.12, FastAPI, SQLAlchemy + SQLite |
| Poker Math | eval7 (Monte Carlo equity simulation) |
| AI | Google Gemini Flash 2.0 (swappable — provider-agnostic service layer) |
| Chat | WebSocket (`/ws/chat`) |
