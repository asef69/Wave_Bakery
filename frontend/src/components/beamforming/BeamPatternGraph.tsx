import { Activity, Target } from "lucide-react";
import type { BeamPatternPoint } from "@/lib/beamforming";
import { cn } from "@/lib/utils";

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
  // SVG coordinate dimensions
  const width = 500;
  const height = 180;
  const padding = { top: 20, right: 25, bottom: 30, left: 35 };

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
              Spatial Directivity Spectrum
            </p>
            <h4 className="font-display text-base font-extrabold text-foreground uppercase">
              Array Factor &amp; Beam Pattern
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span>Main Lobe: {steeredAngle > 0 ? `+${steeredAngle}°` : `${steeredAngle}°`}</span>
          </span>
          {targetAngle !== undefined && (
            <span
              className={cn(
                "flex items-center gap-1 font-bold",
                isAligned ? "text-signal-alt" : "text-signal",
              )}
            >
              <Target className="h-3 w-3" />
              <span>Target: {targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`}</span>
            </span>
          )}
        </div>
      </div>

      {/* SVG Graph */}
      <div className="relative mt-4 w-full overflow-hidden rounded-xl border border-signal/20 bg-[oklch(0.18_0.03_250)]/90 p-2 shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          aria-label="Beam Directivity Pattern Graph"
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
          {[0.25, 0.5, 0.75, 1.0].map((val) => {
            const y = scaleY(val);
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="oklch(0.35 0.03 250)"
                  strokeDasharray="2,2"
                  strokeWidth="0.8"
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  fill="oklch(0.65 0.04 250)"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {val.toFixed(2)}
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
                TARGET ({targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`})
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
        <div className="mt-2 flex justify-between border-t border-signal/15 pt-1.5 font-mono text-[9px] text-signal/70 uppercase">
          <span>-90° (Left Sidelobes)</span>
          <span>Relative Intensity (Normalized |E(θ)|)</span>
          <span>+90° (Right Sidelobes)</span>
        </div>
      </div>
    </div>
  );
}
