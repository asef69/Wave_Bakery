import { Activity, Target, SlidersHorizontal, Info } from "lucide-react";
import type { BeamPatternPoint } from "@/lib/beamforming";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface BeamPatternGraphProps {
  data: BeamPatternPoint[];
  steeredAngle: number;
  targetAngle?: number | undefined;
  className?: string;
  isAligned?: boolean;
}

export function BeamPatternGraph({
  data,
  steeredAngle,
  targetAngle,
  className,
  isAligned = false,
}: BeamPatternGraphProps) {
  const [showFilterAnalogy, setShowFilterAnalogy] = useState(true);

  // SVG coordinate dimensions
  const width = 500;
  const height = 195;
  const padding = { top: 24, right: 25, bottom: 32, left: 38 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Map angle (-90 to +90) to X pixel
  const scaleX = (angle: number) => {
    const norm = (angle - -90) / 180;
    return padding.left + norm * plotWidth;
  };

  // Map intensity (0 to 1) to Y pixel
  const scaleY = (intensity: number) => {
    return padding.top + (1 - intensity) * plotHeight;
  };

  // Build SVG path data for the beam pattern curve
  const pathD = data.reduce((acc, pt, i) => {
    const x = scaleX(pt.angle);
    const y = scaleY(pt.intensity);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, "");

  // Build area fill path
  const areaD = `${pathD} L ${scaleX(90)} ${scaleY(0)} L ${scaleX(-90)} ${scaleY(0)} Z`;

  const targetX = targetAngle !== undefined ? scaleX(targetAngle) : null;
  const steeredX = scaleX(steeredAngle);

  // -3dB cutoff height (0.707 of peak 1.0)
  const yMinus3dB = scaleY(0.707);

  // Approximate half-power beamwidth bounds around steered angle
  const hpbwDeg = 16;
  const xPassbandLeft = scaleX(Math.max(-90, steeredAngle - hpbwDeg / 2));
  const xPassbandRight = scaleX(Math.min(90, steeredAngle + hpbwDeg / 2));

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm backdrop-blur-xs",
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-primary uppercase">
              Spatial Filter Analogy · Array Factor
            </p>
            <h4 className="font-display text-base font-extrabold text-foreground uppercase">
              Spatial Frequency Response |AF(θ)|
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilterAnalogy((prev) => !prev)}
            className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary hover:bg-primary/20 cursor-pointer"
          >
            <SlidersHorizontal className="h-2.5 w-2.5" />
            <span>{showFilterAnalogy ? "Hide Filter Analogy" : "Show Filter Analogy"}</span>
          </button>
        </div>
      </div>

      {/* Spatial Frequency Response Educational Legend */}
      {showFilterAnalogy && (
        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[9px] uppercase">
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-400 font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Passband (Main Lobe)</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-400 font-bold">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>-3dB Bandwidth</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-400 font-bold">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Stopband (Sidelobes)</span>
          </div>
        </div>
      )}

      {/* SVG Graph */}
      <div className="relative mt-3 w-full overflow-hidden rounded-xl border border-signal/20 bg-[oklch(0.18_0.03_250)]/90 p-2 shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          aria-label="Spatial Filter Frequency Response Graph"
        >
          <defs>
            <linearGradient id="beamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.45" />
              <stop offset="60%" stopColor="var(--primary-glow)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="curveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--signal)" />
              <stop offset="50%" stopColor="var(--primary-glow)" />
              <stop offset="100%" stopColor="var(--primary)" />
            </linearGradient>
          </defs>

          {/* Passband Spatial Window Shading */}
          {showFilterAnalogy && (
            <rect
              x={xPassbandLeft}
              y={padding.top}
              width={Math.max(4, xPassbandRight - xPassbandLeft)}
              height={plotHeight}
              fill="rgba(16, 185, 129, 0.12)"
              stroke="rgba(16, 185, 129, 0.35)"
              strokeDasharray="3,3"
            />
          )}

          {/* Grid lines */}
          {[-60, -30, 0, 30, 60].map((angle) => {
            const x = scaleX(angle);
            return (
              <g key={angle}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="oklch(0.35 0.03 250)"
                  strokeDasharray="2,2"
                  strokeWidth="0.8"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 14}
                  fill="oklch(0.65 0.04 250)"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {angle > 0 ? `+${angle}°` : `${angle}°`}
                </text>
              </g>
            );
          })}

          {/* Horizontal intensity gridlines */}
          {[0.25, 0.5, 0.707, 1.0].map((val) => {
            const y = scaleY(val);
            const isCutoff = val === 0.707;
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isCutoff ? "rgba(245, 158, 11, 0.6)" : "oklch(0.35 0.03 250)"}
                  strokeDasharray={isCutoff ? "4,2" : "2,2"}
                  strokeWidth={isCutoff ? "1.2" : "0.8"}
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  fill={isCutoff ? "rgba(245, 158, 11, 0.9)" : "oklch(0.65 0.04 250)"}
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {isCutoff ? "-3dB (0.71)" : val.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Target Angle Marker Line */}
          {targetX !== null && targetAngle !== undefined && (
            <g>
              <line
                x1={targetX}
                y1={padding.top - 6}
                x2={targetX}
                y2={height - padding.bottom}
                stroke={isAligned ? "var(--signal-alt)" : "var(--signal)"}
                strokeWidth="2"
                strokeDasharray="4,3"
                className="animate-pulse"
              />
              <circle
                cx={targetX}
                cy={padding.top - 6}
                r="4"
                fill={isAligned ? "var(--signal-alt)" : "var(--signal)"}
              />
              <text
                x={targetX}
                y={padding.top - 10}
                fill={isAligned ? "var(--signal-alt)" : "var(--signal)"}
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                PASSBAND TARGET ({targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`})
              </text>
            </g>
          )}

          {/* Current Steered Angle Marker Line */}
          <line
            x1={steeredX}
            y1={padding.top}
            x2={steeredX}
            y2={height - padding.bottom}
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeDasharray="2,2"
            opacity="0.8"
          />

          {/* Area Fill */}
          <path d={areaD} fill="url(#beamGradient)" />

          {/* Beam Pattern Outline */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#curveStroke)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Legend footer */}
        <div className="mt-2 flex flex-wrap justify-between border-t border-signal/15 pt-1.5 font-mono text-[9px] text-signal/80 uppercase">
          <span>-90° (Stopband Ripple)</span>
          <span>Spatial Filter Transfer Function |AF(θ)|</span>
          <span>+90° (Stopband Ripple)</span>
        </div>
      </div>

      {showFilterAnalogy && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5 font-mono text-[10px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">Filter Analogy:</strong> Steering element phases
            shifts the spatial passband center angle {"θ₀"}. Sidelobes are stopband ripples;
            choosing <strong>Hamming</strong> or <strong>Blackman</strong> windowing deepens
            stopband rejection down to -58 dB.
          </p>
        </div>
      )}
    </div>
  );
}
