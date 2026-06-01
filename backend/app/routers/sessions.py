from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.review_service import generate_review, check_review_answer
from app.services.session_service import (
    start_session,
    end_session,
    get_active_session,
    get_session,
    list_sessions,
)
from app.services.session_end_service import finalize_session, generate_session_summary

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


@router.post("/api/sessions/{session_id}/finalize")
async def finalize_session_endpoint(session_id: int, db: Session = Depends(get_db)):
    """Run the full session-end flow: compute stats, generate AI summary, update PID."""
    session_rec = get_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await finalize_session(db, session_id)
    end_session(db, session_id)
    return result


@router.get("/api/sessions/{session_id}/summary")
async def get_session_summary(session_id: int, db: Session = Depends(get_db)):
    """Get or generate an AI summary for a session."""
    session_rec = get_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_rec.ai_summary:
        return {"summary": session_rec.ai_summary}
    summary = await generate_session_summary(db, session_id)
    return {"summary": summary}


class ReviewCheckBody(BaseModel):
    hand_index: int
    question_index: int
    correct_answer: float
    user_answer: float
    answer_type: str
    tolerance: float


@router.post("/api/sessions/{session_id}/review")
def review_session(session_id: int, db: Session = Depends(get_db)):
    """Generate a Socratic review for the session's most interesting hands."""
    session_rec = get_session(db, session_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    return generate_review(db, session_id)


@router.post("/api/sessions/{session_id}/review/check")
def check_review(session_id: int, body: ReviewCheckBody, db: Session = Depends(get_db)):
    """Check a user's answer to a review question."""
    return check_review_answer(
        correct_answer=body.correct_answer,
        user_answer=body.user_answer,
        answer_type=body.answer_type,
        tolerance=body.tolerance,
    )
