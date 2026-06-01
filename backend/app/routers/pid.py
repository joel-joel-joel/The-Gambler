from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.pid_service import get_pid, save_pid

router = APIRouter()


class PIDUpdateRequest(BaseModel):
    pid_markdown: str


@router.get("/api/pid")
def read_pid(db: Session = Depends(get_db)):
    markdown = get_pid(db, "default")
    return {"pid_markdown": markdown}


@router.put("/api/pid")
def update_pid(req: PIDUpdateRequest, db: Session = Depends(get_db)):
    record = save_pid(db, "default", req.pid_markdown)
    return {"pid_markdown": record.pid_markdown, "version": record.version}
