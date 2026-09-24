import { useEffect, useState } from "react";
import { type CookedSignalData, getActiveRecipe, recipes } from "./recipes";
import { CHICKEN_SIGNAL_DEFINITION, getMathematicalSignal, MATHEMATICAL_SIGNALS } from "./signals";
import { getStaticCookingKernel, type CookingMethodType } from "./cooking-audio";

export type PipelineStage = "raw" | "filtered" | "mixed" | "seasoned" | "marinated" | "cooked" | "delivered";

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
 * Consumes the player's actual filtered output for washable ingredients.
 */
export function computeMixedSignal(
  recipeId: string,
  ingredientNames: string[],
  sampleCount = 401,
): PipelineSignal {
  const recipe = recipes.find((r) => r.id === recipeId) ?? getActiveRecipe();
  const effectiveIngredients = ingredientNames.length > 0 ? ingredientNames : recipe.ingredients;

  // When exactly one ingredient is in the bowl, its mixed signal IS that ingredient directly:
  // preserve identical samples, amplitude, and deterministic detail seed without re-normalization.
  if (effectiveIngredients.length === 1) {
    const name = effectiveIngredients[0]!;
    const detail = recipe.ingredientDetails.find(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
    const detailIndex = recipe.ingredientDetails.findIndex(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
    const freq = detail?.freq ?? 3;
    const seed = (detailIndex >= 0 ? detailIndex + 1 : 1) * 0.85;

    let singleSamples: number[] | null = null;
    if (detail?.washable) {
      const storedFiltered = getFilteredIngredient(recipe.id, name);
      if (storedFiltered && storedFiltered.length > 0) {
        if (storedFiltered.length === sampleCount) {
          singleSamples = [...storedFiltered];
        } else {
          singleSamples = [];
          for (let i = 0; i < sampleCount; i++) {
            const u = i / (sampleCount - 1);
            singleSamples.push(sampleAt(storedFiltered, u));
          }
        }
      }
    }

    if (!singleSamples) {
      const noise = detail?.washable ? 0.85 : 0.0;
      singleSamples = getRecipeIngredientSamples(recipe.id, name, {
        noise,
        seed,
        freq,
        sampleCount,
        amplitude: 1.0,
      });
    }

    return {
      recipeId: recipe.id,
      stage: "mixed",
      samples: singleSamples,
      sampleRate: 44100,
      duration: 3.0,
      frequency: freq,
      timestamp: Date.now(),
      metadata: {
        ingredients: effectiveIngredients,
      },
    };
  }

  const summed = new Array<number>(sampleCount).fill(0);
  let totalFreq = 0;

  for (let idx = 0; idx < effectiveIngredients.length; idx++) {
    const name = effectiveIngredients[idx]!;
    const detail = recipe.ingredientDetails.find(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
    const detailIndex = recipe.ingredientDetails.findIndex(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
    const freq = detail?.freq ?? 3 + (idx % 4) * 1.5;
    const seed = (detailIndex >= 0 ? detailIndex + 1 : idx + 1) * 0.85;
    totalFreq += freq;

    let ingSamples: number[] | null = null;

    // Check if player has washed/filtered this washable ingredient
    if (detail?.washable) {
      const storedFiltered = getFilteredIngredient(recipe.id, name);
      if (storedFiltered && storedFiltered.length > 0) {
        // Resample if necessary to sampleCount
        if (storedFiltered.length === sampleCount) {
          ingSamples = storedFiltered;
        } else {
          ingSamples = [];
          for (let i = 0; i < sampleCount; i++) {
            const u = i / (sampleCount - 1);
            ingSamples.push(sampleAt(storedFiltered, u));
          }
        }
      }
    }

    // Fallback: If not filtered or not washable, generate standard ingredient samples
    if (!ingSamples) {
      const noise = detail?.washable ? 0.85 : 0.0;
      ingSamples = getRecipeIngredientSamples(recipe.id, name, {
        noise,
        seed,
        freq,
        sampleCount,
        amplitude: 1.0,
      });
    }

    for (let i = 0; i < sampleCount; i++) {
      summed[i] = (summed[i] ?? 0) + (ingSamples[i] ?? 0);
    }
  }

  // Normalize superposition by number of ingredients
  const count = Math.max(1, effectiveIngredients.length);
  const normFactor = 1 / Math.sqrt(count);
  for (let i = 0; i < sampleCount; i++) {
    summed[i] = (summed[i] ?? 0) * normFactor;
  }
  const samples = normalizeSamples(summed, 0.95);
  const nominalFreq = Math.max(2, Math.round(totalFreq / count));

  return {
    recipeId: recipe.id,
    stage: "mixed",
    samples,
    sampleRate: 44100,
    duration: 3.0,
    frequency: nominalFreq,
    timestamp: Date.now(),
    metadata: {
      ingredients: effectiveIngredients,
    },
  };
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
  const n = Math.max(2, Math.round(inSamples.length / effectiveFreq));
  
  // time_scale(x, alpha) where alpha = effectiveFreq
  // src = np.arange(n) * alpha
  const scaledSamples: number[] = [];
  for (let i = 0; i < n; i++) {
    const srcIndex = i * effectiveFreq;
    if (srcIndex < 0 || srcIndex > inSamples.length - 1) {
      scaledSamples.push(0);
    } else {
      const idx = Math.floor(srcIndex);
      const frac = srcIndex - idx;
      const s0 = inSamples[idx] ?? 0;
      const s1 = inSamples[idx + 1] ?? s0;
      scaledSamples.push((s0 + frac * (s1 - s0)) * amplitude);
    }
  }

  // Ensure it fits the requested sampleCount
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const srcIndex = (i / (sampleCount - 1)) * (scaledSamples.length - 1);
    if (srcIndex < 0 || srcIndex > scaledSamples.length - 1) {
      samples.push(0);
    } else {
      const idx = Math.floor(srcIndex);
      const frac = srcIndex - idx;
      const s0 = scaledSamples[idx] ?? 0;
      const s1 = scaledSamples[idx + 1] ?? s0;
      samples.push(s0 + frac * (s1 - s0));
    }
  }

  return {
    recipeId: mixedSignal.recipeId,
    stage: "seasoned",
    samples: normalizeSamples(samples, 0.95),
    sampleRate: mixedSignal.sampleRate,
    duration: mixedSignal.duration,
    frequency: mixedSignal.frequency * effectiveFreq,
    timestamp: Date.now(),
    metadata: {
      amplitude,
      freqScale,
    },
  };
}

/**
 * Computes the marinated signal by applying time scaling (stretch/compress)
 * to the actual seasoned signal.
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
  const shiftSamples = Math.round((effectiveScale / Math.max(1, seasonedSignal.duration)) * sampleCount);

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
    samples: normalizeSamples(samples, 0.95),
    sampleRate: seasonedSignal.sampleRate,
    duration: seasonedSignal.duration * effectiveScale,
    frequency: seasonedSignal.frequency / effectiveScale,
    timestamp: Date.now(),
    metadata: {
      timeScale,
    },
  };
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

  const finalSamples = normalizeSamples(outSamples, 0.95);
  const freqOffset = methodId === "fry" ? 2.5 : methodId === "grill" ? 1.5 : 0.8;

  return {
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
  };
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

  const summed = new Array<number>(sampleCount).fill(0);
  let totalFreq = 0;

  for (let idx = 0; idx < effectiveIngredients.length; idx++) {
    const name = effectiveIngredients[idx]!;
    const detail = recipe.ingredientDetails.find(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
    const freq = detail?.freq ?? 3 + (idx % 4) * 1.5;
    totalFreq += freq;

    // Pure clean mathematical signal without contamination noise
    const ingSamples = getRecipeIngredientSamples(recipe.id, name, {
      noise: 0.0,
      seed: (idx + 1) * 0.85,
      freq,
      sampleCount,
      amplitude: 1.0,
    });

    for (let i = 0; i < sampleCount; i++) {
      summed[i] = (summed[i] ?? 0) + (ingSamples[i] ?? 0);
    }
  }

  const count = Math.max(1, effectiveIngredients.length);
  const normFactor = 1 / Math.sqrt(count);
  for (let i = 0; i < sampleCount; i++) {
    summed[i] = (summed[i] ?? 0) * normFactor;
  }
  const samples = normalizeSamples(summed, 0.95);
  const nominalFreq = Math.max(2, Math.round(totalFreq / count));

  return {
    recipeId: recipe.id,
    stage: "mixed",
    samples,
    sampleRate: 44100,
    duration: 3.0,
    frequency: nominalFreq,
    timestamp: Date.now(),
    metadata: {
      ingredients: effectiveIngredients,
      clean: true,
    },
  };
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

  if (stage === "delivered") {
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
    } catch {
      // ignore
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
        const parsed = JSON.parse(stored) as PipelineSignal;
        if (parsed && Array.isArray(parsed.samples) && parsed.samples.length > 0) {
          if (parsed.samples.length !== sampleCount) {
            return {
              ...parsed,
              samples: resampleSignal(parsed.samples, sampleCount),
            };
          }
          return parsed;
        }
      }
    } catch {
      // ignore
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
