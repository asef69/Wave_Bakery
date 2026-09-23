"""
WaveKitchen — server-side signal processing core.

All signals are 1-D float32 numpy arrays sampled at SR. This module is the
authoritative implementation: the browser runs a lightweight mirror of it for
interactive preview, but every score is computed from these functions.
"""
from __future__ import annotations

import base64
from typing import Callable, Iterable, Sequence

import numpy as np
from scipy import signal as sps

SR: int = 22050          # sample rate for every signal in the game
FRAME: int = 4096        # canonical ingredient length (~186 ms), a power of two

GainFn = Callable[[np.ndarray], np.ndarray]   # hz array -> linear gain array


# --------------------------------------------------------------------------
# basic helpers
# --------------------------------------------------------------------------
def as_signal(x: Iterable[float]) -> np.ndarray:
    return np.asarray(x, dtype=np.float32).ravel()


def next_pow2(n: int) -> int:
    return 1 << int(np.ceil(np.log2(max(1, n))))


def resize(x: np.ndarray, n: int) -> np.ndarray:
    """Zero-pad or truncate to exactly n samples."""
    y = np.zeros(n, dtype=np.float32)
    m = min(n, x.size)
    y[:m] = x[:m]
    return y


def add(signals: Sequence[np.ndarray]) -> np.ndarray:
    """Sample-wise superposition of signals of possibly different lengths."""
    if not len(signals):
        return np.zeros(FRAME, dtype=np.float32)
    n = max(s.size for s in signals)
    out = np.zeros(n, dtype=np.float32)
    for s in signals:
        out[: s.size] += s
    return out


mix = add


def gain(x: np.ndarray, g: float) -> np.ndarray:
    return (x * np.float32(g)).astype(np.float32)


def peak(x: np.ndarray) -> float:
    return float(np.max(np.abs(x))) if x.size else 0.0


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(x)))) if x.size else 0.0


def energy(x: np.ndarray) -> float:
    return float(np.sum(np.square(x, dtype=np.float64)))


def normalize(x: np.ndarray, target: float = 0.9) -> np.ndarray:
    p = peak(x)
    if p < 1e-12:
        return x.astype(np.float32, copy=True)
    return gain(x, target / p)


def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else (hi if v > hi else v)


# --------------------------------------------------------------------------
# transport — signals travel to the browser as base64 float32
# --------------------------------------------------------------------------
def encode(x: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(x, dtype='<f4').tobytes()).decode('ascii')


def decode(b64: str) -> np.ndarray:
    return np.frombuffer(base64.b64decode(b64), dtype='<f4').astype(np.float32)


def downsample_for_plot(x: np.ndarray, points: int = 1024) -> list[float]:
    """Peak-preserving reduction so plots stay honest at low resolution."""
    if x.size <= points:
        return [round(float(v), 5) for v in x]
    step = int(np.ceil(x.size / points))
    trimmed = x[: (x.size // step) * step].reshape(-1, step)
    hi = trimmed.max(axis=1)
    lo = trimmed.min(axis=1)
    # interleave so the envelope is preserved
    out = np.empty(hi.size * 2, dtype=np.float32)
    out[0::2] = hi
    out[1::2] = lo
    return [round(float(v), 5) for v in out]


# --------------------------------------------------------------------------
# transforms
# --------------------------------------------------------------------------
def fft(x: np.ndarray, n: int | None = None) -> np.ndarray:
    """Real FFT. Returns the complex half-spectrum (n//2 + 1 bins)."""
    n = n or next_pow2(x.size)
    return np.fft.rfft(resize(x, n), n=n)


def ifft(spec: np.ndarray, n: int) -> np.ndarray:
    return np.fft.irfft(spec, n=n).astype(np.float32)


def cooley_tukey_fft(x: np.ndarray) -> np.ndarray:
    """
    Pure Python/NumPy radix-2 Cooley-Tukey FFT implementation for N = 2^m arrays.
    """
    a = np.asarray(x, dtype=np.complex128)
    n = a.shape[0]
    if n <= 1:
        return a
    if n & (n - 1) != 0:
        p2 = next_pow2(n)
        pad = np.zeros(p2, dtype=np.complex128)
        pad[:n] = a
        a = pad
        n = p2

    even = cooley_tukey_fft(a[0::2])
    odd = cooley_tukey_fft(a[1::2])
    terms = np.exp(-2j * np.pi * np.arange(n // 2) / n)
    return np.concatenate([even + terms * odd, even - terms * odd])


def cooley_tukey_ifft(X: np.ndarray) -> np.ndarray:
    """
    Inverse Cooley-Tukey FFT via complex conjugation.
    """
    X_conj = np.conj(X)
    x = cooley_tukey_fft(X_conj)
    return (np.conj(x) / X.size).real.astype(np.float32)


def apply_lowpass_filter(x: np.ndarray, cutoff_hz: float, sr: int = SR) -> np.ndarray:
    """
    Frequency-domain low-pass filter with 2-bin transition band.
    """
    n = next_pow2(x.size)
    spec = fft(x, n)
    freqs = bin_freqs(n, sr)
    bin_width = sr / n
    trans_width = 2.0 * bin_width

    mask = np.ones_like(freqs, dtype=np.float32)
    cutoff = float(cutoff_hz)

    in_trans = (freqs > cutoff) & (freqs <= cutoff + trans_width)
    mask[in_trans] = 1.0 - (freqs[in_trans] - cutoff) / trans_width
    mask[freqs > cutoff + trans_width] = 0.0

    filtered_spec = spec * mask
    out = ifft(filtered_spec, n)
    return out[: x.size].astype(np.float32)


def magnitude(x: np.ndarray, n: int | None = None) -> np.ndarray:
    return np.abs(fft(x, n)).astype(np.float32)


def magnitude_db(mag: np.ndarray, floor_db: float = -90.0) -> np.ndarray:
    return np.maximum(floor_db, 20 * np.log10(mag + 1e-12)).astype(np.float32)


def bin_freqs(n: int, sr: int = SR) -> np.ndarray:
    return np.fft.rfftfreq(n, d=1.0 / sr)


def spectral_centroid(x: np.ndarray, sr: int = SR) -> float:
    n = next_pow2(x.size)
    mag = magnitude(x, n)
    hz = bin_freqs(n, sr)
    denom = float(mag.sum())
    return float((hz * mag).sum() / denom) if denom > 1e-12 else 0.0


def stft_magnitude(x: np.ndarray, win: int = 256, hop: int = 64,
                   sr: int = SR) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Short-time Fourier transform magnitude. Returns (freqs, times, |S|)."""
    if x.size < win:
        x = resize(x, win)
    f, t, Z = sps.stft(x, fs=sr, nperseg=win, noverlap=win - hop,
                       window='hann', padded=False, boundary=None) # type: ignore
    return f, t, np.abs(Z).astype(np.float32)


# --------------------------------------------------------------------------
# noise models
# --------------------------------------------------------------------------
def white(n: int, amp: float, rng: np.random.Generator) -> np.ndarray:
    return (rng.uniform(-1, 1, n) * amp).astype(np.float32)


def pink(n: int, amp: float, rng: np.random.Generator) -> np.ndarray:
    """1/f noise by spectral shaping."""
    spec = np.fft.rfft(rng.normal(0, 1, n))
    k = np.arange(spec.size)
    shape = np.ones_like(k, dtype=float)
    shape[1:] = 1.0 / np.sqrt(k[1:])
    y = np.fft.irfft(spec * shape, n=n)
    return gain(normalize(y.astype(np.float32), 1.0), amp)


def hum(n: int, amp: float, f0: float, sr: int = SR) -> np.ndarray:
    t = np.arange(n) / sr
    y = (np.sin(2 * np.pi * f0 * t)
         + 0.45 * np.sin(2 * np.pi * 3 * f0 * t)
         + 0.22 * np.sin(2 * np.pi * 5 * f0 * t))
    return (y * amp).astype(np.float32)


def hiss(n: int, amp: float, fc: float, rng: np.random.Generator,
         sr: int = SR) -> np.ndarray:
    raw = white(n, 1.0, rng)
    lo = max(20.0, fc * 0.65)
    hi = min(sr / 2 * 0.98, fc * 1.35)
    y = filter_signal(raw, [bandpass(lo, hi)], sr)
    return gain(normalize(y, 1.0), amp)


def burst(n: int, amp: float, density: float, rng: np.random.Generator) -> np.ndarray:
    y = np.zeros(n, dtype=np.float32)
    hits = rng.random(n) < density
    idx = np.flatnonzero(hits)
    for i in idx:
        length = int(8 + rng.random() * 40)
        s = float(rng.uniform(-1, 1) * amp * 2.5)
        k = np.arange(min(length, n - i))
        y[i: i + k.size] += (s * np.exp(-4 * k / length)).astype(np.float32)
    return y


def tone(n: int, amp: float, f: float, sr: int = SR) -> np.ndarray:
    t = np.arange(n) / sr
    return (amp * np.sin(2 * np.pi * f * t)).astype(np.float32)


# --------------------------------------------------------------------------
# frequency-domain filter design
#   A filter is a pure function hz -> linear gain, so filters compose and can
#   be sampled directly for plotting without ever running a transform.
# --------------------------------------------------------------------------
def _rolloff(t: np.ndarray) -> np.ndarray:
    t = np.clip(t, 0.0, 1.0)
    return 0.5 - 0.5 * np.cos(np.pi * t)


def lowpass(cut: float, width: float | None = None) -> GainFn:
    w = width if width else max(30.0, cut * 0.15)

    def g(hz: np.ndarray) -> np.ndarray:
        out = np.ones_like(hz)
        band = (hz > cut) & (hz < cut + w)
        out[band] = 1.0 - _rolloff((hz[band] - cut) / w)
        out[hz >= cut + w] = 0.0
        return out
    return g


def highpass(cut: float, width: float | None = None) -> GainFn:
    w = width if width else max(30.0, cut * 0.15)

    def g(hz: np.ndarray) -> np.ndarray:
        out = np.ones_like(hz)
        band = (hz < cut) & (hz > cut - w)
        out[band] = _rolloff((hz[band] - (cut - w)) / w)
        out[hz <= cut - w] = 0.0
        return out
    return g


def bandpass(lo: float, hi: float, width: float | None = None) -> GainFn:
    lp, hp = lowpass(hi, width), highpass(lo, width)
    return lambda hz: lp(hz) * hp(hz)


def notch(center: float, bw: float, depth: float = 0.0) -> GainFn:
    lo, hi = center - bw / 2, center + bw / 2

    def g(hz: np.ndarray) -> np.ndarray:
        out = np.ones_like(hz)
        inside = (hz > lo) & (hz < hi)
        t = (hz[inside] - lo) / max(1e-9, hi - lo)
        dip = 0.5 - 0.5 * np.cos(2 * np.pi * t)
        out[inside] = 1.0 + (depth - 1.0) * dip
        return out
    return g


def harmonic_notch(f0: float, bw: float = 14.0, harmonics: int = 8,
                   depth: float = 0.03) -> GainFn:
    parts = [notch(f0 * k, bw, depth) for k in range(1, harmonics + 1)]

    def g(hz: np.ndarray) -> np.ndarray:
        out = np.ones_like(hz)
        for p in parts:
            out = out * p(hz)
        return out
    return g


def equalizer(bands: Sequence[dict]) -> GainFn:
    """bands = [{f_lo, f_hi, gain_db}] interpolated in log frequency."""
    if not bands:
        return lambda hz: np.ones_like(hz)
    centres = np.array([np.sqrt(max(1.0, b['f_lo']) * b['f_hi']) for b in bands])
    gains = np.array([10 ** (b['gain_db'] / 20.0) for b in bands])
    order = np.argsort(centres)
    centres, gains = centres[order], gains[order]

    def g(hz: np.ndarray) -> np.ndarray:
        h = np.maximum(1.0, hz)
        return np.interp(np.log(h), np.log(centres), gains,
                         left=gains[0], right=gains[-1])
    return g


def chain(fns: Sequence[GainFn]) -> GainFn:
    def g(hz: np.ndarray) -> np.ndarray:
        out = np.ones_like(hz)
        for f in fns:
            out = out * f(hz)
        return out
    return g


def build_mask(n: int, gain_fn: GainFn, sr: int = SR) -> np.ndarray:
    """Sample a gain function onto the rfft bin grid."""
    return np.clip(gain_fn(bin_freqs(n, sr)), 0.0, 4.0)


def apply_mask(x: np.ndarray, mask: np.ndarray, n: int) -> np.ndarray:
    spec = fft(x, n) * mask
    return ifft(spec, n)[: x.size].astype(np.float32)


def filter_signal(x: np.ndarray, gain_fns: Sequence[GainFn], sr: int = SR) -> np.ndarray:
    n = next_pow2(x.size)
    return apply_mask(x, build_mask(n, chain(gain_fns), sr), n)


# --------------------------------------------------------------------------
# time-domain operators
# --------------------------------------------------------------------------
def time_scale(x: np.ndarray, alpha: float) -> np.ndarray:
    """y(t) = x(alpha * t). alpha > 1 compresses, alpha < 1 expands."""
    alpha = max(0.05, float(alpha))
    if abs(alpha - 1.0) < 1e-4:
        return x.astype(np.float32, copy=True)
    n = max(2, int(round(x.size / alpha)))
    src = np.arange(n) * alpha
    return np.interp(src, np.arange(x.size), x, left=0.0, right=0.0).astype(np.float32)


def time_reverse(x: np.ndarray) -> np.ndarray:
    return x[::-1].astype(np.float32, copy=True)


def time_shift(x: np.ndarray, samples: float) -> np.ndarray:
    """y(t) = x(t - t0). Fractional shifts become a linear phase ramp."""
    whole = round(samples)
    if abs(samples - whole) < 1e-6:
        y = np.zeros_like(x)
        k = int(whole)
        if k >= 0:
            if k < x.size:
                y[k:] = x[: x.size - k]
        else:
            if -k < x.size:
                y[: x.size + k] = x[-k:]
        return y
    n = next_pow2(x.size)
    spec = fft(x, n)
    k = np.arange(spec.size)
    spec = spec * np.exp(-2j * np.pi * k * samples / n)
    return ifft(spec, n)[: x.size].astype(np.float32)


def envelope(x: np.ndarray, attack: int, release: int) -> np.ndarray:
    y = x.astype(np.float32, copy=True)
    a, r = max(1, attack), max(1, release)
    y[:a] *= np.linspace(0, 1, a, dtype=np.float32)
    y[-r:] *= np.linspace(1, 0, r, dtype=np.float32)
    return y


# --------------------------------------------------------------------------
# convolution and LTI systems
# --------------------------------------------------------------------------
def convolve_direct(x: np.ndarray, h: np.ndarray) -> np.ndarray:
    return np.convolve(x, h, mode='full').astype(np.float32)


def convolve_fft(x: np.ndarray, h: np.ndarray) -> np.ndarray:
    return sps.fftconvolve(x, h, mode='full').astype(np.float32)


def convolve(x: np.ndarray, h: np.ndarray) -> np.ndarray:
    """Dispatch on cost: short kernels stay in the time domain."""
    if x.size * h.size < 20000:
        return convolve_direct(x, h)
    return convolve_fft(x, h)


def convolve_partial(x: np.ndarray, h: np.ndarray, upto: int) -> np.ndarray:
    """
    Output computed only up to lag `upto`. This is what the interactive
    convolution view draws, so the curve on screen is a true partial sum.
    """
    n = x.size + h.size - 1
    lim = int(np.clip(upto, 0, n - 1))
    full = convolve(x, h)
    out = np.zeros(n, dtype=np.float32)
    out[: lim + 1] = full[: lim + 1]
    return out


def cross_correlate(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    return sps.correlate(x, y, mode='full', method='auto').astype(np.float32)


def apply_system(x: np.ndarray, h: np.ndarray, keep_length: bool = True) -> np.ndarray:
    y = convolve(x, h)
    if keep_length:
        y = y[: x.size]
    p = peak(y)
    if p > 1.0:
        y = gain(y, 0.95 / p)
    return y.astype(np.float32)


convolve_signals = apply_system


def cascade(irs: Sequence[np.ndarray]) -> np.ndarray:
    """A chain of LTI systems is one LTI system: h1 * h2 * ... * hL."""
    if not irs:
        return np.array([1.0], dtype=np.float32)
    h = irs[0]
    for nxt in irs[1:]:
        h = convolve(h, nxt)
    return h.astype(np.float32)


def frequency_response(h: np.ndarray, sr: int = SR,
                       nfft: int | None = None) -> tuple[np.ndarray, np.ndarray]:
    nfft = nfft or next_pow2(max(512, h.size * 2))
    mag = magnitude(h, nfft)
    return bin_freqs(nfft, sr), mag


# --------------------------------------------------------------------------
# modulation and sampling
# --------------------------------------------------------------------------
def am_modulate(x: np.ndarray, fc: float, depth: float, sr: int = SR) -> np.ndarray:
    if not fc or depth <= 0:
        return x.astype(np.float32, copy=True)
    t = np.arange(x.size) / sr
    return (x * (1.0 + depth * np.cos(2 * np.pi * fc * t))).astype(np.float32)


def ring_modulate(x: np.ndarray, fc: float, sr: int = SR) -> np.ndarray:
    t = np.arange(x.size) / sr
    return (x * np.cos(2 * np.pi * fc * t)).astype(np.float32)


def decimate(x: np.ndarray, factor: int, anti_alias: bool = True,
             sr: int = SR) -> tuple[np.ndarray, float]:
    """
    Keep every M-th sample, then zero-order hold back to the original rate.
    With anti_alias=False the caller gets audible, visible aliasing on purpose.
    Returns (signal at original length, effective nyquist).
    """
    m = max(1, int(factor))
    nyq = sr / (2 * m)
    if m == 1:
        return x.astype(np.float32, copy=True), sr / 2
    src = filter_signal(x, [lowpass(nyq * 0.9)], sr) if anti_alias else x
    down = src[::m]
    idx = np.minimum(down.size - 1, np.arange(x.size) // m)
    return down[idx].astype(np.float32), nyq


def quantize(x: np.ndarray, bits: int) -> np.ndarray:
    levels = 2 ** max(1, bits) - 1
    return (np.round((x * 0.5 + 0.5) * levels) / levels * 2 - 1).astype(np.float32)
