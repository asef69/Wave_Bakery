import { cn } from "@/lib/utils";

type MiniWaveProps = {
  className?: string;
  /** visual only — no DSP */
  amplitude?: number;
  frequency?: number;
  noise?: number;
  shift?: number;
  stretch?: number;
  color?: string;
  label?: string;
  height?: number;
  seed?: number;
  samples?: number[];
};

/** Waveform display for previews. If samples are provided, renders exact sample points. */
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
}: MiniWaveProps) {
  const width = 400;
  const mid = height / 2;
  const pts: string[] = [];
  if (samples && samples.length > 0) {
    const len = samples.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * width;
      const s = samples[i] ?? 0;
      const y = mid - s * height * 0.33;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  } else {
    for (let x = 0; x <= width; x += 3) {
      const t = ((x / width) * stretch - shift) * Math.PI * 2 * frequency;
      const n = noise ? Math.sin(x * 12.9898 + seed * 78.233) * noise * height * 0.16 : 0;
      const y = mid - Math.sin(t + seed) * amplitude * height * 0.33 + n;
      pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
    }
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
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="relative z-10 h-20 w-full"
        aria-hidden
      >
        <path
          d={pts.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
