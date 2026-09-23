import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/how-to-play")({
  head: () => ({
    meta: [
      { title: "How to Play — WaveBakery" },
      {
        name: "description",
        content:
          "Learn the signal kitchen: interactive step-by-step tutorial on generation, filtering, superposition mixing, scaling, and convolution.",
      },
      { property: "og:title", content: "How to Play — WaveBakery" },
      {
        property: "og:description",
        content:
          "Master the signal kitchen: interactive tutorial connecting culinary cooking to Signals & Systems concepts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowToPlayScreen,
});

type StepData = {
  number: string;
  tabLabel: string;
  title: string;
  icon: string;
  station: string;
  cookingText: string;
  scienceText: string;
  ruleNote: string;
};

const tutorialSteps: StepData[] = [
  {
    number: "01",
    tabLabel: "CHOOSE",
    title: "Choose a Recipe",
    icon: "📖",
    station: "Recipe Book",
    cookingText: "Pick a dish from the Recipe Book.",
    scienceText: "Every recipe has its own signal-processing instructions.",
    ruleNote:
      "Review the target waveform, required pantry ingredients, and cooking method before you begin.",
  },
  {
    number: "02",
    tabLabel: "GENERATE",
    title: "Generate Signals",
    icon: "⚡",
    station: "Station 01 · Signal Generation",
    cookingText: "Turn each ingredient into a signal.",
    scienceText: "Different ingredients produce different waveforms.",
    ruleNote:
      "Washable ingredients arrive with noisy waveforms; non-washable pantry items arrive clean.",
  },
  {
    number: "03",
    tabLabel: "FILTER",
    title: "Wash / Filter",
    icon: "🧼",
    station: "Station 02 · Filtering Lab",
    cookingText: "Wash the ingredients that need cleaning.",
    scienceText: "Filtering removes unwanted frequency components from a noisy signal.",
    ruleNote:
      "Only washable ingredients enter this stage. Non-washable ingredients bypass washing directly.",
  },
  {
    number: "04",
    tabLabel: "MIX",
    title: "Mix Ingredients",
    icon: "🥣",
    station: "Station 03 · Mixing Lab",
    cookingText: "Add the cleaned ingredients to the bowl.",
    scienceText: "Signals combine through superposition.",
    ruleNote:
      "Individual ingredient signals are dotted/dashed traces; the combined mix is a bright solid curve.",
  },
  {
    number: "05",
    tabLabel: "SEASON",
    title: "Season",
    icon: "🌶️",
    station: "Station 04 · Seasoning Lab",
    cookingText: "Adjust the seasoning until the signal matches the recipe.",
    scienceText: "Amplitude and frequency scaling change the signal.",
    ruleNote:
      "Amplitude scales the wave height (taller/shorter); frequency scales the cycle density (compressed/stretched).",
  },
  {
    number: "06",
    tabLabel: "MARINATE",
    title: "Marinate",
    icon: "🥩",
    station: "Station 05 · Marinating Lab",
    cookingText: "Let the signal marinate for the required time.",
    scienceText: "Time scaling stretches or compresses a signal along the time axis.",
    ruleNote:
      "Marinating is specifically the dedicated time-scaling stage (shorter = compressed, longer = stretched).",
  },
  {
    number: "07",
    tabLabel: "COOK",
    title: "Cook",
    icon: "🔥",
    station: "Station 06 · Cooking Lab",
    cookingText: "Choose the cooking method required by the recipe.",
    scienceText: "Convolution combines the prepared signal with a cooking impulse response.",
    ruleNote:
      "Recipes call for specific methods: GRILL, FRY, BAKE, or BOIL. Each applies a distinct impulse response.",
  },
  {
    number: "08",
    tabLabel: "SERVE",
    title: "Compare & Serve",
    icon: "🏆",
    station: "Tasting Table · Final Score",
    cookingText: "Compare your finished dish with the target.",
    scienceText: "Your final signal is compared with the recipe target.",
    ruleNote:
      "Better match = better dish! Match the waveform closely to score high similarity and earn 3 stars.",
  },
];

const cheatSheet = [
  { action: "WASH", operation: "FILTERING", icon: "🧼", note: "Removes noise frequencies" },
  { action: "MIX", operation: "SUPERPOSITION", icon: "🥣", note: "Sums signals into one curve" },
  {
    action: "SEASON",
    operation: "AMPLITUDE / FREQUENCY SCALING",
    icon: "🌶️",
    note: "Scales height & pitch",
  },
  {
    action: "MARINATE",
    operation: "TIME SCALING",
    icon: "🥩",
    note: "Stretches / compresses time",
  },
  { action: "COOK", operation: "CONVOLUTION", icon: "🔥", note: "Applies cooking impulse" },
  { action: "TASTE", operation: "SIGNAL COMPARISON", icon: "🍽️", note: "Calculates match score" },
];

function HowToPlayScreen() {
  const [activeStep, setActiveStep] = useState(0);
  const current = tutorialSteps[activeStep]!;

  const handlePrev = () => {
    setActiveStep((prev) => (prev > 0 ? prev - 1 : tutorialSteps.length - 1));
  };

  const handleNext = () => {
    setActiveStep((prev) => (prev < tutorialSteps.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main className="relative min-h-screen bg-background pb-16">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-8 sm:px-10">
        {/* HEADER */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border/80 pb-6">
          <div>
            <Link to="/menu" className="w-fit">
              <GameButton variant="ghost" size="sm">
                ← Back to Main Menu
              </GameButton>
            </Link>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              HOW TO <span className="text-gradient-warm">PLAY</span>
            </h1>
            <p className="mt-1 text-base font-semibold text-muted-foreground">
              Cook with signals. Learn the science behind every step.
            </p>
          </div>

          <div className="flex flex-col items-end">
            <ChefFourier
              size="sm"
              float={false}
              bubbleSide="left"
              message="Don't worry, Chef! I'll guide you through the signal kitchen."
            />
          </div>
        </header>

        {/* SLIDING TUTORIAL TABS & CAROUSEL */}
        <section className="mt-8">
          {/* Numbered Navigation Tabs */}
          <nav className="flex flex-wrap items-center justify-between gap-1.5 rounded-2xl border border-border bg-card/80 p-2 shadow-sm">
            {tutorialSteps.map((step, idx) => {
              const isSelected = activeStep === idx;
              return (
                <button
                  key={step.number}
                  onClick={() => setActiveStep(idx)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 font-mono text-xs font-extrabold uppercase transition-all duration-150",
                    isSelected
                      ? "bg-[image:var(--gradient-warm)] text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.15)] scale-[1.02]"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <span
                    className={isSelected ? "text-primary-foreground/90" : "text-primary font-bold"}
                  >
                    {step.number}
                  </span>
                  <span className="hidden sm:inline">{step.tabLabel}</span>
                </button>
              );
            })}
          </nav>

          {/* ACTIVE STEP CARD CONTAINER */}
          <div className="mt-4 overflow-hidden rounded-3xl border-2 border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary font-mono text-xl shadow-inner">
                  {current.icon}
                </span>
                <div>
                  <span className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                    Step {current.number} of {tutorialSteps.length}
                  </span>
                  <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
                    {current.title}
                  </h2>
                </div>
              </div>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
                {current.station}
              </span>
            </div>

            {/* Content: 2-Column (Text Left / Visual Right) */}
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              {/* Text Area */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
                    🍳 Cooking Action
                  </span>
                  <p className="mt-1 font-display text-lg font-extrabold text-foreground">
                    "{current.cookingText}"
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-signal-alt uppercase">
                    📡 The Signal Science
                  </span>
                  <p className="mt-1 font-display text-base font-bold text-foreground">
                    "{current.scienceText}"
                  </p>
                </div>

                <div className="rounded-2xl border border-dashed border-primary/40 bg-card p-3.5">
                  <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-bold text-foreground uppercase">Key Rule: </span>
                    {current.ruleNote}
                  </p>
                </div>
              </div>

              {/* Visual Display */}
              <div className="lab-panel relative overflow-hidden p-5 shadow-sm">
                <div className="lab-grid absolute inset-0 opacity-40" aria-hidden />
                <div className="relative z-10">
                  <StepVisual stepIndex={activeStep} />
                </div>
              </div>
            </div>

            {/* PREVIOUS / NEXT CONTROLS & PROGRESS */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-5">
              <GameButton
                variant="secondary"
                size="sm"
                onClick={handlePrev}
                className="font-mono text-xs uppercase"
              >
                ← Previous Step
              </GameButton>

              {/* Progress Indicator */}
              <div className="flex flex-col items-center gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Step {activeStep + 1} of {tutorialSteps.length}
                </span>
                <div className="flex gap-1.5">
                  {tutorialSteps.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 w-6 rounded-full transition-all duration-200",
                        i === activeStep
                          ? "bg-primary w-8 shadow-sm"
                          : i < activeStep
                            ? "bg-primary/50"
                            : "bg-secondary",
                      )}
                    />
                  ))}
                </div>
              </div>

              <GameButton size="sm" onClick={handleNext} className="font-mono text-xs uppercase">
                Next Step →
              </GameButton>
            </div>
          </div>
        </section>

        {/* SIGNAL KITCHEN CHEAT SHEET */}
        <section className="mt-10">
          <div className="kitchen-card p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
                  Quick Reference
                </p>
                <h3 className="font-display text-2xl font-extrabold text-foreground uppercase">
                  The Signal Kitchen
                </h3>
              </div>
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Cooking Metaphor ⇄ DSP Concept
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {cheatSheet.map((item) => (
                <div
                  key={item.action}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-secondary/50 p-3.5 text-center transition-all hover:border-primary/50 hover:bg-secondary"
                >
                  <div>
                    <span className="text-2xl" aria-hidden>
                      {item.icon}
                    </span>
                    <h4 className="mt-1.5 font-display text-sm font-extrabold text-foreground uppercase">
                      {item.action}
                    </h4>
                  </div>
                  <div className="mt-2 border-t border-border/60 pt-2">
                    <p className="font-mono text-[10px] font-bold text-primary uppercase">
                      {item.operation}
                    </p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{item.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CHEF FOURIER TIP CARD */}
        <section className="mt-6 rounded-3xl border border-primary/30 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-3xl" aria-hidden>
              👨‍🍳
            </span>
            <p className="font-display text-base font-bold text-foreground">
              "Think of every ingredient as a signal. Your job is to transform those signals until
              they match the recipe target!"
            </p>
          </div>
        </section>

        {/* BOTTOM NAVIGATION */}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border/80 pt-6">
          <Link to="/menu">
            <GameButton variant="secondary" size="lg" className="uppercase">
              ← Back to Menu
            </GameButton>
          </Link>

          <Link to="/recipe-book">
            <GameButton size="lg" className="text-lg tracking-[0.16em] uppercase">
              Start Cooking →
            </GameButton>
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** Visual SVG diagrams matching exact WaveBakery lab conventions */
function StepVisual({ stepIndex }: { stepIndex: number }) {
  const w = 440;
  const h = 180;

  switch (stepIndex) {
    case 0:
      // Choose Recipe: Digital cookbook & target curve
      return (
        <div className="flex flex-col justify-between h-[190px]">
          <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-signal/70 uppercase">
            <span>Recipe Target Sheet</span>
            <span className="text-primary font-bold">BURGER · ×1.50 A · GRILL</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="var(--signal)"
              strokeWidth="0.8"
              opacity="0.25"
            />
            <path
              d="M0,90 Q55,20 110,90 T220,90 T330,90 T440,90"
              fill="none"
              stroke="var(--trace-mixed)"
              strokeWidth="4"
              style={{ filter: "drop-shadow(0 0 10px var(--trace-mixed))" }}
            />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-signal/60 uppercase">
            <span>Target Waveform</span>
            <span>Recipe Target</span>
          </div>
        </div>
      );

    case 1:
      // Generate: Raw instrument waveforms (clean vs noisy)
      return (
        <div className="flex flex-col justify-between h-[190px]">
          <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-signal/70 uppercase">
            <span>Pantry: Clean</span>
            <span className="text-primary font-bold">Washable: Noisy Arrival</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="var(--signal)"
              strokeWidth="0.8"
              opacity="0.25"
            />
            {/* Clean wave (left half) */}
            <path
              d="M0,90 Q50,40 100,90 T200,90"
              fill="none"
              stroke="var(--signal)"
              strokeWidth="3"
            />
            <line
              x1="220"
              y1="10"
              x2="220"
              y2="170"
              stroke="var(--border)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {/* Noisy wave (right half) */}
            <path
              d="M230,90 Q255,45 280,88 T330,96 T380,84 T430,92"
              fill="none"
              stroke="var(--signal-alt)"
              strokeWidth="2.8"
            />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-signal/60 uppercase">
            <span>Bun / Cheese (0% Noise)</span>
            <span className="text-primary">Lettuce / Tomato (68% Noise)</span>
          </div>
        </div>
      );

    case 2:
      // Filter: Noisy -> Cutoff -> Clean
      return (
        <div className="flex flex-col justify-between h-[190px]">
          <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-signal/70 uppercase">
            <span className="text-primary font-bold">Noisy Signal</span>
            <span className="text-primary-glow font-bold">Cutoff 520 Hz ↓</span>
            <span className="text-signal font-bold">Clean Signal</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="var(--signal)"
              strokeWidth="0.8"
              opacity="0.25"
            />
            {/* Noisy wave */}
            <path
              d="M0,90 Q25,45 50,88 T100,95 T150,85 T200,90"
              fill="none"
              stroke="var(--signal-alt)"
              strokeWidth="2.5"
            />
            {/* Cutoff filter bar */}
            <line
              x1="220"
              y1="10"
              x2="220"
              y2="170"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
            {/* Clean wave */}
            <path
              d="M230,90 Q280,35 335,90 T440,90"
              fill="none"
              stroke="var(--signal)"
              strokeWidth="3.5"
              style={{ filter: "drop-shadow(0 0 8px var(--signal))" }}
            />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-signal/60 uppercase">
            <span>Raw Input</span>
            <span className="text-primary">Lowpass Filter</span>
            <span className="text-signal">Filtered Output</span>
          </div>
        </div>
      );

    case 3:
      // Mix: Dashed ingredient traces + Solid gold superposition
      return (
        <div className="flex flex-col justify-between h-[190px]">
          <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-signal/70 uppercase">
            <span className="text-lab-foreground">Dashed = 5 Ingredients</span>
            <span className="text-[var(--trace-mixed)] font-bold">Solid = Mixed Superposition</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="var(--signal)"
              strokeWidth="0.8"
              opacity="0.25"
            />
            {/* Dashed ingredient 1 */}
            <path
              d="M0,90 Q40,30 80,90 T160,90 T240,90 T320,90 T400,90"
              fill="none"
              stroke="oklch(0.72 0.15 145)"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            {/* Dashed ingredient 2 */}
            <path
              d="M0,90 Q30,50 60,90 T120,90 T180,90 T240,90 T300,90 T360,90 T420,90"
              fill="none"
              stroke="oklch(0.68 0.19 28)"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            {/* Solid combined superposition */}
            <path
              d="M0,90 Q55,15 110,90 T220,90 T330,90 T440,90"
              fill="none"
              stroke="var(--trace-mixed)"
              strokeWidth="4"
              style={{ filter: "drop-shadow(0 0 10px var(--trace-mixed))" }}
            />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-signal/60 uppercase">
            <span>Linear Summation</span>
            <span className="text-[var(--trace-mixed)]">Combined Waveform</span>
          </div>
        </div>
      );

    case 4:
      // Season: Amplitude & Frequency Scaling
      return (
        <div className="flex flex-col justify-between h-[190px]">
          <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-signal/70 uppercase">
            <span>Amplitude Scaling (Height ↕)</span>
            <span>Frequency Scaling (Cycles ↔)</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="var(--signal)"
              strokeWidth="0.8"
              opacity="0.25"
            />
            {/* Amplitude scaled wave */}
            <path
              d="M0,90 Q50,15 100,90 T200,90"
              fill="none"
              stroke="var(--signal)"
              strokeWidth="3.5"
            />
            <line
              x1="220"
              y1="10"
              x2="220"
              y2="170"
              stroke="var(--border)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {/* Frequency scaled wave */}
            <path
              d="M230,90 Q255,45 280,90 T330,90 T380,90 T430,90"
              fill="none"
              stroke="var(--primary-glow)"
              strokeWidth="3.5"
            />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-signal/60 uppercase">
            <span>Amplitude: × 1.50 (Taller)</span>
            <span>Frequency: × 0.80 (Shifted)</span>
          </div>
        </div>
      );

    case 5:
      // Marinate: Time Scaling along horizontal axis
      return (
        <div className="flex flex-col justify-between h-[190px]">
          <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-signal/70 uppercase">
            <span>Dashed = 1.00× Reference</span>
            <span className="text-signal font-bold">Solid = 1.40× Time Stretched</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="var(--signal)"
              strokeWidth="0.8"
              opacity="0.25"
            />
            {/* Original wave */}
            <path
              d="M0,90 Q30,30 60,90 T120,90 T180,90 T240,90 T300,90 T360,90 T420,90"
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth="2"
              strokeDasharray="6 5"
              opacity="0.6"
            />
            {/* Stretched wave */}
            <path
              d="M0,90 Q75,20 150,90 T300,90 T440,90"
              fill="none"
              stroke="var(--signal)"
              strokeWidth="3.6"
              style={{ filter: "drop-shadow(0 0 10px var(--signal))" }}
            />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-signal/60 uppercase">
            <span>Time Axis → (0.00 s — 1.40 s)</span>
            <span className="text-signal">Horizontal Time Scaling</span>
          </div>
        </div>
      );

    case 6:
      // Cook: Convolution with Impulse Response
      return (
        <div className="flex flex-col justify-between h-[190px]">
          <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-signal/70 uppercase">
            <span>Prepared Signal x(t) ✱ Impulse h(t)</span>
            <span className="text-primary font-bold">GRILL · FRY · BAKE · BOIL</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="var(--signal)"
              strokeWidth="0.8"
              opacity="0.25"
            />
            <path
              d="M0,90 Q30,40 60,90 T120,90"
              fill="none"
              stroke="var(--signal)"
              strokeWidth="2.8"
            />
            <text x="135" y="98" fill="var(--primary)" fontSize="22" fontWeight="bold">
              ✱
            </text>
            <path
              d="M165,90 Q185,25 205,90 T245,90"
              fill="none"
              stroke="var(--primary-glow)"
              strokeWidth="2.8"
            />
            <text x="260" y="98" fill="var(--primary)" fontSize="22" fontWeight="bold">
              →
            </text>
            <path
              d="M290,90 Q325,18 360,90 T430,90"
              fill="none"
              stroke="var(--signal-alt)"
              strokeWidth="3.6"
              style={{ filter: "drop-shadow(0 0 8px var(--signal-alt))" }}
            />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-signal/60 uppercase">
            <span>x(t) Input</span>
            <span>h(t) Impulse</span>
            <span className="text-signal-alt">y(t) Cooked Dish</span>
          </div>
        </div>
      );

    case 7:
      // Serve: Comparison against target & score
      return (
        <div className="flex flex-col justify-between h-[190px]">
          <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-signal/70 uppercase">
            <span>Target vs Plated Waveform</span>
            <span className="text-signal font-bold">Similarity: 94% ★★★</span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="var(--signal)"
              strokeWidth="0.8"
              opacity="0.25"
            />
            {/* Target curve (gold) */}
            <path
              d="M0,90 Q55,20 110,90 T220,90 T330,90 T440,90"
              fill="none"
              stroke="var(--trace-mixed)"
              strokeWidth="4"
              opacity="0.8"
            />
            {/* Player final curve (cyan dashed) */}
            <path
              d="M0,90 Q55,22 110,90 T220,90 T330,90 T440,90"
              fill="none"
              stroke="var(--signal)"
              strokeWidth="3"
              strokeDasharray="8 5"
            />
          </svg>
          <div className="flex justify-between font-mono text-[9px] text-signal/60 uppercase">
            <span className="text-[var(--trace-mixed)]">Target (Solid)</span>
            <span className="text-signal">Your Signal (Dashed)</span>
            <span className="text-signal-alt font-bold">Better Match = Better Dish!</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}
