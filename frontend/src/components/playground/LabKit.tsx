/**
 * Small building blocks shared by the Signal Playground's finishing labs
 * (Precision Oven, System Delivery, Tasting, Full Chain).
 */
import type { ReactNode } from "react";

import { GameButton } from "@/components/game/GameButton";
import type { PlaygroundSource } from "@/lib/playground";
import { cn } from "@/lib/utils";

/** What every playground lab gets from the Playground screen. */
export interface PlaygroundLabProps {
  source: PlaygroundSource;
  /** Stable id of the active signal (used in audio clip ids). */
  signalId: string;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}

export function LabHeading({
  eyebrow,
  title,
  note,
}: {
  eyebrow: string;
  title: string;
  note?: ReactNode;
}) {
  return (
    <div>
      <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
        {eyebrow}
      </span>
      <h3 className="font-display text-xl font-extrabold text-foreground uppercase">{title}</h3>
      {note && (
        <p className="mt-1 font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
          {note}
        </p>
      )}
    </div>
  );
}

export function LabSlider({
  label,
  value,
  min,
  max,
  step,
  readout,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  readout?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-secondary/40 p-3 space-y-1.5",
        disabled && "opacity-50",
      )}
    >
      <div className="flex justify-between gap-3 font-mono text-xs">
        <span className="text-muted-foreground uppercase">{label}</span>
        <span className="font-bold text-foreground">{readout ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-grab accent-primary active:cursor-grabbing"
        aria-label={label}
      />
    </div>
  );
}

export function LabToggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition-all",
        checked
          ? "border-primary bg-secondary text-foreground shadow-sm"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
      )}
    >
      <span>
        <span className="block font-display text-xs font-extrabold uppercase">{label}</span>
        {hint && <span className="block font-mono text-[9px] uppercase">{hint}</span>}
      </span>
      <span className="font-mono text-[10px] font-bold uppercase">{checked ? "ON" : "OFF"}</span>
    </button>
  );
}

export function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-3 py-2">
      <p className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "font-display text-lg font-extrabold",
          tone === "good" && "text-emerald-500",
          tone === "bad" && "text-rose-500",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function PlayButton({
  clipId,
  label,
  playingLabel,
  samples,
  freq,
  onPlayAudio,
  playingClip,
  primary = false,
}: {
  clipId: string;
  label: string;
  playingLabel: string;
  samples: number[];
  freq: number;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
  primary?: boolean;
}) {
  return (
    <GameButton
      size="sm"
      variant={primary ? "lab" : "secondary"}
      className="uppercase text-xs"
      onClick={() => onPlayAudio(clipId, samples, freq)}
    >
      {playingClip === clipId ? `🔊 ${playingLabel}` : `▶ ${label}`}
    </GameButton>
  );
}
