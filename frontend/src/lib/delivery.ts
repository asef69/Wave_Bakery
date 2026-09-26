/**
 * Finishing problems the last two stations exist to solve. Mirrors
 * backend/app/delivery.py — keep the profiles and formulas identical.
 *
 * 1. Burnt overtone (Precision Oven): cooking leaves a non-harmonic tone at
 *    `defectRatio` x the dish's fundamental. It stays in the served dish
 *    unless the oven's notch / cutoff removes it.
 * 2. Road vibration (System Delivery): delivering the dish adds a tone at
 *    `roadHz` (true rate DELIVERY_FS). The cart's H(z) must reject it
 *    without dulling the dish; the vibration sensor reads it at its own
 *    sampling rate, so a slow sensor reports an aliased frequency.
 */
import { computeSignalSimilarity, isOnePeriod } from "@/lib/dsp";
import { getIdealDishSignal } from "@/lib/pipeline";
import { applySystem, type ZSystem } from "@/lib/z-system";

export interface DeliveryProfile {
  /** Burnt overtone frequency as a multiple of the dish's fundamental (non-integer). */
  defectRatio: number;
  /** Burnt overtone amplitude as a fraction of the dish's peak. */
  defectAmp: number;
  /** Road vibration frequency in Hz at the true delivery rate. */
  roadHz: number;
  /** Road vibration amplitude as a fraction of the dish's peak. */
  roadAmp: number;
}

/** True sampling rate of the delivery (the cart filter runs at this rate). */
export const DELIVERY_FS = 8000;
/** The oven notch slider's range, in game Hz: the overtone must be reachable. */
const NOTCH_MIN_HZ = 10;
const NOTCH_MAX_HZ = 28;

const DEFAULT_PROFILE: DeliveryProfile = {
  defectRatio: 2.5,
  defectAmp: 0.9,
  roadHz: 2200,
  roadAmp: 0.9,
};

// defectRatio = (overtone in game Hz) / (dish fundamental f0): each overtone
// sits between two harmonics of its dish and inside the oven notch's 10-28 Hz
// range (e.g. burger: f0 = 4, overtone 18 Hz between harmonics 16 and 20).
// The server stores the resulting overtone (defect_hz) and the ideal dish's
// findMaxSignalFrequency (dish_top) per recipe — update both when these change.
export const DELIVERY_PROFILES: Record<string, DeliveryProfile> = {
  burger: { defectRatio: 18 / 4, defectAmp: 0.8, roadHz: 2600, roadAmp: 0.8 },
  sandwich: { defectRatio: 24 / 9, defectAmp: 0.8, roadHz: 1900, roadAmp: 0.8 },
  cake: { defectRatio: 16 / 3, defectAmp: 0.9, roadHz: 2300, roadAmp: 0.9 },
  noodles: { defectRatio: 20 / 14, defectAmp: 0.9, roadHz: 2900, roadAmp: 0.9 },
  "chicken-fry": { defectRatio: 20 / 3, defectAmp: 1.0, roadHz: 1700, roadAmp: 1.0 },
};

export function deliveryProfile(recipeId: string): DeliveryProfile {
  return DELIVERY_PROFILES[recipeId] ?? DEFAULT_PROFILE;
}

/** Dominant frequency (cycles per window, i.e. game Hz) of a 1-window signal. */
export function dishFundamental(samples: number[]): number {
  const n = samples.length - 1; // last sample repeats the first for periodic dishes
  let best = 0;
  let bestK = 1;
  for (let k = 1; k <= Math.min(40, Math.floor(n / 2)); k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * k * i) / n;
      re += (samples[i] ?? 0) * Math.cos(a);
      im -= (samples[i] ?? 0) * Math.sin(a);
    }
    const mag = re * re + im * im;
    if (mag > best) {
      best = mag;
      bestK = k;
    }
  }
  return bestK;
}

const peakOf = (x: number[]) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;

/** The burnt overtone's frequency (game Hz) for this recipe. */
export function ovenDefectHz(recipeId: string): number {
  const f0 = dishFundamental(getIdealDishSignal(recipeId).samples);
  const f = deliveryProfile(recipeId).defectRatio * f0;
  return Math.min(NOTCH_MAX_HZ, Math.max(NOTCH_MIN_HZ, f));
}

/**
 * A burnt overtone added to a dish: a tone of `hz` (whole cycles per window)
 * at `amp` x the dish's peak. servedDish uses it with the recipe's profile;
 * the Signal Playground with any settings.
 */
export function addBurntOvertone(cooked: number[], hz: number, amp: number): number[] {
  const a = amp * peakOf(cooked);
  const n = cooked.length;
  return cooked.map((v, i) => v + a * Math.sin((2 * Math.PI * hz * i) / (n - 1)));
}

/**
 * An overtone frequency (whole game Hz, within the notch slider's range)
 * that sits as far as possible from every harmonic of the dish, as each
 * recipe's overtone does.
 */
export function overtoneBetweenHarmonics(samples: number[]): number {
  const f0 = Math.max(1, dishFundamental(samples));
  let best = NOTCH_MIN_HZ;
  let bestGap = -1;
  for (let f = NOTCH_MIN_HZ; f <= NOTCH_MAX_HZ; f++) {
    const gap = Math.abs(f - Math.round(f / f0) * f0);
    if (gap > bestGap) {
      bestGap = gap;
      best = f;
    }
  }
  return best;
}

/** The dish as it leaves the kitchen: the cooked dish plus the burnt overtone. */
export function servedDish(recipeId: string, cooked: number[]): number[] {
  return addBurntOvertone(cooked, ovenDefectHz(recipeId), deliveryProfile(recipeId).defectAmp);
}

/** Road vibration at its true digital frequency (rad/sample at DELIVERY_FS). */
export function roadOmega(recipeId: string): number {
  return (2 * Math.PI * deliveryProfile(recipeId).roadHz) / DELIVERY_FS;
}

/**
 * Where a vibration sensor sampling at `sensorFs` sees the road tone:
 * folded into [0, fs/2], as an angle in [0, pi].
 */
export function sensedRoadOmega(recipeId: string, sensorFs: number): number {
  return aliasedOmega(deliveryProfile(recipeId).roadHz, sensorFs);
}

/** Where a sensor sampling at `sensorFs` sees a tone of `hz`, as an angle in [0, pi]. */
export function aliasedOmega(hz: number, sensorFs: number): number {
  let alias = hz % sensorFs;
  if (alias > sensorFs / 2) alias = sensorFs - alias;
  return (2 * Math.PI * alias) / sensorFs;
}

/** A road tone of `hz` (at DELIVERY_FS) at `amp` x the dish's peak, added to the dish. */
export function addRoadTone(dish: number[], hz: number, amp: number): number[] {
  const a = amp * peakOf(dish);
  const w = (2 * Math.PI * hz) / DELIVERY_FS;
  return dish.map((v, n) => v + a * Math.cos(w * n));
}

/** The dish on the cart, before the cart's suspension filters it. */
export function withRoadVibration(recipeId: string, dish: number[]): number[] {
  const { roadHz, roadAmp } = deliveryProfile(recipeId);
  return addRoadTone(dish, roadHz, roadAmp);
}

/** Periods the cart runs before the served one, so its start-up transient has died out. */
const CART_WARMUP_PERIODS = 3;

/**
 * The cart's steady-state response to a dish that repeats every window (the
 * dish loops, and every road frequency is a whole number of cycles per
 * window). Starting the filter from rest instead left a start-up transient
 * worth up to ~100 % of the dish's peak over its first ~25 samples, so even a
 * perfect cart served something that looked and sounded unlike the dish.
 * An unstable cart has no steady state: it keeps growing, as it should.
 */
function applySystemPeriodic(x: number[], system: ZSystem): number[] {
  const n = x.length;
  const periodic = n > 2 && isOnePeriod(x);
  if (!periodic) return applySystem(x, system);
  const period = x.slice(0, n - 1);
  const looped: number[] = [];
  for (let p = 0; p <= CART_WARMUP_PERIODS; p++) looped.push(...period);
  const y = applySystem(looped, system).slice(CART_WARMUP_PERIODS * period.length);
  y.push(y[0]!);
  return y;
}

/**
 * Put the dish on the cart: the road adds its vibration, the cart's H(z)
 * filters the result, and the output is the served dish. A stable cart keeps
 * the dish's own level (the notch and low-pass have unity gain where the dish
 * lives); a runaway output (unstable, or a resonance amplifying the road) is
 * scaled back to the dish's level so its ringing, not its size, is judged.
 * The score is how close the served dish is to the dish before the road.
 */
export function deliverOnCart(
  recipeId: string,
  dish: number[],
  system: ZSystem,
): { input: number[]; served: number[]; accuracy: number } {
  return cartServe(dish, withRoadVibration(recipeId, dish), system);
}

/**
 * The cart's H(z) applied to `input` (the dish plus road vibration): the
 * served dish and how close it is to the dish before the road.
 */
export function cartServe(
  dish: number[],
  input: number[],
  system: ZSystem,
): { input: number[]; served: number[]; accuracy: number } {
  const y = applySystemPeriodic(input, system);
  const peak = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const dishPeak = peakOf(dish);
  const served = !Number.isFinite(peak)
    ? y.map(() => 0)
    : peak > 1.5 * dishPeak
      ? y.map((v) => (v / peak) * dishPeak)
      : y;
  return { input, served, accuracy: Math.round(computeSignalSimilarity(served, dish)) };
}
