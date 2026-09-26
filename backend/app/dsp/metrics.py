"""Similarity metrics and the two scoring models (prep quality, dish score)."""
from __future__ import annotations

import numpy as np

from . import core as C


def _pair(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    n = min(a.size, b.size)
    return a[:n], b[:n]


def mse(a: np.ndarray, b: np.ndarray) -> float:
    x, y = _pair(a, b)
    if not x.size:
        return 0.0
    return float(np.mean(np.square(x.astype(np.float64) - y.astype(np.float64))))


def snr_db(ref: np.ndarray, test: np.ndarray) -> float:
    r, t = _pair(ref, test)
    sig = float(np.sum(np.square(r, dtype=np.float64)))
    err = float(np.sum(np.square(r.astype(np.float64) - t.astype(np.float64))))
    if err < 1e-15:
        return 100.0
    return float(10 * np.log10((sig + 1e-15) / err))


def normalized_correlation(a: np.ndarray, b: np.ndarray) -> float:
    ea, eb = np.sqrt(C.energy(a)), np.sqrt(C.energy(b))
    if ea < 1e-12 or eb < 1e-12:
        return 0.0
    r = C.cross_correlate(a, b)
    m = r[np.argmax(np.abs(r))]
    return float(np.clip(m / (ea * eb), -1.0, 1.0))


def normalized_cross_correlation(a: np.ndarray, b: np.ndarray) -> float:
    """
    Pearson normalized cross-correlation:
    R_xy = sum((a - mean_a) * (b - mean_b)) / sqrt(sum(a - mean_a)^2 * sum(b - mean_b)^2)
    """
    x, y = _pair(a, b)
    if not x.size:
        return 0.0
    mx, my = np.mean(x), np.mean(y)
    dx, dy = x - mx, y - my
    denom = np.sqrt(np.sum(dx * dx) * np.sum(dy * dy))
    if denom < 1e-12:
        return 1.0 if np.allclose(x, y, atol=1e-5) else 0.0
    return float(np.clip(np.sum(dx * dy) / denom, -1.0, 1.0))


def normalized_root_mean_square_error(a: np.ndarray, b: np.ndarray) -> float:
    """
    NRMSE = 1 - (RMSE / (max(b) - min(b)))
    """
    x, y = _pair(a, b)
    if not x.size:
        return 0.0
    rmse = np.sqrt(np.mean(np.square(x.astype(np.float64) - y.astype(np.float64))))
    r = float(np.max(y) - np.min(y))
    if r < 1e-6:
        r = float(np.max(x) - np.min(x)) if (np.max(x) - np.min(x)) > 1e-6 else 1.0
    return float(np.clip(1.0 - (rmse / r), 0.0, 1.0))


def compute_signal_similarity(player: np.ndarray, target: np.ndarray) -> float:
    """
    Composite similarity percentage (0..100%).
    Combines shape correlation (50%) and NRMSE (50%).
    """
    r_xy = normalized_cross_correlation(player, target)
    nrmse = normalized_root_mean_square_error(player, target)
    corr_score = max(0.0, r_xy)
    score = 0.5 * corr_score + 0.5 * nrmse
    return round(float(np.clip(score * 100.0, 0.0, 100.0)), 2)


# Dynamic range (dB below the target's strongest bin) the spectra are compared over.
SPECTRAL_RANGE_DB = 40.0


def spectral_similarity(target: np.ndarray, player: np.ndarray) -> float:
    """
    Cosine similarity of the two dB magnitude spectra, each measured relative
    to the TARGET's strongest bin and floored SPECTRAL_RANGE_DB below it, so
    the comparison covers the part of the spectrum that makes the dish.
    (An absolute -80 dB floor let the near-silent bins dominate: every dish,
    ruined or perfect, scored 0.98-1.00.)
    """
    n = C.next_pow2(max(target.size, player.size))
    mt = C.magnitude(target, n).astype(np.float64)
    mp = C.magnitude(player, n).astype(np.float64)
    ref = float(mt.max()) if mt.size else 0.0
    if ref < 1e-12:
        return 0.0
    fl = SPECTRAL_RANGE_DB
    A = np.maximum(-fl, 20 * np.log10(mt / ref + 1e-12)) + fl
    B = np.maximum(-fl, 20 * np.log10(mp / ref + 1e-12)) + fl
    na, nb = float(np.dot(A, A)), float(np.dot(B, B))
    if na < 1e-12 or nb < 1e-12:
        return 0.0
    return float(np.clip(float(np.dot(A, B)) / np.sqrt(na * nb), 0.0, 1.0))


def dish_metrics(target: np.ndarray, player: np.ndarray, common_scale: bool = False) -> dict:
    """
    Composite comparison of two dishes. `score` is 0..100.

    common_scale=True scales BOTH by the same factor (target peak -> 0.9), so a
    level difference (e.g. over-seasoning) counts; the default normalises each
    dish on its own and compares shape only.
    """
    if common_scale:
        s = 0.9 / max(C.peak(target), 1e-12)
        t = C.gain(target, s)
        p = C.gain(player, s)
    else:
        t = C.normalize(target, 0.9)
        p = C.normalize(player, 0.9)

    snr = snr_db(t, p)
    corr = normalized_correlation(t, p)
    spec = spectral_similarity(t, p)
    err = mse(t, p)

    snr_score = float(np.clip((snr + 5) / 30.0, 0, 1))     # -5 dB .. 25 dB
    corr_score = float(np.clip(corr, 0, 1))
    # Perfect dishes measure 0.984-0.996; broken ones 0.5-0.9.
    spec_score = float(np.clip((spec - 0.60) / (0.98 - 0.60), 0, 1))

    score = 100.0 * (0.40 * spec_score + 0.35 * corr_score + 0.25 * snr_score)
    return {
        'score': round(float(np.clip(score, 0, 100)), 2),
        'snr_db': round(snr, 2),
        'correlation': round(corr, 4),
        'spectral_similarity': round(spec, 4),
        'mse': float(err),
    }


def prep_quality(clean: np.ndarray, dirty: np.ndarray, filtered: np.ndarray,
                 contaminants, sr: int = C.SR) -> dict:
    """
    Cleaning score. Deliberately NOT a distance to the clean signal — that
    would reward doing nothing whenever the contamination happens to be quiet.
    Instead it balances two competing quantities, bin by bin.
    """
    n = C.next_pow2(max(clean.size, filtered.size))
    Cm = C.magnitude(clean, n)
    Dm = C.magnitude(dirty, n)
    Fm = C.magnitude(filtered, n)
    hz = C.bin_freqs(n, sr)

    in_noise = np.zeros(hz.size, dtype=bool)
    for c in contaminants:
        lo = c['band_lo'] if isinstance(c, dict) else c.band_lo
        hi = c['band_hi'] if isinstance(c, dict) else c.band_hi
        in_noise |= (hz >= lo) & (hz <= hi)

    noise_before = float(np.sum(np.maximum(0.0, Dm - Cm)[in_noise]))
    noise_after = float(np.sum(np.maximum(0.0, Fm - Cm)[in_noise]))
    total_wanted = float(np.sum(Cm))
    kept_wanted = float(np.sum(np.minimum(Cm, Fm)))

    removal = float(np.clip(1 - noise_after / noise_before, 0, 1)) if noise_before > 1e-9 else 1.0
    preservation = float(np.clip(kept_wanted / total_wanted, 0, 1)) if total_wanted > 1e-9 else 1.0

    return {
        'score': round(100.0 * (0.55 * removal + 0.45 * preservation), 2),
        'removal': round(removal, 4),
        'preservation': round(preservation, 4),
        'over_filtered': preservation < 0.55,
        'still_dirty': removal < 0.5,
    }


def stars(score: float) -> int:
    for threshold, s in ((92, 5), (80, 4), (66, 3), (50, 2), (32, 1)):
        if score >= threshold:
            return s
    return 0
