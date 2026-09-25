import { cn } from "@/lib/utils";
import { parametricPath } from "@/lib/signals";
import { samplesAlongCurvePath, type PipelineSignal } from "@/lib/pipeline";

type MiniWaveProps = {
  className?: string | undefined;
  /** visual only — no DSP */
  amplitude?: number | undefined;
  frequency?: number | undefined;
  noise?: number | undefined;
  shift?: number | undefined;
  stretch?: number | undefined;
  color?: string | undefined;
  label?: string | undefined;
  height?: number | undefined;
  seed?: number | undefined;
  samples?: number[] | undefined;
  /** Pipeline signal whose Mixing curve `samples` should be drawn along. */
  curveRef?: PipelineSignal | null | undefined;
  parametricPoints?: Array<{ x: number; y: number }> | undefined;
  square?: boolean | undefined;
};

/** Waveform display for previews. If parametricPoints are provided, renders 2D parametric contour. If samples are provided, renders exact sample points. */
export function MiniWave({
  className,
  amplitude = 1,
  frequency = 4,
  noise = 0,
  shift = 0,
  stretch = 1,
  color = "var(--signal)",
  label,
  height = 90,
  seed = 1,
  samples,
  curveRef,
  parametricPoints,
  square = false,
}: MiniWaveProps) {
  const isSquare = square || Boolean(parametricPoints && parametricPoints.length > 0);
  const plotWidth = isSquare ? 200 : 400;
  const plotHeight = isSquare ? 200 : height;
  const mid = plotHeight / 2;
  let pathD = "";

  if (parametricPoints && parametricPoints.length > 0) {
    const pointsToRender =
      noise > 0
        ? parametricPoints.map((p, i) => {
            const nx = Math.sin(i * 12.9898 * 10 + seed * 78.233) * noise * 0.12;
            const ny = Math.sin(i * 13.4567 * 10 + seed * 53.123) * noise * 0.12;
            return { x: p.x + nx, y: p.y + ny };
          })
        : parametricPoints;
    pathD = parametricPath(plotWidth, plotHeight, pointsToRender, 14, true);
  } else if (samples && samples.length > 0 && curveRef) {
    pathD = samplesAlongCurvePath(samples, curveRef, plotWidth, plotHeight, 0.33);
  } else if (samples && samples.length > 0) {
    const len = samples.length;
    const pts: string[] = [];
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * plotWidth;
      const s = samples[i] ?? 0;
      const y = mid - s * plotHeight * 0.33;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    pathD = pts.join(" ");
  } else {
    const pts: string[] = [];
    for (let x = 0; x <= plotWidth; x += 3) {
      const t = ((x / plotWidth) * stretch - shift) * Math.PI * 2 * frequency;
      const n = noise ? Math.sin(x * 12.9898 + seed * 78.233) * noise * plotHeight * 0.16 : 0;
      const y = mid - Math.sin(t + seed) * amplitude * plotHeight * 0.33 + n;
      pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
    }
    pathD = pts.join(" ");
  }

  return (
    <div className={cn("lab-panel relative overflow-hidden px-3 py-2", className)}>
      <div className="lab-grid absolute inset-0 opacity-30" aria-hidden />
      {label ? (
        <span className="relative z-10 font-mono text-[9px] tracking-[0.2em] text-signal/70 uppercase">
          {label}
        </span>
      ) : null}
      <svg
        viewBox={`0 0 ${plotWidth} ${plotHeight}`}
        preserveAspectRatio={isSquare ? "xMidYMid meet" : "none"}
        className={cn("relative z-10", isSquare ? "mx-auto h-24 max-w-[160px]" : "h-20 w-full")}
        aria-hidden
      >
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={isSquare ? "3" : "2.5"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
