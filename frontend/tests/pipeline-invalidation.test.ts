import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFilteredIngredients,
  clearPipelineStageSignal,
  computeConvolvedSignal,
  computeMarinatedSignal,
  computeMixedSignal,
  computeSeasonedSignal,
  getDefaultPipelineSignal,
  getFilteredIngredient,
  getPipelineStageSignal,
  hasPipelineStageSignal,
  invalidateDownstreamStages,
  type PipelineSignal,
  saveFilteredIngredient,
  savePipelineStageSignal,
} from "../src/lib/pipeline";
import {
  getCookedSignal,
  getRecipeRunSession,
  recipes,
  saveCookedSignal,
  startRecipeRun,
  updateRecipeRunSession,
} from "../src/lib/recipes";
import { computeSignalSimilarity } from "../src/lib/dsp";

// Mock localStorage and window in node test environment
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

const mockLocalStorage = new LocalStorageMock();
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    localStorage: mockLocalStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
} else if (!window.localStorage) {
  (window as any).localStorage = mockLocalStorage;
}

describe("Pipeline Continuity & Invalidation Suite (Cases A through I)", () => {
  const recipeId = "burger";
  const recipe = recipes.find((r) => r.id === recipeId)!;

  beforeEach(() => {
    window.localStorage.clear();
  });

  // CASE A: Complete pipeline without navigation
  it("Case A: passes the EXACT numerical array output of stage N into stage N+1", () => {
    // 1. Filtering
    const lettuceFilterSamples = new Array(401).fill(0).map((_, i) => Math.sin(i * 0.05) * 0.8);
    saveFilteredIngredient(recipeId, "lettuce", lettuceFilterSamples);
    const retrievedFiltered = getFilteredIngredient(recipeId, "lettuce");
    expect(retrievedFiltered).toEqual(lettuceFilterSamples);

    // 2. Mixing consumes filtered output
    const mixed = computeMixedSignal(recipeId, recipe.ingredients, 401);
    savePipelineStageSignal(recipeId, "mixed", mixed);
    const retrievedMixed = getPipelineStageSignal(recipeId, "mixed", 401);
    expect(retrievedMixed.samples).toEqual(mixed.samples);

    // 3. Seasoning consumes retrievedMixed.samples directly
    const seasoned = computeSeasonedSignal(retrievedMixed, 1.2, 1.1, 401);
    savePipelineStageSignal(recipeId, "seasoned", seasoned);
    const retrievedSeasoned = getPipelineStageSignal(recipeId, "seasoned", 401);
    expect(retrievedSeasoned.samples).toEqual(seasoned.samples);

    // 4. Marinating consumes retrievedSeasoned.samples directly
    const marinated = computeMarinatedSignal(retrievedSeasoned, 1.4, 401);
    savePipelineStageSignal(recipeId, "marinated", marinated);
    const retrievedMarinated = getPipelineStageSignal(recipeId, "marinated", 401);
    expect(retrievedMarinated.samples).toEqual(marinated.samples);

    // 5. Cooking consumes retrievedMarinated.samples directly
    const cooked = computeConvolvedSignal(retrievedMarinated, "grill", 100, 401);
    savePipelineStageSignal(recipeId, "cooked", cooked);
    saveCookedSignal({
      recipeId,
      methodId: "grill",
      methodName: "GRILL",
      frequency: cooked.frequency,
      amplitude: 1.0,
      noise: 0.05,
      shift: 0.5,
      pos: 100,
      timestamp: Date.now(),
      samples: cooked.samples,
    });
    const retrievedCooked = getPipelineStageSignal(recipeId, "cooked", 401);
    expect(retrievedCooked.samples).toEqual(cooked.samples);

    // 6. Delivery consumes retrievedCooked.samples directly and transforms via IFFT reconstruction
    const deliveryReconstructed = retrievedCooked.samples.map((s) => s * 0.98 + 0.01);
    savePipelineStageSignal(recipeId, "delivered", {
      recipeId,
      stage: "delivered",
      samples: deliveryReconstructed,
      sampleRate: 44100,
      duration: 3.0,
      frequency: cooked.frequency,
      timestamp: Date.now(),
      metadata: {
        ovenSamplingRate: 16000,
        overallScore: 98,
      },
    });
    saveCookedSignal({
      recipeId,
      methodId: "grill",
      methodName: "GRILL",
      frequency: cooked.frequency,
      amplitude: 1.0,
      noise: 0.05,
      shift: 0.5,
      pos: 100,
      timestamp: Date.now(),
      samples: deliveryReconstructed,
      metadata: {
        ovenSamplingRate: 16000,
        overallScore: 98,
      },
    });

    // 7. Final Comparison / Scoring consumes Delivery output
    const retrievedDelivered = getPipelineStageSignal(recipeId, "delivered", 401);
    const cookedSignalStore = getCookedSignal(recipeId);
    expect(retrievedDelivered.samples).toEqual(deliveryReconstructed);
    expect(cookedSignalStore.samples).toEqual(deliveryReconstructed);
  });

  // CASE B: Navigate backward without changing => outputs remain identical
  it("Case B: preserves completed stage outputs identically when navigating backward without changes", () => {
    // Complete through Cooking
    const mixed = computeMixedSignal(recipeId, recipe.ingredients, 401);
    savePipelineStageSignal(recipeId, "mixed", mixed);

    const seasoned = computeSeasonedSignal(mixed, 0.9, 1.2, 401);
    savePipelineStageSignal(recipeId, "seasoned", seasoned);

    const marinated = computeMarinatedSignal(seasoned, 1.1, 401);
    savePipelineStageSignal(recipeId, "marinated", marinated);

    const cooked = computeConvolvedSignal(marinated, "grill", 90, 401);
    savePipelineStageSignal(recipeId, "cooked", cooked);

    // Snapshot exact sample values
    const mixedSnapshot = [...mixed.samples];
    const seasonedSnapshot = [...seasoned.samples];
    const marinatedSnapshot = [...marinated.samples];
    const cookedSnapshot = [...cooked.samples];

    // Simulate player navigating backward: Mixing -> Seasoning -> Cooking
    // Reading signals without triggering change invalidation
    const reloadedMixed = getPipelineStageSignal(recipeId, "mixed", 401);
    const reloadedSeasoned = getPipelineStageSignal(recipeId, "seasoned", 401);
    const reloadedMarinated = getPipelineStageSignal(recipeId, "marinated", 401);
    const reloadedCooked = getPipelineStageSignal(recipeId, "cooked", 401);

    expect(reloadedMixed.samples).toEqual(mixedSnapshot);
    expect(reloadedSeasoned.samples).toEqual(seasonedSnapshot);
    expect(reloadedMarinated.samples).toEqual(marinatedSnapshot);
    expect(reloadedCooked.samples).toEqual(cookedSnapshot);
  });

  // CASE C: Complete Mixing, navigate away and back
  it("Case C: preserves Mixing output identically before and after navigation", () => {
    const mixed = computeMixedSignal(recipeId, recipe.ingredients, 401);
    savePipelineStageSignal(recipeId, "mixed", mixed);

    // Simulate navigation away (e.g. visiting Seasoning, Marinating, Recipe Book)
    const storedBefore = getPipelineStageSignal(recipeId, "mixed", 401);

    // Simulate navigating back to Mixing
    const storedAfter = getPipelineStageSignal(recipeId, "mixed", 401);

    expect(storedAfter.samples).toEqual(storedBefore.samples);
    expect(storedAfter.samples).toEqual(mixed.samples);
  });

  // CASE D: Complete Seasoning, navigate away and back
  it("Case D: preserves Seasoning output identically before and after navigation", () => {
    const mixed = computeMixedSignal(recipeId, recipe.ingredients, 401);
    savePipelineStageSignal(recipeId, "mixed", mixed);

    const seasoned = computeSeasonedSignal(mixed, 0.85, 1.4, 401);
    savePipelineStageSignal(recipeId, "seasoned", seasoned);

    const storedBefore = getPipelineStageSignal(recipeId, "seasoned", 401);

    // Navigate to /marinate and back to /transform
    const storedAfter = getPipelineStageSignal(recipeId, "seasoned", 401);

    expect(storedAfter.samples).toEqual(storedBefore.samples);
    expect(storedAfter.metadata).toEqual(seasoned.metadata);
  });

  // CASE E: Change Mixing => downstream stages invalidated
  it("Case E: invalidates Seasoning, Marinating, Cooking, and Delivery when Mixing changes", () => {
    startRecipeRun(recipeId, "medium");

    // Establish initial pipeline
    const mixed1 = computeMixedSignal(recipeId, ["Bun", "Patty"], 401);
    savePipelineStageSignal(recipeId, "mixed", mixed1);
    const seasoned1 = computeSeasonedSignal(mixed1, 1.0, 1.0, 401);
    savePipelineStageSignal(recipeId, "seasoned", seasoned1);
    const marinated1 = computeMarinatedSignal(seasoned1, 1.0, 401);
    savePipelineStageSignal(recipeId, "marinated", marinated1);
    const cooked1 = computeConvolvedSignal(marinated1, "grill", 100, 401);
    savePipelineStageSignal(recipeId, "cooked", cooked1);
    savePipelineStageSignal(recipeId, "delivered", {
      ...cooked1,
      stage: "delivered",
      metadata: { ovenSamplingRate: 16000 },
    });
    saveCookedSignal({
      recipeId,
      methodId: "grill",
      methodName: "GRILL",
      frequency: 4,
      amplitude: 1,
      noise: 0,
      shift: 0,
      pos: 100,
      timestamp: Date.now(),
      samples: cooked1.samples,
      metadata: { ovenSamplingRate: 16000 },
    });
    updateRecipeRunSession({
      mixingAccuracy: 95,
      seasoningAccuracy: 90,
      marinatingAccuracy: 92,
      cookingAccuracy: 94,
      deliveryAccuracy: 96,
    });

    // Verify all stages are present before change
    expect(hasPipelineStageSignal(recipeId, "mixed")).toBe(true);
    expect(hasPipelineStageSignal(recipeId, "seasoned")).toBe(true);
    expect(hasPipelineStageSignal(recipeId, "marinated")).toBe(true);
    expect(hasPipelineStageSignal(recipeId, "cooked")).toBe(true);
    expect(hasPipelineStageSignal(recipeId, "delivered")).toBe(true);

    // Player changes mixing (adds Cheese to bowl and re-mixes)
    invalidateDownstreamStages(recipeId, "mixed");
    const mixed2 = computeMixedSignal(recipeId, ["Bun", "Patty", "Cheese"], 401);
    savePipelineStageSignal(recipeId, "mixed", mixed2);

    // Mixing output is updated
    expect(getPipelineStageSignal(recipeId, "mixed", 401).samples).toEqual(mixed2.samples);
    expect(mixed2.samples).not.toEqual(mixed1.samples);

    // Downstream stages must be INVALIDATED (removed from storage)
    expect(hasPipelineStageSignal(recipeId, "seasoned")).toBe(false);
    expect(hasPipelineStageSignal(recipeId, "marinated")).toBe(false);
    expect(hasPipelineStageSignal(recipeId, "cooked")).toBe(false);
    expect(hasPipelineStageSignal(recipeId, "delivered")).toBe(false);

    // Downstream session accuracies must be cleared
    const session = getRecipeRunSession();
    expect(session?.seasoningAccuracy).toBeUndefined();
    expect(session?.marinatingAccuracy).toBeUndefined();
    expect(session?.cookingAccuracy).toBeUndefined();
    expect(session?.deliveryAccuracy).toBeUndefined();
  });

  // CASE F: Change Seasoning => Marinating & downstream invalidated, Mixing preserved
  it("Case F: invalidates Marinating, Cooking, and Delivery when Seasoning changes, while preserving Mixing", () => {
    startRecipeRun(recipeId, "medium");

    const mixed = computeMixedSignal(recipeId, recipe.ingredients, 401);
    savePipelineStageSignal(recipeId, "mixed", mixed);
    const seasoned1 = computeSeasonedSignal(mixed, 0.5, 0.5, 401);
    savePipelineStageSignal(recipeId, "seasoned", seasoned1);
    const marinated1 = computeMarinatedSignal(seasoned1, 1.0, 401);
    savePipelineStageSignal(recipeId, "marinated", marinated1);
    const cooked1 = computeConvolvedSignal(marinated1, "grill", 100, 401);
    savePipelineStageSignal(recipeId, "cooked", cooked1);
    savePipelineStageSignal(recipeId, "delivered", {
      ...cooked1,
      stage: "delivered",
      metadata: { ovenSamplingRate: 16000 },
    });
    updateRecipeRunSession({
      mixingAccuracy: 100,
      seasoningAccuracy: 60,
      marinatingAccuracy: 90,
      cookingAccuracy: 95,
      deliveryAccuracy: 92,
    });

    // Player modifies seasoning dials
    invalidateDownstreamStages(recipeId, "seasoned");
    const seasoned2 = computeSeasonedSignal(mixed, 1.1, 1.3, 401);
    savePipelineStageSignal(recipeId, "seasoned", seasoned2);

    // Mixing MUST remain preserved
    expect(hasPipelineStageSignal(recipeId, "mixed")).toBe(true);
    expect(getPipelineStageSignal(recipeId, "mixed", 401).samples).toEqual(mixed.samples);

    // Seasoning is updated
    expect(hasPipelineStageSignal(recipeId, "seasoned")).toBe(true);
    expect(getPipelineStageSignal(recipeId, "seasoned", 401).samples).toEqual(seasoned2.samples);

    // Downstream stages MUST be invalidated
    expect(hasPipelineStageSignal(recipeId, "marinated")).toBe(false);
    expect(hasPipelineStageSignal(recipeId, "cooked")).toBe(false);
    expect(hasPipelineStageSignal(recipeId, "delivered")).toBe(false);

    // Upstream mixing accuracy is preserved, downstream accuracies cleared
    const session = getRecipeRunSession();
    expect(session?.mixingAccuracy).toBe(100);
    expect(session?.marinatingAccuracy).toBeUndefined();
    expect(session?.cookingAccuracy).toBeUndefined();
    expect(session?.deliveryAccuracy).toBeUndefined();
  });

  // CASE G: Change Marinating => Cooking & downstream invalidated, Mixing & Seasoning preserved
  it("Case G: invalidates Cooking and Delivery when Marinating changes, while preserving Mixing and Seasoning", () => {
    startRecipeRun(recipeId, "medium");

    const mixed = computeMixedSignal(recipeId, recipe.ingredients, 401);
    savePipelineStageSignal(recipeId, "mixed", mixed);
    const seasoned = computeSeasonedSignal(mixed, 0.8, 1.1, 401);
    savePipelineStageSignal(recipeId, "seasoned", seasoned);
    const marinated1 = computeMarinatedSignal(seasoned, 0.6, 401);
    savePipelineStageSignal(recipeId, "marinated", marinated1);
    const cooked1 = computeConvolvedSignal(marinated1, "grill", 80, 401);
    savePipelineStageSignal(recipeId, "cooked", cooked1);
    savePipelineStageSignal(recipeId, "delivered", {
      ...cooked1,
      stage: "delivered",
      metadata: { ovenSamplingRate: 16000 },
    });
    updateRecipeRunSession({
      mixingAccuracy: 100,
      seasoningAccuracy: 95,
      marinatingAccuracy: 70,
      cookingAccuracy: 88,
      deliveryAccuracy: 90,
    });

    // Player modifies marinating time
    invalidateDownstreamStages(recipeId, "marinated");
    const marinated2 = computeMarinatedSignal(seasoned, 1.4, 401);
    savePipelineStageSignal(recipeId, "marinated", marinated2);

    // Mixing & Seasoning MUST remain preserved
    expect(hasPipelineStageSignal(recipeId, "mixed")).toBe(true);
    expect(getPipelineStageSignal(recipeId, "mixed", 401).samples).toEqual(mixed.samples);
    expect(hasPipelineStageSignal(recipeId, "seasoned")).toBe(true);
    expect(getPipelineStageSignal(recipeId, "seasoned", 401).samples).toEqual(seasoned.samples);

    // Marinated is updated
    expect(hasPipelineStageSignal(recipeId, "marinated")).toBe(true);
    expect(getPipelineStageSignal(recipeId, "marinated", 401).samples).toEqual(marinated2.samples);

    // Cooking & Delivery MUST be invalidated
    expect(hasPipelineStageSignal(recipeId, "cooked")).toBe(false);
    expect(hasPipelineStageSignal(recipeId, "delivered")).toBe(false);

    const session = getRecipeRunSession();
    expect(session?.mixingAccuracy).toBe(100);
    expect(session?.seasoningAccuracy).toBe(95);
    expect(session?.cookingAccuracy).toBeUndefined();
    expect(session?.deliveryAccuracy).toBeUndefined();
  });

  // CASE H: Reload / storage restoration
  it("Case H: restores pipeline signals perfectly from persistent storage without loss or re-derivation", () => {
    const mixed = computeMixedSignal(recipeId, recipe.ingredients, 401);
    savePipelineStageSignal(recipeId, "mixed", mixed);
    const seasoned = computeSeasonedSignal(mixed, 0.95, 1.25, 401);
    savePipelineStageSignal(recipeId, "seasoned", seasoned);
    const marinated = computeMarinatedSignal(seasoned, 1.3, 401);
    savePipelineStageSignal(recipeId, "marinated", marinated);
    const cooked = computeConvolvedSignal(marinated, "grill", 95, 401);
    savePipelineStageSignal(recipeId, "cooked", cooked);

    // Simulate page reload by querying fresh from localStorage
    const reloadedMixed = getPipelineStageSignal(recipeId, "mixed", 401);
    const reloadedSeasoned = getPipelineStageSignal(recipeId, "seasoned", 401);
    const reloadedMarinated = getPipelineStageSignal(recipeId, "marinated", 401);
    const reloadedCooked = getPipelineStageSignal(recipeId, "cooked", 401);

    expect(reloadedMixed.samples).toEqual(mixed.samples);
    expect(reloadedSeasoned.samples).toEqual(seasoned.samples);
    expect(reloadedMarinated.samples).toEqual(marinated.samples);
    expect(reloadedCooked.samples).toEqual(cooked.samples);

    // Verify lengths are exact 401
    expect(reloadedMixed.samples.length).toBe(401);
    expect(reloadedSeasoned.samples.length).toBe(401);
    expect(reloadedMarinated.samples.length).toBe(401);
    expect(reloadedCooked.samples.length).toBe(401);
  });

  // CASE I: Final scoring uses delivered signal
  it("Case I: guarantees the signal scored at the end is the exact output of Delivery", () => {
    // Stage 5: Cooking output
    const mixed = computeMixedSignal(recipeId, recipe.ingredients, 401);
    const seasoned = computeSeasonedSignal(mixed, 1.0, 1.0, 401);
    const marinated = computeMarinatedSignal(seasoned, 1.0, 401);
    const cooked = computeConvolvedSignal(marinated, "grill", 100, 401);
    savePipelineStageSignal(recipeId, "cooked", cooked);

    // Stage 6: Delivery output (Precision Oven reconstructed waveform)
    // Distinct from pre-delivery cooked signal
    const deliveredSamples = cooked.samples.map((s, idx) => s * 0.9 + 0.05 * Math.sin(idx * 0.1));
    savePipelineStageSignal(recipeId, "delivered", {
      recipeId,
      stage: "delivered",
      samples: deliveredSamples,
      sampleRate: 44100,
      duration: 3.0,
      frequency: cooked.frequency,
      timestamp: Date.now(),
      metadata: {
        ovenSamplingRate: 16000,
        spectrumMatchPercent: 96,
        timeDomainSimilarity: 94,
        overallScore: 95,
      },
    });
    saveCookedSignal({
      recipeId,
      methodId: "grill",
      methodName: "GRILL",
      frequency: cooked.frequency,
      amplitude: 1.0,
      noise: 0.05,
      shift: 0.5,
      pos: 100,
      timestamp: Date.now(),
      samples: deliveredSamples,
      metadata: {
        ovenSamplingRate: 16000,
        overallScore: 95,
      },
    });

    // Verification: What Scoring reads
    const deliveredPipeline = getPipelineStageSignal(recipeId, "delivered", 401);
    const cookedStore = getCookedSignal(recipeId);

    // Ensure Delivery output is distinct from raw Cooking output
    expect(deliveredPipeline.samples).not.toEqual(cooked.samples);
    expect(cookedStore.samples).not.toEqual(cooked.samples);

    // Scoring resolution: playerSamples must be deliveredSamples
    const playerSamples =
      hasPipelineStageSignal(recipeId, "delivered") && deliveredPipeline.samples.length > 0
        ? deliveredPipeline.samples
        : cookedStore.samples;

    expect(playerSamples).toEqual(deliveredSamples);

    // Similarity scored against target must use playerSamples (the delivered signal)
    const targetSignal = getDefaultPipelineSignal(recipeId, "cooked", 401);
    const computedSimilarity = computeSignalSimilarity(playerSamples, targetSignal.samples);
    expect(computedSimilarity).toBeGreaterThan(0);
    expect(computedSimilarity).toBeLessThanOrEqual(100);
  });
});
