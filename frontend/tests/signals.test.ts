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
  computeSuperpositionPath,
  samplesToPath,
  parametricPath,
  getMathematicalSignal,
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

  describe("Mixing Superposition Visualization", () => {
    const W = 1000;
    const H = 320;
    const mock1DSamples: Record<string, number[]> = {
      Bread: Array.from({ length: 401 }, (_, i) => Math.sin((i / 400) * 4 * Math.PI)),
      Cheese: Array.from({ length: 401 }, (_, i) => 0.5 * Math.sin((i / 400) * 8 * Math.PI)),
      Salt: Array.from({ length: 401 }, (_, i) => 0.2 * Math.sin((i / 400) * 20 * Math.PI)),
    };

    it("1. Single ingredient produces EXACTLY the individual signal's path", () => {
      // 1D signal: Bread
      const pathBread = computeSuperpositionPath([{ name: "Bread" }], mock1DSamples, W, H);
      const expectedBread = samplesToPath(mock1DSamples["Bread"]!, W, H, 0.35);
      expect(pathBread).toBe(expectedBread);

      // Closed parametric signal: Egg
      const pathEgg = computeSuperpositionPath([{ name: "Egg" }], mock1DSamples, W, H);
      const eggMath = getMathematicalSignal("Egg")!;
      const expectedEgg = parametricPath(
        W,
        H,
        eggMath.parametricCurve!.generatePoints(601),
        24,
        true,
      );
      expect(pathEgg).toBe(expectedEgg);

      // Open parametric signal: Noodles
      const pathNoodles = computeSuperpositionPath([{ name: "Noodles" }], mock1DSamples, W, H);
      const noodleMath = getMathematicalSignal("Noodles")!;
      const expectedNoodles = parametricPath(
        W,
        H,
        noodleMath.parametricCurve!.generatePoints(601),
        24,
        false,
      );
      expect(pathNoodles).toBe(expectedNoodles);
    });

    it("2. Multiple ordinary 1D signals compute discrete sample-by-sample superposition", () => {
      const pathMixed = computeSuperpositionPath(
        [{ name: "Bread" }, { name: "Cheese" }],
        mock1DSamples,
        W,
        H,
      );
      const expectedSum = mock1DSamples["Bread"]!.map((b, i) => b + mock1DSamples["Cheese"]![i]!);
      const expectedPath = samplesToPath(expectedSum, W, H, 0.35);
      expect(pathMixed).toBe(expectedPath);
    });

    it("3. Special parametric ingredient combinations preserve 2D geometry", () => {
      const combos = [
        { name1: "Egg", name2: "Onion" },
        { name1: "Egg", name2: "Tomato" },
        { name1: "Tomato", name2: "Sauce" },
        { name1: "Noodles", name2: "Egg" },
        { name1: "Onion", name2: "Tomato" },
        { name1: "Beef Patty", name2: "Tomato" },
        { name1: "Sauce", name2: "Noodles" },
      ];

      for (const { name1, name2 } of combos) {
        const path = computeSuperpositionPath(
          [{ name: name1 }, { name: name2 }],
          mock1DSamples,
          W,
          H,
        );

        // Verify valid SVG path
        expect(path.startsWith("M")).toBe(true);
        const segmentCount = path.split(" L").length;
        expect(segmentCount).toBe(601);

        // Verify it does not equal either single ingredient
        const single1 = computeSuperpositionPath([{ name: name1 }], mock1DSamples, W, H);
        const single2 = computeSuperpositionPath([{ name: name2 }], mock1DSamples, W, H);
        expect(path).not.toBe(single1);
        expect(path).not.toBe(single2);
      }
    });

    it("4. Adding 1st produces that ingredient; adding 2nd changes it to the sum; removing 2nd restores 1st", () => {
      // Step 1: Add Egg
      const path1 = computeSuperpositionPath([{ name: "Egg" }], mock1DSamples, W, H);
      const eggMath = getMathematicalSignal("Egg")!;
      const expectedEgg = parametricPath(
        W,
        H,
        eggMath.parametricCurve!.generatePoints(601),
        24,
        true,
      );
      expect(path1).toBe(expectedEgg);

      // Step 2: Add Tomato
      const path2 = computeSuperpositionPath(
        [{ name: "Egg" }, { name: "Tomato" }],
        mock1DSamples,
        W,
        H,
      );
      expect(path2).not.toBe(path1);

      // Step 3: Remove Tomato (back to Egg)
      const path3 = computeSuperpositionPath([{ name: "Egg" }], mock1DSamples, W, H);
      expect(path3).toBe(expectedEgg);
    });

    it("5. Mixing parametric and 1D ingredient preserves parametric geometry modulated by 1D signal", () => {
      const pathEggSalt = computeSuperpositionPath(
        [{ name: "Egg" }, { name: "Salt" }],
        mock1DSamples,
        W,
        H,
      );
      expect(pathEggSalt.startsWith("M")).toBe(true);
      expect(pathEggSalt.split(" L").length).toBe(601);
      const singleEgg = computeSuperpositionPath([{ name: "Egg" }], mock1DSamples, W, H);
      expect(pathEggSalt).not.toBe(singleEgg);
    });
  });
});
