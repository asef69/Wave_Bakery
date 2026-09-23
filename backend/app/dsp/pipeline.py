"""
The canonical pipeline.

Everything the game scores flows through `run_pipeline`. It is called twice
per attempt: once on pristine ingredient signals with the recipe's exact
parameters to build the *reference dish*, and once on the player's filtered
signals with the player's parameters. Grading is then a comparison of two
outputs of one deterministic function, which makes it impossible for the
target to drift out of sync with the mechanics.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np

from . import core as C
from . import systems


# --------------------------------------------------------------------------
# filter specifications (what the client sends, what the server rebuilds)
# --------------------------------------------------------------------------
def gain_fn_from_spec(spec: dict) -> C.GainFn:
    kind = spec.get('kind')
    if kind == 'lowpass':
        return C.lowpass(float(spec['cutoff']))
    if kind == 'highpass':
        return C.highpass(float(spec['cutoff']))
    if kind == 'bandpass':
        return C.bandpass(float(spec['low']), float(spec['high']))
    if kind == 'notch':
        return C.notch(float(spec['center']), float(spec['bandwidth']), 0.03)
    if kind == 'dehum':
        return C.harmonic_notch(float(spec['f0']), float(spec.get('bandwidth', 14)), 8, 0.03)
    raise ValueError(f'unknown filter kind: {kind}')


def build_gain_chain(bands: Sequence[dict] | None,
                     tools: Sequence[dict] | None) -> C.GainFn:
    fns: list[C.GainFn] = []
    if bands:
        fns.append(C.equalizer(bands))
    for spec in (tools or []):
        fns.append(gain_fn_from_spec(spec))
    if not fns:
        return lambda hz: np.ones_like(hz)
    return C.chain(fns)


def apply_filter_chain(dirty: np.ndarray, bands, tools) -> np.ndarray:
    """FFT -> spectral mask -> IFFT, exactly as the cleaning station does."""
    n = C.next_pow2(dirty.size)
    mask = C.build_mask(n, build_gain_chain(bands, tools))
    return C.apply_mask(dirty, mask, n)


def default_bands(count: int = 8, sr: int = C.SR) -> list[dict]:
    """Log-spaced graphic EQ bands from 30 Hz to Nyquist, all flat."""
    lo, hi = 30.0, sr / 2
    out = []
    for i in range(count):
        out.append({
            'f_lo': lo * (hi / lo) ** (i / count),
            'f_hi': lo * (hi / lo) ** ((i + 1) / count),
            'gain_db': 0.0,
        })
    return out


# --------------------------------------------------------------------------
# stages
# --------------------------------------------------------------------------
def stage_mix(signals: Sequence[np.ndarray]) -> np.ndarray:
    """Superposition, with a 1/sqrt(K) normalisation so bowls stay comparable."""
    if not len(signals):
        return np.zeros(C.FRAME, dtype=np.float32)
    padded = [C.resize(s, C.FRAME) for s in signals]
    return C.gain(C.add(padded), 1.0 / np.sqrt(len(padded)))


def stage_season(x: np.ndarray, a: float) -> np.ndarray:
    return C.gain(x, a)


def stage_blend(x: np.ndarray, alpha: float) -> np.ndarray:
    return C.time_scale(x, alpha)


def stage_marinate(x: np.ndarray, seconds: float, sr: int = C.SR) -> np.ndarray:
    samples = seconds * sr
    if abs(samples) < 0.5:
        return x.astype(np.float32, copy=True)
    padded = C.resize(x, x.size + int(np.ceil(abs(samples))) + 1)
    return C.time_shift(padded, samples)


def stage_caramelize(x: np.ndarray, carrier: float | None,
                     depth: float | None) -> np.ndarray:
    if not carrier or not depth:
        return x.astype(np.float32, copy=True)
    return C.am_modulate(x, carrier, depth)


def stage_chop(x: np.ndarray, factor: int | None,
               anti_alias: bool = True) -> tuple[np.ndarray, float]:
    if not factor or factor <= 1:
        return x.astype(np.float32, copy=True), C.SR / 2
    return C.decimate(x, factor, anti_alias)


def stage_cook(x: np.ndarray, appliance_ids: Sequence[str]) -> np.ndarray:
    y = x.astype(np.float32, copy=True)
    for aid in appliance_ids:
        y = C.apply_system(y, systems.ir(aid), keep_length=True)
    return y


# --------------------------------------------------------------------------
# the pipeline
# --------------------------------------------------------------------------
def run_pipeline(ingredient_signals: Sequence[np.ndarray], params: dict) -> dict:
    """
    params = {
      seasoning: float, blend: float, marinate: float,
      caramelize: {carrier, depth} | None,
      chop: {factor, anti_alias} | None,
      appliances: [str],
    }
    Every intermediate signal is retained so the client can plot or play any
    stage, and so an early parameter change only re-runs what follows it.
    """
    out: dict = {}
    out['mixed'] = stage_mix(ingredient_signals)
    out['seasoned'] = stage_season(out['mixed'], float(params.get('seasoning', 1.0)))
    out['blended'] = stage_blend(out['seasoned'], float(params.get('blend', 1.0)))
    out['marinated'] = stage_marinate(out['blended'], float(params.get('marinate', 0.0)))

    car = params.get('caramelize') or {}
    out['modulated'] = stage_caramelize(out['marinated'],
                                        car.get('carrier'), car.get('depth'))

    chop = params.get('chop') or {}
    chopped, nyquist = stage_chop(out['modulated'], chop.get('factor'),
                                  bool(chop.get('anti_alias', True)))
    out['chopped'] = chopped
    out['nyquist'] = nyquist

    out['cooked'] = stage_cook(out['chopped'], params.get('appliances') or [])
    out['final'] = C.normalize(out['cooked'], 0.9)
    return out


def reference_params(recipe: dict) -> dict:
    """The parameter set that produces a flawless dish for this recipe."""
    return {
        'seasoning': recipe['seasoning'],
        'blend': recipe['blend'],
        'marinate': recipe['marinate'],
        'caramelize': ({'carrier': recipe['caramelize_carrier'],
                        'depth': recipe['caramelize_depth']}
                       if recipe.get('caramelize_carrier') else None),
        'chop': ({'factor': recipe['chop_factor'], 'anti_alias': True}
                 if recipe.get('chop_factor') else None),
        'appliances': list(recipe['appliances']),
    }
