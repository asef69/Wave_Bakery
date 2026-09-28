import chefFourier from "@/assets/chef-fourier.webp";
import { cn } from "@/lib/utils";

type ChefFourierProps = {
  /** Speech bubble copy. Omit to hide the bubble. */
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  float?: boolean;
  bubbleSide?: "left" | "right";
};

const sizes = {
  sm: "w-40",
  md: "w-64",
  lg: "w-[26rem]",
};

/**
 * Chef Fourier character slot. The <img> is a placeholder that can be swapped
 * for a final custom illustration without touching layout.
 */
export function ChefFourier({
  message,
  className,
  size = "md",
  float = true,
  bubbleSide = "left",
}: ChefFourierProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {message ? (
        <div
          className={cn(
            "kitchen-card relative max-w-xs px-6 py-4 text-center text-base font-semibold text-card-foreground",
            bubbleSide === "left" ? "self-start" : "self-end",
          )}
        >
          <span className="absolute inset-x-0 -top-px mx-auto h-px w-2/3 bg-[image:var(--gradient-warm)] opacity-60" />
          {message}
          <span
            className={cn(
              "absolute -bottom-2 h-4 w-4 rotate-45 border-r border-b border-border bg-card",
              bubbleSide === "left" ? "left-10" : "right-10",
            )}
          />
        </div>
      ) : null}
      <div className="relative">
        <span
          className="absolute inset-x-4 bottom-2 h-8 rounded-full bg-[radial-gradient(ellipse_at_center,var(--signal),transparent_70%)] opacity-40 blur-md"
          aria-hidden
        />
        <img
          src={chefFourier}
          alt="Chef Fourier, the robot chef guide"
          width={1024}
          height={1024}
          className={cn(
            "relative drop-shadow-[0_20px_35px_rgba(0,0,0,0.35)]",
            sizes[size],
            float && "animate-float",
          )}
        />
      </div>
    </div>
  );
}
