import { computeCookedSamples, type CookedSignalData } from "@/lib/recipes";
import {
  getCachedChickenAudio,
  getChickenStaticSamples,
  loadChickenAudio,
} from "@/lib/chicken-audio";
import { getPipelineStageSignal } from "@/lib/pipeline";

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  isEnded: boolean;
  currentTime: number; // in seconds
  duration: number; // in seconds
  progress: number; // 0.0 to 1.0
}

export interface SignalAudioSource {
  samples: number[];
  frequency: number;
  duration?: number;
  audioBuffer?: AudioBuffer | null;
  pan?: number; // -1.0 (left) to +1.0 (right)
  ingredientName?: string;
}

/**
 * Playback loops the sample window, jumping from the last sample straight
 * back to the first. When a signal does not complete whole cycles in the
 * window (carrot, milk, a delayed/marinated dish, ...) that jump is a
 * discontinuity heard as a click on every loop — a buzz at the loop rate.
 * If the seam jump is sharper than any step inside the signal, blend the last
 * 5% of the window towards the first sample (raised-cosine ramp) so the loop
 * is continuous. Genuine edges (square waves) are left alone: their seam is
 * no sharper than their own edges.
 */
export function smoothLoopSeam(samples: number[]): number[] {
  const n = samples.length;
  if (n < 8) return samples;
  let maxStep = 0;
  for (let i = 1; i < n; i++) {
    maxStep = Math.max(maxStep, Math.abs((samples[i] ?? 0) - (samples[i - 1] ?? 0)));
  }
  const seam = (samples[0] ?? 0) - (samples[n - 1] ?? 0);
  if (Math.abs(seam) <= 1.5 * maxStep) return samples;
  const rampStart = Math.floor(n * 0.95);
  return samples.map((v, i) => {
    if (i < rampStart) return v;
    const u = (i - rampStart) / (n - 1 - rampStart);
    return v + seam * (0.5 - 0.5 * Math.cos(Math.PI * u));
  });
}

/**
 * Universal Web Audio synthesis and cursor playback controller for any signal
 * (raw ingredients, cooked dishes, etc.). Synthesizes the actual discrete signal
 * samples into an AudioBuffer and provides frame-accurate synchronization with
 * the visual waveform cursor.
 */
export class SignalAudioPlayer {
  protected ctx: AudioContext | null = null;
  protected buffer: AudioBuffer | null = null;
  protected sourceNode: AudioBufferSourceNode | null = null;
  protected gainNode: GainNode | null = null;
  protected pannerNode: StereoPannerNode | null = null;
  protected panValue: number = 0;
  protected startTime: number = 0;
  protected pauseOffset: number = 0;
  protected duration: number = 3.0; // seconds
  protected isPlaying: boolean = false;
  protected isPaused: boolean = false;
  protected isEnded: boolean = false;
  protected rafId: number | null = null;
  protected onUpdateCallback: ((state: PlaybackState) => void) | null = null;

  constructor(source: SignalAudioSource, onUpdate?: (state: PlaybackState) => void) {
    this.onUpdateCallback = onUpdate ?? null;
    this.duration = source.audioBuffer ? source.audioBuffer.duration : (source.duration ?? 3.0);
    this.panValue = Math.max(-1.0, Math.min(1.0, source.pan ?? 0));
    this.initAudio(source);
  }

  private initAudio(source: SignalAudioSource) {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0.55; // comfortable, clear listening level

      // Add Stereo Panner if supported
      if (typeof this.ctx.createStereoPanner === "function") {
        this.pannerNode = this.ctx.createStereoPanner();
        this.pannerNode.pan.value = this.panValue;
        this.gainNode.connect(this.pannerNode);
        this.pannerNode.connect(this.ctx.destination);
      } else {
        this.gainNode.connect(this.ctx.destination);
      }

      // Auto-bind recorded chicken audio if this source represents Chicken
      const isChicken =
        source.ingredientName?.toLowerCase() === "chicken" ||
        source.samples === getChickenStaticSamples() ||
        (source.samples &&
          source.samples.length === 1000 &&
          Math.abs((source.samples[999] ?? 0) - 0.65784) < 1e-4) ||
        (source.samples &&
          source.samples.length === 401 &&
          Math.abs((source.samples[400] ?? 0) - 0.65784) < 1e-2);

      if (!source.audioBuffer && isChicken) {
        const cached = getCachedChickenAudio();
        if (cached) {
          source.audioBuffer = cached.buffer;
          this.duration = cached.duration;
        } else {
          loadChickenAudio()
            .then((decoded) => {
              if (this.ctx && !this.isPlaying) {
                this.buffer = decoded.buffer;
                this.duration = decoded.duration;
              }
            })
            .catch(() => {});
        }
      }

      if (source.audioBuffer) {
        this.buffer = source.audioBuffer;
        this.duration = source.audioBuffer.duration;
        this.gainNode.gain.value = 0.65; // Natural listening level for recorded audio
        return;
      }

      const sampleRate = this.ctx.sampleRate || 44100;
      const numSamples = Math.floor(sampleRate * this.duration);
      this.buffer = this.ctx.createBuffer(1, numSamples, sampleRate);
      const data = this.buffer.getChannelData(0);

      const samples = smoothLoopSeam(source.samples);
      const numCooked = samples.length;
      if (numCooked === 0) return;

      // Map the time-domain waveform to an audible musical pitch (default to 4 Hz / 220 Hz if zero or unset)
      const rawFreq = source.frequency && source.frequency > 0 ? source.frequency : 4.0;
      const baseFreq = Math.max(110, Math.min(880, 220 * (rawFreq / 4)));
      const windowCycles = Math.max(1, rawFreq);
      const windowsPerSec = baseFreq / windowCycles;

      let maxPeak = 0.001;
      for (let i = 0; i < numCooked; i++) {
        const absVal = Math.abs(samples[i] ?? 0);
        if (absVal > maxPeak) maxPeak = absVal;
      }
      const normFactor = maxPeak > 0.01 ? 0.75 / maxPeak : 1.0;

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // Interpolate directly from the actual signal samples
        const phase = (t * windowsPerSec) % 1;
        const sampleIndex = phase * (numCooked - 1);
        const idx = Math.floor(sampleIndex);
        const frac = sampleIndex - idx;
        const s0 = samples[idx] ?? 0;
        const s1 = samples[Math.min(numCooked - 1, idx + 1)] ?? s0;
        const rawSample = s0 + frac * (s1 - s0);

        // Smooth window envelope to eliminate clicks (30ms attack, 120ms release)
        const attack = Math.min(1, t / 0.03);
        const release = Math.min(1, (this.duration - t) / 0.12);
        data[i] = rawSample * normFactor * attack * release;
      }
    } catch {
      // Web Audio unavailable
    }
  }

  private tick = () => {
    if (!this.isPlaying || !this.ctx) return;
    const elapsed = this.ctx.currentTime - this.startTime;
    const current = Math.min(this.duration, Math.max(0, this.pauseOffset + elapsed));
    const progress = Math.min(1, current / this.duration);

    if (current >= this.duration) {
      this.handleEnded();
      return;
    }

    this.emitState(current, progress);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private handleEnded() {
    this.isPlaying = false;
    this.isPaused = false;
    this.isEnded = true;
    this.pauseOffset = this.duration;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.cleanupSource();
    this.emitState(this.duration, 1.0);
  }

  private cleanupSource() {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
  }

  private emitState(currentTime: number, progress: number) {
    if (this.onUpdateCallback) {
      this.onUpdateCallback({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        isEnded: this.isEnded,
        currentTime,
        duration: this.duration,
        progress,
      });
    }
  }

  public async play() {
    if (this.isPlaying || !this.ctx || !this.buffer || !this.gainNode) return;

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    // Reset if previously completed
    if (this.isEnded || this.pauseOffset >= this.duration) {
      this.pauseOffset = 0;
      this.isEnded = false;
    }

    this.cleanupSource();

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.connect(this.gainNode);

    const offset = Math.max(0, Math.min(this.duration, this.pauseOffset));
    this.startTime = this.ctx.currentTime;
    this.sourceNode.start(0, offset);

    this.sourceNode.onended = () => {
      if (
        this.isPlaying &&
        this.ctx &&
        this.ctx.currentTime - this.startTime + offset >= this.duration - 0.05
      ) {
        this.handleEnded();
      }
    };

    this.isPlaying = true;
    this.isPaused = false;
    this.isEnded = false;

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.tick);
  }

  public pause() {
    if (!this.isPlaying || !this.ctx) return;
    const elapsed = this.ctx.currentTime - this.startTime;
    this.pauseOffset = Math.min(this.duration, Math.max(0, this.pauseOffset + elapsed));

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.cleanupSource();
    this.isPlaying = false;
    this.isPaused = true;
    this.emitState(this.pauseOffset, this.pauseOffset / this.duration);
  }

  public setPan(pan: number) {
    this.panValue = Math.max(-1.0, Math.min(1.0, pan));
    if (this.pannerNode) {
      try {
        this.pannerNode.pan.value = this.panValue;
      } catch {
        // ignore
      }
    }
  }

  public replay() {
    this.pauseOffset = 0;
    this.isEnded = false;
    this.play();
  }

  public destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.cleanupSource();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
    }
    this.onUpdateCallback = null;
  }
}

/**
 * Plays a resonant high-tech target lock sound when the beam locks onto the target table.
 */
export function playTargetLockSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two-tone rising harmonic arpeggio (523.25 Hz C5 -> 659.25 Hz E5 -> 783.99 Hz G5)
    const tones = [523.25, 659.25, 783.99];
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.07);
      osc.stop(ctx.currentTime + idx * 0.07 + 0.25);
    });

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 600);
  } catch {
    // ignore
  }
}

/**
 * Plays a futuristic ultrasonic acoustic levitation swoosh sound when delivering the dish.
 */
export function playLevitationLaunchSound(pan: number = 0) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;

    osc.type = "triangle";
    // Frequency sweep from 220Hz -> 880Hz -> 440Hz
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.0);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);

    if (panner) {
      panner.pan.value = Math.max(-1.0, Math.min(1.0, pan));
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.1);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 1300);
  } catch {
    // ignore
  }
}

/**
 * Backward-compatible adapter for cooked signals from the Cooking Lab / convolution stage.
 */
export class CookedSignalAudioPlayer extends SignalAudioPlayer {
  constructor(signal: CookedSignalData, onUpdate?: (state: PlaybackState) => void) {
    let samples = signal.samples && signal.samples.length > 0 ? signal.samples : null;
    if (!samples && signal.recipeId) {
      try {
        const stageSig = getPipelineStageSignal(signal.recipeId, "cooked");
        if (stageSig && stageSig.samples && stageSig.samples.length > 0) {
          samples = stageSig.samples;
        }
      } catch {
        // ignore
      }
    }
    if (!samples) {
      samples = computeCookedSamples({
        frequency: signal.frequency,
        amplitude: signal.amplitude,
        noise: signal.noise,
        shift: signal.shift,
      });
    }
    super({ samples, frequency: signal.frequency, duration: 3.0 }, onUpdate);
  }
}
