import { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Truck,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniWave } from "@/components/game/MiniWave";
import { SYSTEM_ALIAS_FREE_FS, systemPolesZeros, type SystemPresetType } from "@/lib/z-system";

export type { SystemPresetType };

export interface SystemResponsePlotterProps {
  preset: SystemPresetType;
  poleRadius: number; // r in [0, 1.1]
  frequency: number; // omega0 in [0, PI]
  samplingRateHz: number; // e.g. 8000 or 1200
  onPresetChange: (preset: SystemPresetType) => void;
  onPoleRadiusChange: (r: number) => void;
  onFrequencyChange: (w: number) => void;
  onSamplingRateChange: (fs: number) => void;
  dishSignal?: number[];
  equalizedSignal?: number[];
  /** Where the vibration sensor reports the road tone (rad/sample, 0..pi). */
  vibrationOmega?: number;
  roadGain?: number;
  dishGain?: number;
  accuracy?: number;
  roadHz?: number;
  recipeName?: string;
  onToggleAudio?: () => void;
  onPlayBeforeAudio?: () => void;
  onPlayAfterAudio?: () => void;
  audioMode?: "after" | "before";
  isPlaying?: boolean;
}

const PRESET_INFO: Record<
  SystemPresetType,
  {
    label: string;
    gameTitle: string;
    gameBadge?: string;
    desc: string;
    gameDesc: string;
    formula: string;
    recurrence: string;
    draggable: "pole" | "zero" | null;
  }
> = {
  notch: {
    label: "Notch Filter",
    gameTitle: "NOTCH FILTER",
    gameBadge: "⭐ RECOMMENDED",
    desc: "Cancel one troublesome frequency",
    gameDesc: "Cancel one troublesome frequency.",
    formula: "H(z) = (z - e^{jω0})(z - e^{-jω0}) / (z - 0.85e^{jω0})(z - 0.85e^{-jω0})",
    recurrence: "y[n] = x[n] - 2cos(ω0)x[n-1] + x[n-2] + 1.7cos(ω0)y[n-1] - 0.7225y[n-2]",
    draggable: "zero",
  },
  lowpass1: {
    label: "Low-Pass",
    gameTitle: "LOW-PASS",
    desc: "Smooth out rapid vibration",
    gameDesc: "Smooth out rapid vibration.",
    formula: "H(z) = (1 - r)·z / (z - r)",
    recurrence: "y[n] = (1 - r)·x[n] + r·y[n-1]",
    draggable: "pole",
  },
  resonator2: {
    label: "Resonator",
    gameTitle: "RESONATOR",
    desc: "Boost a selected frequency",
    gameDesc: "Boost a selected frequency.",
    formula: "H(z) = z² / (z - r·e^{jω0})(z - r·e^{-jω0})",
    recurrence: "y[n] = x[n] + 2r·cos(ω0)·y[n-1] - r²·y[n-2]",
    draggable: "pole",
  },
  moving_avg: {
    label: "Moving Average",
    gameTitle: "MOVING AVERAGE",
    desc: "Simple smoothing filter",
    gameDesc: "Simple smoothing filter.",
    formula: "H(z) = (1/6) · (1 - z⁻⁶) / (1 - z⁻¹)",
    recurrence: "y[n] = (1/6)·Σ x[n-k], k = 0..5",
    draggable: null,
  },
};

export function SystemResponsePlotter({
  preset,
  poleRadius,
  frequency,
  samplingRateHz,
  onPresetChange,
  onPoleRadiusChange,
  onFrequencyChange,
  onSamplingRateChange,
  dishSignal,
  equalizedSignal,
  vibrationOmega,
  roadGain = 1.0,
  dishGain = 1.0,
  accuracy = 80,
  roadHz = 2600,
  recipeName = "Dish",
  onToggleAudio,
  onPlayBeforeAudio,
  onPlayAfterAudio,
  audioMode = "after",
  isPlaying = false,
}: SystemResponsePlotterProps) {
  // Stable when every pole is inside the unit circle (the notch's poles sit
  // at 0.85 and the moving average's at 0, whatever the r slider says).
  const isStable = systemPolesZeros(preset, poleRadius, frequency).poles.every(
    (p) => Math.hypot(p.re, p.im) < 1,
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const info = PRESET_INFO[preset];

  // Calculate poles and zeros for current system setup
  const { poles, zeros, freqResponse, phaseResponse } = useMemo(() => {
    const { poles: pList, zeros: zList, gain } = systemPolesZeros(preset, poleRadius, frequency);
    const N = 128;
    const response: number[] = new Array(N).fill(0);
    const phase: number[] = new Array(N).fill(0);

    for (let i = 0; i < N; i++) {
      const w = (i / (N - 1)) * Math.PI;
      const zRe = Math.cos(w);
      const zIm = Math.sin(w);

      let numSq = 1.0;
      let numAngle = 0;
      for (const z of zList) {
        const dx = zRe - z.re;
        const dy = zIm - z.im;
        numSq *= dx * dx + dy * dy;
        numAngle += Math.atan2(dy, dx);
      }

      let denSq = 1.0;
      let denAngle = 0;
      for (const p of pList) {
        const dx = zRe - p.re;
        const dy = zIm - p.im;
        denSq *= dx * dx + dy * dy;
        denAngle += Math.atan2(dy, dx);
      }

      const H = denSq > 1e-6 ? Math.abs(gain) * Math.sqrt(numSq / denSq) : 10;
      response[i] = Math.min(4.0, H);
      phase[i] = numAngle - denAngle;
    }

    return { poles: pList, zeros: zList, freqResponse: response, phaseResponse: phase };
  }, [preset, poleRadius, frequency]);

  // Compute FFT magnitudes for input and equalized output spectrum (for technical drawer)
  const { inputSpectrum, outputSpectrum } = useMemo(() => {
    const N = 64;
    const inSpec: number[] = new Array(N / 2 + 1).fill(0);
    const outSpec: number[] = new Array(N / 2 + 1).fill(0);

    const sig =
      dishSignal && dishSignal.length >= N
        ? dishSignal
        : new Array(N).fill(0).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / 8000));

    for (let k = 0; k <= N / 2; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        const s = sig[n] ?? 0;
        re += s * Math.cos(angle);
        im -= s * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im) / N;
      inSpec[k] = mag;

      const w = (2 * Math.PI * k) / N;
      const respIdx = Math.round((w / Math.PI) * (freqResponse.length - 1));
      const gain = freqResponse[respIdx] ?? 1.0;
      outSpec[k] = isStable ? mag * gain : mag * 5.0;
    }

    return { inputSpectrum: inSpec, outputSpectrum: outSpec };
  }, [dishSignal, freqResponse, isStable]);

  // SVG coordinate transformation for z-plane circle (center 100, 100, radius 70)
  const toSvgCoords = (re: number, im: number) => {
    const cx = 100;
    const cy = 100;
    const r = 70;
    return {
      x: cx + re * r,
      y: cy - im * r,
    };
  };

  const fromSvgCoords = (x: number, y: number) => {
    const cx = 100;
    const cy = 100;
    const r = 70;
    return { re: (x - cx) / r, im: (cy - y) / r };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!svgRef.current || !info.draggable) return;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const inverse = ctm.inverse();
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(inverse);
    const { re, im } = fromSvgCoords(local.x, local.y);
    const r = Math.min(1.1, Math.sqrt(re * re + im * im));
    let w = Math.atan2(Math.abs(im), re);
    if (w < 0) w = 0;
    if (w > Math.PI) w = Math.PI;
    if (info.draggable === "pole") {
      onPoleRadiusChange(Math.round(r * 100) / 100);
    }
    onFrequencyChange(Math.round(w * 20) / 20);
  };

  const nyquistHz = samplingRateHz / 2;
  const isAliasing = samplingRateHz < SYSTEM_ALIAS_FREE_FS;

  // Cart wobble intensity: amplitude grows with pole radius, speed with frequency
  const wobbleDeg = Math.min(14, poleRadius * 12);
  const wobbleDuration = Math.max(0.25, 1.1 - (frequency / Math.PI) * 0.8);

  // Target coordinates on Z-plane for the road vibration
  const targetPoint = useMemo(() => {
    if (vibrationOmega == null) return null;
    return toSvgCoords(Math.cos(vibrationOmega), Math.sin(vibrationOmega));
  }, [vibrationOmega]);

  const targetPointConj = useMemo(() => {
    if (vibrationOmega == null) return null;
    return toSvgCoords(Math.cos(vibrationOmega), -Math.sin(vibrationOmega));
  }, [vibrationOmega]);

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          MAIN GAMEPLAY AREA (2 COLUMNS)
          Left: Choose Filter & Tune Filter & Sensor Sampling
          Right: Z-Plane Targeting Tool & Before/After Feedback
      ───────────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* ── LEFT COLUMN: SUSPENSION CHOICE & TUNING (5 COLS) ── */}
        <div className="space-y-5 lg:col-span-5">
          {/* 1. CHOOSE YOUR SUSPENSION */}
          <div className="kitchen-card p-5 space-y-3.5 border-2 border-border/80 bg-card/95 shadow-md">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-primary">
                  Step 1
                </span>
                <h3 className="font-display text-base font-black uppercase text-foreground">
                  Choose your suspension
                </h3>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                {info.gameTitle}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {(
                Object.entries(PRESET_INFO) as Array<
                  [SystemPresetType, (typeof PRESET_INFO)[SystemPresetType]]
                >
              ).map(([id, p]) => {
                const isActive = preset === id;
                const isNotch = id === "notch";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onPresetChange(id)}
                    className={cn(
                      "relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all cursor-pointer",
                      isActive
                        ? "border-primary bg-primary/15 text-foreground ring-2 ring-primary/60 shadow-md shadow-primary/10"
                        : isNotch
                          ? "border-primary/50 bg-secondary/70 hover:border-primary hover:bg-secondary text-foreground"
                          : "border-border/80 bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {p.gameBadge && (
                      <span className="absolute -top-2.5 right-2 rounded-full bg-primary px-2 py-0.5 font-mono text-[8px] font-black uppercase text-primary-foreground shadow-sm">
                        RECOMMENDED
                      </span>
                    )}
                    <span className="font-display text-xs font-black uppercase tracking-tight text-foreground">
                      {p.gameTitle}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground leading-tight">
                      {p.gameDesc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. TUNE THE FILTER */}
          <div className="kitchen-card p-5 space-y-4 border-2 border-border/80 bg-card/95 shadow-md">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-primary">
                  Step 2
                </span>
                <h3 className="font-display text-base font-black uppercase text-foreground">
                  🎛 Tune the filter
                </h3>
              </div>
              <Sliders className="h-4 w-4 text-primary" />
            </div>

            {/* Target Pitch Tuning Slider (Relevant for notch, resonator) */}
            {preset !== "moving_avg" && preset !== "lowpass1" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display text-xs font-bold uppercase text-foreground">
                      Vibration Pitch Target (ω₀)
                    </span>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Slide to match the road vibration frequency
                    </p>
                  </div>
                  <span className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-xs font-black text-primary">
                    {Math.round((frequency / Math.PI) * nyquistHz)} Hz
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.PI}
                  step={0.05}
                  value={frequency}
                  onChange={(e) => onFrequencyChange(Number(e.target.value))}
                  className="h-2.5 w-full cursor-grab accent-primary active:cursor-grabbing"
                />

                <div className="flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
                  <span>0 Hz (DC)</span>
                  {vibrationOmega != null && (
                    <span className="font-bold text-amber-400">
                      Road vibration: {Math.round((vibrationOmega / Math.PI) * nyquistHz)} Hz
                    </span>
                  )}
                  <span>{Math.round(nyquistHz)} Hz (Nyquist)</span>
                </div>
              </div>
            )}

            {/* Damping / Radius controls based on preset */}
            {preset === "notch" ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 font-mono text-xs text-emerald-400">
                <p className="font-bold uppercase tracking-wider text-[10px]">
                  ✓ Notch damping: 0.85 (fixed)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Pre-calibrated safely inside the unit circle (|z| &lt; 1.0) so the cart won&apos;t resonate out of control.
                </p>
              </div>
            ) : preset === "resonator2" ? (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display text-xs font-bold uppercase text-foreground">
                      Resonator Damping (r)
                    </span>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Must stay inside safe limit (|z| &lt; 1.0)
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-lg border px-2.5 py-0.5 font-mono text-xs font-black",
                      isStable
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-rose-500/60 bg-rose-500/20 text-rose-400",
                    )}
                  >
                    r = {poleRadius.toFixed(2)}
                  </span>
                </div>

                <input
                  type="range"
                  min={0.0}
                  max={1.1}
                  step={0.01}
                  value={poleRadius}
                  onChange={(e) => onPoleRadiusChange(Number(e.target.value))}
                  className="h-2.5 w-full cursor-grab accent-primary active:cursor-grabbing"
                />

                <div className="flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
                  <span>0.0 (Damped)</span>
                  <span className="font-bold text-emerald-400">Safe Limit &lt; 1.0</span>
                  <span className="font-bold text-rose-400">1.1 (Runaway!)</span>
                </div>
              </div>
            ) : preset === "lowpass1" ? (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display text-xs font-bold uppercase text-foreground">
                      Smoothing Strength (r)
                    </span>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Higher values smooth out more rapid vibration
                    </p>
                  </div>
                  <span className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-black text-primary">
                    r = {poleRadius.toFixed(2)}
                  </span>
                </div>

                <input
                  type="range"
                  min={0.0}
                  max={0.99}
                  step={0.01}
                  value={poleRadius}
                  onChange={(e) => onPoleRadiusChange(Number(e.target.value))}
                  className="h-2.5 w-full cursor-grab accent-primary active:cursor-grabbing"
                />
              </div>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">
                Moving average is a fixed 6-tap FIR filter with no adjustable damping dials.
              </p>
            )}
          </div>

          {/* 3. SENSOR SAMPLING (Simple & Clean) */}
          <div className="kitchen-card p-5 space-y-3 border-2 border-border/80 bg-card/95 shadow-md">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-primary">
                  Sensor
                </span>
                <h3 className="font-display text-base font-black uppercase text-foreground">
                  Sensor sampling
                </h3>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground font-bold">
                {samplingRateHz} Hz
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onSamplingRateChange(8000)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer",
                  samplingRateHz >= 4000
                    ? "border-emerald-500 bg-emerald-500/15 text-foreground ring-1 ring-emerald-500/50 shadow-xs"
                    : "border-border/80 bg-secondary/50 text-muted-foreground hover:bg-secondary",
                )}
              >
                <span className="text-emerald-400 font-bold">○</span>
                <div>
                  <p className="font-display text-xs font-black uppercase">8.0 kHz</p>
                  <p className="font-mono text-[10px] text-emerald-400 font-bold">Accurate</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSamplingRateChange(1200)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer",
                  samplingRateHz < 4000
                    ? "border-rose-500 bg-rose-500/15 text-foreground ring-1 ring-rose-500/50 shadow-xs"
                    : "border-border/80 bg-secondary/50 text-muted-foreground hover:bg-secondary",
                )}
              >
                <span className="text-rose-400 font-bold">○</span>
                <div>
                  <p className="font-display text-xs font-black uppercase">1.2 kHz</p>
                  <p className="font-mono text-[10px] text-rose-400 font-bold">Aliasing risk</p>
                </div>
              </button>
            </div>

            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              {isAliasing ? (
                <span className="text-rose-400 font-bold">
                  ⚠️ Too slow → the vibration appears at the wrong frequency!
                </span>
              ) : (
                <span>✓ High sampling rate captures the true road vibration without aliasing.</span>
              )}
            </p>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Z-PLANE TOOL & BEFORE/AFTER FEEDBACK (7 COLS) ── */}
        <div className="space-y-5 lg:col-span-7">
          {/* 1. INTERACTIVE Z-PLANE GAME TOOL */}
          <div className="kitchen-card p-5 border-2 border-border/80 bg-card/95 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h4 className="font-display text-sm font-black uppercase text-foreground">
                  🎛 Targeting Radar
                </h4>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block animate-ping" /> Target Vibration
                </span>
                <span className="flex items-center gap-1 text-primary font-bold">
                  <span className="h-2 w-2 rounded-full border border-primary inline-block" /> Your Filter
                </span>
              </div>
            </div>

            <p className="font-mono text-xs text-muted-foreground">
              {info.draggable
                ? `Move this to the vibration: Drag the ${info.draggable === "zero" ? "◯ zero" : "✕ pole"} directly onto the orange road marker.`
                : "Fixed FIR response filter shape."}
            </p>

            {/* Radar Canvas */}
            <div className="flex justify-center py-2">
              <svg
                ref={svgRef}
                width="220"
                height="220"
                viewBox="0 0 200 200"
                className="overflow-visible touch-none select-none rounded-2xl bg-secondary/30 p-1"
                onPointerDown={(e) => {
                  if (!info.draggable) return;
                  (e.target as Element).setPointerCapture(e.pointerId);
                  setDragging(true);
                  handleDragMove(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (!dragging) return;
                  handleDragMove(e.clientX, e.clientY);
                }}
                onPointerUp={() => setDragging(false)}
                onPointerLeave={() => setDragging(false)}
              >
                {/* Grid axes */}
                <line
                  x1="10"
                  y1="100"
                  x2="190"
                  y2="100"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <line
                  x1="100"
                  y1="10"
                  x2="100"
                  y2="190"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Safe Damped Zone background fill */}
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill={isStable ? "oklch(0.72 0.16 140 / 0.08)" : "oklch(0.62 0.22 25 / 0.12)"}
                />

                {/* Unit Circle |z|=1 */}
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeOpacity={0.8}
                />

                {/* Pole Radius Boundary (r) */}
                <circle
                  cx="100"
                  cy="100"
                  r={70 * poleRadius}
                  fill="none"
                  stroke={isStable ? "oklch(0.72 0.16 140)" : "oklch(0.62 0.22 25)"}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Target Road Vibration Vector & Crosshair */}
                {targetPoint && (
                  <g>
                    <line
                      x1="100"
                      y1="100"
                      x2={targetPoint.x}
                      y2={targetPoint.y}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      opacity={0.8}
                    />
                    <circle
                      cx={targetPoint.x}
                      cy={targetPoint.y}
                      r="9"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="animate-ping"
                      opacity={0.4}
                    />
                    <circle
                      cx={targetPoint.x}
                      cy={targetPoint.y}
                      r="9"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                    <circle cx={targetPoint.x} cy={targetPoint.y} r="2.5" fill="#f59e0b" />
                  </g>
                )}

                {targetPointConj && (
                  <g opacity={0.4}>
                    <circle
                      cx={targetPointConj.x}
                      cy={targetPointConj.y}
                      r="7"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  </g>
                )}

                {/* Zeros (O) */}
                {zeros.map((z, idx) => {
                  const pt = toSvgCoords(z.re, z.im);
                  return (
                    <circle
                      key={`zero-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="7"
                      fill="oklch(0.2 0.03 250)"
                      stroke="#3b82f6"
                      strokeWidth="3.5"
                      className={info.draggable === "zero" ? "cursor-grab active:cursor-grabbing hover:scale-125 transition-transform" : undefined}
                    />
                  );
                })}

                {/* Poles (X) */}
                {poles.map((p, idx) => {
                  const pt = toSvgCoords(p.re, p.im);
                  return (
                    <g
                      key={`pole-${idx}`}
                      className={info.draggable === "pole" ? "cursor-grab active:cursor-grabbing hover:scale-125 transition-transform" : undefined}
                    >
                      <line
                        x1={pt.x - 6}
                        y1={pt.y - 6}
                        x2={pt.x + 6}
                        y2={pt.y + 6}
                        stroke={isStable ? "#eab308" : "#ef4444"}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <line
                        x1={pt.x + 6}
                        y1={pt.y - 6}
                        x2={pt.x - 6}
                        y2={pt.y + 6}
                        stroke={isStable ? "#eab308" : "#ef4444"}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}

                <text x="175" y="95" fill="var(--muted-foreground)" fontSize="9" fontFamily="monospace">
                  Re
                </text>
                <text x="105" y="22" fill="var(--muted-foreground)" fontSize="9" fontFamily="monospace">
                  Im
                </text>
              </svg>
            </div>
          </div>

          {/* 2. BEFORE / AFTER FEEDBACK (MAIN FEEDBACK MECHANISM) */}
          <div className="kitchen-card p-5 border-2 border-border/80 bg-card/95 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-primary">
                  Live Result
                </span>
                <h4 className="font-display text-sm font-black uppercase text-foreground">
                  Before / After Suspension
                </h4>
              </div>

              {/* Vibration Reduction Badge */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black uppercase text-muted-foreground">
                  Vibration reduced:
                </span>
                <span
                  className={cn(
                    "rounded-xl px-3 py-1 font-mono text-sm font-black shadow-xs",
                    accuracy >= 90
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : accuracy >= 70
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/40",
                  )}
                >
                  {accuracy}%
                </span>
              </div>
            </div>

            {/* Waveform Comparison Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* BEFORE */}
              <div className="rounded-xl border border-amber-500/40 bg-secondary/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-extrabold uppercase text-amber-400 flex items-center gap-1">
                    <span>🚚</span> BEFORE
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">Vibrating Signal</span>
                </div>
                <div className="rounded-lg bg-black/40 p-1.5 border border-border/50">
                  <MiniWave
                    samples={dishSignal}
                    height={55}
                    color="#f59e0b"
                  />
                </div>
              </div>

              {/* AFTER */}
              <div className="rounded-xl border border-primary/40 bg-secondary/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-extrabold uppercase text-primary flex items-center gap-1">
                    <span>🚚</span> AFTER
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">Smoother Signal</span>
                </div>
                <div className="rounded-lg bg-black/40 p-1.5 border border-border/50">
                  <MiniWave
                    samples={equalizedSignal}
                    height={55}
                    color="var(--signal)"
                  />
                </div>
              </div>
            </div>

            {/* Audio & Cart Preview Strip */}
            <div className="rounded-xl border border-border bg-secondary/50 p-3.5 flex flex-wrap items-center justify-between gap-4">
              {/* Animated Cart */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 flex items-center justify-center overflow-visible">
                  <svg width="60" height="40" viewBox="0 0 140 100" className="overflow-visible select-none">
                    <g
                      style={
                        isStable
                          ? ({
                              "--wobble-deg": `${accuracy >= 90 ? 2 : wobbleDeg}deg`,
                              animation: `cart-wobble ${wobbleDuration}s ease-in-out infinite`,
                              transformOrigin: "70px 80px",
                            } as React.CSSProperties)
                          : ({
                              animation: "cart-crash 1.4s ease-in forwards",
                              transformOrigin: "70px 80px",
                            } as React.CSSProperties)
                      }
                    >
                      {/* Dish */}
                      <ellipse cx={70} cy={38} rx={22} ry={7} fill="oklch(0.9 0.02 90)" stroke="oklch(0.6 0.02 90)" />
                      <circle cx={70} cy={36} r={9} fill="oklch(0.78 0.16 55)" />
                      {/* Tray */}
                      <rect x={38} y={44} width={64} height={10} rx={3} fill="oklch(0.52 0.07 45)" />
                      {/* Post */}
                      <rect x={66} y={54} width={8} height={16} fill="oklch(0.4 0.06 42)" />
                      {/* Wheels */}
                      <circle cx={52} cy={76} r={8} fill="oklch(0.24 0.03 250)" stroke="oklch(0.78 0.02 80)" strokeWidth={2} />
                      <circle cx={88} cy={76} r={8} fill="oklch(0.24 0.03 250)" stroke="oklch(0.78 0.02 80)" strokeWidth={2} />
                    </g>
                    {/* Floor line */}
                    <line x1={10} y1={86} x2={130} y2={86} stroke="var(--border)" strokeWidth={2} />
                  </svg>
                </div>
                <div className="font-mono text-[11px] leading-tight">
                  <p className="font-bold text-foreground">
                    {accuracy >= 90 ? "Smooth Roll" : isStable ? "Cart Rattling" : "Resonance Danger!"}
                  </p>
                  <p className="text-muted-foreground text-[10px]">
                    {accuracy >= 90
                      ? "Vibration cancelled! Safe to plate."
                      : "Tune notch to cancel vibration."}
                  </p>
                </div>
              </div>

              {/* Audio Listen Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {onPlayBeforeAudio && (
                  <button
                    type="button"
                    onClick={onPlayBeforeAudio}
                    className={cn(
                      "px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer border",
                      audioMode === "before" && isPlaying
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                        : "bg-secondary text-muted-foreground hover:text-foreground border-border",
                    )}
                  >
                    🔊 Hear Rattle
                  </button>
                )}

                {onToggleAudio && (
                  <button
                    type="button"
                    onClick={onToggleAudio}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 font-display text-xs font-black uppercase text-primary-foreground shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>{isPlaying && audioMode === "after" ? "Pause" : "🔊 Listen to result"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. COLLAPSIBLE SIGNAL LAB DETAILS
          Holds university CSE220 engineering material without cluttering gameplay
      ───────────────────────────────────────────────────────────── */}
      <details className="kitchen-card p-5 group cursor-pointer border border-border/80 transition-all bg-card/60">
        <summary className="flex items-center justify-between font-display text-xs font-black uppercase text-foreground select-none">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>⚙ Signal Lab Details ▸</span>
          </div>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-primary" />
        </summary>

        <div className="mt-4 pt-4 border-t border-border/60 space-y-5 text-muted-foreground font-mono text-xs">
          {/* Math Equations Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-secondary/40 p-4 space-y-2">
              <p className="font-bold text-foreground uppercase tracking-wide">
                Transfer Function H(z)
              </p>
              <p className="text-primary font-bold">{info.formula}</p>
              <p className="font-bold text-foreground uppercase tracking-wide pt-2">
                Difference Equation Recurrence
              </p>
              <p className="text-foreground/90">{info.recurrence}</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-secondary/40 p-4 space-y-2">
              <p className="font-bold text-foreground uppercase tracking-wide">
                Region of Convergence (ROC) & BIBO Stability
              </p>
              <p className="leading-relaxed">
                For this causal cart, the ROC is |z| &gt; r. The system is Bounded-Input
                Bounded-Output (BIBO) stable if and only if the ROC includes the unit circle (|z| = 1).
              </p>
              <p className="font-bold text-foreground uppercase tracking-wide pt-2">
                Impulse Response Divergence
              </p>
              <p className="leading-relaxed">
                h[n] = rⁿ·cos(ω₀·n)·u[n]. When r &lt; 1 this decays to 0. When r ≥ 1 it diverges or
                oscillates forever, resulting in infinite vibration buildup.
              </p>
            </div>
          </div>

          {/* Technical Frequency Response and FFT Plots */}
          <div className="grid gap-4 md:grid-cols-2 pt-2">
            {/* Frequency Response |H| */}
            <div className="rounded-xl border border-border/70 bg-secondary/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground uppercase">Frequency Response |H(e^jw)|</span>
                <span className="text-[10px] text-primary">0 to {Math.round(nyquistHz)} Hz</span>
              </div>
              <div className="flex justify-center py-1">
                <svg width="220" height="120" viewBox="0 0 200 120" className="overflow-visible select-none">
                  <rect x="0" y="0" width="200" height="110" fill="oklch(0.2 0.03 250)" rx="6" />
                  {/* Magnitude curve */}
                  <path
                    d={freqResponse
                      .map((val, i) => {
                        const x = (i / (freqResponse.length - 1)) * 200;
                        const y = 100 - (val / 4.0) * 90;
                        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke={isStable ? "var(--primary)" : "#ef4444"}
                    strokeWidth="2.5"
                  />
                  {/* Road marker */}
                  {vibrationOmega != null && (
                    <line
                      x1={(vibrationOmega / Math.PI) * 200}
                      y1="4"
                      x2={(vibrationOmega / Math.PI) * 200}
                      y2="106"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="3 2"
                    />
                  )}
                </svg>
              </div>
            </div>

            {/* Radix-2 FFT Spectrum */}
            <div className="rounded-xl border border-border/70 bg-secondary/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground uppercase">Radix-2 FFT Output Spectrum</span>
                <span className="text-[10px] text-muted-foreground">33 Bins</span>
              </div>
              <div className="h-24 flex items-end gap-1 border-b border-border/80 pb-1">
                {outputSpectrum.map((val, idx) => {
                  const hPct = Math.min(100, Math.max(4, val * 300));
                  return (
                    <div
                      key={`drawer-fft-${idx}`}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${hPct}%`,
                        backgroundColor: isAliasing
                          ? "oklch(0.62 0.22 25)"
                          : isStable
                            ? "var(--primary)"
                            : "oklch(0.72 0.16 55)",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
