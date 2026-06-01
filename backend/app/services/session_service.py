from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import SessionRecord


def start_session(db: Session, user_id: str = "default") -> SessionRecord:
    """Start a new session, ending any active one first."""
    active = get_active_session(db, user_id)
    if active:
        end_session(db, active.id)

    session_rec = SessionRecord(user_id=user_id)
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)
    return session_rec


def end_session(db: Session, session_id: int) -> SessionRecord | None:
    """Mark a session as ended."""
    session_rec = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if session_rec:
        session_rec.is_active = 0
        session_rec.ended_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session_rec)
    return session_rec


def get_active_session(db: Session, user_id: str = "default") -> SessionRecord | None:
    """Get the currently active session for a user."""
    return (
        db.query(SessionRecord)
        .filter(SessionRecord.user_id == user_id, SessionRecord.is_active == 1)
        .first()
    )


def get_session(db: Session, session_id: int) -> SessionRecord | None:
    """Get a session by ID."""
    return db.query(SessionRecord).filter(SessionRecord.id == session_id).first()


def list_sessions(db: Session, user_id: str = "default") -> list[SessionRecord]:
    """List all sessions for a user, newest first."""
    return (
        db.query(SessionRecord)
        .filter(SessionRecord.user_id == user_id)
        .order_by(SessionRecord.started_at.desc())
        .all()
    )
