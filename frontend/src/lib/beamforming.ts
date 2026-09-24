/**
 * Uniform Linear Array (ULA) Acoustic Phased-Array Beamforming Engine (CSE220)
 *
 * Physics parameters:
 * - Speed of sound in air: c = 343 m/s
 * - Carrier frequency: f = 1000 Hz
 * - Wavelength: λ = c / f = 0.343 m
 * - Element spacing: d = λ / 2 = 0.1715 m (half-wavelength prevents grating lobes)
 * - Wave number: k = 2π / λ ≈ 18.318 rad/m
 *
 * Equations:
 * - Array manifold: a_m(θ) = exp(j * (2πd / λ) * m * sin(θ))
 * - Phase delay: Δϕ_m = -(2πd / λ) * m * sin(θ_target)
 * - Array Factor: AF(θ) = (1 / M) * | ∑_{m=0}^{M-1} w_m * exp(j * ((2πd / λ) * m * sin(θ) + ϕ_m)) |
 */

export interface SpeakerState {
  id: number;
  phase: number; // in degrees [-180, +180]
  amplitude: number; // [0, 1]
  isActive: boolean;
}

export interface BeamPatternPoint {
  angle: number; // -90 to +90 degrees
  intensity: number; // [0, 1]
}

export const SPEED_OF_SOUND = 343; // m/s
export const CARRIER_FREQUENCY = 1000; // Hz
export const WAVELENGTH = SPEED_OF_SOUND / CARRIER_FREQUENCY; // 0.343 m
export const ELEMENT_SPACING = WAVELENGTH / 2; // 0.1715 m
export const WAVE_NUMBER = (2 * Math.PI) / WAVELENGTH; // rad/m

/**
 * Computes the normalized Array Factor AF(θ) at a specific observation angle in degrees.
 *
 * @param speakers Array of speaker states
 * @param angleDegrees Observation angle θ in degrees [-90°, +90°]
 * @returns Normalized array factor magnitude in [0, 1]
 */
export function computeArrayFactor(speakers: SpeakerState[], angleDegrees: number): number {
  const activeSpeakers = speakers.filter((s) => s.isActive);
  const numActive = activeSpeakers.length;
  if (numActive === 0) return 0;

  const thetaRad = (angleDegrees * Math.PI) / 180;
  const sinTheta = Math.sin(thetaRad);

  const centerIndex = (speakers.length - 1) / 2;
  let sumReal = 0;
  let sumImag = 0;
  let totalWeight = 0;

  for (let i = 0; i < speakers.length; i++) {
    const s = speakers[i]!;
    if (!s.isActive) continue;

    const m = i - centerIndex;
    const spatialPhase = WAVE_NUMBER * m * ELEMENT_SPACING * sinTheta;
    const steeringPhase = (s.phase * Math.PI) / 180;
    const totalPhase = spatialPhase + steeringPhase;

    const w = Math.max(0, s.amplitude);
    sumReal += w * Math.cos(totalPhase);
    sumImag += w * Math.sin(totalPhase);
    totalWeight += w;
  }

  if (totalWeight === 0) return 0;
  const mag = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
  return Math.min(1.0, mag / totalWeight);
}

/**
 * Calculates the steered acoustic beam angle in degrees by locating
 * the global maximum of the physical Array Factor curve.
 */
export function calculateSteeredBeamAngle(speakers: SpeakerState[]): number {
  const active = speakers.filter((s) => s.isActive);
  if (active.length === 0) return 0;

  let maxGain = -1;
  let bestAngle = 0;

  // Sweep from -90 to +90 in 1-degree steps
  for (let deg = -90; deg <= 90; deg += 1) {
    const gain = computeArrayFactor(speakers, deg);
    if (gain > maxGain) {
      maxGain = gain;
      bestAngle = deg;
    }
  }

  return bestAngle;
}

/**
 * Compatibility alias for calculateSteeredBeamAngle.
 */
export function calculateMockBeamAngle(speakers: SpeakerState[]): number {
  return calculateSteeredBeamAngle(speakers);
}

/**
 * Generates true physical Array Factor curve points for UI beam graph display.
 */
export function generateArrayFactorPattern(
  speakers: SpeakerState[],
  numPoints: number = 73,
): BeamPatternPoint[] {
  const points: BeamPatternPoint[] = [];
  const startAngle = -90;
  const endAngle = 90;
  const step = (endAngle - startAngle) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const angle = startAngle + i * step;
    const intensity = computeArrayFactor(speakers, angle);

    points.push({
      angle: Math.round(angle * 10) / 10,
      intensity: Math.round(intensity * 1000) / 1000,
    });
  }

  return points;
}

/**
 * Compatibility alias for generateArrayFactorPattern.
 */
export function generateMockBeamPattern(
  speakersOrAngle: SpeakerState[] | number,
  numPoints: number = 73,
): BeamPatternPoint[] {
  if (Array.isArray(speakersOrAngle)) {
    return generateArrayFactorPattern(speakersOrAngle, numPoints);
  }

  // If passed an angle directly, generate pattern corresponding to preset phase alignment at that angle
  const phases = getPresetPhasesForAngle(speakersOrAngle, 8);
  const speakers: SpeakerState[] = phases.map((p, idx) => ({
    id: idx + 1,
    phase: p,
    amplitude: 1.0,
    isActive: true,
  }));
  return generateArrayFactorPattern(speakers, numPoints);
}

/**
 * Computes transmission efficiency towards the diner target destination:
 * Efficiency = AF(θ_target)
 */
export function calculateTransmissionEfficiency(
  speakers: SpeakerState[],
  targetAngle: number,
): number {
  const af = computeArrayFactor(speakers, targetAngle);
  return Math.round(af * 100);
}

/**
 * Checks if beam is aligned with target angle within tolerance degrees or efficiency threshold.
 */
export function checkBeamAlignment(
  currentAngle: number,
  targetAngle: number,
  toleranceDegrees: number = 6,
): boolean {
  return Math.abs(currentAngle - targetAngle) <= toleranceDegrees;
}

/**
 * Analytically generates exact progressive phase steering angles for each speaker:
 * Δϕ_m = -(2πd / λ) * (m - (M-1)/2) * sin(θ_target)
 */
export function getPresetPhasesForAngle(targetAngle: number, numSpeakers: number): number[] {
  const thetaRad = (targetAngle * Math.PI) / 180;
  const sinTheta = Math.sin(thetaRad);
  const centerIndex = (numSpeakers - 1) / 2;
  const phases: number[] = [];

  for (let i = 0; i < numSpeakers; i++) {
    const m = i - centerIndex;
    // Phase delay to steer towards target angle
    const phaseRad = -WAVE_NUMBER * m * ELEMENT_SPACING * sinTheta;
    let phaseDeg = Math.round((phaseRad * 180) / Math.PI);

    // Normalize into [-180, 180]
    while (phaseDeg > 180) phaseDeg -= 360;
    while (phaseDeg < -180) phaseDeg += 360;
    phases.push(phaseDeg);
  }

  return phases;
}

export type WindowType = "uniform" | "hamming" | "hann" | "blackman";

export interface WindowOption {
  id: WindowType;
  name: string;
  sidelobeLevelDb: string;
  description: string;
  beamwidthNote: string;
}

export const WINDOW_OPTIONS: WindowOption[] = [
  {
    id: "uniform",
    name: "Uniform (Rectangular)",
    sidelobeLevelDb: "-13.3 dB",
    description: "Maximum mainlobe sharpness, but high acoustic sidelobe spillover.",
    beamwidthNote: "Sharpest beam (1.0x width)",
  },
  {
    id: "hamming",
    name: "Hamming Taper",
    sidelobeLevelDb: "-42.8 dB",
    description:
      "Strong sidelobe suppression. Protects neighboring diners from acoustic spillover.",
    beamwidthNote: "Balanced (1.3x width)",
  },
  {
    id: "hann",
    name: "Hann (Hanning)",
    sidelobeLevelDb: "-31.5 dB",
    description: "Smooth rolloff to zero at array edges, reducing edge diffraction.",
    beamwidthNote: "Smooth beam (1.4x width)",
  },
  {
    id: "blackman",
    name: "Blackman Taper",
    sidelobeLevelDb: "-58.1 dB",
    description: "Extreme sidelobe suppression. Virtually zero acoustic spillover.",
    beamwidthNote: "Widest beam (1.7x width)",
  },
];

/**
 * Calculates amplitude weights for a given windowing function across M elements.
 */
export function calculateWindowWeights(numElements: number, windowType: WindowType): number[] {
  if (numElements <= 1) return [1.0];
  const weights: number[] = [];
  const N = numElements - 1;

  for (let n = 0; n < numElements; n++) {
    let w = 1.0;
    if (windowType === "hamming") {
      w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / N);
    } else if (windowType === "hann") {
      w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / N));
    } else if (windowType === "blackman") {
      w = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / N) + 0.08 * Math.cos((4 * Math.PI * n) / N);
    }
    // ensure within [0.05, 1.0]
    weights.push(Math.max(0.05, Math.round(w * 1000) / 1000));
  }

  // Normalize so max weight is 1.0
  const maxW = Math.max(...weights);
  return weights.map((w) => Math.round((w / maxW) * 1000) / 1000);
}

/**
 * Applies window tapering amplitudes to speaker states.
 */
export function applyWindowTapering(
  speakers: SpeakerState[],
  windowType: WindowType,
): SpeakerState[] {
  const weights = calculateWindowWeights(speakers.length, windowType);
  return speakers.map((s, idx) => ({
    ...s,
    amplitude: weights[idx] ?? 1.0,
  }));
}

export interface RestaurantTable {
  id: number;
  name: string;
  eaterName: string;
  dishEmoji: string;
  angle: number;
  distanceMeters: number;
  isVip?: boolean;
}

export const RESTAURANT_TABLES: RestaurantTable[] = [
  {
    id: 1,
    name: "Table 1 · Window Booth",
    eaterName: "Speedy Diner",
    dishEmoji: "🍔",
    angle: -30,
    distanceMeters: 4.5,
  },
  {
    id: 3,
    name: "Table 3 · Sunlit Terrace",
    eaterName: "Lunch Patron",
    dishEmoji: "🥪",
    angle: -15,
    distanceMeters: 5.0,
  },
  {
    id: 2,
    name: "Table 2 · Ramen Counter",
    eaterName: "Hungry Noodle Fan",
    dishEmoji: "🍜",
    angle: 15,
    distanceMeters: 3.8,
  },
  {
    id: 4,
    name: "Table 4 · Center Dining Table",
    eaterName: "Gourmet Critic",
    dishEmoji: "🍽️",
    angle: 35,
    distanceMeters: 4.2,
  },
  {
    id: 5,
    name: "Table 5 · VIP Celebration Lounge",
    eaterName: "VIP Party Host",
    dishEmoji: "🧁",
    angle: 45,
    distanceMeters: 5.5,
    isVip: true,
  },
];

/**
 * Evaluates acoustic spillover into non-target tables.
 * Returns tables that are experiencing more than spilloverThreshold of acoustic energy.
 */
export function evaluateTableSpillover(
  speakers: SpeakerState[],
  targetTableId: number,
  spilloverThreshold: number = 0.35,
): { table: RestaurantTable; spilloverIntensity: number }[] {
  const spillovers: { table: RestaurantTable; spilloverIntensity: number }[] = [];

  for (const table of RESTAURANT_TABLES) {
    if (table.id === targetTableId) continue;
    const intensity = computeArrayFactor(speakers, table.angle);
    if (intensity > spilloverThreshold) {
      spillovers.push({
        table,
        spilloverIntensity: Math.round(intensity * 100),
      });
    }
  }

  return spillovers;
}

/**
 * Standard discrete Room Impulse Response (RIR) modeling multipath reflections:
 * h_room[n] = δ[n] + α1·δ[n - d1] + α2·δ[n - d2]
 */
export const ROOM_IMPULSE_RESPONSE = [
  1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0,
  0, 0,
];

/**
 * Convolves a 1D discrete signal with the room impulse response h_room[n] (LTI system cascade).
 */
export function convolveWithRoomAcoustics(samples: number[]): number[] {
  const kernel = ROOM_IMPULSE_RESPONSE;
  const out = new Array<number>(samples.length).fill(0);
  const kLen = kernel.length;

  for (let n = 0; n < samples.length; n++) {
    let acc = 0;
    for (let k = 0; k < kLen; k++) {
      if (n - k >= 0) {
        acc += (samples[n - k] ?? 0) * (kernel[k] ?? 0);
      }
    }
    out[n] = acc;
  }

  // Peak normalize with 0.95 headroom
  let maxVal = 0;
  for (let i = 0; i < out.length; i++) {
    const abs = Math.abs(out[i] ?? 0);
    if (abs > maxVal) maxVal = abs;
  }
  if (maxVal > 0) {
    const scale = 0.95 / Math.max(1.0, maxVal);
    for (let i = 0; i < out.length; i++) {
      out[i] = (out[i] ?? 0) * scale;
    }
  }
  return out;
}

/**
 * Calculates the exact received signals at the target table and neighboring spillover table.
 */
export function computeReceivedTableSignals(
  cookedSamples: number[],
  speakers: SpeakerState[],
  targetAngle: number,
  neighborAngle?: number,
): {
  targetSamples: number[];
  neighborSamples: number[];
  targetGain: number;
  neighborGain: number;
  sirDb: number;
} {
  const targetGain = computeArrayFactor(speakers, targetAngle);
  // Default neighbor angle: nearest non-target table angle
  const neighbor =
    neighborAngle !== undefined
      ? neighborAngle
      : targetAngle > 0
        ? targetAngle - 25
        : targetAngle + 25;
  const neighborGain = computeArrayFactor(speakers, neighbor);

  const roomCooked = convolveWithRoomAcoustics(cookedSamples);

  const targetSamples = roomCooked.map((s) => s * targetGain);
  const neighborSamples = roomCooked.map((s) => s * neighborGain);

  const sirRatio = (targetGain * targetGain) / (neighborGain * neighborGain + 1e-4);
  const sirDb = Math.round(10 * Math.log10(Math.max(0.1, sirRatio)) * 10) / 10;

  return {
    targetSamples,
    neighborSamples,
    targetGain: Math.round(targetGain * 100) / 100,
    neighborGain: Math.round(neighborGain * 100) / 100,
    sirDb,
  };
}

/**
 * Analytical metrics for the Faculty Math Inspector ("Show Your Work" mode).
 */
export interface FacultyInspectorMetrics {
  steeredAngle: number;
  targetAngle: number;
  peakSidelobeLevelDb: number;
  halfPowerBeamwidthDeg: number;
  directivityIndexDb: number;
  carrierFrequencyHz: number;
  wavelengthMeters: number;
  elementSpacingMeters: number;
  waveNumberRadM: number;
  phaseGradientDeg: number;
  spatialNyquistMet: boolean;
  activeElements: number;
}

export function computeFacultyInspectorMetrics(
  speakers: SpeakerState[],
  targetAngle: number,
): FacultyInspectorMetrics {
  const steered = calculateSteeredBeamAngle(speakers);
  const activeCount = speakers.filter((s) => s.isActive).length;

  const thetaSteerRad = (steered * Math.PI) / 180;
  const cosSteer = Math.max(0.1, Math.cos(thetaSteerRad));
  // Analytical half-power beamwidth approx: HPBW ≈ 0.886 * λ / (N * d * cos(θ0)) in radians
  const hpbwRad = (0.886 * WAVELENGTH) / (activeCount * ELEMENT_SPACING * cosSteer);
  const hpbwDeg = Math.round(((hpbwRad * 180) / Math.PI) * 10) / 10;

  // Peak Sidelobe Level (PSLL)
  const pattern = generateArrayFactorPattern(speakers, 181);
  let maxSidelobe = 0;
  for (const pt of pattern) {
    if (Math.abs(pt.angle - steered) > 12) {
      if (pt.intensity > maxSidelobe) maxSidelobe = pt.intensity;
    }
  }
  const psllDb = maxSidelobe > 0 ? Math.round(20 * Math.log10(maxSidelobe) * 10) / 10 : -45.0;

  // Directivity Index approximation D ≈ 2 * N * (d / λ)
  const directivity = 2 * activeCount * (ELEMENT_SPACING / WAVELENGTH) * cosSteer;
  const directivityDb = Math.round(10 * Math.log10(Math.max(1.0, directivity)) * 10) / 10;

  // Progressive phase gradient: Δϕ = -k * d * sin(θ_target)
  const thetaTargetRad = (targetAngle * Math.PI) / 180;
  const phaseGradRad = -WAVE_NUMBER * ELEMENT_SPACING * Math.sin(thetaTargetRad);
  const phaseGradDeg = Math.round((phaseGradRad * 180) / Math.PI);

  return {
    steeredAngle: steered,
    targetAngle,
    peakSidelobeLevelDb: psllDb,
    halfPowerBeamwidthDeg: hpbwDeg,
    directivityIndexDb: directivityDb,
    carrierFrequencyHz: CARRIER_FREQUENCY,
    wavelengthMeters: Math.round(WAVELENGTH * 1000) / 1000,
    elementSpacingMeters: Math.round(ELEMENT_SPACING * 1000) / 1000,
    waveNumberRadM: Math.round(WAVE_NUMBER * 100) / 100,
    phaseGradientDeg: phaseGradDeg,
    spatialNyquistMet: ELEMENT_SPACING <= WAVELENGTH / 2 + 1e-4,
    activeElements: activeCount,
  };
}
