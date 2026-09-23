import { Link } from "@tanstack/react-router";

import { MachineArt, type MachineId } from "@/components/game/KitchenMachines";
import { cn } from "@/lib/utils";

export type StationDef = {
  id: MachineId;
  label: string;
  purpose: string;
  to: string;
  chefLine: string;
  step: number;
};

type Props = {
  station: StationDef;
  active: boolean;
  done?: boolean;
  locked?: boolean;
  onHover: (id: MachineId | null) => void;
  onLockedClick?: () => void;
  className?: string;
};

/**
 * A physical machine standing in the kitchen. Not a card: transparent body,
 * illustrated art, warm floor light, glow + lift on hover.
 */
export function KitchenStation({
  station,
  active,
  done,
  locked,
  onHover,
  onLockedClick,
  className,
}: Props) {
  const handleClick = (e: React.MouseEvent) => {
    if (locked) {
      e.preventDefault();
      onLockedClick?.();
    }
  };

  return (
    <Link
      to={locked ? undefined : (station.to as any)}
      onClick={handleClick}
      aria-label={`${station.label} — ${locked ? "Locked: Complete previous steps first" : station.purpose}`}
      aria-disabled={locked}
      onMouseEnter={() => onHover(station.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(station.id)}
      onBlur={() => onHover(null)}
      className={cn(
        "group relative flex w-full flex-col items-center rounded-3xl px-2 pt-2 pb-1 outline-none transition-transform duration-200",
        locked
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:-translate-y-1.5 focus-visible:-translate-y-1.5",
        className,
      )}
    >
      {/* warm pool of light under the machine (only when unlocked) */}
      {!locked && (
        <span
          className="pointer-events-none absolute inset-x-2 bottom-3 h-10 rounded-[50%] bg-[radial-gradient(ellipse_at_center,oklch(0.82_0.13_65/45%),transparent_70%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      )}
      {!locked && (
        <span
          className={cn(
            "pointer-events-none absolute inset-x-6 top-4 bottom-8 rounded-[45%] blur-2xl transition-opacity duration-200",
            "bg-[radial-gradient(ellipse_at_center,var(--signal),transparent_70%)]",
            active
              ? "opacity-25"
              : "opacity-0 group-hover:opacity-20 group-focus-visible:opacity-20",
          )}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "relative h-44 w-full drop-shadow-[0_10px_16px_rgba(0,0,0,0.22)] transition-transform duration-300",
          locked ? "grayscale-[60%] opacity-45 contrast-75" : "group-hover:scale-[1.03]",
        )}
      >
        <MachineArt id={station.id} />
      </div>

      {/* hanging enamel sign */}
      <span className="relative mt-1 flex flex-col items-center">
        <span className="h-3 w-px bg-border" aria-hidden />
        <span
          className={cn(
            "rounded-full border-2 px-3 py-1 font-mono text-[10px] font-bold tracking-[0.18em] uppercase transition-colors",
            locked
              ? "border-border/50 bg-secondary/40 text-muted-foreground/60"
              : active
                ? "border-primary bg-[image:var(--gradient-warm)] text-primary-foreground"
                : done
                  ? "border-signal-alt/50 bg-card text-muted-foreground"
                  : "border-border bg-card text-secondary-foreground group-hover:border-primary/70 group-hover:text-primary",
          )}
        >
          {locked ? `🔒 ${station.label}` : station.label}
        </span>
        <span className="mt-1 text-[11px] text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          {locked ? "Complete previous steps first" : station.purpose}
        </span>
      </span>

      {locked ? (
        <span className="absolute -top-1 right-3 flex items-center gap-1 rounded-full border border-border/70 bg-card/90 px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase shadow-sm">
          <span>🔒</span> locked
        </span>
      ) : active ? (
        <span className="absolute -top-1 right-3 animate-pulse-glow rounded-full bg-[image:var(--gradient-warm)] px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] text-primary-foreground uppercase">
          next
        </span>
      ) : done ? (
        <span className="absolute -top-1 right-3 rounded-full border border-signal-alt/50 bg-card px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] text-signal-alt uppercase">
          ✓ done
        </span>
      ) : null}
    </Link>
  );
}
