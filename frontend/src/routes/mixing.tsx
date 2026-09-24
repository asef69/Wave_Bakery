import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DragTutorialCue } from "@/components/game/DragTutorialCue";
import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph, type IngredientKind } from "@/components/game/IngredientGlyph";
import { SignalAudioPlayer } from "@/lib/audio";
import {
  api,
  computeMixedSignal,
  getMathematicalSignal,
  getRecipeRunSession,
  type IngredientDetail,
  recipes,
  recordStageAccuracy,
  savePipelineStageSignal,
  useActiveRecipe,
  useRecipeProgress,
  useSelectedIngredients,
} from "@/lib/recipes";
import {
  getFilteredIngredient,
  getRecipeIngredientSamples,
} from "@/lib/pipeline";
import { parametricPath, samplesToPath } from "@/lib/signals";
import { getCachedChickenAudio } from "@/lib/chicken-audio";
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

function buildTrayIngredients(
  selected: IngredientDetail[],
  allRecipeDetails: IngredientDetail[] = selected,
): MixIngredient[] {
  return selected.map((s, idx) => {
    const detailIndex = allRecipeDetails.findIndex(
      (d) => d.name.toLowerCase() === s.name.toLowerCase(),
    );
    const resolvedIdx = detailIndex >= 0 ? detailIndex : idx;
    const math = getMathematicalSignal(s.name);
    return {
      name: s.name,
      kind: (s.kind ?? "generic") as IngredientKind,
      freq: s.freq ?? 2 + (resolvedIdx % 4) * 1.5,
      amp: math?.defaultAmplitude ?? (0.5 + (resolvedIdx % 3) * 0.25),
      // Must match Signal Generation's phase (seed: 0) exactly — see the
      // identical note in filtering.tsx's activeQueue. A per-index phase
      // here made every ingredient's individual trace in the Mixing bowl a
      // rotated version of the shape Generate Signal showed for it.
      seed: 0,
      trace: TRACE_COLORS[resolvedIdx % TRACE_COLORS.length]!,
    };
  });
}

const W = 1000;
const H = 320;
const MID = H / 2;


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
  const effectiveIngredients = useMemo(
    () => (selectedIngredients.length > 0 ? selectedIngredients : recipe.ingredientDetails),
    [selectedIngredients, recipe.ingredientDetails],
  );
  const trayIngredients = useMemo(
    () => buildTrayIngredients(effectiveIngredients, recipe.ingredientDetails),
    [effectiveIngredients, recipe.ingredientDetails],
  );

  const ingredientSamplesMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const ing of trayIngredients) {
      const filtered = getFilteredIngredient(recipe.id, ing.name);
      if (filtered && filtered.length > 0) {
        map[ing.name] = filtered;
      } else {
        // Must match computeMixedSignal's own fallback noise (used for the
        // solid "combined" trace) exactly: a washable ingredient that
        // hasn't been through Filtering yet is still noisy everywhere, not
        // just in the combined trace. Omitting noise here left this
        // per-ingredient (dashed) trace clean while the combined trace it's
        // supposed to equal (for a single-ingredient bowl) was jagged/noisy
        // — two visibly different curves for what the legend calls the same
        // signal, reading as "two signals" overlaid instead of one.
        const detail = recipe.ingredientDetails.find(
          (d) => d.name.toLowerCase() === ing.name.toLowerCase(),
        );
        map[ing.name] = getRecipeIngredientSamples(recipe.id, ing.name, {
          freq: ing.freq,
          seed: ing.seed,
          noise: detail?.washable ? 0.85 : 0.0,
          sampleCount: 401,
        });
      }
    }
    return map;
  }, [recipe.id, trayIngredients]);

  const [bowl, setBowl] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);
  const [mixed, setMixed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showDragCue, setShowDragCue] = useState(true);

  const total = trayIngredients.length;
  const inBowl = trayIngredients.filter((i) => bowl.includes(i.name));
  const allIn = inBowl.length === total;

  const mixedSignal = useMemo(() => {
    if (inBowl.length === 0) return null;
    return computeMixedSignal(recipe.id, inBowl.map((i) => i.name));
  }, [recipe.id, inBowl]);

  // Once handleMix confirms the backend's real superposition, this holds
  // those exact samples so the post-mix graph displays the same signal that
  // was persisted for Seasoning — not the frontend-only preview.
  const [committedMixedSamples, setCommittedMixedSamples] = useState<number[] | null>(null);

  // The solid "combined" trace must render the exact signal that gets saved
  // for this stage and carried into Seasoning — not a separate geometric
  // superposition of parametric curves, which produces a visually different
  // shape for any bowl containing a parametric ingredient (lettuce, tomato,
  // onion, cucumber, carrot, egg, sauce) and made the Mixing Lab preview
  // disagree with what Seasoning showed next. Once handleMix has confirmed
  // the backend's real superposition, prefer that exact array.
  const superpositionPath = useMemo(() => {
    if (mixed && committedMixedSamples) {
      return samplesToPath(committedMixedSamples, W, H, 0.4);
    }
    if (!mixedSignal || inBowl.length === 0) return "";
    return samplesToPath(mixedSignal.samples, W, H, 0.4);
  }, [mixed, committedMixedSamples, mixedSignal, inBowl.length]);

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
    setCommittedMixedSamples(null);
    setPlaying(false);
    if (player) player.destroy();
  };

  const handlePlayAudio = () => {
    if (!mixedSignal || inBowl.length === 0) return;
    if (player) player.destroy();

    const isOnlyChicken = inBowl.length === 1 && inBowl[0]?.name.toLowerCase() === "chicken";
    const cachedChicken = getCachedChickenAudio();
    const newPlayer = new SignalAudioPlayer({
      samples: mixed && committedMixedSamples ? committedMixedSamples : mixedSignal.samples,
      frequency: mixedSignal.frequency,
      duration: isOnlyChicken && cachedChicken ? cachedChicken.duration : 2.5,
      audioBuffer: isOnlyChicken ? (cachedChicken?.buffer ?? null) : null,
    });
    newPlayer.play();
    setPlayer(newPlayer);
    setPlaying(true);
  };

  const handleMix = () => {
    if (!mixedSignal) return;

    const recipeSet = new Set(recipe.ingredients.map((i) => i.toLowerCase()));
    const bowlSet = new Set(inBowl.map((i) => i.name.toLowerCase()));
    let matchCount = 0;
    for (const name of bowlSet) {
      if (recipeSet.has(name)) matchCount++;
    }
    const mixAcc = Math.round((matchCount / Math.max(1, recipeSet.size)) * 100);
    recordStageAccuracy("mixing", mixAcc);

    // Persist the locally-computed mix immediately so the game never stalls
    // waiting on the network, then — when the bowl holds the full recipe and
    // a backend session exists — replace it with the backend's actual
    // superposition (stage_mix, a real sample-wise sum of every accepted,
    // server-filtered ingredient) so Seasoning receives the true backend
    // mixed result rather than a frontend-only approximation.
    savePipelineStageSignal(recipe.id, "mixed", mixedSignal);

    const session = getRecipeRunSession();
    const isFullRecipeBowl = bowlSet.size === recipeSet.size && matchCount === recipeSet.size;
    if (session?.backendSessionId && isFullRecipeBowl) {
      api
        .getStages(session.backendSessionId)
        .then((stages) => {
          if (!stages.mixed?.plot || stages.mixed.plot.length === 0) return;
          savePipelineStageSignal(recipe.id, "mixed", {
            recipeId: recipe.id,
            stage: "mixed",
            samples: stages.mixed.plot,
            sampleRate: stages.mixed.sample_rate ?? mixedSignal.sampleRate,
            duration: mixedSignal.duration,
            frequency: mixedSignal.frequency,
            timestamp: Date.now(),
            metadata: { source: "backend-stage-mix" },
          });
          setCommittedMixedSamples(stages.mixed.plot);
        })
        .catch((err) => {
          console.warn("Backend mix fetch error (keeping local mix):", err);
        });
    }

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
                        {getMathematicalSignal(ing.name)?.parametricCurve ? (
                          (() => {
                            const math = getMathematicalSignal(ing.name)!;
                            const isClosed = !["patty", "lettuce", "noodle"].some((k) =>
                              ing.name.toLowerCase().includes(k),
                            );
                            return (
                              <svg
                                viewBox={isClosed ? "0 0 100 100" : `0 0 ${W} ${H}`}
                                preserveAspectRatio={isClosed ? "xMidYMid meet" : "none"}
                                className="mt-1 h-7 w-full"
                                aria-hidden
                              >
                                <path
                                  d={parametricPath(
                                    isClosed ? 100 : W,
                                    isClosed ? 100 : H,
                                    math.parametricCurve!.generatePoints(isClosed ? 201 : 401),
                                    isClosed ? 8 : 16,
                                    isClosed,
                                  )}
                                  fill="none"
                                  stroke={ing.trace}
                                  strokeWidth={isClosed ? 6 : 10}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            );
                          })()
                        ) : (
                          <svg
                            viewBox={`0 0 ${W} ${H}`}
                            preserveAspectRatio="none"
                            className="mt-1 h-6 w-full"
                            aria-hidden
                          >
                            <path
                              d={samplesToPath(ingredientSamplesMap[ing.name] ?? [], W, H, 0.35)}
                              fill="none"
                              stroke={ing.trace}
                              strokeWidth="12"
                              strokeDasharray="24 16"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
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
                    {inBowl.map((ing, idx) => {
                      const math = getMathematicalSignal(ing.name);
                      if (math?.parametricCurve) {
                        const isClosed = !["patty", "lettuce", "noodle"].some((k) =>
                          ing.name.toLowerCase().includes(k),
                        );
                        if (!isClosed) {
                          // Open parametric ribbon/ruffle curve (Noodles, Lettuce, Beef Patty) spanning the oscilloscope
                          const pts = math.parametricCurve.generatePoints(601);
                          return (
                            <path
                              key={ing.name}
                              d={parametricPath(W, H, pts, 24, false)}
                              fill="none"
                              stroke={ing.trace}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={idx % 2 === 0 ? "10 6" : "4 6"}
                              opacity="0.95"
                            />
                          );
                        }

                        // Closed parametric contours (Egg, Tomato, Onion, Sauce)
                        const closedList = inBowl.filter((i) => {
                          const m = getMathematicalSignal(i.name);
                          return (
                            Boolean(m?.parametricCurve) &&
                            !["patty", "lettuce", "noodle"].some((k) =>
                              i.name.toLowerCase().includes(k),
                            )
                          );
                        });
                        const closedIdx = closedList.findIndex((i) => i.name === ing.name);
                        const totalClosed = closedList.length;
                        const pts = math.parametricCurve.generatePoints(601);

                        if (totalClosed <= 1) {
                          return (
                            <path
                              key={ing.name}
                              d={parametricPath(W, H, pts, 24, true)}
                              fill="none"
                              stroke={ing.trace}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={idx % 2 === 0 ? "10 6" : "4 6"}
                              opacity="0.95"
                            />
                          );
                        }

                        const slotWidth = W / totalClosed;
                        return (
                          <g
                            key={ing.name}
                            transform={`translate(${closedIdx * slotWidth}, 0)`}
                          >
                            <path
                              d={parametricPath(slotWidth, H, pts, 24, true)}
                              fill="none"
                              stroke={ing.trace}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={idx % 2 === 0 ? "10 6" : "4 6"}
                              opacity="0.95"
                            />
                          </g>
                        );
                      }

                      // 1D wave ingredients
                      return (
                        <path
                          key={ing.name}
                          d={samplesToPath(ingredientSamplesMap[ing.name] ?? [], W, H, 0.35)}
                          fill="none"
                          stroke={ing.trace}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray={idx % 2 === 0 ? "8 6" : "2 5"}
                          opacity="0.95"
                        />
                      );
                    })}
                  </g>

                  {/* combined/mixed signal — solid, dominant before and after MIX */}
                  {superpositionPath && inBowl.length > 0 ? (
                    <path
                      d={superpositionPath}
                      fill="none"
                      stroke="var(--trace-mixed)"
                      strokeWidth={mixed ? 5 : 4.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
