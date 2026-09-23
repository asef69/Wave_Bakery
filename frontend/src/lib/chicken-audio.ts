import { CHICKEN_STATIC_PCM_SAMPLES } from "./chicken-samples";

export interface DecodedChickenAudio {
  buffer: AudioBuffer;
  samples: number[];
  duration: number;
  sampleRate: number;
  totalSamples: number;
  url: string;
}

export const CHICKEN_AUDIO_METADATA = {
  assetPath: "/sounds/chicken.wav",
  sampleRate: 44100,
  duration: 2.158,
  channels: 2,
  totalSamples: 95154,
  format: "16-bit PCM WAV (Stereo)",
};

let cachedChickenPromise: Promise<DecodedChickenAudio> | null = null;
let cachedChickenData: DecodedChickenAudio | null = null;

export function getCachedChickenAudio(): DecodedChickenAudio | null {
  return cachedChickenData;
}

export function getChickenStaticSamples(): number[] {
  return CHICKEN_STATIC_PCM_SAMPLES;
}

/**
 * Loads the chicken audio file from /sounds/chicken.wav, decodes it into an AudioBuffer
 * via the Web Audio API, and extracts the PCM samples.
 */
export async function loadChickenAudio(url = "/sounds/chicken.wav"): Promise<DecodedChickenAudio> {
  if (cachedChickenData) {
    return cachedChickenData;
  }
  if (cachedChickenPromise) {
    return cachedChickenPromise;
  }

  cachedChickenPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("Cannot decode audio in server context");
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load audio from ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      throw new Error("Web Audio API is not supported in this browser");
    }

    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    // Downsample channelData for smooth, high-fidelity SVG waveform display
    const targetPlotPoints = 1000;
    const plotSamples: number[] = [];
    const bucketSize = channelData.length / targetPlotPoints;

    for (let i = 0; i < targetPlotPoints; i++) {
      const start = Math.floor(i * bucketSize);
      const end = Math.min(channelData.length, Math.floor((i + 1) * bucketSize));
      let peakVal = 0;
      for (let j = start; j < end; j++) {
        const val = channelData[j] ?? 0;
        if (Math.abs(val) > Math.abs(peakVal)) {
          peakVal = val;
        }
      }
      plotSamples.push(peakVal);
    }

    const result: DecodedChickenAudio = {
      buffer: audioBuffer,
      samples: plotSamples,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      totalSamples: channelData.length,
      url,
    };

    cachedChickenData = result;
    return result;
  })();

  return cachedChickenPromise;
}
