/**
 * The finishing stations have a real job: the Precision Oven must remove the
 * burnt overtone and the delivery cart must reject the road vibration, and
 * doing so (or not) shows up in how close the dish is to the target.
 */
import { describe, expect, it } from "vitest";

import {
  deliverOnCart,
  dishFundamental,
  ovenDefectHz,
  roadOmega,
  sensedRoadOmega,
  servedDish,
} from "@/lib/delivery";
import { computeSignalSimilarity } from "@/lib/dsp";
import { getIdealDishSignal } from "@/lib/pipeline";
import {
  applyOvenToDish,
  computeDiscreteSignalFFT,
  computeSignalIFFT,
  findMaxSignalFrequency,
  tuneOvenFrequencies,
} from "@/lib/precision-oven-dsp";
import { recipes } from "@/lib/recipes";
import { systemPolesZeros } from "@/lib/z-system";

const ids = recipes.map((r) => [r.id] as const);

describe("burnt overtone (Precision Oven)", () => {
  it.each(ids)("%s: overtone is reachable by the notch and sits between harmonics", (id) => {
    const f0 = dishFundamental(getIdealDishSignal(id).samples);
    const d = ovenDefectHz(id);
    expect(d).toBeGreaterThanOrEqual(10);
    expect(d).toBeLessThanOrEqual(28);
    const nearestHarmonic = Math.round(d / f0) * f0;
    expect(Math.abs(d - nearestHarmonic)).toBeGreaterThanOrEqual(1);
  });

  it.each(ids)("%s: notching the overtone clearly improves the dish", (id) => {
    const dish = getIdealDishSignal(id).samples;
    const served = servedDish(id, dish);
    const spec = computeDiscreteSignalFFT(served, 64);
    const rebuild = (notchActive: boolean) => {
      const t = tuneOvenFrequencies(spec, {
        lowGain: 1,
        midGain: 1,
        highGain: 1,
        cutoffHz: 32,
        notchActive,
        notchHz: Math.round(ovenDefectHz(id)),
      });
      return computeSignalSimilarity(
        computeSignalIFFT(t.tunedReal, t.tunedImag, dish.length, 64),
        dish,
      );
    };
    const untouched = rebuild(false);
    const notched = rebuild(true);
    expect(notched).toBeGreaterThanOrEqual(88);
    expect(notched - untouched).toBeGreaterThanOrEqual(20);
  });
});

describe("road vibration (System Delivery)", () => {
  it.each(ids)(
    "%s: a notch on the vibration beats a mis-aimed notch and an unstable cart",
    (id) => {
      const dish = getIdealDishSignal(id).samples;
      const acc = (preset: "notch" | "resonator2" | "lowpass1", r: number, w: number) =>
        deliverOnCart(id, dish, systemPolesZeros(preset, r, w)).accuracy;
      const onTarget = acc("notch", 0.85, roadOmega(id));
      const doNothing = acc("lowpass1", 0, 0);
      const unstable = acc("resonator2", 1.05, 1);
      expect(onTarget).toBeGreaterThanOrEqual(90);
      expect(onTarget - doNothing).toBeGreaterThanOrEqual(15);
      expect(unstable).toBeLessThan(50);
    },
  );

  it("a slow sensor reports the vibration at the wrong frequency", () => {
    for (const { id } of recipes) {
      expect(sensedRoadOmega(id, 8000)).toBeCloseTo(roadOmega(id), 10);
      expect(Math.abs(sensedRoadOmega(id, 1200) - roadOmega(id))).toBeGreaterThan(0.1);
    }
  });
});

describe("a perfect finish serves the convolved dish", () => {
  // Oven at the minimum safe rate with the notch on the overtone, then a cart
  // notched on the road: what reaches the table must look and sound like
  // the Cooking lab's output. (The oven used to rebuild the dish from its fs
  // samples, losing everything above fs/2, and the cart started from rest,
  // leaving a transient worth up to ~100 % of the peak at the start.)
  it.each(ids)("%s", (id) => {
    const cooked = getIdealDishSignal(id).samples;
    const served = servedDish(id, cooked);
    const fs = 2 * findMaxSignalFrequency(served);
    const oven = applyOvenToDish(served, fs, {
      lowGain: 1,
      midGain: 1,
      highGain: 1,
      cutoffHz: Math.min(26, Math.round(fs / 2)),
      notchActive: true,
      notchHz: ovenDefectHz(id),
    });
    const final = deliverOnCart(id, oven, systemPolesZeros("notch", 0.85, roadOmega(id))).served;

    const peak = Math.max(...cooked.map(Math.abs));
    const worst = Math.max(...final.map((v, i) => Math.abs(v - cooked[i]!)));
    expect(computeSignalSimilarity(final, cooked)).toBeGreaterThanOrEqual(97);
    expect(worst / peak).toBeLessThan(0.15);
  });
});
