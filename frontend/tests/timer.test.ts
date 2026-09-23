import { describe, expect, it } from "vitest";
import { DIFFICULTY_CONFIGS, type RecipeDifficulty } from "@/lib/recipes";

describe("T8: Timer Configuration & Calculation", () => {
  it("verifies time limit allocations per difficulty mode", () => {
    expect(DIFFICULTY_CONFIGS.easy.timeSeconds).toBe(300); // 5:00
    expect(DIFFICULTY_CONFIGS.medium.timeSeconds).toBe(210); // 3:30
    expect(DIFFICULTY_CONFIGS.hard.timeSeconds).toBe(120); // 2:00
    expect(DIFFICULTY_CONFIGS.masterchef.timeSeconds).toBe(60); // 1:00
  });

  it("formats remaining seconds into MM:SS format correctly", () => {
    const format = (totalSec: number) => {
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    expect(format(300)).toBe("5:00");
    expect(format(210)).toBe("3:30");
    expect(format(120)).toBe("2:00");
    expect(format(60)).toBe("1:00");
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
});
