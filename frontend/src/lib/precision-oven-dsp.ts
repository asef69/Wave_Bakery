/**
 * Core Digital Signal Processing (DSP) Engine for the Precision Oven station.
 * 
 * Implements rigorous CSE220 concepts:
 * 1. Discrete time sampling at selectable rate fs
 * 2. Real-time Nyquist-Shannon Sampling Theorem analysis (fs >= 2 * fmax)
 * 3. Exact harmonic frequency folding calculation: f_alias = |f - k * fs| <= fs / 2
 * 4. Genuine time-domain sinc interpolation reconstruction exhibiting physical aliasing
 * 5. Discrete Fourier Transform (DFT) and Cooley-Tukey Radix-2 FFT/IFFT with dynamic frequency axis fk = k * fs / N
 * 6. Frequency-domain culinary oven equalizer H[k] (warmth, crumb, crisp, cutoff, notch)
 *    operating strictly on actual FFT bin frequencies:
 *    - Base Warmth:  0 <= f < 6 Hz
 *    - Crumb Texture: 6 <= f < 16 Hz
 *    - Top Crisp:    16 <= f <= 32 Hz
 * 7. Inverse FFT time-domain signal reconstruction
 * 8. Objective spectral & waveform similarity metrics against recipe targets
 */

export interface SpectrumBin {
  binIndex: number;
  frequency: number; // physical frequency in Hz (k * fs / N)
  magnitude: number; // normalized [0, 1] for UI display
  rawMagnitude: number;
  phase: number;
  band: "low" | "mid" | "high" | "none";
  isFolded?: boolean;
}

export interface SpectrumData {
  real: number[];
  imag: number[];
  magnitude: number[];
  frequencies: number[];
  bins: SpectrumBin[];
  sampleRate: number; // fs in Hz
  nyquistLimit: number; // fs / 2 in Hz
  referencePeak: number; // un-tuned reference maximum magnitude for fixed display scaling
}

export interface FoldedHarmonic {
  originalHz: number;
  aliasedHz: number;
  magnitude: number;
  isFolded: boolean;
}

export interface BandAvailability {
  base: {
    status: "active";
    minHz: number;
    maxHz: number;
    binCount: number;
    description: string;
  };
  crumb: {
    status: "active" | "partial" | "unavailable";
    minHz: number;
    maxHz: number;
    binCount: number;
    description: string;
  };
  top: {
    status: "active" | "partial" | "unavailable";
    minHz: number;
    maxHz: number;
    binCount: number;
    description: string;
  };
  nyquistLimit: number;
}

export interface AliasingDemonstration {
  isAdequate: boolean;
  samplingRate: number; // fs in Hz
  maxFrequency: number; // fmax in Hz
  nyquistRate: number; // 2 * fmax in Hz (minimum safe fs)
  nyquistLimit: number; // fs / 2 in Hz
  samplePoints: Array<{ t: number; x: number; y: number }>;
  reconstructedWaveform: number[]; // 401 points evaluated from discrete samples via sinc interpolation
  aliasedWaveform: number[];
  timeDomainError: number; // NRMSE percentage [0, 100]
  foldedFrequencies: FoldedHarmonic[];
  sampledSpectrum: SpectrumData; // DFT of the sampled discrete sequence
  referenceSpectrum: SpectrumData; // High-resolution reference spectrum of continuous signal
}

/**
 * Resamples an arbitrary sample array into a target length using linear interpolation.
 */
export function resampleArray(samples: number[], targetLength: number): number[] {
  if (samples.length === 0) return new Array(targetLength).fill(0);
  if (samples.length === targetLength) return [...samples];

  const out = new Array<number>(targetLength);
  const srcLen = samples.length;
  for (let i = 0; i < targetLength; i++) {
    const t = i / (targetLength - 1);
    const srcIdx = t * (srcLen - 1);
    const idx0 = Math.floor(srcIdx);
    const frac = srcIdx - idx0;
    const s0 = samples[idx0] ?? 0;
    const s1 = samples[Math.min(srcLen - 1, idx0 + 1)] ?? s0;
    out[i] = s0 + frac * (s1 - s0);
  }
  return out;
}

/**
 * Evaluates the continuous signal at any normalized time t in [0, 1]
 * using linear interpolation over the discrete incoming samples.
 */
export function evaluateContinuousSignal(samples: number[], t: number): number {
  const len = samples.length;
  if (len === 0) return 0;
  if (len === 1) return samples[0] ?? 0;
  const clampedT = Math.max(0, Math.min(1, t));
  const exact = clampedT * (len - 1);
  const idx = Math.floor(exact);
  const frac = exact - idx;
  const s0 = samples[idx] ?? 0;
  const s1 = samples[Math.min(len - 1, idx + 1)] ?? s0;
  return s0 + frac * (s1 - s0);
}

/**
 * Normalizes sample amplitudes into [-targetPeak, targetPeak].
 */
export function normalizeOvenSamples(samples: number[], targetPeak = 0.92): number[] {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i] ?? 0);
    if (a > maxAbs) maxAbs = a;
  }
  if (maxAbs === 0) return samples;
  const scale = maxAbs > 0.001 ? targetPeak / maxAbs : 1.0;
  return samples.map((s) => s * scale);
}

/**
 * Standard un-normalized sinc function: sinc(u) = sin(pi * u) / (pi * u)
 */
export function sinc(u: number): number {
  if (Math.abs(u) < 1e-6) return 1.0;
  const piU = Math.PI * u;
  return Math.sin(piU) / piU;
}

/**
 * Bit-reversal permutation for power-of-two FFT.
 */
function bitReverseArray(real: number[], imag: number[], n: number) {
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i]!;
      real[i] = real[j]!;
      real[j] = tempR;

      const tempI = imag[i]!;
      imag[i] = imag[j]!;
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }
}

/**
 * In-place Radix-2 Cooley-Tukey FFT.
 * inverse = false -> forward FFT
 * inverse = true  -> inverse FFT
 */
export function cooleyTukeyRadix2(real: number[], imag: number[], inverse: boolean) {
  const n = real.length;
  bitReverseArray(real, imag, n);

  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1.0;
      let wI = 0.0;
      for (let j = 0; j < halfLen; j++) {
        const uR = real[i + j]!;
        const uI = imag[i + j]!;

        const vIdx = i + j + halfLen;
        const vR = real[vIdx]! * wR - imag[vIdx]! * wI;
        const vI = real[vIdx]! * wI + imag[vIdx]! * wR;

        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;

        real[vIdx] = uR - vR;
        imag[vIdx] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        wI = wR * wStepI + wI * wStepR;
        wR = nextWR;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] = real[i]! / n;
      imag[i] = imag[i]! / n;
    }
  }
}

/**
 * Computes high-resolution reference continuous spectrum of the signal.
 * Uses N = 128 points and reference sample rate of 64 Hz (bin resolution 0.5 Hz).
 */
export function computeReferenceSpectrum(samples: number[], baseSampleRate = 128): SpectrumData {
  const FFT_SIZE = 128;
  const x = resampleArray(samples, FFT_SIZE);

  const real = new Array<number>(FFT_SIZE);
  const imag = new Array<number>(FFT_SIZE).fill(0);
  for (let i = 0; i < FFT_SIZE; i++) {
    // Hann window
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
    real[i] = (x[i] ?? 0) * hann;
  }

  cooleyTukeyRadix2(real, imag, false);

  const halfSize = FFT_SIZE / 2;
  const magnitude = new Array<number>(halfSize);
  const frequencies = new Array<number>(halfSize);
  const bins: SpectrumBin[] = [];

  const df = baseSampleRate / FFT_SIZE;

  let maxMag = 0;
  for (let k = 0; k < halfSize; k++) {
    const r = real[k]!;
    const im = imag[k]!;
    const mag = (2 * Math.sqrt(r * r + im * im)) / FFT_SIZE;
    magnitude[k] = mag;
    if (mag > maxMag) maxMag = mag;
    const freq = Math.round(k * df * 10) / 10;
    frequencies[k] = freq;

    const phase = Math.atan2(im, r);
    const band: SpectrumBin["band"] =
      freq < 6.0 ? "low" : freq < 16.0 ? "mid" : freq <= 32.0 ? "high" : "none";

    bins.push({
      binIndex: k,
      frequency: freq,
      magnitude: mag,
      rawMagnitude: mag,
      phase,
      band,
    });
  }

  const refPeak = maxMag > 0 ? maxMag : 1.0;
  for (let k = 0; k < halfSize; k++) {
    magnitude[k] = magnitude[k]! / refPeak;
    bins[k]!.magnitude = magnitude[k]!;
  }

  return {
    real,
    imag,
    magnitude,
    frequencies,
    bins,
    sampleRate: baseSampleRate,
    nyquistLimit: baseSampleRate / 2,
    referencePeak: refPeak,
  };
}

/**
 * Finds the highest significant harmonic frequency (fmax) of the continuous signal
 * containing >= 95% of spectral energy. Returns fmax as an integer in Hz.
 */
export function findMaxSignalFrequency(samples: number[]): number {
  const ref = computeReferenceSpectrum(samples, 128);
  let totalEnergy = 0;
  for (let k = 1; k < ref.bins.length; k++) {
    const mag = ref.bins[k]!.rawMagnitude;
    totalEnergy += mag * mag;
  }
  if (totalEnergy === 0) return 12;

  let running = 0;
  for (let k = 1; k < ref.bins.length; k++) {
    const b = ref.bins[k]!;
    running += b.rawMagnitude * b.rawMagnitude;
    if (running / totalEnergy >= 0.95) {
      return Math.max(8, Math.min(24, Math.round(b.frequency)));
    }
  }
  return 12;
}

/**
 * Computes the Discrete Fourier Transform (DFT) of the actual discrete sampled points
 * at sampling rate fs.
 * 
 * Frequency axis is rigorously fk = k * fs / N, spanning [0, fs / 2].
 * Harmonics with f > fs / 2 fold back into |f - k * fs| <= fs / 2.
 */
export function computeSampledSignalFFT(
  samplePoints: Array<{ t: number; x: number; y: number }>,
  fs: number,
  referenceHarmonics: FoldedHarmonic[],
): SpectrumData {
  const N_FFT = 64;
  const numSamples = samplePoints.length;
  const halfSize = N_FFT / 2;

  const real = new Array<number>(N_FFT).fill(0);
  const imag = new Array<number>(N_FFT).fill(0);

  // Load discrete samples into array with Hann windowing
  for (let m = 0; m < numSamples; m++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * m) / Math.max(1, numSamples - 1)));
    const yVal = samplePoints[m]?.y ?? 0;
    const idx = Math.min(N_FFT - 1, Math.round((m / (numSamples - 1)) * (N_FFT - 1)));
    real[idx] = yVal * w;
  }

  cooleyTukeyRadix2(real, imag, false);

  const df = fs / N_FFT; // frequency bin spacing in Hz
  const magnitude = new Array<number>(halfSize);
  const frequencies = new Array<number>(halfSize);
  const bins: SpectrumBin[] = [];

  let maxMag = 0;
  for (let k = 0; k < halfSize; k++) {
    const r = real[k]!;
    const im = imag[k]!;
    const mag = (2 * Math.sqrt(r * r + im * im)) / Math.max(1, numSamples);
    magnitude[k] = mag;
    if (mag > maxMag) maxMag = mag;

    const freq = Math.round(k * df * 10) / 10;
    frequencies[k] = freq;

    const phase = Math.atan2(im, r);
    const band: SpectrumBin["band"] =
      freq < 6.0 ? "low" : freq < 16.0 ? "mid" : freq <= 32.0 ? "high" : "none";

    const isFolded = referenceHarmonics.some(
      (h) => h.isFolded && Math.abs(h.aliasedHz - freq) <= Math.max(1.0, df * 1.5),
    );

    bins.push({
      binIndex: k,
      frequency: freq,
      magnitude: mag,
      rawMagnitude: mag,
      phase,
      band,
      isFolded,
    });
  }

  const refPeak = maxMag > 0 ? maxMag : 1.0;
  for (let k = 0; k < halfSize; k++) {
    magnitude[k] = magnitude[k]! / refPeak;
    bins[k]!.magnitude = magnitude[k]!;
  }

  return {
    real,
    imag,
    magnitude,
    frequencies,
    bins,
    sampleRate: fs,
    nyquistLimit: fs / 2,
    referencePeak: refPeak,
  };
}

/**
 * Analyzes sampling at a player-selected rate fs.
 * Calculates discrete points, Whittaker-Shannon sinc reconstruction,
 * exact frequency folding, and both time/frequency representations.
 */
export function analyzeSamplingAndAliasing(
  signalSamples: number[],
  fs: number,
): AliasingDemonstration {
  const fmax = findMaxSignalFrequency(signalSamples);
  const nyquistRate = 2 * fmax;
  const nyquistLimit = fs / 2;
  const isAdequate = fs >= nyquistRate;

  // 1. Discrete sample points across normalized 1-second interval [0, 1]
  const numSamples = Math.max(3, Math.round(fs));
  const samplePoints: Array<{ t: number; x: number; y: number }> = [];

  for (let m = 0; m < numSamples; m++) {
    const t = m / fs;
    const yVal = evaluateContinuousSignal(signalSamples, t);
    samplePoints.push({
      t,
      x: t,
      y: yVal,
    });
  }

  // 2. Continuous time-domain reconstruction via periodic Sinc Interpolation
  const len = signalSamples.length;
  const reconstructed = new Array<number>(len);

  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    let acc = 0;
    // Periodic sinc kernel over adjacent periods [-1, 0, 1]
    for (let period = -1; period <= 1; period++) {
      for (let m = 0; m < numSamples; m++) {
        const tm = m / fs + period;
        acc += (samplePoints[m]?.y ?? 0) * sinc(fs * (t - tm));
      }
    }
    reconstructed[i] = acc;
  }

  const normalizedRecon = normalizeOvenSamples(reconstructed, 0.92);

  // 3. Calculate Time-Domain Error (NRMSE)
  let sumSqErr = 0;
  let sumSqOrig = 0;
  for (let i = 0; i < len; i++) {
    const orig = signalSamples[i] ?? 0;
    const rec = normalizedRecon[i] ?? 0;
    sumSqErr += (orig - rec) * (orig - rec);
    sumSqOrig += orig * orig;
  }
  const nrmse = sumSqOrig > 0 ? Math.sqrt(sumSqErr / sumSqOrig) : 0;
  const timeDomainError = Math.min(100, Math.round(nrmse * 100));

  // 4. Reference Spectrum & Dominant Harmonics
  const refSpectrum = computeReferenceSpectrum(signalSamples, 128);
  const foldedFrequencies: FoldedHarmonic[] = [];

  const peaks = [...refSpectrum.bins]
    .filter((b) => b.frequency >= 1)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 5);

  for (const p of peaks) {
    const fOrig = p.frequency;
    let fAlias = fOrig;
    let isFolded = false;

    if (fOrig > nyquistLimit) {
      isFolded = true;
      const k = Math.round(fOrig / fs);
      fAlias = Math.abs(fOrig - k * fs);
      if (fAlias > nyquistLimit) {
        fAlias = Math.abs(fs - fAlias);
      }
    }

    foldedFrequencies.push({
      originalHz: Math.round(fOrig * 10) / 10,
      aliasedHz: Math.round(fAlias * 10) / 10,
      magnitude: Math.round(p.magnitude * 100) / 100,
      isFolded,
    });
  }

  // 5. Sampled Signal Spectrum (DFT of discrete sequence)
  const sampledSpectrum = computeSampledSignalFFT(samplePoints, fs, foldedFrequencies);

  return {
    isAdequate,
    samplingRate: fs,
    maxFrequency: fmax,
    nyquistRate,
    nyquistLimit,
    samplePoints,
    reconstructedWaveform: normalizedRecon,
    aliasedWaveform: normalizedRecon,
    timeDomainError,
    foldedFrequencies,
    sampledSpectrum,
    referenceSpectrum: refSpectrum,
  };
}

/**
 * Computes discrete signal FFT using actual sampling rate fs and power-of-two length N_FFT (default 64).
 * Frequency bin fk = k * fs / N_FFT, covering [0, fs / 2].
 * 
 * Crucially, band membership is strictly determined by physical frequency fk:
 * - Base Warmth:   0 <= fk < 6.0 Hz
 * - Crumb Texture: 6.0 <= fk < 16.0 Hz
 * - Top Crisp:     16.0 <= fk <= 32.0 Hz
 */
export function computeDiscreteSignalFFT(
  samples: number[],
  fs: number,
  N_FFT = 64,
): SpectrumData {
  const numSamples = Math.max(3, Math.round(fs));
  const halfSize = N_FFT / 2;

  const real = new Array<number>(N_FFT).fill(0);
  const imag = new Array<number>(N_FFT).fill(0);

  // Sample continuous signal at rate fs with Hann windowing
  for (let m = 0; m < numSamples; m++) {
    const t = m / fs;
    const yVal = evaluateContinuousSignal(samples, t);
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * m) / Math.max(1, numSamples - 1)));
    const idx = Math.min(N_FFT - 1, Math.round((m / (numSamples - 1)) * (N_FFT - 1)));
    real[idx] = yVal * w;
  }

  cooleyTukeyRadix2(real, imag, false);

  const df = fs / N_FFT; // frequency bin spacing in Hz
  const magnitude = new Array<number>(halfSize + 1);
  const frequencies = new Array<number>(halfSize + 1);
  const bins: SpectrumBin[] = [];

  let maxMag = 0;
  for (let k = 0; k <= halfSize; k++) {
    const r = real[k]!;
    const im = imag[k]!;
    const mag = (2 * Math.sqrt(r * r + im * im)) / Math.max(1, numSamples);
    magnitude[k] = mag;
    if (mag > maxMag) maxMag = mag;

    const freq = Math.round(k * df * 10) / 10;
    frequencies[k] = freq;

    const phase = Math.atan2(im, r);
    const band: SpectrumBin["band"] =
      freq < 6.0 ? "low" : freq < 16.0 ? "mid" : freq <= 32.0 ? "high" : "none";

    bins.push({
      binIndex: k,
      frequency: freq,
      magnitude: mag,
      rawMagnitude: mag,
      phase,
      band,
    });
  }

  const refPeak = maxMag > 0 ? maxMag * 1.25 : 1.0;
  for (let k = 0; k <= halfSize; k++) {
    const norm = magnitude[k]! / refPeak;
    magnitude[k] = norm;
    bins[k]!.magnitude = norm;
  }

  return {
    real,
    imag,
    magnitude,
    frequencies,
    bins,
    sampleRate: fs,
    nyquistLimit: fs / 2,
    referencePeak: refPeak,
  };
}

/**
 * Computes frequency band availability based on the player's actual chosen fs.
 * If Nyquist frequency (fs / 2) is below a band's range, that band is marked
 * as partial or unavailable.
 */
export function getBandAvailability(fs: number, N_FFT = 64): BandAvailability {
  const nyquistLimit = fs / 2;
  const df = fs / N_FFT;
  const half = N_FFT / 2;

  let baseCount = 0;
  let crumbCount = 0;
  let topCount = 0;

  for (let k = 0; k <= half; k++) {
    const f = k * df;
    if (f >= 0 && f < 6.0) baseCount++;
    else if (f >= 6.0 && f < 16.0) crumbCount++;
    else if (f >= 16.0 && f <= 32.0) topCount++;
  }

  // Base status (0 - 6 Hz)
  const baseStatus = "active" as const;
  const baseDesc = "0–6 Hz (Crust depth & fundamental)";

  // Crumb status (6 - 16 Hz)
  let crumbStatus: "active" | "partial" | "unavailable" = "active";
  let crumbDesc = "6–16 Hz (Crumb body harmonics)";
  if (nyquistLimit <= 6.0) {
    crumbStatus = "unavailable";
    crumbDesc = `Unavailable (Nyquist = ${nyquistLimit.toFixed(1)} Hz <= 6 Hz)`;
  } else if (nyquistLimit < 16.0) {
    crumbStatus = "partial";
    crumbDesc = `Partially Active: 6–${nyquistLimit.toFixed(1)} Hz (Nyquist limit)`;
  }

  // Top status (16 - 32 Hz)
  let topStatus: "active" | "partial" | "unavailable" = "active";
  let topDesc = "16–32 Hz (Surface crisp overtones)";
  if (nyquistLimit <= 16.0) {
    topStatus = "unavailable";
    topDesc = `Unavailable at fs = ${fs} Hz (Nyquist = ${nyquistLimit.toFixed(1)} Hz < 16 Hz)`;
  } else if (nyquistLimit < 32.0) {
    topStatus = "partial";
    topDesc = `Partially Active: 16–${nyquistLimit.toFixed(1)} Hz`;
  }

  return {
    base: { status: baseStatus, minHz: 0, maxHz: Math.min(6, nyquistLimit), binCount: baseCount, description: baseDesc },
    crumb: { status: crumbStatus, minHz: 6, maxHz: Math.min(16, nyquistLimit), binCount: crumbCount, description: crumbDesc },
    top: { status: topStatus, minHz: 16, maxHz: Math.min(32, nyquistLimit), binCount: topCount, description: topDesc },
    nyquistLimit,
  };
}

export interface BandMetric {
  band: "low" | "mid" | "high";
  name: string;
  rangeLabel: string;
  minHz: number;
  maxHz: number;
  binCount: number;
  targetEnergy: number; // energy % of target spectrum (0 - 100)
  liveEnergy: number; // energy % of live spectrum (0 - 100)
  ratio: number;
  matchPercent: number; // similarity % (0 - 100)
  status: "match" | "needs-boost" | "needs-cut" | "unavailable";
  recommendation: string;
  sliderKey: "lowGain" | "midGain" | "highGain";
}

/**
 * Computes comparative frequency-band metrics between target and live spectra.
 * Enables the player to pinpoint exactly which frequency band needs adjustment.
 */
export function computeBandMetrics(
  targetBins: SpectrumBin[],
  liveBins: SpectrumBin[],
  nyquistLimit: number,
): BandMetric[] {
  let totalTargetEnergy = 0;
  let totalLiveEnergy = 0;

  for (let i = 0; i < targetBins.length; i++) {
    const tMag = targetBins[i]?.magnitude ?? 0;
    totalTargetEnergy += tMag * tMag;
  }
  for (let i = 0; i < liveBins.length; i++) {
    const lMag = liveBins[i]?.magnitude ?? 0;
    totalLiveEnergy += lMag * lMag;
  }

  const defs: Array<{
    band: "low" | "mid" | "high";
    name: string;
    rangeLabel: string;
    minHz: number;
    nominalMaxHz: number;
    sliderKey: "lowGain" | "midGain" | "highGain";
  }> = [
    { band: "low", name: "Base Warmth", rangeLabel: "0–6 Hz", minHz: 0, nominalMaxHz: 6, sliderKey: "lowGain" },
    { band: "mid", name: "Crumb Body", rangeLabel: "6–16 Hz", minHz: 6, nominalMaxHz: 16, sliderKey: "midGain" },
    { band: "high", name: "Top Crisp", rangeLabel: "16–32 Hz", minHz: 16, nominalMaxHz: 32, sliderKey: "highGain" },
  ];

  return defs.map((def) => {
    const maxHz = Math.min(def.nominalMaxHz, nyquistLimit);
    const isUnavailable = nyquistLimit <= def.minHz;

    if (isUnavailable) {
      return {
        band: def.band,
        name: def.name,
        rangeLabel: def.rangeLabel,
        minHz: def.minHz,
        maxHz: def.minHz,
        binCount: 0,
        targetEnergy: 0,
        liveEnergy: 0,
        ratio: 0,
        matchPercent: 0,
        status: "unavailable" as const,
        recommendation: `Nyquist limit (${nyquistLimit.toFixed(1)} Hz) is below ${def.minHz} Hz`,
        sliderKey: def.sliderKey,
      };
    }

    let tEnergy = 0;
    let lEnergy = 0;
    let tMagSum = 0;
    let lMagSum = 0;
    let diffSum = 0;
    let binCount = 0;

    const count = Math.min(targetBins.length, liveBins.length);
    for (let i = 0; i < count; i++) {
      const tBin = targetBins[i]!;
      const lBin = liveBins[i]!;
      if (tBin.band === def.band || lBin.band === def.band) {
        binCount++;
        const tm = tBin.magnitude;
        const lm = lBin.magnitude;
        tEnergy += tm * tm;
        lEnergy += lm * lm;
        tMagSum += tm;
        lMagSum += lm;
        diffSum += Math.abs(lm - tm);
      }
    }

    const targetEnergyPct = totalTargetEnergy > 0 ? Math.round((tEnergy / totalTargetEnergy) * 100) : 0;
    const liveEnergyPct = totalLiveEnergy > 0 ? Math.round((lEnergy / totalLiveEnergy) * 100) : 0;
    const ratio = tMagSum > 1e-4 ? lMagSum / tMagSum : 1.0;

    let matchPercent = 100;
    if (tMagSum > 1e-4) {
      const errorRate = diffSum / (tMagSum * 1.5);
      matchPercent = Math.max(0, Math.min(100, Math.round(100 * (1 - errorRate))));
    }

    let status: "match" | "needs-boost" | "needs-cut" = "match";
    let recommendation = "✓ Matched with benchmark";

    if (matchPercent < 90 && (ratio < 0.92 || ratio > 1.08)) {
      if (ratio < 0.92) {
        status = "needs-boost";
        recommendation = `Needs Boost ↑ (increase ${def.name})`;
      } else {
        status = "needs-cut";
        recommendation = `Needs Cut ↓ (decrease ${def.name})`;
      }
    }

    return {
      band: def.band,
      name: def.name,
      rangeLabel: def.rangeLabel,
      minHz: def.minHz,
      maxHz,
      binCount,
      targetEnergy: targetEnergyPct,
      liveEnergy: liveEnergyPct,
      ratio: parseFloat(ratio.toFixed(2)),
      matchPercent,
      status,
      recommendation,
      sliderKey: def.sliderKey,
    };
  });
}

/**
 * Standard Radix-2 FFT adapter for the Frequency Lab (Stage 2 & 3).
 * Evaluates using actual fs if provided.
 */
export function computeStandardFFT(samples: number[], fs = 64, N_FFT = 64): SpectrumData {
  return computeDiscreteSignalFFT(samples, fs, N_FFT);
}

/**
 * Backward-compatible alias for computeStandardFFT.
 */
export const computeSignalFFT = computeStandardFFT;

/**
 * Modifies the frequency-domain spectrum according to oven heat element tuning:
 * X'[k] = H[k] * X[k]
 * 
 * Each slider operates strictly and solely on bins whose actual frequency lies inside its range:
 * - Base Warmth:   0 <= f < 6.0 Hz
 * - Crumb Texture: 6.0 <= f < 16.0 Hz
 * - Top Crisp:     16.0 <= f <= 32.0 Hz
 * - Browning Cutoff: Separate low-pass roll-off H_lp(f) for f > cutoffHz
 * - Charred Notch:   Separate narrow notch H_notch(f) around notchHz
 * 
 * Crucially, display magnitudes are normalized using the FIXED reference peak from originalFFT,
 * ensuring that modifying one band slider NEVER causes bars in another band to change!
 */
export function tuneOvenFrequencies(
  originalFFT: SpectrumData,
  options: {
    lowGain: number; // 0.2 to 2.5
    midGain: number; // 0.2 to 2.5
    highGain: number; // 0.2 to 2.5
    cutoffHz: number; // 10 to 32 Hz
    notchHz?: number; // 14 to 28 Hz
    notchActive?: boolean;
  },
): {
  tunedReal: number[];
  tunedImag: number[];
  tunedMagnitude: number[];
  tunedBins: SpectrumBin[];
  spectrumSimilarity: number;
} {
  const { lowGain, midGain, highGain, cutoffHz, notchHz = 22, notchActive = false } = options;
  const n = originalFFT.real.length;
  const half = n / 2;

  const tunedReal = [...originalFFT.real];
  const tunedImag = [...originalFFT.imag];
  const tunedMagnitude = new Array<number>(half + 1);
  const tunedBins: SpectrumBin[] = [];

  const refPeak = originalFFT.referencePeak > 0 ? originalFFT.referencePeak : 1.0;

  for (let k = 0; k <= half; k++) {
    const freq = originalFFT.frequencies[k] ?? 0;

    // 1. Strict Band Gain based on exact physical frequency fk
    let bandGain = 1.0;
    let band: SpectrumBin["band"] = "none";
    if (freq >= 0 && freq < 6.0) {
      bandGain = lowGain;
      band = "low";
    } else if (freq >= 6.0 && freq < 16.0) {
      bandGain = midGain;
      band = "mid";
    } else if (freq >= 16.0 && freq <= 32.0) {
      bandGain = highGain;
      band = "high";
    } else {
      bandGain = 1.0;
      band = "none";
    }

    // 2. Browning Low-Pass Cutoff (smooth Gaussian roll-off above cutoffHz)
    let cutoffAtten = 1.0;
    if (freq > cutoffHz) {
      const excess = freq - cutoffHz;
      cutoffAtten = Math.max(0.01, Math.exp(-Math.pow(excess / 4.0, 2)));
    }

    // 3. Charred Notch Rejection (narrow notch Q ~= 5 around notchHz)
    let notchAtten = 1.0;
    if (notchActive && Math.abs(freq - notchHz) <= 3.0) {
      const df = Math.abs(freq - notchHz);
      notchAtten = 1.0 - 0.88 / (1.0 + Math.pow(df / 1.5, 2));
    }

    const totalScale = bandGain * cutoffAtten * notchAtten;

    // Positive frequency bin
    tunedReal[k] = (originalFFT.real[k] ?? 0) * totalScale;
    tunedImag[k] = (originalFFT.imag[k] ?? 0) * totalScale;

    // Negative frequency Hermitian mirror bin: X[N - k] = conj(X[k])
    if (k > 0 && n - k < n) {
      tunedReal[n - k] = tunedReal[k]!;
      tunedImag[n - k] = -tunedImag[k]!;
    }

    const origBin = originalFFT.bins[k];
    const origDispMag = origBin ? origBin.magnitude : 0;
    const origRawMag = origBin ? origBin.rawMagnitude : 0;

    const tunedRawMag = origRawMag * totalScale;
    const tunedDispMag = origDispMag * totalScale;
    tunedMagnitude[k] = tunedDispMag;

    tunedBins.push({
      binIndex: k,
      frequency: freq,
      magnitude: tunedDispMag,
      rawMagnitude: tunedRawMag,
      phase: origBin ? origBin.phase : Math.atan2(tunedImag[k]!, tunedReal[k]!),
      band,
    });
  }

  return {
    tunedReal,
    tunedImag,
    tunedMagnitude,
    tunedBins,
    spectrumSimilarity: 0,
  };
}

/**
 * Computes Inverse Fast Fourier Transform (IFFT) to reconstruct time-domain signal.
 * Synthesizes back to pipeline sample count (401 points) with normalized headroom.
 */
export function computeSignalIFFT(
  real: number[],
  imag: number[],
  targetSampleCount = 401,
): number[] {
  const n = real.length;
  const rCopy = [...real];
  const iCopy = [...imag];

  // In-place inverse Cooley-Tukey FFT
  cooleyTukeyRadix2(rCopy, iCopy, true);

  // Resample real part back to pipeline sample count
  const reconstructed = resampleArray(rCopy, targetSampleCount);
  return normalizeOvenSamples(reconstructed, 0.95);
}

/**
 * Computes spectral match percentage (0% to 100%) between player and target spectrum.
 */
export function computeSpectrumSimilarity(
  candidateBins: SpectrumBin[],
  targetBins: SpectrumBin[],
): number {
  if (candidateBins.length === 0 || targetBins.length === 0) return 0;
  const len = Math.min(candidateBins.length, targetBins.length);

  let sumDiff = 0;
  let targetSum = 0;

  for (let i = 0; i < len; i++) {
    const cMag = candidateBins[i]?.magnitude ?? 0;
    const tMag = targetBins[i]?.magnitude ?? 0;
    sumDiff += Math.abs(cMag - tMag);
    targetSum += tMag;
  }

  if (targetSum === 0) return 85;
  const errorRate = sumDiff / (targetSum * 1.5);
  return Math.max(0, Math.min(100, Math.round(100 * (1 - errorRate))));
}

/**
 * Computes normalized mathematical similarity (0% - 100%) between reconstructed and target signal.
 */
export function computeSignalSimilarity(
  candidateSamples: number[],
  targetSamples: number[],
): number {
  if (candidateSamples.length === 0 || targetSamples.length === 0) return 0;

  const len = Math.min(candidateSamples.length, targetSamples.length);
  let sumSqErr = 0;
  let targetEnergy = 0;

  for (let i = 0; i < len; i++) {
    const c = candidateSamples[i] ?? 0;
    const t = targetSamples[i] ?? 0;
    const diff = c - t;
    sumSqErr += diff * diff;
    targetEnergy += t * t;
  }

  if (targetEnergy === 0) return 85;

  const nrmse = Math.sqrt(sumSqErr / targetEnergy);
  const similarity = Math.max(0, Math.min(100, Math.round(100 * (1 - nrmse * 0.55))));
  return similarity;
}
