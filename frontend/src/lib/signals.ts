/**
 * Mathematical signal-function foundation for WaveBakery ingredients.
 *
 * Ingredients can map to formal time-domain mathematical signal functions x(t).
 * Currently configured:
 *   CHEESE -> Periodic Triangular Wave:
 *     x(t) = A * (2/π) * asin(sin(2πft + φ))
 *   SUGAR -> Periodic Square Wave:
 *     x(t) = A * sgn(sin(2πft + φ))
 *   SALT -> Small-Amplitude Periodic Square Wave:
 *     x(t) = As * sgn(sin(2πft + φ))  (As = 0.4)
 */

import { CHICKEN_STATIC_PCM_SAMPLES } from "./chicken-samples";

export interface MathematicalSignalParams {
  frequency: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
}

export interface ParametricPoint {
  t: number;
  x: number;
  y: number;
}

export interface IngredientSignalDefinition {
  id: string;
  ingredientName: string;
  waveformType:
    | "triangle"
    | "square"
    | "sine"
    | "superposition"
    | "oval"
    | "leaf"
    | "liquid"
    | "flame"
    | "dome"
    | "trapezoid"
    | "taper"
    | "saturated"
    | "parametric"
    | "recorded"
    | "custom";
  defaultAmplitude: number;
  domainDisplay?: string;
  equationDisplay: string;
  equationLatex: string;
  description: string;
  evaluate: (t: number, params: MathematicalSignalParams) => number;
  generateSamples: (params: {
    freq: number;
    amplitude?: number;
    phase?: number;
    noise?: number;
    sampleCount?: number;
  }) => number[];
  parametricCurve?: {
    tMin: number;
    tMax: number;
    domainDisplay?: string;
    rangeDisplay?: string;
    xDisplay?: string;
    yDisplay?: string;
    evaluate: (t: number) => { x: number; y: number };
    generatePoints: (sampleCount?: number) => ParametricPoint[];
  };
}

/**
 * Standard periodic triangular-wave mathematical function:
 * x(t) = A * (2/π) * asin(sin(2πft + φ))
 */
export function evaluateTriangleWave(
  t: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const f = params.frequency;
  const phi = params.phase ?? 0;
  const s = Math.sin(2 * Math.PI * f * t + phi);
  const clamped = Math.max(-1, Math.min(1, s));
  const val = amp * (2 / Math.PI) * Math.asin(clamped);
  if (params.noise) {
    const n = Math.sin(t * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

/**
 * Standard periodic square-wave mathematical function:
 * x(t) = A * sgn(sin(2πft + φ))
 */
export function evaluateSquareWave(
  t: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const f = params.frequency;
  const phi = params.phase ?? 0;
  const s = Math.sin(2 * Math.PI * f * t + phi);
  const sign = s >= 0 ? 1 : -1;
  const val = amp * sign;
  if (params.noise) {
    const n = Math.sin(t * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

/**
 * Generates discrete samples from the triangular-wave function.
 */
export function generateTriangleSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateTriangleWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

/**
 * Generates discrete samples from the square-wave function.
 */
export function generateSquareSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateSquareWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

/**
 * Cheese mathematical signal definition (Triangular wave).
 */
export const CHEESE_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "cheese-triangle",
  ingredientName: "Cheese",
  waveformType: "triangle",
  defaultAmplitude: 1.0,
  equationDisplay: "x(t) = A · (2/π) · asin(sin(2πft + φ))",
  equationLatex: "x(t) = A \\cdot \\frac{2}{\\pi} \\arcsin(\\sin(2\\pi f t + \\phi))",
  description: "Periodic triangular wave with odd harmonic series (1/n² rolloff)",
  evaluate: (t, params) => evaluateTriangleWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateTriangleSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Sugar mathematical signal definition (Square wave).
 */
export const SUGAR_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "sugar-square",
  ingredientName: "Sugar",
  waveformType: "square",
  defaultAmplitude: 1.0,
  equationDisplay: "x(t) = A · sgn(sin(2πft + φ))",
  equationLatex: "x(t) = A \\cdot \\operatorname{sgn}(\\sin(2\\pi f t + \\phi))",
  description: "Periodic square wave with odd harmonic series (1/n rolloff)",
  evaluate: (t, params) => evaluateSquareWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateSquareSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Salt mathematical signal definition (Small-amplitude square wave).
 */
export const SALT_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "salt-square-small",
  ingredientName: "Salt",
  waveformType: "square",
  defaultAmplitude: 0.4,
  equationDisplay: "x(t) = A_s · sgn(sin(2πft + φ))",
  equationLatex: "x(t) = A_s \\cdot \\operatorname{sgn}(\\sin(2\\pi f t + \\phi))",
  description: "Small-amplitude periodic square wave with odd harmonic series (As = 0.4)",
  evaluate: (t, params) => evaluateSquareWave(t, { amplitude: params.amplitude ?? 0.4, ...params }),
  generateSamples: (params) => generateSquareSamples({ amplitude: params.amplitude ?? 0.4, ...params }),
};


/**
 * Bread mathematical signal: Superposition of two sine waves.
 * y(t) = 0.8 * sin(6πt) + 0.6 * sin(18πt)
 *
 * Mathematical parameter relationship:
 *   - Low-frequency component:    0.8 * sin(6πt)    (f1 = 3 Hz)
 *   - Higher-frequency component: 0.6 * sin(18πt)   (f2 = 9 Hz)
 *   - Frequency ratio = 3:1 (f2 = 3 * f1)
 */
export function evaluateBreadWave(
  t: number,
  params: MathematicalSignalParams & {
    a1?: number;
    a2?: number;
    f1?: number;
    f2?: number;
  },
): number {
  const amp = params.amplitude ?? 1.0;
  const f1 = params.f1 ?? (params.frequency || 3);
  const f2 = params.f2 ?? (f1 * 3);
  const a1 = (params.a1 ?? 0.8) * amp;
  const a2 = (params.a2 ?? 0.6) * amp;

  const lowComp = a1 * Math.sin(2 * Math.PI * f1 * t);
  const highComp = a2 * Math.sin(2 * Math.PI * f2 * t);
  const val = lowComp + highComp;

  if (params.noise) {
    const phi = params.phase ?? 0;
    const n = Math.sin(t * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateBreadSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateBreadWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

/**
 * Beef Patty mathematical signal: Parametric repeated horizontal ovals.
 * (x(t), y(t)) = (2.5 * cos(t) + 5 * floor(t / (2π)), 0.7 * sin(t))
 * Parameter range: 2π ≤ t ≤ 8π
 *
 * Each period 2π traces a complete horizontal oval:
 *   - Upper lobe: y(t) >= 0 as t goes from 2πk to 2πk + π
 *   - Lower lobe: y(t) <= 0 as t goes from 2πk + π to 2π(k + 1)
 *   - Displaced by 5 * floor(t / (2π)) along x, forming seamless touching ovals
 */
export const PATTY_T_MIN = 2 * Math.PI;
export const PATTY_T_MAX = 8 * Math.PI;

export function evaluatePattyParametric(t: number): { x: number; y: number } {
  return {
    x: 2.5 * Math.cos(t) + 5 * Math.floor(t / (2 * Math.PI)),
    y: 0.7 * Math.sin(t),
  };
}

export function generatePattyParametricPoints(sampleCount = 4001): ParametricPoint[] {
  const points: ParametricPoint[] = [];
  const range = PATTY_T_MAX - PATTY_T_MIN;
  for (let i = 0; i < sampleCount; i++) {
    const t = PATTY_T_MIN + (i / (sampleCount - 1)) * range;
    const pt = evaluatePattyParametric(t);
    points.push({
      t,
      x: pt.x,
      y: pt.y,
    });
  }
  return points;
}

/**
 * 1D audio / DSP compatibility layer for Beef Patty:
 * Evaluates the vertical coordinate y(t) = 0.7 sin(t) from the exact mathematical signal
 * normalized to standard audio sample range [-1, 1] across parameter span [2π, 8π].
 */
export function evaluatePattyWave(
  normT: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const phi = params.phase ?? 0;
  const range = PATTY_T_MAX - PATTY_T_MIN;
  const t = PATTY_T_MIN + normT * range + phi;
  const val = amp * (evaluatePattyParametric(t).y / 0.7);

  if (params.noise) {
    const n = Math.sin(normT * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generatePattySamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluatePattyWave(t, { frequency: params.freq, amplitude, phase, noise }));
  }
  return samples;
}

/**
 * Bread mathematical signal definition (Superposition of two sine waves).
 */
export const BREAD_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "bread-superposition",
  ingredientName: "Bread",
  waveformType: "superposition",
  defaultAmplitude: 1.0,
  equationDisplay: "y(t) = 0.8 sin(6πt) + 0.6 sin(18πt)",
  equationLatex: "y(t) = 0.8 \\sin(6\\pi t) + 0.6 \\sin(18\\pi t)",
  description: "Superposition: low-frequency 0.8 sin(6πt) + 3x harmonic 0.6 sin(18πt) (3:1 ratio)",
  evaluate: (t, params) => evaluateBreadWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateBreadSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Beef Patty mathematical signal definition (Parametric repeated horizontal ovals).
 */
export const PATTY_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "patty-parametric",
  ingredientName: "Beef Patty",
  waveformType: "parametric",
  defaultAmplitude: 1.0,
  equationDisplay: "x(t) = 2.5 cos(t) + 5 floor(t/(2π)),  y(t) = 0.7 sin(t)  [2π ≤ t ≤ 8π]",
  equationLatex: "x(t) = 2.5 \\cos(t) + 5 \\operatorname{floor}\\left(\\frac{t}{2\\pi}\\right),\\quad y(t) = 0.7 \\sin(t),\\quad 2\\pi \\le t \\le 8\\pi",
  description: "Parametric repeated horizontal ovals: x(t) = 2.5 cos(t) + 5 floor(t/(2π)), y(t) = 0.7 sin(t)",
  evaluate: (t, params) => evaluatePattyWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generatePattySamples({ amplitude: params.amplitude ?? 1.0, ...params }),
  parametricCurve: {
    tMin: PATTY_T_MIN,
    tMax: PATTY_T_MAX,
    domainDisplay: "t ∈ [2π, 8π]",
    rangeDisplay: "2π ≤ t ≤ 8π",
    xDisplay: "x(t) = 2.5 cos(t) + 5 floor(t/(2π))",
    yDisplay: "y(t) = 0.7 sin(t)",
    evaluate: evaluatePattyParametric,
    generatePoints: generatePattyParametricPoints,
  },
};

/**
 * Lettuce mathematical signal: Parametric ruffled lettuce-leaf contour.
 * (x(t), y(t)) = (t, 2.2 cos(t) + 0.45 cos(7.5t))
 * Parameter range: -8π ≤ t ≤ 8π
 *
 * Parametric formulation produces the irregular, ruffled/wavy contour of a lettuce leaf:
 *   - Smooth large base oscillation from 2.2 cos(t)
 *   - Fast ruffled edge oscillation from 0.45 cos(7.5t)
 */
export const LETTUCE_T_MIN = -8 * Math.PI;
export const LETTUCE_T_MAX = 8 * Math.PI;

export function evaluateLettuceParametric(t: number): { x: number; y: number } {
  return {
    x: t,
    y: 2.2 * Math.cos(t) + 0.45 * Math.cos(7.5 * t),
  };
}

export function generateLettuceParametricPoints(sampleCount = 2001): ParametricPoint[] {
  const points: ParametricPoint[] = [];
  const range = LETTUCE_T_MAX - LETTUCE_T_MIN;
  for (let i = 0; i < sampleCount; i++) {
    const t = LETTUCE_T_MIN + (i / (sampleCount - 1)) * range;
    points.push({
      t,
      x: t,
      y: 2.2 * Math.cos(t) + 0.45 * Math.cos(7.5 * t),
    });
  }
  return points;
}

/**
 * 1D audio / DSP compatibility layer for Lettuce:
 * Evaluates the vertical coordinate y(t) = 2.2 cos(t) + 0.45 cos(7.5t)
 * normalized to standard audio sample range [-1, 1] across parameter span [-8π, 8π].
 */
export function evaluateLettuceWave(
  normT: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const phi = params.phase ?? 0;
  const range = LETTUCE_T_MAX - LETTUCE_T_MIN;
  const t = LETTUCE_T_MIN + normT * range + phi;
  // Normalized vertical coordinate y(t) / (2.2 + 0.45)
  const val = amp * ((2.2 * Math.cos(t) + 0.45 * Math.cos(7.5 * t)) / 2.65);

  if (params.noise) {
    const n = Math.sin(normT * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateLettuceSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateLettuceWave(t, { frequency: params.freq, amplitude, phase, noise }));
  }
  return samples;
}

export const LETTUCE_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "lettuce-parametric",
  ingredientName: "Lettuce",
  waveformType: "parametric",
  defaultAmplitude: 1.0,
  equationDisplay: "x(t) = t,  y(t) = 2.2 cos(t) + 0.45 cos(7.5t)  [-8π ≤ t ≤ 8π]",
  equationLatex: "x(t) = t,\\quad y(t) = 2.2 \\cos(t) + 0.45 \\cos(7.5t),\\quad -8\\pi \\le t \\le 8\\pi",
  description: "Parametric leaf curve: x(t) = t, y(t) = 2.2 cos(t) + 0.45 cos(7.5t) (-8π ≤ t ≤ 8π)",
  evaluate: (t, params) => evaluateLettuceWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateLettuceSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
  parametricCurve: {
    tMin: LETTUCE_T_MIN,
    tMax: LETTUCE_T_MAX,
    domainDisplay: "t ∈ [-8π, 8π]",
    rangeDisplay: "-8π ≤ t ≤ 8π",
    xDisplay: "x(t) = t",
    yDisplay: "y(t) = 2.2 cos(t) + 0.45 cos(7.5t)",
    evaluate: evaluateLettuceParametric,
    generatePoints: generateLettuceParametricPoints,
  },
};

/**
 * Milk mathematical signal: Scattered/irregular liquid waveform.
 * y(x) = 1.4 sin(0.7x) + 0.6 sin(1.3x) + 0.3 sin(2.1x + 0.8)
 *
 * Deterministic multi-frequency incommensurate liquid superposition:
 *   - Base liquid oscillation:  1.4 sin(0.7x)
 *   - Intermediate ripple wave: 0.6 sin(1.3x)
 *   - Fine splash ripple:       0.3 sin(2.1x + 0.8)
 */
export function evaluateMilkDirect(x: number): number {
  return 1.4 * Math.sin(0.7 * x) + 0.6 * Math.sin(1.3 * x) + 0.3 * Math.sin(2.1 * x + 0.8);
}

export function evaluateMilkWave(
  t: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const f = params.frequency || 5;
  const phi = params.phase ?? 0;
  // Map normalized time t ∈ [0, 1] to domain x = 2π f t + φ (spans 10π ≈ 31.42 rad when f=5)
  // Generating multiple overlapping non-repeating oscillations across the sample window
  const x = 2 * Math.PI * f * t + phi;
  const rawY = evaluateMilkDirect(x);
  // Normalize by peak sum (1.4 + 0.6 + 0.3 = 2.3) so amplitude matches visual headroom & audio buffer range
  const val = amp * (rawY / 2.3);

  if (params.noise) {
    const n = Math.sin(t * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateMilkSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateMilkWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export const MILK_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "milk-liquid",
  ingredientName: "Milk",
  waveformType: "liquid",
  defaultAmplitude: 1.0,
  equationDisplay: "y(x) = 1.4 sin(0.7x) + 0.6 sin(1.3x) + 0.3 sin(2.1x + 0.8)",
  equationLatex: "y(x) = 1.4 \\sin(0.7x) + 0.6 \\sin(1.3x) + 0.3 \\sin(2.1x + 0.8)",
  description: "Scattered liquid ripples: y(x) = 1.4 sin(0.7x) + 0.6 sin(1.3x) + 0.3 sin(2.1x + 0.8)",
  evaluate: (t, params) => evaluateMilkWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateMilkSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Flour mathematical signal: Repeating flame-like waveform (Flame stitch pattern).
 * y(t) = squarewave(t) - squarewave(2t) * cos(2πt)
 *
 * Expands with periodic frequency f:
 * y(t) = sgn(sin(2πft + φ)) - sgn(sin(4πft + 2φ)) * cos(2πft + φ)
 *
 * Produces pointed, organic flame-like peaks and troughs alternating over time,
 * where square waves are generated using the existing evaluateSquareWave function.
 */
export function evaluateFlourWave(
  t: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const f = params.frequency;
  const phi = params.phase ?? 0;

  // Reuses the project's standard squarewave: sgn(sin(2πft + φ))
  const sq1 = evaluateSquareWave(t, { frequency: f, amplitude: 1.0, phase: phi });
  const sq2 = evaluateSquareWave(t, { frequency: 2 * f, amplitude: 1.0, phase: 2 * phi });
  const cosTerm = Math.cos(2 * Math.PI * f * t + phi);

  const val = amp * (sq1 - sq2 * cosTerm);

  if (params.noise) {
    const n = Math.sin(t * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateFlourSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateFlourWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export const FLOUR_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "flour-flame",
  ingredientName: "Flour",
  waveformType: "flame",
  defaultAmplitude: 1.0,
  equationDisplay: "y(t) = squarewave(t) - squarewave(2t) · cos(2πt)",
  equationLatex: "y(t) = \\operatorname{squarewave}(t) - \\operatorname{squarewave}(2t) \\cos(2\\pi t)",
  description: "Flame waveform: sgn(sin(2πft)) - sgn(sin(4πft))·cos(2πft)",
  evaluate: (t, params) => evaluateFlourWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateFlourSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Noodle parametric mathematical signal:
 *   x(t) = t + 3 sin(t)
 *   y(t) = 5 cos(t)
 *   -12π ≤ t ≤ 12π
 *
 * 2D parametric curling ribbon / trochoid curve with 12 self-intersecting loops.
 */
export const NOODLE_T_MIN = -12 * Math.PI;
export const NOODLE_T_MAX = 12 * Math.PI;

export function evaluateNoodleParametric(t: number): { x: number; y: number } {
  return {
    x: t + 3 * Math.sin(t),
    y: 5 * Math.cos(t),
  };
}

export function generateNoodleParametricPoints(sampleCount = 601): ParametricPoint[] {
  const points: ParametricPoint[] = [];
  const range = NOODLE_T_MAX - NOODLE_T_MIN;
  for (let i = 0; i < sampleCount; i++) {
    const t = NOODLE_T_MIN + (i / (sampleCount - 1)) * range;
    points.push({
      t,
      x: t + 3 * Math.sin(t),
      y: 5 * Math.cos(t),
    });
  }
  return points;
}

/**
 * 1D audio / DSP compatibility layer:
 * Evaluates the vertical coordinate y(t) of the Noodle parametric curve
 * normalized to standard audio sample range [-1, 1] across parameter span [-12π, 12π].
 */
export function evaluateNoodleWave(
  normT: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  // Map normalized time t ∈ [0, 1] to parameter θ ∈ [-12π, 12π]
  // 12 full cycles: θ(normT) = -12π + normT * 24π
  const phi = params.phase ?? 0;
  const theta = -12 * Math.PI + normT * 24 * Math.PI + phi;
  const val = amp * Math.cos(theta); // 5 cos(θ) normalized to [-1, 1]

  if (params.noise) {
    const n = Math.sin(normT * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateNoodleSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateNoodleWave(t, { frequency: 12, amplitude, phase, noise }));
  }
  return samples;
}

export const NOODLE_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "noodle-parametric",
  ingredientName: "Noodles",
  waveformType: "parametric",
  defaultAmplitude: 1.0,
  equationDisplay: "x(t) = t + 3 sin(t),  y(t) = 5 cos(t)  [-12π ≤ t ≤ 12π]",
  equationLatex: "x(t) = t + 3 \\sin(t),\\quad y(t) = 5 \\cos(t),\\quad -12\\pi \\le t \\le 12\\pi",
  description: "Parametric curve: x(t) = t + 3 sin(t), y(t) = 5 cos(t) (-12π ≤ t ≤ 12π)",
  evaluate: (t, params) => evaluateNoodleWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateNoodleSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
  parametricCurve: {
    tMin: NOODLE_T_MIN,
    tMax: NOODLE_T_MAX,
    domainDisplay: "t ∈ [-12π, 12π]",
    rangeDisplay: "-12π ≤ t ≤ 12π",
    xDisplay: "x(t) = t + 3 sin(t)",
    yDisplay: "y(t) = 5 cos(t)",
    evaluate: evaluateNoodleParametric,
    generatePoints: generateNoodleParametricPoints,
  },
};

/**
 * Bun mathematical signal: Smooth bun dome profile with subtle fine surface crust variation.
 * y(x) = 5(0.5 + 0.5 cos(0.3x))^0.25 + 0.03 cos(9x)
 *
 * Characteristics:
 *   - The broad first term 5(0.5 + 0.5 cos(0.3x))^0.25 creates the smooth rounded bun/dome profile.
 *   - The 0.03 cos(9x) term provides the subtle fine surface crust texture.
 *   - Period of dome profile: T = 2π / 0.3 = 20π / 3 ≈ 20.944.
 */
export function evaluateBunDirect(x: number): number {
  const base = Math.max(0, 0.5 + 0.5 * Math.cos(0.3 * x));
  return 5 * Math.pow(base, 0.25) + 0.03 * Math.cos(9 * x);
}

export function evaluateBunWave(
  t: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const f = params.frequency || 3;
  const phi = params.phase ?? 0;
  // Map normalized time t ∈ [0, 1] to domain x:
  // Each period of the dome corresponds to T = 20π / 3.
  // With frequency f, domain spans (20π / 3) * f * t.
  // Offset by -10π / 3 so that each dome starts cleanly from its base, arches up, and descends.
  const x = -(10 * Math.PI) / 3 + (20 * Math.PI / 3) * f * t + phi;
  const rawY = evaluateBunDirect(x);
  // Center in [-1, 1] around mid-level (2.5) for audio buffer headroom and visual display
  const val = amp * ((rawY - 2.5) / 2.5);

  if (params.noise) {
    const n = Math.sin(t * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateBunSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateBunWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export const BUN_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "bun-dome",
  ingredientName: "Bun",
  waveformType: "dome",
  defaultAmplitude: 1.0,
  equationDisplay: "y(x) = 5(0.5 + 0.5 cos(0.3x))^0.25 + 0.03 cos(9x)",
  equationLatex: "y(x) = 5(0.5 + 0.5 \\cos(0.3x))^{0.25} + 0.03 \\cos(9x)",
  description: "Bun dome profile: y(x) = 5(0.5 + 0.5 cos(0.3x))^0.25 + 0.03 cos(9x)",
  evaluate: (t, params) => evaluateBunWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateBunSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Butter mathematical signal: Broad spaced trapezoidal pulse train.
 * y = max(0, 1.2 - 1.2 max(|mod(x+9, 14) - 9| - 4, 0))
 * Domain: -21 < x < 21
 *
 * Characteristics:
 *   - mod(x+9, 14) produces repeating cycles with period 14.
 *   - Wide trapezoidal butter blocks with:
 *       • Flat plateau of height 1.2 and width 8 (mod ∈ [5, 13])
 *       • Linear slopes of width 1 (ramp up on [4, 5], ramp down on [13, 14])
 *       • Inter-pulse spacing / flat baseline at 0 for width 4 (mod ∈ [0, 4])
 *   - Across the exact domain -21 < x < 21 (span 42), traces 3 broad, spaced
 *     butter blocks centered at x = -14, 0, 14, with continuous zero-level margins at boundaries x = ±21.
 */
export const BUTTER_X_MIN = -21;
export const BUTTER_X_MAX = 21;

export function evaluateButterDirect(x: number): number {
  const modVal = ((x + 9) % 14 + 14) % 14;
  const innerMax = Math.max(Math.abs(modVal - 9) - 4, 0);
  return Math.max(0, 1.2 - 1.2 * innerMax);
}

export function evaluateButterWave(
  normT: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const phi = params.phase ?? 0;
  const range = BUTTER_X_MAX - BUTTER_X_MIN;
  // Map normalized time normT ∈ [0, 1] to domain x ∈ [-21, 21]
  const x = BUTTER_X_MIN + normT * range + phi;
  const rawY = evaluateButterDirect(x);
  // Center around mid-level (0.6) into [-0.6, 0.6] for headroom and accurate visual amplitude
  const val = amp * (rawY - 0.6);

  if (params.noise) {
    const n = Math.sin(normT * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateButterSamples(params: {
  freq?: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq = 3, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateButterWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export function generateButterRawSamples(sampleCount = 401): number[] {
  const samples: number[] = [];
  const range = BUTTER_X_MAX - BUTTER_X_MIN;
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    const x = BUTTER_X_MIN + t * range;
    samples.push(evaluateButterDirect(x));
  }
  return samples;
}

export const BUTTER_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "butter-trapezoid",
  ingredientName: "Butter",
  waveformType: "trapezoid",
  defaultAmplitude: 1.0,
  domainDisplay: "-21 < x < 21",
  equationDisplay: "y = max(0, 1.2 - 1.2 max(|mod(x+9, 14) - 9| - 4, 0))  [-21 < x < 21]",
  equationLatex: "y = \\max\\left(0,\\; 1.2 - 1.2\\max\\left(\\left|\\operatorname{mod}(x+9, 14) - 9\\right| - 4,\\; 0\\right)\\right),\\quad -21 < x < 21",
  description: "Butter trapezoid blocks: y = max(0, 1.2 - 1.2 max(|mod(x+9, 14) - 9| - 4, 0)) (-21 < x < 21)",
  evaluate: (t, params) => evaluateButterWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateButterSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Tomato mathematical signal: Parametric plump tomato contour.
 * x(t) = (2 + 0.2 sin(3t)) cos(t)
 * y(t) = -(1.5 + 0.2 sin(t)) sin(t)
 * Parameter range: 0 ≤ t ≤ 6π
 *
 * Characteristics:
 *   - The (2 + 0.2 sin(3t)) horizontal radius modulation creates a 3-lobed contour.
 *   - The -(1.5 + 0.2 sin(t)) vertical radius modulation forms the characteristic plump tomato shape.
 *   - Period is 2π, so 0 ≤ t ≤ 6π completes exactly 3 revolutions around the origin.
 */
export const TOMATO_T_MIN = 0;
export const TOMATO_T_MAX = 6 * Math.PI;

export function evaluateTomatoParametric(t: number): { x: number; y: number } {
  return {
    x: (2 + 0.2 * Math.sin(3 * t)) * Math.cos(t),
    y: -(1.5 + 0.2 * Math.sin(t)) * Math.sin(t),
  };
}

export function generateTomatoParametricPoints(sampleCount = 1201): ParametricPoint[] {
  const points: ParametricPoint[] = [];
  const range = TOMATO_T_MAX - TOMATO_T_MIN;
  for (let i = 0; i < sampleCount; i++) {
    const t = TOMATO_T_MIN + (i / (sampleCount - 1)) * range;
    points.push({
      t,
      x: (2 + 0.2 * Math.sin(3 * t)) * Math.cos(t),
      y: -(1.5 + 0.2 * Math.sin(t)) * Math.sin(t),
    });
  }
  return points;
}

/**
 * 1D audio / DSP compatibility layer for Tomato:
 * Evaluates the vertical coordinate y(t) = -(1.5 + 0.2 sin(t)) sin(t)
 * normalized to standard audio sample range [-1, 1] across parameter span [0, 6π].
 */
export function evaluateTomatoWave(
  normT: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const phi = params.phase ?? 0;
  const range = TOMATO_T_MAX - TOMATO_T_MIN;
  const t = TOMATO_T_MIN + normT * range + phi;
  const pt = evaluateTomatoParametric(t);
  // Normalized vertical coordinate pt.y / 1.7 (peak magnitude is 1.7)
  const val = amp * (pt.y / 1.7);

  if (params.noise) {
    const n = Math.sin(normT * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateTomatoSamples(params: {
  freq?: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq = 5, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateTomatoWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export const TOMATO_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "tomato-parametric",
  ingredientName: "Tomato",
  waveformType: "parametric",
  defaultAmplitude: 1.0,
  domainDisplay: "0 ≤ t ≤ 6π",
  equationDisplay: "x(t) = (2 + 0.2 sin(3t)) cos(t),  y(t) = -(1.5 + 0.2 sin(t)) sin(t)  [0 ≤ t ≤ 6π]",
  equationLatex: "x(t) = (2 + 0.2 \\sin(3t)) \\cos(t),\\quad y(t) = -(1.5 + 0.2 \\sin(t)) \\sin(t),\\quad 0 \\le t \\le 6\\pi",
  description: "Parametric tomato contour: x(t) = (2 + 0.2 sin(3t)) cos(t), y(t) = -(1.5 + 0.2 sin(t)) sin(t) (0 ≤ t ≤ 6π)",
  evaluate: (t, params) => evaluateTomatoWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateTomatoSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
  parametricCurve: {
    tMin: TOMATO_T_MIN,
    tMax: TOMATO_T_MAX,
    domainDisplay: "0 ≤ t ≤ 6π",
    rangeDisplay: "0 ≤ t ≤ 6π",
    xDisplay: "x(t) = (2 + 0.2 sin(3t)) cos(t)",
    yDisplay: "y(t) = -(1.5 + 0.2 sin(t)) sin(t)",
    evaluate: evaluateTomatoParametric,
    generatePoints: generateTomatoParametricPoints,
  },
};

/**
 * Onion mathematical signal: Parametric Archimedean spiral.
 * x(t) = (0.1 + 0.08t) cos(3t)
 * y(t) = (0.1 + 0.08t) sin(3t)
 * Parameter range: 0 ≤ t ≤ 6π
 *
 * Characteristics:
 *   - Linear radial expansion r(t) = (0.1 + 0.08t) modulated with angular frequency 3.
 *   - Across 0 ≤ t ≤ 6π, completes 9 full concentric turns forming the layered rings of an onion.
 */
export const ONION_T_MIN = 0;
export const ONION_T_MAX = 6 * Math.PI;

export function evaluateOnionParametric(t: number): { x: number; y: number } {
  const r = 0.1 + 0.08 * t;
  return {
    x: r * Math.cos(3 * t),
    y: r * Math.sin(3 * t),
  };
}

export function generateOnionParametricPoints(sampleCount = 1801): ParametricPoint[] {
  const points: ParametricPoint[] = [];
  const range = ONION_T_MAX - ONION_T_MIN;
  for (let i = 0; i < sampleCount; i++) {
    const t = ONION_T_MIN + (i / (sampleCount - 1)) * range;
    const r = 0.1 + 0.08 * t;
    points.push({
      t,
      x: r * Math.cos(3 * t),
      y: r * Math.sin(3 * t),
    });
  }
  return points;
}

/**
 * 1D audio / DSP compatibility layer for Onion:
 * Evaluates the vertical coordinate y(t) = (0.1 + 0.08t) sin(3t)
 * normalized to standard audio sample range [-1, 1] across parameter span [0, 6π].
 */
export function evaluateOnionWave(
  normT: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const phi = params.phase ?? 0;
  const range = ONION_T_MAX - ONION_T_MIN;
  const t = ONION_T_MIN + normT * range + phi;
  const pt = evaluateOnionParametric(t);
  const maxRadius = 0.1 + 0.08 * ONION_T_MAX;
  const val = amp * (pt.y / maxRadius);

  if (params.noise) {
    const n = Math.sin(normT * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateOnionSamples(params: {
  freq?: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq = 6, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateOnionWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export const ONION_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "onion-parametric",
  ingredientName: "Onion",
  waveformType: "parametric",
  defaultAmplitude: 1.0,
  domainDisplay: "0 ≤ t ≤ 6π",
  equationDisplay: "x(t) = (0.1 + 0.08t) cos(3t),  y(t) = (0.1 + 0.08t) sin(3t)  [0 ≤ t ≤ 6π]",
  equationLatex: "x(t) = (0.1 + 0.08t) \\cos(3t),\\quad y(t) = (0.1 + 0.08t) \\sin(3t),\\quad 0 \\le t \\le 6\\pi",
  description: "Parametric onion spiral: x(t) = (0.1 + 0.08t) cos(3t), y(t) = (0.1 + 0.08t) sin(3t) (0 ≤ t ≤ 6π)",
  evaluate: (t, params) => evaluateOnionWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateOnionSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
  parametricCurve: {
    tMin: ONION_T_MIN,
    tMax: ONION_T_MAX,
    domainDisplay: "0 ≤ t ≤ 6π",
    rangeDisplay: "0 ≤ t ≤ 6π",
    xDisplay: "x(t) = (0.1 + 0.08t) cos(3t)",
    yDisplay: "y(t) = (0.1 + 0.08t) sin(3t)",
    evaluate: evaluateOnionParametric,
    generatePoints: generateOnionParametricPoints,
  },
};

/**
 * Carrot mathematical signal:
 * y = 5 - (1 + cos(0.5x))^4
 *
 * Characteristics:
 *   - Quartic cosine taper waveform.
 *   - Fundamental period Tx = 2π / 0.5 = 4π.
 *   - Maximum value: 5 (when cos(0.5x) = -1, (1 + cos(0.5x))^4 = 0).
 *   - Minimum value: -11 (when cos(0.5x) = 1, (1 + cos(0.5x))^4 = 16).
 *   - Broad rounded crests near y = 4 to 5 with deep root-like tapers plunging to y = -11.
 */
export function evaluateCarrotDirect(x: number): number {
  const inner = 1 + Math.cos(0.5 * x);
  return 5 - Math.pow(inner, 4);
}

export function evaluateCarrotWave(
  t: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const f = params.frequency || 4.5;
  const phi = params.phase ?? 0;
  // Map normalized time t ∈ [0, 1] to domain x:
  // Each cycle of the carrot waveform corresponds to Tx = 4π.
  // Across normalized time t with frequency f, x spans 4π * f * t.
  const x = 4 * Math.PI * f * t + phi;
  const rawY = evaluateCarrotDirect(x);
  // Center around midpoint (-3) and scale by half-span (8) to map [-11, 5] into [-1, 1]
  // for visual headroom and clean Web Audio synthesis without clipping.
  const val = amp * ((rawY + 3) / 8);

  if (params.noise) {
    const n = Math.sin(t * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateCarrotSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq = 4.5, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateCarrotWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export function generateCarrotRawSamples(sampleCount = 401, periods = 1): number[] {
  const samples: number[] = [];
  const xSpan = periods * 4 * Math.PI;
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    const x = t * xSpan;
    samples.push(evaluateCarrotDirect(x));
  }
  return samples;
}

export const CARROT_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "carrot-taper",
  ingredientName: "Carrot",
  waveformType: "taper",
  defaultAmplitude: 1.0,
  equationDisplay: "y = 5 - (1 + cos(0.5x))^4",
  equationLatex: "y = 5 - (1 + \\cos(0.5x))^4",
  description: "Carrot root taper: y = 5 - (1 + cos(0.5x))^4",
  evaluate: (t, params) => evaluateCarrotWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateCarrotSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Cucumber mathematical signal:
 * y = 6 tanh(4 cos(x))
 *
 * Characteristics:
 *   - Hyperbolic tangent saturated sinusoidal waveform (soft-clipped analog saturation).
 *   - Fundamental period Tx = 2π.
 *   - Maximum value: 6 tanh(4) ≈ 5.996 ≈ 6.
 *   - Minimum value: -6 tanh(4) ≈ -5.996 ≈ -6.
 *   - Symmetric around y = 0 with steep transitions at cos(x) = 0 (x = π/2 + kπ).
 *   - Wide saturated plateaus characteristic of crisp cucumber slices.
 */
export function evaluateCucumberDirect(x: number): number {
  return 6 * Math.tanh(4 * Math.cos(x));
}

export function evaluateCucumberWave(
  t: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const f = params.frequency || 7;
  const phi = params.phase ?? 0;
  // Map normalized time t ∈ [0, 1] to domain x:
  // Each cycle of the cucumber waveform corresponds to Tx = 2π.
  // Across normalized time t with frequency f, x spans 2π * f * t.
  const x = 2 * Math.PI * f * t + phi;
  const rawY = evaluateCucumberDirect(x);
  // Normalize by peak amplitude (6) into [-1, 1]
  // for visual headroom and clean Web Audio synthesis without clipping.
  const val = amp * (rawY / 6);

  if (params.noise) {
    const n = Math.sin(t * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateCucumberSamples(params: {
  freq: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq = 7, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateCucumberWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export function generateCucumberRawSamples(sampleCount = 401, periods = 1): number[] {
  const samples: number[] = [];
  const xSpan = periods * 2 * Math.PI;
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    const x = t * xSpan;
    samples.push(evaluateCucumberDirect(x));
  }
  return samples;
}

export const CUCUMBER_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "cucumber-tanh",
  ingredientName: "Cucumber",
  waveformType: "saturated",
  defaultAmplitude: 1.0,
  equationDisplay: "y = 6 tanh(4 cos(x))",
  equationLatex: "y = 6 \\tanh(4 \\cos(x))",
  description: "Cucumber saturated wave: y = 6 tanh(4 cos(x))",
  evaluate: (t, params) => evaluateCucumberWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateCucumberSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
};

/**
 * Sauce mathematical signal: Parametric 5-lobed sauce rosette / splattered droplet curve.
 * x(t) = (3 + 2 sin(5t)) cos(t)
 * y(t) = (2 + sin(5t)) sin(t)
 * Parameter range: 0 ≤ t ≤ 6π
 *
 * Characteristics:
 *   - Radial 5-lobed harmonic modulation: x radius modulated by (3 + 2 sin(5t)), y radius by (2 + sin(5t)).
 *   - Completes 3 full revolutions around the origin across 0 ≤ t ≤ 6π.
 */
export const SAUCE_T_MIN = 0;
export const SAUCE_T_MAX = 6 * Math.PI;

export function evaluateSauceParametric(t: number): { x: number; y: number } {
  const sin5t = Math.sin(5 * t);
  return {
    x: (3 + 2 * sin5t) * Math.cos(t),
    y: (2 + sin5t) * Math.sin(t),
  };
}

export function generateSauceParametricPoints(sampleCount = 1801): ParametricPoint[] {
  const points: ParametricPoint[] = [];
  const range = SAUCE_T_MAX - SAUCE_T_MIN;
  for (let i = 0; i < sampleCount; i++) {
    const t = SAUCE_T_MIN + (i / (sampleCount - 1)) * range;
    const sin5t = Math.sin(5 * t);
    points.push({
      t,
      x: (3 + 2 * sin5t) * Math.cos(t),
      y: (2 + sin5t) * Math.sin(t),
    });
  }
  return points;
}

/**
 * 1D audio / DSP compatibility layer for Sauce:
 * Evaluates the vertical coordinate y(t) = (2 + sin(5t)) sin(t)
 * normalized to standard audio sample range [-1, 1] across parameter span [0, 6π].
 */
export function evaluateSauceWave(
  normT: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const phi = params.phase ?? 0;
  const range = SAUCE_T_MAX - SAUCE_T_MIN;
  const t = SAUCE_T_MIN + normT * range + phi;
  const pt = evaluateSauceParametric(t);
  // Max vertical extent is 2 + 1 = 3
  const val = amp * (pt.y / 3);

  if (params.noise) {
    const n = Math.sin(normT * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateSauceSamples(params: {
  freq?: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq = 4, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateSauceWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export const SAUCE_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "sauce-parametric",
  ingredientName: "Sauce",
  waveformType: "parametric",
  defaultAmplitude: 1.0,
  domainDisplay: "0 ≤ t ≤ 6π",
  equationDisplay: "x(t) = (3 + 2 sin(5t)) cos(t),  y(t) = (2 + sin(5t)) sin(t)  [0 ≤ t ≤ 6π]",
  equationLatex: "x(t) = (3 + 2 \\sin(5t)) \\cos(t),\\quad y(t) = (2 + \\sin(5t)) \\sin(t),\\quad 0 \\le t \\le 6\\pi",
  description: "Parametric sauce rosette: x(t) = (3 + 2 sin(5t)) cos(t), y(t) = (2 + sin(5t)) sin(t) (0 ≤ t ≤ 6π)",
  evaluate: (t, params) => evaluateSauceWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateSauceSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
  parametricCurve: {
    tMin: SAUCE_T_MIN,
    tMax: SAUCE_T_MAX,
    domainDisplay: "0 ≤ t ≤ 6π",
    rangeDisplay: "0 ≤ t ≤ 6π",
    xDisplay: "x(t) = (3 + 2 sin(5t)) cos(t)",
    yDisplay: "y(t) = (2 + sin(5t)) sin(t)",
    evaluate: evaluateSauceParametric,
    generatePoints: generateSauceParametricPoints,
  },
};

/**
 * Egg mathematical signal: Parametric egg contour.
 * x(t) = (1.5 + 0.5 sin(t)) cos(t)
 * y(t) = -(2 + 0.2 sin(t)) sin(t)
 * Parameter range: 0 ≤ t ≤ 6π
 *
 * Characteristics:
 *   - The (1.5 + 0.5 sin(t)) horizontal factor widens the contour at one pole and narrows it at the other.
 *   - The -(2 + 0.2 sin(t)) vertical factor produces the characteristic tapered oval / pyriform egg shape.
 *   - Completes 3 full revolutions around the origin across 0 ≤ t ≤ 6π.
 */
export const EGG_T_MIN = 0;
export const EGG_T_MAX = 6 * Math.PI;

export function evaluateEggParametric(t: number): { x: number; y: number } {
  const sint = Math.sin(t);
  return {
    x: (1.5 + 0.5 * sint) * Math.cos(t),
    y: -(2 + 0.2 * sint) * sint,
  };
}

export function generateEggParametricPoints(sampleCount = 1801): ParametricPoint[] {
  const points: ParametricPoint[] = [];
  const range = EGG_T_MAX - EGG_T_MIN;
  for (let i = 0; i < sampleCount; i++) {
    const t = EGG_T_MIN + (i / (sampleCount - 1)) * range;
    const sint = Math.sin(t);
    points.push({
      t,
      x: (1.5 + 0.5 * sint) * Math.cos(t),
      y: -(2 + 0.2 * sint) * sint,
    });
  }
  return points;
}

/**
 * 1D audio / DSP compatibility layer for Egg:
 * Evaluates the vertical coordinate y(t) = -(2 + 0.2 sin(t)) sin(t)
 * normalized to standard audio sample range [-1, 1] across parameter span [0, 6π].
 */
export function evaluateEggWave(
  normT: number,
  params: MathematicalSignalParams,
): number {
  const amp = params.amplitude ?? 1.0;
  const phi = params.phase ?? 0;
  const range = EGG_T_MAX - EGG_T_MIN;
  const t = EGG_T_MIN + normT * range + phi;
  const pt = evaluateEggParametric(t);
  // Max vertical extent is |-2.2| = 2.2
  const val = amp * (pt.y / 2.2);

  if (params.noise) {
    const n = Math.sin(normT * 12.9898 * 400 + (phi || 1) * 78.233) * params.noise * 0.485;
    return val - n;
  }
  return val;
}

export function generateEggSamples(params: {
  freq?: number;
  amplitude?: number;
  phase?: number;
  noise?: number;
  sampleCount?: number;
}): number[] {
  const { freq = 4, amplitude = 1.0, phase = 0, noise = 0, sampleCount = 401 } = params;
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(evaluateEggWave(t, { frequency: freq, amplitude, phase, noise }));
  }
  return samples;
}

export const EGG_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "egg-parametric",
  ingredientName: "Egg",
  waveformType: "parametric",
  defaultAmplitude: 1.0,
  domainDisplay: "0 ≤ t ≤ 6π",
  equationDisplay: "x(t) = (1.5 + 0.5 sin(t)) cos(t),  y(t) = -(2 + 0.2 sin(t)) sin(t)  [0 ≤ t ≤ 6π]",
  equationLatex: "x(t) = (1.5 + 0.5 \\sin(t)) \\cos(t),\\quad y(t) = -(2 + 0.2 \\sin(t)) \\sin(t),\\quad 0 \\le t \\le 6\\pi",
  description: "Parametric egg contour: x(t) = (1.5 + 0.5 sin(t)) cos(t), y(t) = -(2 + 0.2 sin(t)) sin(t) (0 ≤ t ≤ 6π)",
  evaluate: (t, params) => evaluateEggWave(t, { amplitude: params.amplitude ?? 1.0, ...params }),
  generateSamples: (params) => generateEggSamples({ amplitude: params.amplitude ?? 1.0, ...params }),
  parametricCurve: {
    tMin: EGG_T_MIN,
    tMax: EGG_T_MAX,
    domainDisplay: "0 ≤ t ≤ 6π",
    rangeDisplay: "0 ≤ t ≤ 6π",
    xDisplay: "x(t) = (1.5 + 0.5 sin(t)) cos(t)",
    yDisplay: "y(t) = -(2 + 0.2 sin(t)) sin(t)",
    evaluate: evaluateEggParametric,
    generatePoints: generateEggParametricPoints,
  },
};

/**
 * Chicken recorded acoustic signal:
 * Real recorded chicken sound from public/sounds/chicken.wav.
 * Decoded PCM samples (44.1 kHz, 16-bit PCM, 2.158s duration).
 */
export function evaluateChickenSample(normT: number): number {
  const len = CHICKEN_STATIC_PCM_SAMPLES.length;
  if (len === 0) return 0;
  const clampedT = Math.max(0, Math.min(1, normT));
  const exactIndex = clampedT * (len - 1);
  const idx = Math.floor(exactIndex);
  const frac = exactIndex - idx;
  const s0 = CHICKEN_STATIC_PCM_SAMPLES[idx] ?? 0;
  const s1 = CHICKEN_STATIC_PCM_SAMPLES[Math.min(len - 1, idx + 1)] ?? s0;
  return s0 + frac * (s1 - s0);
}

export function generateChickenSamples(sampleCount = 401, amplitude = 1.0): number[] {
  const samples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    samples.push(amplitude * evaluateChickenSample(t));
  }
  return samples;
}

export const CHICKEN_SIGNAL_DEFINITION: IngredientSignalDefinition = {
  id: "chicken-recorded",
  ingredientName: "Chicken",
  waveformType: "recorded",
  defaultAmplitude: 1.0,
  domainDisplay: "0.00s ≤ t ≤ 2.16s",
  equationDisplay: "s(t) = PCM_WAV(\"chicken.wav\")[t · 44.1 kHz]",
  equationLatex: "s(t) = \\operatorname{PCM}_{\\mathrm{WAV}}(\\text{chicken.wav})[t \\cdot 44.1\\,\\mathrm{kHz}],\\quad 0 \\le t \\le 2.16\\,\\mathrm{s}",
  description: "Real recorded chicken cluck acoustic signal from public/sounds/chicken.wav (44.1 kHz, 16-bit PCM, 95,154 samples)",
  evaluate: (t, params) => {
    const amp = params.amplitude ?? 1.0;
    return amp * evaluateChickenSample(t);
  },
  generateSamples: (params) => {
    const amp = params.amplitude ?? 1.0;
    const count = params.sampleCount ?? 401;
    return generateChickenSamples(count, amp);
  },
};

export const MATHEMATICAL_SIGNALS: Record<string, IngredientSignalDefinition> = {
  Bun: BUN_SIGNAL_DEFINITION,
  Cheese: CHEESE_SIGNAL_DEFINITION,
  Sugar: SUGAR_SIGNAL_DEFINITION,
  Salt: SALT_SIGNAL_DEFINITION,
  Bread: BREAD_SIGNAL_DEFINITION,
  "Beef Patty": PATTY_SIGNAL_DEFINITION,
  Patty: PATTY_SIGNAL_DEFINITION,
  Lettuce: LETTUCE_SIGNAL_DEFINITION,
  Milk: MILK_SIGNAL_DEFINITION,
  Flour: FLOUR_SIGNAL_DEFINITION,
  Noodles: NOODLE_SIGNAL_DEFINITION,
  Noodle: NOODLE_SIGNAL_DEFINITION,
  Butter: BUTTER_SIGNAL_DEFINITION,
  butter: BUTTER_SIGNAL_DEFINITION,
  Tomato: TOMATO_SIGNAL_DEFINITION,
  tomato: TOMATO_SIGNAL_DEFINITION,
  Onion: ONION_SIGNAL_DEFINITION,
  onion: ONION_SIGNAL_DEFINITION,
  Carrot: CARROT_SIGNAL_DEFINITION,
  carrot: CARROT_SIGNAL_DEFINITION,
  Cucumber: CUCUMBER_SIGNAL_DEFINITION,
  cucumber: CUCUMBER_SIGNAL_DEFINITION,
  Sauce: SAUCE_SIGNAL_DEFINITION,
  sauce: SAUCE_SIGNAL_DEFINITION,
  Egg: EGG_SIGNAL_DEFINITION,
  egg: EGG_SIGNAL_DEFINITION,
  Chicken: CHICKEN_SIGNAL_DEFINITION,
  chicken: CHICKEN_SIGNAL_DEFINITION,
};




export function getMathematicalSignal(name?: string | null): IngredientSignalDefinition | null {
  if (!name) return null;
  return MATHEMATICAL_SIGNALS[name] ?? null;
}
