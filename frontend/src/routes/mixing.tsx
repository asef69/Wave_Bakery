import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DragTutorialCue } from "@/components/game/DragTutorialCue";
import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph, type IngredientKind } from "@/components/game/IngredientGlyph";
import { SignalAudioPlayer } from "@/lib/audio";
import {
  computeMixedSignal,
  getMathematicalSignal,
  type IngredientDetail,
  recipes,
  recordStageAccuracy,
  savePipelineStageSignal,
  useActiveRecipe,
  useRecipeProgress,
  useSelectedIngredients,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mixing")({
  head: () => ({
    meta: [
      { title: "Mixing Lab — WaveBakery" },
      {
        name: "description",
        content:
          "Drop clean ingredient signals into the bowl and watch their waveforms add up into one mixed signal.",
      },
      { property: "og:title", content: "Mixing Lab — WaveBakery" },
      {
        property: "og:description",
        content: "Overlay the ingredient signals, then mix them into one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MixingLab,
});

type MixIngredient = {
  name: string;
  kind: IngredientKind;
  freq: number;
  amp: number;
  seed: number;
  trace: string;
};

const TRACE_COLORS = [
  "var(--trace-2)",
  "var(--trace-5)",
  "var(--trace-4)",
  "var(--trace-3)",
  "var(--trace-1)",
  "var(--primary-glow)",
  "var(--signal)",
];

function buildTrayIngredients(selected: IngredientDetail[]): MixIngredient[] {
  return selected.map((s, idx) => {
    const math = getMathematicalSignal(s.name);
    return {
      name: s.name,
      kind: (s.kind ?? "generic") as IngredientKind,
      freq: s.freq ?? 2 + (idx % 4) * 1.5,
      amp: math?.defaultAmplitude ?? 0.5 + (idx % 3) * 0.25,
      seed: (idx + 1) * 0.85,
      trace: TRACE_COLORS[idx % TRACE_COLORS.length]!,
    };
  });
}

const W = 1000;
const H = 320;
const MID = H / 2;

function getMixIngredientValue(ing: MixIngredient, t: number): number {
  const mathSignal = getMathematicalSignal(ing.name);
  if (mathSignal) {
    return mathSignal.evaluate(t, {
      frequency: ing.freq,
      amplitude: ing.amp,
      phase: ing.seed,
    });
  }
  return Math.sin(t * Math.PI * 2 * ing.freq + ing.seed) * ing.amp;
}

function singlePath(ing: MixIngredient, scale = 0.3) {
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 2) {
    const t = x / W;
    const val = getMixIngredientValue(ing, t);
    const y = MID - val * H * scale;
    pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Visual superposition: sums ingredient signal terms (mathematical or sinusoidal). */
function sumPath(list: MixIngredient[]) {
  const norm = Math.max(
    1,
    list.reduce((s, i) => s + i.amp, 0),
  );
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 2) {
    const t = x / W;
    let v = 0;
    for (const ing of list) {
      v += getMixIngredientValue(ing, t);
    }
    const y = MID - (v / norm) * H * 0.38;
    pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Oscilloscope frame: grid, axes and tick labels. */
function Scope({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="relative z-10 h-[24rem] w-full" aria-hidden>
      {Array.from({ length: 11 }).map((_, i) => (
        <line
          key={`v${i}`}
          x1={(i * W) / 10}
          y1={0}
          x2={(i * W) / 10}
          y2={H}
          stroke="var(--lab-grid)"
          strokeWidth="1"
          opacity={i % 5 === 0 ? 0.5 : 0.22}
        />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={(i * H) / 8}
          x2={W}
          y2={(i * H) / 8}
          stroke="var(--lab-grid)"
          strokeWidth="1"
          opacity={i === 4 ? 0.7 : 0.2}
        />
      ))}
      <line
        x1="0"
        y1={MID}
        x2={W}
        y2={MID}
        stroke="var(--signal)"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <text x="8" y="18" fill="var(--signal)" opacity="0.55" fontSize="13" fontFamily="monospace">
        +A
      </text>
      <text
        x="8"
        y={H - 8}
        fill="var(--signal)"
        opacity="0.55"
        fontSize="13"
        fontFamily="monospace"
      >
        −A
      </text>
      <text
        x={W - 46}
        y={MID - 10}
        fill="var(--signal)"
        opacity="0.55"
        fontSize="13"
        fontFamily="monospace"
      >
        time
      </text>
      {children}
    </svg>
  );
}

function MixingLab() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const [selectedIngredients] = useSelectedIngredients();
  const trayIngredients = useMemo(
    () => buildTrayIngredients(selectedIngredients),
    [selectedIngredients],
  );

  const [bowl, setBowl] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);
  const [mixed, setMixed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showDragCue, setShowDragCue] = useState(true);

  const total = trayIngredients.length;
  const inBowl = trayIngredients.filter((i) => bowl.includes(i.name));
  const allIn = inBowl.length === total;

  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      if (player) player.destroy();
    };
  }, [player]);

  const add = (name: string) => {
    setShowDragCue(false);
    if (mixed) return;
    setBowl((b) => (b.includes(name) ? b : [...b, name]));
    setPlaying(false);
    if (player) player.destroy();
  };
  const remove = (name: string) => {
    setShowDragCue(false);
    if (mixed) return;
    setBowl((b) => b.filter((n) => n !== name));
    setPlaying(false);
    if (player) player.destroy();
  };
  const reset = () => {
    setBowl([]);
    setMixed(false);
    setPlaying(false);
    if (player) player.destroy();
  };

  const handlePlayAudio = () => {
    if (inBowl.length === 0) return;
    if (player) player.destroy();
    const sig = computeMixedSignal(
      recipe.id,
      inBowl.map((i) => i.name),
    );
    const newPlayer = new SignalAudioPlayer({
      samples: sig.samples,
      frequency: sig.frequency,
      duration: 2.5,
    });
    newPlayer.play();
    setPlayer(newPlayer);
    setPlaying(true);
  };

  const handleMix = () => {
    const mixedSig = computeMixedSignal(
      recipe.id,
      inBowl.map((i) => i.name),
    );
    savePipelineStageSignal(recipe.id, "mixed", mixedSig);

    const recipeSet = new Set(recipe.ingredients.map((i) => i.toLowerCase()));
    const bowlSet = new Set(inBowl.map((i) => i.name.toLowerCase()));
    let matchCount = 0;
    for (const name of bowlSet) {
      if (recipeSet.has(name)) matchCount++;
    }
    const mixAcc = Math.round((matchCount / Math.max(1, recipeSet.size)) * 100);
    recordStageAccuracy("mixing", mixAcc);

    setMixed(true);
    setPlaying(false);
    unlock(4);
  };

  const chefLine = mixed
    ? "Perfect! The individual ingredient signals have been combined into one mixed signal."
    : allIn
      ? "Every trace is on the scope. Press MIX to combine them into one mixed signal."
      : inBowl.length === 0
        ? "Drop a clean ingredient in the bowl and watch its trace appear on the scope."
        : "Each dotted trace is an ingredient signal. The solid curve shows what we get when they are combined.";

  if (unlockedStep < 3) {
    return (
      <main className="relative min-h-screen bg-background">
        <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
        <div className="relative z-10 mx-auto max-w-4xl px-8 py-16 text-center">
          <div className="kitchen-card p-10">
            <span className="text-4xl" aria-hidden>
              🔒
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground uppercase">
              Station Locked: Mixing Lab
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete the previous steps first before combining ingredient signals.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to={recipe.washableIngredients.length > 0 ? "/filtering" : "/generate"}>
                <GameButton size="lg" className="uppercase">
                  Go to Previous Step →
                </GameButton>
              </Link>
              <Link to="/kitchen">
                <GameButton size="lg" variant="secondary" className="uppercase">
                  ← Back to Kitchen
                </GameButton>
              </Link>
            </div>
            <div className="mx-auto mt-8 max-w-md">
              <ChefFourier
                size="sm"
                float={false}
                message="Let's finish the earlier steps before we move on!"
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.1]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_70%)] opacity-[0.12]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[110rem] px-8 py-6">
        {/* TOP HUD */}
        <header className="lab-panel flex flex-wrap items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link to="/kitchen">
              <GameButton variant="secondary" size="sm">
                ← Back to Kitchen
              </GameButton>
            </Link>
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">
                Station 03 · Mixing
              </p>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-signal uppercase">
                Mixing Lab
              </h1>
              <p className="mt-1 font-mono text-[10px] tracking-[0.18em] text-signal/60 uppercase">
                objective — add every clean ingredient signal, then mix
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8">
            <dl className="font-mono text-[10px] tracking-[0.18em] text-signal/60 uppercase">
              <div className="flex gap-3">
                <dt>Recipe</dt>
                <dd className="font-display text-sm font-extrabold text-signal">{recipe.name}</dd>
              </div>
              <div className="mt-1 flex gap-3">
                <dt>Step</dt>
                <dd className="font-display text-sm font-extrabold text-primary">
                  {recipe.pipeline.indexOf("MIX") + 1} / {recipe.pipeline.length} · Mix
                </dd>
              </div>
            </dl>

            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-signal/70 uppercase">
                {mixed ? "mixed" : `${inBowl.length} / ${total} signals in bowl`}
              </p>
              <div className="mt-2 flex gap-1.5">
                {trayIngredients.map((t) => (
                  <span
                    key={t.name}
                    className="h-2.5 w-10 rounded-full border border-border"
                    style={{ background: bowl.includes(t.name) ? t.trace : "transparent" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[19rem_1fr]">
          {/* CLEAN INGREDIENT TRAY */}
          <section className="kitchen-card relative overflow-hidden p-5">
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-warm)] opacity-70"
              aria-hidden
            />
            <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
              Clean ingredient tray
            </p>
            <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
              drag a card into the bowl (or click add)
            </p>

            {showDragCue && bowl.length === 0 && (
              <div className="mt-3 flex justify-start">
                <DragTutorialCue
                  message="Drag this into the bowl!"
                  direction="down"
                  onDismiss={() => setShowDragCue(false)}
                />
              </div>
            )}

            <ul className="mt-4 grid gap-3">
              {trayIngredients.map((ing) => {
                const used = bowl.includes(ing.name);
                return (
                  <li key={ing.name}>
                    <div
                      draggable={!used && !mixed}
                      onDragStart={() => {
                        setShowDragCue(false);
                        setDragging(ing.name);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border-2 bg-secondary/40 p-3 transition-all",
                        used
                          ? "border-border/60 opacity-50"
                          : "cursor-grab border-border hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--shadow-warm-glow)] active:cursor-grabbing",
                        dragging === ing.name && "border-primary ring-2 ring-primary/40",
                      )}
                    >
                      <span className="rounded-xl border border-border bg-card p-1.5">
                        <IngredientGlyph kind={ing.kind} className="h-8 w-8" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-extrabold text-foreground">
                          {ing.name}
                        </p>
                        <p className="font-mono text-[9px] tracking-[0.18em] text-signal uppercase">
                          {used ? "✓ in bowl" : "✓ clean"}
                        </p>
                        <svg
                          viewBox={`0 0 ${W} ${H}`}
                          preserveAspectRatio="none"
                          className="mt-1 h-6 w-full"
                          aria-hidden
                        >
                          <path
                            d={singlePath(ing)}
                            fill="none"
                            stroke={ing.trace}
                            strokeWidth="12"
                            strokeDasharray="24 16"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      {!mixed ? (
                        <button
                          className="rounded-full border border-primary/50 px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-primary uppercase hover:bg-primary/10"
                          onClick={() => (used ? remove(ing.name) : add(ing.name))}
                        >
                          {used ? "✕" : "add"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5">
              <ChefFourier size="sm" float={false} message={chefLine} bubbleSide="right" />
            </div>
          </section>

          {/* BOWL + SCOPE */}
          <section className="grid content-start gap-6 xl:grid-cols-[24rem_1fr]">
            {/* BOWL */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setHovering(true);
              }}
              onDragLeave={() => setHovering(false)}
              onDrop={(e) => {
                e.preventDefault();
                setHovering(false);
                if (dragging) add(dragging);
                setDragging(null);
              }}
              className={cn(
                "kitchen-card relative overflow-hidden p-6 transition-all",
                hovering && "border-primary shadow-[var(--shadow-warm-glow)]",
              )}
            >
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[image:repeating-linear-gradient(90deg,oklch(0.38_0.06_50)_0px,oklch(0.38_0.06_50)_18px,oklch(0.34_0.055_48)_18px,oklch(0.34_0.055_48)_38px)] opacity-70"
                aria-hidden
              />
              <div className="relative flex flex-col items-center">
                <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
                  {mixed
                    ? "mixture combined"
                    : hovering
                      ? "release to add signal"
                      : "drag clean ingredients here"}
                </p>

                {/* the bowl */}
                <div
                  className={cn(
                    "relative mt-5 flex h-56 w-full items-end justify-center rounded-t-3xl rounded-b-[999px] border-4 border-primary/50 bg-[linear-gradient(to_bottom,oklch(0.30_0.03_60),oklch(0.24_0.02_60))] p-5 transition-all",
                    hovering && "scale-[1.02] border-dashed border-primary",
                  )}
                >
                  <span
                    className="pointer-events-none absolute inset-x-6 top-4 h-6 rounded-full bg-[image:var(--gradient-warm)] opacity-25 blur-md"
                    aria-hidden
                  />
                  {mixed ? (
                    <span className="mb-10 flex flex-col items-center gap-1">
                      <span className="text-3xl" aria-hidden>
                        🥣
                      </span>
                      <span className="font-display text-xs font-extrabold tracking-[0.2em] text-primary uppercase">
                        one signal
                      </span>
                    </span>
                  ) : inBowl.length === 0 ? (
                    <span className="mb-10 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                      bowl empty
                    </span>
                  ) : (
                    <div className="mb-6 flex flex-wrap items-end justify-center gap-2">
                      {inBowl.map((ing) => (
                        <span
                          key={ing.name}
                          className="flex flex-col items-center gap-1 rounded-2xl border bg-card/90 px-2.5 py-2 shadow-[var(--shadow-card)]"
                          style={{ borderColor: ing.trace }}
                        >
                          <IngredientGlyph kind={ing.kind} className="h-7 w-7" />
                          <span className="font-mono text-[9px] tracking-[0.12em] text-foreground uppercase">
                            {ing.name}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* checklist */}
                <ul className="mt-5 grid w-full gap-1.5">
                  {trayIngredients.map((ing) => {
                    const used = bowl.includes(ing.name);
                    return (
                      <li
                        key={ing.name}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] uppercase",
                          used
                            ? "bg-secondary text-foreground"
                            : "bg-secondary/30 text-muted-foreground",
                        )}
                      >
                        <span style={used ? { color: ing.trace } : undefined}>
                          {used ? "✓" : "○"}
                        </span>
                        {ing.name}
                      </li>
                    );
                  })}
                </ul>

                {/* MIX button under the bowl */}
                <GameButton
                  size="lg"
                  className="mt-5 w-full text-lg tracking-[0.3em] uppercase"
                  disabled={!allIn || mixed}
                  onClick={handleMix}
                >
                  {mixed ? "✓ Mixed" : "Mix"}
                </GameButton>
                {!allIn && !mixed ? (
                  <p className="mt-2 font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                    add all {total} ingredients to unlock mix
                  </p>
                ) : null}
              </div>
            </div>

            {/* ONE SHARED SCOPE */}
            <div className="lab-panel relative overflow-hidden p-5">
              <div className="lab-grid absolute inset-0 opacity-30" aria-hidden />
              <div className="relative z-10 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-extrabold tracking-[0.22em] text-signal uppercase">
                  {mixed ? "Mixed signal" : "Combined signal"}
                </h2>
                <span className="font-mono text-[10px] tracking-[0.16em] text-signal/70 uppercase">
                  {mixed
                    ? playing
                      ? "playing result"
                      : "combined signal (solid)"
                    : inBowl.length === 0
                      ? "awaiting ingredients"
                      : `${inBowl.length} ingredient traces (dashed) + combined signal (solid)`}
                </span>
              </div>

              <div className="relative">
                <Scope>
                  {/* individual traces — distinct colours, dashed/dotted (fade out after MIX) */}
                  <g
                    className={cn(
                      "transition-opacity duration-700",
                      mixed ? "opacity-0" : "opacity-100",
                    )}
                  >
                    {inBowl.map((ing, idx) => (
                      <path
                        key={ing.name}
                        d={singlePath(ing)}
                        fill="none"
                        stroke={ing.trace}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={idx % 2 === 0 ? "8 6" : "2 5"}
                        opacity="0.95"
                      />
                    ))}
                  </g>
                  {/* superposition — solid, dominant before and after MIX */}
                  {inBowl.length > 0 ? (
                    <path
                      d={sumPath(inBowl)}
                      fill="none"
                      stroke="var(--trace-mixed)"
                      strokeWidth={mixed ? 5 : 4.5}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                      opacity={1}
                      style={{ filter: "drop-shadow(0 0 8px var(--trace-mixed))" }}
                    />
                  ) : null}
                </Scope>

                {inBowl.length === 0 ? (
                  <p className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tracking-[0.2em] text-signal/60 uppercase">
                    no signal in the bowl yet
                  </p>
                ) : null}
              </div>

              {/* LEGEND */}
              <ul className="relative z-10 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                {!mixed
                  ? inBowl.map((ing, idx) => (
                      <li
                        key={ing.name}
                        className="flex items-center gap-2 rounded-full border border-signal/25 bg-[oklch(0.19_0.03_250)]/70 px-3 py-1 shadow-sm"
                      >
                        <span
                          className="h-0.5 w-7 rounded-full"
                          style={{
                            background:
                              idx % 2 === 0
                                ? `repeating-linear-gradient(90deg,${ing.trace} 0 6px,transparent 6px 11px)`
                                : `repeating-linear-gradient(90deg,${ing.trace} 0 2px,transparent 2px 5px)`,
                          }}
                          aria-hidden
                        />
                        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-lab-foreground uppercase">
                          {ing.name} <span className="text-signal/60 font-normal">(dashed)</span>
                        </span>
                      </li>
                    ))
                  : null}
                {inBowl.length > 0 ? (
                  <li className="flex items-center gap-2 rounded-full border border-[var(--trace-mixed)]/40 bg-[oklch(0.19_0.03_250)]/70 px-3 py-1 shadow-[0_0_12px_rgba(255,215,0,0.15)]">
                    <span
                      className="h-1 w-7 rounded-full"
                      style={{
                        background: "var(--trace-mixed)",
                        boxShadow: "0 0 8px var(--trace-mixed)",
                      }}
                      aria-hidden
                    />
                    <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-[var(--trace-mixed)] uppercase">
                      {mixed ? "mixed signal (solid)" : "combined signal (solid)"}
                    </span>
                  </li>
                ) : null}
              </ul>

              {/* instruction / description */}
              <p className="relative z-10 mt-3 font-mono text-[10px] tracking-[0.14em] text-signal/80 uppercase">
                {mixed
                  ? "Individual ingredient signals combined into one mixed signal."
                  : inBowl.length > 0
                    ? "Ingredient signals are shown as dotted traces. The solid curve shows their combined signal."
                    : "Drop clean ingredients into the bowl to preview their combined signal."}
              </p>

              {/* equation strip */}
              <p className="relative z-10 mt-2 font-mono text-[10px] tracking-[0.2em] text-signal/70 uppercase">
                {inBowl.length === 0
                  ? "signal 1 + signal 2 + … = combined signal"
                  : mixed
                    ? "signals added → one mixed signal"
                    : inBowl.map((i) => i.name).join(" + ") + " = combined"}
              </p>

              {/* CONTROLS */}
              <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-4">
                <p className="font-mono text-[10px] tracking-[0.2em] text-signal/70 uppercase">
                  status{" "}
                  <span
                    className={mixed ? "text-primary-glow font-bold" : "text-lab-foreground/60"}
                  >
                    {mixed
                      ? "mixed — ready to transform"
                      : allIn
                        ? "ready to mix"
                        : "incomplete mixture"}
                  </span>
                </p>
                <div className="flex flex-wrap gap-3">
                  <GameButton
                    variant="lab"
                    className="uppercase"
                    disabled={inBowl.length === 0}
                    onClick={handlePlayAudio}
                  >
                    ▶ {mixed ? "Play result" : "Play preview"}
                  </GameButton>
                  <GameButton
                    variant="secondary"
                    className="uppercase"
                    disabled={inBowl.length === 0}
                    onClick={reset}
                  >
                    Reset
                  </GameButton>
                  {mixed ? (
                    <Link to="/transform">
                      <GameButton className="uppercase">Go to Seasoning →</GameButton>
                    </Link>
                  ) : null}
                </div>
              </div>

              {mixed ? (
                <p className="relative z-10 mt-4 font-display text-lg font-extrabold tracking-[0.14em] text-primary uppercase">
                  ✓ Mixture complete
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
