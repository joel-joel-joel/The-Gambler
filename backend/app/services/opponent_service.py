from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import PlayerProfile


def create_opponent(
    db: Session,
    name: str,
    user_id: str = "default",
    tendency_tags: list[str] | None = None,
    vpip_estimate: int | None = None,
    pfr_estimate: int | None = None,
    notes: str = "",
    key_hands: list[str] | None = None,
) -> PlayerProfile:
    opp = PlayerProfile(
        name=name,
        user_id=user_id,
        tendency_tags=json.dumps(tendency_tags or []),
        vpip_estimate=vpip_estimate,
        pfr_estimate=pfr_estimate,
        notes=notes,
        key_hands=json.dumps(key_hands or []),
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)
    return opp


def get_opponent(db: Session, opponent_id: int) -> PlayerProfile | None:
    return db.query(PlayerProfile).filter(PlayerProfile.id == opponent_id).first()


def list_opponents(db: Session, user_id: str = "default") -> list[PlayerProfile]:
    return (
        db.query(PlayerProfile)
        .filter(PlayerProfile.user_id == user_id)
        .order_by(PlayerProfile.name)
        .all()
    )


def update_opponent(db: Session, opponent_id: int, **kwargs) -> PlayerProfile | None:
    opp = get_opponent(db, opponent_id)
    if opp is None:
        return None

    if "tendency_tags" in kwargs and isinstance(kwargs["tendency_tags"], list):
        kwargs["tendency_tags"] = json.dumps(kwargs["tendency_tags"])
    if "key_hands" in kwargs and isinstance(kwargs["key_hands"], list):
        kwargs["key_hands"] = json.dumps(kwargs["key_hands"])

    for key, value in kwargs.items():
        if hasattr(opp, key):
            setattr(opp, key, value)

    opp.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(opp)
    return opp


def delete_opponent(db: Session, opponent_id: int) -> bool:
    opp = get_opponent(db, opponent_id)
    if opp is None:
        return False
    db.delete(opp)
    db.commit()
    return True
