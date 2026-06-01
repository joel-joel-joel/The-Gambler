from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.pid_service import get_pid, save_pid, list_pid_versions, get_pid_version

router = APIRouter()


class PIDUpdateRequest(BaseModel):
    pid_markdown: str


@router.get("/api/pid")
def read_pid(db: Session = Depends(get_db)):
    markdown = get_pid(db, "default")
    return {"pid_markdown": markdown}


@router.put("/api/pid")
def update_pid(req: PIDUpdateRequest, db: Session = Depends(get_db)):
    record = save_pid(db, "default", req.pid_markdown, trigger="manual_edit")
    return {"pid_markdown": record.pid_markdown, "version": record.version}


@router.get("/api/pid/history")
def list_pid_history(db: Session = Depends(get_db)):
    versions = list_pid_versions(db, "default")
    return [
        {
            "id": v.id,
            "version": v.version,
            "trigger": v.trigger,
            "session_id": v.session_id,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in versions
    ]


@router.get("/api/pid/history/{history_id}")
def get_pid_history_version(history_id: int, db: Session = Depends(get_db)):
    version = get_pid_version(db, history_id)
    if version is None:
        raise HTTPException(status_code=404, detail="PID version not found")
    return {
        "id": version.id,
        "version": version.version,
        "pid_markdown": version.pid_markdown,
        "trigger": version.trigger,
        "session_id": version.session_id,
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }
