"""Catalogue: recipes (full CRUD), ingredients and appliances."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import optional_player
from ..dsp import core as C
from ..dsp import systems
from ..models import Appliance, Attempt, Ingredient, Player, Recipe

router = APIRouter(tags=['catalogue'])


# ------------------------------------------------------------------ lookups
@router.get('/ingredients', response_model=list[schemas.IngredientOut])
def list_ingredients(db: Session = Depends(get_db)):
    return db.query(Ingredient).order_by(Ingredient.name).all()


@router.get('/appliances', response_model=list[schemas.ApplianceOut])
def list_appliances(db: Session = Depends(get_db)):
    return db.query(Appliance).order_by(Appliance.name).all()


@router.get('/appliances/{appliance_id}', response_model=schemas.ApplianceDetail)
def appliance_detail(appliance_id: str, db: Session = Depends(get_db)):
    """Impulse response and |H(f)| — an appliance card is a system, not a picture."""
    row = db.get(Appliance, appliance_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'No such appliance.')
    ir = systems.ir(appliance_id)
    freqs, mag = C.frequency_response(ir)
    db_curve = C.magnitude_db(mag / max(1e-9, float(mag.max())), -60.0)
    return schemas.ApplianceDetail(
        id=row.id, name=row.name, emoji=row.emoji, blurb=row.blurb,
        character=row.character,
        impulse_response=C.downsample_for_plot(ir, 400),
        response_freqs=[round(float(v), 1) for v in freqs[::4]],
        response_db=[round(float(v), 2) for v in db_curve[::4]])


# ------------------------------------------------------------------ recipes
@router.get('/recipes', response_model=list[schemas.RecipeCard])
def recipe_book(db: Session = Depends(get_db),
                player: Player | None = Depends(optional_player)):
    """The recipe book. Target parameters are withheld — that is the puzzle."""
    recipes = (db.query(Recipe).filter(Recipe.is_active.is_(True))
               .order_by(Recipe.tier, Recipe.name).all())
    bests: dict[str, float] = {}
    plays: dict[str, int] = {}
    if player:
        rows = (db.query(Attempt.recipe_id, func.max(Attempt.score),
                         func.count(Attempt.id))
                .filter(Attempt.player_id == player.id)
                .group_by(Attempt.recipe_id).all())
        bests = {r: float(s) for r, s, _ in rows}
        plays = {r: int(c) for r, _, c in rows}

    tier = player.unlocked_tier if player else 1
    return [schemas.RecipeCard(
        id=r.id, name=r.name, emoji=r.emoji,
        tagline=r.tagline or '', difficulty=r.difficulty or 'Easy',
        tier=r.tier, story=r.story,
        prep_time=r.prep_time or '5 mins', servings=r.servings or '1 serving',
        page_number=r.page_number or 1,
        ingredients=list(r.ingredients or []),
        washable_ingredients=list(r.washable_ingredients or []),
        cooking_method=r.cooking_method or 'grill',
        teaches=list(r.teaches or []),
        unlocked=r.tier <= tier,
        best_score=round(bests[r.id], 2) if r.id in bests else None,
        plays=plays.get(r.id, 0)) for r in recipes]


@router.get('/recipes/{recipe_id}', response_model=schemas.RecipeOut)
def get_recipe(recipe_id: str, db: Session = Depends(get_db)):
    row = db.get(Recipe, recipe_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'No such recipe.')
    return row


def _validate_refs(db: Session, ingredients: list[str], appliances: list[str]) -> None:
    for i in ingredients:
        if db.get(Ingredient, i) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                                f'Unknown ingredient: {i}')
    for a in appliances:
        if db.get(Appliance, a) is None or a not in systems.BUILDERS:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                                f'Unknown appliance: {a}')


@router.post('/recipes', response_model=schemas.RecipeOut,
             status_code=status.HTTP_201_CREATED)
def create_recipe(payload: schemas.RecipeCreate, db: Session = Depends(get_db)):
    """Author a new dish. No code change is needed to add a level."""
    if db.get(Recipe, payload.id) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, 'That recipe id exists.')
    if not payload.ingredients:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            'A recipe needs at least one ingredient.')
    _validate_refs(db, payload.ingredients, payload.appliances)
    row = Recipe(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch('/recipes/{recipe_id}', response_model=schemas.RecipeOut)
def update_recipe(recipe_id: str, payload: schemas.RecipeUpdate,
                  db: Session = Depends(get_db)):
    row = db.get(Recipe, recipe_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'No such recipe.')
    data = payload.model_dump(exclude_unset=True)
    _validate_refs(db, data.get('ingredients') or [], data.get('appliances') or [])
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete('/recipes/{recipe_id}', status_code=status.HTTP_204_NO_CONTENT)
def retire_recipe(recipe_id: str, db: Session = Depends(get_db)):
    """Soft delete — attempts keep referencing the recipe they were cooked from."""
    row = db.get(Recipe, recipe_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'No such recipe.')
    row.is_active = False
    db.commit()
