/**
 * Contract test: the exact output of Filtering must become the exact input
 * of Mixing — no regeneration, no fallback to a freshly-synthesized
 * "clean" ingredient signal once a filtered result has been saved.
 *
 * vitest runs in a plain "node" environment (no window/localStorage), so a
 * minimal in-memory localStorage polyfill is installed before the modules
 * under test are imported, since saveFilteredIngredient/getFilteredIngredient
 * gate on `typeof window !== "undefined"`.
 */
import { beforeAll, describe, expect, it } from "vitest";

function installLocalStorageStub() {
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
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: unknown }).localStorage = localStorageStub;
  (globalThis as unknown as { location: unknown }).location = { port: "" };
}

describe("Filtering -> Mixing signal handoff contract", () => {
  beforeAll(() => {
    installLocalStorageStub();
  });

  it("mixing uses the exact saved filtered samples for a washable ingredient, not a regenerated clean signal", async () => {
    const {
      saveFilteredIngredient,
      getFilteredIngredient,
      computeMixedSignal,
      getRecipeIngredientSamples,
    } = await import("@/lib/pipeline");
    const { recipes } = await import("@/lib/recipes");

    const burger = recipes.find((r) => r.id === "burger")!;
    const sampleCount = 401;

    // A distinctive filtered result that could not be mistaken for the
    // regenerated "clean" Lettuce signal (a smooth periodic ripple).
    const distinctiveFiltered = Array.from({ length: sampleCount }, (_, i) =>
      i % 2 === 0 ? 0.777 : -0.777,
    );

    saveFilteredIngredient(burger.id, "Lettuce", distinctiveFiltered);
    expect(getFilteredIngredient(burger.id, "Lettuce")).toEqual(distinctiveFiltered);

    const regeneratedClean = getRecipeIngredientSamples(burger.id, "Lettuce", {
      noise: 0,
      sampleCount,
    });

    const mixedSingle = computeMixedSignal(burger.id, ["Lettuce"], sampleCount);

    // Must equal the saved filtered output exactly (single-ingredient mix is
    // a passthrough), and must NOT match a freshly regenerated clean signal.
    for (let i = 0; i < sampleCount; i++) {
      expect(mixedSingle.samples[i]).toBeCloseTo(distinctiveFiltered[i]!, 5);
    }
    const matchesRegenerated = mixedSingle.samples.every(
      (v, i) => Math.abs(v - (regeneratedClean[i] ?? 0)) < 1e-6,
    );
    expect(matchesRegenerated).toBe(false);
  });

  it("mixing multiple ingredients sums each ingredient's saved filtered output, not a regenerated one", async () => {
    const { saveFilteredIngredient, computeMixedSignal } = await import("@/lib/pipeline");
    const { recipes } = await import("@/lib/recipes");

    const burger = recipes.find((r) => r.id === "burger")!;
    const sampleCount = 401;

    const lettuceFiltered = new Array(sampleCount).fill(0.5);
    const tomatoFiltered = new Array(sampleCount).fill(-0.25);
    saveFilteredIngredient(burger.id, "Lettuce", lettuceFiltered);
    saveFilteredIngredient(burger.id, "Tomato", tomatoFiltered);

    const mixed = computeMixedSignal(burger.id, ["Lettuce", "Tomato"], sampleCount);

    // Superposition of two constant signals, 1/sqrt(2) normalized, before
    // final peak normalization: (0.5 + -0.25) / sqrt(2) = 0.1767..., which
    // normalizeSamples leaves untouched since |0.1767| < 0.95 peak target.
    const expected = (0.5 + -0.25) / Math.sqrt(2);
    for (const v of mixed.samples) {
      expect(v).toBeCloseTo(expected, 4);
    }
  });
});
