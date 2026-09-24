import { Waves } from "lucide-react";
import type { WindowType, WindowOption } from "@/lib/beamforming";
import { WINDOW_OPTIONS } from "@/lib/beamforming";
import { cn } from "@/lib/utils";

interface WindowSelectorProps {
  selectedWindow: WindowType;
  onSelectWindow: (w: WindowType) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Draws a mini discrete SVG icon of the time-domain window shape w[n]
 */
function WindowShapeIcon({ type }: { type: WindowType }) {
  const points = 16;
  const height = 20;
  const width = 48;
  const vals: number[] = [];

  for (let n = 0; n < points; n++) {
    const N = points - 1;
    let w = 1.0;
    if (type === "hamming") {
      w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / N);
    } else if (type === "hann") {
      w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / N));
    } else if (type === "blackman") {
      w = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / N) + 0.08 * Math.cos((4 * Math.PI * n) / N);
    }
    vals.push(w);
  }

  const pathD = vals.reduce((acc, v, idx) => {
    const x = (idx / (points - 1)) * (width - 6) + 3;
    const y = height - v * (height - 6) - 3;
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, "");

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Baseline */}
      <line
        x1="2"
        y1={height - 2}
        x2={width - 2}
        y2={height - 2}
        stroke="currentColor"
        strokeWidth="0.8"
        strokeOpacity="0.3"
      />
    </svg>
  );
}

export function WindowSelector({
  selectedWindow,
  onSelectWindow,
  title = "Acoustic Windowing / Sidelobe Suppression",
  subtitle = "Trades mainlobe width for stopband/sidelobe rejection across both Fourier and spatial domains.",
  compact = false,
  className,
}: WindowSelectorProps) {
  return (
    <div
      className={cn("rounded-2xl border border-border/80 bg-secondary/40 p-4 shadow-sm", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-foreground uppercase">
          <Waves className="h-4 w-4 text-signal" />
          <span>{title}</span>
        </div>
        <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[9px] font-extrabold text-signal uppercase tracking-wider">
          Cross-Domain LTI Tool
        </span>
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WINDOW_OPTIONS.map((opt: WindowOption) => {
          const isSelected = selectedWindow === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectWindow(opt.id)}
              className={cn(
                "flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all duration-150 cursor-pointer",
                isSelected
                  ? "border-signal bg-signal/15 text-foreground shadow-xs ring-1 ring-signal/50"
                  : "border-border/80 bg-card/70 text-muted-foreground hover:border-primary/50 hover:bg-card",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-display text-xs font-extrabold text-foreground">
                    {opt.name.split(" ")[0]}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[8px] font-black uppercase",
                      isSelected ? "bg-signal text-black" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {opt.sidelobeLevelDb}
                  </span>
                </div>

                {!compact && (
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground leading-tight">
                    {opt.beamwidthNote}
                  </p>
                )}
              </div>

              <div
                className={cn(
                  "mt-2 flex items-center justify-center rounded-lg p-1 transition-colors",
                  isSelected
                    ? "bg-signal/20 text-signal"
                    : "bg-secondary/60 text-muted-foreground/70",
                )}
              >
                <WindowShapeIcon type={opt.id} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
