"""Drills API router — generate, check, progress, history, and focus endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.drill_schemas import GenerateDrillRequest, CheckDrillRequest
from app.services.drill_service import (
    generate_drill,
    check_answer,
    get_all_progress,
    get_drill_history,
    initialize_progress,
    suggest_focus,
)

router = APIRouter()


@router.get("/api/drills/progress")
def get_progress(db: Session = Depends(get_db)):
    """Return progress for all 6 drill skills."""
    initialize_progress(db)
    return get_all_progress(db)


@router.post("/api/drills/generate")
def generate(body: GenerateDrillRequest, db: Session = Depends(get_db)):
    """Generate a new drill scenario for a given skill."""
    initialize_progress(db)
    try:
        return generate_drill(db, body.skill, body.source)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/drills/check")
def check(body: CheckDrillRequest, db: Session = Depends(get_db)):
    """Check the user's answer for a pending drill."""
    try:
        return check_answer(db, body.drill_id, body.user_answer, body.response_time_ms)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/drills/history")
def history(
    skill: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Return recent drill attempts, optionally filtered by skill."""
    if skill is None:
        return []
    return get_drill_history(db, skill=skill, limit=limit)


@router.get("/api/drills/focus")
def focus(db: Session = Depends(get_db)):
    """Suggest the skill the user should focus on next."""
    initialize_progress(db)
    return suggest_focus(db)
