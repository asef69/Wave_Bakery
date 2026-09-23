import { Volume2 } from "lucide-react";
import type { SpeakerState } from "@/lib/beamforming";
import { cn } from "@/lib/utils";

interface SpeakerArrayProps {
  speakers: SpeakerState[];
  onToggleSpeaker?: (id: number) => void;
  className?: string;
  isRadiating?: boolean;
}

export function SpeakerArray({
  speakers,
  onToggleSpeaker,
  className,
  isRadiating = true,
}: SpeakerArrayProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-xs",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
            <Volume2 className="h-3.5 w-3.5" />
          </span>
          <p className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-primary uppercase">
            Acoustic Transducer Array ({speakers.length} Elements)
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px] text-muted-foreground uppercase">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Linear Array Spacing: d = λ/2</span>
        </div>
      </div>

      {/* Speaker elements row */}
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {speakers.map((s, idx) => {
          const isSelected = s.isActive;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggleSpeaker?.(s.id)}
              disabled={!onToggleSpeaker}
              className={cn(
                "relative flex flex-col items-center justify-between rounded-xl border-2 p-2.5 transition-all text-center select-none",
                onToggleSpeaker
                  ? "cursor-pointer hover:border-primary/60 hover:scale-[1.02]"
                  : "cursor-default",
                isSelected
                  ? "border-primary/60 bg-secondary/80 shadow-xs"
                  : "border-border/60 bg-secondary/30 opacity-50",
              )}
            >
              {/* Speaker Index */}
              <span className="font-mono text-[9px] font-bold text-muted-foreground uppercase">
                #{idx + 1}
              </span>

              {/* Speaker Icon & radiating animation */}
              <div className="relative my-2 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-inner">
                {isRadiating && isSelected && (
                  <span
                    className="absolute inset-0 rounded-xl border border-primary/50 animate-ping opacity-30"
                    style={{ animationDuration: "2s", animationDelay: `${idx * 0.15}s` }}
                  />
                )}
                <Volume2
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                />
              </div>

              {/* Phase Badge */}
              <div
                className={cn(
                  "rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight",
                  s.phase === 0
                    ? "border-border bg-secondary text-muted-foreground"
                    : s.phase > 0
                      ? "border-signal/40 bg-signal/10 text-signal"
                      : "border-primary/40 bg-primary/10 text-primary",
                )}
              >
                {s.phase > 0 ? `+${s.phase}°` : `${s.phase}°`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
