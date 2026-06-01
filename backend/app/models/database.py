from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
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


class PIDHistory(Base):
    __tablename__ = "pid_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, default="default")
    version = Column(Integer, nullable=False)
    pid_markdown = Column(Text, nullable=False)
    trigger = Column(String, nullable=False, default="manual_edit")
    session_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, default="default")
    is_active = Column(Integer, nullable=False, default=1)
    started_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    ended_at = Column(DateTime, nullable=True)
    total_rounds = Column(Integer, nullable=False, default=0)
    total_profit = Column(Float, nullable=False, default=0.0)
    ai_summary = Column(Text, nullable=True)


class RoundRecord(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, nullable=False)
    round_number = Column(Integer, nullable=False)
    hole_cards = Column(Text, nullable=False)
    community_cards = Column(Text, nullable=False, default="[]")
    num_players = Column(Integer, nullable=False, default=6)
    position = Column(String, nullable=True)
    streets = Column(Text, nullable=False, default="[]")
    result = Column(String, nullable=True)
    profit = Column(Float, nullable=False, default=0.0)
    pot_size = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class RoundCondensed(Base):
    __tablename__ = "rounds_condensed"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, nullable=False)
    round_number = Column(Integer, nullable=False)
    hole_cards = Column(Text, nullable=False)
    result = Column(String, nullable=True)
    profit = Column(Float, nullable=False, default=0.0)
    key_decision = Column(Text, nullable=True)
    lesson = Column(Text, nullable=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class PlayerProfile(Base):
    __tablename__ = "player_profiles"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    user_id = Column(String, nullable=False, default="default")
    tendency_tags = Column(Text, nullable=False, default="[]")
    vpip_estimate = Column(Integer, nullable=True)
    pfr_estimate = Column(Integer, nullable=True)
    notes = Column(Text, nullable=False, default="")
    key_hands = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class LeakRecord(Base):
    __tablename__ = "leaks"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, default="default")
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False, default="general")
    ev_impact = Column(String, nullable=False, default="medium")
    status = Column(String, nullable=False, default="active")
    source = Column(String, nullable=False, default="manual")
    session_id = Column(Integer, nullable=True)
    evidence = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


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
