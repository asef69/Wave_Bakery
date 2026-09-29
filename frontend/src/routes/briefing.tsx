import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Volume2,
  CheckCircle2,
  Zap,
  Target,
  Utensils,
  Layers,
  Radio,
  Sliders,
  Filter,
} from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DishGlyph } from "@/components/game/DishGlyph";
import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph } from "@/components/game/IngredientGlyph";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";
import { SignalAudioPlayer } from "@/lib/audio";
import { getIdealDishSignal, getOrSaveExpectedSignal } from "@/lib/pipeline";
import {
  useActiveRecipe,
  useChefName,
  type Recipe,
  recipes,
  resetRecipeProgress,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/briefing")({
  head: () => ({
    meta: [
      { title: "Recipe Mission Briefing — WaveBakery" },
      {
        name: "description",
        content:
          "Chef Fourier presents the target dish, its target signal, and the signal-processing pipeline before cooking.",
      },
      { property: "og:title", content: "Recipe Mission Briefing — WaveBakery" },
      {
        property: "og:description",
        content: "Study the signal mathematics behind your recipe before entering the kitchen.",
      },
    ],
  }),
  component: RecipeMissionBriefing,
});

const CULINARY_DSP_BRIDGES = [
  {
    step: "1. Generation",
    icon: Zap,
    culinary: "Raw Produce Selection",
    dsp: "Basis Function Synthesis (Sine/Square/Noise)",
    color: "text-primary",
    bgColor: "bg-primary/10 border-primary/30",
    description:
      "Every ingredient possesses a signature frequency and physical waveform structure.",
  },
  {
    step: "2. Washing",
    icon: Filter,
    culinary: "Washing Sand & Grit",
    dsp: "Low-Pass Anti-Aliasing Filtering",
    color: "text-signal",
    bgColor: "bg-signal/10 border-signal/30",
    description:
      "Dirt and grit are high-frequency spectral noise. We filter them out before mixing.",
  },
  {
    step: "3. Mixing",
    icon: Layers,
    culinary: "Combining Flavors in Bowl",
    dsp: "Linear Superposition x₁(t) + x₂(t)",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
    description:
      "Harmonic signals superimpose linearly to construct a multi-tone complex flavor spectrum.",
  },
  {
    step: "4. Seasoning",
    icon: Sliders,
    culinary: "Spice & Salt Dials",
    dsp: "Amplitude & Gain Scaling A·x(t)",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    description: "Turning up spice amplifies the signal envelope and harmonic energy.",
  },
  {
    step: "5. Baking",
    icon: Utensils,
    culinary: "Oven Thermal Chamber",
    dsp: "LTI Convolution y(t) = x(t) * h(t)",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10 border-rose-500/30",
    description: "The oven transforms the dish through its impulse response h(t).",
  },
  {
    step: "6. Serving",
    icon: Radio,
    culinary: "Delivery Cart Suspension",
    dsp: "Z-Plane System H(z) (Notch Filter)",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10 border-sky-500/30",
    description:
      "The cart's suspension filter cancels the road vibration so the dish reaches the diner intact.",
  },
];

function RecipeMissionBriefing() {
  const [activeRecipe] = useActiveRecipe();
  const recipe = activeRecipe ?? recipes[0]!;
  const [chefName] = useChefName();
  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "dsp_bridge">("overview");
  const navigate = useNavigate();

  const targetSignal = useMemo(() => {
    try {
      return getOrSaveExpectedSignal(recipe?.id ?? "burger");
    } catch {
      return null;
    }
  }, [recipe?.id]);

  useEffect(() => {
    return () => {
      if (player) player.destroy();
    };
  }, [player]);

  const handlePlayTargetSound = () => {
    if (!targetSignal) return;
    if (player) player.destroy();
    const p = new SignalAudioPlayer({
      samples: targetSignal.samples,
      frequency: targetSignal.frequency,
      duration: 3.0,
    });
    p.play();
    setPlayer(p);
  };

  return (
    <main className="relative min-h-screen bg-background pb-16">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-8 sm:px-10">
        {/* Top Header Navigation */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <Link to="/recipe-book">
              <GameButton variant="secondary" size="sm" className="font-mono text-xs uppercase">
                ← Recipe Book
              </GameButton>
            </Link>
            <Link to="/kitchen">
              <GameButton variant="ghost" size="sm" className="font-mono text-xs uppercase">
                Kitchen Counter
              </GameButton>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            {chefName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-mono text-[11px] font-bold text-primary uppercase shadow-xs">
                👨‍🍳 Chef {chefName}
              </span>
            )}
            <span className="rounded-full border border-border bg-card px-3.5 py-1 font-mono text-[10px] font-bold text-muted-foreground uppercase">
              Mission Status: Ready to Prep
            </span>
          </div>
        </header>

        {/* Hero Title Plaque */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] font-extrabold tracking-[0.28em] text-primary uppercase">
              Culinary Signal Intelligence Briefing
            </span>
            <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-foreground uppercase sm:text-5xl">
              MISSION BRIEFING: <span className="text-gradient-warm">{recipe.name}</span>
            </h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Master the signals behind {recipe.name} before starting the kitchen assembly line.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "rounded-lg px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer",
                activeTab === "overview"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Dish Blueprint
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dsp_bridge")}
              className={cn(
                "rounded-lg px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer",
                activeTab === "dsp_bridge"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Signal Math Bridge ⚡
            </button>
          </div>
        </div>

        {/* ================= TAB 1: DISH OVERVIEW BLUEPRINT ================= */}
        {activeTab === "overview" && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left Column: Target Waveform & Audio Profile */}
            <div className="space-y-6">
              <div className="kitchen-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-display text-sm font-extrabold uppercase text-foreground">
                      Target Dish Flavour Waveform
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePlayTargetSound}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-bold text-primary uppercase transition-all hover:bg-primary hover:text-primary-foreground cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>▶ Preview Target Chord</span>
                  </button>
                </div>

                <div className="mt-4">
                  <WaveformDisplay
                    label={`${recipe.name} Master Harmonic Signature`}
                    samples={targetSignal?.samples}
                    className="w-full"
                  />
                </div>

                {/* Target Metric Specifications */}
                <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-[10px] uppercase">
                  <div className="rounded-xl border border-border bg-secondary/50 p-2.5 text-center">
                    <span className="text-muted-foreground">Fundamental Pitch</span>
                    <p className="mt-1 font-display text-sm font-extrabold text-primary">
                      {targetSignal?.frequency ?? 440} Hz
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/50 p-2.5 text-center">
                    <span className="text-muted-foreground">Target Gain</span>
                    <p className="mt-1 font-display text-sm font-extrabold text-foreground">
                      {recipe.seasoningTarget?.amplitude ?? 1.0}x
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/50 p-2.5 text-center">
                    <span className="text-muted-foreground">Max Allowed Noise</span>
                    <p className="mt-1 font-display text-sm font-extrabold text-signal-alt">
                      &lt; 5% THD
                    </p>
                  </div>
                </div>
              </div>

              {/* Required Ingredient Signals */}
              <div className="kitchen-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <span className="font-display text-sm font-extrabold uppercase text-foreground">
                    Required Ingredient Spectra
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    {recipe.ingredients.length} Elements
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {recipe.ingredientDetails.map((ing) => (
                    <div
                      key={ing.name}
                      className="flex items-center justify-between rounded-xl border border-border bg-secondary/60 p-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <IngredientGlyph kind={ing.kind ?? "generic"} className="h-5 w-5" />
                        <div>
                          <p className="font-display text-xs font-bold uppercase text-foreground">
                            {ing.name}
                          </p>
                          <span className="font-mono text-[9px] text-muted-foreground">
                            {ing.freq} Hz · {ing.instrument}
                          </span>
                        </div>
                      </div>

                      {ing.washable ? (
                        <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[8px] font-bold text-amber-500 uppercase">
                          Noisy (Wash)
                        </span>
                      ) : (
                        <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[8px] font-bold text-emerald-500 uppercase">
                          Clean
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Cooking Pipeline Steps & Chef Fourier Guidance */}
            <div className="space-y-6">
              {/* Pipeline Roadmap */}
              <div className="kitchen-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <span className="font-display text-sm font-extrabold uppercase text-foreground">
                    Signal Assembly Line
                  </span>
                  <span className="font-mono text-[10px] text-primary uppercase font-bold">
                    6 Stations
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {recipe.steps.map((step) => (
                    <div
                      key={step.stepNumber}
                      className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-primary/50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary font-mono text-sm shadow-inner">
                        {step.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-xs font-extrabold uppercase text-foreground">
                            Station {step.stepNumber}: {step.action}
                          </span>
                          <span className="font-mono text-[9px] text-muted-foreground uppercase">
                            {step.technicalLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{step.instruction}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chef Fourier Tactical Dialogue */}
              <div className="kitchen-card p-6">
                <ChefFourier
                  size="md"
                  float={false}
                  message={`Welcome to the briefing for ${recipe.name}, Chef! Make sure to wash out the high-frequency produce noise in the filter lab before mixing in the bowl. Let's create culinary perfection!`}
                />

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link to="/kitchen" className="flex-1">
                    <GameButton
                      size="lg"
                      className="w-full uppercase font-extrabold tracking-wider"
                    >
                      Enter Kitchen Hub →
                    </GameButton>
                  </Link>
                  <Link to="/generate">
                    <GameButton
                      size="lg"
                      variant="lab"
                      className="uppercase font-bold tracking-wider"
                    >
                      Station 1: Generator ⚡
                    </GameButton>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CULINARY <-> SIGNAL MATH BRIDGE ================= */}
        {activeTab === "dsp_bridge" && (
          <div className="mt-8 space-y-6">
            <div className="kitchen-card p-6">
              <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-display text-lg font-extrabold uppercase text-foreground">
                    The Culinary ↔ Signal Systems Dictionary
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    How every cooking action directly maps to fundamental linear systems theorems.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CULINARY_DSP_BRIDGES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.step}
                      className={cn(
                        "rounded-2xl border p-4.5 shadow-sm transition-all",
                        item.bgColor,
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-extrabold uppercase text-muted-foreground">
                          {item.step}
                        </span>
                        <Icon className={cn("h-4 w-4", item.color)} />
                      </div>

                      <div className="mt-3">
                        <span className="font-mono text-[9px] font-bold text-muted-foreground uppercase">
                          Culinary Task
                        </span>
                        <h4 className="font-display text-base font-extrabold text-foreground">
                          {item.culinary}
                        </h4>
                      </div>

                      <div className="mt-2.5 rounded-lg border border-border/60 bg-black/20 p-2 font-mono text-[10px] font-bold text-primary">
                        {item.dsp}
                      </div>

                      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Launch Action */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className="rounded-xl border border-border bg-secondary px-5 py-2.5 font-mono text-xs font-bold uppercase hover:text-foreground cursor-pointer"
              >
                ← Back to Blueprint
              </button>
              <GameButton
                size="lg"
                className="uppercase font-extrabold tracking-wider"
                onClick={() => navigate({ to: "/kitchen" })}
              >
                Proceed to Kitchen →
              </GameButton>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
