import { describe, expect, it, beforeEach } from "vitest";

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

import {
  BEST_SCORES_KEY,
  enrichRecipeWithBestScore,
  getRecipeBestScore,
  getRecipeBestScores,
  recipes,
  resetRecipeProgress,
  saveRecipeBestScore,
  startRecipeRun,
} from "@/lib/recipes";

describe("Recipe Progression, Score Persistence & State Isolation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("initializes recipes with null bestScore and 'new' progress when unplayed", () => {
    for (const r of recipes) {
      const enriched = enrichRecipeWithBestScore(r);
      expect(enriched.bestScore).toBeNull();
      expect(enriched.stars).toBe(0);
      expect(enriched.progress).toBe("new");
    }
  });

  it("persists best scores independently per recipe", () => {
    // Save score for burger
    saveRecipeBestScore("burger", 850);
    expect(getRecipeBestScore("burger")).toBe(850);
    expect(getRecipeBestScore("sandwich")).toBeNull();
    expect(getRecipeBestScore("cake")).toBeNull();

    // Save score for sandwich
    saveRecipeBestScore("sandwich", 920);
    expect(getRecipeBestScore("burger")).toBe(850);
    expect(getRecipeBestScore("sandwich")).toBe(920);

    // Save score for cake
    saveRecipeBestScore("cake", 780);
    expect(getRecipeBestScore("burger")).toBe(850);
    expect(getRecipeBestScore("sandwich")).toBe(920);
    expect(getRecipeBestScore("cake")).toBe(780);
  });

  it("updates score if newly achieved score is higher, preserves if lower", () => {
    saveRecipeBestScore("burger", 800);
    expect(getRecipeBestScore("burger")).toBe(800);

    // Lower score achieved
    const kept = saveRecipeBestScore("burger", 750);
    expect(kept).toBe(800);
    expect(getRecipeBestScore("burger")).toBe(800);

    // Higher score achieved
    const updated = saveRecipeBestScore("burger", 950);
    expect(updated).toBe(950);
    expect(getRecipeBestScore("burger")).toBe(950);
  });

  it("enriches recipe with dynamic stars and progress based on score", () => {
    const burger = recipes.find((r) => r.id === "burger")!;

    // No score
    const unplayed = enrichRecipeWithBestScore(burger);
    expect(unplayed.bestScore).toBeNull();
    expect(unplayed.stars).toBe(0);
    expect(unplayed.progress).toBe("new");

    // Moderate score (750)
    saveRecipeBestScore("burger", 750);
    const midPlayed = enrichRecipeWithBestScore(burger);
    expect(midPlayed.bestScore).toBe(750);
    expect(midPlayed.stars).toBe(2);
    expect(midPlayed.progress).toBe("in-progress");

    // High score (940)
    saveRecipeBestScore("burger", 940);
    const highPlayed = enrichRecipeWithBestScore(burger);
    expect(highPlayed.bestScore).toBe(940);
    expect(highPlayed.stars).toBe(3);
    expect(highPlayed.progress).toBe("complete");
  });

  it("isolates transient recipe run state without clearing persistent best scores", () => {
    saveRecipeBestScore("burger", 940);
    saveRecipeBestScore("sandwich", 880);

    // Set some transient stage signals
    window.localStorage.setItem("wavebakery_selected_ingredients_burger", JSON.stringify(["Bun", "Beef Patty"]));
    window.localStorage.setItem("wavebakery_filtered_ingredients_burger", JSON.stringify({ lettuce: [1, 2, 3] }));
    window.localStorage.setItem("wavebakery_pipeline_burger_mixed", JSON.stringify({ samples: [0.1, 0.2] }));

    // Start a fresh recipe run for burger
    startRecipeRun("burger", "easy");

    // Transient signals for burger should be cleared
    expect(window.localStorage.getItem("wavebakery_selected_ingredients_burger")).toBeNull();
    expect(window.localStorage.getItem("wavebakery_filtered_ingredients_burger")).toBeNull();
    expect(window.localStorage.getItem("wavebakery_pipeline_burger_mixed")).toBeNull();

    // Persistent best scores must NOT be cleared!
    expect(getRecipeBestScore("burger")).toBe(940);
    expect(getRecipeBestScore("sandwich")).toBe(880);
  });
});
