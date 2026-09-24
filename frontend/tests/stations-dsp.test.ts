import { describe, expect, it } from "vitest";
import {
  recipes,
  getRecipeStationFlow,
  getNextStationPath,
  getPrevStationPath,
} from "@/lib/recipes";

describe("Stations & Dynamic Recipe Pipeline Flow", () => {
  it("includes all 5 canonical recipes with metadata", () => {
    expect(recipes.length).toBeGreaterThanOrEqual(5);
    const ids = recipes.map((r) => r.id);
    expect(ids).toContain("burger");
    expect(ids).toContain("soup");
    expect(ids).toContain("salad");
    expect(ids).toContain("creme");
    expect(ids).toContain("feast");
  });

  it("dynamically generates recipe station flow including chop and caramelize", () => {
    const salad = recipes.find((r) => r.id === "salad")!;
    const creme = recipes.find((r) => r.id === "creme")!;
    const feast = recipes.find((r) => r.id === "feast")!;

    const saladFlow = getRecipeStationFlow(salad).map((s) => s.path);
    expect(saladFlow).toContain("/chop");

    const cremeFlow = getRecipeStationFlow(creme).map((s) => s.path);
    expect(cremeFlow).toContain("/caramelize");

    const feastFlow = getRecipeStationFlow(feast).map((s) => s.path);
    expect(feastFlow).toContain("/caramelize");
    expect(feastFlow).toContain("/chop");
  });

  it("calculates next and previous station navigation paths correctly", () => {
    const salad = recipes.find((r) => r.id === "salad")!;
    const nextAfterMarinate = getNextStationPath("/marinate", salad);
    expect(nextAfterMarinate).toBe("/chop");

    const prevBeforeChop = getPrevStationPath("/chop", salad);
    expect(prevBeforeChop).toBe("/marinate");

    const creme = recipes.find((r) => r.id === "creme")!;
    const nextAfterMarinateCreme = getNextStationPath("/marinate", creme);
    expect(nextAfterMarinateCreme).toBe("/caramelize");
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
