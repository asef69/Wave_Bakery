import chefFourier from "@/assets/chef-fourier.png";
import { cn } from "@/lib/utils";

export type DragTutorialCueProps = {
  /** Speech bubble message */
  message?: string;
  /** Direction the arrow points towards the draggable handle */
  direction?: "down" | "up" | "left" | "right";
  /** Optional custom position classes or styles */
  className?: string;
  /** Callback if player clicks/taps on the cue itself to dismiss */
  onDismiss?: () => void;
};

/**
 * Temporary tutorial cue for draggable controls.
 * Shows Chef Fourier's portrait, a speech bubble, and a glowing animated arrow
 * pointing directly at the draggable handle/dot.
 */
export function DragTutorialCue({
  message = "Drag this!",
  direction = "down",
  className,
  onDismiss,
}: DragTutorialCueProps) {
  return (
    <div
      onClick={onDismiss}
      className={cn(
        "pointer-events-auto z-30 inline-flex items-center gap-2 transition-all select-none animate-in fade-in zoom-in-95 duration-300",
        direction === "down" && "flex-col",
        direction === "up" && "flex-col-reverse",
        direction === "right" && "flex-row",
        direction === "left" && "flex-row-reverse",
        className,
      )}
      role="tooltip"
      aria-label={`Tutorial hint: ${message}`}
    >
      {/* Speech Bubble + Chef Avatar Group */}
      <div className="flex items-center gap-2.5">
        {/* Chef Fourier Mini Portrait */}
        <div className="relative shrink-0">
          <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary bg-[oklch(0.96_0.03_85)] shadow-[0_0_12px_rgba(255,180,0,0.45)]">
            <img
              src={chefFourier}
              alt="Chef Fourier"
              className="h-full w-full object-cover object-top scale-125 translate-y-1"
            />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-signal shadow-sm" />
        </div>

        {/* Speech Bubble */}
        <div className="relative rounded-2xl border-2 border-primary/80 bg-[oklch(0.99_0.015_90)] px-3 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.3),0_0_14px_rgba(255,180,0,0.25)]">
          <span className="block font-display text-xs font-extrabold tracking-wide text-foreground uppercase">
            {message}
          </span>
          <span className="block font-mono text-[8px] font-bold tracking-[0.16em] text-primary uppercase">
            Chef Fourier Tip
          </span>
          {/* Subtle bubble pointer */}
          <span
            className={cn(
              "absolute h-2 w-2 rotate-45 border-primary/80 bg-[oklch(0.99_0.015_90)]",
              direction === "down" && "-bottom-1 left-4 border-r-2 border-b-2",
              direction === "up" && "-top-1 left-4 border-l-2 border-t-2",
              direction === "right" && "-right-1 top-3 border-r-2 border-t-2",
              direction === "left" && "-left-1 top-3 border-l-2 border-b-2",
            )}
            aria-hidden
          />
        </div>
      </div>

      {/* Glowing Animated Pointing Arrow */}
      <div
        className={cn(
          "flex items-center justify-center text-primary drop-shadow-[0_0_10px_rgba(255,180,0,0.95)]",
          (direction === "down" || direction === "up") && "animate-bounce",
          (direction === "left" || direction === "right") && "animate-pulse",
        )}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "text-primary",
            direction === "down" && "rotate-90",
            direction === "up" && "-rotate-90",
            direction === "left" && "rotate-180",
            direction === "right" && "",
          )}
          aria-hidden
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </div>
  );
}
