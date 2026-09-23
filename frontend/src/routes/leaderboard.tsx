import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, ChefHat, Clock, Flame, LogOut, Medal, Sparkles, Timer, Trophy, Zap } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DishGlyph } from "@/components/game/DishGlyph";
import { GameButton } from "@/components/game/GameButton";
import { LogoutModal } from "@/components/game/LogoutModal";
import { formatChefDisplayName, getLeaderboard, isChefMatch, useLeaderboard } from "@/lib/leaderboard";
import { DIFFICULTY_CONFIGS, getRecipeRunSession, recipes, useChefName, type RecipeDifficulty } from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — WaveBakery" },
      {
        name: "description",
        content:
          "See top chef scores and signal similarity rankings for all recipes and difficulties in WaveBakery.",
      },
      { property: "og:title", content: "Leaderboard — WaveBakery" },
      {
        property: "og:description",
        content: "Top signal culinary scores by recipe and difficulty.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardScreen,
});

const difficultyIcons: Record<RecipeDifficulty, typeof Clock> = {
  easy: Clock,
  medium: Timer,
  hard: Zap,
  masterchef: Flame,
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/50 bg-amber-400/15 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]">
        <Trophy className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300/50 bg-slate-300/15 text-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.2)]">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-700/50 bg-amber-700/15 text-amber-600 dark:text-amber-500 shadow-[0_0_10px_rgba(217,119,6,0.15)]">
        <Award className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-secondary font-mono text-xs font-bold text-muted-foreground">
      #{rank}
    </div>
  );
}

function LeaderboardScreen() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id ?? "burger");
  const [selectedDifficulty, setSelectedDifficulty] = useState<RecipeDifficulty>(
    () => getRecipeRunSession()?.difficulty ?? "easy",
  );
  const [chefName] = useChefName();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? recipes[0]!;
  const entries = useLeaderboard(selectedRecipeId, selectedDifficulty, chefName);

  const playerRankEntry = chefName
    ? entries.find((e) => isChefMatch(e.chefName, chefName))
    : entries.find((e) => isChefMatch(e.chefName, "Asef"));

  const currentDiffConfig = DIFFICULTY_CONFIGS[selectedDifficulty];
  const DiffIcon = difficultyIcons[selectedDifficulty];

  return (
    <main className="relative min-h-screen bg-background pb-16">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-8 sm:px-10">
        {/* HEADER */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border/80 pb-6">
          <div>
            <Link to="/menu" className="w-fit">
              <GameButton variant="ghost" size="sm">
                ← Back to Main Menu
              </GameButton>
            </Link>
            <div className="mt-3 flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
                <Trophy className="h-3.5 w-3.5" />
              </span>
              <p className="font-mono text-[10px] font-extrabold tracking-[0.28em] text-primary uppercase">
                Hall of Signal Fame
              </p>
            </div>
            <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-foreground uppercase sm:text-5xl">
              LEADER<span className="text-gradient-warm">BOARD</span>
            </h1>
            <p className="mt-1 text-base font-semibold text-muted-foreground">
              Top signal culinary scores by recipe and difficulty.
            </p>
          </div>

          <div className="flex flex-col items-end">
            <ChefFourier
              size="sm"
              float={false}
              bubbleSide="left"
              message="Precision and speed: that's how true MasterChefs claim the top podium!"
            />
          </div>
        </header>

        {/* CONTROLS BAR: RECIPE + DIFFICULTY FILTER */}
        <section className="mt-8 grid gap-4 rounded-3xl border border-border bg-card/60 p-5 shadow-sm sm:grid-cols-[1fr_auto]">
          {/* Recipe Selector */}
          <div>
            <label
              htmlFor="recipeFilter"
              className="block font-mono text-[10px] font-extrabold tracking-[0.24em] text-muted-foreground uppercase"
            >
              Select Recipe
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {recipes.map((r) => {
                const isActive = r.id === selectedRecipeId;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRecipeId(r.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3.5 py-2 font-display text-xs font-extrabold uppercase transition-all duration-150 cursor-pointer",
                      isActive
                        ? "bg-[image:var(--gradient-warm)] text-primary-foreground shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
                        : "border border-border bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <DishGlyph dish={r.id} className="h-5 w-7 shrink-0" />
                    <span>{r.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty Selector */}
          <div className="sm:border-l sm:border-border/70 sm:pl-5">
            <span className="block font-mono text-[10px] font-extrabold tracking-[0.24em] text-muted-foreground uppercase">
              Difficulty
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { id: "easy", label: "EASY" },
                  { id: "medium", label: "MEDIUM" },
                  { id: "hard", label: "HARD" },
                  { id: "masterchef", label: "MASTERCHEF" },
                ] as const
              ).map((d) => {
                const isActive = d.id === selectedDifficulty;
                const Icon = difficultyIcons[d.id];
                const config = DIFFICULTY_CONFIGS[d.id];
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDifficulty(d.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-xs font-extrabold tracking-wider uppercase transition-all duration-150 cursor-pointer",
                      isActive
                        ? config.colorClass + " shadow-xs font-black ring-1 ring-primary/40"
                        : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* PLAYER STATUS BANNER */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Active Chef Profile
              </p>
              <p className="font-display text-base font-extrabold text-foreground">
                {formatChefDisplayName(chefName || "Asef")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            {playerRankEntry ? (
              <div className="flex items-center gap-2 rounded-xl border border-signal-alt/40 bg-signal-alt/10 px-3 py-1.5 font-bold text-signal-alt">
                <Sparkles className="h-4 w-4" />
                <span>
                  YOUR RANK: #{playerRankEntry.rank} · {playerRankEntry.score} pts ({playerRankEntry.accuracy}% Match)
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-secondary px-3 py-1.5 font-semibold text-muted-foreground">
                YOUR STATUS: Not ranked in this category yet
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 font-mono text-[11px] font-bold text-destructive transition-all hover:bg-destructive/20 cursor-pointer"
              title="Log out of active chef profile"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </section>

        {/* LEADERBOARD ENTRIES LIST */}
        <section className="mt-6">
          <div className="kitchen-card overflow-hidden p-0">
            {/* Category Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-secondary/40 px-6 py-4">
              <div className="flex items-center gap-2">
                <DishGlyph dish={selectedRecipe.id} className="h-6 w-8 shrink-0" />
                <h2 className="font-display text-lg font-extrabold text-foreground uppercase">
                  {selectedRecipe.name}
                </h2>
                <span className="text-muted-foreground">·</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-xs font-bold",
                    currentDiffConfig.colorClass,
                  )}
                >
                  <DiffIcon className="h-3 w-3" />
                  {currentDiffConfig.badge} ({currentDiffConfig.timeDisplay})
                </span>
              </div>
              <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {entries.length} Entries Recorded
              </p>
            </div>

            {/* List or Empty State */}
            {entries.length > 0 ? (
              <div className="divide-y divide-border/60">
                {entries.map((entry) => {
                  const isCurrentPlayer = isChefMatch(entry.chefName, chefName || "Asef");

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors",
                        isCurrentPlayer
                          ? "bg-primary/15 border-l-4 border-l-primary shadow-xs"
                          : "hover:bg-secondary/30",
                      )}
                    >
                      {/* Rank + Chef Name */}
                      <div className="flex items-center gap-4">
                        <RankBadge rank={entry.rank} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-base font-extrabold text-foreground">
                              {formatChefDisplayName(entry.chefName)}
                            </span>
                            {isCurrentPlayer && (
                              <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] font-extrabold text-primary-foreground uppercase shadow-xs">
                                YOU
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            Time Left: {entry.timeRemaining} · {entry.date}
                          </p>
                        </div>
                      </div>

                      {/* Score & Accuracy */}
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="font-display text-xl font-extrabold text-gradient-warm">
                            {entry.score}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {entry.accuracy}% Match
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-border bg-secondary text-muted-foreground shadow-inner">
                  <Trophy className="h-7 w-7 opacity-40" />
                </div>
                <h3 className="mt-4 font-display text-xl font-extrabold text-foreground uppercase">
                  NO SCORES YET
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Be the first chef to complete the {selectedRecipe.name} challenge on{" "}
                  {currentDiffConfig.name} difficulty!
                </p>
                <Link to="/recipe-book" className="mt-5">
                  <GameButton size="sm" className="uppercase font-bold tracking-wider">
                    Cook {selectedRecipe.name} →
                  </GameButton>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* BOTTOM NAVIGATION */}
        <footer className="mt-8 flex items-center justify-between border-t border-border/80 pt-6">
          <Link to="/menu">
            <GameButton variant="secondary" size="lg" className="uppercase">
              ← Back to Main Menu
            </GameButton>
          </Link>
          <Link to="/recipe-book">
            <GameButton size="lg" className="uppercase font-bold tracking-wider">
              Start Cooking →
            </GameButton>
          </Link>
        </footer>
      </div>

      <LogoutModal open={isLogoutModalOpen} onOpenChange={setIsLogoutModalOpen} />
    </main>
  );
}
