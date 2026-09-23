import { describe, expect, it } from "vitest";
import { fft, ifft } from "@/lib/dsp";

describe("T4: Fast Fourier Transform (FFT) & IFFT Roundtrip", () => {
  it("reconstructs signal via IFFT(FFT(x)) with MSE < 1e-5", () => {
    const N = 512;
    const original: number[] = [];
    for (let n = 0; n < N; n++) {
      // Compound signal: sum of sinusoids + linear ramp
      original.push(
        Math.sin((2 * Math.PI * 5 * n) / N) * 0.7 +
          Math.cos((2 * Math.PI * 18 * n) / N) * 0.3 +
          (n / N) * 0.2,
      );
    }

    const { real, imag } = fft(original);
    const reconstructed = ifft(real, imag);

    expect(reconstructed.length).toBe(N);

    let sse = 0;
    for (let i = 0; i < N; i++) {
      const err = (original[i] ?? 0) - (reconstructed[i] ?? 0);
      sse += err * err;
    }
    const mse = sse / N;
    expect(mse).toBeLessThan(1e-5);
  });

  it("verifies Parseval's Energy Conservation Theorem", () => {
    const N = 256;
    const x: number[] = [];
    let timeEnergy = 0;
    for (let n = 0; n < N; n++) {
      const val = Math.sin((2 * Math.PI * 7 * n) / N) + 0.5 * Math.cos((2 * Math.PI * 23 * n) / N);
      x.push(val);
      timeEnergy += val * val;
    }

    const { magnitude } = fft(x);
    let freqEnergy = 0;
    for (let k = 0; k < N; k++) {
      const mag = magnitude[k]!;
      freqEnergy += mag * mag;
    }
    freqEnergy = freqEnergy / N;

    expect(Math.abs(timeEnergy - freqEnergy)).toBeLessThan(1e-4);
  });

  it("transforms discrete unit impulse delta[n] to constant magnitude across all bins", () => {
    const N = 64;
    const impulse = new Array<number>(N).fill(0);
    impulse[0] = 1.0;

    const { magnitude } = fft(impulse);
    for (let k = 0; k < N; k++) {
      expect(magnitude[k]).toBeCloseTo(1.0, 5);
    }
  });

  it("identifies known sinusoid frequency bin peaks", () => {
    const N = 128;
    const f0 = 12;
    const tone: number[] = [];
    for (let n = 0; n < N; n++) {
      tone.push(Math.cos((2 * Math.PI * f0 * n) / N));
    }

    const { magnitude } = fft(tone);
    // Peak should be at bin f0 (and symmetric bin N - f0)
    expect(magnitude[f0]).toBeCloseTo(N / 2, 1);
    expect(magnitude[N - f0]).toBeCloseTo(N / 2, 1);

    // Other bins should have near-zero magnitude
    for (let k = 0; k < N; k++) {
      if (k !== f0 && k !== N - f0) {
        expect(magnitude[k]).toBeLessThan(0.01);
      }
    }
  });
});
