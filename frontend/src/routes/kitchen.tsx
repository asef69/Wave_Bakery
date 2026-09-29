import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import type { MachineId } from "@/components/game/KitchenMachines";
import { KitchenStation, type StationDef } from "@/components/game/KitchenStation";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";
import { getRecipeRunSession, recipes, useActiveRecipe, useRecipeProgress } from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kitchen")({
  head: () => ({
    meta: [
      { title: "Kitchen Hub — WaveBakery" },
      {
        name: "description",
        content:
          "Walk the WaveBakery kitchen: signal generator, filter machine, mixing bowl, seasoning dial, marinating timer and the convolution oven.",
      },
      { property: "og:title", content: "Kitchen Hub — WaveBakery" },
      { property: "og:description", content: "Your home base between signal-processing labs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KitchenHub,
});

const STEP_OBJECTIVES: Record<number, string> = {
  1: "Generate Ingredient Signals",
  2: "Clean Noisy Ingredients",
  3: "Combine Ingredients in Bowl",
  4: "Season Signal Amplitude & Frequency",
  5: "Marinate / Modulate / Decimate",
  6: "Convolve with Cooking Impulse",
  7: "Final Signal Comparison",
  8: "Recipe Complete & Served",
};

const jarColors = [
  "oklch(0.78 0.13 60)",
  "oklch(0.84 0.1 120)",
  "oklch(0.72 0.14 30)",
  "oklch(0.86 0.09 90)",
  "oklch(0.7 0.09 260)",
];

function KitchenHub() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep] = useRecipeProgress();
  const [hovered, setHovered] = useState<MachineId | null>(null);
  const [lockedFeedback, setLockedFeedback] = useState<string | null>(null);

  const stations: StationDef[] = [
    {
      id: "generate",
      label: "Generate signal",
      purpose: "Ingredient → instrument → signal",
      to: "/generate",
      chefLine: "Every ingredient begins as a signal.",
      step: 1,
    },
    {
      id: "filter",
      label: "Filter",
      purpose: "Clean the noise in the frequency domain",
      to: "/filtering",
      chefLine: "This one is noisy. Let's clean it in the frequency domain.",
      step: 2,
    },
    {
      id: "mix",
      label: "Mix",
      purpose: "Combine ingredient signals",
      to: "/mixing",
      chefLine: "Now let's combine our clean ingredient signals.",
      step: 3,
    },
    {
      id: "season",
      label: "Season",
      purpose: "Amplitude scaling",
      to: "/transform",
      chefLine: "Amplitude is our seasoning. Adjust it to the recipe!",
      step: 4,
    },
    {
      id: "marinate",
      label: "Marinate",
      purpose: "Time scaling",
      to: "/marinate",
      chefLine: "Stretch or compress the signal to change its timing.",
      step: 5,
    },
    {
      id: "cook",
      label: "Cook",
      purpose: "Convolution with a cooking impulse",
      to: "/cooking",
      chefLine: "Now for the final step — convolution!",
      step: 6,
    },
  ];

  const currentStep = Math.min(6, unlockedStep);
  const totalSteps = 6;
  const objective = STEP_OBJECTIVES[unlockedStep] ?? "Cook the Recipe";

  const handleLockedClick = (stationName: string) => {
    setLockedFeedback(
      `"Let's finish the earlier steps before we move on! Complete the previous steps first."`,
    );
    setTimeout(() => {
      setLockedFeedback(null);
    }, 4500);
  };

  const hoveredStation = stations.find((s) => s.id === hovered);
  const chefLine = lockedFeedback
    ? lockedFeedback
    : hoveredStation
      ? hoveredStation.step > unlockedStep
        ? `🔒 ${hoveredStation.label} is locked. Complete the previous steps first!`
        : hoveredStation.chefLine
      : unlockedStep > 6
        ? `All cooking stages complete! Head to the Tasting Table to evaluate ${recipe.name}.`
        : `Currently at Step ${unlockedStep}: ${objective}. Let's get to work!`;

  const session = getRecipeRunSession();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[oklch(0.94_0.03_75)] dark:bg-background">
      <TimeExpiredModal />
      {/* ---------- ROOM ---------- */}
      {/* back wall */}
      <div
        className="absolute inset-x-0 top-0 h-[74vh] bg-[linear-gradient(180deg,oklch(0.95_0.03_78),oklch(0.9_0.04_70))] dark:bg-[linear-gradient(180deg,oklch(0.18_0.03_255),oklch(0.13_0.025_255))]"
        aria-hidden
      />
      {/* wall tiles */}
      <div
        className="absolute inset-x-0 top-0 h-[74vh] opacity-[0.18] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(0.72 0.05 60) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.05 60) 1px, transparent 1px)",
          backgroundSize: "68px 68px",
        }}
        aria-hidden
      />
      {/* window with warm light */}
      <div
        className="absolute top-24 right-[3%] hidden h-32 w-44 rounded-3xl border-8 border-[oklch(0.55_0.07_45)] dark:border-[oklch(0.35_0.05_255)] bg-[linear-gradient(180deg,oklch(0.93_0.09_85),oklch(0.86_0.12_65))] dark:bg-[linear-gradient(180deg,oklch(0.24_0.05_255),oklch(0.16_0.04_260))] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] lg:block"
        aria-hidden
      >
        <span className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 bg-[oklch(0.55_0.07_45)] dark:bg-[oklch(0.35_0.05_255)]" />
        <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-[oklch(0.55_0.07_45)] dark:bg-[oklch(0.35_0.05_255)]" />
      </div>
      <div
        className="pointer-events-none absolute top-0 right-0 h-[70vh] w-[55vw] bg-[radial-gradient(ellipse_at_top_right,oklch(0.9_0.13_75/45%),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top_right,oklch(0.4_0.08_240/25%),transparent_65%)]"
        aria-hidden
      />
      {/* floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-[26vh] bg-[linear-gradient(180deg,oklch(0.72_0.05_50),oklch(0.62_0.05_45))] dark:bg-[linear-gradient(180deg,oklch(0.16_0.025_255),oklch(0.11_0.02_255))]"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[26vh] opacity-25 dark:opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(60deg, oklch(0.5 0.05 45) 0 2px, transparent 2px 46px), repeating-linear-gradient(-60deg, oklch(0.5 0.05 45) 0 2px, transparent 2px 46px)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8 pt-6 pb-12">
        {/* ---------- HUD ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Link to="/kitchen-hub">
              <GameButton variant="secondary" size="sm" className="font-mono text-xs uppercase">
                ← Kitchen Hub
              </GameButton>
            </Link>
            <RecipeTimerBadge />
            {session?.backendSeed && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[9px] font-bold text-primary uppercase">
                Session #{session.backendSeed % 10000}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 rounded-full border-2 border-border bg-card/90 px-5 py-2 shadow-[0_4px_0_var(--border)] backdrop-blur-[2px]">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full bg-[image:var(--gradient-warm)]"
                aria-hidden
              />
              <span className="font-display text-sm font-extrabold tracking-[0.12em] text-foreground uppercase">
                {recipe.name}
              </span>
            </span>
            <span className="h-5 w-px bg-border" aria-hidden />
            <span className="text-xs font-bold text-secondary-foreground">{objective}</span>
            <span className="h-5 w-px bg-border" aria-hidden />
            <span
              className="flex items-center gap-1.5"
              aria-label={`Step ${currentStep} of ${totalSteps}`}
            >
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 rounded-full transition-all ${
                    i + 1 <= unlockedStep
                      ? "w-6 bg-[image:var(--gradient-warm)]"
                      : "w-2.5 bg-border"
                  }`}
                  aria-hidden
                />
              ))}
              <span className="ml-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                {currentStep}/{totalSteps}
              </span>
            </span>
          </div>
        </div>

        {/* ---------- SHELVES + PANTRY ---------- */}
        <div className="mt-6 flex items-start justify-between gap-8">
          {/* pantry shelf with jars */}
          <Link
            to="/pantry"
            className="group block w-full max-w-md rounded-xl border border-transparent p-1 transition-all hover:border-[oklch(0.6_0.03_80)]/40 hover:bg-[oklch(0.96_0.01_85)]/40"
            title="Browse Pantry Signals"
          >
            <div className="flex items-end gap-3 px-3 transition-transform duration-200 group-hover:-translate-y-0.5">
              {jarColors.map((c, i) => (
                <span key={i} className="flex flex-col items-center">
                  <span className="h-2 w-6 rounded-t-sm bg-[oklch(0.55_0.07_45)]" />
                  <span
                    className="h-11 w-8 rounded-b-xl rounded-t-md border border-[oklch(0.6_0.03_80)] shadow-[inset_0_-6px_10px_rgba(0,0,0,0.12)]"
                    style={{ background: c }}
                  />
                </span>
              ))}
              <span className="ml-2 flex flex-col items-center">
                <span className="h-2 w-10 rounded-t-sm bg-[oklch(0.6_0.03_80)]" />
                <span className="h-8 w-12 rounded-b-2xl border border-[oklch(0.6_0.03_80)] bg-[oklch(0.86_0.02_85)]" />
              </span>
            </div>
            <div className="mt-1 h-3 rounded-full bg-[oklch(0.52_0.07_45)] shadow-[0_6px_10px_-6px_rgba(0,0,0,0.5)]" />
            <div className="mt-2 flex items-center justify-between px-2">
              <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                Pantry — {recipe.ingredients.length} ingredients today
              </p>
              <span className="font-mono text-[10px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Browse Pantry Signals →
              </span>
            </div>
          </Link>

          {/* hanging pans + utensils */}
          <div className="hidden items-start gap-6 pt-1 pr-52 md:flex" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-col items-center">
                <span className="h-6 w-px bg-[oklch(0.55_0.07_45)]" />
                <span
                  className="rounded-b-full border-2 border-[oklch(0.62_0.02_80)] bg-[oklch(0.8_0.02_80)]"
                  style={{ width: 34 + i * 6, height: 22 + i * 5 }}
                />
              </span>
            ))}
          </div>
        </div>

        {/* ---------- BACK COUNTER ---------- */}
        <section aria-label="Back counter machines" className="mt-10">
          <div
            className={cn(
              "grid gap-6",
              stations.slice(0, Math.ceil(stations.length / 2)).length > 3
                ? "grid-cols-4"
                : "grid-cols-3",
            )}
          >
            {stations.slice(0, Math.ceil(stations.length / 2)).map((s) => (
              <KitchenStation
                key={s.id}
                station={s}
                active={s.step === unlockedStep}
                done={s.step < unlockedStep}
                locked={s.step > unlockedStep}
                onHover={setHovered}
                onLockedClick={() => handleLockedClick(s.label)}
              />
            ))}
          </div>
          <div
            className="relative -mt-7 h-6 rounded-2xl bg-[linear-gradient(180deg,oklch(0.9_0.03_85),oklch(0.78_0.04_70))] dark:bg-[linear-gradient(180deg,oklch(0.26_0.035_255),oklch(0.20_0.03_255))] shadow-[0_8px_0_oklch(0.52_0.07_45)] dark:shadow-[0_8px_0_oklch(0.12_0.02_255)]"
            aria-hidden
          />
        </section>

        {/* ---------- FRONT COUNTER ---------- */}
        <section aria-label="Front counter machines" className="mt-12">
          <div
            className={cn(
              "grid gap-6",
              stations.slice(Math.ceil(stations.length / 2)).length > 3
                ? "grid-cols-4"
                : "grid-cols-3",
            )}
          >
            {stations.slice(Math.ceil(stations.length / 2)).map((s) => (
              <KitchenStation
                key={s.id}
                station={s}
                active={s.step === unlockedStep}
                done={s.step < unlockedStep}
                locked={s.step > unlockedStep}
                onHover={setHovered}
                onLockedClick={() => handleLockedClick(s.label)}
              />
            ))}
          </div>
          <div
            className="relative -mt-7 h-7 rounded-2xl bg-[linear-gradient(180deg,oklch(0.92_0.03_85),oklch(0.76_0.04_68))] dark:bg-[linear-gradient(180deg,oklch(0.26_0.035_255),oklch(0.20_0.03_255))] shadow-[0_9px_0_oklch(0.48_0.07_44)] dark:shadow-[0_9px_0_oklch(0.12_0.02_255)]"
            aria-hidden
          >
            <span className="absolute inset-x-6 top-1 h-px bg-white/40 dark:bg-white/20" />
          </div>
        </section>

        {/* ---------- CHEF IN THE ROOM ---------- */}
        <div className="mt-12 flex flex-wrap items-end justify-between gap-8">
          <ChefFourier size="md" message={chefLine} float={false} />
          <div className="flex flex-wrap items-center gap-3 pb-2">
            {unlockedStep >= 7 ? (
              <Link to="/score">
                <GameButton variant="lab" size="sm" className="uppercase">
                  Tasting table
                </GameButton>
              </Link>
            ) : (
              <GameButton
                variant="secondary"
                size="sm"
                className="cursor-not-allowed opacity-60 uppercase"
                onClick={() => handleLockedClick("Tasting Table")}
              >
                🔒 Tasting table
              </GameButton>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
