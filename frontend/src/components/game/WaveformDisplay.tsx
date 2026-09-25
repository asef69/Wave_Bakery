import { useMemo } from "react";
import { samplesAlongCurvePath, type PipelineSignal } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type WaveformDisplayProps = {
  className?: string | undefined;
  /** visual placeholder only — no real DSP */
  variant?: "wave" | "spectrum" | undefined;
  animated?: boolean | undefined;
  label?: string | undefined;
  height?: number | undefined;
  square?: boolean | undefined;
  cursorProgress?: number | null | undefined;
  samples?: number[] | undefined;
  /** Pipeline signal whose Mixing curve `samples` should be drawn along. */
  curveRef?: PipelineSignal | null | undefined;
  parametricPoints?: Array<{ x: number; y: number }> | undefined;
  color?: string | undefined;
  signalParams?:
    | {
        frequency?: number | undefined;
        amplitude?: number | undefined;
        noise?: number | undefined;
        shift?: number | undefined;
        color?: string | undefined;
      }
    | undefined;
};

function wavePath(width: number, height: number, seed: number) {
  const mid = height / 2;
  const points: string[] = [];
  for (let x = 0; x <= width; x += 4) {
    const t = x / width;
    const y =
      mid +
      Math.sin(t * Math.PI * 6 + seed) * (height * 0.28) * Math.sin(t * Math.PI * 2) +
      Math.sin(t * Math.PI * 22 + seed * 2) * (height * 0.07);
    points.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function samplePath(width: number, height: number, samples: number[], padding = 0) {
  if (!samples || samples.length === 0) return "";
  const mid = height / 2;
  const points: string[] = [];
  const len = samples.length;
  const usableWidth = width - 2 * padding;
  for (let i = 0; i < len; i++) {
    const x = padding + (i / (len - 1)) * usableWidth;
    const s = samples[i] ?? 0;
    const y = mid - s * height * 0.33;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function parametricPath(
  width: number,
  height: number,
  points: Array<{ x: number; y: number }>,
  padding = 24,
  equalScale = false,
) {
  if (!points || points.length === 0) return "";
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const usableWidth = width - 2 * padding;
  const usableHeight = height - 2 * padding;

  if (equalScale) {
    // Exact equal numerical scale: 1 unit on X = 1 unit on Y
    const scale = Math.min(usableWidth / spanX, usableHeight / spanY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    const pathParts: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p) continue;
      // Invert Y because SVG y-coordinates increase downwards
      const px = centerX + (p.x - midX) * scale;
      const py = centerY - (p.y - midY) * scale;
      pathParts.push(`${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`);
    }
    return pathParts.join(" ");
  }

  const pathParts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    const px = padding + ((p.x - minX) / spanX) * usableWidth;
    const py = padding + ((maxY - p.y) / spanY) * usableHeight;
    pathParts.push(`${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  return pathParts.join(" ");
}

function getParametricPointSvg(
  point: { x: number; y: number },
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  padding = 24,
  equalScale = false,
) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const usableWidth = width - 2 * padding;
  const usableHeight = height - 2 * padding;

  if (equalScale) {
    const scale = Math.min(usableWidth / spanX, usableHeight / spanY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    return {
      px: centerX + (point.x - midX) * scale,
      py: centerY - (point.y - midY) * scale,
    };
  }

  return {
    px: padding + ((point.x - minX) / spanX) * usableWidth,
    py: padding + ((maxY - point.y) / spanY) * usableHeight,
  };
}

function cookedSignalPath(
  width: number,
  height: number,
  params: {
    frequency?: number | undefined;
    amplitude?: number | undefined;
    noise?: number | undefined;
    shift?: number | undefined;
    color?: string | undefined;
  },
  seed = 1,
) {
  const mid = height / 2;
  const { frequency = 4, amplitude = 1, noise = 0, shift = 0 } = params;
  const points: string[] = [];
  for (let x = 0; x <= width; x += 2) {
    const t = (x / width - shift) * Math.PI * 2 * frequency;
    const n = noise ? Math.sin(x * 12.9898 + seed * 78.233) * noise * height * 0.16 : 0;
    const y = mid - Math.sin(t + seed) * amplitude * height * 0.33 + n;
    points.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

/** Signal visualisation for the lab panels and inspection screen. */
export function WaveformDisplay({
  className,
  variant = "wave",
  animated = true,
  label,
  height = 140,
  square = false,
  cursorProgress,
  samples,
  curveRef,
  parametricPoints,
  color = "var(--signal)",
  signalParams,
}: WaveformDisplayProps) {
  const plotWidth = square ? 600 : 800;
  const plotHeight = square ? 600 : height;
  const isCursorActive = cursorProgress !== undefined && cursorProgress !== null;
  const clampProgress = isCursorActive ? Math.max(0, Math.min(1, cursorProgress)) : 0;
  const activeParametric =
    parametricPoints && parametricPoints.length > 0 ? parametricPoints : null;
  const activeSamples = samples && samples.length > 0 ? samples : null;
  const strokeColor = signalParams?.color ?? color;
  const samplesD = activeSamples
    ? curveRef
      ? samplesAlongCurvePath(activeSamples, curveRef, plotWidth, plotHeight, 0.33)
      : samplePath(plotWidth, plotHeight, activeSamples, square ? 24 : 0)
    : "";

  const currentParametricPoint = useMemo(() => {
    if (!activeParametric || !isCursorActive || activeParametric.length === 0) return null;
    const idx = Math.min(
      activeParametric.length - 1,
      Math.max(0, Math.round(clampProgress * (activeParametric.length - 1))),
    );
    const pt = activeParametric[idx];
    if (!pt) return null;
    return getParametricPointSvg(pt, activeParametric, plotWidth, plotHeight, 24, square);
  }, [activeParametric, isCursorActive, clampProgress, plotWidth, plotHeight, square]);

  return (
    <div className={cn("lab-panel relative overflow-hidden p-4 select-none", className)}>
      <div className="lab-grid absolute inset-0 opacity-40" aria-hidden />
      {label ? (
        <div className="relative z-10 flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-signal/70 uppercase truncate">
            {label}
          </span>
          {isCursorActive && (
            <span className="font-mono text-[10px] tracking-wider text-primary font-bold shrink-0 ml-2">
              {(clampProgress * 100).toFixed(0)}%
            </span>
          )}
        </div>
      ) : null}

      <div className={cn("relative z-10", square ? "w-full aspect-square" : "mt-2")}>
        {activeParametric ? (
          <div
            className={cn("relative w-full overflow-hidden", square ? "aspect-square" : "")}
            style={square ? undefined : { height }}
          >
            <svg
              viewBox={`0 0 ${plotWidth} ${plotHeight}`}
              className="h-full w-full"
              preserveAspectRatio={square ? "xMidYMid meet" : "none"}
              aria-hidden
            >
              {/* Midline reference */}
              <line
                x1="0"
                y1={plotHeight / 2}
                x2={plotWidth}
                y2={plotHeight / 2}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.4"
              />
              {square && (
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
                  <circle
                    cx={plotWidth / 2}
                    cy={plotHeight / 2}
                    r="2.5"
                    fill="var(--signal)"
                    opacity="0.5"
                  />
                </>
              )}

              {/* Underlying glow shadow from actual parametric curve */}
              <path
                d={parametricPath(
                  plotWidth,
                  plotHeight,
                  activeParametric,
                  square ? 24 : 16,
                  square,
                )}
                fill="none"
                stroke={strokeColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.25"
              />
              {/* Primary sharp waveform trace from actual parametric curve */}
              <path
                d={parametricPath(
                  plotWidth,
                  plotHeight,
                  activeParametric,
                  square ? 24 : 16,
                  square,
                )}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Glowing tracer bead following parametric curve (in square mode) */}
              {isCursorActive && currentParametricPoint && square && (
                <g>
                  <circle
                    cx={currentParametricPoint.px}
                    cy={currentParametricPoint.py}
                    r="8"
                    fill="var(--primary)"
                    opacity="0.4"
                    className="animate-ping"
                  />
                  <circle
                    cx={currentParametricPoint.px}
                    cy={currentParametricPoint.py}
                    r="5"
                    fill="var(--primary)"
                    opacity="0.85"
                  />
                  <circle
                    cx={currentParametricPoint.px}
                    cy={currentParametricPoint.py}
                    r="2.5"
                    fill="#ffffff"
                  />
                </g>
              )}
            </svg>

            {/* Synchronized Playback Cursor (for non-square / time domain) */}
            {isCursorActive && !square && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-30 transition-none"
                style={{ left: `${clampProgress * 100}%` }}
              >
                {/* Vertical cursor line */}
                <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-primary shadow-[0_0_12px_var(--primary),0_0_4px_#fff]" />
                {/* Top cursor head indicator */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-2 w-2 rotate-45 bg-primary shadow-sm" />
                </div>
                {/* Bottom cursor foot indicator */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-2 w-2 rotate-45 bg-primary shadow-sm" />
                </div>
              </div>
            )}
          </div>
        ) : activeSamples ? (
          <div
            className={cn("relative w-full overflow-hidden", square ? "aspect-square" : "")}
            style={square ? undefined : { height }}
          >
            <svg
              viewBox={`0 0 ${plotWidth} ${plotHeight}`}
              className="h-full w-full"
              preserveAspectRatio={square ? "xMidYMid meet" : "none"}
              aria-hidden
            >
              {/* Midline reference */}
              <line
                x1="0"
                y1={plotHeight / 2}
                x2={plotWidth}
                y2={plotHeight / 2}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.4"
              />
              {square && (
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
                  <circle
                    cx={plotWidth / 2}
                    cy={plotHeight / 2}
                    r="2.5"
                    fill="var(--signal)"
                    opacity="0.5"
                  />
                </>
              )}

              {/* Underlying glow shadow from actual samples */}
              <path
                d={samplesD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.25"
              />
              {/* Primary sharp waveform trace from actual samples */}
              <path
                d={samplesD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Synchronized Playback Cursor */}
            {isCursorActive && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-30 transition-none"
                style={{
                  left: square
                    ? `${((24 + clampProgress * (plotWidth - 48)) / plotWidth) * 100}%`
                    : `${clampProgress * 100}%`,
                }}
              >
                {/* Vertical cursor line */}
                <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-primary shadow-[0_0_12px_var(--primary),0_0_4px_#fff]" />
                {/* Top cursor head indicator */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-2 w-2 rotate-45 bg-primary shadow-sm" />
                </div>
                {/* Bottom cursor foot indicator */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-2 w-2 rotate-45 bg-primary shadow-sm" />
                </div>
              </div>
            )}
          </div>
        ) : signalParams ? (
          <div className="relative w-full overflow-hidden" style={square ? undefined : { height }}>
            <svg
              viewBox={`0 0 ${plotWidth} ${plotHeight}`}
              className="h-full w-full"
              preserveAspectRatio={square ? "xMidYMid meet" : "none"}
              aria-hidden
            >
              {/* Underlying glow shadow */}
              <path
                d={cookedSignalPath(plotWidth, plotHeight, signalParams, 1)}
                fill="none"
                stroke={signalParams.color ?? "var(--signal)"}
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.25"
              />
              {/* Primary sharp waveform trace */}
              <path
                d={cookedSignalPath(plotWidth, plotHeight, signalParams, 1)}
                fill="none"
                stroke={signalParams.color ?? "var(--signal)"}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Synchronized Playback Cursor */}
            {isCursorActive && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-30 transition-none"
                style={{ left: `${clampProgress * 100}%` }}
              >
                {/* Vertical cursor line */}
                <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-primary shadow-[0_0_12px_var(--primary),0_0_4px_#fff]" />
                {/* Top cursor head indicator */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-2 w-2 rotate-45 bg-primary shadow-sm" />
                </div>
                {/* Bottom cursor foot indicator */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="h-2 w-2 rotate-45 bg-primary shadow-sm" />
                </div>
              </div>
            )}
          </div>
        ) : variant === "wave" ? (
          <div className="relative w-full overflow-hidden" style={{ height }}>
            <div
              className={cn("flex w-[200%]", animated && !isCursorActive && "animate-wave-drift")}
            >
              {[0, 1].map((i) => (
                <svg
                  key={i}
                  viewBox={`0 0 ${plotWidth} ${plotHeight}`}
                  className="w-1/2 shrink-0"
                  style={{ height: plotHeight }}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d={wavePath(plotWidth, plotHeight, 0)}
                    fill="none"
                    stroke="var(--signal)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d={wavePath(plotWidth, plotHeight, 1.4)}
                    fill="none"
                    stroke="var(--primary-glow)"
                    strokeWidth="1.5"
                    opacity="0.5"
                  />
                </svg>
              ))}
            </div>

            {/* Synchronized Playback Cursor for generic wave */}
            {isCursorActive && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-30 transition-none"
                style={{ left: `${clampProgress * 100}%` }}
              >
                <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-primary shadow-[0_0_12px_var(--primary),0_0_4px_#fff]" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-end gap-1.5" style={{ height }}>
            {Array.from({ length: 34 }).map((_, i) => {
              const h = 18 + Math.abs(Math.sin(i * 0.55)) * 72 + (i % 3) * 5;
              return (
                <span
                  key={i}
                  className={cn(
                    "flex-1 rounded-t-sm bg-[image:linear-gradient(to_top,var(--signal-alt),var(--signal))]",
                    animated && "animate-pulse-glow",
                  )}
                  style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
