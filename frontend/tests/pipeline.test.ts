import { describe, expect, it } from "vitest";
import {
  computeMixedSignal,
  computeSeasonedSignal,
  computeMarinatedSignal,
  computeConvolvedSignal,
  getIdealDishSignal,
  getRecipeIngredientSamples,
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
});
