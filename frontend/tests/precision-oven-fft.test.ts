import { describe, expect, it } from "vitest";

import {
  computeDiscreteSignalFFT,
  computeSignalIFFT,
  computeSignalSimilarity,
  tuneOvenFrequencies,
} from "@/lib/precision-oven-dsp";

// 3 Hz + 10 Hz over the normalized 1-second window, peak 0.95.
const N = 401;
const raw = Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1);
  return 0.6 * Math.sin(2 * Math.PI * 3 * t) + 0.3 * Math.sin(2 * Math.PI * 10 * t);
});
const peak = Math.max(...raw.map(Math.abs));
const dish = raw.map((v) => (v / peak) * 0.95);

const unity = { lowGain: 1, midGain: 1, highGain: 1, cutoffHz: 1000 };

describe("Precision Oven FFT / IFFT", () => {
  it.each([24, 32, 64, 100])("labels bins in real Hz at fs = %i", (fs) => {
    const spec = computeDiscreteSignalFFT(dish, fs);
    const top = [...spec.bins].sort((a, b) => b.rawMagnitude - a.rawMagnitude)[0]!;
    expect(Math.abs(top.frequency - 3)).toBeLessThanOrEqual(fs / spec.real.length);
  });

  it.each([24, 32, 64])("untouched sliders reconstruct the dish at fs = %i", (fs) => {
    const spec = computeDiscreteSignalFFT(dish, fs);
    const t = tuneOvenFrequencies(spec, unity);
    const recon = computeSignalIFFT(t.tunedReal, t.tunedImag, N, fs);
    expect(computeSignalSimilarity(recon, dish)).toBeGreaterThanOrEqual(98);
  });

  it("sampling below 2·fmax visibly damages the reconstruction", () => {
    const spec = computeDiscreteSignalFFT(dish, 12);
    const t = tuneOvenFrequencies(spec, unity);
    const recon = computeSignalIFFT(t.tunedReal, t.tunedImag, N, 12);
    expect(computeSignalSimilarity(recon, dish)).toBeLessThan(90);
  });
});
