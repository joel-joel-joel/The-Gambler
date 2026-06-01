from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.leak_service import (
    create_leak,
    delete_leak,
    list_leaks,
    update_leak,
)

router = APIRouter()


class CreateLeakRequest(BaseModel):
    description: str
    category: str = "general"
    ev_impact: str = "medium"
    status: str = "active"


class UpdateLeakRequest(BaseModel):
    description: str | None = None
    category: str | None = None
    ev_impact: str | None = None
    status: str | None = None
    evidence: str | None = None


def _leak_to_dict(leak) -> dict:
    return {
        "id": leak.id,
        "user_id": leak.user_id,
        "description": leak.description,
        "category": leak.category,
        "ev_impact": leak.ev_impact,
        "status": leak.status,
        "source": leak.source,
        "session_id": leak.session_id,
        "evidence": leak.evidence,
        "created_at": leak.created_at.isoformat() if leak.created_at else None,
        "updated_at": leak.updated_at.isoformat() if leak.updated_at else None,
    }


@router.post("/api/leaks")
def create_leak_endpoint(req: CreateLeakRequest, db: Session = Depends(get_db)):
    """Create a new player leak record."""
    leak = create_leak(
        db,
        description=req.description,
        category=req.category,
        ev_impact=req.ev_impact,
        status=req.status,
    )
    return _leak_to_dict(leak)


@router.get("/api/leaks")
def list_leaks_endpoint(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """List all leaks, optionally filtered by status."""
    leaks = list_leaks(db, status_filter=status)
    return [_leak_to_dict(leak) for leak in leaks]


@router.put("/api/leaks/{leak_id}")
def update_leak_endpoint(
    leak_id: int,
    req: UpdateLeakRequest,
    db: Session = Depends(get_db),
):
    """Update fields on an existing leak."""
    updates = req.model_dump(exclude_none=True)
    leak = update_leak(db, leak_id, **updates)
    if leak is None:
        raise HTTPException(status_code=404, detail="Leak not found")
    return _leak_to_dict(leak)


@router.delete("/api/leaks/{leak_id}")
def delete_leak_endpoint(leak_id: int, db: Session = Depends(get_db)):
    """Delete a leak by id."""
    success = delete_leak(db, leak_id)
    if not success:
        raise HTTPException(status_code=404, detail="Leak not found")
    return {"deleted": True}
