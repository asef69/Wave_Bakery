import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DifficultyModal } from "@/components/game/DifficultyModal";
import { DishGlyph } from "@/components/game/DishGlyph";
import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph } from "@/components/game/IngredientGlyph";
import { RecipeCard } from "@/components/game/RecipeCard";
import { StationCountdown } from "@/components/game/StationCountdown";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";
import {
  type RecipeDifficulty,
  enrichRecipeWithBestScore,
  getOrSaveExpectedSignal,
  initializeAllExpectedSignals,
  progressLabel,
  recipes,
  resetRecipeProgress,
  setActiveRecipe,
  startRecipeRun,
  useRecipeBestScores,
  type Recipe,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recipe-book")({
  head: () => ({
    meta: [
      { title: "Recipe Book — WaveBakery" },
      {
        name: "description",
        content:
          "Open the WaveBakery cookbook: pick a dish, review its ingredients and see the signal-processing pipeline you'll cook with.",
      },
      { property: "og:title", content: "Recipe Book — WaveBakery" },
      {
        property: "og:description",
        content: "Pick a dish and review the signal-processing pipeline before you start cooking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecipeBook,
});

function RecipeBook() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Pre-save expected signals for all recipes on cookbook load
  useEffect(() => {
    initializeAllExpectedSignals();
  }, []);

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  return (
    <main className="relative min-h-screen bg-background">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-8 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <Link to="/kitchen-hub">
              <GameButton variant="secondary" size="sm">
                ← Back to Kitchen
              </GameButton>
            </Link>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-foreground uppercase sm:text-5xl">
              RECIPE BOOK
            </h1>
            <p className="mt-1 font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
              Select a dish to start a new cooking session
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border bg-card px-4 py-1.5 font-mono text-[10px] font-bold text-muted-foreground uppercase">
              {recipes.length} Master Recipes
            </span>
          </div>
        </header>

        {selectedRecipe ? (
          <RecipeBriefing recipe={selectedRecipe} onBack={() => setSelectedRecipeId(null)} />
        ) : (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((r) => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  onCook={() => {
                    setSelectedRecipeId(r.id);
                  }}
                />
              ))}
            </div>

            <div className="mt-10 flex justify-end">
              <ChefFourier
                size="sm"
                bubbleSide="right"
                float={false}
                message="Which recipe should we process today?"
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function RecipeBriefing({ recipe, onBack }: { recipe: Recipe; onBack: () => void }) {
  const [isDifficultyModalOpen, setIsDifficultyModalOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<RecipeDifficulty>("medium");
  const [isCountingDown, setIsCountingDown] = useState(false);
  const navigate = useNavigate();
  const bestScores = useRecipeBestScores();
  const effectiveRecipe = enrichRecipeWithBestScore(recipe, bestScores);

  const expectedSignal = useMemo(() => getOrSaveExpectedSignal(recipe.id), [recipe.id]);

  const handleProceed = (difficulty: RecipeDifficulty) => {
    setSelectedDifficulty(difficulty);
    setIsDifficultyModalOpen(false);
    setIsCountingDown(true);
  };

  const handleCountdownComplete = () => {
    setActiveRecipe(recipe.id);
    resetRecipeProgress(recipe.id);
    startRecipeRun(recipe.id, selectedDifficulty);
    setIsCountingDown(false);
    navigate({ to: "/generate" });
  };

  return (
    <section className="mt-8 relative">
      {/* Centered Difficulty Selection Pop-up Modal */}
      <DifficultyModal
        recipe={recipe}
        isOpen={isDifficultyModalOpen}
        onClose={() => setIsDifficultyModalOpen(false)}
        onProceed={handleProceed}
      />

      {/* 3-2-1-GO Countdown Overlay */}
      {isCountingDown && <StationCountdown onComplete={handleCountdownComplete} />}

      <div
        className={cn(
          "transition-all duration-700 ease-out",
          isCountingDown && "filter blur-xl brightness-50 pointer-events-none select-none",
        )}
      >
        {/* Return button and volume header */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em] text-primary uppercase transition-colors hover:text-primary-glow cursor-pointer"
          >
            ← Return to Recipe List
          </button>
          <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
            WaveBakery Digital Cookbook · Volume 1
          </span>
        </div>

        {/* Facing Pages Hardbound Book Container */}
        <div className="relative rounded-[2.5rem] border-4 border-[oklch(0.55_0.07_45)] bg-[oklch(0.48_0.07_40)] p-2 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.45),0_8px_0_oklch(0.38_0.06_38)]">
          {/* Book Ribbon / Bookmark */}
          <div
            className="pointer-events-none absolute -top-3 left-1/2 z-20 h-14 w-8 -translate-x-1/2 rounded-b-md bg-[image:var(--gradient-warm)] shadow-md"
            aria-hidden
          />

          <div className="grid overflow-hidden rounded-[2rem] bg-card lg:grid-cols-2">
            {/* ================= LEFT PAGE: DISH & INGREDIENTS ================= */}
            <div className="relative flex flex-col justify-between border-b p-8 sm:p-10 lg:border-r lg:border-b-0 lg:border-border/80 bg-[radial-gradient(ellipse_at_top_left,oklch(0.99_0.015_90),oklch(0.96_0.02_78))]">
              <div
                className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-black/8 to-transparent lg:block"
                aria-hidden
              />

              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  <span>Page 0{recipe.pageNumber}</span>
                  <span className="font-bold text-primary">{recipe.difficulty} difficulty</span>
                  <span>{recipe.prepTime}</span>
                </div>

                <div className="mt-6">
                  <span className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">
                    Recipe Entry
                  </span>
                  <h2 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                    {recipe.name}
                  </h2>
                  <p className="mt-1 text-base font-semibold italic text-muted-foreground">
                    "{recipe.tagline}"
                  </p>
                </div>

                <div className="mt-6">
                  <DishGlyph dish={recipe.id} className="shadow-sm" />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                  <div className="rounded-xl border border-border bg-secondary/50 p-2.5 text-center">
                    <span className="block text-muted-foreground">Servings</span>
                    <span className="mt-0.5 font-display text-xs font-extrabold text-foreground">
                      {recipe.servings}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/50 p-2.5 text-center">
                    <span className="block text-muted-foreground">Steps</span>
                    <span className="mt-0.5 font-display text-xs font-extrabold text-foreground">
                      {recipe.steps.length} stations
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/50 p-2.5 text-center">
                    <span className="block text-muted-foreground">Status</span>
                    <span className="mt-0.5 font-display text-xs font-extrabold text-primary">
                      {progressLabel[effectiveRecipe.progress]}
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <span className="font-display text-sm font-extrabold tracking-wider text-foreground uppercase">
                      👨‍🍳 Chef's Recipe Profile
                    </span>
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      · Pantry Selection
                    </span>
                  </div>
                  <div className="mt-3 rounded-2xl border border-border bg-secondary/60 p-4 text-xs leading-relaxed">
                    <p className="font-display font-extrabold text-foreground text-sm">
                      {recipe.name} — Required Ingredients
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {recipe.ingredientDetails.map((ing) => (
                        <div
                          key={ing.name}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 shadow-xs"
                        >
                          <IngredientGlyph kind={ing.kind ?? "generic"} className="h-4 w-4" />
                          <span className="font-mono text-[10px] font-bold text-foreground uppercase">
                            {ing.name}
                          </span>
                          {ing.washable && (
                            <span className="rounded bg-primary/20 px-1 py-0.2 font-mono text-[7px] font-bold text-primary uppercase">
                              wash
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/10 p-2.5 font-mono text-[10px] text-primary">
                      💡 Tip: Fresh produce ingredients arrive noisy and require filtering, while
                      pantry and bakery ingredients arrive clean and ready to mix!
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-border/60 pt-3 text-right font-mono text-[10px] text-muted-foreground">
                WaveBakery Recipe Archive · {recipe.id}.dsp
              </div>
            </div>

            {/* ================= RIGHT PAGE: COOKING & SIGNAL INSTRUCTIONS ================= */}
            <div className="relative flex flex-col justify-between p-8 sm:p-10 bg-[radial-gradient(ellipse_at_top_right,oklch(0.99_0.015_90),oklch(0.96_0.02_78))]">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 bg-gradient-to-r from-black/8 to-transparent lg:block"
                aria-hidden
              />

              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  <span>Signal Pipeline</span>
                  <span>{recipe.pipeline.length} Operations</span>
                </div>

                {/* Signal Pipeline Waveform Flow */}
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">
                      Signal Processing Flow
                    </span>
                    <span className="font-mono text-[9px] font-bold text-muted-foreground uppercase">
                      Target {expectedSignal.frequency.toFixed(1)} Hz · Reference Spectrum
                    </span>
                  </div>
                  <div className="mt-3">
                    <WaveformDisplay
                      label={`${recipe.name} TARGET SIGNAL FLOW`}
                      samples={expectedSignal.samples}
                      color="var(--signal)"
                      signalParams={{
                        frequency: expectedSignal.frequency,
                        amplitude: 1.0,
                      }}
                    />
                  </div>
                </div>

                {/* Cooking Method Highlight Banner */}
                <div className="mt-6 rounded-2xl border-2 border-primary/40 bg-[linear-gradient(135deg,oklch(0.94_0.04_80),oklch(0.98_0.02_85))] dark:bg-[linear-gradient(135deg,oklch(0.22_0.03_255),oklch(0.17_0.025_255))] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-warm)] text-2xl shadow-sm">
                        {recipe.cookingMethod.icon}
                      </span>
                      <div>
                        <span className="font-mono text-[9px] tracking-[0.2em] text-primary uppercase">
                          Primary Cooking Method
                        </span>
                        <h4 className="font-display text-xl font-extrabold text-foreground">
                          {recipe.cookingMethod.name}
                        </h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                        Impulse Response
                      </span>
                      <p className="font-mono text-xs font-bold text-foreground">
                        {recipe.cookingMethod.ir}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recipe Steps List */}
                <div className="mt-6">
                  <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
                    Step-by-Step Cooking Guide
                  </p>
                  <div className="mt-3 space-y-3">
                    {recipe.steps.map((step) => (
                      <div
                        key={step.stepNumber}
                        className="rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-all hover:border-primary/50"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary font-mono text-base shadow-inner">
                            {step.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-1">
                              <span className="font-display text-sm font-extrabold uppercase text-foreground">
                                {step.stepNumber} · {step.action}
                              </span>
                              <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-muted-foreground">
                                {step.technicalLabel}
                              </span>
                            </div>
                            <p className="mt-1 font-display text-sm font-bold leading-snug text-foreground">
                              {step.instruction}
                            </p>

                            {step.targets && step.targets.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {step.targets.map((tgt) => (
                                  <span
                                    key={tgt.label}
                                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary uppercase"
                                  >
                                    <span className="text-muted-foreground">{tgt.label}:</span>{" "}
                                    {tgt.value}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions & Chef Fourier */}
              <div className="mt-8 pt-4">
                <div className="flex flex-col gap-4">
                  <ChefFourier
                    size="sm"
                    float={false}
                    bubbleSide="left"
                    message="Here's our recipe! Follow the signal instructions carefully, chef."
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <GameButton
                      size="lg"
                      className="flex-1 text-base tracking-[0.12em] uppercase"
                      onClick={() => setIsDifficultyModalOpen(true)}
                    >
                      Start Cooking →
                    </GameButton>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRecipe(recipe.id);
                        navigate({ to: "/briefing" });
                      }}
                      className="rounded-xl border border-primary/50 bg-primary/15 px-4 py-3 font-display text-sm font-extrabold uppercase text-primary transition-all hover:bg-primary hover:text-primary-foreground cursor-pointer shadow-xs"
                    >
                      Mission Briefing ⚡
                    </button>
                    <GameButton
                      size="lg"
                      variant="secondary"
                      className="uppercase"
                      onClick={onBack}
                    >
                      Back
                    </GameButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
