"""SQLAlchemy engine, session factory and declarative base."""
from __future__ import annotations

from sqlalchemy import create_engine # type: ignore
from sqlalchemy.orm import DeclarativeBase, sessionmaker # type: ignore
from sqlalchemy.pool import NullPool # type: ignore

from .config import DATABASE_URL

if DATABASE_URL.startswith('sqlite'):
    engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False}, future=True)
else:
    # Postgres (Supabase) through its connection pooler: the pooler already
    # shares connections, and a serverless function may be frozen between
    # requests, so the app keeps none open itself (NullPool).
    engine = create_engine(DATABASE_URL, poolclass=NullPool, future=True)
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
    _backfill_run_totals()


# (table, column, SQL type) added after the first release.
_LATER_COLUMNS = [
    ('players', 'password_hash', 'VARCHAR(200)'),
    ('game_sessions', 'difficulty', 'VARCHAR(16)'),
    ('attempts', 'difficulty', 'VARCHAR(16)'),
    ('attempts', 'total_score', 'INTEGER'),
    ('attempts', 'time_bonus', 'INTEGER'),
    ('attempts', 'scoring_version', 'INTEGER'),
]


def _backfill_run_totals(db=None) -> None:
    """
    Runs served before the overall score was stored have no total_score. It
    is rebuilt from the run's own record (difficulty, and the session's start
    and serve times) with the same formula as a new run, so old and new runs
    are ranked on one scale. A run whose difficulty was never recorded is
    scored as Easy, the game's default and lowest multiplier (its difficulty
    stays unrecorded). Only empty totals are filled; nothing is overwritten.
    """
    from .gameplay import run_total
    from .models import Attempt, GameSession

    own = db is None
    db = db or SessionLocal()
    try:
        rows = (db.query(Attempt, GameSession)
                .join(GameSession, GameSession.id == Attempt.session_id)
                .filter(Attempt.total_score.is_(None)).all())
        for attempt, session in rows:
            if session.created_at is None or session.served_at is None:
                continue
            elapsed = (session.served_at - session.created_at).total_seconds()
            total, bonus = run_total(attempt.score,
                                     attempt.difficulty or session.difficulty, elapsed)
            attempt.total_score, attempt.time_bonus = total, bonus
        db.commit()
    finally:
        if own:
            db.close()


def _add_missing_columns() -> None:
    """create_all never alters existing tables; add columns introduced later."""
    from sqlalchemy import inspect, text # type: ignore

    insp = inspect(engine)
    for table, column, sql_type in _LATER_COLUMNS:
        if column not in {c['name'] for c in insp.get_columns(table)}:
            with engine.begin() as conn:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {sql_type}'))
