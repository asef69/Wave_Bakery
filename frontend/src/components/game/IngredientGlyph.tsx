import { cn } from "@/lib/utils";

export type IngredientKind =
  | "lettuce"
  | "tomato"
  | "onion"
  | "cucumber"
  | "carrot"
  | "egg"
  | "cheese"
  | "butter"
  | "patty"
  | "chicken"
  | "noodles"
  | "bread"
  | "bun"
  | "flour"
  | "sugar"
  | "milk"
  | "salt"
  | "sauce"
  | "generic";

type Props = { kind?: IngredientKind | string; className?: string };

/** Handcrafted SVG ingredient icons for WaveBakery */
export function IngredientGlyph({ kind = "generic", className }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-10 w-10 shrink-0", className)} aria-hidden>
      {kind === "tomato" && (
        <>
          <circle cx="32" cy="38" r="19" fill="oklch(0.6 0.19 28)" />
          <circle cx="26" cy="32" r="5" fill="oklch(0.72 0.14 30)" opacity="0.6" />
          <path
            d="M32 20c-6-4-12-3-14 1 4 3 9 4 14 2 5 2 10 1 14-2-2-4-8-5-14-1z"
            fill="oklch(0.62 0.14 145)"
          />
          <path d="M32 14v7" stroke="oklch(0.5 0.12 145)" strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {kind === "lettuce" && (
        <>
          <circle cx="32" cy="36" r="20" fill="oklch(0.68 0.15 145)" />
          <path
            d="M14 34c6-9 14-13 18-13s12 4 18 13c-5 5-11 8-18 8s-13-3-18-8z"
            fill="oklch(0.8 0.15 140)"
            opacity="0.75"
          />
          <path
            d="M32 24v24M22 30l6 16M42 30l-6 16"
            stroke="oklch(0.9 0.09 130)"
            strokeWidth="2"
            opacity="0.7"
          />
        </>
      )}

      {kind === "onion" && (
        <>
          <ellipse cx="32" cy="38" rx="18" ry="19" fill="oklch(0.78 0.08 320)" />
          <ellipse
            cx="32"
            cy="38"
            rx="11"
            ry="13"
            fill="none"
            stroke="oklch(0.6 0.1 320)"
            strokeWidth="2"
          />
          <ellipse
            cx="32"
            cy="38"
            rx="5"
            ry="7"
            fill="none"
            stroke="oklch(0.6 0.1 320)"
            strokeWidth="2"
          />
          <path
            d="M28 19l4-9 4 9"
            fill="none"
            stroke="oklch(0.6 0.12 140)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}

      {kind === "cucumber" && (
        <>
          <rect x="20" y="10" width="24" height="46" rx="12" fill="oklch(0.55 0.14 150)" />
          <rect
            x="26"
            y="16"
            width="6"
            height="34"
            rx="3"
            fill="oklch(0.72 0.14 148)"
            opacity="0.7"
          />
          <circle cx="38" cy="24" r="2" fill="oklch(0.85 0.08 140)" />
          <circle cx="36" cy="40" r="2" fill="oklch(0.85 0.08 140)" />
        </>
      )}

      {kind === "carrot" && (
        <>
          <path d="M32 58L20 26c7-5 17-5 24 0L32 58z" fill="oklch(0.68 0.17 55)" />
          <path
            d="M26 34h12M28 42h9"
            stroke="oklch(0.55 0.14 45)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M32 24V10M32 16l8-5M32 16l-8-5"
            stroke="oklch(0.6 0.13 145)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}

      {kind === "egg" && (
        <>
          <ellipse cx="32" cy="38" rx="20" ry="16" fill="oklch(0.96 0.02 90)" />
          <circle cx="32" cy="36" r="10" fill="oklch(0.82 0.18 80)" />
          <circle cx="29" cy="33" r="3" fill="oklch(0.94 0.08 85)" opacity="0.8" />
        </>
      )}

      {kind === "cheese" && (
        <>
          <path d="M12 46l38-4L40 18 12 46z" fill="oklch(0.85 0.16 85)" />
          <path d="M50 42l-10-24v24l10 0z" fill="oklch(0.76 0.16 75)" />
          <circle cx="26" cy="38" r="4" fill="oklch(0.75 0.15 75)" />
          <circle cx="36" cy="32" r="3" fill="oklch(0.75 0.15 75)" />
          <circle cx="28" cy="26" r="2.5" fill="oklch(0.75 0.15 75)" />
        </>
      )}

      {kind === "butter" && (
        <>
          <polygon points="14,42 42,42 52,30 24,30" fill="oklch(0.88 0.14 95)" />
          <polygon points="14,42 42,42 42,50 14,50" fill="oklch(0.78 0.14 85)" />
          <polygon points="42,42 52,30 52,38 42,50" fill="oklch(0.72 0.14 80)" />
        </>
      )}

      {(kind === "patty" || kind === "beef-patty") && (
        <>
          <ellipse cx="32" cy="36" rx="22" ry="15" fill="oklch(0.42 0.08 45)" />
          <ellipse cx="32" cy="34" rx="22" ry="14" fill="oklch(0.48 0.09 45)" />
          <path
            d="M20 30l6 8M28 28l6 10M36 28l6 10M44 30l4 8"
            stroke="oklch(0.3 0.05 40)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}

      {kind === "chicken" && (
        <>
          <ellipse cx="38" cy="28" rx="16" ry="13" fill="oklch(0.68 0.14 65)" />
          <circle cx="38" cy="28" r="12" fill="oklch(0.72 0.14 65)" />
          <path
            d="M26 36L14 48"
            stroke="oklch(0.92 0.03 85)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="13" cy="50" r="4" fill="oklch(0.92 0.03 85)" />
          <circle cx="18" cy="51" r="3.5" fill="oklch(0.92 0.03 85)" />
        </>
      )}

      {kind === "noodles" && (
        <>
          <path d="M14 34c0 14 36 14 36 0H14z" fill="oklch(0.55 0.12 25)" />
          <ellipse cx="32" cy="34" rx="18" ry="6" fill="oklch(0.65 0.12 25)" />
          <path
            d="M20 32c4-8 8-2 12-8s8 0 12-8"
            stroke="oklch(0.85 0.16 85)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M22 36c4-6 6-1 10-6s8 2 10-5"
            stroke="oklch(0.85 0.16 85)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M38 12l14-6"
            stroke="oklch(0.5 0.08 60)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}

      {kind === "bun" && (
        <>
          <path d="M12 36c0-14 40-14 40 0H12z" fill="oklch(0.74 0.14 65)" />
          <rect x="12" y="38" width="40" height="10" rx="4" fill="oklch(0.68 0.13 60)" />
          <circle cx="24" cy="28" r="1.5" fill="oklch(0.92 0.05 85)" />
          <circle cx="32" cy="24" r="1.5" fill="oklch(0.92 0.05 85)" />
          <circle cx="40" cy="27" r="1.5" fill="oklch(0.92 0.05 85)" />
        </>
      )}

      {kind === "bread" && (
        <>
          <path
            d="M14 26c0-8 10-12 18-12s18 4 18 12v22c0 4-4 6-8 6H22c-4 0-8-2-8-6V26z"
            fill="oklch(0.72 0.12 65)"
          />
          <path
            d="M18 28c0-6 8-9 14-9s14 3 14 9v18c0 2-2 4-5 4H23c-3 0-5-2-5-4V28z"
            fill="oklch(0.88 0.08 85)"
          />
        </>
      )}

      {kind === "flour" && (
        <>
          <path d="M18 24h28l4 28c0 4-4 6-8 6H22c-4 0-8-2-8-6L18 24z" fill="oklch(0.82 0.05 85)" />
          <ellipse cx="32" cy="24" rx="14" ry="4" fill="oklch(0.95 0.02 90)" />
          <path
            d="M26 38h12M32 32v12"
            stroke="oklch(0.6 0.1 65)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}

      {kind === "sugar" && (
        <>
          <rect
            x="16"
            y="24"
            width="16"
            height="16"
            rx="3"
            fill="oklch(0.92 0.03 220)"
            stroke="oklch(0.78 0.08 220)"
            strokeWidth="1.5"
          />
          <rect
            x="30"
            y="32"
            width="18"
            height="18"
            rx="3"
            fill="oklch(0.96 0.02 220)"
            stroke="oklch(0.78 0.08 220)"
            strokeWidth="1.5"
          />
          <path d="M22 18l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="oklch(0.8 0.15 220)" />
        </>
      )}

      {kind === "milk" && (
        <>
          <path
            d="M26 12h12v6H26zM22 24l4-6h12l4 6v28c0 4-3 6-6 6H28c-3 0-6-2-6-6V24z"
            fill="oklch(0.94 0.03 240)"
          />
          <rect x="25" y="32" width="14" height="14" rx="2" fill="oklch(0.7 0.14 240)" />
          <path d="M32 35v8M28 39h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {kind === "salt" && (
        <>
          <path
            d="M22 22h20l4 30c0 4-3 6-6 6H24c-3 0-6-2-6-6L22 22z"
            fill="oklch(0.88 0.04 250)"
            stroke="oklch(0.6 0.06 250)"
            strokeWidth="2"
          />
          <path d="M24 14h16v8H24z" fill="oklch(0.65 0.06 250)" />
          <circle cx="28" cy="18" r="1.5" fill="#fff" />
          <circle cx="32" cy="18" r="1.5" fill="#fff" />
          <circle cx="36" cy="18" r="1.5" fill="#fff" />
          <path
            d="M32 34v10M28 38h8"
            stroke="oklch(0.45 0.1 250)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}

      {kind === "sauce" && (
        <>
          <path d="M24 24h16l2 26c0 4-3 6-6 6H28c-3 0-6-2-6-6L24 24z" fill="oklch(0.55 0.18 28)" />
          <path d="M28 14h8v10h-8z" fill="oklch(0.8 0.14 80)" />
          <path d="M30 8h4v6h-4z" fill="oklch(0.55 0.18 28)" />
          <ellipse cx="32" cy="38" rx="5" ry="6" fill="oklch(0.7 0.18 35)" />
        </>
      )}

      {kind === "generic" && (
        <>
          <circle cx="32" cy="34" r="19" fill="oklch(0.7 0.1 70)" />
          <path
            d="M22 34c4-6 16-6 20 0"
            stroke="oklch(0.45 0.08 60)"
            strokeWidth="2.5"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}
