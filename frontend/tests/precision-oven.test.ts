import { describe, expect, it } from "vitest";
import {
  analyzeSamplingAndAliasing,
  computeBandMetrics,
  computeDiscreteSignalFFT,
  computeSignalIFFT,
  computeSignalSimilarity,
  computeSpectrumSimilarity,
  findMaxSignalFrequency,
  getBandAvailability,
  resampleArray,
  tuneOvenFrequencies,
} from "@/lib/precision-oven-dsp";

describe("Precision Oven DSP: Sampling, Nyquist, FFT Equalizer, and IFFT", () => {
  // Test synthetic continuous tone signal: f0 = 4 Hz, f1 = 12 Hz
  const sampleCount = 401;
  const testSamples: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    testSamples.push(0.6 * Math.sin(2 * Math.PI * 4 * t) + 0.4 * Math.sin(2 * Math.PI * 12 * t));
  }

  describe("1. Sampling & Nyquist Theorem Analysis", () => {
    it("determines correct fmax and minimum safe sampling rate (fs >= 2 * fmax)", () => {
      const fmax = findMaxSignalFrequency(testSamples);
      expect(fmax).toBeGreaterThanOrEqual(10);
      expect(fmax).toBeLessThanOrEqual(14);

      const nyquistRate = 2 * fmax;
      expect(nyquistRate).toBeGreaterThanOrEqual(20);
    });

    it("detects aliasing when fs < 2 * fmax and preservation when fs >= 2 * fmax", () => {
      // Below Nyquist rate (aliasing expected)
      const aliased = analyzeSamplingAndAliasing(testSamples, 8);
      expect(aliased.isAdequate).toBe(false);
      expect(aliased.timeDomainError).toBeGreaterThan(25);

      // Above Nyquist rate (preserved signal)
      const safe = analyzeSamplingAndAliasing(testSamples, 32);
      expect(safe.isAdequate).toBe(true);
      expect(safe.timeDomainError).toBeLessThan(aliased.timeDomainError);
    });

    it("maps discrete sample points and sinc-interpolated reconstruction accurately", () => {
      const demo = analyzeSamplingAndAliasing(testSamples, 32);
      expect(demo.samplePoints.length).toBe(32);
      expect(demo.reconstructedWaveform.length).toBe(401);
    });
  });

  describe("2. Discrete Fourier Transform & Frequency-Bin Mapping", () => {
    it("assigns physical frequency bin according to fk = k * fs / N", () => {
      const fs = 32;
      const N = 64;
      const fftData = computeDiscreteSignalFFT(testSamples, fs, N);

      expect(fftData.sampleRate).toBe(fs);
      expect(fftData.nyquistLimit).toBe(fs / 2); // 16 Hz
      expect(fftData.bins.length).toBe(N / 2 + 1); // 33 single-sided bins

      // Check frequency axis spacing
      const deltaF = fs / N; // 0.5 Hz
      for (let k = 0; k < fftData.bins.length; k++) {
        expect(fftData.bins[k]!.frequency).toBeCloseTo(k * deltaF, 4);
      }
    });

    it("correctly identifies dominant harmonic peaks at 4 Hz and 12 Hz", () => {
      const fs = 64;
      const fftData = computeDiscreteSignalFFT(testSamples, fs, 64);

      // 4 Hz should have a peak
      const bin4 = fftData.bins.find((b) => Math.abs(b.frequency - 4) < 0.6);
      expect(bin4).toBeDefined();
      expect(bin4!.magnitude).toBeGreaterThan(0.3);

      // 12 Hz should have a peak
      const bin12 = fftData.bins.find((b) => Math.abs(b.frequency - 12) < 0.6);
      expect(bin12).toBeDefined();
      expect(bin12!.magnitude).toBeGreaterThan(0.2);
    });
  });

  describe("3. Frequency-Domain Thermal Equalizer H[k] (Warmth, Crumb, Crisp)", () => {
    it("modifies strictly Base Warmth (0-6 Hz) without disturbing higher bands", () => {
      const fs = 64;
      const baseFFT = computeDiscreteSignalFFT(testSamples, fs, 64);

      const tuned = tuneOvenFrequencies(baseFFT, {
        lowGain: 2.0, // boost warmth
        midGain: 1.0,
        highGain: 1.0,
        cutoffHz: 32,
        notchActive: false,
        notchHz: 20,
      });

      // Verify that bins below 6 Hz were boosted
      const lowBin = tuned.tunedBins.find((b) => b.frequency >= 3.5 && b.frequency <= 4.5);
      const originalLowBin = baseFFT.bins.find((b) => b.frequency >= 3.5 && b.frequency <= 4.5);
      expect(lowBin!.rawMagnitude).toBeGreaterThan(originalLowBin!.rawMagnitude * 1.5);

      // Verify that bins in Crumb Texture (6-16 Hz) remained unchanged in rawMagnitude
      const midBin = tuned.tunedBins.find((b) => b.frequency >= 11.5 && b.frequency <= 12.5);
      const originalMidBin = baseFFT.bins.find((b) => b.frequency >= 11.5 && b.frequency <= 12.5);
      expect(midBin!.rawMagnitude).toBeCloseTo(originalMidBin!.rawMagnitude, 3);
    });

    it("modifies strictly Crumb Texture (6-16 Hz) without disturbing lower bands", () => {
      const fs = 64;
      const baseFFT = computeDiscreteSignalFFT(testSamples, fs, 64);

      const tuned = tuneOvenFrequencies(baseFFT, {
        lowGain: 1.0,
        midGain: 0.2, // attenuate crumb
        highGain: 1.0,
        cutoffHz: 32,
        notchActive: false,
        notchHz: 20,
      });

      // Bins below 6 Hz should not be attenuated
      const lowBin = tuned.tunedBins.find((b) => b.frequency >= 3.5 && b.frequency <= 4.5);
      const originalLowBin = baseFFT.bins.find((b) => b.frequency >= 3.5 && b.frequency <= 4.5);
      expect(lowBin!.rawMagnitude).toBeCloseTo(originalLowBin!.rawMagnitude, 3);

      // 12 Hz bin should be heavily attenuated
      const midBin = tuned.tunedBins.find((b) => b.frequency >= 11.5 && b.frequency <= 12.5);
      const originalMidBin = baseFFT.bins.find((b) => b.frequency >= 11.5 && b.frequency <= 12.5);
      expect(midBin!.rawMagnitude).toBeLessThan(originalMidBin!.rawMagnitude * 0.4);
    });

    it("dynamically disables or limits bands when Nyquist limit is below their frequency range", () => {
      // At fs = 16 Hz, Nyquist = 8 Hz.
      // Base Warmth (0-6 Hz): active
      // Crumb Texture (6-16 Hz): partial (covers 6-8 Hz)
      // Top Crisp (16-32 Hz): unavailable
      const avail = getBandAvailability(16, 64);
      expect(avail.base.status).toBe("active");
      expect(avail.crumb.status).toBe("partial");
      expect(avail.top.status).toBe("unavailable");

      // At fs = 64 Hz, Nyquist = 32 Hz. All active!
      const avail64 = getBandAvailability(64, 64);
      expect(avail64.base.status).toBe("active");
      expect(avail64.crumb.status).toBe("active");
      expect(avail64.top.status).toBe("active");
    });
  });

  describe("4. Browning Low-Pass & Charred Notch Filtering", () => {
    it("applies browning cutoff as a progressive low-pass filter", () => {
      const fs = 64;
      const baseFFT = computeDiscreteSignalFFT(testSamples, fs, 64);

      const tuned = tuneOvenFrequencies(baseFFT, {
        lowGain: 1.0,
        midGain: 1.0,
        highGain: 1.0,
        cutoffHz: 4, // Cut off anything above 4 Hz (strongly attenuates 12 Hz harmonic)
        notchActive: false,
        notchHz: 20,
      });

      const bin12 = tuned.tunedBins.find((b) => b.frequency >= 11.5 && b.frequency <= 12.5);
      const orig12 = baseFFT.bins.find((b) => b.frequency >= 11.5 && b.frequency <= 12.5);
      expect(bin12!.rawMagnitude).toBeLessThan(orig12!.rawMagnitude * 0.1);
    });

    it("applies charred notch as a narrow bandstop without disturbing adjacent frequencies", () => {
      const fs = 64;
      const baseFFT = computeDiscreteSignalFFT(testSamples, fs, 64);

      const tuned = tuneOvenFrequencies(baseFFT, {
        lowGain: 1.0,
        midGain: 1.0,
        highGain: 1.0,
        cutoffHz: 32,
        notchActive: true,
        notchHz: 12, // Notch right at 12 Hz
      });

      // 12 Hz harmonic should be notched
      const bin12 = tuned.tunedBins.find((b) => Math.abs(b.frequency - 12) < 0.6);
      const orig12 = baseFFT.bins.find((b) => Math.abs(b.frequency - 12) < 0.6);
      expect(bin12!.rawMagnitude).toBeLessThan(orig12!.rawMagnitude * 0.15);

      // 4 Hz harmonic should remain completely unaffected
      const bin4 = tuned.tunedBins.find((b) => Math.abs(b.frequency - 4) < 0.6);
      const orig4 = baseFFT.bins.find((b) => Math.abs(b.frequency - 4) < 0.6);
      expect(bin4!.rawMagnitude).toBeCloseTo(orig4!.rawMagnitude, 2);
    });

    it("maintains Hermitian symmetry across double-sided complex spectrum", () => {
      const fs = 64;
      const N = 64;
      const baseFFT = computeDiscreteSignalFFT(testSamples, fs, N);

      const tuned = tuneOvenFrequencies(baseFFT, {
        lowGain: 1.5,
        midGain: 0.8,
        highGain: 1.2,
        cutoffHz: 24,
        notchActive: true,
        notchHz: 12,
      });

      // For real-valued time-domain signal, X[N - k] must equal conjugate of X[k]:
      // real[N - k] == real[k], imag[N - k] == -imag[k]
      for (let k = 1; k < N / 2; k++) {
        expect(tuned.tunedReal[N - k]).toBeCloseTo(tuned.tunedReal[k]!, 4);
        expect(tuned.tunedImag[N - k]).toBeCloseTo(-tuned.tunedImag[k]!, 4);
      }
    });
  });

  describe("5. IFFT Reconstruction & Similarity Metrics", () => {
    it("reconstructs 401 time-domain samples via IFFT from modified spectrum", () => {
      const fs = 64;
      const baseFFT = computeDiscreteSignalFFT(testSamples, fs, 64);

      const tuned = tuneOvenFrequencies(baseFFT, {
        lowGain: 1.0,
        midGain: 1.0,
        highGain: 1.0,
        cutoffHz: 32,
        notchActive: false,
        notchHz: 20,
      });

      const reconstructed = computeSignalIFFT(tuned.tunedReal, tuned.tunedImag, 401);
      expect(reconstructed.length).toBe(401);

      // Reconstructed signal self-similarity is 100% and correlates with input testSamples
      const selfSim = computeSignalSimilarity(reconstructed, reconstructed);
      expect(selfSim).toBe(100);

      const sim = computeSignalSimilarity(reconstructed, testSamples);
      expect(sim).toBeGreaterThanOrEqual(60);
    });

    it("evaluates spectral similarity and band metrics against recipe target", () => {
      const fs = 64;
      const fft1 = computeDiscreteSignalFFT(testSamples, fs, 64);
      const fft2 = computeDiscreteSignalFFT(testSamples, fs, 64);

      const specSim = computeSpectrumSimilarity(fft1.bins, fft2.bins);
      expect(specSim).toBeGreaterThanOrEqual(98);

      const metrics = computeBandMetrics(fft1.bins, fft2.bins, 32);
      expect(metrics.length).toBe(3); // base, crumb, top
      expect(metrics[0]!.name).toBe("Base Warmth");
      expect(metrics[1]!.name).toBe("Crumb Body");
      expect(metrics[2]!.name).toBe("Top Crisp");
    });
  });
});
