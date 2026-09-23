import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, CheckCircle2, AlertTriangle, XCircle, Sparkles, Trophy } from "lucide-react";

import { ServeChoiceModal } from "@/components/beamforming/ServeChoiceModal";
import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { MiniWave } from "@/components/game/MiniWave";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";
import { SignalAudioPlayer } from "@/lib/audio";
import { generateCustomerCritique } from "@/lib/critiques";
import { computeSignalSimilarity } from "@/lib/dsp";
import { addLeaderboardEntry } from "@/lib/leaderboard";
import {
  completeRecipeRun,
  getIdealDishSignal,
  useActiveRecipe,
  useChefName,
  useCookedSignal,
  useRecipeProgress,
  useRecipeTimer,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

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

function ScoreScreen() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const { session, formattedTime, difficultyConfig } = useRecipeTimer();
  const [chefName] = useChefName();
  const [isServeModalOpen, setIsServeModalOpen] = useState(false);
  const [cookedSignal] = useCookedSignal(recipe.id);
  const targetSignal = useMemo(() => getIdealDishSignal(recipe.id), [recipe.id]);
  const [audioPlayer, setAudioPlayer] = useState<SignalAudioPlayer | null>(null);

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
    completeRecipeRun();
  }, [unlock]);

  // Compute real signal similarity
  const rawSimilarity = useMemo(() => {
    return computeSignalSimilarity(cookedSignal.samples, targetSignal.samples);
  }, [cookedSignal.samples, targetSignal.samples]);

  const similarity = Math.max(0, Math.min(100, Math.round(rawSimilarity)));

  // Dynamic stage accuracies recorded from session
  const filteringVal = session?.filteringAccuracy ?? (recipe.washableIngredients.length === 0 ? 100 : similarity);
  const mixingVal = session?.mixingAccuracy ?? 95;
  const seasoningVal = session?.seasoningAccuracy ?? 92;
  const marinatingVal = session?.marinatingAccuracy ?? 90;
  const cookingVal = session?.cookingAccuracy ?? 94;
  const transformVal = Math.round((seasoningVal + marinatingVal) / 2);
  const deliveryVal = session?.deliveryAccuracy ?? null;
  const deliveryBonus = deliveryVal !== null ? Math.round((deliveryVal / 100) * 150) : 0;

  // Generate dynamic customer critique
  const customerCritique = useMemo(() => {
    return generateCustomerCritique({
      recipeId: recipe.id,
      similarity,
      filteringAccuracy: filteringVal,
      mixingAccuracy: mixingVal,
      seasoningAccuracy: seasoningVal,
      marinatingAccuracy: marinatingVal,
      cookingAccuracy: cookingVal,
      deliveryAccuracy: deliveryVal,
    });
  }, [
    recipe.id,
    similarity,
    filteringVal,
    mixingVal,
    seasoningVal,
    marinatingVal,
    cookingVal,
    deliveryVal,
  ]);

  const breakdownScores = useMemo(() => {
    const list = [
      { label: "Filtering", value: filteringVal },
      { label: "Mixing", value: mixingVal },
      { label: "Transformation", value: transformVal },
      { label: "Cooking / Convolution", value: cookingVal },
    ];
    if (deliveryVal !== null) {
      list.push({ label: `Beam Delivery Precision (+${deliveryBonus} pts)`, value: deliveryVal });
    }
    return list;
  }, [filteringVal, mixingVal, transformVal, cookingVal, deliveryVal, deliveryBonus]);

  const stageAvg = (filteringVal + mixingVal + seasoningVal + marinatingVal + cookingVal) / 5;
  const diffMultiplier = session ? (DIFFICULTY_MULTIPLIERS[session.difficulty] ?? 1.0) : 1.0;

  // Remaining time calculation
  const remainingSec = useMemo(() => {
    if (!session) return 0;
    if (session.endTime) {
      const elapsed = Math.floor((session.endTime - session.startTime) / 1000);
      return Math.max(0, session.totalSeconds - elapsed);
    }
    return 0;
  }, [session]);

  const timeBonus = remainingSec * 2;
  const totalScore =
    Math.round((similarity * 0.5 + stageAvg * 0.5) * 10 * diffMultiplier) + timeBonus + deliveryBonus;

  // Star award based on similarity & accuracy
  const starsDisplay = similarity >= 90 ? "★ ★ ★" : similarity >= 75 ? "★ ★ ☆" : "★ ☆ ☆";

  // Dynamic feedback from Chef Fourier based on lowest score
  const chefFeedback = useMemo(() => {
    if (similarity >= 92) {
      return `${similarity}%! That is a scientifically delicious plate. A true Fourier masterwork!`;
    }
    const stages = [
      { name: "filtering", val: filteringVal, tip: "Some high-frequency chatter remained in filtering. Try tuning the cutoff closer to the ideal mark." },
      { name: "mixing", val: mixingVal, tip: "Check your bowl ingredients to ensure all required components are properly superimposed." },
      { name: "seasoning", val: transformVal, tip: "Fine-tune the amplitude and time-scaling sliders to match the target envelope." },
      { name: "cooking", val: cookingVal, tip: "Ensure you choose the correct cooking impulse response and slide to full convolution depth." },
    ];
    stages.sort((a, b) => a.val - b.val);
    const lowest = stages[0];
    return `${similarity}% similarity. ${lowest?.tip ?? "Keep refining each station to perfect the signal!"}`;
  }, [similarity, filteringVal, mixingVal, transformVal, cookingVal]);

  // Persist player run to leaderboard
  useEffect(() => {
    const diff = session?.difficulty ?? "easy";
    const startTime = session?.startTime ?? Date.now();
    const entryId = `run-${recipe.id}-${diff}-${startTime}`;
    addLeaderboardEntry({
      id: entryId,
      chefName: chefName || "Asef",
      recipeId: recipe.id,
      difficulty: diff,
      score: totalScore,
      accuracy: similarity,
      timeRemaining: formattedTime || "0:00",
      date: "Today",
    });
  }, [session, recipe.id, chefName, totalScore, similarity, formattedTime]);

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
      <ServeChoiceModal
        isOpen={isServeModalOpen}
        onClose={() => setIsServeModalOpen(false)}
        recipeName={recipe.name}
      />
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
                Your final signal
              </p>
              <button
                onClick={() => handlePlaySignal(cookedSignal.samples, cookedSignal.frequency)}
                className="rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 font-mono text-[10px] font-bold text-primary hover:bg-primary/30 transition-colors uppercase cursor-pointer"
              >
                ▶ Play Your Dish
              </button>
            </div>
            <MiniWave
              className="mt-3 border-0 p-0"
              height={140}
              samples={cookedSignal.samples}
              color="var(--signal-alt)"
            />
          </div>
          <div className="lab-panel p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
                Target signal
              </p>
              <button
                onClick={() => handlePlaySignal(targetSignal.samples, targetSignal.frequency)}
                className="rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 font-mono text-[10px] font-bold text-primary hover:bg-primary/30 transition-colors uppercase cursor-pointer"
              >
                ▶ Play Target Signal
              </button>
            </div>
            <MiniWave
              className="mt-3 border-0 p-0"
              height={140}
              samples={targetSignal.samples}
              color="var(--primary)"
            />
          </div>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="kitchen-card p-6 text-center">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Signal similarity
            </p>
            <p className="mt-2 font-display text-6xl font-extrabold text-gradient-warm">{similarity}%</p>
            <div className="mt-4 h-4 w-full overflow-hidden rounded-full border border-border bg-secondary">
              <span className="block h-full bg-[image:var(--gradient-warm)]" style={{ width: `${similarity}%` }} />
            </div>
            <p className="mt-4 font-display text-2xl font-extrabold text-foreground">
              Overall score: {totalScore}
            </p>
            <p className="font-display text-xl text-primary">{starsDisplay}</p>

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
              <span className="text-3xl" aria-hidden>{customerCritique.avatarEmoji}</span>
              <div>
                <p className="font-mono text-[10px] font-extrabold tracking-[0.2em] text-primary uppercase">
                  Diner Taste Verdict · {customerCritique.eaterTitle}
                </p>
                <h3 className="font-display text-lg font-extrabold text-foreground uppercase">
                  {customerCritique.eaterName}
                </h3>
              </div>
            </div>

            <span className={cn(
              "rounded-full px-3 py-1 font-mono text-xs font-bold uppercase",
              customerCritique.reaction === "ecstatic" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" :
              customerCritique.reaction === "satisfied" ? "bg-primary/20 text-primary border border-primary/40" :
              "bg-amber-500/20 text-amber-400 border border-amber-500/40"
            )}>
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
                <div key={d.station} className="rounded-xl border border-border bg-card p-3 shadow-2xs text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-extrabold uppercase text-foreground">{d.station}</span>
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
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{d.dspDiagnosis}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <ChefFourier
            size="sm"
            float={false}
            message={chefFeedback}
          />
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
