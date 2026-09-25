"""SQLAlchemy engine, session factory and declarative base."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

connect_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (registers mappers)
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


# (table, column, SQL type) added after the first release.
_LATER_COLUMNS = [
    ('players', 'password_hash', 'VARCHAR(200)'),
    ('game_sessions', 'difficulty', 'VARCHAR(16)'),
    ('attempts', 'difficulty', 'VARCHAR(16)'),
    ('attempts', 'total_score', 'INTEGER'),
    ('attempts', 'time_bonus', 'INTEGER'),
]


def _add_missing_columns() -> None:
    """create_all never alters existing tables; add columns introduced later."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    for table, column, sql_type in _LATER_COLUMNS:
        if column not in {c['name'] for c in insp.get_columns(table)}:
            with engine.begin() as conn:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {sql_type}'))
