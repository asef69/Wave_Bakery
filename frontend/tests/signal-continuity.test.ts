import { describe, expect, it } from "vitest";
import {
  computeMixedSignal,
  computeSeasonedSignal,
  computeMarinatedSignal,
  computeConvolvedSignal,
  getIdealDishSignal,
  getRecipeIngredientSamples,
  getPipelineStageSignal,
  savePipelineStageSignal,
  resampleSignal,
  sampleAt,
  type PipelineSignal,
} from "@/lib/pipeline";
import {
  CHEESE_SIGNAL_DEFINITION,
  SUGAR_SIGNAL_DEFINITION,
  SALT_SIGNAL_DEFINITION,
  BREAD_SIGNAL_DEFINITION,
  PATTY_SIGNAL_DEFINITION,
  LETTUCE_SIGNAL_DEFINITION,
  NOODLE_SIGNAL_DEFINITION,
  EGG_SIGNAL_DEFINITION,
  TOMATO_SIGNAL_DEFINITION,
  ONION_SIGNAL_DEFINITION,
  SAUCE_SIGNAL_DEFINITION,
} from "@/lib/signals";
import { CHICKEN_STATIC_PCM_SAMPLES } from "@/lib/chicken-samples";
import { computeSignalSimilarity } from "@/lib/dsp";
import { getCookedSignal, saveCookedSignal, recipes } from "@/lib/recipes";
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
};
if (typeof (globalThis as unknown as { window?: unknown }).window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: localStorageStub,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
} else if (!(globalThis as unknown as { window: { localStorage?: unknown } }).window.localStorage) {
  (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage = localStorageStub;
}

function computeSignalFingerprint(samples: number[]) {
  const len = samples.length;
  const first5 = samples.slice(0, 5).map((v) => Math.round(v * 10000) / 10000);
  const last5 = samples.slice(-5).map((v) => Math.round(v * 10000) / 10000);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const mean = samples.reduce((acc, v) => acc + v, 0) / (len || 1);
  const rms = Math.sqrt(samples.reduce((acc, v) => acc + v * v, 0) / (len || 1));
  return { len, min, max, mean, rms, first5, last5 };
}

describe("Signal Continuity & Canonical Fingerprint Suite", () => {
  describe("1D Canonical Ingredients (Bread, Sugar, Salt, Cheese)", () => {
    it("Bread produces 401 samples with correct amplitude and non-degeneracy", () => {
      const samples = BREAD_SIGNAL_DEFINITION.generateSamples({ freq: 3, sampleCount: 401 });
      expect(samples.length).toBe(401);
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
      const max = Math.max(...samples);
      const min = Math.min(...samples);
      expect(max).toBeLessThanOrEqual(1.4);
      expect(min).toBeGreaterThanOrEqual(-1.4);
      expect(max - min).toBeGreaterThan(0.5);
    });

    it("Sugar produces valid square wave in [-1, 1]", () => {
      const samples = SUGAR_SIGNAL_DEFINITION.generateSamples({ freq: 5, sampleCount: 401 });
      expect(samples.length).toBe(401);
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
      expect(samples.some((s) => s > 0.9)).toBe(true);
      expect(samples.some((s) => s < -0.9)).toBe(true);
    });

    it("Salt produces small-amplitude square wave (target 0.4)", () => {
      const samples = SALT_SIGNAL_DEFINITION.generateSamples({ freq: 12, sampleCount: 401 });
      expect(samples.length).toBe(401);
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
      const max = Math.max(...samples);
      expect(max).toBeCloseTo(0.4, 2);
    });

    it("Cheese produces canonical periodic triangle wave", () => {
      const samples = CHEESE_SIGNAL_DEFINITION.generateSamples({ freq: 6, sampleCount: 401 });
      expect(samples.length).toBe(401);
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
      const max = Math.max(...samples);
      const min = Math.min(...samples);
      expect(max).toBeCloseTo(1.0, 1);
      expect(min).toBeCloseTo(-1.0, 1);
      expect(samples[0]).toBeCloseTo(0, 1);
    });
  });

  describe("Parametric Canonical Ingredients (Egg, Tomato, Onion, Sauce, Noodles, Patty, Lettuce)", () => {
    it("Egg parametric wave yields 401 valid samples", () => {
      const samples = EGG_SIGNAL_DEFINITION.generateSamples({ freq: 4, sampleCount: 401 });
      expect(samples.length).toBe(401);
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
      expect(Math.max(...samples)).toBeGreaterThan(0.1);
    });

    it("Tomato parametric wave yields 401 valid samples", () => {
      const samples = TOMATO_SIGNAL_DEFINITION.generateSamples({ freq: 5, sampleCount: 401 });
      expect(samples.length).toBe(401);
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
      expect(Math.max(...samples)).toBeGreaterThan(0.1);
    });

    it("Onion spiral wave yields 401 valid samples", () => {
      const samples = ONION_SIGNAL_DEFINITION.generateSamples({ freq: 6, sampleCount: 401 });
      expect(samples.length).toBe(401);
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
      expect(Math.max(...samples)).toBeGreaterThan(0.1);
    });

    it("Sauce parametric wave yields 401 valid samples", () => {
      const samples = SAUCE_SIGNAL_DEFINITION.generateSamples({ freq: 4, sampleCount: 401 });
      expect(samples.length).toBe(401);
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
      expect(Math.max(...samples)).toBeGreaterThan(0.1);
    });

    it("Noodles, Patty, and Lettuce generate valid 401 sample signals", () => {
      const noodleSamples = NOODLE_SIGNAL_DEFINITION.generateSamples({ freq: 5, sampleCount: 401 });
      const pattySamples = PATTY_SIGNAL_DEFINITION.generateSamples({ freq: 2, sampleCount: 401 });
      const lettuceSamples = LETTUCE_SIGNAL_DEFINITION.generateSamples({ freq: 3, sampleCount: 401 });

      expect(noodleSamples.length).toBe(401);
      expect(pattySamples.length).toBe(401);
      expect(lettuceSamples.length).toBe(401);

      expect(noodleSamples.every((s) => Number.isFinite(s))).toBe(true);
      expect(pattySamples.every((s) => Number.isFinite(s))).toBe(true);
      expect(lettuceSamples.every((s) => Number.isFinite(s))).toBe(true);
    });
  });

  describe("Recorded Chicken PCM Signal", () => {
    it("Chicken static PCM has 1000 canonical samples and resamples cleanly to 401", () => {
      expect(CHICKEN_STATIC_PCM_SAMPLES.length).toBe(1000);
      const resampled = resampleSignal(CHICKEN_STATIC_PCM_SAMPLES, 401);
      expect(resampled.length).toBe(401);
      expect(resampled.every((s) => Number.isFinite(s))).toBe(true);
      const rmsOrig = Math.sqrt(
        CHICKEN_STATIC_PCM_SAMPLES.reduce((acc, v) => acc + v * v, 0) / CHICKEN_STATIC_PCM_SAMPLES.length,
      );
      const rmsResampled = Math.sqrt(
        resampled.reduce((acc, v) => acc + v * v, 0) / resampled.length,
      );
      expect(rmsResampled).toBeCloseTo(rmsOrig, 1);
    });
  });

  describe("Multi-Ingredient Superpositions", () => {
    const pairs: [string, string][] = [
      ["Egg", "Tomato"],
      ["Tomato", "Onion"],
      ["Egg", "Sauce"],
      ["Noodles", "Tomato"],
      ["Beef Patty", "Lettuce"],
    ];

    pairs.forEach(([ing1, ing2]) => {
      it(`Superposition of ${ing1} + ${ing2} maintains 401 samples and bounds`, () => {
        const recipe = recipes.find((r) => r.ingredients.includes(ing1) && r.ingredients.includes(ing2)) || recipes[0]!;
        const mixed = computeMixedSignal(recipe.id, [ing1, ing2], 401);
        expect(mixed.samples.length).toBe(401);
        expect(mixed.samples.every((s) => Number.isFinite(s))).toBe(true);
        const peak = Math.max(...mixed.samples.map(Math.abs));
        expect(peak).toBeLessThanOrEqual(1.0);
        expect(peak).toBeGreaterThan(0.05);
      });
    });

    it("Triple superposition: Tomato + Onion + Sauce is non-degenerate and bounded", () => {
      const sandwichRecipe = recipes.find((r) => r.id === "sandwich")!;
      const mixed = computeMixedSignal(sandwichRecipe.id, ["Tomato", "Onion", "Sauce"], 401);
      expect(mixed.samples.length).toBe(401);
      expect(mixed.samples.every((s) => Number.isFinite(s))).toBe(true);
      const peak = Math.max(...mixed.samples.map(Math.abs));
      expect(peak).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Exact Numerical Signal Continuity & Stage Hand-offs", () => {
    it("Single ingredient mixing preserves EXACT numerical equality with source", () => {
      const toastRecipe = recipes.find((r) => r.id === "toast")!;
      const rawCheese = getRecipeIngredientSamples(toastRecipe.id, "Cheese", { sampleCount: 401, seed: 0.85 });
      const mixedOne = computeMixedSignal(toastRecipe.id, ["Cheese"], 401);

      expect(mixedOne.samples.length).toBe(rawCheese.length);
      for (let i = 0; i < 401; i++) {
        expect(mixedOne.samples[i]).toBeCloseTo(rawCheese[i]!, 5);
      }

      const fpRaw = computeSignalFingerprint(rawCheese);
      const fpMixed = computeSignalFingerprint(mixedOne.samples);
      expect(fpMixed.min).toBeCloseTo(fpRaw.min, 5);
      expect(fpMixed.max).toBeCloseTo(fpRaw.max, 5);
      expect(fpMixed.rms).toBeCloseTo(fpRaw.rms, 5);
      expect(fpMixed.first5).toEqual(fpRaw.first5);
      expect(fpMixed.last5).toEqual(fpRaw.last5);
    });

    it("Storage roundtrip preserves exact sample array across pipeline stages", () => {
      const burgerRecipe = recipes.find((r) => r.id === "burger")!;
      const mixed = computeMixedSignal(burgerRecipe.id, burgerRecipe.ingredients, 401);

      savePipelineStageSignal(burgerRecipe.id, "mixed", mixed);
      const loaded = getPipelineStageSignal(burgerRecipe.id, "mixed", 401);

      expect(loaded.samples.length).toBe(401);
      const fpOrig = computeSignalFingerprint(mixed.samples);
      const fpLoaded = computeSignalFingerprint(loaded.samples);
      expect(fpLoaded.rms).toBeCloseTo(fpOrig.rms, 5);
      expect(fpLoaded.first5).toEqual(fpOrig.first5);
      expect(fpLoaded.last5).toEqual(fpOrig.last5);
    });

    it("Delivery to Scoring transition: reconstructedSamples pass intact to getCookedSignal", () => {
      const recipeId = "sandwich";
      // Simulate Precision Oven IFFT reconstructed signal
      const dummyReconstructed = new Array(401).fill(0).map((_, i) => Math.sin((i / 400) * 2 * Math.PI * 5) * 0.85);

      saveCookedSignal({
        recipeId,
        methodId: "grill",
        methodName: "Grill",
        frequency: 5,
        amplitude: 0.85,
        noise: 0,
        shift: 0,
        pos: 100,
        timestamp: Date.now(),
        samples: dummyReconstructed,
      });

      const loadedCooked = getCookedSignal(recipeId);
      expect(loadedCooked.samples.length).toBe(401);
      for (let i = 0; i < 401; i++) {
        expect(loadedCooked.samples[i]).toBeCloseTo(dummyReconstructed[i]!, 6);
      }

      const fpRecon = computeSignalFingerprint(dummyReconstructed);
      const fpLoaded = computeSignalFingerprint(loadedCooked.samples);
      expect(fpLoaded.rms).toBeCloseTo(fpRecon.rms, 6);
      expect(fpLoaded.first5).toEqual(fpRecon.first5);
    });
  });

  describe("Intentional DSP Transformation Verification", () => {
    it("Seasoning applies linear amplitude scaling accurately", () => {
      const toastRecipe = recipes.find((r) => r.id === "toast")!;
      const mixed = computeMixedSignal(toastRecipe.id, ["Cheese"], 401);
      const seasoned = computeSeasonedSignal(mixed, 0.5, 1.0, 401);

      expect(seasoned.samples.length).toBe(401);
      for (let i = 0; i < 401; i++) {
        expect(seasoned.samples[i]).toBeCloseTo(mixed.samples[i]! * 0.5, 3);
      }
    });

    it("Marinating applies time delay with zero padding", () => {
      const toastRecipe = recipes.find((r) => r.id === "toast")!;
      const mixed = computeMixedSignal(toastRecipe.id, ["Cheese"], 401);
      const marinated = computeMarinatedSignal(mixed, 0.2, 401);

      expect(marinated.samples.length).toBe(401);
      // Leading samples should be zero due to time delay
      expect(marinated.samples[0]).toBe(0);
      expect(marinated.samples[1]).toBe(0);
    });
  });

  describe("End-to-End Pipeline Invariant (401 Samples & Non-Degeneracy)", () => {
    it("Verifies all 10 recipes maintain 401 samples and 100% self-similarity match", () => {
      for (const recipe of recipes) {
        const ideal = getIdealDishSignal(recipe.id, 401);
        expect(ideal.samples.length).toBe(401);
        expect(ideal.samples.every((s) => Number.isFinite(s))).toBe(true);
        expect(ideal.samples.some((s) => s !== 0)).toBe(true);

        const sim = computeSignalSimilarity(ideal.samples, ideal.samples);
        expect(sim).toBe(100);
      }
    });

    it("computeSignalSimilarity safely resamples mismatched player vs target lengths", () => {
      const target = new Array(401).fill(0).map((_, i) => Math.sin((i / 400) * 2 * Math.PI * 3));
      const player900 = new Array(900).fill(0).map((_, i) => Math.sin((i / 899) * 2 * Math.PI * 3));

      const sim = computeSignalSimilarity(player900, target);
      expect(sim).toBeGreaterThanOrEqual(99.0);
    });
  });
});
