import { describe, expect, it } from "vitest";
import {
  computeMixedSignal,
  computeCleanMixedSignal,
  computeSeasonedSignal,
  computeMarinatedSignal,
  computeConvolvedSignal,
  getIdealDishSignal,
  getRecipeIngredientSamples,
  getOrSaveExpectedSignal,
  initializeAllExpectedSignals,
} from "@/lib/pipeline";
import { recipes } from "@/lib/recipes";

describe("T7: Recipe Pipeline Dataflow", () => {
  const burgerRecipe = recipes.find((r) => r.id === "burger")!;

  it("generates valid raw ingredient signals", () => {
    const rawBun = getRecipeIngredientSamples(burgerRecipe.id, "Bun", { sampleCount: 401 });
    expect(rawBun.length).toBe(401);
    expect(rawBun.some((v) => v !== 0)).toBe(true);

    const rawCheese = getRecipeIngredientSamples(burgerRecipe.id, "Cheese", { sampleCount: 401 });
    expect(rawCheese.length).toBe(401);
  });

  it("mixes ingredients via linear superposition", () => {
    const mixed = computeMixedSignal(burgerRecipe.id, burgerRecipe.ingredients, 401);
    expect(mixed.stage).toBe("mixed");
    expect(mixed.samples.length).toBe(401);
    expect(mixed.frequency).toBeGreaterThan(0);

    const peak = Math.max(...mixed.samples.map((s) => Math.abs(s)));
    expect(peak).toBeLessThanOrEqual(1.0);
  });

  it("transforms signal through seasoning (amplitude & frequency scaling)", () => {
    const mixed = computeMixedSignal(burgerRecipe.id, burgerRecipe.ingredients, 401);
    const seasoned = computeSeasonedSignal(mixed, 0.8, 1.5, 401);

    expect(seasoned.stage).toBe("seasoned");
    expect(seasoned.samples.length).toBe(401);
    expect(seasoned.frequency).toBeCloseTo(mixed.frequency * 1.5, 1);
  });

  it("marinating scales time (stretch & compress)", () => {
    const mixed = computeMixedSignal(burgerRecipe.id, burgerRecipe.ingredients, 401);
    const seasoned = computeSeasonedSignal(mixed, 1.0, 1.0, 401);
    const marinated = computeMarinatedSignal(seasoned, 1.25, 401);

    expect(marinated.stage).toBe("marinated");
    expect(marinated.samples.length).toBe(401);
    expect(marinated.duration).toBeCloseTo(seasoned.duration * 1.25, 1);
  });

  it("convolves with cooking impulse response", () => {
    const mixed = computeMixedSignal(burgerRecipe.id, burgerRecipe.ingredients, 401);
    const seasoned = computeSeasonedSignal(mixed, 1.0, 1.0, 401);
    const marinated = computeMarinatedSignal(seasoned, 1.0, 401);
    const cooked = computeConvolvedSignal(marinated, "grill", 100, 401);

    expect(cooked.stage).toBe("cooked");
    expect(cooked.samples.length).toBe(401);
    const peak = Math.max(...cooked.samples.map((s) => Math.abs(s)));
    expect(peak).toBeLessThanOrEqual(1.0);
  });

  it("computes complete ideal dish reference signal", () => {
    const ideal = getIdealDishSignal(burgerRecipe.id, 401);
    expect(ideal.stage).toBe("cooked");
    expect(ideal.samples.length).toBe(401);
    expect(ideal.recipeId).toBe(burgerRecipe.id);
  });

  it("computes clean mixed signal with zero noise", () => {
    const clean = computeCleanMixedSignal(burgerRecipe.id, burgerRecipe.ingredients, 401);
    expect(clean.stage).toBe("mixed");
    expect(clean.samples.length).toBe(401);
    expect(clean.metadata?.clean).toBe(true);
  });

  it("initializes and caches expected signals for all recipes", () => {
    const all = initializeAllExpectedSignals(401);
    expect(Object.keys(all).length).toBe(recipes.length);
    for (const r of recipes) {
      const sig = all[r.id];
      expect(sig).toBeDefined();
      expect(sig!.samples.length).toBe(401);
      expect(sig!.recipeId).toBe(r.id);

      const cached = getOrSaveExpectedSignal(r.id, 401);
      expect(cached.samples.length).toBe(401);
      expect(cached.recipeId).toBe(r.id);
    }
  });

  it("preserves identical samples and alignment when mixing a single ingredient", () => {
    const singleIngredient = "Bun";
    const rawBun = getRecipeIngredientSamples(burgerRecipe.id, singleIngredient, {
      sampleCount: 401,
      seed: 0, // phase 0, as Generate/Filtering/Mixing display it
      noise: 0,
      amplitude: 1.0,
    });
    const mixedSingle = computeMixedSignal(burgerRecipe.id, [singleIngredient], 401);

    expect(mixedSingle.samples.length).toBe(rawBun.length);
    for (let i = 0; i < rawBun.length; i++) {
      expect(mixedSingle.samples[i]).toBeCloseTo(rawBun[i]!, 5);
    }
  });
});
