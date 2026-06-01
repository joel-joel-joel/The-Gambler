from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.session_service import (
    start_session,
    end_session,
    get_active_session,
    get_session,
    list_sessions,
)

router = APIRouter()


def _session_to_dict(s) -> dict:
    """Serialize a SessionRecord to a JSON-safe dict."""
    return {
        "id": s.id,
        "user_id": s.user_id,
        "is_active": bool(s.is_active),
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        "total_rounds": s.total_rounds,
        "total_profit": s.total_profit,
        "ai_summary": s.ai_summary,
    }


@router.post("/api/sessions")
def create_session(db: Session = Depends(get_db)):
    """Start a new session (ends any existing active session first)."""
    session_rec = start_session(db)
    return _session_to_dict(session_rec)


@router.get("/api/sessions")
def get_sessions(db: Session = Depends(get_db)):
    """List all sessions for the default user, newest first."""
    sessions = list_sessions(db)
    return [_session_to_dict(s) for s in sessions]


@router.get("/api/sessions/active")
def get_active(db: Session = Depends(get_db)):
    """Get the currently active session, or 404 if none."""
    session_rec = get_active_session(db)
    if not session_rec:
        raise HTTPException(status_code=404, detail="No active session")
    return _session_to_dict(session_rec)


@router.get("/api/sessions/{session_id}")
def get_session_by_id(session_id: int, db: Session = Depends(get_db)):
    """Get a session by ID."""
    session_rec = get_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_to_dict(session_rec)


@router.post("/api/sessions/{session_id}/end")
def end_session_endpoint(session_id: int, db: Session = Depends(get_db)):
    """End a session by ID."""
    session_rec = end_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_to_dict(session_rec)
