import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Trophy,
} from "lucide-react";
import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { MiniWave } from "@/components/game/MiniWave";
import { SignalChainDiagram } from "@/components/game/SignalChainDiagram";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";
import { SignalAudioPlayer } from "@/lib/audio";
import { generateCustomerCritique } from "@/lib/critiques";
import { computeSignalSimilarity } from "@/lib/dsp";
import { ANONYMOUS_CHEF, addLeaderboardEntry } from "@/lib/leaderboard";
import {
  completeRecipeRun,
  getIdealDishSignal,
  saveRecipeBestScore,
  type SubmitResult,
  updateRecipeRunSession,
  useActiveRecipe,
  useChefName,
  useCookedSignal,
  usePipelineStageSignal,
  useRecipeProgress,
  useRecipeTimer,
  submitRunToBackend,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { getPipelineStageSignal, hasPipelineStageSignal } from "@/lib/pipeline";

export const Route = createFileRoute("/score")({
  head: () => ({
    meta: [
      { title: "Final Comparison — WaveBakery" },
      {
        name: "description",
        content:
          "Compare your cooked WaveBakery signal against the target and see your filtering, mixing, transform and cooking scores.",
      },
      { property: "og:title", content: "Final Comparison — WaveBakery" },
      { property: "og:description", content: "Waveform overlay + component scores = final score." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScoreScreen,
});

const DIFFICULTY_MULTIPLIERS = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.25,
  masterchef: 1.5,
};

/** Cap on the time bonus, before difficulty: 30% of a perfect 1000-pt base. */
const MAX_TIME_BONUS = 300;

function ScoreScreen() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const { session, formattedTime, difficultyConfig } = useRecipeTimer();
  const [chefName] = useChefName();
  const [cookedSignal] = useCookedSignal(recipe.id);
  // The Mixing curve (carried through marinating) both dishes are drawn along.
  const [curveRef] = usePipelineStageSignal(recipe.id, "marinated");
  const targetSignal = useMemo(() => getIdealDishSignal(recipe.id), [recipe.id]);
  const [audioPlayer, setAudioPlayer] = useState<SignalAudioPlayer | null>(null);

  const [backendSubmitResult, setBackendSubmitResult] = useState<SubmitResult | null>(
    () => session?.backendSubmitResult ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (audioPlayer) audioPlayer.destroy();
    };
  }, [audioPlayer]);

  const handlePlaySignal = (samples: number[], freq = 4.0) => {
    if (audioPlayer) audioPlayer.destroy();
    const p = new SignalAudioPlayer({
      samples,
      frequency: freq,
      duration: 2.5,
    });
    p.play();
    setAudioPlayer(p);
  };

  useEffect(() => {
    unlock(8);

    // Submit to server-authoritative backend. submitRunToBackend dedupes
    // in-flight requests: this effect re-runs on every session change, and
    // each re-run used to fire another submit (2–4 duplicate attempts).
    if (session?.backendSessionId && !backendSubmitResult) {
      setIsSubmitting(true);
      submitRunToBackend(recipe.id)
        .then((result) => {
          if (result) setBackendSubmitResult(result);
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.backendSessionId, backendSubmitResult, unlock]);

  const deliveredSignal = useMemo(
    () => getPipelineStageSignal(recipe.id, "delivered"),
    [recipe.id],
  );

  const playerSamples = useMemo(() => {
    if (hasPipelineStageSignal(recipe.id, "delivered") && deliveredSignal.samples.length > 0) {
      return deliveredSignal.samples;
    }
    if (cookedSignal.samples && cookedSignal.samples.length > 0) {
      return cookedSignal.samples;
    }
    return backendSubmitResult?.player_dish?.plot ?? targetSignal.samples;
  }, [recipe.id, deliveredSignal, cookedSignal.samples, backendSubmitResult, targetSignal.samples]);

  const targetSamples = targetSignal.samples;

  // Compute signal similarity directly on player's delivered output vs target
  const rawSimilarity = useMemo(() => {
    return computeSignalSimilarity(playerSamples, targetSamples);
  }, [playerSamples, targetSamples]);

  const similarity = Math.max(0, Math.min(100, Math.round(rawSimilarity)));

  // Stage accuracies recorded from session. A stage with no recorded
  // accuracy earns nothing (it used to default to 90–95%, i.e. free points),
  // except filtering when the recipe has nothing to wash.
  const filteringVal =
    session?.filteringAccuracy ?? (recipe.washableIngredients.length === 0 ? 100 : 0);
  const mixingVal = session?.mixingAccuracy ?? 0;
  const seasoningVal = session?.seasoningAccuracy ?? 0;
  const marinatingVal = session?.marinatingAccuracy ?? 0;
  const cookingVal = session?.cookingAccuracy ?? 0;
  const transformVal = Math.round((seasoningVal + marinatingVal) / 2);
  const deliveryVal = backendSubmitResult?.delivery_score ?? session?.deliveryAccuracy ?? null;
  const systemVal = backendSubmitResult?.system_score ?? session?.systemAccuracy ?? null;

  // Chop / Caramelize count only for recipes that include those stations.
  const stageVals = [filteringVal, mixingVal, seasoningVal, marinatingVal, cookingVal];
  if (recipe.requiresChop) stageVals.push(session?.chopAccuracy ?? 0);
  if (recipe.requiresCaramelize) stageVals.push(session?.caramelizeAccuracy ?? 0);
  const stageAvg = stageVals.reduce((sum, v) => sum + v, 0) / stageVals.length;

  // Local score on the backend's scale and weights: the core dish, then the
  // finishing stations (Precision Oven 10%, System Delivery 5%) when played,
  // taken proportionally from the rest — mirrors gameplay.judge.
  const localScore = useMemo(() => {
    let raw = similarity * 0.5 + stageAvg * 0.5;
    const extras = [
      [deliveryVal, 0.1],
      [systemVal, 0.05],
    ].filter((e): e is [number, number] => e[0] != null);
    const wTotal = extras.reduce((sum, [, w]) => sum + w, 0);
    raw = raw * (1 - wTotal) + extras.reduce((sum, [v, w]) => sum + v * w, 0);
    return Math.round(raw);
  }, [similarity, stageAvg, deliveryVal, systemVal]);

  // Authoritative server score (0–100) when available, else the local one on
  // the same 0–100 scale — both then go through the same stars and points.
  const displayScore = backendSubmitResult ? Math.round(backendSubmitResult.score) : null;
  const score100 = displayScore ?? localScore;
  // Same thresholds as the backend's metrics.stars(), so stars always mean
  // the same thing (the local fallback used to be a different 3-star scale).
  const starCount =
    backendSubmitResult?.stars ?? [32, 50, 66, 80, 92].filter((t) => score100 >= t).length;
  const displayStars = "★ ".repeat(starCount) + "☆ ".repeat(Math.max(0, 5 - starCount));

  // One metric everywhere (panel, critique, leaderboard): the time-domain
  // match of the dish shown on screen against the target. It used to switch
  // to the backend's spectral similarity when the Precision Oven was skipped.
  const displaySimilarity = similarity;

  // Generate dynamic customer critique
  const customerCritique = useMemo(() => {
    return generateCustomerCritique({
      recipeId: recipe.id,
      similarity: displaySimilarity,
      filteringAccuracy: backendSubmitResult?.filtering_score ?? filteringVal,
      mixingAccuracy: backendSubmitResult?.mixing_score ?? mixingVal,
      seasoningAccuracy: seasoningVal,
      marinatingAccuracy: marinatingVal,
      cookingAccuracy: backendSubmitResult?.cooking_score ?? cookingVal,
      deliveryAccuracy: deliveryVal,
    });
  }, [
    recipe.id,
    displaySimilarity,
    backendSubmitResult,
    filteringVal,
    mixingVal,
    seasoningVal,
    marinatingVal,
    cookingVal,
    deliveryVal,
  ]);

  const breakdownScores = useMemo(() => {
    const list = [
      { label: "Filtering", value: backendSubmitResult?.filtering_score ?? filteringVal },
      { label: "Mixing", value: backendSubmitResult?.mixing_score ?? mixingVal },
      { label: "Transformation", value: backendSubmitResult?.transform_score ?? transformVal },
      { label: "Cooking / Convolution", value: backendSubmitResult?.cooking_score ?? cookingVal },
    ];
    if (deliveryVal !== null) {
      list.push({ label: "Precision Oven Finishing", value: deliveryVal });
    }
    if (systemVal !== null) {
      list.push({ label: "System Delivery (Z-Plane)", value: systemVal });
    }
    return list;
  }, [
    backendSubmitResult,
    filteringVal,
    mixingVal,
    transformVal,
    cookingVal,
    deliveryVal,
    systemVal,
  ]);

  const diffMultiplier = session ? (DIFFICULTY_MULTIPLIERS[session.difficulty] ?? 1.0) : 1.0;

  // Remaining time calculation
  const remainingSec = useMemo(() => {
    if (!session) return 0;
    // Before completeRecipeRun stamps endTime, measure up to now; returning 0
    // here made the first render (and first save) miss the time bonus.
    const end = session.endTime ?? Date.now();
    const elapsed = Math.floor((end - session.startTime) / 1000);
    return Math.max(0, session.totalSeconds - elapsed);
  }, [session]);

  // Time bonus: 2 pts per second left, capped at 30% of a perfect base score
  // (it was uncapped and could outweigh the cooking), and scaled by
  // difficulty like the base. The finishing stations are inside score100.
  const timeBonus = Math.round(Math.min(remainingSec * 2, MAX_TIME_BONUS) * diffMultiplier);
  const baseScore = Math.round(score100 * 10 * diffMultiplier);
  const totalScore = baseScore + timeBonus;

  // Dynamic feedback from Chef Fourier based on lowest score
  const chefFeedback = useMemo(() => {
    if (backendSubmitResult?.notes && backendSubmitResult.notes.length > 0) {
      return backendSubmitResult.notes.join(" · ");
    }
    if (displaySimilarity >= 92) {
      return `${displaySimilarity}%! That is a scientifically delicious plate. A true Fourier masterwork!`;
    }
    const stages = [
      {
        name: "filtering",
        val: filteringVal,
        tip: "Some high-frequency chatter remained in filtering. Try tuning the cutoff closer to the ideal mark.",
      },
      {
        name: "mixing",
        val: mixingVal,
        tip: "Check your bowl ingredients to ensure all required components are properly superimposed.",
      },
      {
        name: "seasoning",
        val: transformVal,
        tip: "Fine-tune the amplitude and time-scaling sliders to match the target envelope.",
      },
      {
        name: "cooking",
        val: cookingVal,
        tip: "Ensure you choose the correct cooking impulse response and slide to full convolution depth.",
      },
    ];
    stages.sort((a, b) => a.val - b.val);
    const lowest = stages[0];
    return `${displaySimilarity}% similarity. ${lowest?.tip ?? "Keep refining each station to perfect the signal!"}`;
  }, [backendSubmitResult, displaySimilarity, filteringVal, mixingVal, transformVal, cookingVal]);

  // Persist player run to leaderboard + best score + session
  useEffect(() => {
    if (totalScore > 0) {
      saveRecipeBestScore(recipe.id, totalScore);
      completeRecipeRun(recipe.id, totalScore);
      // The Complete page shows exactly these (it used its own 3-star
      // rating and re-saved the leaderboard entry).
      updateRecipeRunSession({
        finalScore: totalScore,
        finalStars: starCount,
      });

      const diff = session?.difficulty ?? "easy";
      const startTime = session?.startTime ?? Date.now();
      const entryId = `run-${recipe.id}-${diff}-${startTime}`;
      addLeaderboardEntry({
        id: entryId,
        // No fallback to a real chef's name for anonymous runs.
        chefName: chefName || ANONYMOUS_CHEF,
        recipeId: recipe.id,
        difficulty: diff,
        score: totalScore,
        accuracy: displaySimilarity,
        timeRemaining: formattedTime || "0:00",
        date: new Date(startTime).toLocaleDateString(),
      });
    }
  }, [
    recipe.id,
    totalScore,
    starCount,
    session?.difficulty,
    session?.startTime,
    chefName,
    displaySimilarity,
    formattedTime,
  ]);

  if (unlockedStep < 7) {
    return (
      <main className="relative min-h-screen bg-background">
        <TimeExpiredModal />
        <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
        <div className="relative z-10 mx-auto max-w-4xl px-8 py-16 text-center">
          <div className="kitchen-card p-10">
            <span className="text-4xl" aria-hidden>
              🔒
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground uppercase">
              Station Locked: Final Comparison
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Cook your dish first before evaluating the final signal.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/cooking">
                <GameButton size="lg" className="uppercase">
                  Go to Cooking Lab →
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
                message="Let's finish cooking the dish before we plate and compare signals!"
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background">
      <TimeExpiredModal />
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
      <div className="relative z-10 mx-auto max-w-6xl px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">
              Results · {recipe.name}
            </p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight text-foreground uppercase">
              FINAL <span className="text-gradient-warm">COMPARISON</span>
            </h1>
          </div>
          {session && <RecipeTimerBadge />}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="lab-panel p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
                Your final signal {backendSubmitResult ? "· Server Evaluated" : ""}
              </p>
              <button
                onClick={() => handlePlaySignal(playerSamples, cookedSignal.frequency)}
                className="rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 font-mono text-[10px] font-bold text-primary hover:bg-primary/30 transition-colors uppercase cursor-pointer"
              >
                ▶ Play Your Dish
              </button>
            </div>
            <MiniWave
              className="mt-3 border-0 p-0"
              height={140}
              samples={playerSamples}
              curveRef={curveRef}
              color="var(--signal-alt)"
            />
          </div>
          <div className="lab-panel p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
                Target signal {backendSubmitResult ? "· Authoritative Master" : ""}
              </p>
              <button
                onClick={() => handlePlaySignal(targetSamples, targetSignal.frequency)}
                className="rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 font-mono text-[10px] font-bold text-primary hover:bg-primary/30 transition-colors uppercase cursor-pointer"
              >
                ▶ Play Target Signal
              </button>
            </div>
            <MiniWave
              className="mt-3 border-0 p-0"
              height={140}
              samples={targetSamples}
              curveRef={curveRef}
              color="var(--primary)"
            />
          </div>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="kitchen-card p-6 text-center">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                Signal similarity
              </p>
              {backendSubmitResult ? (
                <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[8px] font-bold text-emerald-400 uppercase">
                  Server Authoritative ✓
                </span>
              ) : isSubmitting ? (
                <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[8px] font-bold text-primary uppercase animate-pulse">
                  Verifying on server...
                </span>
              ) : null}
            </div>
            <p className="mt-2 font-display text-6xl font-extrabold text-gradient-warm">
              {displaySimilarity}%
            </p>
            <div className="mt-4 h-4 w-full overflow-hidden rounded-full border border-border bg-secondary">
              <span
                className="block h-full bg-[image:var(--gradient-warm)]"
                style={{ width: `${displaySimilarity}%` }}
              />
            </div>
            <p className="mt-4 font-display text-2xl font-extrabold text-foreground">
              Overall score: {totalScore}
            </p>
            <p className="font-display text-xl text-primary">{displayStars}</p>

            {backendSubmitResult && (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 font-mono text-[10px] uppercase text-muted-foreground">
                <div className="rounded-lg border border-border bg-secondary/60 p-1.5 text-center">
                  <span>SNR</span>
                  <p className="font-bold text-foreground">
                    {backendSubmitResult.snr_db.toFixed(1)} dB
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/60 p-1.5 text-center">
                  <span>MSE</span>
                  <p className="font-bold text-foreground">{backendSubmitResult.mse.toFixed(4)}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/60 p-1.5 text-center">
                  <span>Points</span>
                  <p className="font-bold text-primary">+{backendSubmitResult.points_awarded} XP</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/60 p-1.5 text-center">
                  <span>Chef Rank</span>
                  <p className="font-bold text-foreground">{backendSubmitResult.rank_title}</p>
                </div>
              </div>
            )}

            {difficultyConfig && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-border/60 pt-3 font-mono text-[10px] uppercase text-muted-foreground">
                {chefName && (
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-bold text-primary">
                    Chef {chefName}
                  </span>
                )}
                <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-bold text-foreground">
                  {difficultyConfig.badge}
                </span>
                <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-bold text-foreground">
                  Time Left: {formattedTime}
                </span>
              </div>
            )}
          </div>

          <div className="kitchen-card p-6">
            <p className="font-mono text-[10px] tracking-[0.22em] text-primary uppercase">
              Score breakdown (Signal Quality)
            </p>
            <ul className="mt-4 space-y-3">
              {breakdownScores.map((s) => (
                <li key={s.label}>
                  <div className="flex justify-between font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    <span>{s.label}</span>
                    <span className="text-foreground">{s.value}%</span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full bg-[image:linear-gradient(to_right,var(--signal-alt),var(--signal))]"
                      style={{ width: `${s.value}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Dynamic Customer Critique & DSP Diagnostic Card */}
        <section className="mt-8 kitchen-card p-6 border-2 border-primary/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {customerCritique.avatarEmoji}
              </span>
              <div>
                <p className="font-mono text-[10px] font-extrabold tracking-[0.2em] text-primary uppercase">
                  Diner Taste Verdict · {customerCritique.eaterTitle}
                </p>
                <h3 className="font-display text-lg font-extrabold text-foreground uppercase">
                  {customerCritique.eaterName}
                </h3>
              </div>
            </div>

            <span
              className={cn(
                "rounded-full px-3 py-1 font-mono text-xs font-bold uppercase",
                customerCritique.reaction === "ecstatic"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : customerCritique.reaction === "satisfied"
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/40",
              )}
            >
              {customerCritique.headline}
            </span>
          </div>

          <div className="mt-4 rounded-xl bg-secondary/50 p-4 border border-border/70 italic text-sm text-foreground/90">
            {customerCritique.quote}
          </div>

          <div className="mt-5">
            <p className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Station Signal Diagnostics &amp; Chef Feedback:
            </p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              {customerCritique.diagnostics.map((d) => (
                <div
                  key={d.station}
                  className="rounded-xl border border-border bg-card p-3 shadow-2xs text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-extrabold uppercase text-foreground">
                      {d.station}
                    </span>
                    {d.status === "pass" ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-emerald-400 uppercase">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Optimal
                      </span>
                    ) : d.status === "warn" ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-amber-400 uppercase">
                        <AlertTriangle className="h-3.5 w-3.5" /> Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-rose-400 uppercase">
                        <XCircle className="h-3.5 w-3.5" /> Recalibrate
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-semibold text-foreground">{d.culinaryNote}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {d.dspDiagnosis}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ITEM 5: End-to-End Cascaded LTI System Architecture Diagram */}
        <section className="mt-8">
          <SignalChainDiagram activeBlockId="cooking" />
        </section>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <ChefFourier size="sm" float={false} message={chefFeedback} />
          <div className="flex flex-wrap gap-3">
            <Link to="/complete">
              <GameButton
                size="lg"
                className="uppercase cursor-pointer font-extrabold tracking-wider bg-primary text-primary-foreground shadow-md"
              >
                Complete &amp; Claim Reward →
              </GameButton>
            </Link>
            <Link to="/leaderboard">
              <GameButton size="lg" variant="secondary" className="uppercase font-bold">
                <Trophy className="mr-2 h-4 w-4" />
                View Leaderboard
              </GameButton>
            </Link>
            <Link to="/recipe-book">
              <GameButton size="lg" variant="ghost" className="uppercase">
                Next Recipe →
              </GameButton>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
