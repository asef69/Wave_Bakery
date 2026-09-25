"""Player registration and profile."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import gameplay, schemas
from ..database import get_db
from ..deps import current_player
from ..models import Attempt, Player
from ..security import hash_password, verify_password

router = APIRouter(prefix='/players', tags=['players'])


def _registered(player: Player) -> schemas.PlayerRegistered:
    title, emoji = gameplay.rank_for(player.points)
    return schemas.PlayerRegistered(
        **schemas.PlayerOut.model_validate(player).model_dump(),
        token=player.token, rank_title=title, rank_emoji=emoji)


def _find(db: Session, handle: str) -> Player | None:
    return db.query(Player).filter(func.lower(Player.handle) == handle.lower()).first()


def _check_password(db: Session, player: Player, password: str) -> None:
    """
    Verify the password. Chefs created before passwords existed have none:
    their first successful login sets it, so existing accounts keep working.
    """
    if player.password_hash is None:
        player.password_hash = hash_password(password)
        db.commit()
        return
    if not verify_password(password, player.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Wrong password for that chef.')


@router.post('', response_model=schemas.PlayerRegistered,
             status_code=status.HTTP_201_CREATED)
def register(payload: schemas.PlayerCreate, db: Session = Depends(get_db)):
    """Create a chef. The returned token identifies the player on later calls."""
    handle = payload.handle.strip()
    if _find(db, handle):
        raise HTTPException(status.HTTP_409_CONFLICT, 'That chef name is taken.')
    player = Player(handle=handle, password_hash=hash_password(payload.password))
    db.add(player)
    db.commit()
    db.refresh(player)
    return _registered(player)


@router.post('/login', response_model=schemas.PlayerRegistered)
def login(payload: schemas.PlayerLogin, db: Session = Depends(get_db)):
    """Log in as an existing chef with their password."""
    handle = payload.handle.strip()
    player = _find(db, handle)
    if not player:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Chef '{handle}' not found. Please check your spelling or register a new chef.")
    _check_password(db, player, payload.password)
    return _registered(player)


@router.post('/auth-or-register', response_model=schemas.PlayerRegistered)
def auth_or_register(payload: schemas.PlayerCreate, db: Session = Depends(get_db)):
    """Log in if the chef exists (password checked), otherwise create them."""
    handle = payload.handle.strip()
    player = _find(db, handle)
    if player:
        _check_password(db, player, payload.password)
    else:
        player = Player(handle=handle, password_hash=hash_password(payload.password))
        db.add(player)
        db.commit()
        db.refresh(player)
    return _registered(player)


@router.get('', response_model=list[schemas.PlayerSummary])
def list_chefs(limit: int = 50, db: Session = Depends(get_db)):
    """List available/existing chefs with their stats."""
    # One grouped query instead of a COUNT per chef.
    rows = (db.query(Player, func.count(Attempt.id))
            .outerjoin(Attempt, Attempt.player_id == Player.id)
            .group_by(Player.id)
            .order_by(Player.points.desc(), Player.created_at.desc())
            .limit(min(limit, 100)).all())
    results = []
    for p, served in rows:
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
