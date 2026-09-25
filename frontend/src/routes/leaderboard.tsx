import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  Award,
  BarChart3,
  ChefHat,
  Clock,
  Flame,
  Globe,
  Medal,
  RefreshCw,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

import { ChefAuthModal } from "@/components/game/ChefAuthModal";
import { ChefFourier } from "@/components/game/ChefFourier";
import { DishGlyph } from "@/components/game/DishGlyph";
import { GameButton } from "@/components/game/GameButton";
import { GlobalRankRow, GlobalStats, LeaderboardRow, api } from "@/lib/api";
import { formatChefDisplayName, isChefMatch, useLeaderboard } from "@/lib/leaderboard";
import {
  DIFFICULTY_CONFIGS,
  getRecipeRunSession,
  recipes,
  submitRunToBackend,
  useChefName,
  type RecipeDifficulty,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard & Analytics — WaveBakery" },
      {
        name: "description",
        content:
          "Authoritative DSP culinary rankings, global career leaderboards, and dish analytics for WaveBakery.",
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
  const [viewMode, setViewMode] = useState<"recipe" | "global" | "analytics">("recipe");
  // Open on the recipe just played, not always the first one.
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(() => {
    const played = getRecipeRunSession()?.recipeId;
    return recipes.some((r) => r.id === played) ? played! : (recipes[0]?.id ?? "burger");
  });
  const [selectedDifficulty, setSelectedDifficulty] = useState<RecipeDifficulty>(
    () => getRecipeRunSession()?.difficulty ?? "easy",
  );
  const [chefName] = useChefName();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Backend state
  const [backendRows, setBackendRows] = useState<LeaderboardRow[] | null>(null);
  const [globalRows, setGlobalRows] = useState<GlobalRankRow[] | null>(null);
  const [analytics, setAnalytics] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);

  // Local offline fallback
  const fallbackEntries = useLeaderboard(selectedRecipeId, selectedDifficulty, chefName);
  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? recipes[0]!;

  const fetchBackendData = async () => {
    setIsLoading(true);
    try {
      if (viewMode === "recipe") {
        const rows = await api.getLeaderboard(selectedRecipeId, 30, selectedDifficulty);
        setBackendRows(rows);
        setBackendConnected(true);
      } else if (viewMode === "global") {
        const rows = await api.getGlobalRanking(30);
        setGlobalRows(rows);
        setBackendConnected(true);
      } else if (viewMode === "analytics") {
        const stats = await api.getStats();
        setAnalytics(stats);
        setBackendConnected(true);
      }
    } catch {
      setBackendConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // A finished run whose submit never reached the server (backend was down
  // at the score screen) is still an active session there: serve it now.
  const [pendingRun, setPendingRun] = useState<{
    recipeId: string;
    score?: number | undefined;
  } | null>(null);
  const retryPendingSubmit = async () => {
    const session = getRecipeRunSession();
    if (!session?.isCompleted || !session.backendSessionId || session.backendSubmitResult) {
      setPendingRun(null);
      return;
    }
    setPendingRun({ recipeId: session.recipeId, score: session.finalScore });
    const result = await submitRunToBackend(session.recipeId);
    if (result) {
      setPendingRun(null);
      fetchBackendData();
    }
  };

  useEffect(() => {
    retryPendingSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchBackendData();
    // fetchBackendData is recreated every render; these are its real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedRecipeId, selectedDifficulty]);

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
                Authoritative DSP Rankings
              </p>
              {backendConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Server
                </span>
              )}
            </div>
            <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-foreground uppercase sm:text-5xl">
              LEADER<span className="text-gradient-warm">BOARD</span>
            </h1>
            <p className="mt-1 text-base font-semibold text-muted-foreground">
              Official signal culinary scores, global rankings, and kitchen analytics.
            </p>
          </div>

          <div className="flex flex-col items-end">
            <ChefFourier
              size="sm"
              float={false}
              bubbleSide="left"
              message="Fourier accuracy & spatial beam precision separate amateur cooks from MasterChefs!"
            />
          </div>
        </header>

        {/* TOP TAB SWITCHER: RECIPE / GLOBAL / ANALYTICS */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-2xl border border-border bg-card/80 p-1.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("recipe")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-extrabold uppercase transition-all cursor-pointer",
                viewMode === "recipe"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>Recipe Ranks</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("global")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-extrabold uppercase transition-all cursor-pointer",
                viewMode === "global"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Global Chefs</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("analytics")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-extrabold uppercase transition-all cursor-pointer",
                viewMode === "analytics"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Kitchen Analytics</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchBackendData}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-2 font-mono text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>

        {/* ACTIVE CHEF BANNER */}
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
                {formatChefDisplayName(chefName || "Chef Anonymous")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-1.5 font-mono text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Manage Profile / Switch Chef</span>
            </button>
          </div>
        </section>

        {/* VIEW 1: RECIPE LEADERBOARDS */}
        {viewMode === "recipe" && (
          <>
            {/* CONTROLS BAR: RECIPE + DIFFICULTY FILTER */}
            <section className="mt-6 grid gap-4 rounded-3xl border border-border bg-card/60 p-5 shadow-sm sm:grid-cols-[1fr_auto]">
              {/* Recipe Selector */}
              <div>
                <label className="block font-mono text-[10px] font-extrabold tracking-[0.24em] text-muted-foreground uppercase">
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

            {/* LEADERBOARD ENTRIES LIST */}
            <section className="mt-6">
              <div className="kitchen-card overflow-hidden p-0">
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
                    {backendRows && backendRows.length > 0
                      ? `${backendRows.length} Authoritative Entries`
                      : `${fallbackEntries.length} Local Entries`}
                  </p>
                </div>

                {pendingRun && pendingRun.recipeId === selectedRecipeId && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-6 py-3 font-mono text-xs text-amber-500">
                    <span>
                      Your latest run{pendingRun.score != null ? ` (${pendingRun.score} pts)` : ""}{" "}
                      hasn&apos;t reached the server yet — the backend was offline when you
                      finished.
                    </span>
                    <button
                      type="button"
                      onClick={retryPendingSubmit}
                      className="rounded-lg border border-amber-500/50 px-2.5 py-1 font-bold uppercase hover:bg-amber-500/20 cursor-pointer"
                    >
                      Retry submit
                    </button>
                  </div>
                )}

                {backendRows && backendRows.length > 0 ? (
                  <div className="divide-y divide-border/60">
                    {backendRows.map((entry) => {
                      const isCurrentPlayer = isChefMatch(entry.handle, chefName);

                      return (
                        <div
                          key={`${entry.player_id}-${entry.created_at}`}
                          className={cn(
                            "flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors",
                            isCurrentPlayer
                              ? "bg-primary/15 border-l-4 border-l-primary shadow-xs"
                              : "hover:bg-secondary/30",
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <RankBadge rank={entry.rank} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-display text-base font-extrabold text-foreground">
                                  {formatChefDisplayName(entry.handle)}
                                </span>
                                {isCurrentPlayer && (
                                  <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] font-extrabold text-primary-foreground uppercase shadow-xs">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {"⭐".repeat(entry.stars)} ·{" "}
                                {new Date(entry.created_at).toLocaleDateString()}
                                {entry.difficulty ? "" : " · difficulty not recorded"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="font-display text-xl font-extrabold text-gradient-warm">
                                {entry.score}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                Authoritative Score
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : fallbackEntries.length > 0 ? (
                  <div className="divide-y divide-border/60">
                    {fallbackEntries.map((entry) => {
                      const isCurrentPlayer = isChefMatch(entry.chefName, chefName);

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
          </>
        )}

        {/* VIEW 2: GLOBAL CAREER RANKINGS */}
        {viewMode === "global" && (
          <section className="mt-6">
            <div className="kitchen-card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border/80 bg-secondary/40 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-extrabold text-foreground uppercase">
                    Global Career Chef Rankings
                  </h2>
                </div>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  Ranked by Lifetime Points
                </p>
              </div>

              {globalRows && globalRows.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {globalRows.map((chef) => {
                    const isCurrent = isChefMatch(chef.handle, chefName);
                    return (
                      <div
                        key={chef.player_id}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors",
                          isCurrent
                            ? "bg-primary/15 border-l-4 border-l-primary"
                            : "hover:bg-secondary/30",
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <RankBadge rank={chef.rank} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display text-base font-extrabold text-foreground">
                                {formatChefDisplayName(chef.handle)}
                              </span>
                              <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                                {chef.rank_title}
                              </span>
                              {isCurrent && (
                                <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] font-extrabold text-primary-foreground uppercase shadow-xs">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {chef.dishes_served} Dishes Served · Best Dish: {chef.best_score} pts
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-display text-2xl font-extrabold text-gradient-warm">
                            {chef.points}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground uppercase">
                            Lifetime Points
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-10 text-center font-mono text-sm text-muted-foreground">
                  No global player records registered yet. Serve dishes to enter the hall of fame!
                </div>
              )}
            </div>
          </section>
        )}

        {/* VIEW 3: KITCHEN DSP ANALYTICS */}
        {viewMode === "analytics" && (
          <section className="mt-6 space-y-6">
            {/* Global Summary Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="kitchen-card p-4 text-center">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">Total Chefs</p>
                <p className="font-display text-3xl font-extrabold text-primary">
                  {analytics?.players ?? 1}
                </p>
              </div>
              <div className="kitchen-card p-4 text-center">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">
                  Dishes Served
                </p>
                <p className="font-display text-3xl font-extrabold text-foreground">
                  {analytics?.dishes_served ?? 0}
                </p>
              </div>
              <div className="kitchen-card p-4 text-center">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">
                  Avg Dish Score
                </p>
                <p className="font-display text-3xl font-extrabold text-amber-500">
                  {analytics?.average_score ?? 0}
                </p>
              </div>
              <div className="kitchen-card p-4 text-center">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">
                  Hardest Dish
                </p>
                <p className="font-display text-lg font-extrabold text-rose-500 truncate">
                  {analytics?.hardest_recipe ?? "Grand Feast"}
                </p>
              </div>
            </div>

            {/* Per-Recipe Breakdown */}
            <div className="kitchen-card overflow-hidden p-0">
              <div className="border-b border-border/80 bg-secondary/40 px-6 py-4">
                <h3 className="font-display text-base font-extrabold text-foreground uppercase">
                  Recipe Difficulty & Five-Star Rate Analysis
                </h3>
              </div>
              <div className="divide-y divide-border/60">
                {(analytics?.recipes ?? []).map((r) => (
                  <div
                    key={r.recipe_id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <DishGlyph dish={r.recipe_id} className="h-6 w-8 shrink-0" />
                      <div>
                        <p className="font-display text-sm font-extrabold text-foreground">
                          {r.recipe_name}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          Tier {r.tier} Dish
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right font-mono text-xs">
                      <div>
                        <p className="font-extrabold text-foreground">{r.plays} plays</p>
                        <p className="text-[10px] text-muted-foreground">Attempts</p>
                      </div>
                      <div>
                        <p className="font-extrabold text-primary">{r.average_score} pts</p>
                        <p className="text-[10px] text-muted-foreground">Avg Score</p>
                      </div>
                      <div>
                        <p className="font-extrabold text-amber-500">
                          {Math.round(r.five_star_rate * 100)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">5-Star Rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

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

      <ChefAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => fetchBackendData()}
      />
    </main>
  );
}
