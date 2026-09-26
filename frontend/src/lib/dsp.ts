/**
 * Core Mathematical DSP Engine for WaveBakery (CSE220)
 *
 * Provides pure mathematical implementations of:
 * - Radix-2 Cooley-Tukey Fast Fourier Transform (FFT) & Inverse FFT (IFFT)
 * - Frequency-Domain Low-Pass Filter with transition band
 * - Discrete-Time Linear Convolution
 * - Normalized Cross-Correlation (R_xy)
 * - Normalized Root Mean Square Error (NRMSE)
 * - Composite Signal Similarity & Scoring
 */

export interface FFTResult {
  real: number[];
  imag: number[];
  magnitude: number[];
  phase: number[];
}

/**
 * Helper to compute the next power of 2 >= n.
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Bit-reversal permutation for length N (where N is a power of 2).
 */
export function bitReverse(index: number, bits: number): number {
  let reversed = 0;
  for (let i = 0; i < bits; i++) {
    reversed = (reversed << 1) | ((index >> i) & 1);
  }
  return reversed;
}

/**
 * In-place / Pure Radix-2 Cooley-Tukey Decimation-In-Time (DIT) Fast Fourier Transform.
 * Automatically zero-pads input arrays to the next power of 2 if necessary.
 *
 * @param realIn Input real samples x[n]
 * @param imagIn Optional input imaginary samples (defaults to zeros)
 * @returns FFTResult containing real parts, imaginary parts, magnitudes, and phases
 */
export function fft(realIn: number[], imagIn?: number[]): FFTResult {
  const inputLen = realIn.length;
  if (inputLen === 0) {
    return { real: [], imag: [], magnitude: [], phase: [] };
  }

  const N = nextPowerOfTwo(inputLen);
  const bits = Math.round(Math.log2(N));

  const real = new Array<number>(N).fill(0);
  const imag = new Array<number>(N).fill(0);

  // Copy and zero-pad
  for (let i = 0; i < inputLen; i++) {
    real[i] = realIn[i] ?? 0;
    imag[i] = imagIn ? (imagIn[i] ?? 0) : 0;
  }

  // Bit-reversal permutation
  for (let i = 0; i < N; i++) {
    const j = bitReverse(i, bits);
    if (j > i) {
      const tempR = real[i]!;
      real[i] = real[j]!;
      real[j] = tempR;

      const tempI = imag[i]!;
      imag[i] = imag[j]!;
      imag[j] = tempI;
    }
  }

  // Cooley-Tukey iterative radix-2 butterfly
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < N; i += len) {
      let wR = 1.0;
      let wI = 0.0;

      for (let j = 0; j < halfLen; j++) {
        const uR = real[i + j]!;
        const uI = imag[i + j]!;

        const vR = real[i + j + halfLen]! * wR - imag[i + j + halfLen]! * wI;
        const vI = real[i + j + halfLen]! * wI + imag[i + j + halfLen]! * wR;

        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;

        real[i + j + halfLen] = uR - vR;
        imag[i + j + halfLen] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }

  const magnitude = new Array<number>(N);
  const phase = new Array<number>(N);

  for (let i = 0; i < N; i++) {
    const r = real[i]!;
    const im = imag[i]!;
    magnitude[i] = Math.sqrt(r * r + im * im);
    phase[i] = Math.atan2(im, r);
  }

  return { real, imag, magnitude, phase };
}

/**
 * Inverse Fast Fourier Transform (IFFT).
 * Reconstructs time-domain signal x[n] from frequency spectrum X[k].
 *
 * @param real Frequency spectrum real components
 * @param imag Frequency spectrum imaginary components
 * @returns Reconstructed time-domain real samples
 */
export function ifft(real: number[], imag: number[]): number[] {
  const N = real.length;
  if (N === 0) return [];

  // IFFT(X) = (1/N) * conj(FFT(conj(X)))
  const conjImag = imag.map((v) => -v);
  const forward = fft(real, conjImag);

  const out = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    out[i] = forward.real[i]! / N;
  }
  return out;
}

/**
 * Frequency-Domain Low-Pass Filter.
 * Transforms noisy discrete samples to frequency domain via FFT,
 * applies a frequency-domain window H(f) with a smooth 2-bin transition band,
 * and reconstructs the cleaned time-domain signal via IFFT.
 *
 * @param samples Noisy discrete-time input samples
 * @param cutoffHz Cutoff frequency in Hertz
 * @param sampleRate Sampling frequency in Hertz (default: 44100 Hz)
 * @returns Cleaned time-domain output samples of matching input length
 */
export function applyLowPassFilter(
  samples: number[],
  cutoffHz: number,
  sampleRate: number = 44100,
): number[] {
  const origLen = samples.length;
  if (origLen === 0) return [];

  const N = nextPowerOfTwo(origLen);
  const forward = fft(samples);
  const binHz = sampleRate / N;
  const cutoffBin = cutoffHz / binHz;

  const filteredReal = [...forward.real];
  const filteredImag = [...forward.imag];

  const nyquistBin = N / 2;
  const transitionBins = 2.0;

  for (let k = 0; k <= nyquistBin; k++) {
    let gain = 1.0;
    if (k > cutoffBin + transitionBins) {
      gain = 0.0;
    } else if (k > cutoffBin) {
      // Linear transition band
      gain = 1.0 - (k - cutoffBin) / transitionBins;
    }

    filteredReal[k] = (filteredReal[k] ?? 0) * gain;
    filteredImag[k] = (filteredImag[k] ?? 0) * gain;

    // Symmetric negative frequency bin
    if (k > 0 && k < nyquistBin) {
      const symK = N - k;
      filteredReal[symK] = (filteredReal[symK] ?? 0) * gain;
      filteredImag[symK] = (filteredImag[symK] ?? 0) * gain;
    }
  }

  const reconstructed = ifft(filteredReal, filteredImag);
  return reconstructed.slice(0, origLen);
}

/**
 * Discrete Linear Convolution: y[n] = (x * h)[n] = sum_{k=0}^{M-1} x[n-k] * h[k].
 *
 * @param x Input discrete signal array of length N
 * @param h Impulse response filter kernel array of length M
 * @returns Convolved signal of length N + M - 1
 */
export function convolve(x: number[], h: number[]): number[] {
  const nLen = x.length;
  const mLen = h.length;
  if (nLen === 0 || mLen === 0) return [];

  const outLen = nLen + mLen - 1;
  const out = new Array<number>(outLen).fill(0);

  for (let n = 0; n < outLen; n++) {
    let sum = 0;
    for (let k = 0; k < mLen; k++) {
      const xIdx = n - k;
      if (xIdx >= 0 && xIdx < nLen) {
        sum += (x[xIdx] ?? 0) * (h[k] ?? 0);
      }
    }
    out[n] = sum;
  }

  return out;
}

/**
 * Normalized Cross-Correlation (Pearson correlation coefficient) between two discrete signals:
 * R_xy = sum((x[n] - mean(x)) * (y[n] - mean(y))) / sqrt(sum((x[n] - mean(x))^2) * sum((y[n] - mean(y))^2))
 *
 * @param x First signal samples
 * @param y Second signal samples
 * @returns Correlation value R_xy in [-1.0, 1.0]
 */
export function normalizedCrossCorrelation(x: number[], y: number[]): number {
  const len = Math.min(x.length, y.length);
  if (len === 0) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < len; i++) {
    sumX += x[i] ?? 0;
    sumY += y[i] ?? 0;
  }
  const meanX = sumX / len;
  const meanY = sumY / len;

  let numer = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < len; i++) {
    const dx = (x[i] ?? 0) - meanX;
    const dy = (y[i] ?? 0) - meanY;
    numer += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom < 1e-12) {
    // Zero variance case: check if identical
    let identical = true;
    for (let i = 0; i < len; i++) {
      if (Math.abs((x[i] ?? 0) - (y[i] ?? 0)) > 1e-6) {
        identical = false;
        break;
      }
    }
    return identical ? 1.0 : 0.0;
  }

  const r = numer / denom;
  return Math.max(-1.0, Math.min(1.0, r));
}

/**
 * Normalized Root Mean Square Error (NRMSE) Similarity Metric:
 * NRMSE_sim = 1 - (RMSE / (max(y) - min(y)))
 *
 * @param x Measured / player signal samples
 * @param y Target / reference signal samples
 * @returns Similarity score in [0.0, 1.0] (1.0 = identical, 0.0 = completely divergent)
 */
export function normalizedRootMeanSquareError(x: number[], y: number[]): number {
  const len = Math.min(x.length, y.length);
  if (len === 0) return 0;

  let minY = Infinity;
  let maxY = -Infinity;
  let sse = 0;

  for (let i = 0; i < len; i++) {
    const valY = y[i] ?? 0;
    const valX = x[i] ?? 0;
    if (valY < minY) minY = valY;
    if (valY > maxY) maxY = valY;
    const err = valX - valY;
    sse += err * err;
  }

  const rmse = Math.sqrt(sse / len);
  let range = maxY - minY;
  if (range < 1e-6) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < len; i++) {
      const valX = x[i] ?? 0;
      if (valX < minX) minX = valX;
      if (valX > maxX) maxX = valX;
    }
    range = maxX - minX > 1e-6 ? maxX - minX : 1.0;
  }

  const nrmseSim = 1 - rmse / range;
  return Math.max(0.0, Math.min(1.0, nrmseSim));
}

/**
 * True when a pipeline signal is one period of a looping dish: its last
 * sample repeats the first (within 2 % of the peak — convolution leaves a
 * rounding-level mismatch on some dishes).
 */
export function isOnePeriod(x: number[]): boolean {
  if (x.length < 3) return false;
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return Math.abs(x[0]! - x[x.length - 1]!) <= 0.02 * peak;
}

/**
 * Computes composite match percentage between player signal and ideal target signal.
 * Combines Normalized Cross-Correlation (shape fidelity) and NRMSE (amplitude/offset fidelity).
 *
 * @param playerSamples Discrete samples created by player
 * @param targetSamples Discrete samples of ideal target dish
 * @returns Match percentage in [0, 100]%
 */
export function computeSignalSimilarity(playerSamples: number[], targetSamples: number[]): number {
  if (!playerSamples.length || !targetSamples.length) return 0;

  let pSamples = playerSamples;
  if (playerSamples.length !== targetSamples.length) {
    pSamples = new Array<number>(targetSamples.length);
    for (let i = 0; i < targetSamples.length; i++) {
      const t = i / (targetSamples.length - 1);
      const exact = t * (playerSamples.length - 1);
      const idx = Math.floor(exact);
      const frac = exact - idx;
      const s0 = playerSamples[idx] ?? 0;
      const s1 = playerSamples[Math.min(playerSamples.length - 1, idx + 1)] ?? s0;
      pSamples[i] = s0 + frac * (s1 - s0);
    }
  }

  const rXy = normalizedCrossCorrelation(pSamples, targetSamples);
  const nrmse = normalizedRootMeanSquareError(pSamples, targetSamples);

  // Shape correlation component (mapped from [-1, 1] to [0, 1])
  const corrScore = Math.max(0, rXy);

  // 50% Shape correlation + 50% NRMSE amplitude match
  const composite = 0.5 * corrScore + 0.5 * nrmse;
  return Math.round(composite * 1000) / 10; // e.g. 94.5%
}
