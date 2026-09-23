import type { ReactElement } from "react";

/**
 * Placeholder machine artwork for the Kitchen Hub scene.
 * Each machine is a flat 2D illustration (SVG) meant to be swapped for
 * final Figma assets later. No DSP — waveforms are decorative.
 */

export type MachineId = "generate" | "filter" | "mix" | "season" | "marinate" | "cook";

const wood = "oklch(0.52 0.07 45)";
const woodDark = "oklch(0.4 0.06 42)";
const metal = "oklch(0.78 0.02 80)";
const metalDark = "oklch(0.62 0.02 80)";
const panel = "oklch(0.24 0.035 250)";
const glass = "oklch(0.18 0.03 255)";

function Screen({
  x,
  y,
  w,
  h,
  wave,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  wave: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={glass}
        stroke="var(--signal)"
        strokeOpacity={0.45}
      />
      <path d={wave} fill="none" stroke="var(--signal)" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

/** Signal Generator: control panel + ingredient tray. */
function GenerateArt() {
  return (
    <g>
      <rect x={14} y={46} width={128} height={62} rx={12} fill={panel} />
      <rect x={14} y={46} width={128} height={10} rx={5} fill="var(--signal)" opacity={0.25} />
      <Screen x={24} y={62} w={64} h={34} wave="M28 84 Q38 62 48 84 T68 84 T84 78" />
      <circle cx={106} cy={72} r={9} fill={metal} stroke={metalDark} />
      <circle cx={106} cy={72} r={2.5} fill="var(--primary)" />
      <circle cx={128} cy={72} r={9} fill={metal} stroke={metalDark} />
      <circle cx={128} cy={72} r={2.5} fill="var(--primary)" />
      <rect x={100} y={88} width={34} height={8} rx={4} fill="var(--signal)" opacity={0.5} />
      {/* ingredient tray */}
      <rect x={40} y={112} width={76} height={12} rx={6} fill={wood} />
      <circle cx={58} cy={110} r={7} fill="oklch(0.72 0.16 35)" />
      <circle cx={78} cy={110} r={7} fill="oklch(0.82 0.14 120)" />
      <circle cx={98} cy={110} r={7} fill="oklch(0.85 0.14 90)" />
      {/* cable to tray */}
      <path d="M78 108 C78 104 78 102 78 100" stroke="var(--signal)" strokeWidth={2} fill="none" />
    </g>
  );
}

/** Filter machine: tall analysis screen with spectrum bars. */
function FilterArt() {
  const bars = [18, 30, 44, 26, 52, 34, 20, 12];
  return (
    <g>
      <rect x={18} y={30} width={120} height={82} rx={14} fill={panel} />
      <rect
        x={28}
        y={40}
        width={100}
        height={54}
        rx={7}
        fill={glass}
        stroke="var(--signal)"
        strokeOpacity={0.4}
      />
      {bars.map((b, i) => (
        <rect
          key={i}
          x={34 + i * 12}
          y={88 - b}
          width={8}
          height={b}
          rx={3}
          fill="var(--signal)"
          opacity={i > 4 ? 0.3 : 0.85}
        />
      ))}
      <rect x={28} y={99} width={62} height={7} rx={3.5} fill={metalDark} />
      <circle cx={116} cy={102} r={7} fill={metal} stroke={metalDark} />
      {/* funnel body */}
      <path d="M52 112 L104 112 L86 132 L70 132 Z" fill={metal} stroke={metalDark} />
      <rect x={70} y={130} width={16} height={8} rx={3} fill={woodDark} />
    </g>
  );
}

/** Mixing station: bowl on a stand with signal controls. */
function MixArt() {
  return (
    <g>
      <rect x={30} y={110} width={96} height={14} rx={7} fill={woodDark} />
      <rect x={100} y={44} width={26} height={70} rx={10} fill={panel} />
      <circle cx={113} cy={58} r={6} fill="var(--signal)" opacity={0.8} />
      <rect
        x={106}
        y={70}
        width={14}
        height={30}
        rx={7}
        fill={glass}
        stroke="var(--signal)"
        strokeOpacity={0.4}
      />
      <path
        d="M30 74 L100 74 L86 112 L44 112 Z"
        fill={metal}
        stroke={metalDark}
        strokeWidth={1.5}
      />
      <ellipse
        cx={65}
        cy={74}
        rx={35}
        ry={9}
        fill="oklch(0.88 0.06 80)"
        stroke={metalDark}
        strokeWidth={1.2}
      />
      <path d="M36 74 Q50 66 64 74 T92 74" fill="none" stroke="var(--signal)" strokeWidth={2.2} />
      {/* whisk */}
      <path d="M70 40 L70 66" stroke={metalDark} strokeWidth={3} />
      <path d="M64 66 Q70 52 76 66" fill="none" stroke={metalDark} strokeWidth={2} />
    </g>
  );
}

/** Seasoning station: shaker + amplitude dial. */
function SeasonArt() {
  return (
    <g>
      <rect x={24} y={104} width={108} height={14} rx={7} fill={woodDark} />
      {/* shakers */}
      <path d="M48 62 q10 -14 20 0 v40 h-20 z" fill="oklch(0.93 0.02 85)" stroke={metalDark} />
      <circle cx={54} cy={60} r={1.6} fill={metalDark} />
      <circle cx={62} cy={58} r={1.6} fill={metalDark} />
      <path d="M76 72 q8 -12 16 0 v30 h-16 z" fill="oklch(0.7 0.11 55)" stroke={woodDark} />
      {/* amplitude dial panel */}
      <rect x={98} y={54} width={38} height={48} rx={10} fill={panel} />
      <circle cx={117} cy={72} r={13} fill={glass} stroke="var(--signal)" strokeOpacity={0.5} />
      <path d="M117 72 L117 62" stroke="var(--signal)" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={104} y={90} width={26} height={6} rx={3} fill="var(--primary)" opacity={0.7} />
      {/* seasoning sparkle */}
      <path
        d="M58 104 l0 6 M64 104 l0 5 M52 104 l0 5"
        stroke="var(--primary)"
        strokeWidth={1.6}
        opacity={0.6}
      />
    </g>
  );
}

/** Marinating station: covered container + time dial. */
function MarinateArt() {
  return (
    <g>
      <rect x={26} y={112} width={104} height={13} rx={6} fill={woodDark} />
      <path
        d="M38 68 L112 68 L102 112 L48 112 Z"
        fill="oklch(0.86 0.05 200)"
        opacity={0.55}
        stroke={metalDark}
      />
      <path
        d="M44 92 Q60 84 76 92 T106 90 L102 112 L48 112 Z"
        fill="oklch(0.72 0.12 60)"
        opacity={0.75}
      />
      <ellipse cx={75} cy={68} rx={38} ry={8} fill={metal} stroke={metalDark} />
      <rect x={68} y={52} width={14} height={12} rx={5} fill={metalDark} />
      {/* timer dial */}
      <circle cx={112} cy={44} r={17} fill={panel} />
      <circle cx={112} cy={44} r={11} fill={glass} stroke="var(--signal)" strokeOpacity={0.5} />
      <path
        d="M112 44 L112 36 M112 44 L118 48"
        stroke="var(--signal)"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Cooking station: oven + stove with impulse readout. */
function CookArt() {
  return (
    <g>
      <rect x={16} y={52} width={128} height={80} rx={14} fill={wood} />
      <rect x={16} y={52} width={128} height={12} rx={6} fill={metal} />
      <rect
        x={28}
        y={72}
        width={80}
        height={46}
        rx={9}
        fill={glass}
        stroke="oklch(0.72 0.16 55)"
        strokeWidth={2}
      />
      <path
        d="M34 108 q10 -22 20 0 t20 -6 t20 4"
        fill="none"
        stroke="oklch(0.78 0.16 60)"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <ellipse cx={68} cy={116} rx={26} ry={6} fill="oklch(0.72 0.16 45)" opacity={0.45} />
      <circle cx={124} cy={80} r={9} fill={metal} stroke={metalDark} />
      <circle cx={124} cy={104} r={9} fill={metal} stroke={metalDark} />
      <circle cx={124} cy={80} r={2.5} fill="var(--primary)" />
      <circle cx={124} cy={104} r={2.5} fill="var(--signal)" />
      {/* pot on top */}
      <rect x={44} y={36} width={44} height={16} rx={5} fill={metalDark} />
      <ellipse cx={66} cy={36} rx={24} ry={6} fill={metal} />
      <path
        d="M56 28 q6 -10 12 -2"
        stroke="var(--muted-foreground)"
        strokeWidth={2}
        fill="none"
        opacity={0.6}
      />
    </g>
  );
}

const art: Record<MachineId, () => ReactElement> = {
  generate: GenerateArt,
  filter: FilterArt,
  mix: MixArt,
  season: SeasonArt,
  marinate: MarinateArt,
  cook: CookArt,
};

export function MachineArt({ id }: { id: MachineId }) {
  const Art = art[id];
  return (
    <svg viewBox="0 0 160 150" className="h-full w-full overflow-visible" aria-hidden>
      <ellipse cx={80} cy={140} rx={58} ry={8} fill="oklch(0.4 0.06 42)" opacity={0.22} />
      <Art />
    </svg>
  );
}
