import { describe, expect, it } from "vitest";

import { applySystem, systemAccuracy, systemPolesZeros } from "@/lib/z-system";

const step = new Array(200).fill(1);

describe("System Delivery z-plane systems", () => {
  it("1st-order lowpass follows y[n] = (1-r)x[n] + r·y[n-1] (unity DC gain)", () => {
    const r = 0.8;
    const y = applySystem(step, systemPolesZeros("lowpass1", r, 1.2));
    let ref = 0;
    for (let n = 0; n < 5; n++) {
      ref = (1 - r) * 1 + r * ref;
      expect(y[n]).toBeCloseTo(ref, 10);
    }
    expect(y[199]).toBeCloseTo(1, 6);
  });

  it("moving average averages the last 6 samples", () => {
    const x = [6, 0, 0, 0, 0, 0, 0, 0];
    const y = applySystem(x, systemPolesZeros("moving_avg", 0.5, 0));
    expect(y.slice(0, 7).map((v) => Math.round(v * 1e9) / 1e9)).toEqual([1, 1, 1, 1, 1, 1, 0]);
  });

  it("resonator matches its recurrence and diverges when r >= 1", () => {
    const w = Math.PI * 0.35;
    const impulse = [1, ...new Array(99).fill(0)];
    const y = applySystem(impulse, systemPolesZeros("resonator2", 0.9, w));
    expect(y[0]).toBeCloseTo(1, 10);
    expect(y[1]).toBeCloseTo(2 * 0.9 * Math.cos(w), 10);
    expect(y[2]).toBeCloseTo(2 * 0.9 * Math.cos(w) * y[1]! - 0.81, 10);

    const unstable = applySystem(impulse, systemPolesZeros("resonator2", 1.05, w));
    const late = Math.max(...unstable.slice(80).map(Math.abs));
    expect(late).toBeGreaterThan(1);
  });

  it("notch removes a tone at ω0", () => {
    const w = Math.PI / 4;
    const x = Array.from({ length: 400 }, (_, n) => Math.cos(w * n));
    const y = applySystem(x, systemPolesZeros("notch", 0.5, w));
    expect(Math.max(...y.slice(300).map(Math.abs))).toBeLessThan(0.01);
  });

  it("accuracy rewards a stable, alias-free cart", () => {
    const stable = systemPolesZeros("resonator2", 0.85, 1);
    const unstable = systemPolesZeros("resonator2", 1.05, 1);
    expect(systemAccuracy(stable, 8000)).toBe(100);
    expect(systemAccuracy(stable, 1200)).toBe(60);
    expect(systemAccuracy(unstable, 8000)).toBeLessThan(20);
    // Notch poles sit at 0.85 regardless of the r slider.
    expect(systemAccuracy(systemPolesZeros("notch", 1.1, 1), 8000)).toBe(100);
  });
});
