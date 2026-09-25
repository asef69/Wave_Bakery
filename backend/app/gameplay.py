"""
Gameplay service layer.

The server is authoritative. It never trusts a signal sent by the client:
ingredients are regenerated from the session seed, the player's filter chain is
rebuilt from its specification, and the whole pipeline is re-run here before a
score is written. The browser's local DSP exists only to make sliders feel
instant.
"""
from __future__ import annotations

import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session as DbSession

from . import config
from .dsp import core as C
from .dsp import contamination, instruments, metrics, pipeline, systems
from . import delivery
from .models import GameSession, Ingredient, Player, Recipe, SessionIngredient

RANKS = [
    (0, 'Dishwasher', '🧽'),
    (250, 'Prep Cook', '🔪'),
    (600, 'Line Cook', '🍳'),
    (1100, 'Sous Chef', '🥄'),
    (1800, 'Head Chef', '👨‍🍳'),
    (2600, 'Signal Master', '📡'),
]


def rank_for(points: int) -> tuple[str, str]:
    title, emoji = RANKS[0][1], RANKS[0][2]
    for threshold, t, e in RANKS:
        if points >= threshold:
            title, emoji = t, e
    return title, emoji


def next_rank(points: int) -> tuple[str | None, int | None]:
    for threshold, title, _ in RANKS:
        if points < threshold:
            return title, threshold - points
    return None, None


# --------------------------------------------------------------------------
# payload builders
# --------------------------------------------------------------------------
def signal_payload(x: np.ndarray, audio: bool = True,
                   points: int = config.PLOT_POINTS) -> dict:
    return {
        'length': int(x.size),
        'sample_rate': C.SR,
        'plot': C.downsample_for_plot(x, points),
        'audio': C.encode(x) if audio else None,
    }


def spectrum_payload(x: np.ndarray, points: int = 512) -> dict:
    n = C.next_pow2(max(512, x.size))
    mag = C.magnitude(x, n)
    db = C.magnitude_db(mag / max(1.0, n / 4), -90.0)
    freqs = C.bin_freqs(n, C.SR)
    # log-spaced resample so the payload stays small but the low end stays dense
    lo, hi = 20.0, C.SR / 2
    grid = np.logspace(np.log10(lo), np.log10(hi), points)
    resampled = np.interp(grid, freqs, db)
    return {
        'freqs': [round(float(v), 2) for v in grid],
        'db': [round(float(v), 2) for v in resampled],
        'sample_rate': C.SR,
        'nfft': int(n),
    }


def spectrogram_payload(x: np.ndarray, win: int = 256, hop: int = 64) -> dict:
    f, t, S = C.stft_magnitude(x, win, hop)
    db = C.magnitude_db(S / max(1.0, win / 4), -75.0)
    # thin the time axis so the JSON stays reasonable
    max_frames = 120
    if db.shape[1] > max_frames:
        idx = np.linspace(0, db.shape[1] - 1, max_frames).astype(int)
        db, t = db[:, idx], t[idx]
    return {
        'freqs': [round(float(v), 1) for v in f],
        'times': [round(float(v), 4) for v in t],
        'db': [[round(float(v), 1) for v in row] for row in db.T],
    }


def filter_curve(bands, tools, points: int = 512) -> tuple[list[float], list[float]]:
    grid = np.logspace(np.log10(20.0), np.log10(C.SR / 2), points)
    fn = pipeline.build_gain_chain(bands, tools)
    gains = np.clip(fn(grid), 0.0, 4.0)
    return ([round(float(v), 2) for v in grid],
            [round(float(v), 4) for v in gains])


# --------------------------------------------------------------------------
# ingredient regeneration (never trust the client)
# --------------------------------------------------------------------------
def clean_signal(ingredient: Ingredient) -> np.ndarray:
    try:
        sig = instruments.synth(ingredient.voice, C.FRAME, ingredient.f0)
        return sig
    except Exception:
        f = ingredient.f0 if ingredient.f0 and ingredient.f0 > 0 else 440.0
        return C.normalize(C.tone(C.FRAME, 0.9, f), 0.9)


def dirty_signal(item: SessionIngredient, ingredient: Ingredient,
                 difficulty: float) -> tuple[np.ndarray, np.ndarray, list, list]:
    """Deterministically re-derive (clean, dirty, contaminants, components) from the seed.

    Returns the clean signal, the contaminated signal, a list of contaminant dicts,
    and a small components list describing the additive sine components where applicable.
    """
    clean = clean_signal(ingredient)
    # Only washable ingredients arrive contaminated; non-washable items arrive clean.
    effective_diff = difficulty if getattr(ingredient, 'washable', False) else 0.0
    dirty, found = contamination.corrupt(
        clean, effective_diff, item.seed,
        ideal_cutoff=getattr(ingredient, 'ideal_cutoff', None))

    comps = [{'freq': float(ingredient.f0 or 440.0), 'amp': 1.0}]
    return clean, dirty, [c.dict() for c in found], comps


def filtered_signal(item: SessionIngredient, dirty: np.ndarray) -> np.ndarray:
    return pipeline.apply_filter_chain(dirty, item.bands, item.tools)


def session_signals(db: DbSession, session: GameSession) -> list[dict]:
    """Everything the pipeline needs for one session, rebuilt from scratch."""
    recipe: Recipe = session.recipe
    out = []
    for item in session.items:
        ing = db.get(Ingredient, item.ingredient_id)
        clean, dirty, found, components = dirty_signal(item, ing, recipe.noise_difficulty)
        out.append({
            'item': item, 'ingredient': ing, 'clean': clean, 'dirty': dirty,
            'contaminants': found, 'filtered': filtered_signal(item, dirty),
            'components': components,
        })
    return out


# --------------------------------------------------------------------------
# parameters
# --------------------------------------------------------------------------
def params_to_pipeline(params: dict) -> dict:
    appliances = list(params.get('appliances') or [])
    cooking_method = params.get('cooking_method')
    if cooking_method and cooking_method not in appliances:
        appliances = [cooking_method]
    return {
        'seasoning': params.get('seasoning', 1.0),
        'blend': params.get('blend', params.get('frequency', 1.0)),
        'frequency': params.get('frequency', params.get('blend', 1.0)),
        'marinate': params.get('marinate', 0.0),
        'caramelize': ({'carrier': params['carrier'], 'depth': params['depth']}
                       if params.get('carrier') and params.get('depth') else None),
        'chop': ({'factor': params['chop_factor'],
                  'anti_alias': params.get('anti_alias', True)}
                 if params.get('chop_factor') else None),
        'appliances': appliances,
    }


def default_params(recipe: Recipe) -> dict:
    """Deliberately wrong starting point — the player has work to do."""
    return {
        'seasoning': 0.4,
        'blend': 1.0,
        'marinate': 0.0,
        'carrier': 120.0 if recipe.caramelize_carrier else None,
        'depth': 0.0 if recipe.caramelize_carrier else None,
        'chop_factor': 1 if recipe.chop_factor else None,
        'anti_alias': True,
        'appliances': [],
    }


# --------------------------------------------------------------------------
# stages
# --------------------------------------------------------------------------
def bowl_signals(db: DbSession, session: GameSession, signals: list[dict]) -> list:
    """
    The signals the player actually mixed. Recipe ingredients in the bowl use
    their filtered version; extra (non-recipe) ingredients from the catalogue
    go in clean; anything left out is simply missing from the mix. No bowl
    recorded (older clients) means the whole recipe, as before.
    """
    bowl = (session.params or {}).get('bowl')
    if bowl is None:
        return [s['filtered'] for s in signals]
    wanted = {str(n).strip().lower() for n in bowl}
    mixed = [s['filtered'] for s in signals if s['ingredient'].name.lower() in wanted]
    in_recipe = {s['ingredient'].name.lower() for s in signals}
    for name in sorted(wanted - in_recipe):
        extra = db.query(Ingredient).filter(func.lower(Ingredient.name) == name).first()
        if extra is not None:
            mixed.append(clean_signal(extra))
    return mixed


def compute_stages(db: DbSession, session: GameSession) -> tuple[dict, list[dict]]:
    signals = session_signals(db, session)
    stages = pipeline.run_pipeline(bowl_signals(db, session, signals),
                                   params_to_pipeline(session.params or {}))
    return stages, signals


def finish_dish(recipe_id: str, cooked: np.ndarray, reference: np.ndarray,
                params: dict) -> tuple[np.ndarray, float | None, float | None]:
    """
    The dish actually served, rebuilt from the player's finishing settings:
    cooking leaves a burnt overtone; the Precision Oven (if used) filters it;
    the delivery cart (if used) adds road vibration and filters with its H(z).
    Returns (served dish, oven sub-score, cart sub-score). Mirrors the
    browser (frontend/src/lib/delivery.ts), so both judge the same problem.
    """
    scale = delivery.hz_per_game_hz(recipe_id, reference, cooked.size)
    used_oven = bool(params.get('oven_f0'))
    dish = delivery.bake(cooked, recipe_id, scale, params if used_oven else None)
    oven_score = cart_score = None
    if used_oven:
        oven_score = round(metrics.dish_metrics(reference, dish, common_scale=True)['score'], 2)
        if params.get('system_preset'):
            dish = delivery.deliver_on_cart(
                dish, recipe_id, params['system_preset'],
                float(params.get('system_pole_radius') or 0.0),
                float(params.get('system_omega') or 0.0))
            cart_score = round(metrics.dish_metrics(reference, dish, common_scale=True)['score'], 2)
    return dish, oven_score, cart_score


def stages_payload(stages: dict, session: GameSession) -> dict:
    appliances = (session.params or {}).get('appliances') or []
    ir = systems.cascade_ir(appliances)
    freqs, mag = C.frequency_response(ir)
    db_curve = C.magnitude_db(mag / max(1.0, mag.max() if mag.size else 1.0), -60.0)

    centroid = C.spectral_centroid(stages['marinated'])
    chop = (session.params or {}).get('chop_factor') or 1
    anti = (session.params or {}).get('anti_alias', True)
    aliasing = bool(chop > 1 and not anti and centroid > stages['nyquist'] * 0.6)

    keys = ['mixed', 'seasoned', 'blended', 'marinated', 'modulated',
            'chopped', 'cooked', 'final']
    out = {k: signal_payload(stages[k]) for k in keys}
    out.update({
        'nyquist': float(stages['nyquist']),
        'mix_spectrum': spectrum_payload(stages['mixed']),
        'blend_spectrum': spectrum_payload(stages['blended']),
        'finish_spectrum': spectrum_payload(stages['chopped']),
        'cascade_ir': C.downsample_for_plot(ir, 400),
        'cascade_response_freqs': [round(float(v), 1) for v in freqs[::4]],
        'cascade_response_db': [round(float(v), 2) for v in db_curve[::4]],
        'aliasing_detected': aliasing,
    })
    return out


def convolution_view(stages: dict, appliances: list[str], lag: int) -> dict:
    """
    Decimated copies for the interactive sliding view. The output really is
    computed by partial convolution, so the curve the player watches being
    drawn is the true partial sum at that lag.
    """
    def thin(sig: np.ndarray, target: int) -> np.ndarray:
        if sig.size <= target:
            return sig
        step = int(np.ceil(sig.size / target))
        return sig[::step]

    x = thin(stages['chopped'], 480)
    h = thin(systems.cascade_ir(appliances), 160)
    n_out = x.size + h.size - 1
    lag = int(np.clip(lag, 0, n_out - 1))
    y = C.convolve_partial(x, h, lag)

    k_lo = max(0, lag - x.size + 1)
    k_hi = min(h.size - 1, lag)
    running = float(np.sum(h[k_lo:k_hi + 1] * x[lag - k_hi: lag - k_lo + 1][::-1])) \
        if k_hi >= k_lo else 0.0

    return {
        'x': [round(float(v), 5) for v in x],
        'h': [round(float(v), 5) for v in h],
        'y': [round(float(v), 5) for v in y],
        'lag': lag,
        'max_lag': int(n_out - 1),
        'running_sum': round(running, 5),
    }


# --------------------------------------------------------------------------
# judging
# --------------------------------------------------------------------------
def judge(db: DbSession, session: GameSession) -> dict:
    recipe: Recipe = session.recipe
    stages, signals = compute_stages(db, session)

    # the reference dish: same pipeline, pristine ingredients, exact parameters
    target = pipeline.run_pipeline([s['clean'] for s in signals],
                                   pipeline.reference_params(recipe.as_dict()))

    # What was actually served: burnt overtone, then the oven and the cart.
    p = session.params or {}
    # Compared on the reference's scale (not each normalised on its own), so
    # the seasoning level counts, not just the shape.
    served, delivery_score, system_score = finish_dish(
        recipe.id, stages['cooked'], target['cooked'], p)
    stages['final'] = C.normalize(served, 0.9)          # for the returned plot/audio
    m = metrics.dish_metrics(target['cooked'], served, common_scale=True)

    preps = []
    washable_preps = []
    for s in signals:
        prep = metrics.prep_quality(s['clean'], s['dirty'], s['filtered'],
                                    s['contaminants'])
        s['prep'] = prep
        s['item'].prep_score = prep['score']
        preps.append(prep['score'])
        if getattr(s['ingredient'], 'washable', False) or s['contaminants']:
            washable_preps.append(prep['score'])

    prep_avg = float(np.mean(washable_preps)) if washable_preps else (float(np.mean(preps)) if preps else 100.0)

    notes = _diagnose(session, recipe, signals)

    # Sub-stage scores matching frontend breakdown
    filtering_score = round(prep_avg, 2)
    mixing_score = round(metrics.dish_metrics(target['mixed'], stages['mixed'])['score'], 2)
    transform_score = round(metrics.dish_metrics(
        target['marinated'], stages['marinated'], common_scale=True)['score'], 2)
    # Cooking alone: the player's own pre-cooking signal through the recipe's
    # appliances vs. through the player's. (This used to be the whole-dish
    # score, so every earlier mistake also showed up as a "cooking" error.)
    correctly_cooked = pipeline.stage_cook(stages['chopped'], list(recipe.appliances or []))
    cooking_score = round(metrics.dish_metrics(correctly_cooked, stages['cooked'])['score'], 2)

    raw = 0.72 * m['score'] + 0.28 * prep_avg

    gamma = 1.0 / max(0.3, recipe.tolerance or 1.0)
    score = float(np.clip(100.0 * (raw / 100.0) ** gamma, 0, 100))

    return {
        'metrics': m,
        'prep_score': round(prep_avg, 2),
        'filtering_score': filtering_score,
        'mixing_score': mixing_score,
        'transform_score': transform_score,
        'cooking_score': cooking_score,
        'delivery_score': delivery_score,
        'system_score': system_score,
        'score': round(score, 2),
        'stars': metrics.stars(score),
        'notes': notes or ['Textbook execution. Nothing to correct.'],
        'target': target,
        'stages': stages,
    }


def _diagnose(session: GameSession, recipe: Recipe, signals: list[dict]) -> list[str]:
    """Feedback that names the signal processing cause, not the symptom."""
    p = session.params or {}
    notes: list[str] = []

    d = p.get('seasoning', 0) - recipe.seasoning
    if abs(d) > 0.12:
        notes.append('Over-seasoned — amplitude scaling too high.' if d > 0
                     else 'Under-seasoned — amplitude scaling too low.')

    d = p.get('blend', 1.0) - recipe.blend
    if abs(d) > 0.12:
        notes.append('Over-blended — the signal is compressed too far in time.' if d > 0
                     else 'Under-blended — the signal is still too stretched.')

    d = p.get('marinate', 0.0) - recipe.marinate
    if abs(d) > 0.03:
        notes.append('Marinated too long — excess time shift.' if d > 0
                     else 'Not marinated enough — the time shift is too small.')

    if recipe.caramelize_carrier:
        if abs((p.get('depth') or 0) - (recipe.caramelize_depth or 0)) > 0.1:
            notes.append('Caramelisation depth is off — the AM sidebands are the wrong height.')
        if abs((p.get('carrier') or 0) - recipe.caramelize_carrier) > 25:
            notes.append('Wrong AM carrier — the sidebands are in the wrong place.')

    if recipe.chop_factor:
        if (p.get('chop_factor') or 1) != recipe.chop_factor:
            notes.append(f'Chop size wrong — the decimation factor should be {recipe.chop_factor}.')
        if not p.get('anti_alias', True):
            notes.append('Aliasing! You decimated without the anti-alias filter.')

    if list(p.get('appliances') or []) != list(recipe.appliances or []):
        notes.append('Cooking chain differs from the recipe — convolution order matters.')

    for s in signals:
        prep = s.get('prep')
        if not prep:
            continue
        if prep['over_filtered']:
            notes.append(f"{s['ingredient'].name}: over-filtered — you cut real ingredient frequencies.")
        elif prep['still_dirty']:
            notes.append(f"{s['ingredient'].name}: still noisy — contamination remains in the spectrum.")

    # The finishing stations: burnt overtone and road vibration.
    notes.extend(delivery.finishing_notes(recipe.id, p))
    return notes


# Time limit (s) and score multiplier per difficulty — DIFFICULTY_CONFIGS in
# frontend/src/lib/recipes.ts and DIFFICULTY_MULTIPLIERS in routes/score.tsx.
DIFFICULTIES: dict[str, tuple[int, float]] = {
    'easy': (300, 0.8), 'medium': (210, 1.0), 'hard': (120, 1.25), 'masterchef': (60, 1.5),
}
MAX_TIME_BONUS = 300    # before difficulty: 30 % of a perfect 1000-point base


def run_total(score: float, difficulty: str | None, elapsed_s: float) -> tuple[int, int]:
    """
    (overall score, time bonus) of a run: the dish score (0-100) x 10 x the
    difficulty multiplier, plus 2 points per second left (capped), also
    scaled by difficulty. Timed on the server, from the session's start to
    the dish being served, so the browser's clock can't inflate it.
    """
    limit, mult = DIFFICULTIES.get(difficulty or 'easy', DIFFICULTIES['easy'])
    left = max(0.0, limit - max(0.0, elapsed_s))
    bonus = round(min(2 * int(left), MAX_TIME_BONUS) * mult)
    return round(score * 10 * mult) + bonus, bonus


def award(db: DbSession, player: Player, recipe: Recipe, score: float,
          previous_best: float | None) -> int:
    """Points only for beating a personal best, so grinding easy dishes fails."""
    if previous_best is not None and score <= previous_best:
        return 0
    points = int(round(score * recipe.tier * 1.5))
    player.points += points
    return points


def maybe_unlock(db: DbSession, player: Player) -> None:
    """
    Called *after* the attempt row is written, so the dish just served counts
    towards the unlock. Two dishes cleared in a tier opens the next one.
    """
    from sqlalchemy import func, select
    from .models import Attempt

    tier = player.unlocked_tier
    recipe_ids = [r.id for r in db.query(Recipe).filter(Recipe.tier == tier,
                                                        Recipe.is_active.is_(True))]
    if not recipe_ids:
        return
    cleared = db.execute(
        select(func.count(func.distinct(Attempt.recipe_id)))
        .where(Attempt.player_id == player.id,
               Attempt.recipe_id.in_(recipe_ids),
               Attempt.score >= config.TIER_UNLOCK_SCORE)
    ).scalar_one()
    needed = min(config.TIER_UNLOCK_COUNT, len(recipe_ids))
    if cleared >= needed:
        max_tier = db.query(func.max(Recipe.tier)).scalar() or tier
        player.unlocked_tier = min(int(max_tier), tier + 1)
