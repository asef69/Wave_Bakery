import { cn } from "@/lib/utils";

type DishGlyphProps = {
  dish: string;
  className?: string;
};

/**
 * Hand-drawn style SVG placeholder for dish artwork.
 * Swap these for the custom illustrated icons later — the API stays the same.
 */
export function DishGlyph({ dish, className }: DishGlyphProps) {
  return (
    <div
      className={cn(
        "relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-[calc(var(--radius)+8px)] border border-dashed border-primary/35 bg-[repeating-linear-gradient(135deg,var(--secondary)_0_12px,var(--muted)_12px_24px)]",
        className,
      )}
    >
      <span
        className="absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_bottom,var(--primary-glow),transparent_70%)] opacity-25"
        aria-hidden
      />
      <svg
        viewBox="0 0 120 90"
        className="relative h-3/4 w-3/4"
        role="img"
        aria-label={`${dish} illustration`}
      >
        <Art dish={dish} />
      </svg>
    </div>
  );
}

const warm = "oklch(0.63 0.17 45)";
const glow = "oklch(0.76 0.16 62)";
const cream = "oklch(0.94 0.05 90)";
const green = "oklch(0.72 0.14 145)";
const red = "oklch(0.62 0.2 25)";
const line = "oklch(0.32 0.06 45)";

function Art({ dish }: { dish: string }) {
  const stroke = { stroke: line, strokeWidth: 2.4, strokeLinejoin: "round" as const };

  switch (dish) {
    case "burger":
      return (
        <g {...stroke}>
          <path d="M20 40c0-13 9-22 40-22s40 9 40 22z" fill={glow} />
          <rect x="18" y="42" width="84" height="8" rx="4" fill={green} />
          <rect x="20" y="50" width="80" height="11" rx="5" fill={red} />
          <rect x="18" y="61" width="84" height="10" rx="5" fill={warm} />
          <path d="M22 71h76c0 8-8 12-38 12s-38-4-38-12z" fill={glow} />
        </g>
      );
    case "sandwich":
      return (
        <g {...stroke}>
          <path d="M14 62 60 16l46 46z" fill={cream} />
          <path d="M26 52h68l-6 8H32z" fill={green} />
          <path d="M32 60h56l-7 9H39z" fill={warm} />
          <path d="M18 68h84v8H18z" fill={cream} />
        </g>
      );
    case "cake":
      return (
        <g {...stroke}>
          <rect x="26" y="44" width="68" height="16" rx="4" fill={cream} />
          <rect x="20" y="60" width="80" height="18" rx="4" fill={warm} />
          <path d="M26 44c8 8 18-6 26 2s16-6 24 0 12-2 18 0v-6H26z" fill={glow} />
          <line x1="60" y1="20" x2="60" y2="40" />
          <path d="M60 12c5 5 3 10-1 10s-4-6 1-10z" fill={red} />
        </g>
      );
    case "noodles":
      return (
        <g {...stroke}>
          <path d="M22 50h76c0 18-14 28-38 28S22 68 22 50z" fill={cream} />
          <path
            d="M30 50c4-14 12-20 12-28M46 50c2-16 10-22 12-30M62 50c1-15 9-21 13-28M78 50c0-13 6-19 9-24"
            fill="none"
          />
          <circle cx="46" cy="60" r="7" fill={glow} />
          <path d="M64 56h18l-4 10H66z" fill={green} />
        </g>
      );
    default:
      return (
        <g {...stroke}>
          <path d="M24 62c-4-16 8-30 24-30 6-12 26-12 32 2 12 0 18 12 14 24z" fill={warm} />
          <path d="M36 40c4-4 10-4 14 0M56 34c5-3 11-1 14 3M64 50c5-2 10 0 12 4" fill="none" />
          <rect x="18" y="62" width="84" height="10" rx="5" fill={glow} />
        </g>
      );
  }
}
