"""
Contamination — the noise an ingredient picks up on delivery.

Corruption is seeded, so the same session id always reproduces exactly the
same dirty ingredient. That is what lets the server re-derive a player's
starting material when validating a submission instead of trusting the client.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np

from . import core as C


@dataclass
class Contaminant:
    kind: str
    amp: float
    band_lo: float
    band_hi: float
    freq: float | None = None

    def dict(self) -> dict:
        return asdict(self)


KINDS = ('white', 'hiss', 'burst')


def corrupt(clean: np.ndarray, difficulty: float, seed: int,
            sr: int = C.SR, ideal_cutoff: float | None = None,
            ) -> tuple[np.ndarray, list[Contaminant]]:
    if difficulty <= 0:
        return clean.astype(np.float32, copy=True), []
    rng = np.random.default_rng(seed & 0xFFFFFFFF)
    n = clean.size
    count = 1 + int(rng.integers(0, 1 + min(2, int(difficulty))))
    layers = [clean]
    found: list[Contaminant] = []

    for _ in range(count):
        kind = KINDS[int(rng.integers(0, len(KINDS)))]
        amp = 0.08 + 0.10 * difficulty * (0.6 + float(rng.random()) * 0.8)

        if kind == 'white':
            layer = C.white(n, amp, rng)
            meta = Contaminant('white', amp, 0.0, sr / 2)
        elif kind == 'pink':
            layer = C.pink(n, amp, rng)
            meta = Contaminant('pink', amp, 0.0, sr / 6)
        elif kind == 'hum':
            f0 = 50.0 if rng.random() < 0.5 else 60.0
            layer = C.hum(n, amp * 1.4, f0, sr)
            meta = Contaminant('hum', amp, f0 * 0.6, f0 * 5.6, f0)
        elif kind == 'hiss':
            # Anchor the hiss band just above the ingredient's own ideal_cutoff
            # so there is a real, ingredient-specific cutoff to find. A fixed
            # high fraction of sr (the old behaviour) put hiss at 6.6-9.7 kHz,
            # far above the 100-900 Hz cutoff slider — any cutoff below it
            # removed the hiss identically, so the whole upper half of the
            # slider scored as a perfect match instead of only the true ideal.
            fc = (ideal_cutoff * (1.1 + float(rng.random()) * 0.5) if ideal_cutoff
                  else sr * (0.30 + float(rng.random()) * 0.14))
            layer = C.hiss(n, amp * 1.2, fc, rng, sr)
            meta = Contaminant('hiss', amp, fc * 0.6, sr / 2, fc)
        elif kind == 'burst':
            layer = C.burst(n, amp * 1.6, 0.003 + float(rng.random()) * 0.004, rng)
            meta = Contaminant('burst', amp, 0.0, sr / 2)
        else:  # tone
            f = 800 + float(rng.random()) * (sr * 0.3)
            layer = C.tone(n, amp * 1.1, f, sr)
            meta = Contaminant('tone', amp, f * 0.85, f * 1.15, f)

        layers.append(layer)
        found.append(meta)

    return C.add(layers), found
