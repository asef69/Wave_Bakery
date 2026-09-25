import { describe, expect, it } from "vitest";
import {
  computeArrayFactor,
  calculateSteeredBeamAngle,
  getPresetPhasesForAngle,
  calculateTransmissionEfficiency,
  type SpeakerState,
  ELEMENT_SPACING,
  WAVELENGTH,
} from "@/lib/beamforming";

describe("T10: Phased-Array Beamforming Physics", () => {
  it("verifies physical constants (lambda = 0.343m, d = 0.1715m)", () => {
    expect(WAVELENGTH).toBeCloseTo(0.343, 3);
    expect(ELEMENT_SPACING).toBeCloseTo(0.1715, 3);
    expect(ELEMENT_SPACING).toBeCloseTo(WAVELENGTH / 2, 4);
  });

  it("steers maximum constructive interference to target angle", () => {
    const targetAngle = 30; // +30 degrees
    const numSpeakers = 8;
    const phases = getPresetPhasesForAngle(targetAngle, numSpeakers);

    const speakers: SpeakerState[] = phases.map((p, idx) => ({
      id: idx + 1,
      phase: p,
      amplitude: 1.0,
      isActive: true,
    }));

    // Array factor at target angle should be maximal (~1.0)
    const afTarget = computeArrayFactor(speakers, targetAngle);
    expect(afTarget).toBeGreaterThan(0.95);

    // Steered angle calculation should match target angle within 2 degrees
    const estimatedAngle = calculateSteeredBeamAngle(speakers);
    expect(Math.abs(estimatedAngle - targetAngle)).toBeLessThanOrEqual(2);

    // Array factor away from target (e.g. -30 deg) should be significantly lower
    const afOpposite = computeArrayFactor(speakers, -targetAngle);
    expect(afOpposite).toBeLessThan(0.35);
  });

  it("calculates high transmission efficiency when aligned", () => {
    const targetAngle = -25;
    const phases = getPresetPhasesForAngle(targetAngle, 8);
    const speakers: SpeakerState[] = phases.map((p, idx) => ({
      id: idx + 1,
      phase: p,
      amplitude: 1.0,
      isActive: true,
    }));

    const efficiency = calculateTransmissionEfficiency(speakers, targetAngle);
    expect(efficiency).toBeGreaterThanOrEqual(95);
  });

  it("calculates room acoustics LTI cascade with multipath impulse response", async () => {
    const { ROOM_IMPULSE_RESPONSE, convolveWithRoomAcoustics } = await import("@/lib/beamforming");
    expect(ROOM_IMPULSE_RESPONSE.length).toBeGreaterThan(10);
    expect(ROOM_IMPULSE_RESPONSE[0]).toBeCloseTo(1.0, 1);

    const testSignal = [1, 0.5, -0.5, 0];
    const out = convolveWithRoomAcoustics(testSignal);
    expect(out.length).toBe(testSignal.length);
  });

  it("calculates target vs neighbor received signals and spatial SIR", async () => {
    const { computeReceivedTableSignals, getPresetPhasesForAngle } =
      await import("@/lib/beamforming");
    const targetAngle = 20;
    const phases = getPresetPhasesForAngle(targetAngle, 8);
    const speakers: SpeakerState[] = phases.map((p, idx) => ({
      id: idx + 1,
      phase: p,
      amplitude: 1.0,
      isActive: true,
    }));

    const signal = new Array(200).fill(0).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / 8000));
    const result = computeReceivedTableSignals(signal, speakers, targetAngle, -45);

    expect(result.sirDb).toBeGreaterThan(5);
    expect(result.targetGain).toBeGreaterThan(result.neighborGain);
  });

  it("computes Faculty DSP metrics (directivity, beamwidth, PSLL, spatial Nyquist)", async () => {
    const { computeFacultyInspectorMetrics, getPresetPhasesForAngle } =
      await import("@/lib/beamforming");
    const targetAngle = 0; // broadside
    const phases = getPresetPhasesForAngle(targetAngle, 8);
    const speakers: SpeakerState[] = phases.map((p, idx) => ({
      id: idx + 1,
      phase: p,
      amplitude: 1.0,
      isActive: true,
    }));

    const metrics = computeFacultyInspectorMetrics(speakers, targetAngle);
    expect(metrics.halfPowerBeamwidthDeg).toBeGreaterThan(0);
    expect(metrics.halfPowerBeamwidthDeg).toBeLessThan(40);
    expect(metrics.directivityIndexDb).toBeGreaterThan(0);
    expect(metrics.peakSidelobeLevelDb).toBeLessThan(-5);
    expect(metrics.spatialNyquistMet).toBe(true);
  });
});
