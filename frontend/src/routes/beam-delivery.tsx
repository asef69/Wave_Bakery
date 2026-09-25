import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flame,
  KeyRound,
  Layers,
  Lock,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Unlock,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { StationLocked } from "@/components/game/StationLocked";
import { SignalAudioPlayer, type PlaybackState } from "@/lib/audio";
import {
  getDefaultPipelineSignal,
  carryCurve,
  curvePointToSvg,
  getIdealDishSignal,
  samplesAlongCurvePath,
  savePipelineStageSignal,
  usePipelineStageSignal,
} from "@/lib/pipeline";
import {
  analyzeSamplingAndAliasing,
  computeBandMetrics,
  computeDiscreteSignalFFT,
  computeSignalIFFT,
  computeSpectrumSimilarity,
  computeStandardFFT,
  findMaxSignalFrequency,
  getBandAvailability,
  tuneOvenFrequencies,
  type AliasingDemonstration,
  type BandAvailability,
  type BandMetric,
  type SpectrumBin,
  type SpectrumData,
} from "@/lib/precision-oven-dsp";
import { computeSignalSimilarity } from "@/lib/dsp";
import {
  recordStageAccuracy,
  syncSessionParamsToBackend,
  useActiveRecipe,
  useCookedSignal,
  useRecipeProgress,
  useRecipeTimer,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/beam-delivery")({
  head: () => ({
    meta: [
      { title: "🔥 Precision Oven — WaveBakery" },
      {
        name: "description",
        content:
          "Precision Oven: discover the minimum sampling rate, unlock the frequency domain, sculpt thermal harmonics with FFT, and reconstruct with IFFT.",
      },
      { property: "og:title", content: "🔥 Precision Oven — WaveBakery" },
      {
        property: "og:description",
        content:
          "Sampling, Nyquist Theorem, Frequency Spectrum FFT and IFFT Reconstruction finishing station.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrecisionOvenScreen,
});

type OvenStage = "sampling" | "unlock" | "fft-lab" | "ifft" | "plate";

const STAGES: Array<{ id: OvenStage; label: string; short: string; num: string }> = [
  { id: "sampling", label: "1. Sampling Lock", short: "Sampling", num: "01" },
  { id: "unlock", label: "2. Unlock Lab", short: "Unlock", num: "02" },
  { id: "fft-lab", label: "3. FFT Lab", short: "FFT Lab", num: "03" },
  { id: "ifft", label: "4. Run IFFT", short: "IFFT", num: "04" },
  { id: "plate", label: "5. Final Check", short: "Plate", num: "05" },
];

/** Highest rate the oven's sampler (slider and FFT bands) supports. */
const MAX_OVEN_FS = 64;

function PrecisionOvenScreen() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const { difficultyConfig } = useRecipeTimer();
  const navigate = useNavigate();

  // 1. Obtain the actual dish signal produced by the previous cooking stage
  const [cookedSignal] = useCookedSignal(recipe.id);
  const [pipelineCooked] = usePipelineStageSignal(recipe.id, "cooked");

  const dishSamples = useMemo(() => {
    if (pipelineCooked.samples && pipelineCooked.samples.length > 0) {
      return pipelineCooked.samples;
    }
    if (cookedSignal.samples && cookedSignal.samples.length > 0) {
      return cookedSignal.samples;
    }
    return getDefaultPipelineSignal(recipe.id, "cooked").samples;
  }, [pipelineCooked.samples, cookedSignal.samples, recipe.id]);

  // Target reference dish signal for recipe
  const targetSignal = useMemo(() => getIdealDishSignal(recipe.id), [recipe.id]);

  // Navigation & Unlock State
  const [currentStage, setCurrentStage] = useState<OvenStage>("sampling");
  const [unlockedStages, setUnlockedStages] = useState<Set<OvenStage>>(new Set(["sampling"]));

  // -------------------------------------------------------------
  // STAGE 1: SAMPLING & ALIASING
  // -------------------------------------------------------------
  const trueFmax = useMemo(() => findMaxSignalFrequency(dishSamples), [dishSamples]);
  const minSafeSamplingRate = useMemo(() => 2 * trueFmax, [trueFmax]);

  // Player sampling frequency slider (starts at an aliased low rate for discovery)
  const [samplingRate, setSamplingRate] = useState<number>(8);
  const [lockedFsRate, setLockedFsRate] = useState<number | null>(null);
  const [verifiedFs, setVerifiedFs] = useState<number>(() => Math.max(24, minSafeSamplingRate));

  const aliasingData: AliasingDemonstration = useMemo(() => {
    return analyzeSamplingAndAliasing(dishSamples, samplingRate);
  }, [dishSamples, samplingRate]);

  // -------------------------------------------------------------
  // STAGE 2: PASSWORD / UNLOCK MECHANIC
  // -------------------------------------------------------------
  const [enteredFsInput, setEnteredFsInput] = useState<string>("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "error" | "success">("idle");
  const [passwordFeedback, setPasswordFeedback] = useState<string>("");

  const handleLockSamplingRate = () => {
    setLockedFsRate(samplingRate);
    setVerifiedFs(samplingRate);
    setUnlockedStages((prev) => new Set([...prev, "unlock"]));
    setCurrentStage("unlock");
  };

  const handleVerifyPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entered = parseFloat(enteredFsInput.trim());
    if (isNaN(entered) || entered <= 0) {
      setPasswordStatus("error");
      setPasswordFeedback("Please enter a valid sampling frequency in Hz.");
      return;
    }

    if (entered > MAX_OVEN_FS) {
      setPasswordStatus("error");
      setPasswordFeedback(
        `✕ ${entered} Hz is beyond the oven's ${MAX_OVEN_FS} Hz sampler. Find the smallest rate that still satisfies fs ≥ 2·fmax.`,
      );
      return;
    }

    if (entered < minSafeSamplingRate) {
      setPasswordStatus("error");
      setPasswordFeedback(
        `✕ Incorrect sampling rate (${entered} Hz). This rate violates the Nyquist condition (fs < 2·fmax = ${minSafeSamplingRate} Hz). Harmonics fold into false ghost frequencies and distort the dish!`,
      );
    } else {
      setPasswordStatus("success");
      const isExactMin = entered === minSafeSamplingRate;
      setVerifiedFs(entered);
      setLockedFsRate(entered);
      setPasswordFeedback(
        `✓ SAMPLING VERIFIED: fs = ${entered} Hz satisfies Nyquist criterion (fs >= ${minSafeSamplingRate} Hz). Signal bandwidth is completely preserved without aliasing! ${
          isExactMin ? "★ Perfect minimum Nyquist rate found!" : ""
        }`,
      );
      setUnlockedStages((prev) => new Set([...prev, "fft-lab"]));
    }
  };

  // -------------------------------------------------------------
  // STAGE 3: FFT FREQUENCY LAB (Target vs Your Signal)
  // -------------------------------------------------------------
  // Both spectra use the player's verified sampling rate fs
  const activeRate = verifiedFs > 0 ? verifiedFs : 32;

  const targetFFT: SpectrumData = useMemo(() => {
    return computeDiscreteSignalFFT(targetSignal.samples, activeRate, 64);
  }, [targetSignal.samples, activeRate]);

  const playerBaseFFT: SpectrumData = useMemo(() => {
    return computeDiscreteSignalFFT(dishSamples, activeRate, 64);
  }, [dishSamples, activeRate]);

  const bandAvailability: BandAvailability = useMemo(() => {
    return getBandAvailability(activeRate, playerBaseFFT.real.length);
  }, [activeRate, playerBaseFFT.real.length]);

  // Frequency-domain manipulation controls
  const [lowGain, setLowGain] = useState<number>(1.0);
  const [midGain, setMidGain] = useState<number>(1.0);
  const [highGain, setHighGain] = useState<number>(1.0);
  const [browningCutoffHz, setBrowningCutoffHz] = useState<number>(() =>
    Math.min(26, Math.round(activeRate / 2)),
  );
  const [notchActive, setNotchActive] = useState<boolean>(false);
  const [notchHz, setNotchHz] = useState<number>(() => Math.min(22, Math.round(activeRate / 2)));

  // Active hover/focus band for visual highlighting on graph
  const [activeBandHover, setActiveBandHover] = useState<
    "low" | "mid" | "high" | "cutoff" | "notch" | null
  >(null);

  const tunedSpectrum = useMemo(() => {
    return tuneOvenFrequencies(playerBaseFFT, {
      lowGain,
      midGain,
      highGain: bandAvailability.top.status === "unavailable" ? 1.0 : highGain,
      cutoffHz: browningCutoffHz,
      notchActive,
      notchHz,
    });
  }, [
    playerBaseFFT,
    lowGain,
    midGain,
    highGain,
    bandAvailability.top.status,
    browningCutoffHz,
    notchActive,
    notchHz,
  ]);

  // Live Spectrum Similarity (%)
  const spectrumMatchPercent = useMemo(() => {
    return computeSpectrumSimilarity(tunedSpectrum.tunedBins, targetFFT.bins);
  }, [tunedSpectrum.tunedBins, targetFFT.bins]);

  // Comparative Frequency-Band Breakdown & Target Diagnostics
  const bandMetrics = useMemo(() => {
    return computeBandMetrics(targetFFT.bins, tunedSpectrum.tunedBins, targetFFT.nyquistLimit);
  }, [targetFFT.bins, tunedSpectrum.tunedBins, targetFFT.nyquistLimit]);

  // -------------------------------------------------------------
  // STAGE 4: IFFT RECONSTRUCTION & AUDIO PLAYBACK
  // -------------------------------------------------------------
  const reconstructedSamples = useMemo(() => {
    return computeSignalIFFT(
      tunedSpectrum.tunedReal,
      tunedSpectrum.tunedImag,
      dishSamples.length,
      activeRate,
    );
  }, [tunedSpectrum.tunedReal, tunedSpectrum.tunedImag, dishSamples.length, activeRate]);

  const timeDomainSimilarity = useMemo(() => {
    return computeSignalSimilarity(reconstructedSamples, targetSignal.samples);
  }, [reconstructedSamples, targetSignal.samples]);

  // The station's goal is the MINIMUM safe rate: full marks up to 25% above
  // 2·fmax, falling linearly to 0 at the sampler's maximum. Any rate that
  // merely satisfied Nyquist used to score the same.
  const samplingEfficiency = useMemo(() => {
    const slack = minSafeSamplingRate * 1.25;
    if (activeRate <= slack) return 100;
    return Math.max(
      0,
      Math.round(100 * (1 - (activeRate - slack) / Math.max(1, MAX_OVEN_FS - slack))),
    );
  }, [activeRate, minSafeSamplingRate]);

  const overallScore = useMemo(() => {
    return Math.round(
      spectrumMatchPercent * 0.4 + timeDomainSimilarity * 0.5 + samplingEfficiency * 0.1,
    );
  }, [spectrumMatchPercent, timeDomainSimilarity, samplingEfficiency]);

  // Audio Playback
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    isEnded: false,
    currentTime: 0,
    duration: 3.0,
    progress: 0,
  });

  const playerRef = useRef<SignalAudioPlayer | null>(null);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.destroy();
      playerRef.current = null;
    }

    if (reconstructedSamples && reconstructedSamples.length > 0) {
      playerRef.current = new SignalAudioPlayer(
        {
          samples: reconstructedSamples,
          frequency: cookedSignal.frequency || 4,
          duration: 3.0,
        },
        (state) => setPlaybackState(state),
      );
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [reconstructedSamples, cookedSignal.frequency]);

  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    if (playbackState.isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  };

  const handleReplay = () => {
    if (!playerRef.current) return;
    playerRef.current.replay();
  };

  const handleRunIFFT = () => {
    setUnlockedStages((prev) => new Set([...prev, "ifft", "plate"]));
    setCurrentStage("ifft");
  };

  // -------------------------------------------------------------
  // STAGE 5: FINAL PLATING & PIPELINE SAVE
  // -------------------------------------------------------------
  const handlePlateAndFinish = () => {
    // The oven output is the DELIVERED stage; the cooked dish stays as the
    // Cooking lab left it (it used to be overwritten here, so Check Dish and
    // System Delivery showed the oven output labelled as "cooked").
    savePipelineStageSignal(
      recipe.id,
      "delivered",
      carryCurve(
        {
          recipeId: recipe.id,
          stage: "delivered",
          samples: reconstructedSamples,
          sampleRate: 44100,
          duration: 3.0,
          frequency: cookedSignal.frequency || 4,
          timestamp: Date.now(),
          metadata: {
            ovenSamplingRate: activeRate,
            spectrumMatchPercent,
            timeDomainSimilarity,
            overallScore,
          },
        },
        pipelineCooked,
      ),
    );

    recordStageAccuracy("delivery", overallScore);
    syncSessionParamsToBackend(recipe.id).catch(() => {});
    unlock(8);
    navigate({ to: "/system-delivery" });
  };

  // Helper dimensions for SVG oscilloscopes
  const svgWidth = 600;
  const svgHeight = 220;

  if (unlockedStep < 7) {
    return (
      <StationLocked
        station="Precision Oven"
        reason="Cook your signal in the Cooking Lab before finishing it in the oven."
        chefLine="There's nothing to finish yet: convolve the dish in the Cooking Lab first!"
        goTo="/cooking"
        goLabel="Go to Cooking Lab →"
      />
    );
  }

  return (
    <LabShell
      eyebrow={`FINISHING STATION • RECIPE: ${recipe.name}`}
      title="🔥 Precision Oven"
      chefLine="Discover the safe sampling rate, unlock the frequency domain, and reconstruct with IFFT!"
      backTo="/check-dish"
      backLabel="← Back to Dish Inspection"
    >
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        {/* Oven Title & Progress Banner */}
        <div className="kitchen-card relative overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <Flame className="h-5 w-5 animate-pulse" />
                </span>
                <p className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                  FINISHING STATION • RECIPE: {recipe.name}
                </p>
              </div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground uppercase sm:text-4xl">
                🔥 Precision Oven
              </h1>
              <p className="text-sm text-muted-foreground">
                Sampling · Nyquist Theorem · Aliasing Elimination · FFT Spectrum · IFFT
                Reconstruction
              </p>
            </div>

            {/* Stages Navigation Pills */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-secondary/40 p-1.5">
              {STAGES.map((s) => {
                const isUnlocked = unlockedStages.has(s.id);
                const isActive = currentStage === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => isUnlocked && setCurrentStage(s.id)}
                    disabled={!isUnlocked}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-all cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isUnlocked
                          ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          : "opacity-40 cursor-not-allowed text-muted-foreground",
                    )}
                  >
                    <span>{s.num}</span>
                    <span className="hidden sm:inline">{s.short}</span>
                    {!isUnlocked && <Lock className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STAGE 1: SAMPLING LOCK */}
        {/* ========================================================================= */}
        {currentStage === "sampling" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold tracking-wider text-primary uppercase">
                  Stage 01 • Interactive Challenge
                </p>
                <h2 className="font-display text-2xl font-bold uppercase text-foreground">
                  Find the Safe Sampling Rate ($f_s$)
                </h2>
                <p className="text-sm text-muted-foreground">
                  Adjust the sampling frequency slider. Watch BOTH the waveform and the spectrum.
                  Find the minimum rate that avoids aliasing!
                </p>
              </div>

              {/* Status Indicator */}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-xs font-bold uppercase shadow-xs",
                  aliasingData.isAdequate
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/60 bg-amber-500/10 text-amber-400 animate-pulse",
                )}
              >
                {aliasingData.isAdequate ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>✓ Signal Preserved (No Aliasing)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span>⚠ Aliasing Detected (Harmonics Folded)</span>
                  </>
                )}
              </div>
            </div>

            {/* Slider Control Panel */}
            <div className="kitchen-card border-2 border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="sampling-rate-slider"
                    className="font-mono text-xs font-bold text-foreground uppercase"
                  >
                    Sampling Frequency ($f_s$):
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Discrete samples per second across normalized 1-second interval (Nyquist limit =
                    $f_s / 2$)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-extrabold text-primary">
                    {samplingRate}{" "}
                    <span className="text-sm font-semibold text-muted-foreground">Hz</span>
                  </span>
                  <span className="rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground">
                    {aliasingData.samplePoints.length} discrete points
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <span className="font-mono text-xs text-muted-foreground">4 Hz</span>
                <input
                  id="sampling-rate-slider"
                  type="range"
                  min={4}
                  max={64}
                  step={1}
                  value={samplingRate}
                  onChange={(e) => setSamplingRate(parseInt(e.target.value, 10))}
                  className="h-2 w-full cursor-pointer accent-primary"
                />
                <span className="font-mono text-xs text-muted-foreground">64 Hz</span>
              </div>
            </div>

            {/* Dual Real-time Linked Views: Time-Domain & Frequency-Domain */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* VIEW A: Time-Domain Sampling View */}
              <div className="kitchen-card border-2 border-border bg-card p-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-base font-bold uppercase text-foreground">
                      A. Time-Domain Sampling
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Error:{" "}
                    <span
                      className={
                        aliasingData.isAdequate
                          ? "text-emerald-400 font-bold"
                          : "text-amber-400 font-bold"
                      }
                    >
                      {aliasingData.timeDomainError}%
                    </span>
                  </span>
                </div>

                <div className="relative mt-4 overflow-hidden rounded-xl border border-border/80 bg-black/60 p-2">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="h-48 w-full"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1="0"
                      y1={svgHeight / 2}
                      x2={svgWidth}
                      y2={svgHeight / 2}
                      stroke="currentColor"
                      strokeDasharray="3 3"
                      className="text-border/40"
                    />

                    {/* Continuous Reference Waveform (Gold) */}
                    <path
                      d={samplesAlongCurvePath(
                        dishSamples,
                        pipelineCooked,
                        svgWidth,
                        svgHeight,
                        0.38,
                      )}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeOpacity="0.8"
                    />

                    {/* Reconstructed Waveform from Discrete Samples (Cyan or Rose if Aliased) */}
                    <path
                      d={samplesAlongCurvePath(
                        aliasingData.reconstructedWaveform,
                        pipelineCooked,
                        svgWidth,
                        svgHeight,
                        0.38,
                      )}
                      fill="none"
                      stroke={aliasingData.isAdequate ? "#06b6d4" : "#f43f5e"}
                      strokeWidth="2.5"
                      strokeDasharray={aliasingData.isAdequate ? "none" : "5 3"}
                    />

                    {/* Discrete Sample Points */}
                    {aliasingData.samplePoints.map((pt, idx) => {
                      const { x: px, y: py } = curvePointToSvg(
                        pipelineCooked,
                        pt.t,
                        pt.y,
                        svgWidth,
                        svgHeight,
                        0.38,
                      );
                      return (
                        <circle
                          key={idx}
                          cx={px}
                          cy={py}
                          r={samplingRate > 32 ? "2.5" : "4"}
                          fill="#38bdf8"
                          stroke="#0284c7"
                          strokeWidth="1.5"
                          className="transition-all"
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Legend */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-full bg-amber-500" />
                    <span>Reference Continuous Wave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400 border border-sky-600" />
                    <span>Sample Points ($N={aliasingData.samplePoints.length}$)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-4 rounded-full",
                        aliasingData.isAdequate ? "bg-cyan-500" : "bg-rose-500",
                      )}
                    />
                    <span>
                      {aliasingData.isAdequate
                        ? "Preserved Reconstruction"
                        : "Aliased Reconstruction"}
                    </span>
                  </div>
                </div>
              </div>

              {/* VIEW B: Frequency-Domain FFT Aliasing View */}
              <div className="kitchen-card border-2 border-border bg-card p-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-base font-bold uppercase text-foreground">
                      B. Frequency-Domain (FFT)
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Nyquist Limit:{" "}
                    <span className="font-bold text-primary">
                      {aliasingData.nyquistLimit.toFixed(1)} Hz
                    </span>{" "}
                    ($f_s / 2$)
                  </span>
                </div>

                <div className="relative mt-4 flex h-48 w-full flex-col justify-end overflow-hidden rounded-xl border border-border/80 bg-black/60 p-3">
                  {/* Spectrum Bins Bar Chart */}
                  <div className="flex h-36 items-end gap-1">
                    {aliasingData.sampledSpectrum.bins.map((bin, i) => {
                      const heightPercent = Math.max(4, Math.round(bin.magnitude * 100));
                      return (
                        <div
                          key={i}
                          className="group relative flex h-full flex-1 flex-col justify-end items-center"
                        >
                          {/* Tooltip on hover */}
                          <div className="pointer-events-none absolute -top-8 z-20 hidden rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-foreground shadow-md group-hover:block whitespace-nowrap">
                            {bin.frequency} Hz : {(bin.magnitude * 100).toFixed(0)}%
                            {bin.isFolded ? " (FOLDED ALIAS)" : ""}
                          </div>

                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={cn(
                              "w-full rounded-t-sm transition-all duration-150",
                              bin.isFolded
                                ? "bg-gradient-to-t from-rose-600 to-rose-400 animate-pulse"
                                : bin.band === "low"
                                  ? "bg-gradient-to-t from-amber-600 to-amber-400"
                                  : bin.band === "mid"
                                    ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                                    : "bg-gradient-to-t from-cyan-600 to-cyan-400",
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Frequency axis labels */}
                  <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1 font-mono text-[10px] text-muted-foreground">
                    <span>0 Hz</span>
                    <span>{(aliasingData.nyquistLimit / 2).toFixed(1)} Hz</span>
                    <span className="font-bold text-primary">
                      {aliasingData.nyquistLimit.toFixed(1)} Hz (Nyquist)
                    </span>
                  </div>
                </div>

                {/* Aliasing Folding Summary */}
                <div className="mt-3 space-y-1.5">
                  <p className="font-mono text-[11px] font-bold text-muted-foreground uppercase">
                    Dominant Harmonics & Spectral Folding:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {aliasingData.foldedFrequencies.map((f, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-1.5 font-mono text-[10px]",
                          f.isFolded
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                        )}
                      >
                        <span>Orig: {f.originalHz} Hz</span>
                        <span>{f.isFolded ? `↳ Folded: ${f.aliasedHz} Hz` : "✓ Preserved"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Guidance & Lock Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
              <ChefFourier
                size="sm"
                float={false}
                message={
                  aliasingData.isAdequate
                    ? "Magnifique! The waveform is smooth and no harmonics are folded. Lock this rate and verify it!"
                    : "Notice the false low-frequency ripples and folded red peaks! Drag the slider higher to overcome the Nyquist barrier."
                }
              />

              <GameButton
                size="lg"
                disabled={!aliasingData.isAdequate}
                onClick={handleLockSamplingRate}
                className={cn(
                  "font-mono font-bold uppercase",
                  aliasingData.isAdequate
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] cursor-pointer"
                    : "opacity-50 cursor-not-allowed",
                )}
              >
                LOCK SAMPLING RATE ({samplingRate} Hz) →
              </GameButton>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: PASSWORD / UNLOCK STEP */}
        {/* ========================================================================= */}
        {currentStage === "unlock" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <p className="font-mono text-xs font-bold tracking-wider text-primary uppercase">
                Stage 02 • Verification Terminal
              </p>
              <h2 className="font-display text-2xl font-bold uppercase text-foreground">
                Unlock the Frequency Domain
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter the minimum safe sampling frequency ($f_s$) that you discovered avoids
                aliasing.
              </p>
            </div>

            <div className="mx-auto max-w-xl">
              <div className="kitchen-card border-2 border-primary/40 bg-card p-6 shadow-xl sm:p-8">
                <div className="flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-primary bg-primary/10 text-primary shadow-inner">
                    <KeyRound className="h-8 w-8 animate-bounce" />
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <h3 className="font-display text-xl font-extrabold uppercase text-foreground">
                    Oven Sampling Keypad
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter discovered sampling rate in Hz (must satisfy fs &ge; 2 &middot; fmax):
                  </p>
                </div>

                <form onSubmit={handleVerifyPassword} className="mt-6 space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={MAX_OVEN_FS}
                      value={enteredFsInput}
                      onChange={(e) => {
                        setEnteredFsInput(e.target.value);
                        setPasswordStatus("idle");
                      }}
                      placeholder="e.g. 24"
                      className="w-40 rounded-xl border-2 border-primary/50 bg-black/60 px-4 py-3 text-center font-mono text-2xl font-extrabold text-foreground tracking-wider focus:border-primary focus:outline-none"
                    />
                    <span className="font-mono text-lg font-bold text-muted-foreground">Hz</span>
                  </div>

                  {passwordStatus !== "idle" && (
                    <div
                      className={cn(
                        "rounded-xl border p-3 font-mono text-xs transition-all",
                        passwordStatus === "success"
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-500/50 bg-rose-500/10 text-rose-300",
                      )}
                    >
                      {passwordFeedback}
                    </div>
                  )}

                  <div className="flex justify-center gap-3 pt-2">
                    <GameButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentStage("sampling")}
                      className="font-mono text-xs uppercase"
                    >
                      ← Back to Sampling Slider
                    </GameButton>

                    {passwordStatus === "success" ? (
                      <GameButton
                        type="button"
                        size="sm"
                        onClick={() => setCurrentStage("fft-lab")}
                        className="bg-emerald-600 hover:bg-emerald-500 font-mono text-xs uppercase text-white shadow-lg cursor-pointer"
                      >
                        Enter Frequency Lab 🔓 →
                      </GameButton>
                    ) : (
                      <GameButton
                        type="submit"
                        size="sm"
                        className="font-mono text-xs uppercase bg-primary text-primary-foreground shadow-md cursor-pointer"
                      >
                        Verify Key ⚡
                      </GameButton>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: FFT FREQUENCY LAB (Target vs Your Signal) */}
        {/* ========================================================================= */}
        {currentStage === "fft-lab" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold tracking-wider text-primary uppercase">
                  Stage 03 • Frequency-Domain Laboratory (fs = {activeRate} Hz)
                </p>
                <h2 className="font-display text-2xl font-bold uppercase text-foreground">
                  Match the Target Dish Spectrum
                </h2>
                <p className="text-sm text-muted-foreground">
                  Each band slider operates strictly on its assigned frequency range. Hover or
                  adjust to see the live highlighting!
                </p>
              </div>

              {/* Spectrum Similarity Gauge */}
              <div className="flex items-center gap-3 rounded-2xl border-2 border-primary/50 bg-primary/10 px-5 py-2.5 shadow-sm">
                <div>
                  <p className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                    Spectral Match
                  </p>
                  <p className="font-mono text-2xl font-extrabold text-primary">
                    {spectrumMatchPercent}%
                  </p>
                </div>
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              </div>
            </div>

            {/* DUAL SPECTRA DISPLAY: Target vs Your Signal */}
            {/* DUAL SPECTRA DISPLAY: Target vs Your Signal */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* TARGET SPECTRUM */}
              <div className="kitchen-card border-2 border-amber-500/40 bg-card p-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <h3 className="font-display text-base font-bold uppercase text-foreground">
                      Target Recipe Spectrum
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-amber-400 font-bold">
                    Ideal Benchmark (Fixed)
                  </span>
                </div>

                {/* Band Range Ribbon Header */}
                <div className="relative mt-4 flex h-6 w-full items-center overflow-hidden rounded-lg border border-border/50 bg-black/40 font-mono text-[9px] font-bold">
                  {/* Base Band */}
                  <div
                    onClick={() => setActiveBandHover(activeBandHover === "low" ? null : "low")}
                    style={{ width: `${Math.min(100, (6 / targetFFT.nyquistLimit) * 100)}%` }}
                    className={cn(
                      "flex h-full items-center justify-center border-r border-amber-500/30 px-1 text-center transition-all cursor-pointer",
                      activeBandHover === "low"
                        ? "bg-amber-500/30 text-amber-300 font-extrabold shadow-inner"
                        : "bg-amber-500/10 text-amber-400/80 hover:bg-amber-500/20",
                    )}
                  >
                    <span className="truncate">BASE (0–6 Hz)</span>
                  </div>

                  {/* Crumb Band */}
                  {targetFFT.nyquistLimit > 6 && (
                    <div
                      onClick={() => setActiveBandHover(activeBandHover === "mid" ? null : "mid")}
                      style={{
                        width: `${Math.max(0, ((Math.min(16, targetFFT.nyquistLimit) - 6) / targetFFT.nyquistLimit) * 100)}%`,
                      }}
                      className={cn(
                        "flex h-full items-center justify-center border-r border-emerald-500/30 px-1 text-center transition-all cursor-pointer",
                        activeBandHover === "mid"
                          ? "bg-emerald-500/30 text-emerald-300 font-extrabold shadow-inner"
                          : "bg-emerald-500/10 text-emerald-400/80 hover:bg-emerald-500/20",
                      )}
                    >
                      <span className="truncate">CRUMB (6–16 Hz)</span>
                    </div>
                  )}

                  {/* Top Band */}
                  {targetFFT.nyquistLimit > 16 && (
                    <div
                      onClick={() => setActiveBandHover(activeBandHover === "high" ? null : "high")}
                      style={{
                        width: `${Math.max(0, ((Math.min(32, targetFFT.nyquistLimit) - 16) / targetFFT.nyquistLimit) * 100)}%`,
                      }}
                      className={cn(
                        "flex h-full items-center justify-center px-1 text-center transition-all cursor-pointer",
                        activeBandHover === "high"
                          ? "bg-cyan-500/30 text-cyan-300 font-extrabold shadow-inner"
                          : "bg-cyan-500/10 text-cyan-400/80 hover:bg-cyan-500/20",
                      )}
                    >
                      <span className="truncate">
                        TOP (16–{Math.min(32, targetFFT.nyquistLimit).toFixed(0)} Hz)
                      </span>
                    </div>
                  )}

                  {/* High Range (>32 Hz if Nyquist allows) */}
                  {targetFFT.nyquistLimit > 32 && (
                    <div
                      style={{
                        width: `${((targetFFT.nyquistLimit - 32) / targetFFT.nyquistLimit) * 100}%`,
                      }}
                      className="flex h-full items-center justify-center border-l border-border/30 bg-muted/20 px-1 text-center text-muted-foreground/60"
                    >
                      <span className="truncate">&gt;32 Hz</span>
                    </div>
                  )}
                </div>

                {/* Spectrum Chart with Visual Band Regions */}
                <div className="relative mt-2 flex flex-col justify-end overflow-hidden rounded-xl border border-border/80 bg-black/60 p-3">
                  <div className="relative h-40 w-full">
                    {/* Background Band Regions */}
                    <div className="pointer-events-none absolute inset-0 flex">
                      {/* Base Region: 0 - 6 Hz */}
                      <div
                        style={{
                          width: `${Math.min(100, (6 / targetFFT.nyquistLimit) * 100)}%`,
                        }}
                        className={cn(
                          "h-full border-r-2 border-dashed transition-all",
                          activeBandHover === "low"
                            ? "bg-amber-500/25 border-amber-400 ring-1 ring-amber-400/50"
                            : "bg-amber-500/5 border-amber-500/30",
                        )}
                      />

                      {/* Crumb Region: 6 - 16 Hz */}
                      {targetFFT.nyquistLimit > 6 && (
                        <div
                          style={{
                            width: `${Math.max(0, ((Math.min(16, targetFFT.nyquistLimit) - 6) / targetFFT.nyquistLimit) * 100)}%`,
                          }}
                          className={cn(
                            "h-full border-r-2 border-dashed transition-all",
                            activeBandHover === "mid"
                              ? "bg-emerald-500/25 border-emerald-400 ring-1 ring-emerald-400/50"
                              : "bg-emerald-500/5 border-emerald-500/30",
                          )}
                        />
                      )}

                      {/* Top Crisp Region: 16 - 32 Hz */}
                      {targetFFT.nyquistLimit > 16 && (
                        <div
                          style={{
                            width: `${Math.max(0, ((Math.min(32, targetFFT.nyquistLimit) - 16) / targetFFT.nyquistLimit) * 100)}%`,
                          }}
                          className={cn(
                            "h-full transition-all",
                            targetFFT.nyquistLimit > 32
                              ? "border-r-2 border-dashed border-cyan-500/30"
                              : "",
                            activeBandHover === "high"
                              ? "bg-cyan-500/25 ring-1 ring-cyan-400/50"
                              : "bg-cyan-500/5",
                          )}
                        />
                      )}
                    </div>

                    {/* Spectrum Bars */}
                    <div className="relative z-10 flex h-full items-end gap-1">
                      {targetFFT.bins.map((bin, i) => {
                        const h = Math.min(100, Math.max(4, Math.round(bin.magnitude * 100)));
                        const isHovered =
                          (activeBandHover === "low" && bin.band === "low") ||
                          (activeBandHover === "mid" && bin.band === "mid") ||
                          (activeBandHover === "high" && bin.band === "high");
                        const isAnyHovered = activeBandHover !== null;
                        const opacityClass =
                          isAnyHovered && !isHovered ? "opacity-35" : "opacity-100";

                        return (
                          <div
                            key={i}
                            className="group relative flex h-full flex-1 flex-col justify-end items-center"
                          >
                            {/* Tooltip */}
                            <div className="pointer-events-none absolute -top-8 z-30 hidden rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-foreground shadow-md group-hover:block whitespace-nowrap">
                              {bin.frequency} Hz : {(bin.magnitude * 100).toFixed(0)}% (
                              {bin.band.toUpperCase()})
                            </div>

                            <div
                              style={{ height: `${h}%` }}
                              className={cn(
                                "w-full rounded-t-sm transition-all duration-150",
                                opacityClass,
                                bin.band === "low"
                                  ? isHovered
                                    ? "bg-amber-300 ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                                    : "bg-gradient-to-t from-amber-600 to-amber-400"
                                  : bin.band === "mid"
                                    ? isHovered
                                      ? "bg-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                                      : "bg-gradient-to-t from-emerald-600 to-emerald-400"
                                    : isHovered
                                      ? "bg-cyan-300 ring-2 ring-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                                      : "bg-gradient-to-t from-cyan-600 to-cyan-400",
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Frequency Axis Readout with Exact Physical Ticks */}
                  <div className="relative z-10 mt-2 h-6 w-full border-t border-border/50 font-mono text-[10px]">
                    {/* 0 Hz */}
                    <div className="absolute left-0 top-0 flex flex-col items-start pt-1">
                      <span className="text-muted-foreground">0 Hz</span>
                    </div>

                    {/* 6 Hz */}
                    {targetFFT.nyquistLimit > 6 && (
                      <div
                        style={{ left: `${(6 / targetFFT.nyquistLimit) * 100}%` }}
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center pt-1"
                      >
                        <div className="h-1.5 w-0.5 bg-amber-400/80 -mt-1 mb-0.5" />
                        <span
                          className={cn(
                            "font-bold transition-colors",
                            activeBandHover === "low" || activeBandHover === "mid"
                              ? "text-amber-300"
                              : "text-amber-400/80",
                          )}
                        >
                          6 Hz
                        </span>
                      </div>
                    )}

                    {/* 16 Hz */}
                    {targetFFT.nyquistLimit > 16 && (
                      <div
                        style={{ left: `${(16 / targetFFT.nyquistLimit) * 100}%` }}
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center pt-1"
                      >
                        <div className="h-1.5 w-0.5 bg-emerald-400/80 -mt-1 mb-0.5" />
                        <span
                          className={cn(
                            "font-bold transition-colors",
                            activeBandHover === "mid" || activeBandHover === "high"
                              ? "text-emerald-300"
                              : "text-emerald-400/80",
                          )}
                        >
                          16 Hz
                        </span>
                      </div>
                    )}

                    {/* 32 Hz */}
                    {targetFFT.nyquistLimit > 32 && (
                      <div
                        style={{ left: `${(32 / targetFFT.nyquistLimit) * 100}%` }}
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center pt-1"
                      >
                        <div className="h-1.5 w-0.5 bg-cyan-400/80 -mt-1 mb-0.5" />
                        <span
                          className={cn(
                            "font-bold transition-colors",
                            activeBandHover === "high" ? "text-cyan-300" : "text-cyan-400/80",
                          )}
                        >
                          32 Hz
                        </span>
                      </div>
                    )}

                    {/* Nyquist Limit */}
                    <div className="absolute right-0 top-0 flex flex-col items-end pt-1">
                      <span className="font-bold text-amber-400">
                        {targetFFT.nyquistLimit.toFixed(1)} Hz (Nyquist)
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  The ideal mathematical target components across the {targetFFT.bins.length} bins.
                </p>
              </div>

              {/* YOUR TUNED SPECTRUM */}
              <div className="kitchen-card border-2 border-cyan-500/40 bg-card p-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-cyan-400" />
                    <h3 className="font-display text-base font-bold uppercase text-foreground">
                      Your Signal Spectrum ($X'[k] = H[k] \cdot X[k]$)
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-cyan-400 font-bold">
                    Live Equalized (fs = {activeRate} Hz)
                  </span>
                </div>

                {/* Band Range Ribbon Header */}
                <div className="relative mt-4 flex h-6 w-full items-center overflow-hidden rounded-lg border border-border/50 bg-black/40 font-mono text-[9px] font-bold">
                  {/* Base Band */}
                  <div
                    onClick={() => setActiveBandHover(activeBandHover === "low" ? null : "low")}
                    style={{ width: `${Math.min(100, (6 / (activeRate / 2)) * 100)}%` }}
                    className={cn(
                      "flex h-full items-center justify-center border-r border-amber-500/30 px-1 text-center transition-all cursor-pointer",
                      activeBandHover === "low"
                        ? "bg-amber-500/30 text-amber-300 font-extrabold shadow-inner"
                        : "bg-amber-500/10 text-amber-400/80 hover:bg-amber-500/20",
                    )}
                  >
                    <span className="truncate">BASE (0–6 Hz)</span>
                  </div>

                  {/* Crumb Band */}
                  {activeRate / 2 > 6 && (
                    <div
                      onClick={() => setActiveBandHover(activeBandHover === "mid" ? null : "mid")}
                      style={{
                        width: `${Math.max(0, ((Math.min(16, activeRate / 2) - 6) / (activeRate / 2)) * 100)}%`,
                      }}
                      className={cn(
                        "flex h-full items-center justify-center border-r border-emerald-500/30 px-1 text-center transition-all cursor-pointer",
                        activeBandHover === "mid"
                          ? "bg-emerald-500/30 text-emerald-300 font-extrabold shadow-inner"
                          : "bg-emerald-500/10 text-emerald-400/80 hover:bg-emerald-500/20",
                      )}
                    >
                      <span className="truncate">CRUMB (6–16 Hz)</span>
                    </div>
                  )}

                  {/* Top Band */}
                  {activeRate / 2 > 16 && (
                    <div
                      onClick={() => setActiveBandHover(activeBandHover === "high" ? null : "high")}
                      style={{
                        width: `${Math.max(0, ((Math.min(32, activeRate / 2) - 16) / (activeRate / 2)) * 100)}%`,
                      }}
                      className={cn(
                        "flex h-full items-center justify-center px-1 text-center transition-all cursor-pointer",
                        activeBandHover === "high"
                          ? "bg-cyan-500/30 text-cyan-300 font-extrabold shadow-inner"
                          : "bg-cyan-500/10 text-cyan-400/80 hover:bg-cyan-500/20",
                      )}
                    >
                      <span className="truncate">
                        TOP (16–{Math.min(32, activeRate / 2).toFixed(0)} Hz)
                      </span>
                    </div>
                  )}

                  {/* High Range (>32 Hz if Nyquist allows) */}
                  {activeRate / 2 > 32 && (
                    <div
                      style={{
                        width: `${((activeRate / 2 - 32) / (activeRate / 2)) * 100}%`,
                      }}
                      className="flex h-full items-center justify-center border-l border-border/30 bg-muted/20 px-1 text-center text-muted-foreground/60"
                    >
                      <span className="truncate">&gt;32 Hz</span>
                    </div>
                  )}
                </div>

                {/* Spectrum Chart with Visual Band Regions */}
                <div className="relative mt-2 flex flex-col justify-end overflow-hidden rounded-xl border border-border/80 bg-black/60 p-3">
                  <div className="relative h-40 w-full">
                    {/* Background Band Regions */}
                    <div className="pointer-events-none absolute inset-0 flex">
                      {/* Base Region */}
                      <div
                        style={{
                          width: `${Math.min(100, (6 / (activeRate / 2)) * 100)}%`,
                        }}
                        className={cn(
                          "h-full border-r-2 border-dashed transition-all",
                          activeBandHover === "low"
                            ? "bg-amber-500/25 border-amber-400 ring-1 ring-amber-400/50"
                            : "bg-amber-500/5 border-amber-500/30",
                        )}
                      />

                      {/* Crumb Region */}
                      {activeRate / 2 > 6 && (
                        <div
                          style={{
                            width: `${Math.max(0, ((Math.min(16, activeRate / 2) - 6) / (activeRate / 2)) * 100)}%`,
                          }}
                          className={cn(
                            "h-full border-r-2 border-dashed transition-all",
                            activeBandHover === "mid"
                              ? "bg-emerald-500/25 border-emerald-400 ring-1 ring-emerald-400/50"
                              : "bg-emerald-500/5 border-emerald-500/30",
                          )}
                        />
                      )}

                      {/* Top Crisp Region */}
                      {activeRate / 2 > 16 && (
                        <div
                          style={{
                            width: `${Math.max(0, ((Math.min(32, activeRate / 2) - 16) / (activeRate / 2)) * 100)}%`,
                          }}
                          className={cn(
                            "h-full transition-all",
                            activeRate / 2 > 32
                              ? "border-r-2 border-dashed border-cyan-500/30"
                              : "",
                            activeBandHover === "high"
                              ? "bg-cyan-500/25 ring-1 ring-cyan-400/50"
                              : "bg-cyan-500/5",
                          )}
                        />
                      )}
                    </div>

                    {/* Browning Cutoff Vertical Line Indicator */}
                    {browningCutoffHz < activeRate / 2 && (
                      <div
                        style={{
                          left: `${(browningCutoffHz / (activeRate / 2)) * 100}%`,
                        }}
                        className={cn(
                          "pointer-events-none absolute inset-y-0 z-20 w-0 border-l-2 border-dashed transition-all",
                          activeBandHover === "cutoff"
                            ? "border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                            : "border-red-500/60",
                        )}
                      >
                        <span className="absolute -top-1 -translate-x-1/2 rounded bg-red-950/90 px-1 py-0.5 font-mono text-[8px] text-red-300 border border-red-500/40 whitespace-nowrap shadow-sm">
                          Cutoff {browningCutoffHz} Hz
                        </span>
                      </div>
                    )}

                    {/* Charred Notch Indicator */}
                    {notchActive && notchHz <= activeRate / 2 && (
                      <div
                        style={{
                          left: `${(notchHz / (activeRate / 2)) * 100}%`,
                        }}
                        className={cn(
                          "pointer-events-none absolute inset-y-0 z-20 w-0 border-l-2 border-purple-400 transition-all",
                          activeBandHover === "notch"
                            ? "shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                            : "",
                        )}
                      >
                        <span className="absolute -top-1 -translate-x-1/2 rounded bg-purple-950/90 px-1 py-0.5 font-mono text-[8px] text-purple-300 border border-purple-500/40 whitespace-nowrap shadow-sm">
                          Notch {notchHz} Hz
                        </span>
                      </div>
                    )}

                    {/* Spectrum Bars */}
                    <div className="relative z-10 flex h-full items-end gap-1">
                      {tunedSpectrum.tunedBins.map((bin, i) => {
                        const h = Math.min(100, Math.max(4, Math.round(bin.magnitude * 100)));
                        const isHovered =
                          (activeBandHover === "low" && bin.band === "low") ||
                          (activeBandHover === "mid" && bin.band === "mid") ||
                          (activeBandHover === "high" && bin.band === "high") ||
                          (activeBandHover === "cutoff" && bin.frequency > browningCutoffHz) ||
                          (activeBandHover === "notch" &&
                            notchActive &&
                            Math.abs(bin.frequency - notchHz) <= 3);
                        const isAnyHovered = activeBandHover !== null;
                        const opacityClass =
                          isAnyHovered && !isHovered ? "opacity-35" : "opacity-100";

                        return (
                          <div
                            key={i}
                            className="group relative flex h-full flex-1 flex-col justify-end items-center"
                          >
                            {/* Tooltip */}
                            <div className="pointer-events-none absolute -top-8 z-30 hidden rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-foreground shadow-md group-hover:block whitespace-nowrap">
                              {bin.frequency} Hz : {(bin.magnitude * 100).toFixed(0)}% (
                              {bin.band.toUpperCase()})
                            </div>

                            <div
                              style={{ height: `${h}%` }}
                              className={cn(
                                "w-full rounded-t-sm transition-all duration-100",
                                opacityClass,
                                bin.band === "low"
                                  ? isHovered
                                    ? "bg-amber-300 ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                                    : "bg-gradient-to-t from-amber-600 to-amber-400"
                                  : bin.band === "mid"
                                    ? isHovered
                                      ? "bg-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                                      : "bg-gradient-to-t from-emerald-600 to-emerald-400"
                                    : bin.band === "high"
                                      ? isHovered
                                        ? "bg-cyan-300 ring-2 ring-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                                        : "bg-gradient-to-t from-cyan-600 to-cyan-400"
                                      : "bg-muted-foreground/30",
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Frequency Axis Readout with Exact Physical Ticks */}
                  <div className="relative z-10 mt-2 h-6 w-full border-t border-border/50 font-mono text-[10px]">
                    {/* 0 Hz */}
                    <div className="absolute left-0 top-0 flex flex-col items-start pt-1">
                      <span className="text-muted-foreground">0 Hz</span>
                    </div>

                    {/* 6 Hz */}
                    {activeRate / 2 > 6 && (
                      <div
                        style={{ left: `${(6 / (activeRate / 2)) * 100}%` }}
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center pt-1"
                      >
                        <div className="h-1.5 w-0.5 bg-amber-400/80 -mt-1 mb-0.5" />
                        <span
                          className={cn(
                            "font-bold transition-colors",
                            activeBandHover === "low" || activeBandHover === "mid"
                              ? "text-amber-300"
                              : "text-amber-400/80",
                          )}
                        >
                          6 Hz
                        </span>
                      </div>
                    )}

                    {/* 16 Hz */}
                    {activeRate / 2 > 16 && (
                      <div
                        style={{ left: `${(16 / (activeRate / 2)) * 100}%` }}
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center pt-1"
                      >
                        <div className="h-1.5 w-0.5 bg-emerald-400/80 -mt-1 mb-0.5" />
                        <span
                          className={cn(
                            "font-bold transition-colors",
                            activeBandHover === "mid" || activeBandHover === "high"
                              ? "text-emerald-300"
                              : "text-emerald-400/80",
                          )}
                        >
                          16 Hz
                        </span>
                      </div>
                    )}

                    {/* 32 Hz */}
                    {activeRate / 2 > 32 && (
                      <div
                        style={{ left: `${(32 / (activeRate / 2)) * 100}%` }}
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center pt-1"
                      >
                        <div className="h-1.5 w-0.5 bg-cyan-400/80 -mt-1 mb-0.5" />
                        <span
                          className={cn(
                            "font-bold transition-colors",
                            activeBandHover === "high" ? "text-cyan-300" : "text-cyan-400/80",
                          )}
                        >
                          32 Hz
                        </span>
                      </div>
                    )}

                    {/* Nyquist Limit */}
                    <div className="absolute right-0 top-0 flex flex-col items-end pt-1">
                      <span className="font-bold text-cyan-400">
                        {(activeRate / 2).toFixed(1)} Hz (Nyquist)
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  Bars update in real-time. Notice how each control isolates ONLY its specific band!
                </p>
              </div>
            </div>

            {/* BAND ENERGY & HARMONIC COMPARISON TABLE */}
            <div className="kitchen-card border-2 border-border/80 bg-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-bold uppercase text-foreground">
                    Frequency Band Energy Balance &amp; Target Matching
                  </h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  Compare Live Dish vs Target Recipe Energy across physical bands
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                      <th className="pb-2 font-semibold">Frequency Band</th>
                      <th className="pb-2 font-semibold">Physical Range</th>
                      <th className="pb-2 font-semibold">Target Energy</th>
                      <th className="pb-2 font-semibold">Live Dish Energy</th>
                      <th className="pb-2 font-semibold">Band Match</th>
                      <th className="pb-2 font-semibold">Guidance &amp; Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {bandMetrics.map((m) => {
                      const isHovered =
                        (m.band === "low" && activeBandHover === "low") ||
                        (m.band === "mid" && activeBandHover === "mid") ||
                        (m.band === "high" && activeBandHover === "high");

                      return (
                        <tr
                          key={m.band}
                          onMouseEnter={() => setActiveBandHover(m.band)}
                          onMouseLeave={() => setActiveBandHover(null)}
                          className={cn(
                            "transition-colors cursor-pointer",
                            isHovered ? "bg-primary/10" : "hover:bg-secondary/40",
                          )}
                        >
                          <td className="py-2.5 font-bold">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-2.5 w-2.5 rounded-full",
                                  m.band === "low"
                                    ? "bg-amber-400"
                                    : m.band === "mid"
                                      ? "bg-emerald-400"
                                      : "bg-cyan-400",
                                )}
                              />
                              <span className="text-foreground">{m.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {m.rangeLabel}
                            <span className="text-[10px] text-muted-foreground/70 block">
                              {m.binCount > 0
                                ? `${m.binCount} FFT bins`
                                : "0 bins (Nyquist limited)"}
                            </span>
                          </td>
                          <td className="py-2.5 font-bold text-foreground">{m.targetEnergy}%</td>
                          <td className="py-2.5 font-bold">
                            <span
                              className={cn(
                                m.status === "match"
                                  ? "text-emerald-400"
                                  : m.status === "needs-boost"
                                    ? "text-amber-400"
                                    : m.status === "needs-cut"
                                      ? "text-rose-400"
                                      : "text-muted-foreground",
                              )}
                            >
                              {m.liveEnergy}%
                            </span>
                            <span className="text-[10px] text-muted-foreground block font-normal">
                              ratio: {m.ratio.toFixed(2)}×
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 font-bold text-[11px]",
                                m.status === "unavailable"
                                  ? "bg-muted text-muted-foreground"
                                  : m.matchPercent >= 90
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : m.matchPercent >= 70
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40",
                              )}
                            >
                              {m.status === "unavailable" ? "N/A" : `${m.matchPercent}%`}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span
                              className={cn(
                                "font-bold text-[11px]",
                                m.status === "match"
                                  ? "text-emerald-400"
                                  : m.status === "needs-boost"
                                    ? "text-amber-400"
                                    : m.status === "needs-cut"
                                      ? "text-rose-400"
                                      : "text-muted-foreground",
                              )}
                            >
                              {m.recommendation}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FREQUENCY-DOMAIN CONTROLS: H[k] */}
            <div className="kitchen-card border-2 border-border bg-card p-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-display text-lg font-bold uppercase text-foreground">
                      Thermal Frequency Equalizer ($H[k]$)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Each slider applies gain strictly within its frequency bounds.
                    </p>
                  </div>
                </div>
                <GameButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setLowGain(1.0);
                    setMidGain(1.0);
                    setHighGain(1.0);
                    setBrowningCutoffHz(Math.min(26, Math.round(activeRate / 2)));
                    setNotchActive(false);
                  }}
                  className="font-mono text-xs uppercase"
                >
                  Reset Defaults
                </GameButton>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Base Warmth */}
                <div
                  onMouseEnter={() => setActiveBandHover("low")}
                  onMouseLeave={() => setActiveBandHover(null)}
                  className={cn(
                    "space-y-2 rounded-xl border p-4 transition-all duration-150",
                    activeBandHover === "low"
                      ? "border-amber-400/80 bg-amber-500/10 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50"
                      : "border-border/60 bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-foreground">Base Warmth (0–6 Hz)</span>
                    <span className="text-primary font-bold">{lowGain.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2.5}
                    step={0.05}
                    value={lowGain}
                    onFocus={() => setActiveBandHover("low")}
                    onBlur={() => setActiveBandHover(null)}
                    onChange={(e) => setLowGain(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer accent-amber-500"
                  />
                  {/* Energy & Match Diagnostic */}
                  <div className="flex items-center justify-between rounded bg-black/40 px-2 py-1 font-mono text-[10px] border border-border/40">
                    <span className="text-muted-foreground">
                      Tgt:{" "}
                      <strong className="text-foreground">{bandMetrics[0]?.targetEnergy}%</strong> |
                      Live:{" "}
                      <strong className="text-amber-400">{bandMetrics[0]?.liveEnergy}%</strong>
                    </span>
                    <span
                      className={cn(
                        "font-bold",
                        bandMetrics[0]?.status === "match" ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {bandMetrics[0]?.status === "match"
                        ? "✓ Balanced"
                        : bandMetrics[0]?.status === "needs-boost"
                          ? "Boost ↑"
                          : "Cut ↓"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span className="text-emerald-400 font-bold">● ACTIVE (0–6 Hz)</span>
                    <span>{bandAvailability.base.binCount} bins</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Modifies bins 0 &le; f &lt; 6 Hz (crust depth &amp; fundamental)
                  </p>
                </div>

                {/* 2. Crumb Texture */}
                <div
                  onMouseEnter={() => setActiveBandHover("mid")}
                  onMouseLeave={() => setActiveBandHover(null)}
                  className={cn(
                    "space-y-2 rounded-xl border p-4 transition-all duration-150",
                    activeBandHover === "mid"
                      ? "border-emerald-400/80 bg-emerald-500/10 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/50"
                      : "border-border/60 bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-foreground">Crumb Body (6–16 Hz)</span>
                    <span className="text-primary font-bold">{midGain.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2.5}
                    step={0.05}
                    value={midGain}
                    onFocus={() => setActiveBandHover("mid")}
                    onBlur={() => setActiveBandHover(null)}
                    onChange={(e) => setMidGain(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer accent-emerald-500"
                  />
                  {/* Energy & Match Diagnostic */}
                  <div className="flex items-center justify-between rounded bg-black/40 px-2 py-1 font-mono text-[10px] border border-border/40">
                    <span className="text-muted-foreground">
                      Tgt:{" "}
                      <strong className="text-foreground">{bandMetrics[1]?.targetEnergy}%</strong> |
                      Live:{" "}
                      <strong className="text-emerald-400">{bandMetrics[1]?.liveEnergy}%</strong>
                    </span>
                    <span
                      className={cn(
                        "font-bold",
                        bandMetrics[1]?.status === "match"
                          ? "text-emerald-400"
                          : "text-emerald-300",
                      )}
                    >
                      {bandMetrics[1]?.status === "match"
                        ? "✓ Balanced"
                        : bandMetrics[1]?.status === "needs-boost"
                          ? "Boost ↑"
                          : "Cut ↓"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span
                      className={
                        bandAvailability.crumb.status === "active"
                          ? "text-emerald-400 font-bold"
                          : "text-amber-400 font-bold"
                      }
                    >
                      {bandAvailability.crumb.status === "active"
                        ? "● ACTIVE (6–16 Hz)"
                        : `◐ PARTIAL (6–${bandAvailability.nyquistLimit.toFixed(1)} Hz)`}
                    </span>
                    <span>{bandAvailability.crumb.binCount} bins</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Modifies bins 6 &le; f &lt; 16 Hz (crumb texture harmonics)
                  </p>
                </div>

                {/* 3. Top Crisp */}
                <div
                  onMouseEnter={() => setActiveBandHover("high")}
                  onMouseLeave={() => setActiveBandHover(null)}
                  className={cn(
                    "space-y-2 rounded-xl border p-4 transition-all duration-150",
                    bandAvailability.top.status === "unavailable"
                      ? "border-border/40 bg-muted/20 opacity-60"
                      : activeBandHover === "high"
                        ? "border-cyan-400/80 bg-cyan-500/10 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/50"
                        : "border-border/60 bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-foreground">Top Crisp (16–32 Hz)</span>
                    <span className="text-primary font-bold">
                      {bandAvailability.top.status === "unavailable"
                        ? "OFF"
                        : `${highGain.toFixed(2)}×`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2.5}
                    step={0.05}
                    value={highGain}
                    disabled={bandAvailability.top.status === "unavailable"}
                    onFocus={() => setActiveBandHover("high")}
                    onBlur={() => setActiveBandHover(null)}
                    onChange={(e) => setHighGain(parseFloat(e.target.value))}
                    className={cn(
                      "h-2 w-full accent-cyan-500",
                      bandAvailability.top.status === "unavailable"
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-pointer",
                    )}
                  />
                  {/* Energy & Match Diagnostic */}
                  <div className="flex items-center justify-between rounded bg-black/40 px-2 py-1 font-mono text-[10px] border border-border/40">
                    {bandAvailability.top.status === "unavailable" ? (
                      <span className="text-rose-400 font-bold text-[9px]">
                        Nyquist limit &le; 16 Hz (fs too low)
                      </span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">
                          Tgt:{" "}
                          <strong className="text-foreground">
                            {bandMetrics[2]?.targetEnergy}%
                          </strong>{" "}
                          | Live:{" "}
                          <strong className="text-cyan-400">{bandMetrics[2]?.liveEnergy}%</strong>
                        </span>
                        <span
                          className={cn(
                            "font-bold",
                            bandMetrics[2]?.status === "match"
                              ? "text-emerald-400"
                              : "text-cyan-400",
                          )}
                        >
                          {bandMetrics[2]?.status === "match"
                            ? "✓ Balanced"
                            : bandMetrics[2]?.status === "needs-boost"
                              ? "Boost ↑"
                              : "Cut ↓"}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span
                      className={cn(
                        "font-bold",
                        bandAvailability.top.status === "active"
                          ? "text-emerald-400"
                          : bandAvailability.top.status === "partial"
                            ? "text-amber-400"
                            : "text-rose-400",
                      )}
                    >
                      {bandAvailability.top.status === "active"
                        ? "● ACTIVE (16–32 Hz)"
                        : bandAvailability.top.status === "partial"
                          ? `◐ PARTIAL (16–${bandAvailability.nyquistLimit.toFixed(1)} Hz)`
                          : `✕ OUT OF RANGE (Nyquist ${bandAvailability.nyquistLimit.toFixed(1)} Hz)`}
                    </span>
                    <span>{bandAvailability.top.binCount} bins</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {bandAvailability.top.status === "unavailable"
                      ? `Unavailable at fs = ${activeRate} Hz. Nyquist limit (${bandAvailability.nyquistLimit.toFixed(1)} Hz) is below 16 Hz.`
                      : "Modifies bins 16 &le; f &le; 32 Hz (surface crisp sizzle)"}
                  </p>
                </div>

                {/* 4. Browning Cutoff */}
                <div
                  onMouseEnter={() => setActiveBandHover("cutoff")}
                  onMouseLeave={() => setActiveBandHover(null)}
                  className={cn(
                    "space-y-2 rounded-xl border p-4 transition-all duration-150",
                    activeBandHover === "cutoff"
                      ? "border-red-400/80 bg-red-500/10 shadow-md shadow-red-500/10 ring-1 ring-red-400/50"
                      : "border-border/60 bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-foreground">Browning Cutoff (f_cut)</span>
                    <span className="text-primary font-bold">{browningCutoffHz} Hz</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={Math.min(32, Math.max(10, Math.round(activeRate / 2)))}
                    step={1}
                    value={browningCutoffHz}
                    onFocus={() => setActiveBandHover("cutoff")}
                    onBlur={() => setActiveBandHover(null)}
                    onChange={(e) => setBrowningCutoffHz(parseInt(e.target.value, 10))}
                    className="h-2 w-full cursor-pointer accent-red-500"
                  />
                  {/* Energy & Match Diagnostic */}
                  <div className="flex items-center justify-between rounded bg-black/40 px-2 py-1 font-mono text-[10px] border border-border/40">
                    <span className="text-muted-foreground">Low-Pass Filter</span>
                    <span className="text-red-400 font-bold">Cuts &gt; {browningCutoffHz} Hz</span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span className="text-primary font-bold">● ROLL-OFF FILTER</span>
                    <span>Roll-off: &gt; {browningCutoffHz} Hz</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Separate low-pass filter attenuating burnt overtones above f_cut
                  </p>
                </div>
              </div>

              {/* Charred Notch Filter Option */}
              <div
                onMouseEnter={() => setActiveBandHover("notch")}
                onMouseLeave={() => setActiveBandHover(null)}
                className={cn(
                  "mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-150",
                  activeBandHover === "notch" || notchActive
                    ? "border-purple-400/70 bg-purple-500/10 shadow-md shadow-purple-500/10 ring-1 ring-purple-400/50"
                    : "border-border/60 bg-secondary/20",
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="notch-toggle"
                    checked={notchActive}
                    onChange={(e) => setNotchActive(e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-purple-500"
                  />
                  <label
                    htmlFor="notch-toggle"
                    className="cursor-pointer font-mono text-xs font-bold text-foreground"
                  >
                    Charred Resonant Notch Filter (Narrow harmonic rejection)
                  </label>
                </div>

                {notchActive && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      Notch Frequency:
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={Math.min(28, Math.max(12, Math.round(activeRate / 2)))}
                      step={1}
                      value={notchHz}
                      onChange={(e) => setNotchHz(parseInt(e.target.value, 10))}
                      className="h-2 w-36 cursor-pointer accent-purple-500"
                    />
                    <span className="font-mono text-xs font-bold text-purple-400">
                      {notchHz} Hz
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
              <ChefFourier
                size="sm"
                float={false}
                message={
                  spectrumMatchPercent >= 85
                    ? "Sublime balance! Your spectrum closely matches the target. Run the IFFT reconstruction to bake it into time domain!"
                    : "Adjust the warmth, crumb, or cutoff sliders until the spectral bars match the recipe benchmark."
                }
              />

              <GameButton
                size="lg"
                onClick={handleRunIFFT}
                className="bg-primary text-primary-foreground font-mono font-bold uppercase shadow-lg shadow-primary/25 hover:scale-[1.02] cursor-pointer"
              >
                RECONSTRUCT SIGNAL (RUN IFFT) ⚡ →
              </GameButton>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: IFFT RECONSTRUCTION & AUDIO PLAYBACK */}
        {/* ========================================================================= */}
        {currentStage === "ifft" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <p className="font-mono text-xs font-bold tracking-wider text-primary uppercase">
                Stage 04 • Inverse Fast Fourier Transform
              </p>
              <h2 className="font-display text-2xl font-bold uppercase text-foreground">
                Time-Domain Reconstruction & Audio
              </h2>
              <p className="text-sm text-muted-foreground">
                The tuned frequency spectrum has been synthesized back to time-domain samples via
                IFFT.
              </p>
            </div>

            {/* Reconstruction Oscilloscope with Live Playhead */}
            <div className="kitchen-card border-2 border-border bg-card p-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-bold uppercase text-foreground">
                    Target vs Reconstructed Dish Waveform
                  </h3>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-muted-foreground">Waveform Similarity:</span>
                  <span className="font-extrabold text-primary">{timeDomainSimilarity}%</span>
                </div>
              </div>

              <div className="relative mt-4 overflow-hidden rounded-xl border border-border/80 bg-black/60 p-2">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="h-56 w-full"
                  preserveAspectRatio="none"
                >
                  <line
                    x1="0"
                    y1={svgHeight / 2}
                    x2={svgWidth}
                    y2={svgHeight / 2}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    className="text-border/40"
                  />

                  {/* Target Waveform (Gold Dashed) */}
                  <path
                    d={samplesAlongCurvePath(
                      targetSignal.samples,
                      pipelineCooked,
                      svgWidth,
                      svgHeight,
                      0.4,
                    )}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    strokeOpacity="0.8"
                  />

                  {/* Reconstructed Waveform (Cyan Solid) */}
                  <path
                    d={samplesAlongCurvePath(
                      reconstructedSamples,
                      pipelineCooked,
                      svgWidth,
                      svgHeight,
                      0.4,
                    )}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                  />

                  {/* Playhead Cursor */}
                  {playbackState.isPlaying && (
                    <line
                      x1={playbackState.progress * svgWidth}
                      y1={0}
                      x2={playbackState.progress * svgWidth}
                      y2={svgHeight}
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeDasharray="2 2"
                    />
                  )}
                </svg>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-4 rounded-full bg-amber-500" />
                  <span>Target Waveform (Golden Goal)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-4 rounded-full bg-cyan-400" />
                  <span>IFFT Reconstructed Signal ({reconstructedSamples.length} points)</span>
                </div>
              </div>
            </div>

            {/* AUDIO PLAYBACK CARD */}
            <div className="kitchen-card border-2 border-primary/40 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-primary uppercase">
                    <Volume2 className="h-4 w-4" />
                    <span>Acoustic Signal Audition</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Web Audio synthesis playing the actual IFFT reconstructed samples at musical
                    pitch
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <GameButton
                    size="sm"
                    variant={playbackState.isPlaying ? "secondary" : "primary"}
                    onClick={handleTogglePlay}
                    className="font-mono text-xs uppercase cursor-pointer"
                  >
                    {playbackState.isPlaying ? (
                      <>
                        <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-1 h-3.5 w-3.5" /> Play Output
                      </>
                    )}
                  </GameButton>

                  <GameButton
                    size="sm"
                    variant="secondary"
                    onClick={handleReplay}
                    className="font-mono text-xs uppercase cursor-pointer"
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Replay
                  </GameButton>
                </div>
              </div>

              {/* Progress Scrub Bar */}
              <div className="mt-4 space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all duration-75"
                    style={{ width: `${playbackState.progress * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{playbackState.currentTime.toFixed(1)}s</span>
                  <span>Pitch: {Math.round(220 * ((cookedSignal.frequency || 4) / 4))} Hz</span>
                  <span>{playbackState.duration.toFixed(1)}s</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
              <GameButton
                variant="secondary"
                size="sm"
                onClick={() => setCurrentStage("fft-lab")}
                className="font-mono text-xs uppercase"
              >
                ← Back to FFT Lab
              </GameButton>

              <GameButton
                size="lg"
                onClick={() => setCurrentStage("plate")}
                className="bg-primary text-primary-foreground font-mono font-bold uppercase shadow-lg shadow-primary/20 hover:scale-[1.02] cursor-pointer"
              >
                PROCEED TO FINAL CHECK & PLATE →
              </GameButton>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 5: FINAL CHECK & PLATE */}
        {/* ========================================================================= */}
        {currentStage === "plate" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <p className="font-mono text-xs font-bold tracking-wider text-primary uppercase">
                Stage 05 • Plating & Quality Verification
              </p>
              <h2 className="font-display text-2xl font-bold uppercase text-foreground">
                Final Dish Evaluation
              </h2>
              <p className="text-sm text-muted-foreground">
                Review your precision signal metrics before sending the dish to the dining room.
              </p>
            </div>

            {/* Summary Metrics Grid */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="kitchen-card border-2 border-border bg-card p-5">
                <p className="font-mono text-xs font-bold text-muted-foreground uppercase">
                  Nyquist Sampling Verification
                </p>
                <div className="mt-2 flex items-center gap-2 text-emerald-400">
                  <ShieldCheck className="h-6 w-6" />
                  <span className="font-mono text-2xl font-extrabold">{activeRate} Hz</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  No aliasing (fs &ge; 2 &middot; fmax = {minSafeSamplingRate} Hz) · Efficiency{" "}
                  {samplingEfficiency}%
                </p>
              </div>

              <div className="kitchen-card border-2 border-border bg-card p-5">
                <p className="font-mono text-xs font-bold text-muted-foreground uppercase">
                  Spectrum Match
                </p>
                <p className="mt-2 font-mono text-2xl font-extrabold text-primary">
                  {spectrumMatchPercent}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Thermal harmonics equalized</p>
              </div>

              <div className="kitchen-card border-2 border-border bg-card p-5">
                <p className="font-mono text-xs font-bold text-muted-foreground uppercase">
                  Waveform Fidelity
                </p>
                <p className="mt-2 font-mono text-2xl font-extrabold text-cyan-400">
                  {timeDomainSimilarity}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Time-domain IFFT correlation</p>
              </div>
            </div>

            {/* Chef Fourier Final Assessment */}
            <div className="kitchen-card border-2 border-primary/50 bg-primary/10 p-6">
              <ChefFourier
                size="md"
                float={false}
                message={
                  overallScore >= 90
                    ? `Perfection! A Michelin-star signal score of ${overallScore}%. The frequencies and phase are crisp, and the crust harmonics are perfectly browned.`
                    : `Well done! A solid precision finish of ${overallScore}%. The culinary signal is ready for the dining room table.`
                }
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
              <GameButton
                variant="secondary"
                size="md"
                onClick={() => setCurrentStage("fft-lab")}
                className="font-mono text-xs uppercase"
              >
                ← Refine Oven Tuning
              </GameButton>

              <GameButton
                size="lg"
                onClick={handlePlateAndFinish}
                className="bg-primary text-primary-foreground font-mono font-extrabold tracking-wider uppercase text-base px-8 py-4 shadow-xl shadow-primary/30 hover:scale-[1.02] cursor-pointer"
              >
                PLATE & SERVE DISH 🍽️ →
              </GameButton>
            </div>
          </div>
        )}
      </div>
    </LabShell>
  );
}
