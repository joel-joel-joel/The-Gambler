from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, PIDRecord
from app.services.pid_service import get_pid, save_pid


def make_test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)


def test_db_creates_pid_table():
    Session = make_test_db()
    with Session() as session:
        record = PIDRecord(user_id="test", pid_markdown="# Test PID", version=1)
        session.add(record)
        session.commit()

        result = session.query(PIDRecord).filter_by(user_id="test").first()
        assert result is not None
        assert result.pid_markdown == "# Test PID"
        assert result.version == 1


def test_get_pid_returns_default_when_empty():
    Session = make_test_db()
    with Session() as session:
        result = get_pid(session, "new_user")
        assert "# Player Intelligence Document" in result


def test_save_pid_creates_new():
    Session = make_test_db()
    with Session() as session:
        save_pid(session, "user1", "# My PID\nSome content")
        result = get_pid(session, "user1")
        assert "Some content" in result


def test_save_pid_increments_version():
    Session = make_test_db()
    with Session() as session:
        save_pid(session, "user1", "Version 1")
        save_pid(session, "user1", "Version 2")
        record = session.query(PIDRecord).filter_by(user_id="user1").first()
        assert record.version == 2
        assert "Version 2" in record.pid_markdown


def test_save_pid_updates_existing():
    Session = make_test_db()
    with Session() as session:
        save_pid(session, "user1", "Original")
        save_pid(session, "user1", "Updated")
        result = get_pid(session, "user1")
        assert result == "Updated"
        count = session.query(PIDRecord).filter_by(user_id="user1").count()
        assert count == 1
