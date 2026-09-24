import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, Utensils } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph } from "@/components/game/IngredientGlyph";
import { IngredientSignalModal } from "@/components/game/IngredientSignalModal";
import {
  ALL_AVAILABLE_INGREDIENTS,
  getMathematicalSignal,
  type IngredientDetail,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pantry")({
  head: () => ({
    meta: [
      { title: "Pantry — WaveBakery" },
      {
        name: "description",
        content: "Explore available WaveBakery ingredients and inspect their raw acoustic signals.",
      },
      { property: "og:title", content: "Pantry — WaveBakery" },
      {
        property: "og:description",
        content: "Browse raw ingredients, listen to their signals, and inspect their waveforms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantryScreen,
});

type CategoryFilter = "All" | "Produce" | "Protein" | "Bakery" | "Dairy" | "Pantry";

function PantryScreen() {
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientDetail | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("All");

  const categories: CategoryFilter[] = ["All", "Produce", "Protein", "Bakery", "Dairy", "Pantry"];

  const filteredIngredients = useMemo(() => {
    if (activeCategory === "All") return ALL_AVAILABLE_INGREDIENTS;
    return ALL_AVAILABLE_INGREDIENTS.filter((ing) => ing.category === activeCategory);
  }, [activeCategory]);

  return (
    <main className="relative min-h-screen bg-background">
      {/* Modal Inspector for Selected Ingredient */}
      <IngredientSignalModal
        ingredient={selectedIngredient}
        onClose={() => setSelectedIngredient(null)}
      />

      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 sm:px-8">
        {/* Navigation & Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/kitchen-hub">
                <GameButton variant="secondary" size="sm">
                  ← Back to Kitchen
                </GameButton>
              </Link>
              <Link to="/menu">
                <GameButton variant="ghost" size="sm">
                  Main Menu
                </GameButton>
              </Link>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-0.5 font-mono text-[11px] font-extrabold tracking-wider text-primary uppercase">
                🥫 Stockroom
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Raw Ingredients &amp; Acoustic Profiles
              </span>
            </div>

            <h1 className="mt-2 font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground uppercase">
              PAN<span className="text-gradient-warm">TRY</span>
            </h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground sm:text-base">
              Explore your ingredients &amp; their signals
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-border bg-card px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              {ALL_AVAILABLE_INGREDIENTS.length} Ingredients Available
            </span>
          </div>
        </header>

        {/* Category Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-xl px-4 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Ingredients Grid */}
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredIngredients.map((ing) => (
              <button
                key={ing.name}
                onClick={() => setSelectedIngredient(ing)}
                className="kitchen-card group flex flex-col items-center justify-between p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
              >
                {/* Top status indicator */}
                <div className="w-full flex items-center justify-between font-mono text-[9px]">
                  <span className="text-muted-foreground uppercase">{ing.category}</span>
                  {ing.washable ? (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-500 font-bold uppercase">
                      Noisy
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-500 font-bold uppercase">
                      Clean
                    </span>
                  )}
                </div>

                {/* Ingredient Icon */}
                <div className="my-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-border/80 bg-secondary/80 p-2 shadow-inner transition-transform group-hover:scale-110">
                  <IngredientGlyph kind={ing.kind ?? "generic"} className="h-12 w-12" />
                </div>

                {/* Name & Instrument */}
                <div className="w-full">
                  <h3 className="font-display text-base font-extrabold uppercase text-foreground group-hover:text-primary transition-colors">
                    {ing.name}
                  </h3>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {getMathematicalSignal(ing.name)
                      ? getMathematicalSignal(ing.name)?.waveformType === "parametric"
                        ? "Parametric Signal"
                        : "Mathematical Signal"
                      : ing.instrument}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] font-bold text-primary">
                    {getMathematicalSignal(ing.name)?.parametricCurve
                      ? (getMathematicalSignal(ing.name)?.parametricCurve?.domainDisplay ??
                        "Parametric")
                      : getMathematicalSignal(ing.name)?.domainDisplay
                        ? getMathematicalSignal(ing.name)!.domainDisplay
                        : `${ing.freq} Hz`}
                  </p>
                </div>

                {/* Inspect action clue */}
                <div className="mt-3 w-full border-t border-border/50 pt-2 font-mono text-[9px] font-bold tracking-wider text-signal uppercase group-hover:text-primary transition-colors">
                  Inspect Signal →
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Bottom Dialogue */}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl border-2 border-border bg-card/60 p-6 backdrop-blur-sm">
          <ChefFourier
            size="sm"
            float={false}
            message="Every dish starts with raw ingredient frequencies. Click any ingredient card to inspect and listen to its time-domain signal!"
          />

          <div className="flex items-center gap-3">
            <Link to="/kitchen-hub">
              <GameButton size="lg" className="uppercase font-bold">
                ← Back to Kitchen
              </GameButton>
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
