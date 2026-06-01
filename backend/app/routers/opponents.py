from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.opponent_service import (
    create_opponent,
    delete_opponent,
    get_opponent,
    list_opponents,
    update_opponent,
)

router = APIRouter()


class CreateOpponentRequest(BaseModel):
    name: str
    tendency_tags: list[str] = []
    vpip_estimate: int | None = None
    pfr_estimate: int | None = None
    notes: str = ""
    key_hands: list[str] = []


class UpdateOpponentRequest(BaseModel):
    name: str | None = None
    tendency_tags: list[str] | None = None
    vpip_estimate: int | None = None
    pfr_estimate: int | None = None
    notes: str | None = None
    key_hands: list[str] | None = None


def _opponent_to_dict(opp) -> dict:
    """Serialize a PlayerProfile ORM object to a response dict."""
    return {
        "id": opp.id,
        "name": opp.name,
        "user_id": opp.user_id,
        "tendency_tags": json.loads(opp.tendency_tags) if opp.tendency_tags else [],
        "vpip_estimate": opp.vpip_estimate,
        "pfr_estimate": opp.pfr_estimate,
        "notes": opp.notes,
        "key_hands": json.loads(opp.key_hands) if opp.key_hands else [],
        "created_at": opp.created_at.isoformat() if opp.created_at else None,
        "updated_at": opp.updated_at.isoformat() if opp.updated_at else None,
    }


@router.post("/api/opponents")
def create_opponent_endpoint(req: CreateOpponentRequest, db: Session = Depends(get_db)):
    """Create a new opponent profile."""
    opp = create_opponent(
        db,
        name=req.name,
        tendency_tags=req.tendency_tags,
        vpip_estimate=req.vpip_estimate,
        pfr_estimate=req.pfr_estimate,
        notes=req.notes,
        key_hands=req.key_hands,
    )
    return _opponent_to_dict(opp)


@router.get("/api/opponents")
def list_opponents_endpoint(db: Session = Depends(get_db)):
    """List all opponent profiles for the default user."""
    opponents = list_opponents(db)
    return [_opponent_to_dict(o) for o in opponents]


@router.get("/api/opponents/{opponent_id}")
def get_opponent_endpoint(opponent_id: int, db: Session = Depends(get_db)):
    """Get a single opponent profile by ID."""
    opp = get_opponent(db, opponent_id)
    if opp is None:
        raise HTTPException(status_code=404, detail="Opponent not found")
    return _opponent_to_dict(opp)


@router.put("/api/opponents/{opponent_id}")
def update_opponent_endpoint(
    opponent_id: int,
    req: UpdateOpponentRequest,
    db: Session = Depends(get_db),
):
    """Update an existing opponent profile. Only provided fields are changed."""
    updates = req.model_dump(exclude_none=True)
    opp = update_opponent(db, opponent_id, **updates)
    if opp is None:
        raise HTTPException(status_code=404, detail="Opponent not found")
    return _opponent_to_dict(opp)


@router.delete("/api/opponents/{opponent_id}")
def delete_opponent_endpoint(opponent_id: int, db: Session = Depends(get_db)):
    """Delete an opponent profile by ID."""
    success = delete_opponent(db, opponent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Opponent not found")
    return {"deleted": True}
