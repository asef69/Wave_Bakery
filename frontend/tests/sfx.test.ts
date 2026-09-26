/**
 * Sound effects are audio only: one reused element per cooking method, it
 * plays while dragging and stops on release, and a click plays once per
 * button activation.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

class FakeAudio {
  static created: FakeAudio[] = [];
  src: string;
  loop = false;
  preload = "";
  volume = 1;
  paused = true;
  currentTime = 0;
  constructor(src: string) {
    this.src = src;
    FakeAudio.created.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = globalThis;
  g.Audio = FakeAudio;
});

afterEach(async () => {
  const { stopCookingSfx } = await import("@/lib/sfx");
  stopCookingSfx();
  vi.useRealTimers();
});

describe("cooking sound effects", () => {
  it("each method has its own file", async () => {
    const sfx = await import("@/lib/sfx");
    const files = [sfx.COOKING_SFX, sfx.BOILING_SFX, sfx.BAKING_SFX, sfx.GRILLING_SFX];
    expect(files.every((f) => f.length > 0)).toBe(true);
    expect(new Set(files).size).toBe(4);
  });

  it("dragging plays the method's sound, reusing one element, and release stops it", async () => {
    const { startCookingSfx, stopCookingSfx, GRILLING_SFX } = await import("@/lib/sfx");
    for (let i = 0; i < 50; i++) startCookingSfx("grill"); // many drag events
    const grill = FakeAudio.created.filter((a) => a.src === GRILLING_SFX);
    expect(grill).toHaveLength(1);
    expect(grill[0]!.paused).toBe(false);
    expect(grill[0]!.loop).toBe(true);
    stopCookingSfx();
    expect(grill[0]!.paused).toBe(true);
  });

  it("switching method stops the previous sound", async () => {
    const { startCookingSfx, BAKING_SFX, BOILING_SFX } = await import("@/lib/sfx");
    startCookingSfx("bake");
    startCookingSfx("boil");
    const bake = FakeAudio.created.find((a) => a.src === BAKING_SFX)!;
    const boil = FakeAudio.created.find((a) => a.src === BOILING_SFX)!;
    expect(bake.paused).toBe(true);
    expect(boil.paused).toBe(false);
  });

  it("a keyboard nudge plays briefly, then stops by itself", async () => {
    vi.useFakeTimers();
    const { nudgeCookingSfx, COOKING_SFX } = await import("@/lib/sfx");
    nudgeCookingSfx("fry");
    const fry = FakeAudio.created.find((a) => a.src === COOKING_SFX)!;
    expect(fry.paused).toBe(false);
    vi.advanceTimersByTime(400);
    expect(fry.paused).toBe(true);
  });
});

describe("sound settings (Settings page)", () => {
  it("sound off silences the cooking sounds; volume scales them", async () => {
    const { setSoundSettings } = await import("@/lib/sound");
    const { startCookingSfx, stopCookingSfx, GRILLING_SFX } = await import("@/lib/sfx");
    const store = new Map<string, string>();
    (globalThis as unknown as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    (globalThis as unknown as Record<string, unknown>).dispatchEvent = () => true;
    stopCookingSfx();
    setSoundSettings({ soundEnabled: false });
    startCookingSfx("grill");
    const grill = FakeAudio.created.find((a) => a.src === GRILLING_SFX)!;
    expect(grill.paused).toBe(true);
    setSoundSettings({ soundEnabled: true, volume: 50 });
    startCookingSfx("grill");
    expect(grill.paused).toBe(false);
    expect(grill.volume).toBeCloseTo(0.45 * 0.5, 5);
    stopCookingSfx();
  });
});
