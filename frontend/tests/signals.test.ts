import { describe, expect, it } from "vitest";
import {
  evaluateCarrotDirect,
  evaluateCarrotWave,
  evaluateCucumberDirect,
  evaluateCucumberWave,
  evaluateSauceParametric,
  evaluateEggParametric,
  evaluateTriangleWave,
  evaluateSquareWave,
  MATHEMATICAL_SIGNALS,
} from "@/lib/signals";

describe("T2: Mathematical Signal Ingredients", () => {
  it("evaluates Carrot equation y = 5 - (1 + cos(0.5x))^4 correctly", () => {
    // At x = 0: cos(0) = 1 => 5 - (1+1)^4 = 5 - 16 = -11
    const val0 = evaluateCarrotDirect(0);
    expect(val0).toBe(-11);

    // At x = 2*pi: cos(pi) = -1 => 5 - (1-1)^4 = 5
    const val2Pi = evaluateCarrotDirect(2 * Math.PI);
    expect(val2Pi).toBe(5);

    // Normalized audio wave within bounds
    const waveVal = evaluateCarrotWave(0.5, { frequency: 4.5, amplitude: 1 });
    expect(typeof waveVal).toBe("number");
    expect(Math.abs(waveVal)).toBeLessThanOrEqual(1.5);
  });

  it("evaluates Cucumber equation y = 6 * tanh(4*cos(x)) correctly", () => {
    // At x = 0: cos(0) = 1 => 6 * tanh(4) ≈ 5.996
    const val0 = evaluateCucumberDirect(0);
    expect(val0).toBeCloseTo(6 * Math.tanh(4), 3);

    // At x = pi/2: cos(pi/2) = 0 => 6 * tanh(0) = 0
    const valHalfPi = evaluateCucumberDirect(Math.PI / 2);
    expect(valHalfPi).toBeCloseTo(0, 3);

    const waveVal = evaluateCucumberWave(0.2, { frequency: 7, amplitude: 1 });
    expect(typeof waveVal).toBe("number");
    expect(Math.abs(waveVal)).toBeLessThanOrEqual(1.5);
  });

  it("evaluates Sauce parametric curve over domain [0, 6pi]", () => {
    const p0 = evaluateSauceParametric(0);
    expect(p0.x).toBeCloseTo(3 * Math.cos(0), 3);
    expect(p0.y).toBeCloseTo(2 * Math.sin(0), 3);

    const pMid = evaluateSauceParametric(Math.PI);
    expect(isNaN(pMid.x)).toBe(false);
    expect(isNaN(pMid.y)).toBe(false);
  });

  it("evaluates Egg parametric curve correctly", () => {
    const p0 = evaluateEggParametric(0);
    expect(p0.x).toBeCloseTo(1.5, 3);
    expect(p0.y).toBeCloseTo(0, 3);
  });

  it("evaluates periodic triangular wave (Cheese)", () => {
    const t0 = evaluateTriangleWave(0, { frequency: 2, amplitude: 1 });
    expect(t0).toBeCloseTo(0, 3);

    const tQuarter = evaluateTriangleWave(1 / 8, { frequency: 2, amplitude: 1 });
    expect(tQuarter).toBeCloseTo(1, 3);
  });

  it("evaluates periodic square wave (Sugar / Salt)", () => {
    const sPos = evaluateSquareWave(0.1, { frequency: 1, amplitude: 1 });
    expect(sPos).toBe(1);

    const sNeg = evaluateSquareWave(0.6, { frequency: 1, amplitude: 1 });
    expect(sNeg).toBe(-1);
  });

  it("generates bounded samples across all catalog signals", () => {
    const signalKeys = Object.keys(MATHEMATICAL_SIGNALS);
    expect(signalKeys.length).toBeGreaterThan(5);

    for (const key of signalKeys) {
      const sig = MATHEMATICAL_SIGNALS[key]!;
      const samples = sig.generateSamples({ freq: 4, amplitude: 1, sampleCount: 401 });
      expect(samples.length).toBe(401);
      for (const s of samples) {
        expect(isNaN(s)).toBe(false);
        expect(isFinite(s)).toBe(true);
        expect(Math.abs(s)).toBeLessThanOrEqual(5.0);
      }
    }
  });
});
