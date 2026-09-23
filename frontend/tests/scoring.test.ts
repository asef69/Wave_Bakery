import { describe, expect, it } from "vitest";
import {
  normalizedCrossCorrelation,
  normalizedRootMeanSquareError,
  computeSignalSimilarity,
} from "@/lib/dsp";

describe("T9: Signal Comparison & Scoring Metrics", () => {
  it("yields 1.0 cross-correlation and 100% match for identical signals", () => {
    const sig: number[] = [];
    for (let i = 0; i < 200; i++) {
      sig.push(Math.sin((2 * Math.PI * 4 * i) / 200) + 0.3 * Math.cos((2 * Math.PI * 12 * i) / 200));
    }

    const rXy = normalizedCrossCorrelation(sig, sig);
    expect(rXy).toBeCloseTo(1.0, 5);

    const nrmse = normalizedRootMeanSquareError(sig, sig);
    expect(nrmse).toBeCloseTo(1.0, 5);

    const match = computeSignalSimilarity(sig, sig);
    expect(match).toBe(100);
  });

  it("yields ~0 correlation for orthogonal sinusoid signals", () => {
    const N = 512;
    const sinTone: number[] = [];
    const cosTone: number[] = [];

    for (let i = 0; i < N; i++) {
      sinTone.push(Math.sin((2 * Math.PI * 8 * i) / N));
      cosTone.push(Math.cos((2 * Math.PI * 8 * i) / N));
    }

    const rXy = normalizedCrossCorrelation(sinTone, cosTone);
    expect(Math.abs(rXy)).toBeLessThan(0.01);
  });

  it("penalizes heavily inverted or noisy signals", () => {
    const N = 200;
    const clean: number[] = [];
    const inverted: number[] = [];

    for (let i = 0; i < N; i++) {
      const val = Math.sin((2 * Math.PI * 5 * i) / N);
      clean.push(val);
      inverted.push(-val);
    }

    const rXy = normalizedCrossCorrelation(clean, inverted);
    expect(rXy).toBeCloseTo(-1.0, 5);

    const score = computeSignalSimilarity(clean, inverted);
    expect(score).toBeLessThan(30);
  });
});
