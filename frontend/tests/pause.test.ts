import { beforeEach, describe, expect, it, vi } from "vitest";

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
const globalWithWindow = globalThis as unknown as { window?: unknown };
if (typeof globalWithWindow.window === "undefined") {
  globalWithWindow.window = {
    localStorage: mockLocalStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { pathname: "/transform" },
  };
} else if (!window.localStorage) {
  (window as unknown as { localStorage: Storage }).localStorage =
    mockLocalStorage as unknown as Storage;
}

import {
  DIFFICULTY_CONFIGS,
  type RecipeDifficulty,
  startRecipeRun,
  pauseRecipeRun,
  resumeRecipeRun,
  resetRecipeTimerToFull,
  resetCurrentStage,
  getRecipeRunSession,
} from "@/lib/recipes";
import {
  getSoundSettings,
  setSoundSettings,
  SOUND_STORAGE_KEY,
  SOUND_CHANGE_EVENT,
} from "@/lib/sound";
import { pauseAllActiveAudio, resumeAllActiveAudio } from "@/lib/audio";

describe("Pause System & Timer Integrity Suite", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe("1. Pause Behavior & Freezing", () => {
    it("freezes the active recipe run session immediately upon pause", () => {
      startRecipeRun("burger", "easy");
      const session = getRecipeRunSession();
      expect(session).not.toBeNull();
      expect(session?.isPaused).toBe(false);
      expect(session?.totalSeconds).toBe(420);

      pauseRecipeRun();
      const pausedSession = getRecipeRunSession();
      expect(pausedSession?.isPaused).toBe(true);
      expect(pausedSession?.pausedRemaining).toBeDefined();
      expect(pausedSession?.pausedRemaining).toBeLessThanOrEqual(420);
      expect(pausedSession?.pausedRemaining).toBeGreaterThan(410);
      expect(pausedSession?.pausedAt).toBeDefined();
    });

    it("ensures remaining time does not decrease while paused", () => {
      startRecipeRun("burger", "medium");
      const initialSession = getRecipeRunSession();
      expect(initialSession?.totalSeconds).toBe(300);

      pauseRecipeRun();
      const frozenTime1 = getRecipeRunSession()?.pausedRemaining;

      // Simulate passage of time by manipulating Date.now
      const realNow = Date.now;
      try {
        Date.now = () => realNow() + 10000; // 10 seconds in future
        const pausedSession = getRecipeRunSession();
        // Stored pausedRemaining remains unchanged
        expect(pausedSession?.isPaused).toBe(true);
        expect(pausedSession?.pausedRemaining).toBe(frozenTime1);
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe("2. Resume Behavior & Continuity", () => {
    it("re-anchors startTime upon resume so countdown continues from exact frozen remaining time", () => {
      startRecipeRun("burger", "easy"); // 420s total

      // Mock session to have exactly 250s remaining
      const stored = getRecipeRunSession()!;
      stored.startTime = Date.now() - 170 * 1000; // 170s elapsed -> 250s remaining
      mockLocalStorage.setItem("wavebakery_recipe_session", JSON.stringify(stored));

      pauseRecipeRun();
      const pausedSession = getRecipeRunSession()!;
      expect(pausedSession.isPaused).toBe(true);
      expect(pausedSession.pausedRemaining).toBe(250);

      // Simulate 5 minutes passing while paused
      const realNow = Date.now;
      try {
        const futureTime = realNow() + 300 * 1000;
        Date.now = () => futureTime;

        // Resume session
        resumeRecipeRun();
        const resumedSession = getRecipeRunSession()!;
        expect(resumedSession.isPaused).toBe(false);
        expect(resumedSession.pausedRemaining).toBeUndefined();
        expect(resumedSession.pausedAt).toBeUndefined();

        // Calculate remaining right at resumption moment
        const elapsed = Math.floor((futureTime - resumedSession.startTime) / 1000);
        const remaining = resumedSession.totalSeconds - elapsed;
        expect(remaining).toBe(250); // EXACT SAME TIME PRESERVED
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe("3. Restart Behavior", () => {
    it("resets timer to full duration for current difficulty and stays frozen until unpaused", () => {
      startRecipeRun("burger", "hard"); // 190s total
      pauseRecipeRun();

      resetRecipeTimerToFull("burger");
      const session = getRecipeRunSession()!;
      expect(session.isPaused).toBe(true);
      expect(session.totalSeconds).toBe(190);
      expect(session.pausedRemaining).toBe(190);

      // Resuming after countdown starts from 190s
      resumeRecipeRun();
      const resumed = getRecipeRunSession()!;
      expect(resumed.isPaused).toBe(false);
      const elapsed = Math.floor((Date.now() - resumed.startTime) / 1000);
      expect(resumed.totalSeconds - elapsed).toBe(190);
    });

    it("clears stage transient pipeline storage on stage reset", () => {
      mockLocalStorage.setItem("wavebakery_pipeline_burger_seasoned", JSON.stringify({ samples: [1, 2, 3] }));
      expect(mockLocalStorage.getItem("wavebakery_pipeline_burger_seasoned")).not.toBeNull();

      resetCurrentStage("burger", "/transform");
      expect(mockLocalStorage.getItem("wavebakery_pipeline_burger_seasoned")).toBeNull();
    });
  });

  describe("4. Sound Settings & Global Controls", () => {
    it("initializes with default sound settings (soundEnabled: true, volume: 80)", () => {
      const sound = getSoundSettings();
      expect(sound.soundEnabled).toBe(true);
      expect(sound.volume).toBe(80);
    });

    it("updates sound settings and persists changes", () => {
      const updated = setSoundSettings({ soundEnabled: false, volume: 45 });
      expect(updated.soundEnabled).toBe(false);
      expect(updated.volume).toBe(45);

      const read = getSoundSettings();
      expect(read.soundEnabled).toBe(false);
      expect(read.volume).toBe(45);
    });

    it("clamps volume between 0 and 100", () => {
      setSoundSettings({ volume: 150 });
      expect(getSoundSettings().volume).toBe(100);

      setSoundSettings({ volume: -20 });
      expect(getSoundSettings().volume).toBe(0);
    });
  });
});
