/**
 * The Signal Playground must show the gameplay's own signals and operations:
 * the same ingredient samples the recipe stations use, the same mixing,
 * seasoning, marinating (a delay), cooking and washing.
 */
import { describe, expect, it } from "vitest";

import { DELIVERY_FS, overtoneBetweenHarmonics } from "@/lib/delivery";
import {
  computeConvolvedSignal,
  computeMarinatedSignal,
  computeSeasonedSignal,
  getRecipeIngredientSamples,
} from "@/lib/pipeline";
import {
  bakeInOven,
  cookSource,
  deliverOnPlaygroundCart,
  marinateSource,
  mixSources,
  seasonSource,
  sourceAsMix,
  sourceSamples,
  targetDials,
  tasteCompare,
  runFullChain,
  washSource,
  type PlaygroundSource,
} from "@/lib/playground";
import { ALL_AVAILABLE_INGREDIENTS, recipes } from "@/lib/recipes";

const ingredient = (name: string): PlaygroundSource => {
  const d = ALL_AVAILABLE_INGREDIENTS.find((i) => i.name === name)!;
  return { category: "ingredient", name: d.name, freq: d.freq, idealCutoff: d.idealCutoff };
};

describe("Signal Playground uses the gameplay signals", () => {
  it("every recipe ingredient has the same samples as in a recipe run", () => {
    for (const recipe of recipes) {
      for (const d of recipe.ingredientDetails) {
        const game = getRecipeIngredientSamples(recipe.id, d.name, { noise: 0, seed: 0 });
        const play = sourceSamples(ingredient(d.name));
        expect(play.length).toBe(game.length);
        play.forEach((v, i) => expect(v).toBeCloseTo(game[i]!, 9));
      }
    }
  });

  it("seasoning, marinating and cooking are the recipe stations' own stages", () => {
    const src = ingredient("Lettuce");
    const mix = sourceAsMix(src);
    expect(seasonSource(src, 1.5, 0.8).samples).toEqual(
      computeSeasonedSignal(mix, 1.5, 0.8).samples,
    );
    expect(marinateSource(src, 1.25).samples).toEqual(computeMarinatedSignal(mix, 1.25).samples);
    expect(cookSource(src, "grill", 70).samples).toEqual(
      computeConvolvedSignal(mix, "grill", 70).samples,
    );
  });

  it("marinating is a delay (silence first), not a stretch", () => {
    const out = marinateSource(ingredient("Cheese"), 1.25).samples;
    const shift = Math.round((1.25 / 3) * 401);
    expect(out.slice(0, shift).every((v) => v === 0)).toBe(true);
    expect(out.slice(shift).some((v) => v !== 0)).toBe(true);
  });

  it("the convolution depth slider changes the output", () => {
    const src = ingredient("Bun");
    expect(cookSource(src, "bake", 0).samples).not.toEqual(cookSource(src, "bake", 100).samples);
  });

  it("washing can over-filter: a cutoff below the ingredient's band cuts it", () => {
    const src = ingredient("Tomato"); // ideal cutoff 520 Hz
    const energy = (x: number[]) => x.reduce((a, v) => a + v * v, 0);
    const { clean, filtered: right } = washSource(src, 520);
    const { filtered: over } = washSource(src, 350);
    expect(energy(right)).toBeCloseTo(energy(clean), 6);
    expect(energy(over)).toBeLessThan(0.5 * energy(clean));
  });

  it("a one-channel mix is the signal itself", () => {
    const src = ingredient("Salt");
    expect(mixSources([{ src, gain: 1 }]).samples).toEqual(sourceSamples(src));
  });
});

describe("Signal Playground: finishing stations and tasting", () => {
  const base = { lowGain: 1, midGain: 1, highGain: 1, cutoffHz: 32 };

  it("the oven's notch on the burnt overtone gives the dish back", () => {
    const x = sourceSamples(ingredient("Lettuce"));
    const hz = overtoneBetweenHarmonics(x);
    const burnt = bakeInOven(x, hz, 0.8, { ...base, fs: 64, notchActive: false });
    const notched = bakeInOven(x, hz, 0.8, { ...base, fs: 64, notchActive: true, notchHz: hz });
    expect(burnt.aliased).toBe(false);
    expect(tasteCompare(x, notched.output).match).toBeGreaterThan(95);
    expect(tasteCompare(x, burnt.output).match).toBeLessThan(80);
  });

  it("sampling the oven below the Nyquist rate aliases the dish", () => {
    const x = sourceSamples(ingredient("Lettuce"));
    const hz = overtoneBetweenHarmonics(x);
    const low = bakeInOven(x, hz, 0.8, { ...base, fs: 12, notchActive: true, notchHz: hz });
    expect(low.aliased).toBe(true);
    expect(low.nyquistRate).toBeGreaterThan(12);
    expect(tasteCompare(x, low.output).match).toBeLessThan(60);
  });

  it("a cart notch on the road tone keeps the dish; the sensor aliases a slow rate", () => {
    const x = sourceSamples(ingredient("Tomato"));
    const roadHz = 2000;
    const notch = deliverOnPlaygroundCart(x, {
      preset: "notch",
      poleRadius: 0.9,
      omega: (2 * Math.PI * roadHz) / DELIVERY_FS,
      roadHz,
      roadAmp: 0.8,
      sensorFs: DELIVERY_FS,
    });
    expect(notch.stable).toBe(true);
    expect(notch.roadGain).toBeLessThan(0.01);
    expect(notch.dishGain).toBeCloseTo(1, 6);
    expect(notch.accuracy).toBeGreaterThan(95);
    const slow = deliverOnPlaygroundCart(x, {
      preset: "lowpass1",
      poleRadius: 0.9,
      omega: 0,
      roadHz,
      roadAmp: 0.8,
      sensorFs: 3000,
    });
    expect(slow.sensedOmega).toBeCloseTo((2 * Math.PI * 1000) / 3000, 9); // 2000 Hz folds to 1000 Hz
  });

  it("tasting a dish against itself is a perfect score on every metric", () => {
    const x = sourceSamples(ingredient("Cheese"));
    const t = tasteCompare(x, x);
    expect(t.match).toBe(100);
    expect(t.correlation).toBeCloseTo(1, 6);
    expect(t.spectral).toBeCloseTo(1, 6);
    expect(t.dishScore).toBeCloseTo(100, 6);
  });

  it("the full chain at a recipe's own dials reproduces its reference dish", () => {
    for (const recipe of recipes) {
      const d = targetDials(recipe);
      const on = runFullChain(recipe, d);
      const off = runFullChain(recipe, { ...d, oven: false, cart: false });
      expect(on.match).toBeGreaterThan(98);
      expect(off.match).toBeLessThan(on.match - 20);
    }
  });
});
