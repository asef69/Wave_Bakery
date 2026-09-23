import { Target, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeamTargetProps {
  targetAngle: number;
  isAligned: boolean;
  isDelivered?: boolean;
  className?: string;
  eaterName?: string;
}

export function BeamTarget({
  targetAngle,
  isAligned,
  isDelivered = false,
  className,
  eaterName = "Hungry Diner #4",
}: BeamTargetProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-between rounded-2xl border-2 p-4 transition-all duration-300 text-center select-none",
        isDelivered
          ? "border-emerald-500 bg-emerald-500/15 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
          : isAligned
            ? "border-signal-alt bg-signal-alt/15 shadow-[0_0_20px_rgba(72,187,120,0.25)] ring-2 ring-signal-alt/40"
            : "border-border/80 bg-secondary/50",
        className,
      )}
    >
      {/* Target Angle HUD Tag */}
      <div className="flex w-full items-center justify-between border-b border-border/50 pb-2">
        <span className="flex items-center gap-1 font-mono text-[9px] font-bold text-muted-foreground uppercase">
          <Target className="h-3 w-3 text-primary" />
          <span>Eater Destination</span>
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-[10px] font-extrabold",
            isAligned
              ? "border-signal-alt/50 bg-signal-alt/20 text-signal-alt"
              : "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          {targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`}
        </span>
      </div>

      {/* Eater Avatar / Plate Reticle */}
      <div className="relative my-3 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-border/80 bg-card shadow-inner">
        {/* Reticle Ring */}
        <div
          className={cn(
            "absolute inset-1 rounded-xl border border-dashed transition-all duration-300",
            isDelivered
              ? "border-emerald-500 animate-none"
              : isAligned
                ? "border-signal-alt animate-spin"
                : "border-border",
          )}
          style={{ animationDuration: "8s" }}
        />

        {/* Eater / Diner Character representation */}
        <div className="flex flex-col items-center">
          <span className="text-3xl" aria-hidden>
            {isDelivered ? "😋" : isAligned ? "🤩" : "🍽️"}
          </span>
        </div>

        {/* Lock Overlay Icon */}
        {isAligned && !isDelivered && (
          <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-signal-alt text-background shadow-xs">
            <Lock className="h-3 w-3" />
          </span>
        )}
        {isDelivered && (
          <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {/* Status Label */}
      <div>
        <p className="font-display text-sm font-extrabold text-foreground uppercase">{eaterName}</p>
        <p
          className={cn(
            "font-mono text-[10px] font-bold uppercase tracking-wider",
            isDelivered
              ? "text-emerald-500"
              : isAligned
                ? "text-signal-alt animate-pulse"
                : "text-muted-foreground",
          )}
        >
          {isDelivered
            ? "✓ Dish Received!"
            : isAligned
              ? "🎯 Target Locked!"
              : "Awaiting Beam Alignment"}
        </p>
      </div>
    </div>
  );
}
