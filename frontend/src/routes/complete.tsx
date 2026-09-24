import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Trophy, Volume2 } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DishGlyph } from "@/components/game/DishGlyph";
import { GameButton } from "@/components/game/GameButton";
import { SignalAudioPlayer } from "@/lib/audio";
import { getSavedLeaderboardEntries, saveCurrentDishScoreToLeaderboard } from "@/lib/leaderboard";
import {
  completeRecipeRun,
  getRecipeBestScore,
  getRecipeRunSession,
  saveRecipeBestScore,
  useActiveRecipe,
  useChefName,
  useCookedSignal,
  useRecipeTimer,
} from "@/lib/recipes";

export const Route = createFileRoute("/complete")({
  head: () => ({
    meta: [
      { title: "Recipe Complete — WaveBakery" },
      {
        name: "description",
        content:
          "Your WaveBakery dish is plated: see the final score, stars and pick your next recipe.",
      },
      { property: "og:title", content: "Recipe Complete — WaveBakery" },
      { property: "og:description", content: "You didn't just cook it — you processed it!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompleteScreen,
});

function CompleteScreen() {
  const [recipe] = useActiveRecipe();
  const { difficultyConfig, formattedTime } = useRecipeTimer();
  const [chefName] = useChefName();
  const [cookedSignal] = useCookedSignal(recipe.id);
  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);

  const session = getRecipeRunSession();
  const bestScore = getRecipeBestScore(recipe.id);
  const latestEntry = getSavedLeaderboardEntries().find((e) => e.recipeId === recipe.id);
  const finalScore =
    session?.recipeId === recipe.id && session?.finalScore != null
      ? session.finalScore
      : (latestEntry?.score ?? bestScore ?? 0);
  const accuracy = latestEntry?.accuracy ?? (session?.cookingAccuracy ?? 94);
  const starsDisplay =
    finalScore >= 900 ? "★ ★ ★" : finalScore >= 700 ? "★ ★ ☆" : finalScore > 0 ? "★ ☆ ☆" : "— — —";

  useEffect(() => {
    completeRecipeRun(recipe.id, finalScore);
    if (finalScore > 0) {
      saveRecipeBestScore(recipe.id, finalScore);
    }
    saveCurrentDishScoreToLeaderboard({ recipeId: recipe.id });
    return () => {
      if (player) player.destroy();
    };
  }, [player, recipe.id, finalScore]);

  const handlePlayAudio = () => {
    if (player) player.destroy();
    const p = new SignalAudioPlayer({
      samples: cookedSignal.samples,
      frequency: cookedSignal.frequency,
      duration: 2.5,
    });
    p.play();
    setPlayer(p);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-8 py-12">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden />
      <div className="kitchen-card relative z-10 w-full max-w-4xl p-10 text-center">
        <p className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">Reward</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight text-gradient-warm uppercase">
          RECIPE COMPLETE!
        </h1>

        <div className="mt-8 grid items-center gap-8 md:grid-cols-[0.9fr_1.1fr]">
          <DishGlyph dish={recipe.id as any} />
          <div className="text-left">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Dish served
            </p>
            <p className="font-display text-4xl font-extrabold text-foreground uppercase">
              {recipe.name}
            </p>
            <p className="mt-3 font-display text-2xl font-extrabold text-foreground">
              Final score: {finalScore}
            </p>
            <p className="font-display text-2xl text-primary">{starsDisplay}</p>

            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px] uppercase">
              {chefName && (
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 font-bold text-primary">
                  Chef: {chefName}
                </span>
              )}
              {difficultyConfig && (
                <>
                  <span className="rounded-md border border-border bg-secondary px-2.5 py-1 font-bold text-foreground">
                    Difficulty: {difficultyConfig.badge}
                  </span>
                  <span className="rounded-md border border-border bg-secondary px-2.5 py-1 font-bold text-muted-foreground">
                    Time Remaining: {formattedTime}
                  </span>
                </>
              )}
            </div>

            <div className="mt-4">
              <GameButton
                variant="lab"
                size="sm"
                onClick={handlePlayAudio}
                className="uppercase font-bold tracking-wider"
              >
                <Volume2 className="mr-2 h-4 w-4" />
                ▶ Play Served Dish Output
              </GameButton>
            </div>

            <p className="mt-4 text-base font-semibold text-muted-foreground">
              You didn't just cook it — you processed it!
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <ChefFourier
            size="sm"
            float={false}
            message="You didn't just cook it — you processed it!"
          />
          <div className="flex flex-wrap gap-3">
            <Link to="/leaderboard">
              <GameButton size="lg" className="uppercase font-bold tracking-wider">
                <Trophy className="mr-2 h-4 w-4" />
                View Leaderboard →
              </GameButton>
            </Link>
            <Link to="/recipe-book">
              <GameButton size="lg" variant="secondary" className="uppercase">
                Next Recipe →
              </GameButton>
            </Link>
            <Link to="/kitchen-hub">
              <GameButton size="lg" variant="ghost" className="uppercase">
                Back to Kitchen
              </GameButton>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
