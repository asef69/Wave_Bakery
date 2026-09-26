import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DragTutorialCue } from "@/components/game/DragTutorialCue";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { MiniWave } from "@/components/game/MiniWave";
import { SignalAudioPlayer } from "@/lib/audio";
import {
  computeConvolvedSignal,
  getRecipeRunSession,
  recipes,
  recordStageAccuracy,
  saveCookedSignal,
  savePipelineStageSignal,
  syncSessionParamsToBackend,
  updateRecipeRunSession,
  useActiveRecipe,
  usePipelineStageSignal,
  useRecipeProgress,
} from "@/lib/recipes";
import { invalidateDownstreamStages } from "@/lib/pipeline";
import { nudgeCookingSfx, startCookingSfx, stopCookingSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cooking")({
  head: () => ({
    meta: [
      { title: "Cooking / Convolution Lab — WaveBakery" },
      {
        name: "description",
        content:
          "Pick grill, fry, bake or boil and slide its impulse response across your WaveBakery signal.",
      },
      { property: "og:title", content: "Cooking / Convolution Lab — WaveBakery" },
      {
        property: "og:description",
        content: "Convolution = input signal ∗ impulse response = cooked signal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CookingLab,
});

const methods = [
  { id: "grill", name: "GRILL", icon: "🔥", ir: "GRILL (sharp spiky taps)", freq: 8, amp: 0.9 },
  { id: "fry", name: "FRY", icon: "🍳", ir: "FRY (crackle bursts)", freq: 12, amp: 0.8 },
  { id: "bake", name: "BAKE", icon: "🥖", ir: "BAKE (smooth warming curve)", freq: 2, amp: 0.6 },
  { id: "boil", name: "BOIL", icon: "♨️", ir: "BOIL (slow rolling bubbles)", freq: 3, amp: 0.7 },
] as const;

function CookingLab() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const [marinatedSignal] = usePipelineStageSignal(recipe.id, "marinated");
  const requiredMethod = methods.find((m) => m.id === recipe.cookingMethod.id) ?? methods[0]!;

  const alreadyCompleted = unlockedStep >= 7;

  const storedCooked = useMemo(() => {
    if (typeof window !== "undefined") {
      try {
        const key = `wavebakery_pipeline_${recipe.id}_cooked`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as {
            metadata?: { methodId?: string; pos?: number };
            samples?: number[];
          };
          if (Array.isArray(parsed?.samples) && parsed.samples.length > 0) {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  }, [recipe.id]);

  const initialMethod = useMemo(() => {
    if (storedCooked?.metadata?.methodId) {
      const found = methods.find((m) => m.id === storedCooked.metadata?.methodId);
      if (found) return found;
    }
    const session = getRecipeRunSession();
    if (session?.cookingAppliance) {
      const found = methods.find((m) => m.id === session.cookingAppliance);
      if (found) return found;
    }
    return alreadyCompleted ? requiredMethod : null;
  }, [storedCooked, alreadyCompleted, requiredMethod]);

  const initialPos = useMemo(() => {
    if (typeof storedCooked?.metadata?.pos === "number") {
      return storedCooked.metadata.pos;
    }
    const session = getRecipeRunSession();
    if (typeof session?.cookingPos === "number") return session.cookingPos;
    return alreadyCompleted ? 100 : 0;
  }, [storedCooked, alreadyCompleted]);

  const [method, setMethod] = useState<(typeof methods)[number] | null>(initialMethod);
  const [pos, setPos] = useState(initialPos);
  const [cooked, setCooked] = useState(() => storedCooked != null || alreadyCompleted);
  const [showDragCue, setShowDragCue] = useState(() => storedCooked == null && !alreadyCompleted);
  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);
  const userModifiedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (player) player.destroy();
    };
  }, [player]);

  const isTargetSelected = method?.id === requiredMethod.id;
  const isDone = isTargetSelected && pos >= 70;
  const isCookingComplete = (isTargetSelected && (pos >= 70 || cooked)) || alreadyCompleted;

  const currentMethod = method ?? requiredMethod;
  const currentPos = pos > 0 ? pos : alreadyCompleted ? 100 : 0;

  // Sound effect only: the method's cooking sound plays while the convolution
  // slider is held/dragged and stops on release (anywhere) or on leaving.
  const sfxHeldRef = useRef(false);
  useEffect(() => {
    const release = () => {
      if (!sfxHeldRef.current) return;
      sfxHeldRef.current = false;
      stopCookingSfx();
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      stopCookingSfx();
    };
  }, []);

  const convolvedSignal = useMemo(() => {
    return computeConvolvedSignal(
      marinatedSignal,
      currentMethod.id as "grill" | "fry" | "bake" | "boil",
      currentPos,
    );
  }, [marinatedSignal, currentMethod, currentPos]);

  const targetCookedSignal = useMemo(() => {
    return computeConvolvedSignal(
      marinatedSignal,
      requiredMethod.id as "grill" | "fry" | "bake" | "boil",
      100,
    );
  }, [marinatedSignal, requiredMethod]);

  const handlePlayOutput = () => {
    if (player) player.destroy();
    const newPlayer = new SignalAudioPlayer({
      samples: convolvedSignal.samples,
      frequency: convolvedSignal.frequency,
      duration: 2.5,
    });
    newPlayer.play();
    setPlayer(newPlayer);
    setCooked(true);
  };

  useEffect(() => {
    if (isCookingComplete) {
      unlock(7);

      if (userModifiedRef.current) {
        invalidateDownstreamStages(recipe.id, "cooked");
      }

      const methodScore = isTargetSelected ? 50 : 15;
      const depthScore = Math.min(50, Math.round((currentPos / 100) * 50));
      recordStageAccuracy("cooking", methodScore + depthScore);

      saveCookedSignal({
        recipeId: recipe.id,
        methodId: currentMethod.id,
        methodName: currentMethod.name,
        frequency: convolvedSignal.frequency,
        amplitude: 1.0,
        noise: currentMethod.id === "fry" ? 0.25 : 0.05,
        shift: currentPos / 200,
        pos: currentPos,
        timestamp: Date.now(),
        samples: convolvedSignal.samples,
      });
      savePipelineStageSignal(recipe.id, "cooked", convolvedSignal);
      updateRecipeRunSession({
        cookingAppliance: currentMethod.id,
        cookingPos: currentPos,
        cookingAccuracy: methodScore + depthScore,
      });
      syncSessionParamsToBackend(recipe.id);
    }
  }, [
    isCookingComplete,
    currentMethod,
    currentPos,
    convolvedSignal,
    recipe.id,
    unlock,
    isTargetSelected,
  ]);

  const chefLine = !method
    ? recipe.id === "burger"
      ? "Time to grill! Select the GRILL impulse response for this recipe."
      : recipe.id === "cake"
        ? "This one needs a gentle bake. Choose the BAKE impulse response."
        : recipe.id === "noodles"
          ? "Let's boil this signal! Choose the BOIL impulse response."
          : recipe.id === "chicken-fry"
            ? "Ready for frying! Select the FRY impulse response."
            : `This recipe calls for ${requiredMethod.name}! Select the ${requiredMethod.name} impulse response.`
    : isTargetSelected
      ? isCookingComplete
        ? `Cooking complete! The ${requiredMethod.name} impulse response transformed the ingredients into a cooked dish. Next, inspect your dish to check how the cooking heat affected its flavors.`
        : `Great choice! Drag the ${requiredMethod.name} impulse response across the signal to complete cooking.`
      : `Notice how this impulse response changes the signal? But remember, this recipe calls for ${requiredMethod.name}!`;

  if (unlockedStep < 6) {
    return (
      <main className="relative min-h-screen bg-background">
        <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
        <div className="relative z-10 mx-auto max-w-4xl px-8 py-16 text-center">
          <div className="kitchen-card p-10">
            <span className="text-4xl" aria-hidden>
              🔒
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground uppercase">
              Station Locked: Cooking Lab
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete the previous steps first before convolving and cooking the signal.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/marinate">
                <GameButton size="lg" className="uppercase">
                  Go to Marinating Lab →
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
    <LabShell
      eyebrow="Station 06 · Convolution"
      title="Cooking Lab"
      chefLine={chefLine}
      backTo="/kitchen"
      backLabel="← Back to Kitchen"
      nextTo={isCookingComplete ? "/check-dish" : undefined}
      nextLabel="CHECK DISH →"
    >
      {/* HUD Header */}
      <div className="kitchen-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
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
                Current Recipe
              </p>
              <p className="font-display text-sm font-extrabold uppercase text-foreground">
                {recipe.name}
              </p>
            </div>
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
              Working Signal
            </p>
            <p className="font-display text-sm font-bold tracking-[0.08em] text-foreground uppercase">
              Marinated Signal
            </p>
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
              Step
            </p>
            <p className="font-display text-sm font-bold tracking-[0.08em] text-foreground uppercase">
              6 / 6 · Cooking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Target Method:
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-display text-xs font-extrabold text-primary uppercase">
            <span>{requiredMethod.icon}</span>
            <span>{requiredMethod.name}</span>
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        {/* REQUIRED COOKING METHOD OBJECTIVE BANNER */}
        <section className="kitchen-card border-2 border-primary/30 bg-[linear-gradient(135deg,oklch(0.96_0.03_85),oklch(0.99_0.015_90))] dark:bg-[linear-gradient(135deg,oklch(0.22_0.03_255),oklch(0.17_0.025_255))] p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[image:var(--gradient-warm)] text-3xl shadow-sm">
                {requiredMethod.icon}
              </span>
              <div>
                <p className="font-mono text-[10px] tracking-[0.26em] text-primary uppercase">
                  Required Cooking Method · {recipe.name}
                </p>
                <h3 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  {requiredMethod.icon} {requiredMethod.name}
                </h3>
                <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
                  Use the <span className="font-bold text-foreground">{requiredMethod.name}</span>{" "}
                  impulse response ({requiredMethod.ir}).
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground uppercase">Recipe Target:</span>
                <span className="font-bold text-primary">{requiredMethod.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground uppercase">Current Selection:</span>
                <span
                  className={cn(
                    "font-bold",
                    isTargetSelected ? "text-signal-alt" : "text-foreground",
                  )}
                >
                  {method ? `${method.name} ${isTargetSelected ? "✓" : ""}` : "None selected"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* IMPULSE RESPONSE METHOD SELECTOR */}
        <section className="kitchen-card p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
                Cooking method selection
              </p>
              <h4 className="font-display text-xl font-extrabold text-foreground">
                Choose Impulse Response
              </h4>
            </div>
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Click to load impulse response
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {methods.map((m) => {
              const isRequired = m.id === requiredMethod.id;
              const isSelected = method?.id === m.id;

              return (
                <button
                  key={m.id}
                  onClick={() => {
                    userModifiedRef.current = true;
                    setMethod(m);
                    setCooked(false);
                  }}
                  className={cn(
                    "relative rounded-2xl border-2 p-4 text-left transition-all duration-200 hover:-translate-y-0.5",
                    isSelected
                      ? "border-primary bg-secondary shadow-[var(--shadow-warm-glow)]"
                      : isRequired
                        ? "border-primary/50 bg-secondary/60 hover:border-primary"
                        : "border-border bg-secondary/30 hover:border-primary/40",
                  )}
                >
                  {isRequired ? (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-[image:var(--gradient-warm)] px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.16em] text-primary-foreground uppercase shadow-sm">
                      ★ Recipe Target
                    </span>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>
                      {m.icon}
                    </span>
                    <span className="font-display text-lg font-extrabold tracking-[0.1em] text-foreground">
                      {m.name}
                    </span>
                  </div>

                  <MiniWave
                    className="mt-2 border-0 p-0"
                    height={50}
                    frequency={m.freq}
                    amplitude={m.amp}
                  />

                  <div className="mt-2 flex items-center justify-between font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                    <span>IR: {m.name}</span>
                    {isSelected ? (
                      <span className="font-bold text-primary">Selected ✓</span>
                    ) : isRequired ? (
                      <span className="text-primary">Required</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* CONVOLUTION SLIDER & WAVEFORMS */}
        <section className="lab-panel p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.26em] text-signal/70 uppercase">
                Convolution Processing Area
              </p>
              <h4 className="font-display text-2xl font-extrabold tracking-wide text-signal uppercase">
                {method ? `${method.icon} ${method.name} Convolution` : "Select a Cooking Method"}
              </h4>
            </div>
            <span className="font-mono text-[10px] tracking-[0.16em] text-signal/70 uppercase">
              {isTargetSelected
                ? "✓ Target impulse matched"
                : method
                  ? "⚠ Different impulse selected"
                  : "Awaiting impulse"}
            </span>
          </div>

          <div className="relative mt-5">
            <MiniWave
              className="border-0 p-0"
              label="input signal · marinated"
              samples={marinatedSignal.samples}
              curveRef={marinatedSignal}
            />
            <span
              className="pointer-events-none absolute top-4 h-20 w-16 rounded-xl border-2 border-primary bg-primary/20 shadow-[0_0_12px_var(--primary)] transition-all duration-75"
              style={{ left: `calc(${pos}% - 2rem)` }}
              aria-hidden
            />
          </div>

          <div className="relative mt-5 rounded-2xl border border-signal/20 bg-[oklch(0.19_0.03_250)]/50 p-4">
            <div className="flex justify-between font-mono text-[10px] tracking-[0.2em] text-signal/80 uppercase">
              <span>Impulse Response Position (Time Shift τ)</span>
              <span className="font-bold text-signal">{pos}%</span>
            </div>

            {/* Tutorial cue pointing to the draggable impulse slider */}
            {showDragCue && !isDone && (
              <div className="mt-3 flex justify-start">
                <DragTutorialCue
                  message="Drag this to adjust the cooking response."
                  direction="down"
                  onDismiss={() => setShowDragCue(false)}
                />
              </div>
            )}

            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              onPointerDown={() => {
                userModifiedRef.current = true;
                setShowDragCue(false);
                sfxHeldRef.current = true;
                startCookingSfx(currentMethod.id);
              }}
              onChange={(e) => {
                userModifiedRef.current = true;
                setShowDragCue(false);
                setPos(Number(e.target.value));
                if (!sfxHeldRef.current) nudgeCookingSfx(currentMethod.id);
              }}
              className="mt-3 w-full cursor-grab accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
              aria-label="Impulse response position"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[9px] tracking-[0.14em] text-signal/50 uppercase">
              <span>τ = 0 (Start)</span>
              <span>Slide across signal to convolve</span>
              <span>τ = max (End)</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniWave
              label="Input Signal x(t)"
              samples={marinatedSignal.samples}
              curveRef={marinatedSignal}
            />
            <MiniWave
              label={method ? `Impulse Response h(t) · ${method.name}` : "Impulse Response h(t)"}
              frequency={method?.freq ?? 6}
              amplitude={method?.amp ?? 0.5}
              color="var(--primary-glow)"
            />
            <MiniWave
              label="Convolved Output (x * h)(t)"
              samples={convolvedSignal.samples}
              curveRef={marinatedSignal}
              color={isTargetSelected ? "var(--signal)" : "var(--signal-alt)"}
            />
            <MiniWave
              label="Target Cooked Signal"
              samples={targetCookedSignal.samples}
              curveRef={marinatedSignal}
              color="var(--primary)"
            />
          </div>

          <p className="mt-5 text-center font-mono text-[10px] tracking-[0.2em] text-signal/70 uppercase">
            input signal x(t) ✱ impulse response h(t) ↓ convolution ↓ target output alignment
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <GameButton
              variant="lab"
              className="uppercase"
              disabled={!method}
              onClick={handlePlayOutput}
            >
              ▶ Play Output
            </GameButton>
            <GameButton
              className="uppercase"
              disabled={!method && !alreadyCompleted}
              onClick={() => {
                userModifiedRef.current = true;
                if (!method) setMethod(requiredMethod);
                setPos(100);
                setCooked(true);
                // Sound effect only: this convolves in one step, so play the
                // method's cooking sound briefly as it does.
                nudgeCookingSfx((method ?? requiredMethod).id, 1500);
              }}
            >
              {isCookingComplete ? "✓ Dish Cooked" : "Cook Dish"}
            </GameButton>
            {isCookingComplete && (
              <Link to="/check-dish">
                <GameButton
                  size="lg"
                  className="uppercase font-extrabold tracking-wider bg-primary text-primary-foreground shadow-lg shadow-primary/25 cursor-pointer text-base px-6 py-2.5"
                >
                  CHECK DISH →
                </GameButton>
              </Link>
            )}
          </div>
        </section>
      </div>
    </LabShell>
  );
}
