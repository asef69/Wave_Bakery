import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DragTutorialCue } from "@/components/game/DragTutorialCue";
import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph, type IngredientKind } from "@/components/game/IngredientGlyph";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";
import { SignalAudioPlayer } from "@/lib/audio";
import {
  loadChickenAudio,
  getCachedChickenAudio,
  getChickenStaticSamples,
  type DecodedChickenAudio,
} from "@/lib/chicken-audio";
import { applyLowPassFilter, computeSignalSimilarity, fft } from "@/lib/dsp";
import type { SessionItemOut } from "@/lib/api";
import {
  api,
  getRecipeIngredientSamples,
  getRecipeRunSession,
  recipes,
  recordStageAccuracy,
  saveFilteredIngredient,
  useActiveRecipe,
  useRecipeProgress,
  useSelectedIngredients,
  washFilterPreview,
} from "@/lib/recipes";
import { getMathematicalSignal, parametricPath } from "@/lib/signals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/filtering")({
  head: () => ({
    meta: [
      { title: "Filtering Lab — WaveBakery" },
      {
        name: "description",
        content:
          "Clean each washable ingredient in the WaveBakery filtering lab: inspect the spectrum, drag the cutoff and rebuild a clean signal.",
      },
      { property: "og:title", content: "Filtering Lab — WaveBakery" },
      {
        property: "og:description",
        content: "FFT → filter → IFFT, one noisy ingredient at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FilteringLab,
});

type QueueItem = {
  name: string;
  kind: IngredientKind;
  idealCutoff: number;
  seed: number;
  baseFreq: number;
};

const MIN_HZ = 0;
const MAX_HZ = 900;
const THRESHOLD = 85;

function wavePath(
  width: number,
  height: number,
  opts: { freq: number; seed: number; noise: number; amp: number },
) {
  const mid = height / 2;
  const pts: string[] = [];
  for (let x = 0; x <= width; x += 2) {
    const t = (x / width) * Math.PI * 2 * opts.freq + opts.seed;
    const n =
      opts.noise *
      height *
      0.17 *
      (Math.sin(x * 12.9898 + opts.seed * 78.233) + Math.sin(x * 4.1234 + opts.seed * 31.7) * 0.6);
    const y =
      mid -
      Math.sin(t) * opts.amp * height * 0.3 -
      Math.sin(t * 2.7) * opts.amp * height * 0.08 +
      n;
    pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function getParametricPointsWithNoise(
  basePoints: Array<{ x: number; y: number }>,
  noiseLevel: number,
  signalScale: number = 1.0,
  seed: number = 0,
): Array<{ x: number; y: number }> {
  if (!basePoints || basePoints.length === 0) return [];
  if (noiseLevel <= 0.001 && Math.abs(signalScale - 1.0) < 0.001) {
    return basePoints;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < basePoints.length; i++) {
    const p = basePoints[i]!;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const N = basePoints.length;

  return basePoints.map((p, i) => {
    const u = i / (N - 1);
    const n1 = Math.sin(u * Math.PI * 48 + (seed + 1) * 31.7);
    const n2 = Math.sin(u * Math.PI * 104 + (seed + 2) * 59.3) * 0.6;
    const n3 = Math.sin(u * Math.PI * 172 + (seed + 3) * 83.1) * 0.35;
    const n = (n1 + n2 + n3) / 1.95;

    const dx = n * spanX * 0.045 * noiseLevel;
    const dy = n * spanY * 0.045 * noiseLevel;

    const x = midX + (p.x - midX) * signalScale + dx;
    const y = midY + (p.y - midY) * signalScale + dy;

    return { x, y };
  });
}

function LabWave({
  label,
  sublabel,
  noise = 0,
  freq = 4,
  seed = 0,
  tall = false,
  tone = "signal",
  samples,
  parametricPoints,
  square = false,
  onPlay,
  playLabel = "▶ Play",
  badge,
}: {
  label: string;
  sublabel?: string;
  noise?: number;
  freq?: number;
  seed?: number;
  tall?: boolean;
  tone?: "signal" | "warm";
  samples?: number[];
  parametricPoints?: Array<{ x: number; y: number }> | null;
  square?: boolean;
  onPlay?: () => void;
  playLabel?: string;
  badge?: string;
}) {
  const hasParametric = Boolean(parametricPoints && parametricPoints.length > 0);
  const [viewMode, setViewMode] = useState<"2d" | "1d">("2d");

  const show2D = hasParametric && viewMode === "2d";
  const stroke = tone === "warm" ? "var(--primary-glow)" : "var(--signal)";

  const plotWidth = show2D ? (square ? 600 : 800) : 640;
  const plotHeight = show2D ? (square ? 600 : tall ? 240 : 160) : tall ? 220 : 140;
  const mid = plotHeight / 2;

  let pathD = "";
  if (show2D && parametricPoints) {
    pathD = parametricPath(plotWidth, plotHeight, parametricPoints, square ? 28 : 20, square);
  } else if (samples && samples.length > 0) {
    const len = samples.length;
    const pts: string[] = [];
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * plotWidth;
      const s = samples[i] ?? 0;
      const y = mid - s * plotHeight * 0.38;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    pathD = pts.join(" ");
  } else {
    pathD = wavePath(plotWidth, plotHeight, { freq, seed, noise, amp: 1 });
  }

  return (
    <div className="lab-panel relative overflow-hidden p-4">
      <div className="lab-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-xs font-bold tracking-[0.24em] text-signal uppercase">
            {label}
          </span>
          {badge ? (
            <span className="rounded bg-primary/20 px-1.5 py-0.2 font-mono text-[8px] font-bold text-primary uppercase">
              {badge}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {sublabel ? (
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              {sublabel}
            </span>
          ) : null}
          {hasParametric && (
            <div className="flex items-center rounded-md border border-border/80 bg-secondary/80 p-0.5 font-mono text-[9px]">
              <button
                type="button"
                onClick={() => setViewMode("2d")}
                className={cn(
                  "rounded px-1.5 py-0.5 font-bold uppercase transition-colors cursor-pointer",
                  viewMode === "2d"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="2D Parametric Shape (Pantry View)"
              >
                2D
              </button>
              <button
                type="button"
                onClick={() => setViewMode("1d")}
                className={cn(
                  "rounded px-1.5 py-0.5 font-bold uppercase transition-colors cursor-pointer",
                  viewMode === "1d"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="1D Time-Domain Wave (DSP Samples)"
              >
                1D
              </button>
            </div>
          )}
          {onPlay ? (
            <button
              onClick={onPlay}
              className="rounded-lg border border-primary/40 bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary hover:bg-primary/30 transition-colors uppercase cursor-pointer"
            >
              {playLabel}
            </button>
          ) : null}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${plotWidth} ${plotHeight}`}
        preserveAspectRatio={show2D && square ? "xMidYMid meet" : "none"}
        className={cn("relative z-10 mt-3 w-full", tall ? "h-64" : "h-32")}
        aria-hidden
      >
        <line
          x1="0"
          y1={mid}
          x2={plotWidth}
          y2={mid}
          stroke="var(--signal)"
          strokeWidth="1"
          opacity="0.18"
        />
        {show2D && square && (
          <>
            <line
              x1={plotWidth / 2}
              y1="0"
              x2={plotWidth / 2}
              y2={plotHeight}
              stroke="var(--border)"
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.4"
            />
            <line
              x1={plotWidth / 4}
              y1="0"
              x2={plotWidth / 4}
              y2={plotHeight}
              stroke="var(--border)"
              strokeDasharray="2 4"
              strokeWidth="0.75"
              opacity="0.15"
            />
            <line
              x1={(plotWidth * 3) / 4}
              y1="0"
              x2={(plotWidth * 3) / 4}
              y2={plotHeight}
              stroke="var(--border)"
              strokeDasharray="2 4"
              strokeWidth="0.75"
              opacity="0.15"
            />
            <line
              x1="0"
              y1={plotHeight / 4}
              x2={plotWidth}
              y2={plotHeight / 4}
              stroke="var(--border)"
              strokeDasharray="2 4"
              strokeWidth="0.75"
              opacity="0.15"
            />
            <line
              x1="0"
              y1={(plotHeight * 3) / 4}
              x2={plotWidth}
              y2={(plotHeight * 3) / 4}
              stroke="var(--border)"
              strokeDasharray="2 4"
              strokeWidth="0.75"
              opacity="0.15"
            />
            <circle cx={plotWidth / 2} cy={plotHeight / 2} r="2.5" fill={stroke} opacity="0.5" />
          </>
        )}
        <path
          d={pathD}
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.22"
        />
        <path
          d={pathD}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Spectrum({
  cutoff,
  rawSamples,
  seed,
  applied,
}: {
  cutoff: number;
  rawSamples?: number[];
  seed: number;
  applied: boolean;
}) {
  const bars = useMemo(() => {
    if (rawSamples && rawSamples.length > 0) {
      const { magnitude } = fft(rawSamples);
      const N = magnitude.length;
      let maxOverallMag = 0;
      for (let i = 0; i < N / 2; i++) {
        const m = magnitude[i] ?? 0;
        if (m > maxOverallMag) maxOverallMag = m;
      }

      const sampleRate = 22050; // The true backend sample rate
      const binHz = sampleRate / N;

      return Array.from({ length: 40 }, (_, i) => {
        const hz = MIN_HZ + (i / 39) * (MAX_HZ - MIN_HZ);
        const centerBin = Math.round(hz / binHz);
        const binStart = Math.max(0, centerBin - 2);
        const binEnd = Math.min(Math.floor(N / 2), centerBin + 2);

        let maxMag = 0;
        for (let b = binStart; b <= binEnd; b++) {
          const m = magnitude[b] ?? 0;
          if (m > maxMag) maxMag = m;
        }

        const normH =
          maxOverallMag > 0 ? Math.min(98, Math.max(2, (maxMag / maxOverallMag) * 100)) : 2;
        const isSignal = normH > 40; // True peaks will stand out above 40%
        return { hz, h: normH, isSignal };
      });
    }

    return Array.from({ length: 40 }, (_, i) => {
      const hz = MIN_HZ + (i / 39) * (MAX_HZ - MIN_HZ);
      const peak =
        Math.exp(-Math.pow((i - (2 + (seed % 3))) / 1.6, 2)) * 96 +
        Math.exp(-Math.pow((i - (7 + (seed % 4))) / 1.9, 2)) * 74 +
        Math.exp(-Math.pow((i - (12 + (seed % 5))) / 2.2, 2)) * 52;
      const noise = 8 + Math.abs(Math.sin(i * 2.13 + seed * 3.1)) * 26;
      return { hz, h: Math.max(noise, peak), isSignal: peak > 24 };
    });
  }, [rawSamples, seed]);

  return (
    <div className="lab-panel relative overflow-hidden p-5">
      <div className="lab-grid absolute inset-0 opacity-50" aria-hidden />
      <div className="relative z-10 flex items-baseline justify-between">
        <span className="font-display text-xs font-bold tracking-[0.24em] text-signal uppercase">
          Frequency domain — FFT
        </span>
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          magnitude
        </span>
      </div>

      <div className="relative z-10 mt-4 flex gap-3">
        <div className="flex flex-col justify-between py-1 font-mono text-[9px] text-signal/50">
          <span>1.0</span>
          <span>0.5</span>
          <span>0.0</span>
        </div>
        <div className="relative flex h-64 flex-1 items-end gap-[3px] border-b border-l border-signal/30 pl-1">
          {bars.map((b, i) => {
            const cut = b.hz > cutoff;
            // Squash height immediately when cut (visually dampening)
            const height = cut ? 2 : b.h;
            return (
              <span
                key={i}
                style={{ height: `${height}%` }}
                className={cn(
                  "flex-1 rounded-t-sm transition-all duration-300",
                  cut
                    ? "bg-[oklch(0.55_0.16_25)] opacity-45"
                    : b.isSignal
                      ? "bg-[image:linear-gradient(to_top,var(--signal-alt),var(--signal))] shadow-[0_0_12px_var(--signal)]"
                      : "bg-signal/35",
                )}
              />
            );
          })}
          <span
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow-[0_0_14px_var(--primary)]"
            style={{ left: `${((cutoff - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100}%` }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-y-0 right-0 bg-[oklch(0.55_0.16_25)]/10"
            style={{ left: `${((cutoff - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100}%` }}
            aria-hidden
          />
        </div>
      </div>

      <div className="relative z-10 mt-2 flex justify-between pl-8 font-mono text-[9px] tracking-[0.14em] text-signal/50 uppercase">
        <span>{MIN_HZ} Hz</span>
        <span>frequency →</span>
        <span>{MAX_HZ} Hz</span>
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap gap-4 font-mono text-[10px] tracking-[0.14em] uppercase">
        <span className="flex items-center gap-2 text-signal">
          <span className="h-3 w-3 rounded-sm bg-[image:linear-gradient(to_top,var(--signal-alt),var(--signal))]" />
          signal components
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="h-3 w-3 rounded-sm bg-signal/35" />
          noise
        </span>
        <span className="flex items-center gap-2 text-[oklch(0.6_0.16_25)]">
          <span className="h-3 w-3 rounded-sm bg-[oklch(0.55_0.16_25)] opacity-60" />
          removed by filter
        </span>
      </div>
    </div>
  );
}

const pipelineStages = ["INPUT SIGNAL", "FFT", "FILTER", "IFFT", "CLEAN SIGNAL"] as const;

function FilterPipeline({ done }: { done: boolean }) {
  return (
    <ol className="flex flex-col items-stretch">
      {pipelineStages.map((stage, i) => {
        const active = stage === "FILTER";
        const complete = done && i < pipelineStages.length;
        return (
          <li key={stage} className="flex flex-col items-center">
            <div
              className={cn(
                "lab-panel flex w-full items-center gap-3 px-4 py-2.5 transition-all",
                active && "border-primary/70 shadow-[var(--shadow-warm-glow)]",
              )}
            >
              <span className="font-mono text-[10px] text-signal/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "font-display text-sm font-bold tracking-[0.14em] uppercase",
                  active ? "text-primary" : complete ? "text-signal" : "text-signal/70",
                )}
              >
                {stage}
              </span>
              {active ? (
                <span className="ml-auto animate-pulse font-mono text-[9px] tracking-[0.2em] text-primary uppercase">
                  you are here
                </span>
              ) : null}
            </div>
            {i < pipelineStages.length - 1 ? (
              <span className="my-1 font-mono text-base text-primary/70" aria-hidden>
                ↓
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function FilteringLab() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const [selectedIngredients] = useSelectedIngredients();

  const activeQueue: QueueItem[] = useMemo(() => {
    return selectedIngredients
      .filter((i) => i.washable)
      .map((i, idx) => ({
        name: i.name,
        kind: (i.kind ?? "generic") as IngredientKind,
        idealCutoff: i.idealCutoff ?? 400 + idx * 80,
        // Must match Signal Generation's phase (seed: 0) exactly — this value
        // is passed straight through as the wave's phase offset, which
        // shifts where the periodic curve starts. Using a per-index offset
        // here (previously idx + 1.2) made every washable ingredient's
        // "raw/clean" shape in Filtering a rotated version of the identical
        // curve Generate Signal showed for it, reading as "a different
        // shape" even though the underlying formula was the same.
        seed: 0,
        baseFreq: i.freq ?? 3 + idx * 1.5,
      }));
  }, [selectedIngredients]);

  const [index, setIndex] = useState(0);
  // Start wide open (keep everything) rather than at MIN_HZ (0 Hz, which
  // squashes every visible bar to near-zero height before the player has
  // touched anything, making the spectrum look empty/broken on first view).
  const [cutoff, setCutoff] = useState(MAX_HZ);
  const [applied, setApplied] = useState(false);
  const [cleanedCount, setCleanedCount] = useState(0);
  const [showDragCue, setShowDragCue] = useState(true);

  useEffect(() => {
    const handleReset = () => {
      setIndex(0);
      setCutoff(MAX_HZ);
      setApplied(false);
      setCleanedCount(0);
      setShowDragCue(true);
    };
    window.addEventListener("wavebakery_stage_reset", handleReset);
    return () => window.removeEventListener("wavebakery_stage_reset", handleReset);
  }, []);

  const total = activeQueue.length;
  const allDone = total === 0 || cleanedCount >= total;
  const current = activeQueue[Math.min(index, Math.max(0, total - 1))] ?? {
    name: "None",
    kind: "generic" as IngredientKind,
    idealCutoff: 500,
    seed: 1,
    baseFreq: 4,
  };

  const session = getRecipeRunSession();
  const backendSessionId = session?.backendSessionId;
  const slotIndex = recipe.ingredients.findIndex(
    (n) => n.toLowerCase() === current.name.toLowerCase(),
  );
  const effectiveSlot = slotIndex >= 0 ? slotIndex : index;

  const [backendPrepScore, setBackendPrepScore] = useState<number | null>(null);
  // The backend's actual dirty/clean samples for this ingredient slot — the
  // server-authoritative signal that filtering must display and operate on,
  // not a separately-computed frontend approximation (see also
  // saveFilteredIngredient below, which stores the backend's real filtered
  // result instead of a locally-approximated one).
  const [backendItem, setBackendItem] = useState<SessionItemOut | null>(null);
  const [backendFilteredPlot, setBackendFilteredPlot] = useState<number[] | null>(null);

  // Fetch the server's real contaminated/clean signal for this slot whenever
  // the session or the active ingredient changes.
  useEffect(() => {
    setBackendItem(null);
    setBackendFilteredPlot(null);
    if (!backendSessionId) return;
    let cancelled = false;
    api
      .getSession(backendSessionId)
      .then((session) => {
        if (cancelled) return;
        const item = session.items.find((it) => it.slot === effectiveSlot) ?? null;
        setBackendItem(item);
      })
      .catch((err) => {
        console.warn("Backend session fetch error (falling back to client DSP):", err);
      });
    return () => {
      cancelled = true;
    };
  }, [backendSessionId, effectiveSlot]);

  useEffect(() => {
    if (applied && backendSessionId) {
      api
        .filterIngredient(backendSessionId, effectiveSlot, {
          tools: [{ kind: "lowpass", cutoff }],
          want_spectrogram: false,
        })
        .then((res) => {
          if (res && res.prep && typeof res.prep.score === "number") {
            setBackendPrepScore(res.prep.score);
          }
          if (res?.signal?.plot && res.signal.plot.length > 0) {
            setBackendFilteredPlot(res.signal.plot);
          }
        })
        .catch((err) => {
          console.warn("Backend filtering error (falling back to client DSP):", err);
        });
    } else {
      setBackendPrepScore(null);
      setBackendFilteredPlot(null);
    }
  }, [applied, backendSessionId, effectiveSlot, cutoff]);

  // Raw (noisy) input: the server's actual contaminated signal when a
  // backend session exists, so the displayed input is exactly what the
  // server will filter — not a separately-generated approximation. Falls
  // back to the local generator only when no backend session is available.
  const rawSamples = useMemo(() => {
    if (backendItem?.dirty?.plot && backendItem.dirty.plot.length > 0) {
      return backendItem.dirty.plot;
    }
    return getRecipeIngredientSamples(recipe.id, current.name, {
      noise: 0.85,
      seed: current.seed,
      freq: current.baseFreq,
    });
  }, [backendItem, recipe.id, current.name, current.seed, current.baseFreq]);

  const cleanSamples = useMemo(() => {
    if (backendItem?.clean_preview?.plot && backendItem.clean_preview.plot.length > 0) {
      return backendItem.clean_preview.plot;
    }
    return getRecipeIngredientSamples(recipe.id, current.name, {
      noise: 0.0,
      seed: current.seed,
      freq: current.baseFreq,
    });
  }, [backendItem, recipe.id, current.name, current.seed, current.baseFreq]);

  // Local client-side approximation, used only as a live "drag the slider"
  // preview before the filter is applied, or as an offline fallback when no
  // backend session exists. Once the filter is actually applied and the
  // server responds, the real backend result (backendFilteredPlot) takes
  // over as the displayed/saved filtered signal.
  const localFilteredSamples = useMemo(
    () => washFilterPreview(rawSamples, cleanSamples, cutoff, current.idealCutoff),
    [rawSamples, cleanSamples, cutoff, current.idealCutoff],
  );

  const filteredSamples =
    applied && backendFilteredPlot && backendFilteredPlot.length > 0
      ? backendFilteredPlot
      : localFilteredSamples;

  const cleanliness = useMemo(() => {
    if (backendPrepScore !== null && applied) {
      return Math.max(10, Math.min(100, Math.round(backendPrepScore)));
    }
    if (!applied) {
      const distance = Math.abs(cutoff - current.idealCutoff);
      return Math.max(12, Math.min(97, Math.round(97 - distance / 6)));
    }
    const sim = computeSignalSimilarity(filteredSamples, cleanSamples);
    return Math.max(10, Math.min(100, Math.round(sim)));
  }, [backendPrepScore, applied, filteredSamples, cleanSamples, cutoff, current.idealCutoff]);

  const noiseRemoved = Math.max(0, Math.min(98, Math.round(cleanliness * 0.95)));
  const isClean = cleanliness >= THRESHOLD && applied;
  const cleanedThis = index < cleanedCount;

  const [recordedAccuracies, setRecordedAccuracies] = useState<number[]>([]);

  const mathSignal = useMemo(() => {
    return getMathematicalSignal(current.name);
  }, [current.name]);

  const canonicalParametricPoints = useMemo(() => {
    if (!mathSignal?.parametricCurve) return null;
    return mathSignal.parametricCurve.generatePoints(601);
  }, [mathSignal]);

  const isSquareShape = useMemo(() => {
    return (
      current.name === "Tomato" ||
      current.name === "Onion" ||
      current.name === "Sauce" ||
      current.name === "Egg"
    );
  }, [current.name]);

  const isChicken = current.name.toLowerCase() === "chicken" || current.kind === "chicken";
  const [chickenAudio, setChickenAudio] = useState<DecodedChickenAudio | null>(() =>
    getCachedChickenAudio(),
  );

  useEffect(() => {
    if (!isChicken) return;
    let isCancelled = false;
    loadChickenAudio("/sounds/chicken.wav")
      .then((data) => {
        if (!isCancelled) {
          setChickenAudio(data);
        }
      })
      .catch((err) => {
        console.error("Failed to decode chicken.wav in Filtering:", err);
      });
    return () => {
      isCancelled = true;
    };
  }, [isChicken]);

  // Target clean parametric points: identical to Pantry canonical curve
  const targetParametricPoints = canonicalParametricPoints;

  // Raw noisy input parametric points: full noise level on the canonical contour
  const rawParametricPoints = useMemo(() => {
    if (!canonicalParametricPoints) return null;
    return getParametricPointsWithNoise(canonicalParametricPoints, 1.0, 1.0, current.seed);
  }, [canonicalParametricPoints, current.seed]);

  // Filtered parametric points: noise removed and shape adjusted based on filtering state
  const filteredParametricPoints = useMemo(() => {
    if (!canonicalParametricPoints) return null;

    let noiseRatio = 1.0;
    let signalScale = 1.0;

    if (isClean || cleanedThis) {
      noiseRatio = 0.0;
      signalScale = 1.0;
    } else if (applied && backendPrepScore !== null) {
      if (backendPrepScore >= 85) {
        noiseRatio = Math.max(0, (100 - backendPrepScore) / 100);
        signalScale = 1.0;
      } else {
        noiseRatio = Math.max(0, Math.min(1, (100 - backendPrepScore) / 80));
        signalScale = Math.max(0.65, backendPrepScore / 100);
      }
    } else {
      // Live preview during slider sweep
      if (cutoff < current.idealCutoff) {
        signalScale = Math.max(0.4, 1 - (current.idealCutoff - cutoff) / 250);
        noiseRatio = 0.0;
      } else {
        signalScale = 1.0;
        const noiseRange = MAX_HZ - current.idealCutoff;
        const rawFrac = noiseRange > 0 ? (cutoff - current.idealCutoff) / noiseRange : 0;
        noiseRatio = Math.pow(Math.max(0, Math.min(1, rawFrac)), 1.4);
      }
    }

    return getParametricPointsWithNoise(
      canonicalParametricPoints,
      noiseRatio,
      signalScale,
      current.seed,
    );
  }, [
    canonicalParametricPoints,
    isClean,
    cleanedThis,
    applied,
    backendPrepScore,
    cutoff,
    current.idealCutoff,
    current.seed,
  ]);

  // Main input signal parametric points
  const mainParametricPoints = useMemo(() => {
    if (!canonicalParametricPoints) return null;
    if (isClean || cleanedThis) {
      return canonicalParametricPoints;
    }
    if (applied) {
      return filteredParametricPoints;
    }
    return rawParametricPoints;
  }, [
    canonicalParametricPoints,
    isClean,
    cleanedThis,
    applied,
    filteredParametricPoints,
    rawParametricPoints,
  ]);

  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (player) player.destroy();
    };
  }, [player]);

  const handlePlaySignal = (type: string, samplesToPlay: number[]) => {
    if (player) {
      player.destroy();
      setPlayer(null);
      if (activePlayerId === type) {
        setActivePlayerId(null);
        return;
      }
    }

    const isChickenAudio = isChicken || current.name.toLowerCase().includes("chicken");
    const dur = isChickenAudio && chickenAudio ? chickenAudio.duration : 2.5;
    // For pure/clean chicken, pass the decoded AudioBuffer for pristine reproduction
    const audioBufferToUse =
      isChickenAudio && (type === "clean" || (type === "main" && (isClean || cleanedThis)))
        ? (chickenAudio?.buffer ?? null)
        : null;

    const newPlayer = new SignalAudioPlayer(
      {
        samples: samplesToPlay,
        frequency: current.baseFreq,
        duration: dur,
        audioBuffer: audioBufferToUse,
        ingredientName: current.name,
      },
      (s) => {
        if (s.isEnded) setActivePlayerId(null);
      },
    );
    newPlayer.play();
    setPlayer(newPlayer);
    setActivePlayerId(type);
  };

  const chefLine =
    total === 0
      ? `All ingredients in ${recipe.name} are directly usable and clean. You can skip straight to Mixing!`
      : allDone
        ? `Excellent! All ${total} washable ingredients for ${recipe.name} are cleaned and ready. Let's move on!`
        : isClean || cleanedThis
          ? `Spot on! The filtered waveform matches the clean target signal.`
          : applied
            ? cleanliness >= 75
              ? `That wave is getting much closer! Fine-tune the cutoff.`
              : cutoff < current.idealCutoff - 120
                ? `Careful — that cutoff is too low and shaving off the ingredient's shape.`
                : `Still noisy — lower the cutoff to shave away more high-frequency chatter.`
            : `Adjust the cutoff frequency and apply the filter until your waveform matches the target.`;

  const advance = () => {
    if (backendSessionId) {
      api
        .acceptIngredient(backendSessionId, effectiveSlot)
        .catch((err) => console.warn("Backend accept error:", err));
    }
    saveFilteredIngredient(recipe.id, current.name, filteredSamples);
    const updated = [...recordedAccuracies, cleanliness];
    setRecordedAccuracies(updated);
    const avg = Math.round(updated.reduce((a, b) => a + b, 0) / updated.length);
    recordStageAccuracy("filtering", avg);

    const nextCount = cleanedThis ? cleanedCount : cleanedCount + 1;
    if (!cleanedThis) setCleanedCount((c) => c + 1);
    if (index + 1 < total) {
      setIndex((i) => i + 1);
      setCutoff(MAX_HZ);
      setApplied(false);
      setBackendPrepScore(null);
    }
    if (nextCount >= total) {
      unlock(3);
    }
  };

  if (unlockedStep < 2) {
    return (
      <main className="relative min-h-screen bg-background">
        <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
        <div className="relative z-10 mx-auto max-w-4xl px-8 py-16 text-center">
          <div className="kitchen-card p-10">
            <span className="text-4xl" aria-hidden>
              🔒
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground uppercase">
              Station Locked: Filtering Lab
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete the previous steps first. Start by generating ingredient signals at Station
              01.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/generate">
                <GameButton size="lg" className="uppercase">
                  Go to Signal Generation →
                </GameButton>
              </Link>
              <Link to="/kitchen">
                <GameButton size="lg" variant="secondary" className="uppercase">
                  ← Back to Kitchen
                </GameButton>
              </Link>
            </div>
            <div className="mx-auto mt-8 max-w-md">
              <ChefFourier
                size="sm"
                float={false}
                message="Let's finish the earlier steps before we move on!"
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.1]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_70%)] opacity-[0.12]"
        aria-hidden
      />

      <TimeExpiredModal />
      <div className="relative z-10 mx-auto max-w-[110rem] px-8 py-6">
        {/* TOP HUD */}
        <header className="lab-panel flex flex-wrap items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link to="/kitchen">
              <GameButton variant="secondary" size="sm">
                ← Back to Kitchen
              </GameButton>
            </Link>
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">
                Station 02 · Washing
              </p>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-signal uppercase">
                Filtering Lab
              </h1>
              <p className="mt-1 font-mono text-[10px] tracking-[0.18em] text-signal/60 uppercase">
                objective — clean each ingredient that needs filtering
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <RecipeTimerBadge />
            <dl className="font-mono text-[10px] tracking-[0.18em] text-signal/60 uppercase">
              <div className="flex items-center gap-3">
                <dt>Recipe</dt>
                <dd>
                  <div className="flex items-center gap-2 rounded-lg border border-signal/40 bg-secondary/80 px-2.5 py-1">
                    <span className="text-base" aria-hidden>
                      {recipe.id === "burger"
                        ? "🍔"
                        : recipe.id === "cake"
                          ? "🧁"
                          : recipe.id === "noodles"
                            ? "🍜"
                            : recipe.id === "chicken-fry"
                              ? "🍗"
                              : "🥪"}
                    </span>
                    <span className="font-display text-sm font-extrabold text-signal uppercase">
                      {recipe.name}
                    </span>
                  </div>
                </dd>
              </div>
              <div className="mt-1 flex gap-3">
                <dt>Step</dt>
                <dd className="font-display text-sm font-extrabold text-primary">
                  Station 02 · Filter
                </dd>
              </div>
            </dl>

            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-signal/70 uppercase">
                {total > 0
                  ? `${cleanedCount} / ${total} washable ingredients cleaned`
                  : "0 washable ingredients"}
              </p>
              <div className="mt-2 flex gap-1.5">
                {total > 0 ? (
                  activeQueue.map((q, i) => (
                    <span
                      key={q.name}
                      className={cn(
                        "h-2.5 w-10 rounded-full border border-border",
                        i < cleanedCount ? "bg-[image:var(--gradient-warm)]" : "bg-secondary",
                      )}
                    />
                  ))
                ) : (
                  <span className="font-mono text-[9px] text-signal/60">Bypassed (All Ready)</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {total === 0 ? (
          <div className="mt-10 kitchen-card p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[image:var(--gradient-warm)] text-3xl shadow-md">
              ✨
            </div>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-foreground uppercase">
              No Washing Required for {recipe.name}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              All ingredients for {recipe.name} ({recipe.ingredients.join(", ")}) are directly
              usable and already clean. They bypass the Filtering Lab and go straight to the Mixing
              station.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/mixing">
                <GameButton size="lg" className="uppercase">
                  Go to Mixing →
                </GameButton>
              </Link>
              <Link to="/kitchen">
                <GameButton size="lg" variant="secondary" className="uppercase">
                  Back to Kitchen Hub
                </GameButton>
              </Link>
            </div>
            <div className="mt-8 max-w-md mx-auto">
              <ChefFourier size="sm" float={false} message={chefLine} />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[16rem_1fr_20rem]">
            {/* LEFT — CLEANING QUEUE */}
            <aside className="grid content-start gap-5">
              <section className="kitchen-card p-5">
                <p className="font-mono text-[10px] tracking-[0.26em] text-primary uppercase">
                  Cleaning queue
                </p>
                <ul className="mt-4 space-y-2">
                  {activeQueue.map((q, i) => {
                    const done = i < cleanedCount;
                    const active = i === index && !allDone;
                    return (
                      <li
                        key={q.name}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-all",
                          active
                            ? "border-primary bg-secondary shadow-[var(--shadow-warm-glow)]"
                            : done
                              ? "border-border/60 bg-card/60 opacity-80"
                              : "border-dashed border-border bg-card/40",
                        )}
                      >
                        <span
                          className={cn(
                            "font-mono text-sm",
                            done
                              ? "text-signal"
                              : active
                                ? "text-primary"
                                : "text-muted-foreground",
                          )}
                        >
                          {done ? "✓" : active ? "→" : "○"}
                        </span>
                        <IngredientGlyph
                          kind={q.kind}
                          className={cn("h-8 w-8", !done && !active && "opacity-60")}
                        />
                        <span
                          className={cn(
                            "font-display text-sm font-bold tracking-wide uppercase",
                            active ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {q.name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 font-mono text-[9px] leading-relaxed tracking-[0.14em] text-muted-foreground uppercase">
                  only washable ingredients enter this queue — the rest skip filtering
                </p>
              </section>

              <section className="lab-panel p-5">
                <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
                  Process
                </p>
                <div className="mt-4">
                  <FilterPipeline done={isClean || cleanedThis} />
                </div>
              </section>
            </aside>

            {/* CENTER — WORKSPACE */}
            <div className="grid content-start gap-6">
              {/* CURRENT INGREDIENT */}
              <section className="kitchen-card flex flex-wrap items-center justify-between gap-6 p-6">
                <div className="flex items-center gap-5">
                  <div className="relative rounded-3xl border-2 border-border bg-secondary p-4">
                    <span
                      className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_center,var(--signal),transparent_70%)] opacity-25"
                      aria-hidden
                    />
                    <IngredientGlyph kind={current.kind} className="relative h-16 w-16" />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.26em] text-primary uppercase">
                      Current ingredient
                    </p>
                    <h2 className="font-display text-4xl font-extrabold tracking-tight text-foreground uppercase">
                      {current.name}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase">
                      <span className="text-muted-foreground">signal status — </span>
                      <span
                        className={
                          isClean || cleanedThis
                            ? "text-signal font-bold"
                            : "text-[oklch(0.65_0.17_35)] font-bold"
                        }
                      >
                        {isClean || cleanedThis ? "clean" : "noisy"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[9px]">
                      <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-bold text-primary uppercase">
                        {isChicken
                          ? "RECORDED PCM AUDIO"
                          : mathSignal?.parametricCurve
                            ? "PARAMETRIC 2D"
                            : mathSignal
                              ? `${mathSignal.waveformType.toUpperCase()} WAVE`
                              : "TIME DOMAIN"}
                      </span>
                      <span className="rounded border border-border bg-secondary/80 px-2 py-0.5 text-muted-foreground uppercase">
                        {isChicken
                          ? "WAV RECORDING"
                          : mathSignal?.parametricCurve
                            ? (mathSignal.parametricCurve.domainDisplay ?? "PARAMETRIC CURVE")
                            : (mathSignal?.equationDisplay ?? `${current.baseFreq} Hz`)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <GameButton
                    variant="lab"
                    size="sm"
                    onClick={() =>
                      handlePlaySignal(
                        "main",
                        isClean || cleanedThis
                          ? cleanSamples
                          : applied
                            ? filteredSamples
                            : rawSamples,
                      )
                    }
                  >
                    {activePlayerId === "main" ? "⏸ Pause Signal" : "▶ Play Signal"}
                  </GameButton>
                  <GameButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCutoff(MAX_HZ);
                      setApplied(false);
                    }}
                  >
                    ↻ Reset
                  </GameButton>
                </div>
              </section>

              {/* TIME DOMAIN + FFT ARROW + SPECTRUM */}
              <div className="grid gap-5 lg:grid-cols-[1fr_7rem_1fr]">
                <div className="grid content-start gap-4">
                  <LabWave
                    label="Time domain"
                    sublabel={
                      isClean || cleanedThis
                        ? "clean ingredient signal"
                        : applied
                          ? "filtered ingredient signal"
                          : "noisy ingredient signal"
                    }
                    samples={
                      isClean || cleanedThis ? cleanSamples : applied ? filteredSamples : rawSamples
                    }
                    parametricPoints={mainParametricPoints}
                    square={isSquareShape}
                    tall
                    tone={applied && !isClean && !cleanedThis ? "warm" : "signal"}
                    onPlay={() =>
                      handlePlaySignal(
                        "raw-main",
                        isClean || cleanedThis
                          ? cleanSamples
                          : applied
                            ? filteredSamples
                            : rawSamples,
                      )
                    }
                    playLabel={activePlayerId === "raw-main" ? "⏸ Pause" : "▶ Play"}
                  />
                  <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    each ingredient carries its own waveform and sound
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center gap-2 py-4">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-signal/60 uppercase">
                    noisy time signal
                  </span>
                  <span className="font-mono text-2xl text-primary" aria-hidden>
                    ↓
                  </span>
                  <span className="rounded-full border-2 border-primary/70 bg-card px-4 py-2 font-display text-base font-extrabold tracking-[0.2em] text-primary uppercase shadow-[var(--shadow-warm-glow)]">
                    FFT
                  </span>
                  <span className="font-mono text-2xl text-primary" aria-hidden>
                    ↓
                  </span>
                  <span className="font-mono text-[9px] tracking-[0.2em] text-signal/60 uppercase">
                    frequency domain
                  </span>
                </div>

                <Spectrum
                  cutoff={cutoff}
                  rawSamples={rawSamples}
                  seed={current.seed}
                  applied={applied}
                />
              </div>

              {/* FILTER CONTROL */}
              <section className="kitchen-card relative p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.26em] text-primary uppercase">
                      Cutoff frequency
                    </p>
                    <p className="font-display text-3xl font-extrabold text-foreground">
                      Cutoff: {cutoff} Hz
                    </p>
                  </div>
                  <GameButton className="uppercase" onClick={() => setApplied(true)}>
                    Apply filter
                  </GameButton>
                </div>

                {/* Tutorial cue pointing to the draggable cutoff handle */}
                {showDragCue && !applied && !cleanedThis && (
                  <div className="mt-4 flex justify-start">
                    <DragTutorialCue
                      message="Drag this to choose what frequencies to keep."
                      direction="down"
                      onDismiss={() => setShowDragCue(false)}
                    />
                  </div>
                )}

                <input
                  type="range"
                  min={MIN_HZ}
                  max={MAX_HZ}
                  step={10}
                  value={cutoff}
                  onPointerDown={() => setShowDragCue(false)}
                  onChange={(e) => {
                    setShowDragCue(false);
                    setCutoff(Number(e.target.value));
                    setApplied(false);
                  }}
                  aria-label="Cutoff frequency"
                  className="mt-4 h-3 w-full cursor-grab rounded-full accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
                />
                <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  <span>{MIN_HZ} Hz — keep less</span>
                  <span>drag to sweep the cutoff</span>
                  <span>{MAX_HZ} Hz — keep more</span>
                </div>
              </section>

              {/* WAVEFORM COMPARISON GRID */}
              <div className="grid gap-5 lg:grid-cols-3">
                <LabWave
                  label="Raw Input"
                  sublabel="noisy ingredient signal"
                  samples={rawSamples}
                  parametricPoints={rawParametricPoints}
                  square={isSquareShape}
                  onPlay={() => handlePlaySignal("raw", rawSamples)}
                  playLabel={activePlayerId === "raw" ? "⏸ Pause" : "▶ Play Raw"}
                />
                <LabWave
                  label="Filtered Output"
                  sublabel={
                    applied
                      ? isClean || cleanedThis
                        ? "clean signal matched"
                        : "player filtered result"
                      : "filter not applied"
                  }
                  samples={filteredSamples}
                  parametricPoints={filteredParametricPoints}
                  square={isSquareShape}
                  tone="warm"
                  onPlay={() => handlePlaySignal("filtered", filteredSamples)}
                  playLabel={activePlayerId === "filtered" ? "⏸ Pause" : "▶ Play Output"}
                />
                <LabWave
                  label="Target Clean Signal"
                  sublabel="desired pure waveform"
                  samples={cleanSamples}
                  parametricPoints={targetParametricPoints}
                  square={isSquareShape}
                  onPlay={() => handlePlaySignal("clean", cleanSamples)}
                  playLabel={activePlayerId === "clean" ? "⏸ Pause" : "▶ Play Target"}
                />
              </div>
            </div>

            {/* RIGHT — READOUT + CHEF */}
            <aside className="grid content-start gap-5">
              <section className="kitchen-card p-6">
                <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
                  Filter Status
                </p>

                <dl className="mt-4 space-y-3 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                  <div className="flex justify-between">
                    <dt>Current Cutoff</dt>
                    <dd className="font-display text-base font-extrabold text-foreground">
                      {cutoff} Hz
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Filter State</dt>
                    <dd
                      className={cn(
                        "font-display text-sm font-extrabold",
                        applied ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {applied ? "Applied" : "Not Applied"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Signal Match</dt>
                    <dd
                      className={cn(
                        "font-display text-sm font-extrabold",
                        isClean || cleanedThis ? "text-signal" : "text-foreground",
                      )}
                    >
                      {isClean || cleanedThis ? "Clean Matched ✓" : "Adjusting"}
                    </dd>
                  </div>
                </dl>

                {isClean || cleanedThis ? (
                  <p className="mt-5 rounded-2xl border-2 border-signal/50 bg-signal/10 px-4 py-3 text-center font-display text-sm font-extrabold tracking-[0.16em] text-signal uppercase shadow-[var(--shadow-glow)]">
                    ✓ Target Waveform Matched
                  </p>
                ) : (
                  <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
                    Compare your <strong>Filtered Output</strong> with the{" "}
                    <strong>Target Clean Signal</strong> and adjust the cutoff until the shapes
                    match.
                  </p>
                )}

                {allDone ? (
                  <div className="mt-5 grid gap-3">
                    <p className="text-center font-display text-sm font-extrabold tracking-[0.14em] text-signal uppercase">
                      ✓ All required ingredients clean
                    </p>
                    <p className="text-center font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                      {cleanedCount} / {total} ingredients cleaned
                    </p>
                    <Link to="/mixing">
                      <GameButton size="lg" className="w-full uppercase">
                        Go to Mixing →
                      </GameButton>
                    </Link>
                  </div>
                ) : (
                  <GameButton
                    className="mt-5 w-full uppercase"
                    disabled={!(isClean || cleanedThis)}
                    onClick={advance}
                  >
                    Next ingredient →
                  </GameButton>
                )}
              </section>

              <section className="lab-panel px-4 py-5">
                <ChefFourier size="sm" float={false} message={chefLine} bubbleSide="right" />
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
