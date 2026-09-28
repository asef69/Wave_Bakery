"""
Finishing problems for the Precision Oven and System Delivery, rebuilt on the
server's own dish. Mirrors frontend/src/lib/delivery.ts, oven equaliser in
frontend/src/lib/precision-oven-dsp.ts and cart systems in
frontend/src/lib/z-system.ts — keep the profiles and formulas identical.

Frequencies that the player sets in the browser are in "game Hz" (cycles per
one-second window). The browser's ideal dish holds 95 % of its energy below
``dish_top`` game Hz; this dish holds 95 % below some f95 real Hz, so one game
Hz is ``f95 / dish_top`` real Hz here. Everything the oven does (bands, cutoff,
notch) and where the burnt overtone sits are mapped with that one scale, so
"the cutoff keeps the dish" and "the notch sits on the burnt overtone" mean the
same on both sides.
"""
from __future__ import annotations

import numpy as np
from .lazy import LazyModule

sps = LazyModule('scipy.signal')  # loaded on first use

from .dsp import core as C

# defect_hz: burnt overtone in game Hz (ovenDefectHz in delivery.ts, i.e.
# defectRatio x the dish's fundamental); dish_top: findMaxSignalFrequency of
# the browser's ideal dish; *_amp: fraction of the dish peak.
PROFILES: dict[str, dict[str, float]] = {
    'burger':      dict(defect_hz=18, dish_top=11, defect_amp=0.80, road_hz=2600, road_amp=0.80),
    'sandwich':    dict(defect_hz=24, dish_top=14, defect_amp=0.80, road_hz=1900, road_amp=0.80),
    'cake':        dict(defect_hz=16, dish_top=6,  defect_amp=0.90, road_hz=2300, road_amp=0.90),
    'noodles':     dict(defect_hz=20, dish_top=23, defect_amp=0.90, road_hz=2900, road_amp=0.90),
    'chicken-fry': dict(defect_hz=20, dish_top=9,  defect_amp=1.00, road_hz=1700, road_amp=1.00),
}
DEFAULT_PROFILE = dict(defect_hz=20, dish_top=12, defect_amp=0.90, road_hz=2200, road_amp=0.90)
DELIVERY_FS = 8000.0          # true rate the road frequency is defined at
OVEN_BANDS = (6.0, 16.0, 32.0)  # game-Hz band edges: base / crumb / top crisp


def profile(recipe_id: str) -> dict[str, float]:
    return PROFILES.get(recipe_id, DEFAULT_PROFILE)


def _peak(x: np.ndarray) -> float:
    p = float(np.max(np.abs(x))) if x.size else 0.0
    return p if p > 1e-12 else 1.0


def energy_top_hz(x: np.ndarray, sr: int = C.SR, fraction: float = 0.95) -> float:
    """Frequency below which `fraction` of the (non-DC) energy lies."""
    e = np.abs(np.fft.rfft(x)) ** 2
    e[0] = 0.0
    total = float(e.sum())
    if total <= 0:
        return 1000.0
    k = int(np.searchsorted(np.cumsum(e) / total, fraction))
    return max(float(k) * sr / x.size, 1.0)


def hz_per_game_hz(recipe_id: str, reference: np.ndarray, n: int, sr: int = C.SR) -> float:
    """
    Real Hz of this dish that correspond to one game Hz in the browser, nudged
    (by under half a DFT bin) so the burnt overtone falls exactly on a bin of
    an n-sample frame — a whole number of cycles, as in the browser.
    """
    rough = energy_top_hz(reference, sr) / profile(recipe_id)['dish_top']
    f = profile(recipe_id)['defect_hz']
    k = max(1, round(f * rough * n / sr))
    return k * sr / (n * f)


def burnt_overtone(x: np.ndarray, recipe_id: str, scale: float, sr: int = C.SR) -> np.ndarray:
    """The burnt overtone alone (add it to the dish to get what the kitchen serves)."""
    p = profile(recipe_id)
    t = np.arange(x.size) / sr
    return (p['defect_amp'] * _peak(x)
            * np.sin(2 * np.pi * p['defect_hz'] * scale * t)).astype(np.float32)


def oven_gain(g: np.ndarray | float, params: dict, notch: bool = True) -> np.ndarray:
    """The Precision Oven's gain at game frequency g (tuneOvenFrequencies)."""
    g = np.asarray(g, dtype=np.float64)
    gains = list(params.get('oven_gains') or [1.0, 1.0, 1.0]) + [1.0, 1.0, 1.0]
    cutoff = float(params.get('oven_cutoff') or 1e9)
    lo, mid, hi = OVEN_BANDS
    band = np.where(g < lo, gains[0], np.where(g < mid, gains[1], np.where(g <= hi, gains[2], 1.0)))
    cut = np.where(g > cutoff, np.maximum(0.01, np.exp(-(((g - cutoff) / 4.0) ** 2))), 1.0)
    # The oven only sees (and so only edits) up to its Nyquist frequency fs/2
    # (at most 32 game Hz); everything above passes unchanged, as in the
    # browser's applyOvenToDish. This dish's audio-rate tail lives there.
    nyquist = min(hi, float(params.get('oven_fs') or 2 * hi) / 2)
    out = np.where(g <= nyquist, band * cut, 1.0)
    if notch and params.get('oven_notch_on'):
        dn = np.abs(g - float(params.get('oven_notch') or 0.0))
        out = out * np.where((dn <= 3.0) & (g <= nyquist),
                             1.0 - 0.98 / (1.0 + (dn / 1.5) ** 2), 1.0)
    return out


def apply_oven(x: np.ndarray, scale: float, params: dict, notch: bool = True,
               sr: int = C.SR) -> np.ndarray:
    """The oven's equaliser on a signal, as an FFT mask over the whole frame."""
    g = np.fft.rfftfreq(x.size, 1.0 / sr) / max(scale, 1e-9)    # bin frequency in game Hz
    return np.fft.irfft(np.fft.rfft(x) * oven_gain(g, params, notch), x.size).astype(np.float32)


def bake(cooked: np.ndarray, recipe_id: str, scale: float, params: dict | None) -> np.ndarray:
    """
    What leaves the oven: cooked dish + burnt overtone, equalised. The oven is
    linear, so the two parts are filtered separately. The notch acts on the
    overtone only: in the browser the overtone sits between the dish's
    harmonics, where the dish has no energy, so a well-aimed notch costs the
    dish nothing. This dish has a continuous audio spectrum, and a game-Hz
    notch mapped onto it would carve out a band the browser's dish doesn't
    have. (A badly aimed notch is still punished: it misses the overtone.)
    """
    tone = burnt_overtone(cooked, recipe_id, scale)
    if not params:
        return (cooked + tone).astype(np.float32)
    at_tone = float(oven_gain(profile(recipe_id)['defect_hz'], params))
    return (apply_oven(cooked, scale, params, notch=False) + at_tone * tone).astype(np.float32)


def road_omega(recipe_id: str) -> float:
    return 2 * np.pi * profile(recipe_id)['road_hz'] / DELIVERY_FS


def add_road_vibration(x: np.ndarray, recipe_id: str) -> np.ndarray:
    p = profile(recipe_id)
    tone = p['road_amp'] * _peak(x) * np.cos(road_omega(recipe_id) * np.arange(x.size))
    return (x + tone).astype(np.float32)


def cart_system(preset: str, r: float, w0: float) -> tuple[list[complex], list[complex], float]:
    """(zeros, poles, gain) — same as systemPolesZeros in z-system.ts."""
    e = np.exp(1j * w0)
    if preset == 'lowpass1':
        return [0j], [complex(r)], 1.0 - r
    if preset == 'resonator2':
        return [0j, 0j], [r * e, r * np.conj(e)], 1.0
    if preset == 'moving_avg':
        return [np.exp(2j * np.pi * k / 6) for k in range(1, 6)], [0j] * 5, 1.0 / 6.0
    # notch, with unity gain away from w0 (normalised at DC or Nyquist,
    # whichever is farther) — see notchGain in z-system.ts
    c, rho = float(np.cos(w0)), 0.85
    g = ((1 - 2 * rho * c + rho * rho) / (2 - 2 * c) if c < 0
         else (1 + 2 * rho * c + rho * rho) / (2 + 2 * c))
    return [e, np.conj(e)], [rho * e, rho * np.conj(e)], g


def cart_gain(preset: str, r: float, w0: float, w: float) -> float:
    """|H(e^{jw})| of the cart: how much it scales a tone at w (rad/sample)."""
    zeros, poles, g = cart_system(preset, r, w0)
    z = np.exp(1j * w)
    num = np.prod([abs(z - q) for q in zeros]) if zeros else 1.0
    den = np.prod([abs(z - q) for q in poles]) if poles else 1.0
    return float(abs(g) * num / max(den, 1e-12))


def sensed_road_omega(recipe_id: str, sensor_hz: float) -> float:
    """Where a sensor sampling at sensor_hz reports the road tone (aliased), in rad/sample."""
    f = profile(recipe_id)['road_hz'] % sensor_hz
    if f > sensor_hz / 2:
        f = sensor_hz - f
    return 2 * np.pi * f / sensor_hz


def finishing_notes(recipe_id: str, params: dict) -> list[str]:
    """
    Feedback on the Precision Oven and the delivery cart, from the settings
    alone (exact, in the browser's own units): how much of the burnt overtone
    the oven kept, and how the cart scaled the road vibration and the dish.
    """
    notes: list[str] = []
    prof = profile(recipe_id)
    f = prof['defect_hz']
    if not params.get('oven_f0'):
        notes.append(f'Served without the Precision Oven — the burnt overtone at {f:g} Hz '
                     'is still in the dish.')
    else:
        kept = float(oven_gain(f, params))
        if kept > 0.3:
            how = ('the notch is off' if not params.get('oven_notch_on')
                   else f"the notch sits at {float(params.get('oven_notch') or 0):g} Hz")
            notes.append(f'Burnt overtone left in: the oven kept {kept:.0%} of the {f:g} Hz '
                         f'overtone ({how}) — put the notch on {f:g} Hz.')
        gains = list(params.get('oven_gains') or [1.0, 1.0, 1.0])
        off = [f'{name} ×{g:g}' for name, g in zip(('base', 'crumb', 'crisp'), gains)
               if abs(g - 1.0) > 0.3]
        if off:
            notes.append('The oven bands reshaped the dish itself (' + ', '.join(off) +
                         ') — the dish only needed the overtone removed.')

    preset = params.get('system_preset')
    if preset:
        r = float(params.get('system_pole_radius') or 0.0)
        w0 = float(params.get('system_omega') or 0.0)
        _, poles, _ = cart_system(preset, r, w0)
        road = road_omega(recipe_id)
        if any(abs(q) >= 1 for q in poles):
            notes.append('Unstable cart: a pole on or outside the unit circle, so the output '
                         'grows without bound.')
        else:
            g_road = cart_gain(preset, r, w0, road)
            g_dish = cart_gain(preset, r, w0, 0.0)
            if g_road > 1.0:
                notes.append(f'Your cart amplified the road vibration ×{g_road:.1f} — a resonator '
                             'aimed at the road frequency boosts it. Put zeros (a notch) there instead.')
            elif g_road > 0.3:
                notes.append(f'The road vibration got through the cart (×{g_road:.2f}) — '
                             f'notch it at ω₀ = {road:.2f} rad.')
            if g_dish < 0.7:
                notes.append(f'The cart dulled the dish itself (×{g_dish:.2f}).')
        fs = float(params.get('system_sampling_hz') or DELIVERY_FS)
        if fs < 2 * prof['road_hz'] and abs(w0 - sensed_road_omega(recipe_id, fs)) < 0.1 \
                and abs(w0 - road) > 0.1:
            notes.append(f'You aimed at the aliased sensor reading: a {fs:g} Hz sensor reports '
                         f"the {prof['road_hz']:g} Hz road tone at the wrong frequency.")
    return notes


def deliver_on_cart(x: np.ndarray, recipe_id: str, preset: str, r: float,
                    w0: float) -> np.ndarray:
    """Road vibration, then the cart's difference equation; peak-normalised."""
    zeros, poles, gain = cart_system(preset, r, w0)
    a = np.real(np.poly(poles))
    b = gain * np.real(np.poly(zeros))
    b = np.concatenate([np.zeros(max(0, len(poles) - len(zeros))), b])
    with np.errstate(all='ignore'):
        y = sps.lfilter(b, a, add_road_vibration(x, recipe_id).astype(np.float64))
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)
    # Keep the dish's level; only a runaway output (unstable / resonating on
    # the road) is scaled back to the dish's level. Mirrors deliverOnCart.
    p = float(np.max(np.abs(y))) if y.size else 0.0
    dish_peak = _peak(x)
    if p > 1.5 * dish_peak:
        y = y / p * dish_peak
    return y.astype(np.float32)
