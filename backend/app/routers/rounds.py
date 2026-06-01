import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.round_service import (
    save_round,
    get_round,
    list_rounds,
    delete_round,
)

router = APIRouter()


class SaveRoundRequest(BaseModel):
    session_id: int
    hole_cards: list[str]
    community_cards: list[str] = []
    num_players: int = 6
    position: Optional[str] = None
    pot_size: float = 0
    result: Optional[str] = None
    profit: float = 0
    notes: Optional[str] = None


def _round_to_dict(r):
    return {
        "id": r.id,
        "session_id": r.session_id,
        "round_number": r.round_number,
        "hole_cards": json.loads(r.hole_cards),
        "community_cards": json.loads(r.community_cards),
        "num_players": r.num_players,
        "position": r.position,
        "streets": json.loads(r.streets),
        "result": r.result,
        "profit": r.profit,
        "pot_size": r.pot_size,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/api/rounds")
def create_round(req: SaveRoundRequest, db: Session = Depends(get_db)):
    round_rec = save_round(
        db,
        session_id=req.session_id,
        hole_cards=req.hole_cards,
        community_cards=req.community_cards,
        num_players=req.num_players,
        position=req.position,
        pot_size=req.pot_size,
        result=req.result,
        profit=req.profit,
        notes=req.notes,
    )
    return _round_to_dict(round_rec)


@router.get("/api/rounds")
def get_rounds(session_id: int, db: Session = Depends(get_db)):
    rounds = list_rounds(db, session_id=session_id)
    return [_round_to_dict(r) for r in rounds]


@router.get("/api/rounds/{round_id}")
def get_round_by_id(round_id: int, db: Session = Depends(get_db)):
    round_rec = get_round(db, round_id)
    if not round_rec:
        raise HTTPException(status_code=404, detail="Round not found")
    return _round_to_dict(round_rec)


@router.delete("/api/rounds/{round_id}")
def delete_round_endpoint(round_id: int, db: Session = Depends(get_db)):
    deleted = delete_round(db, round_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Round not found")
    return {"deleted": True}
