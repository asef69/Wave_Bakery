"""
Game sessions — the heart of the API.

Nothing the client sends is trusted as audio. A session stores only a seed and
a filter *specification*; the server regenerates the ingredients, rebuilds the
filter chain, re-runs the pipeline and computes the score itself.
"""
from __future__ import annotations

import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import config, gameplay, schemas
from ..database import get_db
from ..deps import current_player, owned_session
from ..dsp import core as C
from ..dsp import pipeline
from ..models import Attempt, GameSession, Ingredient, Player, Recipe, SessionIngredient

router = APIRouter(prefix='/sessions', tags=['sessions'])


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _item_payload(db: Session, session: GameSession,
                  item: SessionIngredient) -> schemas.SessionItemOut:
    ing = db.get(Ingredient, item.ingredient_id)
    clean, dirty, _, components = gameplay.dirty_signal(item, ing, session.recipe.noise_difficulty)
    return schemas.SessionItemOut(
        slot=item.slot, ingredient_id=ing.id, name=ing.name, emoji=ing.emoji,
        color=ing.color, voice=ing.voice, f0=ing.f0,
        components=components,
        contaminants=[schemas.ContaminantOut(**c) for c in (item.contaminants or [])],
        bands=[schemas.EqBand(**b) for b in (item.bands or [])],
        tools=[schemas.FilterTool(**t) for t in (item.tools or [])],
        prep_score=item.prep_score, accepted=item.accepted,
        dirty=schemas.SignalPayload(**gameplay.signal_payload(dirty)),
        clean_preview=schemas.SignalPayload(**gameplay.signal_payload(clean)))


def _session_payload(db: Session, session: GameSession,
                     player: Player) -> schemas.SessionOut:
    r: Recipe = session.recipe
    best = (db.query(func.max(Attempt.score))
            .filter(Attempt.player_id == player.id, Attempt.recipe_id == r.id,
                    gameplay.in_season())
            .scalar())
    card = schemas.RecipeCard(
        id=r.id, name=r.name, emoji=r.emoji,
        tagline=r.tagline or '', difficulty=r.difficulty or 'Easy',
        tier=r.tier, story=r.story,
        prep_time=r.prep_time or '5 mins', servings=r.servings or '1 serving',
        page_number=r.page_number or 1,
        ingredients=list(r.ingredients or []),
        washable_ingredients=list(r.washable_ingredients or []),
        cooking_method=r.cooking_method or 'grill',
        teaches=list(r.teaches or []),
        unlocked=True, best_score=round(float(best), 2) if best is not None else None)
    return schemas.SessionOut(
        id=session.id, recipe=card, seed=session.seed, status=session.status,
        params=schemas.CookParams(**(session.params or {})),
        items=[_item_payload(db, session, i) for i in session.items],
        requires_caramelize=bool(r.caramelize_carrier),
        requires_chop=bool(r.chop_factor))


def _filter_response(db: Session, session: GameSession, item: SessionIngredient,
                     want_spectrogram: bool) -> schemas.FilterResponse:
    ing = db.get(Ingredient, item.ingredient_id)
    clean, dirty, contaminants, _ = gameplay.dirty_signal(
        item, ing, session.recipe.noise_difficulty)
    filtered = gameplay.filtered_signal(item, dirty)

    from ..dsp import metrics
    prep = metrics.prep_quality(clean, dirty, filtered, contaminants)
    item.prep_score = prep['score']
    db.commit()

    freqs, curve = gameplay.filter_curve(item.bands, item.tools)
    return schemas.FilterResponse(
        slot=item.slot,
        prep=schemas.PrepResult(**prep),
        signal=schemas.SignalPayload(**gameplay.signal_payload(filtered)),
        spectrum=schemas.SpectrumPayload(**gameplay.spectrum_payload(filtered)),
        clean_spectrum=schemas.SpectrumPayload(**gameplay.spectrum_payload(clean)),
        filter_freqs=freqs, filter_curve=curve,
        spectrogram=(schemas.SpectrogramPayload(**gameplay.spectrogram_payload(filtered))
                     if want_spectrogram else None),
        accepted=item.accepted)


def _require_active(session: GameSession) -> None:
    """A served or abandoned dish is final: no more edits to it."""
    if session.status != 'active':
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f'This dish is already {session.status}; start a new one.')


def _get_item(session: GameSession, slot: int) -> SessionIngredient:
    for i in session.items:
        if i.slot == slot:
            return i
    raise HTTPException(status.HTTP_404_NOT_FOUND, f'No ingredient in slot {slot}.')


# --------------------------------------------------------------------------
# lifecycle
# --------------------------------------------------------------------------
@router.post('', response_model=schemas.SessionOut, status_code=status.HTTP_201_CREATED)
def start_session(payload: schemas.SessionCreate,
                  db: Session = Depends(get_db),
                  player: Player = Depends(current_player)):
    """Begin a service. Ingredients are contaminated deterministically from a seed."""
    recipe = db.get(Recipe, payload.recipe_id)
    if recipe is None or not recipe.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'No such recipe.')
    # Locked tiers can be played (the client offers every recipe, and a 403
    # here silently kept those runs off the leaderboard); they just earn no
    # career points and don't count towards unlocking — see submit().

    seed = random.randrange(1, 2 ** 31 - 1)
    session = GameSession(player_id=player.id, recipe_id=recipe.id, seed=seed,
                          difficulty=payload.difficulty,
                          params=gameplay.default_params(recipe))
    db.add(session)
    db.flush()

    for slot, ing_id in enumerate(recipe.ingredients or []):
        ing = db.get(Ingredient, ing_id)
        if ing is None:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                                f'Recipe references a missing ingredient: {ing_id}')
        item = SessionIngredient(session_id=session.id, ingredient_id=ing_id,
                                 slot=slot, seed=seed + slot * 977,
                                 bands=pipeline.default_bands(), tools=[])
        _, _, contaminants, _ = gameplay.dirty_signal(item, ing, recipe.noise_difficulty)
        item.contaminants = contaminants
        db.add(item)

    db.commit()
    db.refresh(session)
    return _session_payload(db, session, player)


@router.get('/{session_id}', response_model=schemas.SessionOut)
def get_session(session: GameSession = Depends(owned_session),
                db: Session = Depends(get_db),
                player: Player = Depends(current_player)):
    return _session_payload(db, session, player)


@router.delete('/{session_id}', status_code=status.HTTP_204_NO_CONTENT)
def abandon(session: GameSession = Depends(owned_session),
            db: Session = Depends(get_db)):
    _require_active(session)
    session.status = 'abandoned'
    db.commit()


# --------------------------------------------------------------------------
# the Fourier machine
# --------------------------------------------------------------------------
@router.post('/{session_id}/ingredients/{slot}/filter',
             response_model=schemas.FilterResponse)
def apply_filters(slot: int, payload: schemas.FilterRequest,
                  session: GameSession = Depends(owned_session),
                  db: Session = Depends(get_db)):
    """FFT -> spectral mask -> IFFT, scored for removal and preservation."""
    _require_active(session)
    item = _get_item(session, slot)
    item.bands = [b.model_dump() for b in payload.bands] or item.bands
    item.tools = [t.model_dump(exclude_none=True) for t in payload.tools]
    db.commit()
    return _filter_response(db, session, item, payload.want_spectrogram)


@router.post('/{session_id}/ingredients/{slot}/accept',
             response_model=schemas.FilterResponse)
def accept_ingredient(slot: int,
                      session: GameSession = Depends(owned_session),
                      db: Session = Depends(get_db)):
    """An ingredient below the cleanliness threshold cannot enter the bowl."""
    _require_active(session)
    item = _get_item(session, slot)
    resp = _filter_response(db, session, item, False)
    # Rejected for being too dirty OR for being scrubbed to death — the two
    # failure modes of the cleaning station are both disqualifying.
    if (resp.prep.score < config.PREP_ACCEPT_THRESHOLD
            or resp.prep.over_filtered or resp.prep.still_dirty):
        item.accepted = False
        db.commit()
        reason = ('over-filtered — you cut the ingredient itself'
                  if resp.prep.over_filtered else
                  'still dirty — contamination remains'
                  if resp.prep.still_dirty else
                  f'cleanliness {resp.prep.score:.0f} is below '
                  f'{config.PREP_ACCEPT_THRESHOLD:.0f}')
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f'Rejected at the counter — {reason}.')
    item.accepted = True
    db.commit()
    resp.accepted = True
    return resp


@router.get('/{session_id}/ingredients/{slot}/spectrogram',
            response_model=schemas.SpectrogramPayload)
def ingredient_spectrogram(slot: int, source: str = Query('dirty', pattern='^(dirty|filtered|clean)$'),
                           session: GameSession = Depends(owned_session),
                           db: Session = Depends(get_db)):
    item = _get_item(session, slot)
    ing = db.get(Ingredient, item.ingredient_id)
    clean, dirty, _, _ = gameplay.dirty_signal(item, ing, session.recipe.noise_difficulty)
    sig = {'clean': clean, 'dirty': dirty,
           'filtered': gameplay.filtered_signal(item, dirty)}[source]
    return schemas.SpectrogramPayload(**gameplay.spectrogram_payload(sig))


# --------------------------------------------------------------------------
# downstream stations
# --------------------------------------------------------------------------
@router.put('/{session_id}/params', response_model=schemas.StagesOut)
def set_params(payload: schemas.CookParams,
               session: GameSession = Depends(owned_session),
               db: Session = Depends(get_db)):
    """Update the cooking parameters and get every recomputed stage back."""
    _require_active(session)
    from ..dsp import systems
    for a in payload.appliances:
        if a not in systems.BUILDERS:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                                f'Unknown appliance: {a}')
    session.params = payload.model_dump()
    db.commit()
    stages, _ = gameplay.compute_stages(db, session)
    return schemas.StagesOut(**gameplay.stages_payload(stages, session))


@router.get('/{session_id}/stages', response_model=schemas.StagesOut)
def get_stages(session: GameSession = Depends(owned_session),
               db: Session = Depends(get_db)):
    stages, _ = gameplay.compute_stages(db, session)
    return schemas.StagesOut(**gameplay.stages_payload(stages, session))


@router.get('/{session_id}/convolution', response_model=schemas.ConvolutionOut)
def convolution(lag: int = Query(0, ge=0),
                session: GameSession = Depends(owned_session),
                db: Session = Depends(get_db)):
    """The interactive sliding view: a genuine partial convolution at this lag."""
    stages, _ = gameplay.compute_stages(db, session)
    appliances = (session.params or {}).get('appliances') or []
    return schemas.ConvolutionOut(
        **gameplay.convolution_view(stages, appliances, lag))


# --------------------------------------------------------------------------
# the pass
# --------------------------------------------------------------------------
@router.post('/{session_id}/submit', response_model=schemas.SubmitResult)
def submit(session: GameSession = Depends(owned_session),
           db: Session = Depends(get_db),
           player: Player = Depends(current_player)):
    """Serve the dish. Everything is recomputed server-side before scoring."""
    # Claim the session atomically: two near-simultaneous submits used to both
    # pass a plain status check and each write an Attempt (duplicate rows).
    claimed = (db.query(GameSession)
               .filter(GameSession.id == session.id, GameSession.status != 'served')
               .update({GameSession.status: 'served'}, synchronize_session=False))
    db.commit()
    if not claimed:
        raise HTTPException(status.HTTP_409_CONFLICT, 'This dish has already been served.')
    db.refresh(session)

    try:
        verdict = gameplay.judge(db, session)
        recipe: Recipe = session.recipe

        # Personal best this season (older runs were judged by other rules).
        previous_best = (db.query(func.max(Attempt.score))
                         .filter(Attempt.player_id == player.id,
                                 Attempt.recipe_id == recipe.id,
                                 gameplay.in_season()).scalar())
        # Runs on a tier the chef hasn't unlocked are ranked but earn nothing.
        tier_unlocked = recipe.tier <= player.unlocked_tier
        points = (gameplay.award(db, player, recipe, verdict['score'], previous_best)
                  if tier_unlocked else 0)

        m = verdict['metrics']
        served_at = datetime.utcnow()
        total, bonus = gameplay.run_total(
            verdict['score'], session.difficulty,
            (served_at - session.created_at).total_seconds())
        attempt = Attempt(
            session_id=session.id, player_id=player.id, recipe_id=recipe.id,
            score=verdict['score'], stars=verdict['stars'],
            prep_score=verdict['prep_score'], snr_db=m['snr_db'], mse=m['mse'],
            correlation=m['correlation'], spectral_similarity=m['spectral_similarity'],
            points_awarded=points, difficulty=session.difficulty,
            total_score=total, time_bonus=bonus,
            scoring_version=gameplay.SCORING_VERSION,
            notes=verdict['notes'], params=session.params or {})
        db.add(attempt)

        session.served_at = served_at
        db.flush()
        if tier_unlocked:
            gameplay.maybe_unlock(db, player)   # after the attempt exists, so it counts
        db.commit()
    except Exception:
        # Release the claim so the dish can be served again once fixed.
        db.rollback()
        db.query(GameSession).filter(GameSession.id == session.id).update(
            {GameSession.status: 'active'}, synchronize_session=False)
        db.commit()
        raise
    db.refresh(attempt)
    db.refresh(player)

    title, _ = gameplay.rank_for(player.points)
    target_final = verdict['target']['final']
    player_final = verdict['stages']['final']

    return schemas.SubmitResult(
        attempt_id=attempt.id, score=verdict['score'], stars=verdict['stars'],
        prep_score=verdict['prep_score'],
        filtering_score=verdict.get('filtering_score'),
        mixing_score=verdict.get('mixing_score'),
        transform_score=verdict.get('transform_score'),
        cooking_score=verdict.get('cooking_score'),
        delivery_score=verdict.get('delivery_score'),
        system_score=verdict.get('system_score'),
        snr_db=m['snr_db'], mse=m['mse'],
        correlation=m['correlation'], spectral_similarity=m['spectral_similarity'],
        points_awarded=points, total_points=player.points,
        total_score=attempt.total_score, time_bonus=attempt.time_bonus,
        unlocked_tier=player.unlocked_tier, rank_title=title,
        notes=verdict['notes'],
        target=schemas.SignalPayload(**gameplay.signal_payload(target_final)),
        player_dish=schemas.SignalPayload(**gameplay.signal_payload(player_final)),
        target_spectrum=schemas.SpectrumPayload(**gameplay.spectrum_payload(target_final)),
        player_spectrum=schemas.SpectrumPayload(**gameplay.spectrum_payload(player_final)))
