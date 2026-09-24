"""
Instrument voices — the ingredients.

Voices are synthesised from explicit additive/subtractive models rather than
sampled, so every ingredient has a spectrum the player can reason about.
"""
from __future__ import annotations

import numpy as np

from . import core as C

SR = C.SR


def _adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    A, D, R = int(n * a), int(n * d), int(n * r)
    S = max(0, n - A - D - R)
    env = np.concatenate([
        np.linspace(0, 1, max(1, A), endpoint=False),
        np.linspace(1, s, max(1, D), endpoint=False),
        np.full(S, s),
        np.linspace(s, 0, max(1, R)),
    ])
    return C.resize(env.astype(np.float32), n)


def _additive(n: int, f0: float, partials, inharm: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    decay_axis = np.arange(n) / n
    y = np.zeros(n, dtype=np.float64)
    for mul, amp, dec in partials:
        f = f0 * mul * (1 + inharm * mul * mul * 0.001)
        y += amp * np.exp(-dec * decay_axis) * np.sin(2 * np.pi * f * t)
    return y.astype(np.float32)


def drum(n: int, f0: float = 90.0) -> np.ndarray:
    t = np.arange(n) / SR
    k = np.arange(n) / n
    f = f0 * (1 + 2.2 * np.exp(-np.arange(n) / (n * 0.05)))
    phase = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(phase) * np.exp(-4.5 * k)).astype(np.float32)
    click_n = max(1, int(n * 0.02))
    rng = np.random.default_rng(11)
    click = C.white(click_n, 0.7, rng) * np.linspace(1, 0, click_n, dtype=np.float32)
    y[:click_n] += click
    return C.normalize(y, 0.9)


def piano(n: int, f0: float = 262.0) -> np.ndarray:
    parts = [(1, 1.0, 2.5), (2, 0.5, 3.2), (3, 0.28, 4.0), (4, 0.16, 4.6),
             (5, 0.10, 5.4), (6, 0.06, 6.0), (8, 0.03, 7.0)]
    raw = _additive(n, f0, parts, inharm=1.2)
    return C.normalize(raw * _adsr(n, 0.005, 0.15, 0.45, 0.5), 0.9)


def guitar(n: int, f0: float = 196.0) -> np.ndarray:
    parts = [(1, 1.0, 2.0), (2, 0.35, 2.6), (3, 0.45, 2.4), (4, 0.18, 3.0),
             (5, 0.22, 3.2), (7, 0.12, 4.0), (9, 0.07, 4.5)]
    raw = _additive(n, f0, parts, inharm=0.4)
    pluck_n = max(1, int(n * 0.01))
    raw[:pluck_n] += C.white(pluck_n, 0.35, np.random.default_rng(5))
    return C.normalize(raw * _adsr(n, 0.002, 0.1, 0.6, 0.45), 0.9)


def violin(n: int, f0: float = 440.0) -> np.ndarray:
    t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t)
    y = np.zeros(n, dtype=np.float64)
    for h in range(1, 13):
        y += (1.0 / h) * np.sin(2 * np.pi * f0 * h * vib * t)
    return C.normalize(y.astype(np.float32) * _adsr(n, 0.12, 0.1, 0.85, 0.2), 0.9)


def flute(n: int, f0: float = 587.0) -> np.ndarray:
    raw = _additive(n, f0, [(1, 1.0, 0.6), (2, 0.12, 1.0), (3, 0.05, 1.4)])
    breath = C.filter_signal(C.white(n, 0.10, np.random.default_rng(3)),
                             [C.bandpass(2000, 6000)])
    y = raw + breath
    return C.normalize(y * _adsr(n, 0.15, 0.08, 0.9, 0.25), 0.9)


def bell(n: int, f0: float = 520.0) -> np.ndarray:
    parts = [(1, 1.0, 2.0), (2.76, 0.62, 2.6), (5.40, 0.40, 3.4),
             (8.93, 0.25, 4.2), (13.3, 0.14, 5.0)]
    return C.normalize(_additive(n, f0, parts), 0.9)


def pad(n: int, f0: float = 147.0) -> np.ndarray:
    t = np.arange(n) / SR
    y = np.zeros(n, dtype=np.float64)
    for d in (0.997, 1.0, 1.003):
        for h in range(1, 9):
            y += (0.6 / h) * np.sin(2 * np.pi * f0 * d * h * t)
    return C.normalize(y.astype(np.float32) * _adsr(n, 0.25, 0.1, 0.9, 0.3), 0.9)


def shaker(n: int, f0: float = 0.0) -> np.ndarray:
    raw = C.white(n, 1.0, np.random.default_rng(9))
    band = C.filter_signal(raw, [C.bandpass(4000, 9000)])
    env = np.exp(-9 * np.arange(n) / n).astype(np.float32)
    return C.normalize(band * env, 0.9)


def marimba(n: int, f0: float = 160.0) -> np.ndarray:
    parts = [(1, 1.0, 3.5), (4.0, 0.45, 6.5), (9.8, 0.15, 12.0)]
    raw = _additive(n, f0, parts)
    click_n = max(1, int(n * 0.015))
    raw[:click_n] += C.white(click_n, 0.3, np.random.default_rng(7))
    return C.normalize(raw * _adsr(n, 0.002, 0.2, 0.3, 0.45), 0.9)


def kalimba(n: int, f0: float = 262.0) -> np.ndarray:
    parts = [(1, 1.0, 2.0), (3.0, 0.35, 4.2), (5.4, 0.18, 6.5), (8.2, 0.08, 9.0)]
    raw = _additive(n, f0, parts, inharm=0.8)
    return C.normalize(raw * _adsr(n, 0.003, 0.15, 0.5, 0.4), 0.9)


def triangle(n: int, f0: float = 800.0) -> np.ndarray:
    parts = [(1, 0.8, 1.5), (2.05, 0.65, 1.8), (3.12, 0.5, 2.2), (4.25, 0.38, 2.8),
             (6.1, 0.25, 3.5), (8.4, 0.15, 4.5)]
    raw = _additive(n, f0, parts)
    return C.normalize(raw * _adsr(n, 0.001, 0.1, 0.8, 0.3), 0.9)


def clarinet(n: int, f0: float = 240.0) -> np.ndarray:
    parts = [(1, 1.0, 0.8), (3, 0.75, 1.0), (5, 0.35, 1.3), (7, 0.15, 1.6), (9, 0.08, 2.0)]
    raw = _additive(n, f0, parts)
    breath = C.filter_signal(C.white(n, 0.06, np.random.default_rng(14)),
                             [C.bandpass(1200, 4500)])
    return C.normalize((raw + breath) * _adsr(n, 0.06, 0.05, 0.9, 0.15), 0.9)


def organ(n: int, f0: float = 130.0) -> np.ndarray:
    parts = [(1, 1.0, 0.3), (2, 0.8, 0.3), (3, 0.6, 0.4), (4, 0.5, 0.4),
             (6, 0.35, 0.5), (8, 0.2, 0.6)]
    raw = _additive(n, f0, parts)
    return C.normalize(raw * _adsr(n, 0.08, 0.05, 0.95, 0.1), 0.9)


def bassoon(n: int, f0: float = 180.0) -> np.ndarray:
    parts = [(1, 0.6, 0.8), (2, 1.0, 0.9), (3, 0.85, 1.1), (4, 0.7, 1.3),
             (5, 0.45, 1.5), (6, 0.3, 1.8)]
    raw = _additive(n, f0, parts)
    return C.normalize(raw * _adsr(n, 0.07, 0.06, 0.9, 0.15), 0.9)


def glockenspiel(n: int, f0: float = 700.0) -> np.ndarray:
    parts = [(1, 1.0, 1.8), (2.76, 0.55, 2.5), (5.4, 0.35, 3.5), (8.9, 0.18, 4.5)]
    raw = _additive(n, f0, parts)
    return C.normalize(raw * _adsr(n, 0.001, 0.1, 0.65, 0.35), 0.9)


def harp(n: int, f0: float = 220.0) -> np.ndarray:
    parts = [(1, 1.0, 1.8), (2, 0.55, 2.4), (3, 0.35, 3.0), (4, 0.2, 3.8),
             (5, 0.12, 4.5), (6, 0.06, 5.2)]
    raw = _additive(n, f0, parts, inharm=0.3)
    return C.normalize(raw * _adsr(n, 0.004, 0.15, 0.6, 0.4), 0.9)


def oboe(n: int, f0: float = 587.0) -> np.ndarray:
    parts = [(1, 0.7, 0.8), (2, 1.0, 0.9), (3, 0.9, 1.1), (4, 0.6, 1.3),
             (5, 0.4, 1.5), (6, 0.25, 1.8)]
    raw = _additive(n, f0, parts)
    return C.normalize(raw * _adsr(n, 0.05, 0.05, 0.92, 0.15), 0.9)


def piccolo(n: int, f0: float = 880.0) -> np.ndarray:
    raw = _additive(n, f0, [(1, 1.0, 0.7), (2, 0.2, 1.1), (3, 0.08, 1.5)])
    breath = C.filter_signal(C.white(n, 0.08, np.random.default_rng(21)),
                             [C.bandpass(3000, 8000)])
    return C.normalize((raw + breath) * _adsr(n, 0.08, 0.06, 0.9, 0.2), 0.9)


def _sign(x: np.ndarray) -> np.ndarray:
    """sgn(x) with sgn(0) = +1, matching the frontend's `s >= 0 ? 1 : -1`
    (numpy's own np.sign returns 0 at x == 0, which would silently diverge
    from the frontend at each zero-crossing)."""
    return np.where(x >= 0.0, 1.0, -1.0)


def carrot(n: int = C.FRAME, f0: float = 4.5) -> np.ndarray:
    """Matches frontend evaluateCarrotWave: y = 5 - (1 + cos(0.5x))^4,
    x = 4*pi*f*t with the ingredient's fixed f = 4.5 (not the seeded pitch —
    see the module-level note above tomato/carrot/cucumber history: using the
    real seed f0 here would push this shape's harmonics far above its
    ideal_cutoff)."""
    t = np.arange(n) / (n - 1)
    x = 4.0 * np.pi * 4.5 * t
    raw_y = 5.0 - np.power(1.0 + np.cos(0.5 * x), 4.0)
    y = (raw_y + 3.0) / 8.0
    return y.astype(np.float32)


def cucumber(n: int = C.FRAME, f0: float = 7.0) -> np.ndarray:
    """Matches frontend evaluateCucumberWave: y = 6*tanh(4*cos(x)) / 6,
    x = 2*pi*f*t with the ingredient's fixed f = 7."""
    t = np.arange(n) / (n - 1)
    x = 2.0 * np.pi * 7.0 * t
    y = np.tanh(4.0 * np.cos(x))
    return y.astype(np.float32)


def sauce(n: int = C.FRAME, f0: float = 4.0) -> np.ndarray:
    """Matches frontend evaluateSauceWave (parametric y-component):
    y = (2 + sin(5t)) sin(t) / 3, t = 6*pi*normT."""
    t = (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = (2.0 + np.sin(5.0 * t)) * np.sin(t) / 3.0
    return y.astype(np.float32)


def egg(n: int = C.FRAME, f0: float = 4.0) -> np.ndarray:
    """Matches frontend evaluateEggWave (parametric y-component):
    y = -(2 + 0.2 sin(t)) sin(t) / 2.2, t = 6*pi*normT."""
    t = (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = -(2.0 + 0.2 * np.sin(t)) * np.sin(t) / 2.2
    return y.astype(np.float32)


def cheese(n: int = C.FRAME, f0: float = 6.0) -> np.ndarray:
    """Matches frontend evaluateTriangleWave for Cheese: x(t) = (2/pi)
    asin(sin(2*pi*f*t)) with the ingredient's fixed f = 6 (its
    ingredientDetails.freq, not the seeded pitch)."""
    freq = f0 if (0 < f0 <= 20.0) else 6.0
    t = np.arange(n) / (n - 1)
    s = np.clip(np.sin(2.0 * np.pi * freq * t), -1.0, 1.0)
    y = (2.0 / np.pi) * np.arcsin(s)
    return y.astype(np.float32)


def sugar(n: int = C.FRAME, f0: float = 5.0) -> np.ndarray:
    """Matches frontend evaluateSquareWave for Sugar: x(t) = sgn(sin(2*pi*f*t))
    with the ingredient's fixed f = 5."""
    t = np.arange(n) / (n - 1)
    y = _sign(np.sin(2.0 * np.pi * 5.0 * t))
    return y.astype(np.float32)


def salt(n: int = C.FRAME, f0: float = 12.0) -> np.ndarray:
    """Matches frontend evaluateSquareWave for Salt: x(t) = 0.4*sgn(sin(2*pi*f*t))
    with the ingredient's fixed f = 12."""
    t = np.arange(n) / (n - 1)
    y = 0.4 * _sign(np.sin(2.0 * np.pi * 12.0 * t))
    return y.astype(np.float32)


def bread(n: int = C.FRAME, f0: float = 3.0) -> np.ndarray:
    """Matches frontend evaluateBreadWave: y = 0.8 sin(2*pi*f1*t) +
    0.6 sin(2*pi*f2*t), f1 = 3 (fixed), f2 = 3*f1 = 9."""
    t = np.arange(n) / (n - 1)
    f1 = 3.0
    f2 = f1 * 3.0
    y = 0.8 * np.sin(2.0 * np.pi * f1 * t) + 0.6 * np.sin(2.0 * np.pi * f2 * t)
    peak = float(np.max(np.abs(y)))
    if peak > 1.0:
        y = y / peak
    return y.astype(np.float32)


def patty(n: int = C.FRAME, f0: float = 2.0) -> np.ndarray:
    """Matches frontend evaluatePattyWave (parametric y-component):
    y = 0.7 sin(t) / 0.7 = sin(t), t = 2*pi + normT*6*pi."""
    t = 2.0 * np.pi + (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = np.sin(t)
    return y.astype(np.float32)


def lettuce(n: int = C.FRAME, f0: float = 3.0) -> np.ndarray:
    """Matches frontend evaluateLettuceWave (parametric y-component):
    y = (2.2 cos(t) + 0.45 cos(7.5t)) / 2.65, t = -8*pi + normT*16*pi."""
    t = -8.0 * np.pi + (np.arange(n) / (n - 1)) * 16.0 * np.pi
    y = (2.2 * np.cos(t) + 0.45 * np.cos(7.5 * t)) / 2.65
    return y.astype(np.float32)


def tomato(n: int = C.FRAME, f0: float = 5.0) -> np.ndarray:
    """Matches frontend evaluateTomatoWave (parametric y-component):
    y = -(1.5 + 0.2 sin(t)) sin(t) / 1.7, t = 6*pi*normT."""
    t = (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = -(1.5 + 0.2 * np.sin(t)) * np.sin(t) / 1.7
    return y.astype(np.float32)


def onion(n: int = C.FRAME, f0: float = 6.0) -> np.ndarray:
    """Matches frontend evaluateOnionWave (parametric y-component, an
    Archimedean spiral): r(t) = 0.1 + 0.08t, y = r*sin(3t) / maxRadius,
    t = 6*pi*normT, maxRadius = r(6*pi)."""
    t = (np.arange(n) / (n - 1)) * 6.0 * np.pi
    r = 0.1 + 0.08 * t
    max_radius = 0.1 + 0.08 * (6.0 * np.pi)
    y = (r * np.sin(3.0 * t)) / max_radius
    return y.astype(np.float32)



CHICKEN_PCM = np.array([
    0.00018,-0.00031,-0.00034,-0.00024,0.00037,0.00049,0.00034,-0.00027,-0.00021,-0.00037,
    -0.00034,-0.00046,-0.00034,0.00037,0.00046,0.00037,-0.00046,-0.00031,0.00034,-0.00024,
    0.00027,-0.00031,0.00034,-0.00037,-0.0004,0.00046,-0.00034,-0.00027,0.00027,0.00034,
    0.00037,-0.00037,0.00052,0.00043,0.00043,0.00049,-0.00037,-0.00031,0.00031,0.00034,
    -0.00018,0.00031,-0.00027,0.00037,-0.00027,0.00027,0.00037,0.00021,0.00024,-0.0004,
    -0.00043,0.00027,-0.00024,0.00037,0.00034,-0.00031,0.00021,-0.00027,-0.00027,-0.00031,
    -0.00031,0.00034,-0.00031,-0.00024,-0.0004,-0.00037,0.00027,0.00027,0.0004,-0.00034,
    0.00027,-0.00043,0.0004,0.0004,-0.00049,-0.00052,0.00049,0.00061,-0.00089,-0.00073,
    -0.00061,-0.00092,-0.00085,-0.00107,0.00125,0.00134,-0.00137,0.00153,-0.00156,0.04251,
    0.06708,0.16165,0.11957,0.19788,0.21777,0.17734,-0.17822,0.20718,-0.19434,-0.20932,
    -0.23172,-0.24316,0.23605,0.2966,-0.2652,0.25949,0.27234,-0.28745,0.2804,-0.30624,
    0.33136,-0.34476,0.40582,-0.23126,0.21536,0.22534,0.36804,0.27975,0.31726,-0.25107,
    0.24353,-0.27588,0.2074,-0.30679,0.19476,0.35947,-0.34888,-0.34451,0.34006,0.34125,
    -0.34018,-0.40546,0.4433,0.27991,-0.45251,0.40952,-0.25525,-0.44183,0.38687,-0.38678,
    0.38763,0.33038,-0.42682,0.3367,0.36404,-0.405,-0.32755,-0.35535,0.38324,0.29678,
    -0.25311,0.33072,0.30807,0.28015,-0.30652,0.29013,-0.1568,0.15643,-0.24011,-0.20325,
    -0.18158,-0.22131,-0.2124,0.14291,0.12589,0.12259,0.07959,-0.10941,-0.09515,-0.07513,
    -0.04916,0.07913,0.05499,-0.07947,0.03912,-0.04123,-0.03815,-0.03156,-0.03708,-0.02304,
    0.02658,-0.03186,-0.04138,-0.02753,0.01898,0.01376,0.01794,0.01614,0.01447,0.01328,
    -0.01114,0.01865,-0.00876,0.01196,0.01254,-0.00983,0.01334,-0.01309,-0.009,-0.00925,
    0.01199,0.00894,-0.00555,0.00681,0.00522,-0.00513,-0.00586,-0.00836,0.00684,-0.00592,
    0.02026,0.03284,-0.13113,-0.14063,-0.26425,-0.19138,-0.20764,-0.2164,0.31262,0.32648,
    -0.1987,-0.31155,-0.32803,-0.2991,-0.33612,-0.36841,0.3092,-0.39273,-0.4288,-0.39362,
    0.38626,0.39215,-0.40796,-0.31583,-0.33945,-0.37766,0.43475,-0.47037,0.43878,0.42761,
    0.4227,0.4379,0.43542,0.46362,0.53055,-0.54529,-0.49298,-0.56674,-0.56735,-0.54895,
    -0.45996,-0.42044,0.3764,0.31656,0.49374,-0.5542,0.4155,0.37988,0.4325,-0.35678,
    -0.21597,-0.2319,0.19604,-0.26343,0.22018,-0.16599,-0.13602,-0.10641,0.08322,-0.12531,
    0.10291,-0.1131,-0.07602,0.08527,-0.07581,-0.0676,-0.04758,0.04565,0.06448,0.07205,
    -0.08429,0.07687,0.08203,-0.06418,-0.09564,-0.16928,0.19235,-0.16202,-0.21304,-0.18918,
    -0.20792,-0.16403,-0.26343,-0.28235,-0.23401,-0.38821,-0.21783,-0.35236,-0.23575,-0.28638,
    -0.58127,-0.46191,-0.2814,0.41714,-0.54727,-0.3602,0.40372,-0.4722,0.33414,0.34134,
    -0.32001,0.32608,-0.29031,-0.32846,-0.29321,-0.33936,-0.33267,-0.31342,-0.2442,-0.20822,
    -0.2019,0.27536,-0.47372,-0.31357,-0.33981,-0.47379,-0.45291,-0.47357,-0.44043,-0.26126,
    0.24008,0.31772,-0.35251,-0.29883,-0.30194,-0.39987,0.35052,-0.34698,-0.2453,0.24756,
    0.24744,0.31451,-0.40286,-0.34647,-0.30276,-0.26309,0.26071,0.30673,-0.39383,-0.34875,
    -0.32175,0.32208,-0.34433,-0.4032,0.30145,-0.25809,-0.35092,-0.35352,-0.38293,-0.3624,
    -0.31137,-0.27844,-0.35992,-0.32727,-0.35733,0.37479,-0.34622,-0.39716,-0.40622,-0.44006,
    -0.41266,0.44934,0.3519,-0.26501,-0.31244,-0.31415,-0.37476,-0.33463,-0.29272,-0.32669,
    -0.40189,0.46494,0.37854,-0.69312,0.54208,-0.61435,0.28909,0.30453,0.26025,0.34183,
    0.34344,-0.33017,-0.3623,0.42471,-0.4816,-0.3371,-0.37595,0.3992,-0.43826,-0.37857,
    -0.4397,-0.33734,-0.3118,-0.3118,-0.28036,-0.30756,-0.41583,-0.33575,-0.37082,-0.34909,
    -0.32809,-0.46115,-0.42868,-0.41232,-0.38956,-0.38147,-0.32645,-0.36142,-0.38086,-0.32925,
    -0.34784,0.35101,0.31436,-0.35129,-0.26447,-0.41415,-0.40298,-0.41336,0.31009,-0.35373,
    -0.2897,0.28268,-0.3024,-0.39905,-0.41653,-0.40402,0.32669,-0.35034,-0.42007,-0.41092,
    -0.34436,-0.32352,-0.25473,-0.24026,-0.28156,0.29648,0.30328,-0.44937,0.34879,-0.32312,
    -0.27484,0.39264,-0.42444,0.315,0.33554,-0.31415,0.263,-0.20572,-0.45123,-0.45679,
    0.34067,-0.36893,0.34,-0.41919,-0.41257,-0.3414,-0.32642,0.26352,-0.30289,-0.33328,
    0.29623,0.29022,0.32697,0.21832,-0.34979,-0.48935,-0.2572,-0.3956,-0.33585,-0.3187,
    0.30228,-0.31027,-0.35165,0.34363,-0.39774,0.35034,0.25815,0.34384,-0.32495,-0.21719,
    -0.20895,-0.28775,-0.28931,-0.25104,-0.27954,-0.25391,-0.32678,-0.32358,0.29697,-0.33679,
    -0.38666,-0.46725,0.27896,0.41144,-0.31699,0.28162,-0.45731,-0.36835,0.26596,-0.2522,
    -0.30258,0.30627,0.29071,-0.44592,-0.27554,-0.33414,-0.285,-0.41644,-0.33533,-0.33334,
    -0.29041,0.30716,-0.37726,-0.28528,-0.34586,-0.33685,-0.38104,-0.31812,0.31766,-0.29465,
    -0.28616,-0.35138,-0.3457,-0.36783,-0.33032,-0.33994,-0.32092,-0.33389,-0.38824,-0.38614,
    -0.4137,-0.3812,-0.38257,-0.40625,-0.42593,-0.4288,-0.4133,-0.39581,-0.33435,-0.35342,
    -0.35809,-0.4292,-0.45065,-0.46091,-0.46927,-0.52859,-0.47397,-0.43192,-0.45358,-0.49176,
    -0.55258,-0.68399,-0.70398,-0.79623,-0.78091,-0.69547,-0.57721,-0.63632,-0.66422,-0.67725,
    -0.67599,-0.69589,-0.69577,-0.69077,-0.60947,-0.62311,-0.63312,-0.64328,-0.63522,-0.65576,
    -0.65833,-0.61813,-0.64987,-0.64151,-0.6597,-0.69351,-0.62259,-0.73523,-0.63474,-0.52313,
    -0.54181,-0.56326,-0.47446,0.52411,0.59921,-0.67346,-0.59708,-0.67242,0.62659,-0.74313,
    -0.6441,0.80151,0.58713,0.67078,-0.5972,0.6554,-0.52084,-0.67798,-0.6264,0.6507,-0.5408,
    -0.62964,-0.67267,0.58551,-0.61761,-0.74075,-0.77039,-0.70093,-0.72995,-0.75027,0.74652,
    0.76517,0.76187,0.75146,0.79932,0.78265,0.7785,0.72757,0.69284,0.64236,0.67838,0.6647,
    0.64938,0.61282,0.52042,0.52469,-0.50723,0.50903,-0.48068,-0.53305,-0.54276,-0.49051,
    -0.53363,-0.5354,-0.50089,-0.54272,-0.54224,-0.49393,-0.4653,-0.49976,-0.487,0.46893,
    0.45691,-0.47852,-0.46509,-0.43933,-0.46152,-0.46051,-0.43234,-0.41809,0.42053,0.39337,
    0.40869,0.41208,0.40503,-0.40189,0.40067,0.39212,0.38382,0.37585,-0.3671,-0.37531,-0.38065,
    0.37927,0.37277,0.36011,0.3822,0.39142,0.36389,0.3721,0.39038,0.38626,0.37686,0.39011,
    0.40707,0.39404,0.42749,0.41705,0.42691,0.44962,0.414,0.43869,0.43243,0.40463,0.4303,
    0.42477,0.41605,0.42975,0.44238,0.46875,0.44522,0.50076,0.51187,0.56091,0.43494,0.55884,
    0.57639,0.56549,0.57175,0.52841,0.54889,0.46542,0.48764,0.45197,0.4762,0.49316,0.44336,
    0.45853,-0.47098,0.43878,-0.41992,-0.45081,-0.45218,-0.41608,0.47559,0.47681,0.44348,
    0.52393,0.54117,0.58755,0.60233,0.60138,0.60431,0.51797,0.53961,0.51871,0.58725,0.58401,
    -0.57605,-0.62628,-0.6752,-0.78052,-0.67276,-0.59128,-0.58282,-0.50543,0.35776,-0.35788,
    0.21832,-0.2814,0.31693,0.45782,0.33109,-0.36496,0.30209,-0.39273,-0.44882,-0.26282,
    -0.3923,-0.29343,-0.32922,-0.30676,0.35553,-0.24725,0.27283,-0.24246,-0.29938,0.27701,
    -0.24033,-0.18903,-0.21246,0.28085,0.24564,0.23694,0.25616,-0.30157,0.26117,0.2048,
    -0.16214,-0.16946,-0.21542,0.1149,0.08951,0.0578,0.10605,0.10019,-0.06842,0.06519,
    -0.0842,0.07654,-0.05994,-0.0564,-0.04474,-0.03262,-0.03027,0.04144,-0.03952,0.02875,
    0.0242,-0.02127,0.01999,-0.02301,-0.02298,-0.02026,-0.0155,0.02197,-0.02811,-0.01697,
    0.01987,-0.02097,-0.02145,0.01672,-0.0097,-0.00983,0.01193,-0.01031,0.00842,-0.01151,
    0.01401,0.01443,-0.00974,0.00848,-0.01019,0.01083,-0.00964,-0.0062,0.00235,-0.00375,
    0.00385,-0.00583,-0.00589,0.00629,0.00861,-0.00659,0.00604,0.00586,-0.00589,-0.00369,
    -0.00369,-0.00406,0.00262,0.00339,-0.00305,0.00137,-0.00162,0.00201,0.0011,-0.00107,
    -0.00137,0.00189,-0.00113,-0.00131,0.00146,0.00146,-0.00119,0.00079,0.00061,-0.00085,
    0.0007,-0.00085,0.00085,-0.00067,0.00058,-0.00055,-0.00046,0.00067,0.00089,0.00098,
    -0.0007,-0.00076,-0.00073,0.00031,0.00034,-0.00037,-0.00061,0.00076,0.00064,-0.00055,
    0.00043,0.0004,-0.00034,-0.00024,0.00055,0.0007,0.0004,-0.00052,0.00055,-0.00043,
    -0.00037,-0.00027,-0.0004,0.00043,0.00043,-0.0004,-0.00034,0.00037,-0.00034,0.00031,
    -0.0004,0.00034,0.00058,0.00037,-0.0004,0.00052,0.00037,-0.00037,-0.0004,-0.00043,
    -0.00034,0.0004,0.00043,-0.0004,-0.00046,0.00046,0.00046,0.00046,-0.00043,-0.00031,
    -0.00037,-0.00031,-0.00034,-0.00024,-0.00034,-0.00037,-0.00034,0.00043,0.00024,-0.00034,
    0.00034,0.00034,-0.00027,-0.00034,0.00031,0.00027,0.00024,0.00024,0.00021,0.00018,
    0.00021,-0.00027,-0.0004,0.00031,0.0004,0.00018,-0.00031,0.00034,0.00046,-0.00027,
    -0.00031,-0.00024,-0.00034,0.00027,-0.00037,-0.00034,-0.00024,0.00031,0.00031,0.00034,
    -0.00024,-0.00021,-0.00027,-0.00034,0.00034,0.00034,-0.00027,-0.00024,-0.00031,0.00034,
    0.00024,-0.00043,-0.0007,-0.00079,-0.00095,-0.00082,0.00092,-0.00095,-0.00076,-0.0007,
    0.00052,-0.00082,0.00046,-0.00049,-0.00046,0.00058,-0.00037,-0.00037,0.00037,0.0004,
    -0.00034,0.00031,0.00027,0.00031,0.00031,-0.0004,0.00037,0.00034,0.00037,0.00027,
    -0.00034,0.65784
], dtype=np.float32)


def chicken(n: int = C.FRAME, f0: float = 0.0) -> np.ndarray:
    """Decoded PCM audio / synthesized chicken voice."""
    return C.normalize(C.resize(CHICKEN_PCM, n), 0.9)


def milk(n: int = C.FRAME, f0: float = 440.0) -> np.ndarray:
    """Matches frontend evaluateMilkWave: y = (1.4 sin(0.7x) + 0.6 sin(1.3x)
    + 0.3 sin(2.1x + 0.8)) / 2.3, x = 2*pi*f*t with the ingredient's fixed
    f = 5 (its ingredientDetails.freq)."""
    t = np.arange(n) / (n - 1)
    x = 2.0 * np.pi * 5.0 * t
    raw_y = 1.4 * np.sin(0.7 * x) + 0.6 * np.sin(1.3 * x) + 0.3 * np.sin(2.1 * x + 0.8)
    y = raw_y / 2.3
    return y.astype(np.float32)


def flour(n: int = C.FRAME, f0: float = 300.0) -> np.ndarray:
    """Matches frontend evaluateFlourWave: y = sgn(sin(2*pi*f*t)) -
    sgn(sin(2*pi*2f*t)) * cos(2*pi*f*t), with the ingredient's fixed f = 2."""
    t = np.arange(n) / (n - 1)
    f = 2.0
    sq1 = _sign(np.sin(2.0 * np.pi * f * t))
    sq2 = _sign(np.sin(2.0 * np.pi * (2.0 * f) * t))
    cos_term = np.cos(2.0 * np.pi * f * t)
    y = sq1 - sq2 * cos_term
    return y.astype(np.float32)


def butter(n: int = C.FRAME, f0: float = 220.0) -> np.ndarray:
    """Matches frontend evaluateButterWave: trapezoid blocks
    y = max(0, 1.2 - 1.2*max(|mod(x+9,14)-9|-4, 0)) - 0.6, x in [-21, 21]."""
    t = np.arange(n) / (n - 1)
    x = -21.0 + t * 42.0
    mod_val = np.mod(x + 9.0, 14.0)
    inner_max = np.maximum(np.abs(mod_val - 9.0) - 4.0, 0.0)
    raw_y = np.maximum(0.0, 1.2 - 1.2 * inner_max)
    y = raw_y - 0.6
    return y.astype(np.float32)


def noodles(n: int = C.FRAME, f0: float = 330.0) -> np.ndarray:
    """Matches frontend evaluateNoodleWave (parametric y-component):
    y = cos(theta), theta = -12*pi + normT*24*pi."""
    t = -12.0 * np.pi + (np.arange(n) / (n - 1)) * 24.0 * np.pi
    y = np.cos(t)
    return y.astype(np.float32)


def bun(n: int = C.FRAME, f0: float = 0.0) -> np.ndarray:
    """Matches frontend evaluateBunWave: dome profile
    y = (5*(max(0, 0.5+0.5cos(0.3x)))^0.25 + 0.03cos(9x) - 2.5) / 2.5,
    x = -10*pi/3 + (20*pi/3)*f*t with the ingredient's fixed f = 3."""
    t = np.arange(n) / (n - 1)
    f = 3.0
    x = -(10.0 * np.pi) / 3.0 + ((20.0 * np.pi) / 3.0) * f * t
    base = np.maximum(0.0, 0.5 + 0.5 * np.cos(0.3 * x))
    raw_y = 5.0 * np.power(base, 0.25) + 0.03 * np.cos(9.0 * x)
    y = (raw_y - 2.5) / 2.5
    peak = float(np.max(np.abs(y)))
    if peak > 1.0:
        y = y / peak
    return y.astype(np.float32)


VOICES = {
    'drum': drum,
    'bass_drum': drum,
    'bass drum': drum,
    'piano': piano,
    'guitar': guitar,
    'violin': violin,
    'flute': flute,
    'bell': bell,
    'pad': pad,
    'shaker': shaker,
    'marimba': marimba,
    'kalimba': kalimba,
    'triangle': triangle,
    'clarinet': clarinet,
    'organ': organ,
    'bassoon': bassoon,
    'glockenspiel': glockenspiel,
    'harp': harp,
    'oboe': oboe,
    'piccolo': piccolo,
    'carrot': carrot,
    'cucumber': cucumber,
    'sauce': sauce,
    'egg': egg,
    'cheese': cheese,
    'sugar': sugar,
    'salt': salt,
    'bread': bread,
    'bun': bun,
    'patty': patty,
    'beef patty': patty,
    'beef_patty': patty,
    'lettuce': lettuce,
    'tomato': tomato,
    'onion': onion,
    'chicken': chicken,
    'chicken-fry': chicken,
    'chicken_fry': chicken,
    'milk': milk,
    'flour': flour,
    'butter': butter,
    'noodles': noodles,
}


def synth(voice: str, n: int = C.FRAME, f0: float = 0.0) -> np.ndarray:
    norm_voice = voice.lower().strip()
    fn = VOICES.get(norm_voice)
    if fn is None:
        raise KeyError(f'unknown instrument voice: {voice}')
    return fn(n, f0) if f0 else fn(n)
