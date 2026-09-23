"""Player registration and profile."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import gameplay, schemas
from ..database import get_db
from ..deps import current_player
from ..models import Attempt, Player

router = APIRouter(prefix='/players', tags=['players'])


@router.post('', response_model=schemas.PlayerRegistered,
             status_code=status.HTTP_201_CREATED)
def register(payload: schemas.PlayerCreate, db: Session = Depends(get_db)):
    """Create a chef. The returned token identifies the player on later calls."""
    handle = payload.handle.strip()
    if db.query(Player).filter(func.lower(Player.handle) == handle.lower()).first():
        raise HTTPException(status.HTTP_409_CONFLICT, 'That chef name is taken.')
    player = Player(handle=handle)
    db.add(player)
    db.commit()
    db.refresh(player)
    title, emoji = gameplay.rank_for(player.points)
    return schemas.PlayerRegistered(
        **schemas.PlayerOut.model_validate(player).model_dump(),
        token=player.token, rank_title=title, rank_emoji=emoji)


@router.post('/login', response_model=schemas.PlayerRegistered)
def login(payload: schemas.PlayerLogin, db: Session = Depends(get_db)):
    """Log in as an existing chef by handle name."""
    handle = payload.handle.strip()
    player = db.query(Player).filter(func.lower(Player.handle) == handle.lower()).first()
    if not player:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Chef '{handle}' not found. Please check your spelling or register a new chef.")
    title, emoji = gameplay.rank_for(player.points)
    return schemas.PlayerRegistered(
        **schemas.PlayerOut.model_validate(player).model_dump(),
        token=player.token, rank_title=title, rank_emoji=emoji)


@router.post('/auth-or-register', response_model=schemas.PlayerRegistered)
def auth_or_register(payload: schemas.PlayerCreate, db: Session = Depends(get_db)):
    """Log in if chef exists, otherwise create a new chef account."""
    handle = payload.handle.strip()
    player = db.query(Player).filter(func.lower(Player.handle) == handle.lower()).first()
    if not player:
        player = Player(handle=handle)
        db.add(player)
        db.commit()
        db.refresh(player)
    title, emoji = gameplay.rank_for(player.points)
    return schemas.PlayerRegistered(
        **schemas.PlayerOut.model_validate(player).model_dump(),
        token=player.token, rank_title=title, rank_emoji=emoji)


@router.get('', response_model=list[schemas.PlayerSummary])
def list_chefs(limit: int = 50, db: Session = Depends(get_db)):
    """List available/existing chefs with their stats."""
    players = db.query(Player).order_by(Player.points.desc(), Player.created_at.desc()).limit(min(limit, 100)).all()
    results = []
    for p in players:
        served = db.query(func.count(Attempt.id)).filter(Attempt.player_id == p.id).scalar() or 0
        title, emoji = gameplay.rank_for(p.points)
        results.append(schemas.PlayerSummary(
            id=p.id,
            handle=p.handle,
            points=p.points,
            unlocked_tier=p.unlocked_tier,
            rank_title=title,
            rank_emoji=emoji,
            dishes_served=int(served),
            created_at=p.created_at
        ))
    return results


@router.get('/me', response_model=schemas.PlayerProfile)
def me(player: Player = Depends(current_player), db: Session = Depends(get_db)):
    title, emoji = gameplay.rank_for(player.points)
    nxt, gap = gameplay.next_rank(player.points)

    served = db.query(func.count(Attempt.id)).filter(
        Attempt.player_id == player.id).scalar() or 0
    rows = db.query(Attempt.recipe_id, func.max(Attempt.score)).filter(
        Attempt.player_id == player.id).group_by(Attempt.recipe_id).all()

    return schemas.PlayerProfile(
        **schemas.PlayerOut.model_validate(player).model_dump(),
        rank_title=title, rank_emoji=emoji, next_rank=nxt, points_to_next=gap,
        dishes_served=int(served),
        best_scores={rid: round(float(s), 2) for rid, s in rows})


@router.get('/me/history', response_model=list[schemas.PlayerHistoryRow])
def history(limit: int = 25, player: Player = Depends(current_player),
            db: Session = Depends(get_db)):
    rows = (db.query(Attempt).filter(Attempt.player_id == player.id)
            .order_by(Attempt.created_at.desc()).limit(min(limit, 100)).all())
    return [schemas.PlayerHistoryRow(
        attempt_id=a.id, recipe_id=a.recipe_id,
        recipe_name=a.recipe.name if a.recipe else a.recipe_id,
        score=a.score, stars=a.stars, points_awarded=a.points_awarded,
        created_at=a.created_at) for a in rows]
