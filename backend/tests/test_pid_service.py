from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.database import Base, PIDRecord


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
