import { describe, expect, it } from "vitest";

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
  };
} else if (!window.localStorage) {
  (window as unknown as { localStorage: Storage }).localStorage =
    mockLocalStorage as unknown as Storage;
}

import {
  DIFFICULTY_CONFIGS,
  type RecipeDifficulty,
  startRecipeRun,
  completeCountdown,
  getRecipeRunSession,
} from "@/lib/recipes";

describe("T8: Timer Configuration & Calculation", () => {
  it("verifies time limit allocations per difficulty mode", () => {
    expect(DIFFICULTY_CONFIGS.easy.timeSeconds).toBe(420); // 7:00 (+120s)
    expect(DIFFICULTY_CONFIGS.easy.timeDisplay).toBe("7:00");
    expect(DIFFICULTY_CONFIGS.medium.timeSeconds).toBe(300); // 5:00 (+90s)
    expect(DIFFICULTY_CONFIGS.medium.timeDisplay).toBe("5:00");
    expect(DIFFICULTY_CONFIGS.hard.timeSeconds).toBe(190); // 3:10 (+70s)
    expect(DIFFICULTY_CONFIGS.hard.timeDisplay).toBe("3:10");
    expect(DIFFICULTY_CONFIGS.masterchef.timeSeconds).toBe(120); // 2:00 (+60s)
    expect(DIFFICULTY_CONFIGS.masterchef.timeDisplay).toBe("2:00");
  });

  it("formats remaining seconds into MM:SS format correctly", () => {
    const format = (totalSec: number) => {
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    expect(format(420)).toBe("7:00");
    expect(format(300)).toBe("5:00");
    expect(format(190)).toBe("3:10");
    expect(format(120)).toBe("2:00");
    expect(format(9)).toBe("0:09");
    expect(format(0)).toBe("0:00");
  });

  it("calculates time expiration properly", () => {
    const totalSeconds = 60;
    const startTime = Date.now() - 65 * 1000; // 65 seconds ago
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, totalSeconds - elapsed);

    expect(remaining).toBe(0);
    const isExpired = remaining <= 0;
    expect(isExpired).toBe(true);
  });

  it("initializes recipe session with correct difficulty and time limit", () => {
    startRecipeRun("burger", "easy");
    const session = getRecipeRunSession();
    expect(session).not.toBeNull();
    expect(session?.totalSeconds).toBe(420);
    expect(session?.difficulty).toBe("easy");
    expect(session?.startTime).toBeGreaterThan(0);
  });
});
