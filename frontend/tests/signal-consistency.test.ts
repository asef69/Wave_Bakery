/**
 * Every ingredient and recipe: what the labs draw is what the pipeline saves,
 * every stage renders, and looping playback has no click at the seam.
 */
import { describe, expect, it } from "vitest";

import { smoothLoopSeam } from "@/lib/audio";
import {
  computeCleanMixedSignal,
  computeConvolvedSignal,
  computeMarinatedSignal,
  computeMixedSignal,
  computeSeasonedSignal,
  getIdealDishSignal,
  getMixingIngredientSamples,
  getRecipeIngredientSamples,
  pipelineSignalToPath,
} from "@/lib/pipeline";
import { ALL_AVAILABLE_INGREDIENTS, recipes } from "@/lib/recipes";
import { getMathematicalSignal, parametricPath, samplesToPath } from "@/lib/signals";

function corr(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  const ma = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const mb = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let s = 0,
    sa = 0,
    sb = 0;
  for (let i = 0; i < n; i++) {
    s += (a[i]! - ma) * (b[i]! - mb);
    sa += (a[i]! - ma) ** 2;
    sb += (b[i]! - mb) ** 2;
  }
  return s / Math.sqrt(sa * sb);
}

function seamRatio(x: number[]) {
  let maxStep = 0;
  for (let i = 1; i < x.length; i++) maxStep = Math.max(maxStep, Math.abs(x[i]! - x[i - 1]!));
  return Math.abs(x[0]! - x[x.length - 1]!) / (maxStep || 1e-9);
}

describe("ingredient signals", () => {
  it.each(ALL_AVAILABLE_INGREDIENTS.map((i) => [i.name, i.freq ?? 4] as const))(
    "%s renders as finite samples, a valid path, and a valid curve",
    (name, freq) => {
      const x = getRecipeIngredientSamples("burger", name, { freq, seed: 0 });
      expect(x).toHaveLength(401);
      expect(x.every(Number.isFinite)).toBe(true);
      expect(Math.max(...x.map(Math.abs))).toBeGreaterThan(0.1);
      expect(samplesToPath(x, 1000, 320, 0.35)).not.toContain("NaN");
      const curve = getMathematicalSignal(name)?.parametricCurve;
      if (curve) {
        const pts = curve.generatePoints(601);
        expect(parametricPath(1000, 320, pts, 24, false)).not.toContain("NaN");
        // the 1-D signal is the curve's vertical component
        const ys = Array.from({ length: 401 }, (_, i) => pts[Math.round((i / 400) * 600)]!.y);
        expect(corr(ys, x)).toBeGreaterThan(0.99);
      }
    },
  );
});

describe("mixing saves exactly what the Mixing lab shows", () => {
  it.each(recipes.map((r) => [r.id] as const))("%s", (id) => {
    const r = recipes.find((x) => x.id === id)!;
    const shown = getMixingIngredientSamples(id, r.ingredients);
    for (const name of r.ingredients) {
      const single = computeMixedSignal(id, [name]).samples;
      expect(corr(single, shown[name]!)).toBeGreaterThan(0.999);
    }
    const preview = Array.from({ length: 401 }, (_, i) =>
      r.ingredients.reduce((s, n) => s + shown[n]![i]!, 0),
    );
    expect(corr(preview, computeMixedSignal(id, r.ingredients).samples)).toBeGreaterThan(0.999);
    // the reference mix comes from the same generator (clean)
    const cleanShown = getMixingIngredientSamples(id, r.ingredients, 401, true);
    const cleanPreview = Array.from({ length: 401 }, (_, i) =>
      r.ingredients.reduce((s, n) => s + cleanShown[n]![i]!, 0),
    );
    expect(corr(cleanPreview, computeCleanMixedSignal(id).samples)).toBeGreaterThan(0.999);
  });
});

describe("every stage renders for every recipe", () => {
  it.each(recipes.map((r) => [r.id] as const))("%s", (id) => {
    const r = recipes.find((x) => x.id === id)!;
    const mixed = computeMixedSignal(id, r.ingredients);
    const seasoned = computeSeasonedSignal(
      mixed,
      r.seasoningTarget.amplitude,
      r.seasoningTarget.frequency,
    );
    const marinated = computeMarinatedSignal(seasoned, r.marinateTarget.timeScale);
    const cooked = computeConvolvedSignal(marinated, r.cookingMethod.id, 100);
    for (const s of [mixed, seasoned, marinated, cooked, getIdealDishSignal(id)]) {
      expect(s.samples.every(Number.isFinite)).toBe(true);
      const path = pipelineSignalToPath(s, 900, 300);
      expect(path.length).toBeGreaterThan(0);
      expect(path).not.toContain("NaN");
    }
  });
});

describe("looping playback has no click at the seam", () => {
  it("smooths signals that do not complete whole cycles (carrot, milk)", () => {
    for (const name of ["Carrot", "Milk"]) {
      const freq = ALL_AVAILABLE_INGREDIENTS.find((i) => i.name === name)!.freq;
      const x = getRecipeIngredientSamples("burger", name, { freq, seed: 0 });
      expect(seamRatio(x)).toBeGreaterThan(1.5);
      expect(seamRatio(smoothLoopSeam(x))).toBeLessThan(0.01);
    }
  });

  it("leaves periodic signals and genuine square-wave edges untouched", () => {
    for (const name of ["Cheese", "Sugar", "Salt", "Bread", "Noodles"]) {
      const x = getRecipeIngredientSamples("burger", name, { seed: 0 });
      expect(smoothLoopSeam(x)).toEqual(x);
    }
  });
});
