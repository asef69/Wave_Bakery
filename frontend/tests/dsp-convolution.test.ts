import { describe, expect, it } from "vitest";
import { convolve } from "@/lib/dsp";

describe("T6: Discrete-Time Linear Convolution", () => {
  it("verifies identity property with unit impulse delta[n]", () => {
    const x = [1, 2, 3, 4, 5];
    const impulse = [1];
    const result = convolve(x, impulse);
    expect(result).toEqual(x);
  });

  it("verifies time-shift property with delayed impulse delta[n - k]", () => {
    const x = [2, 4, 6];
    const delayedImpulse = [0, 0, 1];
    const result = convolve(x, delayedImpulse);
    expect(result).toEqual([0, 0, 2, 4, 6]);
  });

  it("verifies mathematical commutativity: x * h = h * x", () => {
    const x = [1, 3, -2, 4, 0, 5];
    const h = [0.5, 1.2, -0.8];

    const x_conv_h = convolve(x, h);
    const h_conv_x = convolve(h, x);

    expect(x_conv_h.length).toBe(x.length + h.length - 1);
    expect(x_conv_h.length).toBe(h_conv_x.length);

    for (let i = 0; i < x_conv_h.length; i++) {
      expect(x_conv_h[i]).toBeCloseTo(h_conv_x[i]!, 10);
    }
  });

  it("convolves two rectangular pulses into a triangular pulse", () => {
    const rect1 = [1, 1, 1, 1];
    const rect2 = [1, 1, 1, 1];
    const tri = convolve(rect1, rect2);
    // [1, 2, 3, 4, 3, 2, 1]
    expect(tri).toEqual([1, 2, 3, 4, 3, 2, 1]);
  });
});
