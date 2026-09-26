/**
 * Signal Playground: the gameplay's own signals and operations, without a
 * recipe or a target. Every lab here calls the same functions the recipe
 * stations use (lib/signals.ts models, lib/pipeline.ts stages), so a signal
 * looks and sounds exactly as it does in a run.
 */
import {
  addBurntOvertone,
  addRoadTone,
  aliasedOmega,
  cartServe,
  DELIVERY_FS,
  deliverOnCart,
  ovenDefectHz,
  roadOmega,
  servedDish,
  withRoadVibration,
} from "@/lib/delivery";
import {
  computeSignalSimilarity,
  normalizedCrossCorrelation,
  normalizedRootMeanSquareError,
} from "@/lib/dsp";
import {
  computeCleanMixedSignal,
  computeConvolvedSignal,
  computeMarinatedSignal,
  computeSeasonedSignal,
  getIdealDishSignal,
  superposeSamples,
  washFilterPreview,
  type PipelineSignal,
} from "@/lib/pipeline";
import {
  applyOvenToDish,
  computeDiscreteSignalFFT,
  computeSignalIFFT,
  findMaxSignalFrequency,
  tuneOvenFrequencies,
  type OvenSettings,
} from "@/lib/precision-oven-dsp";
import { computeIngredientSamples, type Recipe } from "@/lib/recipes";
import { computeSuperpositionCurve, getMathematicalSignal } from "@/lib/signals";
import { gainAt, systemPolesZeros, type SystemPresetType } from "@/lib/z-system";

export type OscillatorShape = "sine" | "triangle" | "square";
export type CookingMethod = "grill" | "fry" | "bake" | "boil";

export interface PlaygroundSource {
  category: "ingredient" | "oscillator";
  name: string;
  freq: number;
  waveShape?: OscillatorShape | undefined;
  /** Filtering lab cutoff below which the ingredient itself starts to be cut. */
  idealCutoff?: number | undefined;
}

/** Samples per signal, as in every recipe station (one 1-second window). */
export const PLAYGROUND_SAMPLES = 401;
/** Noise on a dirty ingredient in the Filtering lab (filtering.tsx uses the same). */
export const DIRTY_NOISE = 0.85;

function oscillatorSamples(freq: number, shape: OscillatorShape, noise: number): number[] {
  const width = PLAYGROUND_SAMPLES - 1;
  const out: number[] = [];
  for (let i = 0; i <= width; i++) {
    const s = Math.sin((2 * Math.PI * freq * i) / width);
    const v =
      shape === "triangle"
        ? (2 / Math.PI) * Math.asin(Math.max(-1, Math.min(1, s)))
        : shape === "square"
          ? s >= 0
            ? 1
            : -1
          : s;
    const n = noise > 0 ? Math.sin(i * 12.9898 + 78.233) * noise * 0.485 : 0;
    out.push(v - n);
  }
  return out;
}

/**
 * The source signal: an ingredient's gameplay model (parametric curve's y(t),
 * mathematical signal, or the chicken recording, at phase 0 as in the Generate
 * and Mixing labs), or a plain oscillator.
 */
export function sourceSamples(src: PlaygroundSource, noise = 0): number[] {
  if (src.category === "ingredient") {
    return computeIngredientSamples({
      name: src.name,
      freq: src.freq,
      noise,
      width: PLAYGROUND_SAMPLES - 1,
    });
  }
  return oscillatorSamples(src.freq, src.waveShape ?? "sine", noise);
}

/** The 2-D curve an ingredient is drawn as in the game (null for 1-D signals). */
export function sourceCurvePoints(
  src: PlaygroundSource,
): Array<{ x: number; y: number }> | undefined {
  if (src.category !== "ingredient") return undefined;
  return getMathematicalSignal(src.name)?.parametricCurve?.generatePoints();
}

/**
 * The source as the Mixing lab hands it on: its samples plus, for a
 * parametric ingredient, the 2-D curve later stations transform and draw.
 */
export function sourceAsMix(src: PlaygroundSource, samples = sourceSamples(src)): PipelineSignal {
  const curve =
    src.category === "ingredient"
      ? computeSuperpositionCurve([{ name: src.name }], { [src.name]: samples })
      : null;
  return {
    recipeId: "playground",
    stage: "mixed",
    samples,
    sampleRate: 44100,
    duration: 3.0,
    frequency: src.freq,
    timestamp: 0,
    metadata: curve ? { ingredients: [src.name], curve: curve.points } : {},
  };
}

/** Washing: the Filtering lab's low-pass on a dirty ingredient. */
export function washSource(src: PlaygroundSource, cutoffHz: number) {
  const raw = sourceSamples(src, DIRTY_NOISE);
  const clean = sourceSamples(src, 0);
  const filtered = washFilterPreview(raw, clean, cutoffHz, src.idealCutoff ?? 400);
  return { raw, clean, filtered };
}

/** Mixing: the bowl's superposition (Σ g·x / √K, as in the Mixing lab). */
export function mixSources(tracks: Array<{ src: PlaygroundSource; gain: number }>) {
  const list = tracks.map((t) => sourceSamples(t.src).map((v) => v * t.gain));
  const samples = superposeSamples(list, PLAYGROUND_SAMPLES);
  // The bowl's 2-D picture (when a parametric ingredient is in it). Oscillators
  // join as 1-D tracks under names no ingredient model matches.
  const bowl = tracks.map((t, i) => ({
    name: t.src.category === "ingredient" ? t.src.name : `oscillator-${i}`,
  }));
  const byName = Object.fromEntries(bowl.map((b, i) => [b.name, list[i]!]));
  const curve = computeSuperpositionCurve(bowl, byName);
  return { samples, curvePoints: curve?.points };
}

/** Seasoning: y = A · x(αt) — the Seasoning lab's computeSeasonedSignal. */
export function seasonSource(src: PlaygroundSource, amplitude: number, alpha: number) {
  return computeSeasonedSignal(sourceAsMix(src), amplitude, alpha, PLAYGROUND_SAMPLES);
}

/** Marinating: a time shift y = x(t − t₀) — the Marinating lab's computeMarinatedSignal. */
export function marinateSource(src: PlaygroundSource, seconds: number) {
  return computeMarinatedSignal(sourceAsMix(src), seconds, PLAYGROUND_SAMPLES);
}

/** Cooking: convolution with an appliance at a depth — the Cooking lab's computeConvolvedSignal. */
export function cookSource(src: PlaygroundSource, method: CookingMethod, depth: number) {
  return computeConvolvedSignal(sourceAsMix(src), method, depth, PLAYGROUND_SAMPLES);
}

// ---------------------------------------------------------------------------
// Precision Oven, System Delivery, Tasting and Full Chain labs — the same
// functions the recipe stations use (lib/precision-oven-dsp.ts,
// lib/delivery.ts, lib/z-system.ts, lib/dsp.ts, lib/pipeline.ts).
// ---------------------------------------------------------------------------

export interface PlaygroundOvenSettings extends OvenSettings {
  /** The oven's sampling rate (game Hz). */
  fs: number;
}

/**
 * The Precision Oven on any dish: add a burnt overtone, sample at fs, edit
 * the spectrum, rebuild. At fs >= 2·fmax the rebuild is the game's
 * (applyOvenToDish, lossless by Nyquist); below it the dish is rebuilt from
 * its fs samples, so the aliasing is heard and seen, as in the oven's
 * sampling stage.
 */
export function bakeInOven(
  dish: number[],
  overtoneHz: number,
  overtoneAmp: number,
  settings: PlaygroundOvenSettings,
) {
  const served = overtoneAmp > 0 ? addBurntOvertone(dish, overtoneHz, overtoneAmp) : [...dish];
  const fmax = findMaxSignalFrequency(served);
  const nyquistRate = 2 * fmax;
  const aliased = settings.fs < nyquistRate;
  const spectrum = computeDiscreteSignalFFT(served, settings.fs, 64);
  const tuned = tuneOvenFrequencies(spectrum, settings);
  const output = aliased
    ? computeSignalIFFT(tuned.tunedReal, tuned.tunedImag, served.length, settings.fs)
    : applyOvenToDish(served, settings.fs, settings);
  return { served, fmax, nyquistRate, aliased, spectrum, tuned, output };
}

export interface PlaygroundCartSettings {
  preset: SystemPresetType;
  poleRadius: number;
  omega: number;
  /** Road vibration frequency, Hz at DELIVERY_FS (multiples of 100 loop cleanly). */
  roadHz: number;
  /** Road vibration amplitude, x the dish's peak. */
  roadAmp: number;
  /** The vibration sensor's sampling rate. */
  sensorFs: number;
}

/** The delivery cart on any dish: road tone in, H(z) out (the game's cartServe). */
export function deliverOnPlaygroundCart(dish: number[], s: PlaygroundCartSettings) {
  const system = systemPolesZeros(s.preset, s.poleRadius, s.omega);
  const input = addRoadTone(dish, s.roadHz, s.roadAmp);
  const { served, accuracy } = cartServe(dish, input, system);
  const roadOmegaTrue = (2 * Math.PI * s.roadHz) / DELIVERY_FS;
  const stable = system.poles.every((p) => Math.hypot(p.re, p.im) < 1);
  return {
    system,
    input,
    served,
    accuracy,
    stable,
    roadOmega: roadOmegaTrue,
    sensedOmega: aliasedOmega(s.roadHz, s.sensorFs),
    roadGain: gainAt(system, roadOmegaTrue),
    dishGain: gainAt(system, 0),
  };
}

/**
 * Every comparison the game makes between a dish and its target: the live
 * in-lab match and its two parts (lib/dsp.ts), and the server's dish score
 * (backend/app/dsp/metrics.py dish_metrics with common_scale, as the final
 * dish is judged): both dishes scaled by the same factor (target peak 0.9),
 * SNR, best-lag correlation and the dB spectra over the 40 dB below the
 * target's peak.
 */
export function tasteCompare(target: number[], candidate: number[]) {
  const n = Math.min(target.length, candidate.length);
  const match = computeSignalSimilarity(candidate.slice(0, n), target.slice(0, n));
  const pearson = normalizedCrossCorrelation(candidate.slice(0, n), target.slice(0, n));
  const levelMatch = normalizedRootMeanSquareError(candidate.slice(0, n), target.slice(0, n));

  const scale = 0.9 / Math.max(peakAbs(target), 1e-12);
  const t = target.slice(0, n).map((v) => v * scale);
  const c = candidate.slice(0, n).map((v) => v * scale);
  const signal = t.reduce((a, v) => a + v * v, 0);
  const error = t.reduce((a, v, i) => a + (v - c[i]!) ** 2, 0);
  const snrDb = error < 1e-15 ? 100 : 10 * Math.log10((signal + 1e-15) / error);
  const correlation = bestLagCorrelation(t, c);
  const spectral = spectralSimilarity(t, c);
  const clip = (v: number) => Math.max(0, Math.min(1, v));
  const parts = {
    spectral: clip((spectral - 0.6) / 0.38),
    correlation: clip(correlation),
    snr: clip((snrDb + 5) / 30),
  };
  const dishScore = 100 * (0.4 * parts.spectral + 0.35 * parts.correlation + 0.25 * parts.snr);
  return { match, pearson, levelMatch, snrDb, correlation, spectral, parts, dishScore };
}

const peakAbs = (x: number[]) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/** The peak of the full cross-correlation over the energies (metrics.normalized_correlation). */
function bestLagCorrelation(a: number[], b: number[]): number {
  const ea = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const eb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (ea < 1e-12 || eb < 1e-12) return 0;
  let best = 0;
  for (let lag = -(b.length - 1); lag < a.length; lag++) {
    let r = 0;
    for (let i = Math.max(0, lag); i < Math.min(a.length, b.length + lag); i++) {
      r += a[i]! * b[i - lag]!;
    }
    if (Math.abs(r) > Math.abs(best)) best = r;
  }
  return Math.max(-1, Math.min(1, best / (ea * eb)));
}

/**
 * Cosine similarity of the dB magnitude spectra (zero-padded to a power of
 * two, as the server's FFT), each relative to the target's strongest bin and
 * floored 40 dB below it.
 */
function spectralSimilarity(target: number[], candidate: number[]): number {
  let size = 1;
  while (size < Math.max(target.length, candidate.length)) size <<= 1;
  const mag = (x: number[]) => {
    const out = new Array<number>(size / 2 + 1).fill(0);
    for (let k = 0; k <= size / 2; k++) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < x.length; i++) {
        const a = (2 * Math.PI * k * i) / size;
        re += x[i]! * Math.cos(a);
        im -= x[i]! * Math.sin(a);
      }
      out[k] = Math.hypot(re, im);
    }
    return out;
  };
  const mt = mag(target);
  const mc = mag(candidate);
  const ref = Math.max(...mt);
  if (ref < 1e-12) return 0;
  const db = (m: number) => Math.max(-40, 20 * Math.log10(m / ref + 1e-12)) + 40;
  const A = mt.map(db);
  const B = mc.map(db);
  const dot = A.reduce((s, v, i) => s + v * B[i]!, 0);
  const na = Math.sqrt(A.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(B.reduce((s, v) => s + v * v, 0));
  return na > 1e-12 && nb > 1e-12 ? Math.max(0, Math.min(1, dot / (na * nb))) : 0;
}

export interface FullChainDials {
  amplitude: number;
  alpha: number;
  marinate: number;
  method: CookingMethod;
  depth: number;
  /** Precision Oven with the notch on the recipe's burnt overtone. */
  oven: boolean;
  /** Delivery cart: a notch on the recipe's road vibration (off: the road reaches the dish). */
  cart: boolean;
}

/** The recipe's own dials: with these (oven and cart on) the chain reproduces its reference dish. */
export function targetDials(recipe: Recipe): FullChainDials {
  return {
    amplitude: recipe.seasoningTarget.amplitude,
    alpha: recipe.seasoningTarget.frequency,
    marinate: recipe.marinateTarget.timeScale,
    method: recipe.cookingMethod.id as CookingMethod,
    depth: 100,
    oven: true,
    cart: true,
  };
}

/**
 * A whole recipe run on clean ingredients, station by station, with the
 * recipe stations' own functions; every stage is returned for display and
 * the served dish is compared with the recipe's reference dish.
 */
export function runFullChain(recipe: Recipe, d: FullChainDials) {
  const mixed = computeCleanMixedSignal(recipe.id, recipe.ingredients, PLAYGROUND_SAMPLES);
  const seasoned = computeSeasonedSignal(mixed, d.amplitude, d.alpha, PLAYGROUND_SAMPLES);
  const marinated = computeMarinatedSignal(seasoned, d.marinate, PLAYGROUND_SAMPLES);
  const cooked = computeConvolvedSignal(marinated, d.method, d.depth, PLAYGROUND_SAMPLES);
  const burnt = servedDish(recipe.id, cooked.samples);
  const ovenFs = Math.min(64, 2 * findMaxSignalFrequency(burnt));
  const baked = d.oven
    ? applyOvenToDish(burnt, ovenFs, {
        lowGain: 1,
        midGain: 1,
        highGain: 1,
        cutoffHz: 32,
        notchActive: true,
        notchHz: ovenDefectHz(recipe.id),
      })
    : burnt;
  const served = d.cart
    ? deliverOnCart(recipe.id, baked, systemPolesZeros("notch", 0.85, roadOmega(recipe.id))).served
    : withRoadVibration(recipe.id, baked); // no suspension: the road reaches the dish
  const target = getIdealDishSignal(recipe.id, PLAYGROUND_SAMPLES);
  return {
    mixed,
    seasoned,
    marinated,
    cooked,
    burnt,
    baked,
    served,
    target,
    match: computeSignalSimilarity(served, target.samples),
  };
}
