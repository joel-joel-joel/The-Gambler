from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from datetime import datetime, timezone

from app.config import settings


class Base(DeclarativeBase):
    pass


class PIDRecord(Base):
    __tablename__ = "pid"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, unique=True, nullable=False, default="default")
    pid_markdown = Column(Text, nullable=False, default="")
    version = Column(Integer, nullable=False, default=1)
    last_updated = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )


engine = create_engine(
    settings.database_url, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
