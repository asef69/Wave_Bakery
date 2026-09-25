"""Leaderboards and aggregate statistics."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, desc, func, or_
from sqlalchemy.orm import Session

from .. import gameplay, schemas
from ..database import get_db
from ..models import Attempt, GameSession, Player, Recipe

router = APIRouter(tags=['leaderboard'])

# A run's overall score (what the score screen shows). Runs from before it
# was stored fall back to dish x 10 (no difficulty or time bonus known).
_TOTAL = func.coalesce(Attempt.total_score, func.round(Attempt.score * 10))


def _total_of(attempt: Attempt) -> int:
    return (attempt.total_score if attempt.total_score is not None
            else round(attempt.score * 10))


@router.get('/leaderboard', response_model=list[schemas.LeaderboardRow])
def leaderboard(recipe_id: str | None = Query(None),
                difficulty: schemas.Difficulty | None = Query(None),
                limit: int = Query(20, ge=1, le=100),
                db: Session = Depends(get_db)):
    """Best single dish per player, globally or for one recipe (and difficulty)."""
    q = (db.query(Attempt, Player.handle, Recipe.name)
         .join(Player, Player.id == Attempt.player_id)
         .join(Recipe, Recipe.id == Attempt.recipe_id))
    if recipe_id:
        if db.get(Recipe, recipe_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, 'No such recipe.')
        q = q.filter(Attempt.recipe_id == recipe_id)
    if difficulty:
        # Runs from before difficulty was recorded (NULL) stay visible in
        # every difficulty view rather than vanishing from the board.
        q = q.filter(or_(Attempt.difficulty == difficulty, Attempt.difficulty.is_(None)))

    # No row cap before de-duplicating: `limit * 4` let one chef's many runs
    # fill the window and push other chefs off the board.
    rows = q.order_by(desc(_TOTAL), Attempt.created_at).all()

    seen: set[str] = set()
    out: list[schemas.LeaderboardRow] = []
    for attempt, handle, recipe_name in rows:
        key = attempt.player_id if recipe_id else f'{attempt.player_id}:{attempt.recipe_id}'
        if key in seen:
            continue
        seen.add(key)
        out.append(schemas.LeaderboardRow(
            rank=len(out) + 1, player_id=attempt.player_id, handle=handle,
            score=round(attempt.score, 2), total_score=_total_of(attempt),
            stars=attempt.stars,
            recipe_id=attempt.recipe_id, recipe_name=recipe_name,
            difficulty=attempt.difficulty, created_at=attempt.created_at))
        if len(out) >= limit:
            break
    return out


@router.get('/leaderboard/global', response_model=list[schemas.GlobalRankRow])
def global_ranking(limit: int = Query(20, ge=1, le=100),
                   db: Session = Depends(get_db)):
    """Career table: cumulative points, chef rank, dishes served."""
    rows = (db.query(Player,
                     func.count(Attempt.id).label('served'),
                     func.coalesce(func.max(_TOTAL), 0).label('best'))
            .outerjoin(Attempt, Attempt.player_id == Player.id)
            .group_by(Player.id)
            .order_by(desc(Player.points), desc('best'))
            .limit(limit).all())
    out = []
    for i, (player, served, best) in enumerate(rows, start=1):
        title, _ = gameplay.rank_for(player.points)
        out.append(schemas.GlobalRankRow(
            rank=i, player_id=player.id, handle=player.handle,
            points=player.points, rank_title=title,
            dishes_served=int(served), best_score=int(best)))
    return out


@router.get('/stats', response_model=schemas.GlobalStats)
def stats(db: Session = Depends(get_db)):
    """Kitchen analytics — which dishes are actually hard, and how hard."""
    players = db.query(func.count(Player.id)).scalar() or 0
    started = db.query(func.count(GameSession.id)).scalar() or 0
    served = db.query(func.count(Attempt.id)).scalar() or 0
    avg = db.query(func.avg(Attempt.score)).scalar()

    rows = (db.query(Recipe.id, Recipe.name, Recipe.tier,
                     func.count(Attempt.id),
                     func.avg(Attempt.score),
                     func.max(Attempt.score),
                     func.sum(case((Attempt.stars == 5, 1), else_=0)))
            .outerjoin(Attempt, Attempt.recipe_id == Recipe.id)
            .group_by(Recipe.id)
            .order_by(Recipe.tier, Recipe.name).all())

    per_recipe: list[schemas.RecipeStats] = []
    for rid, name, tier, plays, mean, best, fives in rows:
        plays = int(plays or 0)
        per_recipe.append(schemas.RecipeStats(
            recipe_id=rid, recipe_name=name, tier=tier, plays=plays,
            average_score=round(float(mean or 0), 2),
            best_score=round(float(best or 0), 2),
            five_star_rate=round(float(fives or 0) / plays, 3) if plays else 0.0))

    played = [r for r in per_recipe if r.plays > 0]
    hardest = min(played, key=lambda r: r.average_score).recipe_name if played else None
    easiest = max(played, key=lambda r: r.average_score).recipe_name if played else None

    return schemas.GlobalStats(
        players=int(players), sessions_started=int(started), dishes_served=int(served),
        average_score=round(float(avg or 0), 2),
        hardest_recipe=hardest, easiest_recipe=easiest, recipes=per_recipe)
