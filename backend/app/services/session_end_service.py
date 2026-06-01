from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.database import SessionRecord
from app.services.ai_service import chat_with_ai
from app.services.round_service import list_rounds
from app.services.pid_service import get_pid, save_pid
from app.services.leak_service import generate_leaks_from_session
from app.services.drill_service import get_all_progress


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

    drill_progress = get_all_progress(db)
    drill_section = ""
    if any(p["total_attempts"] > 0 for p in drill_progress):
        lines = ["MENTAL MATH PROGRESS:"]
        for p in drill_progress:
            if p["total_attempts"] > 0:
                lines.append(
                    f"- {p['skill']}: {p['status'].upper()} "
                    f"({p['current_accuracy']*100:.0f}% accuracy, "
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


async def finalize_session(db: Session, session_id: int, user_id: str = "default") -> dict:
    """Full session-end flow: stats, summary, PID update."""
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
