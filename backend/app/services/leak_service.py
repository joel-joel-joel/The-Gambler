from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import LeakRecord
from app.services.ai_service import chat_with_ai
from app.services.round_service import list_rounds


def create_leak(
    db: Session,
    description: str,
    category: str = "general",
    ev_impact: str = "medium",
    status: str = "active",
    source: str = "manual",
    session_id: int | None = None,
    evidence: str | None = None,
    user_id: str = "default",
) -> LeakRecord:
    """Create a new leak record and persist it to the database."""
    leak = LeakRecord(
        user_id=user_id,
        description=description,
        category=category,
        ev_impact=ev_impact,
        status=status,
        source=source,
        session_id=session_id,
        evidence=evidence,
    )
    db.add(leak)
    db.commit()
    db.refresh(leak)
    return leak


def list_leaks(
    db: Session,
    user_id: str = "default",
    status_filter: str | None = None,
) -> list[LeakRecord]:
    """Return all leaks for a user, optionally filtered by status."""
    query = db.query(LeakRecord).filter(LeakRecord.user_id == user_id)
    if status_filter:
        query = query.filter(LeakRecord.status == status_filter)
    return query.order_by(LeakRecord.created_at.desc()).all()


def update_leak(db: Session, leak_id: int, **kwargs) -> LeakRecord | None:
    """Update fields on an existing leak. Returns None if not found."""
    leak = db.query(LeakRecord).filter(LeakRecord.id == leak_id).first()
    if leak is None:
        return None
    for key, value in kwargs.items():
        if hasattr(leak, key):
            setattr(leak, key, value)
    leak.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(leak)
    return leak


def delete_leak(db: Session, leak_id: int) -> bool:
    """Delete a leak by id. Returns True if deleted, False if not found."""
    leak = db.query(LeakRecord).filter(LeakRecord.id == leak_id).first()
    if leak is None:
        return False
    db.delete(leak)
    db.commit()
    return True


def _rounds_to_text(db: Session, session_id: int) -> str:
    """Serialize session rounds to JSON text for the AI prompt."""
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


async def generate_leaks_from_session(
    db: Session,
    session_id: int,
    user_id: str = "default",
) -> list[LeakRecord]:
    """Ask the AI to identify leaks from session rounds and persist them."""
    rounds_text = _rounds_to_text(db, session_id)

    prompt = (
        "Analyze these poker session rounds and identify player leaks.\n\n"
        f"Rounds:\n{rounds_text}\n\n"
        "Return a JSON array of leak objects. Each object must have:\n"
        '- "description": short description of the leak\n'
        '- "category": one of "preflop", "postflop", "tilt", "sizing", "general"\n'
        '- "ev_impact": one of "high", "medium", "low"\n'
        '- "evidence": specific hand/pattern evidence\n\n'
        "Return ONLY the JSON array, no other text."
    )

    raw = await chat_with_ai(
        "You are a poker leak analyst. Return only valid JSON.",
        prompt,
    )

    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        leak_data = json.loads(raw)
    except json.JSONDecodeError:
        return []

    if not isinstance(leak_data, list):
        return []

    created = []
    for item in leak_data:
        if not isinstance(item, dict) or "description" not in item:
            continue
        leak = create_leak(
            db,
            description=item["description"],
            category=item.get("category", "general"),
            ev_impact=item.get("ev_impact", "medium"),
            source="ai",
            session_id=session_id,
            evidence=item.get("evidence"),
            user_id=user_id,
        )
        created.append(leak)

    return created
