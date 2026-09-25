import { useEffect, useState } from "react";
import { type RecipeDifficulty } from "@/lib/recipes";

export interface LeaderboardEntry {
  id: string;
  rank: number;
  chefName: string;
  recipeId: string;
  difficulty: RecipeDifficulty;
  score: number;
  accuracy: number;
  timeRemaining: string;
  date: string;
}

export function formatChefDisplayName(name: string): string {
  const clean = name.trim().replace(/^chef\s+/i, "");
  return clean ? `Chef ${clean}` : "Chef Anonymous";
}

export function isChefMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const cleanA = a
    .trim()
    .toLowerCase()
    .replace(/^chef\s+/, "");
  const cleanB = b
    .trim()
    .toLowerCase()
    .replace(/^chef\s+/, "");
  return cleanA === cleanB;
}

/** Name recorded for runs finished without a chef signed in. */
export const ANONYMOUS_CHEF = "Anonymous";

const LEADERBOARD_STORAGE_KEY = "wavebakery_leaderboard_entries";

export function getSavedLeaderboardEntries(): Omit<LeaderboardEntry, "rank">[] {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as Omit<LeaderboardEntry, "rank">[];
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export function addLeaderboardEntry(entry: Omit<LeaderboardEntry, "rank">) {
  if (typeof window !== "undefined") {
    try {
      const existing = getSavedLeaderboardEntries();
      // Filter out older lower scores for the exact same chef, recipe, and difficulty
      const otherRuns = existing.filter(
        (e) =>
          e.id !== entry.id &&
          !(
            isChefMatch(e.chefName, entry.chefName) &&
            e.recipeId === entry.recipeId &&
            e.difficulty === entry.difficulty
          ),
      );
      // If there was an existing run for this chef and this run scored higher, keep the higher score
      const previousRun = existing.find(
        (e) =>
          isChefMatch(e.chefName, entry.chefName) &&
          e.recipeId === entry.recipeId &&
          e.difficulty === entry.difficulty,
      );
      const bestEntry = previousRun && previousRun.score > entry.score ? previousRun : entry;

      const updated = [bestEntry, ...otherRuns];
      window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("wavebakery_leaderboard_changed"));
    } catch {
      // ignore
    }
  }
}

/**
 * Returns sorted leaderboard rankings for a specific recipe and difficulty,
 * from the runs saved on this device. (Invented benchmark chefs used to be
 * ranked alongside real runs, including recipes that don't exist.)
 */
export function getLeaderboard(
  recipeId: string,
  difficulty: RecipeDifficulty,
  currentChefName?: string | null,
): LeaderboardEntry[] {
  const filtered = getSavedLeaderboardEntries().filter(
    (e) => e.recipeId === recipeId && e.difficulty === difficulty,
  );

  return filtered
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export function useLeaderboard(
  recipeId: string,
  difficulty: RecipeDifficulty,
  currentChefName?: string | null,
): LeaderboardEntry[] {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() =>
    getLeaderboard(recipeId, difficulty, currentChefName),
  );

  useEffect(() => {
    const update = () => {
      setEntries(getLeaderboard(recipeId, difficulty, currentChefName));
    };
    update();
    window.addEventListener("wavebakery_leaderboard_changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("wavebakery_leaderboard_changed", update);
      window.removeEventListener("storage", update);
    };
  }, [recipeId, difficulty, currentChefName]);

  return entries;
}
