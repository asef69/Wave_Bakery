import { useEffect, useState } from "react";
import {
  DIFFICULTY_CONFIGS,
  getChefName,
  getRecipeRunSession,
  recipes,
  type RecipeDifficulty,
} from "@/lib/recipes";

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
  const cleanA = a.trim().toLowerCase().replace(/^chef\s+/, "");
  const cleanB = b.trim().toLowerCase().replace(/^chef\s+/, "");
  return cleanA === cleanB;
}

export const MOCK_LEADERBOARD_ENTRIES: Omit<LeaderboardEntry, "rank">[] = [
  // Burger
  {
    id: "b-m-1",
    chefName: "SignalMaster",
    recipeId: "burger",
    difficulty: "masterchef",
    score: 980,
    accuracy: 98,
    timeRemaining: "0:14",
    date: "Today",
  },
  {
    id: "b-m-2",
    chefName: "FourierFan",
    recipeId: "burger",
    difficulty: "masterchef",
    score: 950,
    accuracy: 95,
    timeRemaining: "0:09",
    date: "Today",
  },
  {
    id: "b-m-3",
    chefName: "WaveChef",
    recipeId: "burger",
    difficulty: "masterchef",
    score: 930,
    accuracy: 93,
    timeRemaining: "0:06",
    date: "Yesterday",
  },
  {
    id: "b-m-4",
    chefName: "ChefBob",
    recipeId: "burger",
    difficulty: "masterchef",
    score: 910,
    accuracy: 91,
    timeRemaining: "0:04",
    date: "2d ago",
  },
  {
    id: "b-m-5",
    chefName: "KitchenFourier",
    recipeId: "burger",
    difficulty: "masterchef",
    score: 880,
    accuracy: 88,
    timeRemaining: "0:02",
    date: "3d ago",
  },

  {
    id: "b-h-1",
    chefName: "SineWaveQueen",
    recipeId: "burger",
    difficulty: "hard",
    score: 970,
    accuracy: 97,
    timeRemaining: "0:38",
    date: "Today",
  },
  {
    id: "b-h-2",
    chefName: "AudioGourmet",
    recipeId: "burger",
    difficulty: "hard",
    score: 940,
    accuracy: 94,
    timeRemaining: "0:25",
    date: "Yesterday",
  },
  {
    id: "b-h-3",
    chefName: "ConvolveKing",
    recipeId: "burger",
    difficulty: "hard",
    score: 910,
    accuracy: 91,
    timeRemaining: "0:12",
    date: "2d ago",
  },
  {
    id: "b-h-4",
    chefName: "ByteBaker",
    recipeId: "burger",
    difficulty: "hard",
    score: 890,
    accuracy: 89,
    timeRemaining: "0:08",
    date: "4d ago",
  },

  {
    id: "b-med-1",
    chefName: "NyquistPro",
    recipeId: "burger",
    difficulty: "medium",
    score: 990,
    accuracy: 99,
    timeRemaining: "1:15",
    date: "Today",
  },
  {
    id: "b-med-2",
    chefName: "LowpassChef",
    recipeId: "burger",
    difficulty: "medium",
    score: 940,
    accuracy: 94,
    timeRemaining: "0:45",
    date: "Yesterday",
  },
  {
    id: "b-med-3",
    chefName: "DeltaFunction",
    recipeId: "burger",
    difficulty: "medium",
    score: 910,
    accuracy: 91,
    timeRemaining: "0:30",
    date: "3d ago",
  },

  {
    id: "b-e-1",
    chefName: "HarmonicBaker",
    recipeId: "burger",
    difficulty: "easy",
    score: 1000,
    accuracy: 100,
    timeRemaining: "2:40",
    date: "Today",
  },
  {
    id: "b-e-2",
    chefName: "SignalStudent",
    recipeId: "burger",
    difficulty: "easy",
    score: 950,
    accuracy: 95,
    timeRemaining: "1:55",
    date: "Yesterday",
  },

  // Cake / Berry Tart
  {
    id: "c-m-1",
    chefName: "PastryFilter",
    recipeId: "cake",
    difficulty: "masterchef",
    score: 960,
    accuracy: 96,
    timeRemaining: "0:11",
    date: "Today",
  },
  {
    id: "c-m-2",
    chefName: "SweetFourier",
    recipeId: "cake",
    difficulty: "masterchef",
    score: 920,
    accuracy: 92,
    timeRemaining: "0:05",
    date: "Yesterday",
  },
  {
    id: "c-m-3",
    chefName: "BakerLaplace",
    recipeId: "cake",
    difficulty: "masterchef",
    score: 890,
    accuracy: 89,
    timeRemaining: "0:02",
    date: "3d ago",
  },

  {
    id: "c-h-1",
    chefName: "SugarSpectrum",
    recipeId: "cake",
    difficulty: "hard",
    score: 950,
    accuracy: 95,
    timeRemaining: "0:32",
    date: "Today",
  },
  {
    id: "c-h-2",
    chefName: "ButterWave",
    recipeId: "cake",
    difficulty: "hard",
    score: 900,
    accuracy: 90,
    timeRemaining: "0:15",
    date: "Yesterday",
  },

  {
    id: "c-med-1",
    chefName: "GlazeConvolve",
    recipeId: "cake",
    difficulty: "medium",
    score: 970,
    accuracy: 97,
    timeRemaining: "1:02",
    date: "Today",
  },
  {
    id: "c-med-2",
    chefName: "FlourPower",
    recipeId: "cake",
    difficulty: "medium",
    score: 920,
    accuracy: 92,
    timeRemaining: "0:41",
    date: "2d ago",
  },

  // Soup
  {
    id: "s-m-1",
    chefName: "BrothResonator",
    recipeId: "soup",
    difficulty: "masterchef",
    score: 970,
    accuracy: 97,
    timeRemaining: "0:15",
    date: "Today",
  },
  {
    id: "s-m-2",
    chefName: "SoupSampling",
    recipeId: "soup",
    difficulty: "masterchef",
    score: 940,
    accuracy: 94,
    timeRemaining: "0:08",
    date: "Yesterday",
  },

  {
    id: "s-h-1",
    chefName: "SimmerSignal",
    recipeId: "soup",
    difficulty: "hard",
    score: 960,
    accuracy: 96,
    timeRemaining: "0:40",
    date: "Today",
  },
  {
    id: "s-h-2",
    chefName: "UmamiOscillator",
    recipeId: "soup",
    difficulty: "hard",
    score: 910,
    accuracy: 91,
    timeRemaining: "0:21",
    date: "Yesterday",
  },

  // Pizza
  {
    id: "p-m-1",
    chefName: "CrustConvolution",
    recipeId: "pizza",
    difficulty: "masterchef",
    score: 950,
    accuracy: 95,
    timeRemaining: "0:07",
    date: "Today",
  },
  {
    id: "p-h-1",
    chefName: "CheesyFourier",
    recipeId: "pizza",
    difficulty: "hard",
    score: 930,
    accuracy: 93,
    timeRemaining: "0:29",
    date: "Yesterday",
  },

  // Ramen
  {
    id: "r-m-1",
    chefName: "NoodleNyquist",
    recipeId: "ramen",
    difficulty: "masterchef",
    score: 990,
    accuracy: 99,
    timeRemaining: "0:18",
    date: "Today",
  },
  {
    id: "r-m-2",
    chefName: "ShoyuSignal",
    recipeId: "ramen",
    difficulty: "masterchef",
    score: 930,
    accuracy: 93,
    timeRemaining: "0:05",
    date: "Yesterday",
  },
];

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
      const bestEntry =
        previousRun && previousRun.score > entry.score ? previousRun : entry;

      const updated = [bestEntry, ...otherRuns];
      window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("wavebakery_leaderboard_changed"));
    } catch {
      // ignore
    }
  }
}

/**
 * Persists the current dish run score to the leaderboard and localStorage.
 */
export function saveCurrentDishScoreToLeaderboard(opts?: {
  recipeId?: string;
  accuracy?: number;
  deliveryBonus?: number;
}): LeaderboardEntry {
  const session = getRecipeRunSession();
  const rawChefName = getChefName() || "Asef";
  const activeRecipe =
    recipes.find((r) => r.id === (opts?.recipeId ?? session?.recipeId)) ?? recipes[0]!;
  const diff = session?.difficulty ?? "easy";
  const diffConfig = DIFFICULTY_CONFIGS[diff];

  // Compute remaining time
  let remainingSec = 0;
  let formattedTime = diffConfig.timeDisplay;
  if (session) {
    const elapsed = session.endTime
      ? Math.floor((session.endTime - session.startTime) / 1000)
      : Math.floor((Date.now() - session.startTime) / 1000);
    remainingSec = Math.max(0, session.totalSeconds - elapsed);
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    formattedTime = `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Calculate accuracies
  const stageAccuracies = [
    session?.filteringAccuracy,
    session?.mixingAccuracy,
    session?.seasoningAccuracy,
    session?.marinatingAccuracy,
    session?.cookingAccuracy,
  ].filter((v): v is number => typeof v === "number");

  const stageAvg =
    stageAccuracies.length > 0
      ? Math.round(stageAccuracies.reduce((a, b) => a + b, 0) / stageAccuracies.length)
      : 92;

  const similarity = opts?.accuracy ?? stageAvg;

  const diffMultiplier =
    diff === "masterchef"
      ? 2.0
      : diff === "hard"
        ? 1.5
        : diff === "medium"
          ? 1.2
          : 1.0;

  const deliveryBonus =
    opts?.deliveryBonus ??
    (session?.deliveryAccuracy ? Math.round(session.deliveryAccuracy * 1.5) : 0);
  const timeBonus = remainingSec * 2;
  const totalScore =
    Math.round((similarity * 0.5 + stageAvg * 0.5) * 10 * diffMultiplier) +
    timeBonus +
    deliveryBonus;

  const startTime = session?.startTime ?? Date.now();
  const entryId = `run-${activeRecipe.id}-${diff}-${startTime}`;

  const entry: Omit<LeaderboardEntry, "rank"> = {
    id: entryId,
    chefName: rawChefName,
    recipeId: activeRecipe.id,
    difficulty: diff,
    score: totalScore,
    accuracy: similarity,
    timeRemaining: formattedTime,
    date: "Today",
  };

  addLeaderboardEntry(entry);

  return {
    ...entry,
    rank: 1,
  };
}

/**
 * Returns sorted leaderboard rankings for a specific recipe and difficulty.
 * Merges player saved runs from localStorage with benchmark entries.
 */
export function getLeaderboard(
  recipeId: string,
  difficulty: RecipeDifficulty,
  currentChefName?: string | null,
): LeaderboardEntry[] {
  const savedEntries = getSavedLeaderboardEntries();
  const allEntries = [...savedEntries, ...MOCK_LEADERBOARD_ENTRIES];

  const filtered = allEntries.filter(
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
