import { describe, expect, it } from "vitest";

import { applySystem, gainAt, systemPolesZeros } from "@/lib/z-system";

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
});

describe("gainAt", () => {
  const w0 = (2 * Math.PI * 2300) / 8000; // cake's road tone
  it("a notch removes the tone and leaves the dish at unity", () => {
    const sys = systemPolesZeros("notch", 0.85, w0);
    expect(gainAt(sys, w0)).toBeLessThan(1e-9);
    expect(gainAt(sys, 0)).toBeCloseTo(1, 6);
  });
  it("a resonator aimed at the road amplifies it and dulls the dish", () => {
    // The settings of a real run: resonator2, r = 0.9, ω = 1.85.
    const sys = systemPolesZeros("resonator2", 0.9, 1.85);
    expect(gainAt(sys, w0)).toBeGreaterThan(4);
    expect(gainAt(sys, 0)).toBeLessThan(0.5);
  });
});
