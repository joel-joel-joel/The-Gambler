from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.database import PIDRecord

DEFAULT_PID = """# Player Intelligence Document
Last updated: Never

## Player Profile Summary
- Sessions played: 0
- Total rounds tracked: 0
- Overall profit/loss: $0
- Primary style: Unknown (not enough data)

## Strengths
(No data yet — play some sessions to build your profile)

## Leaks
(No data yet)

## Improvement Roadmap
### Currently Working On
- Play your first session to start tracking
"""


def get_pid(db: Session, user_id: str = "default") -> str:
    record = db.query(PIDRecord).filter_by(user_id=user_id).first()
    if record is None:
        return DEFAULT_PID
    return record.pid_markdown


def save_pid(db: Session, user_id: str, pid_markdown: str) -> PIDRecord:
    record = db.query(PIDRecord).filter_by(user_id=user_id).first()
    if record is None:
        record = PIDRecord(
            user_id=user_id,
            pid_markdown=pid_markdown,
            version=1,
        )
        db.add(record)
    else:
        record.pid_markdown = pid_markdown
        record.version += 1
        record.last_updated = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record
