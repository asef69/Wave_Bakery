/**
 * Cooking Audio Impulse Response Engine
 *
 * Provides high-fidelity discrete impulse responses h[n] for the 4 culinary cooking methods:
 * - GRILL: Multi-tap rapid geometric decay with high-frequency crisp reflection
 * - FRY: Dense sizzling acoustic bursts with exponential decay envelope
 * - BAKE: Smooth thermal diffusion / Gaussian acoustic dispersion
 * - BOIL: Rolling bubble cavitation / damped low-frequency resonator
 *
 * Includes static pre-extracted 64-128 sample kernels with mono energy normalization
 * and dynamic Web Audio WAV loading capability.
 */

export type CookingMethodType = "grill" | "fry" | "bake" | "boil";

export interface DecodedImpulseResponse {
  methodId: CookingMethodType;
  samples: number[];
  length: number;
  sampleRate: number;
}

/**
 * Normalizes impulse kernel energy such that sum(|h[k]|) = 1.0.
 */
export function normalizeKernelEnergy(kernel: number[]): number[] {
  let sum = 0;
  for (let i = 0; i < kernel.length; i++) {
    sum += Math.abs(kernel[i] ?? 0);
  }
  if (sum === 0) return kernel;
  return kernel.map((v) => v / sum);
}

/**
 * Static high-fidelity discrete impulse response kernels (64 - 128 samples).
 */
export function generateStaticCookingKernel(methodId: CookingMethodType, length = 96): number[] {
  const k = new Array<number>(length).fill(0);

  switch (methodId) {
    case "grill": {
      // Crisp multi-tap specular reflections with geometric attenuation
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / 16);
        let tap = 0;
        if (i === 0) tap = 1.0;
        else if (i === 4) tap = 0.55;
        else if (i === 11) tap = 0.38;
        else if (i === 21) tap = 0.22;
        else if (i === 35) tap = 0.12;
        else if (i === 54) tap = 0.06;
        const sizzle = Math.sin(i * 1.85) * 0.15 * decay;
        k[i] = (tap + sizzle) * decay;
      }
      break;
    }
    case "fry": {
      // Sizzling stochastic micro-bursts with exponential damping
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / 22);
        const burst =
          Math.sin(i * 12.9898 + 3.14) * 0.45 +
          Math.sin(i * 31.4159 + 1.2) * 0.35 +
          Math.cos(i * 57.17) * 0.2;
        k[i] = burst * decay;
      }
      break;
    }
    case "bake": {
      // Smooth Gaussian thermal diffusion curve
      const center = 16;
      const sigma = 14;
      for (let i = 0; i < length; i++) {
        k[i] = Math.exp(-Math.pow((i - center) / sigma, 2));
      }
      break;
    }
    case "boil": {
      // Damped low-frequency acoustic cavity resonance (bubble turbulence)
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / 26);
        const bubbleTone = Math.sin((i / 7) * Math.PI) * 0.7 + Math.sin((i / 14) * Math.PI) * 0.3;
        k[i] = bubbleTone * decay;
      }
      break;
    }
  }

  return normalizeKernelEnergy(k);
}

const STATIC_KERNEL_CACHE: Record<CookingMethodType, number[]> = {
  grill: generateStaticCookingKernel("grill", 96),
  fry: generateStaticCookingKernel("fry", 96),
  bake: generateStaticCookingKernel("bake", 96),
  boil: generateStaticCookingKernel("boil", 96),
};

export function getStaticCookingKernel(methodId: CookingMethodType): number[] {
  return STATIC_KERNEL_CACHE[methodId] ?? generateStaticCookingKernel(methodId, 96);
}

const decodedWavKernelCache: Partial<Record<CookingMethodType, number[]>> = {};

/**
 * Loads and decodes an impulse response WAV file, extracting a normalized M-point kernel.
 * Falls back to the static impulse response if file cannot be loaded or in SSR/test environment.
 */
export async function loadCookingImpulseAudio(
  methodId: CookingMethodType,
  url?: string,
  targetLength: number = 96,
): Promise<number[]> {
  if (decodedWavKernelCache[methodId]) {
    return decodedWavKernelCache[methodId]!;
  }

  const assetUrl = url ?? `/sounds/cooking/${methodId}.wav`;

  if (typeof window === "undefined" || !window.fetch) {
    return getStaticCookingKernel(methodId);
  }

  try {
    const response = await fetch(assetUrl);
    if (!response.ok) {
      return getStaticCookingKernel(methodId);
    }
    const arrayBuffer = await response.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return getStaticCookingKernel(methodId);
    }

    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    // Extract first targetLength samples
    const kernel: number[] = [];
    const extractLen = Math.min(channelData.length, targetLength);
    for (let i = 0; i < extractLen; i++) {
      kernel.push(channelData[i] ?? 0);
    }
    while (kernel.length < targetLength) {
      kernel.push(0);
    }

    const normalized = normalizeKernelEnergy(kernel);
    decodedWavKernelCache[methodId] = normalized;
    return normalized;
  } catch {
    return getStaticCookingKernel(methodId);
  }
}
