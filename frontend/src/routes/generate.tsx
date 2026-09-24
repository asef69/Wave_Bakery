import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";

import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph } from "@/components/game/IngredientGlyph";
import { LabShell } from "@/components/game/LabShell";
import { MiniWave } from "@/components/game/MiniWave";
import { SignalAudioPlayer } from "@/lib/audio";
import {
  ALL_AVAILABLE_INGREDIENTS,
  computeIngredientSamples,
  getMathematicalSignal,
  type IngredientDetail,
  useActiveRecipe,
  useRecipeProgress,
  useSelectedIngredients,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/generate")({
  head: () => ({
    meta: [
      { title: "Signal Generation — WaveBakery" },
      {
        name: "description",
        content:
          "Select ingredients for your recipe and turn them into instrument signals in the WaveBakery Signal Generator.",
      },
      { property: "og:title", content: "Signal Generation — WaveBakery" },
      {
        property: "og:description",
        content: "Ingredient selection → instrument assignment → signal generation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GenerateScreen,
});

type CategoryFilter = "All" | "Produce" | "Protein" | "Bakery" | "Dairy" | "Pantry";

function GenerateScreen() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const [selectedIngredients, setSelectedIngredients] = useSelectedIngredients();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [activeIngredientName, setActiveIngredientName] = useState<string>(() => {
    return selectedIngredients[0]?.name ?? ALL_AVAILABLE_INGREDIENTS[0]!.name;
  });
  const [generated, setGenerated] = useState(false);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<SignalAudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      if (audioPlayer) audioPlayer.destroy();
    };
  }, [audioPlayer]);

  const handlePlayAudio = (clipId: string, samples: number[], freq: number) => {
    if (audioPlayer) audioPlayer.destroy();
    setPlayingClip(clipId);
    const p = new SignalAudioPlayer(
      {
        samples,
        frequency: freq,
        duration: 2.5,
      },
      (state) => {
        if (state.isEnded) {
          setPlayingClip((curr) => (curr === clipId ? null : curr));
        }
      },
    );
    setAudioPlayer(p);
    p.play();
  };

  // Active ingredient for the waveform generator preview
  const activeIng: IngredientDetail = useMemo(() => {
    return (
      ALL_AVAILABLE_INGREDIENTS.find(
        (i) => i.name.toLowerCase() === activeIngredientName.toLowerCase(),
      ) ?? ALL_AVAILABLE_INGREDIENTS[0]!
    );
  }, [activeIngredientName]);

  const activeMathSignal = useMemo(() => {
    return getMathematicalSignal(activeIng.name);
  }, [activeIng]);

  const idealSamples = useMemo(() => {
    return computeIngredientSamples({
      freq: activeIng.freq,
      washable: false,
      name: activeIng.name,
      seed: 0,
      noise: 0,
    });
  }, [activeIng]);

  const activeSamples = useMemo(() => {
    return computeIngredientSamples({
      freq: activeIng.freq,
      washable: activeIng.washable,
      name: activeIng.name,
      seed: 0,
      noise: generated ? (activeIng.washable ? 0.88 : 0.0) : 0.1,
    });
  }, [activeIng, generated]);

  // Filtered catalogue list
  const visibleCatalogue = useMemo(() => {
    if (categoryFilter === "All") return ALL_AVAILABLE_INGREDIENTS;
    return ALL_AVAILABLE_INGREDIENTS.filter((i) => i.category === categoryFilter);
  }, [categoryFilter]);

  const isSelected = (name: string) => {
    return selectedIngredients.some((i) => i.name.toLowerCase() === name.toLowerCase());
  };

  const toggleIngredient = (ing: IngredientDetail) => {
    setActiveIngredientName(ing.name);
    setGenerated(false);
    if (isSelected(ing.name)) {
      const updated = selectedIngredients.filter(
        (i) => i.name.toLowerCase() !== ing.name.toLowerCase(),
      );
      setSelectedIngredients(updated);
    } else {
      const updated = [...selectedIngredients, ing];
      setSelectedIngredients(updated);
    }
  };

  const washableSelected = selectedIngredients.filter((i) => i.washable);
  const hasWashables = washableSelected.length > 0;
  const nextRoute = hasWashables ? "/filtering" : "/mixing";
  const nextLabel = hasWashables ? "Go to Filtering →" : "Go to Mixing →";
  const canProceed = selectedIngredients.length > 0 && generated;

  const chefLine =
    selectedIngredients.length === 0
      ? `Welcome to Signal Generation! Check the Necessary Ingredients reference above, then choose your ingredients from the Available Catalogue below.`
      : !generated
        ? `You have ${selectedIngredients.length} ingredients selected. When you're ready, click "Generate Signal" to synthesize their instrument waveforms.`
        : activeIng.washable
          ? `Notice the high-frequency noise on ${activeIng.name}? Because it's a fresh washable produce item, it will need cleaning in the Filtering Lab.`
          : `Clean and crisp! ${activeIng.name} is directly usable and will bypass Filtering straight to Mixing.`;

  const handleGenerate = () => {
    if (selectedIngredients.length === 0) return;
    setGenerated(true);
    unlock(hasWashables ? 2 : 3);
  };

  return (
    <LabShell
      eyebrow="Station 01 · Signal generation"
      title="Ingredient → Signal"
      chefLine={chefLine}
      backTo="/kitchen"
      backLabel="← Back to Kitchen"
      nextTo={canProceed ? nextRoute : undefined}
      nextLabel={nextLabel}
    >
      {/* TOP RECIPE HUD */}
      <div className="kitchen-card mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-secondary/80 px-3 py-1.5 shadow-sm">
            <span className="text-lg" aria-hidden>
              {recipe.id === "burger"
                ? "🍔"
                : recipe.id === "cake"
                  ? "🧁"
                  : recipe.id === "noodles"
                    ? "🍜"
                    : recipe.id === "chicken-fry"
                      ? "🍗"
                      : "🥪"}
            </span>
            <div>
              <p className="font-mono text-[9px] font-extrabold tracking-[0.2em] text-primary uppercase">
                Active Recipe
              </p>
              <p className="font-display text-sm font-extrabold uppercase text-foreground">
                {recipe.name}
              </p>
            </div>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
              Player Selection Status
            </p>
            <p className="font-display text-sm font-bold tracking-[0.08em] text-foreground uppercase">
              {selectedIngredients.length} Items Selected (
              {washableSelected.length > 0
                ? `${washableSelected.length} Washable`
                : "All Ready to Mix"}
              )
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Inspecting ({activeIng.name}):
          </span>
          {activeIng.washable ? (
            <span className="rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1 font-mono text-[10px] font-extrabold text-primary uppercase">
              WASH FIRST · NOISY
            </span>
          ) : (
            <span className="rounded-md border border-signal/30 bg-signal/15 px-2.5 py-1 font-mono text-[10px] font-extrabold text-signal-alt uppercase">
              READY TO USE · CLEAN
            </span>
          )}
        </div>
      </div>

      {/* TOP SECTION: 1. NECESSARY INGREDIENTS (REFERENCE) + 2. SELECTED INGREDIENTS (PLAYER TRAY) */}
      <div className="mb-6 grid gap-6 md:grid-cols-[1fr_1.3fr]">
        {/* 1. NECESSARY INGREDIENTS (INFORMATION ONLY) */}
        <section className="kitchen-card border-2 border-primary/20 bg-[radial-gradient(ellipse_at_top_left,oklch(0.98_0.02_85),oklch(0.95_0.025_75))] p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <div>
                <p className="font-mono text-[9px] font-bold tracking-[0.22em] text-primary uppercase">
                  Recipe Reference · Information Only
                </p>
                <h3 className="font-display text-base font-extrabold uppercase text-foreground">
                  Necessary Ingredients
                </h3>
              </div>
            </div>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary uppercase">
              {recipe.name}
            </span>
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            The {recipe.name} recipe requires the following ingredients. Manually choose them from
            the catalogue below:
          </p>

          <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs font-bold text-foreground sm:grid-cols-2">
            {recipe.ingredients.map((ingName) => (
              <li
                key={ingName}
                className="flex items-center gap-2 rounded-lg bg-card/60 px-2.5 py-1.5 border border-border/60"
              >
                <span className="text-primary font-extrabold">•</span>
                <span className="uppercase tracking-wide">{ingName}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 2. SELECTED INGREDIENTS (ACTUAL PLAYER CHOICES) */}
        <section className="kitchen-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div>
              <p className="font-mono text-[9px] font-bold tracking-[0.22em] text-primary uppercase">
                Active Session
              </p>
              <h3 className="font-display text-base font-extrabold uppercase text-foreground">
                Selected Ingredients ({selectedIngredients.length})
              </h3>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground uppercase">
              {selectedIngredients.length === 0 ? "None chosen" : "Click to inspect · ✕ to remove"}
            </span>
          </div>

          {selectedIngredients.length === 0 ? (
            <div className="flex min-h-[90px] flex-col items-center justify-center py-4 text-center">
              <p className="font-display text-xs font-extrabold text-muted-foreground uppercase">
                No ingredients selected yet
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                Click ingredients in the Available Catalogue below to add them to your cooking
                session.
              </p>
            </div>
          ) : (
            <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
              {selectedIngredients.map((s) => (
                <div
                  key={s.name}
                  onClick={() => setActiveIngredientName(s.name)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 py-1.5 transition-all select-none",
                    s.name === activeIng.name
                      ? "border-primary bg-secondary shadow-sm"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <IngredientGlyph kind={s.kind ?? "generic"} className="h-5 w-5" />
                  <span className="font-display text-xs font-extrabold text-foreground">
                    {s.name}
                  </span>
                  {s.washable ? (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[7px] font-bold text-primary uppercase">
                      wash
                    </span>
                  ) : (
                    <span className="rounded bg-signal/20 px-1.5 py-0.5 font-mono text-[7px] font-bold text-signal-alt uppercase">
                      ready
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleIngredient(s);
                    }}
                    className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-black/15 hover:text-foreground"
                    title="Remove ingredient"
                    aria-label={`Remove ${s.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MAIN BODY: 3. AVAILABLE INGREDIENTS CATALOGUE + 4. SIGNAL GENERATOR PREVIEW */}
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* 3. AVAILABLE INGREDIENTS CATALOGUE */}
        <section className="kitchen-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-primary uppercase">
                Ingredient Selection Interface
              </p>
              <h2 className="font-display text-xl font-extrabold tracking-wide text-foreground uppercase">
                Available Ingredients Catalogue
              </h2>
            </div>
            <span className="rounded-full border border-border bg-secondary/60 px-3 py-1 font-mono text-[9px] font-bold text-primary uppercase">
              {selectedIngredients.length} Selected
            </span>
          </div>

          {/* Category Filter Chips */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(["All", "Produce", "Protein", "Bakery", "Dairy", "Pantry"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase transition-colors",
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Catalogue Grid */}
          <div className="mt-5 grid max-h-[28rem] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {visibleCatalogue.map((i) => {
              const active = i.name === activeIng.name;
              const selected = isSelected(i.name);
              return (
                <div
                  key={i.name}
                  onClick={() => toggleIngredient(i)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-2xl border-2 p-3 transition-all select-none",
                    selected
                      ? "border-primary bg-secondary/90 shadow-sm"
                      : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/40",
                    active && "ring-2 ring-primary/50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card p-1 shadow-inner">
                      <IngredientGlyph kind={i.kind ?? "generic"} className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="font-display text-sm font-extrabold text-foreground">
                        {i.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                          {getMathematicalSignal(i.name)
                            ? `${getMathematicalSignal(i.name)!.waveformType} wave`
                            : i.instrument}
                        </span>
                        {i.washable ? (
                          <span className="rounded bg-primary/20 px-1 py-0.2 font-mono text-[8px] font-bold text-primary uppercase">
                            wash
                          </span>
                        ) : (
                          <span className="rounded bg-signal/20 px-1 py-0.2 font-mono text-[8px] font-bold text-signal-alt uppercase">
                            ready
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider uppercase transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground font-extrabold"
                        : "border border-border bg-card text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {selected ? "✓ Added" : "+ Add"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. SIGNAL WAVEFORM PREVIEW */}
        <section className="grid content-start gap-5">
          <div className="kitchen-card p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-border bg-secondary p-1.5 shadow-inner">
                  <IngredientGlyph kind={activeIng.kind ?? "generic"} className="h-9 w-9" />
                </div>
                <div>
                  <p className="font-mono text-[9px] tracking-[0.2em] text-primary uppercase">
                    Previewing Ingredient
                  </p>
                  <h3 className="font-display text-2xl font-extrabold text-foreground">
                    {activeIng.name}
                  </h3>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                  {activeMathSignal ? "Signal Type" : "Instrument"}
                </p>
                <p className="font-display text-lg font-bold text-foreground">
                  {activeMathSignal
                    ? `${activeMathSignal.waveformType.toUpperCase()} WAVE`
                    : activeIng.instrument}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {activeIng.washable
                ? "Fresh produce / washable ingredient — generates with high-frequency noise that will require filtering."
                : "Directly usable ingredient — generates clean and is ready for mixing without washing."}
            </p>
          </div>

          <div className="lab-panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
                  Ideal Reference Signal
                </p>
                <span className="font-mono text-[9px] tracking-[0.14em] text-signal/50 uppercase">
                  {activeMathSignal
                    ? `${activeMathSignal.waveformType} wave`
                    : activeIng.instrument}{" "}
                  ({activeIng.freq} Hz)
                </span>
              </div>
              <GameButton
                size="sm"
                variant="secondary"
                className="uppercase text-xs"
                onClick={() =>
                  handlePlayAudio(`ideal-${activeIng.name}`, idealSamples, activeIng.freq)
                }
              >
                {playingClip === `ideal-${activeIng.name}` ? "🔊 Playing..." : "▶ Play Reference"}
              </GameButton>
            </div>
            <MiniWave
              className="mt-3 border-0 p-0"
              frequency={activeIng.freq}
              samples={idealSamples}
              label={`${activeIng.name} · ${activeMathSignal ? `${activeMathSignal.waveformType} wave` : "pure tone"}`}
            />
          </div>

          <div className="lab-panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
                  {generated
                    ? activeIng.washable
                      ? "Generated Raw Signal (Noisy)"
                      : "Generated Raw Signal (Clean)"
                    : "Awaiting Generation"}
                </p>
                {generated ? (
                  <span
                    className={cn(
                      "font-mono text-[9px] font-bold uppercase",
                      activeIng.washable ? "text-primary" : "text-signal",
                    )}
                  >
                    {activeIng.washable ? "Needs Washing" : "Ready to Mix"}
                  </span>
                ) : null}
              </div>
              <GameButton
                size="sm"
                variant="lab"
                className="uppercase text-xs"
                onClick={() =>
                  handlePlayAudio(`raw-${activeIng.name}`, activeSamples, activeIng.freq)
                }
              >
                {playingClip === `raw-${activeIng.name}` ? "🔊 Playing..." : "▶ Play Raw Signal"}
              </GameButton>
            </div>
            <MiniWave
              className="mt-3 border-0 p-0"
              frequency={activeIng.freq}
              samples={activeSamples}
              noise={generated ? (activeIng.washable ? 0.88 : 0.0) : 0.1}
              color={generated && !activeIng.washable ? "var(--signal)" : "var(--signal-alt)"}
              label={`${activeIng.name} · raw delivery`}
            />
            <p className="mt-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              Noise level:{" "}
              {generated
                ? activeIng.washable
                  ? "68% · Noisy (Washable)"
                  : "0% · Clean (Directly Usable)"
                : "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <GameButton
              className="w-full uppercase text-xs sm:w-auto flex-1"
              disabled={selectedIngredients.length === 0}
              onClick={handleGenerate}
            >
              {generated ? "✓ Signals Generated" : "Generate Signal"}
            </GameButton>
            {generated && (
              <GameButton
                variant="lab"
                className="w-full uppercase text-xs sm:w-auto"
                onClick={() =>
                  handlePlayAudio(`active-${activeIng.name}`, activeSamples, activeIng.freq)
                }
              >
                <Volume2 className="mr-1.5 h-3.5 w-3.5" />▶ Play Signal Output
              </GameButton>
            )}
          </div>
        </section>
      </div>
    </LabShell>
  );
}
