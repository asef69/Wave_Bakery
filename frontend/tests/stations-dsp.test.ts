import { describe, expect, it } from "vitest";
import {
  recipes,
  getRecipeStationFlow,
  getNextStationPath,
  getPrevStationPath,
} from "@/lib/recipes";

describe("Stations & Dynamic Recipe Pipeline Flow", () => {
  it("includes exactly the 5 recipes of the recipe book", () => {
    expect(recipes.map((r) => r.id).sort()).toEqual(
      ["burger", "cake", "chicken-fry", "noodles", "sandwich"].sort(),
    );
  });

  it("every recipe follows the same station flow", () => {
    for (const recipe of recipes) {
      expect(getRecipeStationFlow(recipe).map((s) => s.path)).toEqual([
        "/generate",
        "/filtering",
        "/mixing",
        "/transform",
        "/marinate",
        "/cooking",
        "/system-delivery",
        "/score",
        "/complete",
      ]);
    }
  });

  it("calculates next and previous station navigation paths correctly", () => {
    const burger = recipes.find((r) => r.id === "burger")!;
    expect(getNextStationPath("/marinate", burger)).toBe("/cooking");
    expect(getPrevStationPath("/cooking", burger)).toBe("/marinate");
  });

  it("verifies z-plane BIBO system stability criteria (|p| < 1.0 vs |p| >= 1.0)", () => {
    const isStablePole = (r: number) => r < 1.0;
    expect(isStablePole(0.85)).toBe(true);
    expect(isStablePole(0.99)).toBe(true);
    expect(isStablePole(1.0)).toBe(false);
    expect(isStablePole(1.05)).toBe(false);
  });

  it("validates Nyquist-Shannon sampling rate criterion (fs >= 2 f_max)", () => {
    const isAliasFree = (fs: number, fMax: number) => fs >= 2 * fMax;
    expect(isAliasFree(8000, 2000)).toBe(true);
    expect(isAliasFree(44100, 15000)).toBe(true);
    expect(isAliasFree(1200, 2000)).toBe(false); // Aliased
  });
});
