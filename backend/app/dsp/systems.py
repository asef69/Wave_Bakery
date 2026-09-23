"""
Appliances — every one is an LTI system defined by an impulse response.

Impulse responses are built lazily and memoised for the process lifetime;
the 2600-tap oven is synthesised at most once.
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np

from . import core as C


# ---------------------------------------------------------------- factories
def ir_decay(length: int, tau: float, brightness: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    k = np.arange(length)
    h = (rng.uniform(-1, 1, length) * np.exp(-k / tau)).astype(np.float32)
    if brightness < 1.0:
        h = C.filter_signal(h, [C.lowpass(C.SR * 0.5 * brightness)])
    return C.normalize(h, 1.0)


def ir_comb(length: int, delay: int, feedback: float, taps: int) -> np.ndarray:
    h = np.zeros(length, dtype=np.float32)
    h[0] = 1.0
    g = 1.0
    for t in range(1, taps + 1):
        g *= feedback
        idx = t * delay
        if idx < length:
            h[idx] = g
    return h


def ir_resonator(length: int, f0: float, q: float, sr: int = C.SR) -> np.ndarray:
    k = np.arange(length)
    tau = q * sr / (2 * np.pi * f0)
    h = (np.exp(-k / tau) * np.sin(2 * np.pi * f0 * k / sr)).astype(np.float32)
    return C.normalize(h, 1.0)


def ir_moving_average(length: int) -> np.ndarray:
    return np.full(length, 1.0 / length, dtype=np.float32)


def ir_difference() -> np.ndarray:
    return np.array([1.0, -1.0], dtype=np.float32)


def ir_smoke() -> np.ndarray:
    return C.convolve(ir_comb(2000, 310, 0.55, 5), ir_decay(500, 220, 0.6, 5))


def ir_steam() -> np.ndarray:
    return C.add([ir_resonator(1400, 480, 12),
                  C.gain(ir_resonator(1400, 1150, 10), 0.6)])


# ---------------------------------------------------------------- registry
BUILDERS = {
    'grill':  lambda: ir_comb(1200, 90, 0.62, 7),
    'fry':    lambda: ir_decay(700, 130, 1.0, 11),
    'bake':   lambda: ir_decay(2600, 700, 0.35, 23),
    'boil':   lambda: ir_resonator(1600, 320, 14),
    'simmer': lambda: ir_moving_average(48),
    'sear':   ir_difference,
    'smoke':  ir_smoke,
    'steam':  ir_steam,
}


@lru_cache(maxsize=None)
def impulse_response(appliance_id: str) -> tuple:
    """Cached. Returned as a tuple so lru_cache can hash it; convert on use."""
    builder = BUILDERS.get(appliance_id)
    if builder is None:
        raise KeyError(f'unknown appliance: {appliance_id}')
    return tuple(float(v) for v in builder())


def ir(appliance_id: str) -> np.ndarray:
    return np.asarray(impulse_response(appliance_id), dtype=np.float32)


def cascade_ir(appliance_ids) -> np.ndarray:
    if not appliance_ids:
        return np.array([1.0], dtype=np.float32)
    return C.cascade([ir(a) for a in appliance_ids])
