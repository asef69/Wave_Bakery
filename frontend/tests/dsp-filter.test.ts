import { describe, expect, it } from "vitest";
import { applyLowPassFilter, fft } from "@/lib/dsp";

describe("T5: Frequency-Domain Low-Pass Filter", () => {
  it("attenuates high-frequency tone while preserving passband tone", () => {
    const sampleRate = 8000;
    const duration = 0.2; // 200 ms
    const numSamples = Math.round(sampleRate * duration); // 1600 samples

    const f1 = 200; // Passband tone (200 Hz)
    const f2 = 800; // Stopband tone (800 Hz)
    const cutoff = 400; // Cutoff (400 Hz)

    const compound: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const s1 = Math.sin(2 * Math.PI * f1 * t);
      const s2 = Math.sin(2 * Math.PI * f2 * t);
      compound.push(s1 + s2);
    }

    const filtered = applyLowPassFilter(compound, cutoff, sampleRate);
    expect(filtered.length).toBe(numSamples);

    // Analyze frequency domain of filtered output
    const { magnitude } = fft(filtered);
    const N = magnitude.length;
    const binHz = sampleRate / N;

    const binF1 = Math.round(f1 / binHz);
    const binF2 = Math.round(f2 / binHz);

    const magF1 = magnitude[binF1] ?? 0;
    const magF2 = magnitude[binF2] ?? 0;

    // Passband magnitude should remain strong
    expect(magF1).toBeGreaterThan(100);

    // Stopband magnitude should be heavily attenuated (> 20 dB suppression, ratio > 10x)
    expect(magF2).toBeLessThan(magF1 * 0.05);
  });

  it("handles boundary condition with zero or single sample array gracefully", () => {
    expect(applyLowPassFilter([], 500)).toEqual([]);
    expect(applyLowPassFilter([0.5], 500).length).toBe(1);
  });
});
