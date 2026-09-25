import { useEffect, useState } from "react";
import { type CookedSignalData, getActiveRecipe, recipes } from "./recipes";
import {
  CHICKEN_SIGNAL_DEFINITION,
  computeSuperpositionCurve,
  getMathematicalSignal,
  MATHEMATICAL_SIGNALS,
} from "./signals";
import { getStaticCookingKernel, type CookingMethodType } from "./cooking-audio";

export type PipelineStage =
  "raw" | "filtered" | "mixed" | "seasoned" | "marinated" | "cooked" | "delivered" | "served";

export interface PipelineSignal {
  recipeId: string;
  stage: PipelineStage;
  samples: number[];
  sampleRate: number;
  duration: number;
  frequency: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Sample at a normalized phase u in [0, 1] using linear interpolation.
 */
export function sampleAt(samples: number[], normT: number): number {
  const len = samples.length;
  if (len === 0) return 0;
  if (len === 1) return samples[0] ?? 0;
  // Wrap into [0, 1)
  const wrapped = ((normT % 1) + 1) % 1;
  const exact = wrapped * (len - 1);
  const idx = Math.floor(exact);
  const frac = exact - idx;
  const s0 = samples[idx] ?? 0;
  const s1 = samples[Math.min(len - 1, idx + 1)] ?? s0;
  return s0 + frac * (s1 - s0);
}

/**
 * Resamples an array of samples to targetCount points using linear interpolation.
 */
export function resampleSignal(samples: number[], targetCount = 401): number[] {
  if (!samples || samples.length === 0) return new Array(targetCount).fill(0);
  if (samples.length === targetCount) return samples;
  const out = new Array<number>(targetCount);
  for (let i = 0; i < targetCount; i++) {
    const t = i / (targetCount - 1);
    out[i] = sampleAt(samples, t);
  }
  return out;
}

/**
 * Normalizes an array of samples into [-1, 1] with a headroom ceiling.
 */
export function normalizeSamples(samples: number[], targetPeak = 0.95): number[] {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i] ?? 0);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs === 0) return samples;
  const scale = maxAbs > targetPeak ? targetPeak / maxAbs : 1.0;
  return samples.map((s) => Math.max(-1.0, Math.min(1.0, s * scale)));
}

/**
 * Filtered ingredient storage functions.
 * Retains washed/filtered samples in localStorage so mixing consumes real player output.
 */
export function getFilteredIngredients(recipeId: string): Record<string, number[]> {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_filtered_ingredients_${recipeId}`;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as Record<string, number[]>;
      }
    } catch {
      // ignore
    }
  }
  return {};
}

export function getFilteredIngredient(recipeId: string, ingredientName: string): number[] | null {
  const store = getFilteredIngredients(recipeId);
  const key = ingredientName.toLowerCase();
  return store[key] ?? null;
}

export function saveFilteredIngredient(
  recipeId: string,
  ingredientName: string,
  samples: number[],
) {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_filtered_ingredients_${recipeId}`;
      const current = getFilteredIngredients(recipeId);
      current[ingredientName.toLowerCase()] = samples;
      window.localStorage.setItem(key, JSON.stringify(current));
      window.dispatchEvent(new Event("wavebakery_filtered_ingredients_changed"));
      invalidateDownstreamStages(recipeId, "filtered");
    } catch {
      // ignore
    }
  }
}

export function clearFilteredIngredients(recipeId: string) {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_filtered_ingredients_${recipeId}`;
      window.localStorage.removeItem(key);
      window.dispatchEvent(new Event("wavebakery_filtered_ingredients_changed"));
    } catch {
      // ignore
    }
  }
}

/**
 * Resolves the actual discrete signal samples for a recipe ingredient.
 * Uses exact mathematical / parametric functions or decoded Chicken WAV PCM samples.
 */
export function getRecipeIngredientSamples(
  recipeId: string,
  ingredientName: string,
  options: {
    noise?: number;
    seed?: number;
    freq?: number;
    sampleCount?: number;
    amplitude?: number;
  } = {},
): number[] {
  const { noise = 0, seed = 0, sampleCount = 401, amplitude = 1.0 } = options;

  // 1. Look up ingredient details from the recipe if available
  const recipe = recipes.find((r) => r.id === recipeId) ?? getActiveRecipe();
  const detail = recipe.ingredientDetails.find(
    (d) => d.name.toLowerCase() === ingredientName.toLowerCase(),
  );
  const baseFreq = options.freq ?? detail?.freq ?? 4;

  // 2. Check for Chicken recorded audio signal
  if (ingredientName.toLowerCase() === "chicken") {
    return CHICKEN_SIGNAL_DEFINITION.generateSamples({
      freq: baseFreq,
      amplitude,
      sampleCount,
      noise,
    });
  }

  // 3. Check mathematical signals catalog
  const mathSignal = getMathematicalSignal(ingredientName);
  if (mathSignal) {
    const amp =
      options.amplitude !== undefined ? options.amplitude : (mathSignal.defaultAmplitude ?? 1.0);
    return mathSignal.generateSamples({
      freq: baseFreq,
      amplitude: amp,
      phase: seed,
      noise,
      sampleCount,
    });
  }

  // Fallback if ingredient definition is generic
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    const n = noise ? Math.sin(i * 12.9898 + (seed || 1) * 78.233) * noise * 0.485 : 0;
    samples.push(Math.sin(t * Math.PI * 2 * baseFreq + seed) * amplitude - n);
  }
  return samples;
}

/**
 * Computes the discrete mixed signal resulting from the superposition of
 * actual recipe ingredient signals in the bowl.
 *
 * Each ingredient's samples come from getMixingIngredientSamples — the exact
 * samples the Generate, Filtering and Mixing labs draw (phase 0, the same
 * frequency rule, the player's filtered output for washed ingredients). It
 * used to regenerate them with a per-ingredient phase offset
 * (seed = (index + 1) * 0.85) and a different frequency fallback, so the
 * saved mix (what Seasoning and every later stage received) did not match the
 * waveform the Mixing lab showed.
 */
export function computeMixedSignal(
  recipeId: string,
  ingredientNames: string[],
  sampleCount = 401,
): PipelineSignal {
  const recipe = recipes.find((r) => r.id === recipeId) ?? getActiveRecipe();
  const effectiveIngredients = ingredientNames.length > 0 ? ingredientNames : recipe.ingredients;
  return mixFromSamples(
    recipe.id,
    effectiveIngredients,
    getMixingIngredientSamples(recipe.id, effectiveIngredients, sampleCount),
    sampleCount,
  );
}

/**
 * Superposition of per-ingredient samples: one ingredient passes straight
 * through; several are summed, scaled by 1/sqrt(K) and peak-limited to 0.95.
 */
function mixFromSamples(
  recipeId: string,
  names: string[],
  samplesByName: Record<string, number[]>,
  sampleCount: number,
  extraMetadata: Record<string, unknown> = {},
  curveOptions: { clean?: boolean } = {},
): PipelineSignal {
  const recipe = recipes.find((r) => r.id === recipeId) ?? getActiveRecipe();
  const freqOf = (name: string, idx: number) => {
    const detailIndex = recipe.ingredientDetails.findIndex(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
    const resolvedIdx = detailIndex >= 0 ? detailIndex : idx;
    return recipe.ingredientDetails[detailIndex]?.freq ?? 2 + (resolvedIdx % 4) * 1.5;
  };

  let samples: number[];
  if (names.length === 1) {
    samples = [...(samplesByName[names[0]!] ?? new Array<number>(sampleCount).fill(0))];
  } else {
    const summed = new Array<number>(sampleCount).fill(0);
    for (const name of names) {
      const ing = samplesByName[name] ?? [];
      for (let i = 0; i < sampleCount; i++) summed[i] = (summed[i] ?? 0) + (ing[i] ?? 0);
    }
    const normFactor = 1 / Math.sqrt(Math.max(1, names.length));
    samples = normalizeSamples(
      summed.map((v) => v * normFactor),
      0.95,
    );
  }

  const count = Math.max(1, names.length);
  const totalFreq = names.reduce((sum, n, i) => sum + freqOf(n, i), 0);
  const frequency =
    names.length === 1 ? freqOf(names[0]!, 0) : Math.max(2, Math.round(totalFreq / count));

  return withMixCurve(
    {
      recipeId: recipe.id,
      stage: "mixed",
      samples,
      sampleRate: 44100,
      duration: 3.0,
      frequency,
      timestamp: Date.now(),
      metadata: { ingredients: names, ...extraMetadata },
    },
    curveOptions,
  );
}

/**
 * Per-ingredient 1D samples exactly as the Mixing lab builds them for its
 * graph (filtered samples if washed, else generated with seed 0).
 */
export function getMixingIngredientSamples(
  recipeId: string,
  ingredientNames: string[],
  sampleCount = 401,
  clean = false,
): Record<string, number[]> {
  const recipe = recipes.find((r) => r.id === recipeId) ?? getActiveRecipe();
  const map: Record<string, number[]> = {};
  ingredientNames.forEach((name, idx) => {
    const filtered = clean ? null : getFilteredIngredient(recipe.id, name);
    if (filtered && filtered.length > 0) {
      // The server's filtered plot can have a different length; stretch it
      // over the same window (end-to-end, no wrap-around).
      map[name] =
        filtered.length === sampleCount
          ? filtered
          : Array.from({ length: sampleCount }, (_, i) => {
              const pos = (i / (sampleCount - 1)) * (filtered.length - 1);
              const k = Math.min(filtered.length - 2, Math.floor(pos));
              const a = filtered[k] ?? 0;
              return a + (pos - k) * ((filtered[k + 1] ?? a) - a);
            });
      return;
    }
    const detailIndex = recipe.ingredientDetails.findIndex(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
    const detail = recipe.ingredientDetails[detailIndex];
    const resolvedIdx = detailIndex >= 0 ? detailIndex : idx;
    map[name] = getRecipeIngredientSamples(recipe.id, name, {
      freq: detail?.freq ?? 2 + (resolvedIdx % 4) * 1.5,
      seed: 0,
      noise: detail?.washable && !clean ? 0.85 : 0.0,
      sampleCount,
    });
  });
  return map;
}

/**
 * If the mix contains a parametric ingredient, the Mixing lab shows a 2D
 * superposition curve. Attach that exact curve to the mixed signal so every
 * stage after Mixing can draw the shape the player saw.
 */
export function withMixCurve(
  signal: PipelineSignal,
  options: { clean?: boolean } = {},
): PipelineSignal {
  const names = signal.metadata?.["ingredients"];
  if (!Array.isArray(names) || names.length === 0) return signal;
  const ingredientNames = names as string[];
  const curve = computeSuperpositionCurve(
    ingredientNames.map((name) => ({ name })),
    getMixingIngredientSamples(signal.recipeId, ingredientNames, 401, options.clean ?? false),
  );
  if (!curve) return signal;
  // Samples are left untouched: they carry the player's filtered ingredients
  // into audio and scoring (see tests/filtering-mixing-handoff.test.ts). The
  // curve is the visual track every later stage transforms alongside them.
  return { ...signal, metadata: { ...signal.metadata, curve: curve.points } };
}

/**
 * Computes the seasoned signal by applying amplitude and frequency scaling
 * to the actual mixed signal.
 */
export function computeSeasonedSignal(
  mixedSignal: PipelineSignal,
  amplitude: number,
  freqScale: number,
  sampleCount = 401,
): PipelineSignal {
  const inSamples =
    mixedSignal.samples.length > 0
      ? mixedSignal.samples
      : computeMixedSignal(mixedSignal.recipeId, []).samples;

  const effectiveFreq = Math.max(0.05, freqScale);

  // y[n] = A · x(α·n): α > 1 compresses (more cycles), α < 1 stretches.
  // Output is NOT renormalized, otherwise the amplitude dial would be undone.
  return {
    recipeId: mixedSignal.recipeId,
    stage: "seasoned",
    samples: timeScaleSamples(inSamples, effectiveFreq, amplitude, sampleCount),
    sampleRate: mixedSignal.sampleRate,
    duration: mixedSignal.duration,
    frequency: mixedSignal.frequency * effectiveFreq,
    timestamp: Date.now(),
    metadata: {
      amplitude,
      freqScale,
      ...transformCurve(mixedSignal, amplitude, effectiveFreq),
    },
  };
}

/**
 * out[n] = A · x(α·n) over the same window. Past the end of x the signal
 * repeats periodically, so α > 1 fills the window with extra cycles.
 */
function timeScaleSamples(
  inSamples: number[],
  alpha: number,
  amplitude: number,
  sampleCount: number,
): number[] {
  const span = inSamples.length - 1;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = (i / (sampleCount - 1)) * span * alpha;
    const srcIndex = span > 0 ? t % span : 0;
    const idx = Math.floor(srcIndex);
    const frac = srcIndex - idx;
    const s0 = inSamples[idx] ?? 0;
    const s1 = inSamples[idx + 1] ?? s0;
    samples.push((s0 + frac * (s1 - s0)) * amplitude);
  }
  return samples;
}

export type CurvePoint = { x: number; y: number };

/** The 2D parametric Mixing curve a signal carries (mixed → seasoned → marinated). */
export function getSignalCurve(signal: PipelineSignal | null | undefined): CurvePoint[] | null {
  const curve = signal?.metadata?.["curve"];
  return Array.isArray(curve) && curve.length > 1 ? (curve as CurvePoint[]) : null;
}

/**
 * Draws a pipeline signal: its Mixing curve when it has one, otherwise its 1D
 * samples. The curve's y is measured against the ORIGINAL mix's centre and
 * half-height (carried along in metadata), so amplitude changes stay visible.
 */
export function pipelineSignalToPath(
  signal: PipelineSignal,
  width: number,
  height: number,
  yScale = 0.34,
): string {
  const curve = getSignalCurve(signal);
  const mid = signal.metadata?.["curveYMid"];
  const half = signal.metadata?.["curveYHalf"];
  const pts: string[] = [];
  if (curve && typeof mid === "number" && typeof half === "number" && half > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of curve) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
    const spanX = maxX - minX || 1;
    const pad = 16;
    curve.forEach((p, i) => {
      const x = pad + ((p.x - minX) / spanX) * (width - 2 * pad);
      const y = height / 2 - ((p.y - mid) / half) * height * yScale;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    });
    return pts.join(" ");
  }
  const len = signal.samples.length;
  if (len === 0) return "";
  signal.samples.forEach((s, i) => {
    const x = (i / (len - 1)) * width;
    const y = height / 2 - (s ?? 0) * height * yScale;
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  });
  return pts.join(" ");
}

/** Centre line and half-height the curve's y is measured against. */
function curveFrame(signal: PipelineSignal): { mid: number; half: number } | null {
  const curve = getSignalCurve(signal);
  if (!curve) return null;
  const mid = signal.metadata?.["curveYMid"];
  const half = signal.metadata?.["curveYHalf"];
  if (typeof mid === "number" && typeof half === "number" && half > 0) return { mid, half };
  // A raw mixed signal: its samples were derived as ((y - mid) / half) · 0.95.
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of curve) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { mid: (minY + maxY) / 2, half: (maxY - minY) / 2 || 1 };
}

/**
 * For stages that process the signal along its own time axis (cooking
 * convolution, chop, caramelize, oven reconstruction): the curve keeps the
 * input's x-positions, and whatever the stage did to the samples
 * (output − input) is applied to the curve's height at the same instant.
 */
export function carryCurve(output: PipelineSignal, input: PipelineSignal): PipelineSignal {
  const curve = getSignalCurve(input);
  const frame = curveFrame(input);
  const out = output.samples;
  const inp = input.samples;
  if (!curve || !frame || out.length < 2 || inp.length < 2) return output;
  const at = (arr: number[], u: number) => {
    const pos = u * (arr.length - 1);
    const idx = Math.min(arr.length - 2, Math.floor(pos));
    return arr[idx]! + (pos - idx) * (arr[idx + 1]! - arr[idx]!);
  };
  const last = curve.length - 1;
  const newCurve = curve.map((p, i) => {
    const u = i / last;
    return { x: p.x, y: p.y + ((at(out, u) - at(inp, u)) / 0.95) * frame.half };
  });
  return {
    ...output,
    metadata: {
      ...output.metadata,
      curve: newCurve,
      curveYMid: frame.mid,
      curveYHalf: frame.half,
    },
  };
}

/**
 * SVG path for a bare sample array that lives on `ref`'s time axis: drawn
 * along ref's Mixing curve when it has one, else as a plain waveform.
 */
export function samplesAlongCurvePath(
  samples: number[],
  ref: PipelineSignal | null | undefined,
  width: number,
  height: number,
  yScale = 0.34,
): string {
  const base: PipelineSignal = ref
    ? { ...ref, samples }
    : {
        recipeId: "",
        stage: "cooked",
        samples,
        sampleRate: 44100,
        duration: 3,
        frequency: 4,
        timestamp: 0,
      };
  return pipelineSignalToPath(ref ? carryCurve(base, ref) : base, width, height, yScale);
}

/**
 * SVG coordinates of the sample (t ∈ [0,1], value) on `ref`'s curve, for
 * sample-point markers drawn on top of samplesAlongCurvePath.
 */
export function curvePointToSvg(
  ref: PipelineSignal | null | undefined,
  t: number,
  value: number,
  width: number,
  height: number,
  yScale = 0.34,
): { x: number; y: number } {
  const curve = ref ? getSignalCurve(ref) : null;
  const frame = ref ? curveFrame(ref) : null;
  const y = height / 2 - (curve && frame ? value / 0.95 : value) * height * yScale;
  if (!curve || !frame) return { x: t * width, y };
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of curve) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  const pos = Math.max(0, Math.min(1, t)) * (curve.length - 1);
  const idx = Math.min(curve.length - 2, Math.floor(pos));
  const cx = curve[idx]!.x + (pos - idx) * (curve[idx + 1]!.x - curve[idx]!.x);
  const pad = 16;
  return { x: pad + ((cx - minX) / (maxX - minX || 1)) * (width - 2 * pad), y };
}

/**
 * Applies the same transform as timeScaleSamples to the signal's Mixing
 * curve: y is scaled by A about the mix's centre line, and the parameter is
 * sped up by α. Past the end the curve repeats, shifted along x so it keeps
 * moving right.
 */
function transformCurve(
  input: PipelineSignal,
  amplitude: number,
  alpha: number,
): { curve?: CurvePoint[]; curveYMid?: number; curveYHalf?: number } {
  const curve = getSignalCurve(input);
  if (!curve) return {};
  let midY = input.metadata?.["curveYMid"];
  let halfY = input.metadata?.["curveYHalf"];
  if (typeof midY !== "number" || typeof halfY !== "number") {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of curve) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    midY = (minY + maxY) / 2;
    halfY = (maxY - minY) / 2;
  }
  const mid = midY as number;
  const last = curve.length - 1;
  const dx = curve[last]!.x - curve[0]!.x;
  const out: CurvePoint[] = [];
  for (let i = 0; i <= last; i++) {
    const t = (i / last) * last * alpha;
    const period = Math.floor(t / last);
    const local = t - period * last;
    const idx = Math.min(last - 1, Math.floor(local));
    const frac = local - idx;
    const p0 = curve[idx]!;
    const p1 = curve[idx + 1]!;
    out.push({
      x: p0.x + frac * (p1.x - p0.x) + period * dx,
      y: mid + (p0.y + frac * (p1.y - p0.y) - mid) * amplitude,
    });
  }
  return { curve: out, curveYMid: mid, curveYHalf: halfY as number };
}

/**
 * Computes the marinated signal: a time delay y(t) = x(t − t0) with zero
 * padding, t0 = timeScale seconds of the signal's duration. This matches the
 * backend's stage_marinate (a time shift in seconds). The Mixing curve is
 * delayed the same way: a flat lead-in at the centre line, then the curve.
 */
export function computeMarinatedSignal(
  seasonedSignal: PipelineSignal,
  timeScale: number,
  sampleCount = 401,
): PipelineSignal {
  const samples: number[] = [];
  const inSamples =
    seasonedSignal.samples.length > 0
      ? seasonedSignal.samples
      : computeMixedSignal(seasonedSignal.recipeId, []).samples;

  const effectiveScale = Math.max(0.01, timeScale);
  const shiftSamples = Math.round(
    (effectiveScale / Math.max(1, seasonedSignal.duration)) * sampleCount,
  );

  for (let i = 0; i < sampleCount; i++) {
    const srcNorm = (i - shiftSamples) / (sampleCount - 1);
    if (srcNorm >= 0 && srcNorm <= 1) {
      samples.push(sampleAt(inSamples, srcNorm));
    } else {
      samples.push(0);
    }
  }

  return {
    recipeId: seasonedSignal.recipeId,
    stage: "marinated",
    // No renormalisation: the seasoning amplitude must survive to the final
    // comparison (rescaling here made an over-seasoned dish score 100%).
    samples,
    sampleRate: seasonedSignal.sampleRate,
    duration: seasonedSignal.duration * effectiveScale,
    frequency: seasonedSignal.frequency / effectiveScale,
    timestamp: Date.now(),
    metadata: {
      timeScale,
      ...delayCurve(seasonedSignal, shiftSamples / (sampleCount - 1)),
    },
  };
}

/** Delays the signal's Mixing curve by a fraction d of the window. */
function delayCurve(
  input: PipelineSignal,
  d: number,
): { curve?: CurvePoint[]; curveYMid?: number; curveYHalf?: number } {
  const curve = getSignalCurve(input);
  const frame = curveFrame(input);
  if (!curve || !frame) return {};
  const last = curve.length - 1;
  const x0 = curve[0]!.x;
  const spanX = curve[last]!.x - x0;
  const out = curve.map((_, i) => {
    const u = i / last - d;
    if (u < 0) return { x: x0 + u * spanX, y: frame.mid };
    const pos = u * last;
    const idx = Math.min(last - 1, Math.floor(pos));
    const p0 = curve[idx]!;
    const p1 = curve[idx + 1]!;
    return { x: p0.x + (pos - idx) * (p1.x - p0.x), y: p0.y + (pos - idx) * (p1.y - p0.y) };
  });
  return { curve: out, curveYMid: frame.mid, curveYHalf: frame.half };
}

/**
 * Convolves the marinated input signal x[n] with the cooking impulse response h[k].
 * Slider position pos (0 to 100) controls time shift tau and convolution depth.
 * Ensures energy normalization and headroom limitation.
 */
export function computeConvolvedSignal(
  marinatedSignal: PipelineSignal,
  methodId: "grill" | "fry" | "bake" | "boil",
  pos: number,
  sampleCount = 401,
): PipelineSignal {
  const inSamples =
    marinatedSignal.samples.length > 0
      ? marinatedSignal.samples
      : computeMixedSignal(marinatedSignal.recipeId, []).samples;

  const kernel = getStaticCookingKernel(methodId as CookingMethodType);
  const kLen = kernel.length;

  const convolved = new Array<number>(sampleCount).fill(0);
  const tau = Math.max(0, Math.min(100, pos)) / 100;
  const shiftSamples = Math.round(tau * 30);

  // Circular discrete convolution: y[n] = sum_k x[(n-k-shift) mod N] * h[k].
  // Wraparound (not zero-padded) boundary handling, consistent with the
  // periodic-snippet model the rest of the pipeline uses (sampleAt wraps too).
  for (let n = 0; n < sampleCount; n++) {
    let acc = 0;
    for (let k = 0; k < kLen; k++) {
      const idx = n - k - shiftSamples;
      const xVal = sampleAt(inSamples, (((idx / (sampleCount - 1)) % 1) + 1) % 1);
      acc += xVal * (kernel[k] ?? 0);
    }
    convolved[n] = acc;
  }

  // Blend dry (uncooked) and wet (convolved) according to slider position
  const wetMix = Math.min(1, tau * 1.15);
  const outSamples = new Array<number>(sampleCount);
  for (let n = 0; n < sampleCount; n++) {
    const dry = sampleAt(inSamples, n / (sampleCount - 1));
    const wet = convolved[n] ?? 0;
    let s = (1 - wetMix) * dry + wetMix * wet;
    if (methodId === "fry" && tau > 0.1) {
      const crackle = Math.sin(n * 27.13 + 7.4) * 0.04 * tau;
      s += crackle;
    }
    outSamples[n] = s;
  }

  // The kernels are normalised (sum |h| = 1), so the output cannot exceed the
  // input's level; no rescaling, which would erase the seasoning amplitude.
  const finalSamples = outSamples;
  const freqOffset = methodId === "fry" ? 2.5 : methodId === "grill" ? 1.5 : 0.8;

  return carryCurve(
    {
      recipeId: marinatedSignal.recipeId,
      stage: "cooked",
      samples: finalSamples,
      sampleRate: marinatedSignal.sampleRate,
      duration: marinatedSignal.duration,
      frequency: marinatedSignal.frequency + freqOffset,
      timestamp: Date.now(),
      metadata: {
        methodId,
        pos,
      },
    },
    marinatedSignal,
  );
}

/**
 * Computes the pristine, zero-noise mixed signal resulting from canonical ingredient models.
 * Used exclusively to construct the true expected/reference dish target signal.
 */
export function computeCleanMixedSignal(
  recipeId: string,
  ingredientNames?: string[],
  sampleCount = 401,
): PipelineSignal {
  const recipe = recipes.find((r) => r.id === recipeId) ?? getActiveRecipe();
  const effectiveIngredients =
    ingredientNames && ingredientNames.length > 0 ? ingredientNames : recipe.ingredients;

  // Built exactly like the player's mix (same per-ingredient samples, phase
  // and frequency rule, same superposition and curve) but from clean
  // ingredients, so any difference from the player's dish comes from the
  // player's choices, not from two different generators.
  return mixFromSamples(
    recipe.id,
    effectiveIngredients,
    getMixingIngredientSamples(recipe.id, effectiveIngredients, sampleCount, true),
    sampleCount,
    { clean: true },
    { clean: true },
  );
}

/**
 * Computes the ideal reference dish signal for a recipe using its
 * canonical ingredient signals (pristine/clean) and target parameters through all stages.
 */
export function getIdealDishSignal(recipeId: string, sampleCount = 401): PipelineSignal {
  const recipe = recipes.find((r) => r.id === recipeId) ?? getActiveRecipe();
  // 1. Pristine clean superposition
  const cleanMixed = computeCleanMixedSignal(recipe.id, recipe.ingredients, sampleCount);
  // 2. Seasoned with recipe target specs
  const seasoned = computeSeasonedSignal(
    cleanMixed,
    recipe.seasoningTarget.amplitude,
    recipe.seasoningTarget.frequency,
    sampleCount,
  );
  // 3. Marinated with recipe target timeScale
  const marinated = computeMarinatedSignal(seasoned, recipe.marinateTarget.timeScale, sampleCount);
  // 4. Convolved with recipe target cooking method at 100% depth
  const cooked = computeConvolvedSignal(
    marinated,
    recipe.cookingMethod.id as "grill" | "fry" | "bake" | "boil",
    100,
    sampleCount,
  );
  return cooked;
}

/**
 * Saves the expected reference signal for a recipe in localStorage.
 */
export function saveExpectedSignal(recipeId: string, signal: PipelineSignal) {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_expected_signal_${recipeId}`;
      window.localStorage.setItem(key, JSON.stringify(signal));
      window.dispatchEvent(new Event("wavebakery_expected_signal_changed"));
    } catch {
      // ignore
    }
  }
}

/**
 * Retrieves the expected target signal for a recipe from localStorage,
 * computing and persisting it if not already stored.
 */
export function getExpectedSignal(recipeId: string, sampleCount = 401): PipelineSignal {
  const ideal = getIdealDishSignal(recipeId, sampleCount);
  saveExpectedSignal(recipeId, ideal);
  return ideal;
}

export function getOrSaveExpectedSignal(recipeId: string, sampleCount = 401): PipelineSignal {
  return getExpectedSignal(recipeId, sampleCount);
}

/**
 * Precomputes and stores expected reference signals for all master recipes.
 * Call this before cooking begins so every recipe's expected signal is saved in advance.
 */
export function initializeAllExpectedSignals(sampleCount = 401): Record<string, PipelineSignal> {
  const all: Record<string, PipelineSignal> = {};
  for (const r of recipes) {
    const sig = getExpectedSignal(r.id, sampleCount);
    all[r.id] = sig;
  }
  return all;
}

/**
 * React hook to subscribe to the expected signal of a recipe.
 */
export function useExpectedSignal(recipeId?: string, sampleCount = 401): PipelineSignal {
  const activeId = recipeId ?? getActiveRecipe().id;
  const [signal, setSignalState] = useState<PipelineSignal>(() =>
    getExpectedSignal(activeId, sampleCount),
  );

  useEffect(() => {
    const handler = () => {
      setSignalState(getExpectedSignal(activeId, sampleCount));
    };
    window.addEventListener("wavebakery_expected_signal_changed", handler);
    window.addEventListener("wavebakery_recipe_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_expected_signal_changed", handler);
      window.removeEventListener("wavebakery_recipe_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [activeId, sampleCount]);

  return signal;
}

export function hasPipelineStageSignal(recipeId: string, stage: PipelineStage): boolean {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_pipeline_${recipeId}_${stage}`;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as PipelineSignal;
        return Array.isArray(parsed?.samples) && parsed.samples.length > 0;
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function clearPipelineStageSignal(recipeId: string, stage: PipelineStage) {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_pipeline_${recipeId}_${stage}`;
      window.localStorage.removeItem(key);
      window.dispatchEvent(new Event("wavebakery_pipeline_signal_changed"));
    } catch {
      // ignore
    }
  }
}

export function invalidateDownstreamStages(
  recipeId: string,
  changedStage: PipelineStage | "filtered",
) {
  if (typeof window === "undefined") return;

  const stageOrder: (PipelineStage | "filtered")[] = [
    "filtered",
    "mixed",
    "seasoned",
    "marinated",
    "cooked",
    "delivered",
    "served",
  ];

  const changedIdx = stageOrder.indexOf(changedStage);
  if (changedIdx === -1) return;

  const stagesToInvalidate = stageOrder.slice(changedIdx + 1);

  for (const st of stagesToInvalidate) {
    if (st === "cooked") {
      window.localStorage.removeItem(`wavebakery_pipeline_${recipeId}_cooked`);
      window.localStorage.removeItem(`wavebakery_cooked_signal_${recipeId}`);
    } else if (st === "delivered") {
      window.localStorage.removeItem(`wavebakery_pipeline_${recipeId}_delivered`);
      try {
        const cookedKey = `wavebakery_cooked_signal_${recipeId}`;
        const stored = window.localStorage.getItem(cookedKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.metadata) {
            delete parsed.metadata.ovenSamplingRate;
            delete parsed.metadata.spectrumMatchPercent;
            delete parsed.metadata.timeDomainSimilarity;
            delete parsed.metadata.overallScore;
            window.localStorage.setItem(cookedKey, JSON.stringify(parsed));
          }
        }
      } catch {
        // ignore
      }
    } else {
      window.localStorage.removeItem(`wavebakery_pipeline_${recipeId}_${st}`);
    }
  }

  // Also clear session fields for invalidated stages
  try {
    const sessionKey = "wavebakery_recipe_session";
    const storedSession = window.localStorage.getItem(sessionKey);
    if (storedSession) {
      const sess = JSON.parse(storedSession);
      if (stagesToInvalidate.includes("mixed")) {
        delete sess.mixingAccuracy;
      }
      if (stagesToInvalidate.includes("seasoned")) {
        delete sess.seasonGain;
        delete sess.seasonFreq;
        delete sess.seasoningAccuracy;
      }
      if (stagesToInvalidate.includes("marinated")) {
        delete sess.marinateTime;
        delete sess.marinatingAccuracy;
      }
      if (stagesToInvalidate.includes("cooked")) {
        delete sess.cookingAppliance;
        delete sess.cookingPos;
        delete sess.cookingAccuracy;
      }
      if (stagesToInvalidate.includes("delivered")) {
        delete sess.deliveryAccuracy;
        delete sess.ovenSettings;
      }
      if (stagesToInvalidate.includes("served")) {
        delete sess.systemAccuracy;
      }
      window.localStorage.setItem(sessionKey, JSON.stringify(sess));
      window.dispatchEvent(new Event("wavebakery_session_changed"));
    }
  } catch {
    // ignore
  }

  window.dispatchEvent(new Event("wavebakery_pipeline_signal_changed"));
  window.dispatchEvent(new Event("wavebakery_cooked_signal_changed"));
}

/**
 * Deterministic fallback signal for any stage of a recipe.
 */
export function getDefaultPipelineSignal(
  recipeId: string,
  stage: PipelineStage,
  sampleCount = 401,
): PipelineSignal {
  const recipe = recipes.find((r) => r.id === recipeId) ?? getActiveRecipe();
  const mixed = hasPipelineStageSignal(recipe.id, "mixed")
    ? getPipelineStageSignal(recipe.id, "mixed", sampleCount)
    : computeMixedSignal(recipe.id, recipe.ingredients, sampleCount);

  if (stage === "raw" || stage === "filtered" || stage === "mixed") {
    return mixed;
  }

  const seasoned = hasPipelineStageSignal(recipe.id, "seasoned")
    ? getPipelineStageSignal(recipe.id, "seasoned", sampleCount)
    : computeSeasonedSignal(
        mixed,
        recipe.seasoningTarget.amplitude,
        recipe.seasoningTarget.frequency,
        sampleCount,
      );
  if (stage === "seasoned") return seasoned;

  const marinated = hasPipelineStageSignal(recipe.id, "marinated")
    ? getPipelineStageSignal(recipe.id, "marinated", sampleCount)
    : computeMarinatedSignal(seasoned, recipe.marinateTarget.timeScale, sampleCount);
  if (stage === "marinated") return marinated;

  const cooked = hasPipelineStageSignal(recipe.id, "cooked")
    ? getPipelineStageSignal(recipe.id, "cooked", sampleCount)
    : computeConvolvedSignal(
        marinated,
        recipe.cookingMethod.id as "grill" | "fry" | "bake" | "boil",
        100,
        sampleCount,
      );
  if (stage === "cooked") return cooked;

  if (stage === "served" && hasPipelineStageSignal(recipe.id, "served")) {
    return getPipelineStageSignal(recipe.id, "served", sampleCount);
  }
  if (stage === "delivered" || stage === "served") {
    if (hasPipelineStageSignal(recipe.id, "delivered")) {
      return getPipelineStageSignal(recipe.id, "delivered", sampleCount);
    }
    return cooked;
  }

  return cooked;
}

/**
 * LocalStorage persistence for pipeline stage signals.
 */
export function savePipelineStageSignal(
  recipeId: string,
  stage: PipelineStage,
  signal: PipelineSignal,
) {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_pipeline_${recipeId}_${stage}`;
      const normalizedSignal: PipelineSignal = {
        ...signal,
        samples:
          signal.samples && signal.samples.length !== 401 && signal.samples.length > 0
            ? resampleSignal(signal.samples, 401)
            : signal.samples,
      };
      window.localStorage.setItem(key, JSON.stringify(normalizedSignal));
      window.dispatchEvent(new Event("wavebakery_pipeline_signal_changed"));
    } catch (e) {
      console.error("[savePipelineStageSignal] failed", recipeId, stage, e);
    }
  }
}

export function getPipelineStageSignal(
  recipeId: string,
  stage: PipelineStage,
  sampleCount = 401,
): PipelineSignal {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_pipeline_${recipeId}_${stage}`;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        let parsed = JSON.parse(stored) as PipelineSignal;
        if (parsed && Array.isArray(parsed.samples) && parsed.samples.length > 0) {
          // Mixes saved before the curve was stored: rebuild it from the
          // saved ingredient list so Seasoning still gets the Mixing curve.
          if (stage === "mixed" && !getSignalCurve(parsed)) {
            parsed = withMixCurve(parsed);
          }
          // Seasoned/marinated signals saved without the curve (or before
          // curveYHalf existed): recompute from the upstream stage using the
          // player's saved dials, so the curve keeps flowing downstream.
          if (stage === "seasoned" && typeof parsed.metadata?.["curveYHalf"] !== "number") {
            const mixed = getPipelineStageSignal(recipeId, "mixed", sampleCount);
            const amp = parsed.metadata?.["amplitude"];
            const fs = parsed.metadata?.["freqScale"];
            if (getSignalCurve(mixed) && typeof amp === "number" && typeof fs === "number") {
              parsed = computeSeasonedSignal(mixed, amp, fs, sampleCount);
            }
          }
          if (stage === "marinated" && typeof parsed.metadata?.["curveYHalf"] !== "number") {
            const seasoned = getPipelineStageSignal(recipeId, "seasoned", sampleCount);
            const ts = parsed.metadata?.["timeScale"];
            if (getSignalCurve(seasoned) && typeof ts === "number") {
              parsed = computeMarinatedSignal(seasoned, ts, sampleCount);
            }
          }
          // Cooked/delivered keep the time axis, so the curve is re-attached
          // from the stage before without needing that stage's dials.
          if (
            (stage === "cooked" || stage === "delivered") &&
            typeof parsed.metadata?.["curveYHalf"] !== "number"
          ) {
            const upstream = getPipelineStageSignal(
              recipeId,
              stage === "cooked" ? "marinated" : "cooked",
              sampleCount,
            );
            parsed = carryCurve(parsed, upstream);
          }
          if (parsed.samples.length !== sampleCount) {
            return {
              ...parsed,
              samples: resampleSignal(parsed.samples, sampleCount),
            };
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error("[getPipelineStageSignal] failed, falling back to default", recipeId, stage, e);
    }
  }
  return getDefaultPipelineSignal(recipeId, stage, sampleCount);
}

export function usePipelineStageSignal(
  recipeId: string | undefined,
  stage: PipelineStage,
  sampleCount = 401,
): [PipelineSignal, (sig: PipelineSignal) => void] {
  const activeId = recipeId ?? getActiveRecipe().id;
  const [signal, setSignalState] = useState<PipelineSignal>(() =>
    getPipelineStageSignal(activeId, stage, sampleCount),
  );

  useEffect(() => {
    const handler = () => {
      setSignalState(getPipelineStageSignal(activeId, stage, sampleCount));
    };
    window.addEventListener("wavebakery_pipeline_signal_changed", handler);
    window.addEventListener("wavebakery_recipe_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_pipeline_signal_changed", handler);
      window.removeEventListener("wavebakery_recipe_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [activeId, stage, sampleCount]);

  const update = (newSignal: PipelineSignal) => {
    savePipelineStageSignal(activeId, stage, newSignal);
    setSignalState(newSignal);
  };

  return [signal, update];
}
