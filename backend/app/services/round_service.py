from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.database import RoundRecord


def save_round(
    db: Session,
    session_id: int,
    hole_cards: list[str],
    community_cards: list[str] | None = None,
    num_players: int = 6,
    position: str | None = None,
    streets: list | None = None,
    pot_size: float = 0.0,
    result: str | None = None,
    profit: float = 0.0,
    notes: str | None = None,
) -> RoundRecord:
    """Save a new round to the database."""
    round_number = get_round_count(db, session_id) + 1

    round_rec = RoundRecord(
        session_id=session_id,
        round_number=round_number,
        hole_cards=json.dumps(hole_cards),
        community_cards=json.dumps(community_cards or []),
        num_players=num_players,
        position=position,
        streets=json.dumps(streets or []),
        pot_size=pot_size,
        result=result,
        profit=profit,
        notes=notes,
    )
    db.add(round_rec)
    db.commit()
    db.refresh(round_rec)
    return round_rec


def get_round(db: Session, round_id: int) -> RoundRecord | None:
    """Get a round by ID."""
    return db.query(RoundRecord).filter(RoundRecord.id == round_id).first()


def list_rounds(db: Session, session_id: int) -> list[RoundRecord]:
    """List all rounds for a session, ordered by round number."""
    return (
        db.query(RoundRecord)
        .filter(RoundRecord.session_id == session_id)
        .order_by(RoundRecord.round_number)
        .all()
    )


def delete_round(db: Session, round_id: int) -> bool:
    """Delete a round. Returns True if deleted, False if not found."""
    round_rec = get_round(db, round_id)
    if not round_rec:
        return False
    db.delete(round_rec)
    db.commit()
    return True


def get_round_count(db: Session, session_id: int) -> int:
    """Get the number of rounds in a session."""
    return (
        db.query(RoundRecord)
        .filter(RoundRecord.session_id == session_id)
        .count()
    )
