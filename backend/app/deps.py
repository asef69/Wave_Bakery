"""Shared FastAPI dependencies."""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import GameSession, Player


def current_player(
    x_player_token: str | None = Header(default=None, alias='X-Player-Token'),
    db: Session = Depends(get_db),
) -> Player:
    """Lightweight identity: a handle plus an opaque token issued at signup."""
    if not x_player_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            'Missing X-Player-Token header. Register a chef first.')
    player = db.query(Player).filter(Player.token == x_player_token).one_or_none()
    if player is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Unknown player token.')
    return player


def optional_player(
    x_player_token: str | None = Header(default=None, alias='X-Player-Token'),
    db: Session = Depends(get_db),
) -> Player | None:
    if not x_player_token:
        return None
    return db.query(Player).filter(Player.token == x_player_token).one_or_none()


def owned_session(session_id: str, db: Session = Depends(get_db),
                  player: Player = Depends(current_player)) -> GameSession:
    session = db.get(GameSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Session not found.')
    if session.player_id != player.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, 'That is not your session.')
    return session
