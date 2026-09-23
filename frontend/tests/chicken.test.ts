import { describe, expect, it } from "vitest";
import {
  CHICKEN_AUDIO_METADATA,
  getChickenStaticSamples,
} from "@/lib/chicken-audio";
import { CHICKEN_STATIC_PCM_SAMPLES } from "@/lib/chicken-samples";
import { CHICKEN_SIGNAL_DEFINITION } from "@/lib/signals";

describe("T3: Chicken Audio WAV PCM Samples", () => {
  it("verifies static PCM array length and non-zero amplitude", () => {
    const samples = getChickenStaticSamples();
    expect(samples.length).toBe(1000);
    expect(CHICKEN_STATIC_PCM_SAMPLES.length).toBe(1000);

    // Ensure non-zero amplitude content
    const maxAbs = Math.max(...samples.map((s) => Math.abs(s)));
    expect(maxAbs).toBeGreaterThan(0.05);
    expect(maxAbs).toBeLessThanOrEqual(1.0);
  });

  it("verifies audio metadata parameters (44.1 kHz, stereo WAV)", () => {
    expect(CHICKEN_AUDIO_METADATA.sampleRate).toBe(44100);
    expect(CHICKEN_AUDIO_METADATA.channels).toBe(2);
    expect(CHICKEN_AUDIO_METADATA.duration).toBeGreaterThan(1.0);
    expect(CHICKEN_AUDIO_METADATA.assetPath).toBe("/sounds/chicken.wav");
  });

  it("verifies chicken signal generator handles parameters smoothly", () => {
    const samples = CHICKEN_SIGNAL_DEFINITION.generateSamples({
      freq: 4,
      amplitude: 0.8,
      sampleCount: 401,
      noise: 0,
    });
    expect(samples.length).toBe(401);
    const peak = Math.max(...samples.map((s) => Math.abs(s)));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(1.0);
  });
});
