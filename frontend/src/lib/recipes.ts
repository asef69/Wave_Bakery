import { useEffect, useState, useCallback } from "react";
import { getMathematicalSignal } from "./signals";
import { getIdealDishSignal, getOrSaveExpectedSignal } from "./pipeline";
import { api, type SubmitResult } from "./api";
import { pauseAllActiveAudio, resumeAllActiveAudio } from "./audio";

export * from "./signals";
export * from "./pipeline";
export * from "./api";

export type PipelineStep =
  | "GENERATE"
  | "FILTER"
  | "MIX"
  | "AMPLITUDE"
  | "TIME SCALE"
  | "TIME SHIFT"
  | "CONVOLUTION"
  | "COMPARE";

export type CookingMethod = {
  id: "grill" | "fry" | "bake" | "boil";
  name: string;
  icon: string;
  ir: string;
};

export type IngredientDetail = {
  name: string;
  instrument: string;
  freq: number;
  washable: boolean;
  idealCutoff?: number;
  kind?:
    | "lettuce"
    | "tomato"
    | "onion"
    | "cucumber"
    | "carrot"
    | "egg"
    | "cheese"
    | "butter"
    | "patty"
    | "chicken"
    | "noodles"
    | "bread"
    | "bun"
    | "flour"
    | "sugar"
    | "milk"
    | "salt"
    | "sauce"
    | "generic";
  category?: "Produce" | "Protein" | "Bakery" | "Dairy" | "Pantry";
  emoji?: string;
};

export type RecipeStep = {
  stepNumber: string;
  icon: string;
  action: string;
  instruction: string;
  technicalLabel: string;
  targets?: { label: string; value: string }[];
};

export type Recipe = {
  id: string;
  name: string;
  tagline: string;
  ingredients: string[];
  ingredientDetails: IngredientDetail[];
  difficulty: "Easy" | "Medium" | "Hard";
  tier?: number;
  pipeline: PipelineStep[];
  progress: "locked" | "new" | "in-progress" | "complete";
  bestScore: number | null;
  stars: number;
  pageNumber: number;
  prepTime: string;
  servings: string;
  seasoningTarget: { amplitude: number; frequency: number };
  marinateTarget: { timeScale: number };
  cookingMethod: CookingMethod;
  washableIngredients: string[];
  steps: RecipeStep[];
};

export const recipes: Recipe[] = [
  {
    id: "burger",
    name: "BURGER",
    tagline: "Stack the layers, stack the signals.",
    pageNumber: 1,
    prepTime: "5 mins",
    servings: "1 hearty burger",
    ingredients: ["Bun", "Beef Patty", "Cheese", "Lettuce", "Tomato", "Salt"],
    ingredientDetails: [
      { name: "Bun", instrument: "Mathematical Signal", freq: 3, washable: false, kind: "bun" },
      {
        name: "Beef Patty",
        instrument: "Parametric Signal",
        freq: 2,
        washable: false,
        kind: "patty",
      },
      {
        name: "Cheese",
        instrument: "Mathematical Signal",
        freq: 6,
        washable: false,
        kind: "cheese",
      },
      {
        name: "Lettuce",
        instrument: "Parametric Signal",
        freq: 3,
        washable: true,
        idealCutoff: 380,
        kind: "lettuce",
      },
      {
        name: "Tomato",
        instrument: "Parametric Signal",
        freq: 5,
        washable: true,
        idealCutoff: 520,
        kind: "tomato",
      },
      { name: "Salt", instrument: "Mathematical Signal", freq: 12, washable: false, kind: "salt" },
    ],
    difficulty: "Easy",
    pipeline: ["GENERATE", "FILTER", "MIX", "AMPLITUDE", "TIME SCALE", "CONVOLUTION", "COMPARE"],
    progress: "new",
    bestScore: null,
    stars: 0,
    seasoningTarget: { amplitude: 1.5, frequency: 0.8 },
    marinateTarget: { timeScale: 1.25 },
    cookingMethod: { id: "grill", name: "GRILL", icon: "🔥", ir: "GRILL (sharp spiky taps)" },
    washableIngredients: ["Lettuce", "Tomato"],
    steps: [
      {
        stepNumber: "01",
        icon: "🧼",
        action: "WASH / FILTER",
        instruction: "Filter unwanted noise frequencies from fresh ingredients",
        technicalLabel: "FREQUENCY FILTERING",
        targets: [{ label: "Goal", value: "Pure Waveform" }],
      },
      {
        stepNumber: "02",
        icon: "🥣",
        action: "MIX",
        instruction: "Combine all clean ingredient signals in the bowl",
        technicalLabel: "SUPERPOSITION / SIGNAL MIXING",
        targets: [{ label: "Signals", value: "Ingredient Tray" }],
      },
      {
        stepNumber: "03",
        icon: "🌶️",
        action: "SEASON",
        instruction: "Fine-tune amplitude and frequency dials to balance flavor character",
        technicalLabel: "SIGNAL TRANSFORMATION · AMPLITUDE / FREQUENCY SCALING",
        targets: [{ label: "Goal", value: "Match Target Wave" }],
      },
      {
        stepNumber: "04",
        icon: "🥩",
        action: "MARINATE",
        instruction: "Stretch the signal time scale for a deeper, fuller flavor profile",
        technicalLabel: "TIME TRANSFORMATION · TIME SCALING",
        targets: [{ label: "Goal", value: "Align Duration" }],
      },
      {
        stepNumber: "05",
        icon: "🔥",
        action: "COOK",
        instruction: "Grill the signal using the GRILL impulse response",
        technicalLabel: "CONVOLUTION · GRILL",
        targets: [
          { label: "Method", value: "GRILL" },
          { label: "Impulse", value: "Sharp spiky taps" },
        ],
      },
    ],
  },
  {
    id: "sandwich",
    name: "SANDWICH",
    tagline: "A crisp mix with a clean spectrum.",
    pageNumber: 2,
    prepTime: "3 mins",
    servings: "1 deli sandwich",
    ingredients: ["Bread", "Chicken", "Cheese", "Lettuce", "Tomato", "Salt", "Sauce"],
    ingredientDetails: [
      { name: "Bread", instrument: "Mathematical Signal", freq: 3, washable: false, kind: "bread" },
      {
        name: "Chicken",
        instrument: "Recorded Signal",
        freq: 2.5,
        washable: false,
        kind: "chicken",
      },
      {
        name: "Cheese",
        instrument: "Mathematical Signal",
        freq: 6,
        washable: false,
        kind: "cheese",
      },
      {
        name: "Lettuce",
        instrument: "Parametric Signal",
        freq: 3,
        washable: true,
        idealCutoff: 380,
        kind: "lettuce",
      },
      {
        name: "Tomato",
        instrument: "Parametric Signal",
        freq: 5,
        washable: true,
        idealCutoff: 520,
        kind: "tomato",
      },
      { name: "Salt", instrument: "Mathematical Signal", freq: 12, washable: false, kind: "salt" },
      { name: "Sauce", instrument: "Parametric Signal", freq: 4, washable: false, kind: "sauce" },
    ],
    difficulty: "Easy",
    pipeline: ["GENERATE", "FILTER", "MIX", "AMPLITUDE", "TIME SCALE", "CONVOLUTION", "COMPARE"],
    progress: "new",
    bestScore: null,
    stars: 0,
    seasoningTarget: { amplitude: 1.2, frequency: 1.1 },
    marinateTarget: { timeScale: 0.85 },
    cookingMethod: {
      id: "grill",
      name: "TOAST / GRILL",
      icon: "🔥",
      ir: "GRILL (light crisp taps)",
    },
    washableIngredients: ["Lettuce", "Tomato"],
    steps: [
      {
        stepNumber: "01",
        icon: "🧼",
        action: "WASH / FILTER",
        instruction: "Clean the crisp greens and sliced vegetables",
        technicalLabel: "FREQUENCY FILTERING",
        targets: [{ label: "Goal", value: "Pure Waveform" }],
      },
      {
        stepNumber: "02",
        icon: "🥣",
        action: "MIX",
        instruction: "Stack and combine the sandwich ingredients",
        technicalLabel: "SUPERPOSITION / SIGNAL MIXING",
        targets: [{ label: "Signals", value: "Ingredient Tray" }],
      },
      {
        stepNumber: "03",
        icon: "🌶️",
        action: "SEASON",
        instruction: "Adjust amplitude and frequency for a crisp, balanced profile",
        technicalLabel: "SIGNAL TRANSFORMATION · AMPLITUDE / FREQUENCY SCALING",
        targets: [{ label: "Goal", value: "Match Target Wave" }],
      },
      {
        stepNumber: "04",
        icon: "🥩",
        action: "MARINATE",
        instruction: "Apply time compression to tighten the flavor delivery",
        technicalLabel: "TIME TRANSFORMATION · TIME SCALING",
        targets: [{ label: "Goal", value: "Align Duration" }],
      },
      {
        stepNumber: "05",
        icon: "🔥",
        action: "COOK",
        instruction: "Toast lightly on the grill with a crisp impulse response",
        technicalLabel: "CONVOLUTION · GRILL",
        targets: [
          { label: "Method", value: "GRILL" },
          { label: "Impulse", value: "Light crisp taps" },
        ],
      },
    ],
  },
  {
    id: "cake",
    name: "CAKE",
    tagline: "Fold the harmonics gently.",
    pageNumber: 3,
    prepTime: "12 mins",
    servings: "1 whole sponge cake",
    ingredients: ["Flour", "Egg", "Butter", "Sugar", "Milk"],
    ingredientDetails: [
      { name: "Flour", instrument: "Mathematical Signal", freq: 2, washable: false, kind: "flour" },
      {
        name: "Egg",
        instrument: "Parametric Signal",
        freq: 4,
        washable: true,
        idealCutoff: 460,
        kind: "egg",
      },
      {
        name: "Butter",
        instrument: "Mathematical Signal",
        freq: 3,
        washable: false,
        kind: "butter",
      },
      { name: "Sugar", instrument: "Mathematical Signal", freq: 5, washable: false, kind: "sugar" },
      { name: "Milk", instrument: "Mathematical Signal", freq: 5, washable: false, kind: "milk" },
    ],
    difficulty: "Medium",
    pipeline: ["GENERATE", "MIX", "AMPLITUDE", "TIME SCALE", "CONVOLUTION", "COMPARE"],
    progress: "new",
    bestScore: null,
    stars: 0,
    seasoningTarget: { amplitude: 1.8, frequency: 0.6 },
    marinateTarget: { timeScale: 1.5 },
    cookingMethod: { id: "bake", name: "BAKE", icon: "🧁", ir: "BAKE (long smooth tail)" },
    washableIngredients: [],
    steps: [
      {
        stepNumber: "01",
        icon: "🥣",
        action: "MIX",
        instruction:
          "Gently whip the batter ingredients into superposition (no filtering required)",
        technicalLabel: "SUPERPOSITION / SIGNAL MIXING",
        targets: [{ label: "Signals", value: "Ingredient Tray" }],
      },
      {
        stepNumber: "02",
        icon: "🌶️",
        action: "SEASON",
        instruction: "Sweeten the harmonics: balance amplitude strength and frequency tone",
        technicalLabel: "SIGNAL TRANSFORMATION · AMPLITUDE / FREQUENCY SCALING",
        targets: [{ label: "Goal", value: "Match Target Wave" }],
      },
      {
        stepNumber: "03",
        icon: "🥩",
        action: "MARINATE",
        instruction: "Rest the batter to stretch rise time on the signal time axis",
        technicalLabel: "TIME TRANSFORMATION · TIME SCALING",
        targets: [{ label: "Goal", value: "Align Duration" }],
      },
      {
        stepNumber: "04",
        icon: "🧁",
        action: "COOK",
        instruction: "Bake in the oven with a long smooth impulse response",
        technicalLabel: "CONVOLUTION · BAKE",
        targets: [
          { label: "Method", value: "BAKE" },
          { label: "Impulse", value: "Long smooth tail" },
        ],
      },
    ],
  },
  {
    id: "noodles",
    name: "NOODLES",
    tagline: "Stretch the time axis, not the noodles.",
    pageNumber: 4,
    prepTime: "8 mins",
    servings: "1 steaming bowl",
    ingredients: ["Noodles", "Egg", "Chicken", "Onion", "Salt"],
    ingredientDetails: [
      {
        name: "Noodles",
        instrument: "Parametric Signal",
        freq: 3,
        washable: false,
        kind: "noodles",
      },
      {
        name: "Egg",
        instrument: "Parametric Signal",
        freq: 4,
        washable: true,
        idealCutoff: 460,
        kind: "egg",
      },
      {
        name: "Chicken",
        instrument: "Recorded Signal",
        freq: 2.5,
        washable: false,
        kind: "chicken",
      },
      {
        name: "Onion",
        instrument: "Parametric Signal",
        freq: 6,
        washable: true,
        idealCutoff: 640,
        kind: "onion",
      },
      { name: "Salt", instrument: "Mathematical Signal", freq: 12, washable: false, kind: "salt" },
    ],
    difficulty: "Medium",
    pipeline: ["GENERATE", "FILTER", "MIX", "AMPLITUDE", "TIME SCALE", "CONVOLUTION", "COMPARE"],
    progress: "new",
    bestScore: null,
    stars: 0,
    seasoningTarget: { amplitude: 1.3, frequency: 1.2 },
    marinateTarget: { timeScale: 1.75 },
    cookingMethod: { id: "boil", name: "BOIL", icon: "♨️", ir: "BOIL (slow rolling bubbles)" },
    washableIngredients: ["Onion", "Egg"],
    steps: [
      {
        stepNumber: "01",
        icon: "🧼",
        action: "WASH / FILTER",
        instruction: "Rinse and filter the aromatic scallions & onions",
        technicalLabel: "FREQUENCY FILTERING",
        targets: [{ label: "Goal", value: "Pure Waveform" }],
      },
      {
        stepNumber: "02",
        icon: "🥣",
        action: "MIX",
        instruction: "Combine noodles and savory broth signals in the bowl",
        technicalLabel: "SUPERPOSITION / SIGNAL MIXING",
        targets: [{ label: "Signals", value: "Ingredient Tray" }],
      },
      {
        stepNumber: "03",
        icon: "🌶️",
        action: "SEASON",
        instruction: "Spice the broth: adjust amplitude and frequency for a rich savory tone",
        technicalLabel: "SIGNAL TRANSFORMATION · AMPLITUDE / FREQUENCY SCALING",
        targets: [{ label: "Goal", value: "Match Target Wave" }],
      },
      {
        stepNumber: "04",
        icon: "🥩",
        action: "MARINATE",
        instruction: "Simmer to stretch the harmonic response across time",
        technicalLabel: "TIME TRANSFORMATION · TIME SCALING",
        targets: [{ label: "Goal", value: "Align Duration" }],
      },
      {
        stepNumber: "05",
        icon: "♨️",
        action: "COOK",
        instruction: "Boil with rolling bubble impulse response",
        technicalLabel: "CONVOLUTION · BOIL",
        targets: [
          { label: "Method", value: "BOIL" },
          { label: "Impulse", value: "Rolling bubbles" },
        ],
      },
    ],
  },
  {
    id: "chicken-fry",
    name: "CHICKEN FRY",
    tagline: "Crunch is just high-frequency content.",
    pageNumber: 5,
    prepTime: "10 mins",
    servings: "1 basket",
    ingredients: ["Chicken", "Flour", "Egg", "Salt", "Butter"],
    ingredientDetails: [
      {
        name: "Chicken",
        instrument: "Recorded Signal",
        freq: 2.5,
        washable: false,
        kind: "chicken",
      },
      { name: "Flour", instrument: "Mathematical Signal", freq: 2, washable: false, kind: "flour" },
      {
        name: "Egg",
        instrument: "Parametric Signal",
        freq: 4,
        washable: true,
        idealCutoff: 460,
        kind: "egg",
      },
      { name: "Salt", instrument: "Mathematical Signal", freq: 12, washable: false, kind: "salt" },
      {
        name: "Butter",
        instrument: "Mathematical Signal",
        freq: 3,
        washable: false,
        kind: "butter",
      },
    ],
    difficulty: "Hard",
    pipeline: ["GENERATE", "MIX", "AMPLITUDE", "TIME SCALE", "CONVOLUTION", "COMPARE"],
    progress: "new",
    bestScore: null,
    stars: 0,
    seasoningTarget: { amplitude: 2.0, frequency: 1.4 },
    marinateTarget: { timeScale: 1.4 },
    cookingMethod: { id: "fry", name: "FRY", icon: "🍳", ir: "FRY (dense noisy burst)" },
    washableIngredients: [],
    steps: [
      {
        stepNumber: "01",
        icon: "🥣",
        action: "MIX",
        instruction:
          "Coat chicken in egg wash and seasoned flour superposition (no filtering required)",
        technicalLabel: "SUPERPOSITION / SIGNAL MIXING",
        targets: [{ label: "Signals", value: "Ingredient Tray" }],
      },
      {
        stepNumber: "02",
        icon: "🌶️",
        action: "SEASON",
        instruction: "Amp up the spice: find the ideal amplitude and frequency crunch",
        technicalLabel: "SIGNAL TRANSFORMATION · AMPLITUDE / FREQUENCY SCALING",
        targets: [{ label: "Goal", value: "Match Target Wave" }],
      },
      {
        stepNumber: "03",
        icon: "🥩",
        action: "MARINATE",
        instruction: "Brine and rest the chicken to stretch the internal moisture profile",
        technicalLabel: "TIME TRANSFORMATION · TIME SCALING",
        targets: [{ label: "Goal", value: "Align Duration" }],
      },
      {
        stepNumber: "04",
        icon: "🍳",
        action: "COOK",
        instruction: "Deep fry using the dense noisy FRY impulse response",
        technicalLabel: "CONVOLUTION · FRY",
        targets: [
          { label: "Method", value: "FRY" },
          { label: "Impulse", value: "Dense noisy burst" },
        ],
      },
    ],
  },
];

export const progressLabel: Record<Recipe["progress"], string> = {
  locked: "Locked",
  new: "Not cooked yet",
  "in-progress": "In progress",
  complete: "Perfected",
};

export const BEST_SCORES_KEY = "wavebakery_recipe_best_scores";

export function getRecipeBestScores(): Record<string, number> {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(BEST_SCORES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed as Record<string, number>;
        }
      }
    } catch {
      // ignore
    }
  }
  return {};
}

export function getRecipeBestScore(recipeId: string): number | null {
  const scores = getRecipeBestScores();
  const val = scores[recipeId];
  return typeof val === "number" && !isNaN(val) ? val : null;
}

export function saveRecipeBestScore(recipeId: string, score: number): number {
  if (typeof window !== "undefined") {
    try {
      const scores = getRecipeBestScores();
      const current = scores[recipeId];
      const rounded = Math.round(score);
      if (current === undefined || rounded > current) {
        scores[recipeId] = rounded;
        window.localStorage.setItem(BEST_SCORES_KEY, JSON.stringify(scores));
        window.dispatchEvent(new Event("wavebakery_best_scores_changed"));
        window.dispatchEvent(new Event("wavebakery_recipe_changed"));
        return rounded;
      }
      return current;
    } catch {
      // ignore
    }
  }
  return Math.round(score);
}

export function useRecipeBestScores(): Record<string, number> {
  const [scores, setScores] = useState<Record<string, number>>(() => getRecipeBestScores());

  useEffect(() => {
    const handler = () => {
      setScores(getRecipeBestScores());
    };
    window.addEventListener("wavebakery_best_scores_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_best_scores_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return scores;
}

export function enrichRecipeWithBestScore(recipe: Recipe, scores?: Record<string, number>): Recipe {
  const bestScores = scores ?? getRecipeBestScores();
  const bestScore = bestScores[recipe.id] ?? null;
  const stars = bestScore !== null ? (bestScore >= 900 ? 3 : bestScore >= 700 ? 2 : 1) : 0;
  const progress: Recipe["progress"] =
    bestScore !== null ? (bestScore >= 900 ? "complete" : "in-progress") : "new";
  return {
    ...recipe,
    bestScore,
    stars,
    progress,
  };
}

let currentActiveRecipeId = "burger";

export function getActiveRecipe(): Recipe {
  let baseRecipe = recipes[0]!;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_active_recipe");
      if (stored) {
        const found = recipes.find((r) => r.id === stored);
        if (found) baseRecipe = found;
      }
    } catch {
      // ignore
    }
  } else {
    baseRecipe = recipes.find((r) => r.id === currentActiveRecipeId) ?? recipes[0]!;
  }
  return enrichRecipeWithBestScore(baseRecipe);
}

export function setActiveRecipe(id: string) {
  currentActiveRecipeId = id;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("wavebakery_active_recipe", id);
      window.dispatchEvent(new Event("wavebakery_recipe_changed"));
    } catch {
      // ignore
    }
  }
}

export function useActiveRecipe(): [Recipe, (id: string) => void] {
  const [recipe, setRecipeState] = useState<Recipe>(getActiveRecipe);

  useEffect(() => {
    const handler = () => {
      setRecipeState(getActiveRecipe());
    };
    window.addEventListener("wavebakery_recipe_changed", handler);
    window.addEventListener("wavebakery_best_scores_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_recipe_changed", handler);
      window.removeEventListener("wavebakery_best_scores_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setRecipe = (id: string) => {
    setActiveRecipe(id);
    setRecipeState(getActiveRecipe());
  };

  return [recipe, setRecipe];
}

export function getRecipeStationFlow(
  recipe?: Recipe,
): { id: string; label: string; path: string }[] {
  const r = recipe ?? getActiveRecipe();
  const steps: { id: string; label: string; path: string }[] = [
    { id: "generate", label: "Generate Signal", path: "/generate" },
    { id: "filter", label: "Filter Lab", path: "/filtering" },
    { id: "mix", label: "Mixing Lab", path: "/mixing" },
    { id: "season", label: "Seasoning Lab", path: "/transform" },
    { id: "marinate", label: "Marinating Lab", path: "/marinate" },
  ];

  steps.push(
    { id: "cook", label: "Cooking Lab", path: "/cooking" },
    { id: "system", label: "System Delivery", path: "/system-delivery" },
    { id: "score", label: "Final Comparison", path: "/score" },
    { id: "complete", label: "Complete", path: "/complete" },
  );

  return steps;
}

export function getNextStationPath(currentPath: string, recipe?: Recipe): string {
  const r = recipe ?? getActiveRecipe();
  const flow = getRecipeStationFlow(r);
  const idx = flow.findIndex((s) => s.path === currentPath);
  if (idx >= 0 && idx + 1 < flow.length) {
    return flow[idx + 1]!.path;
  }
  return "/score";
}

export function getPrevStationPath(currentPath: string, recipe?: Recipe): string {
  const r = recipe ?? getActiveRecipe();
  const flow = getRecipeStationFlow(r);
  const idx = flow.findIndex((s) => s.path === currentPath);
  if (idx > 0) {
    return flow[idx - 1]!.path;
  }
  return "/kitchen";
}

export function getUnlockedStage(recipeId?: string): number {
  if (typeof window !== "undefined") {
    try {
      const activeId = recipeId ?? getActiveRecipe().id;
      const key = `wavebakery_progress_${activeId}`;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val >= 1 && val <= 9) return val;
      }
    } catch {
      // ignore
    }
  }
  return 1;
}

export function setUnlockedStage(stage: number, recipeId?: string) {
  if (typeof window !== "undefined") {
    try {
      const activeId = recipeId ?? getActiveRecipe().id;
      const key = `wavebakery_progress_${activeId}`;
      const current = getUnlockedStage(activeId);
      if (stage > current) {
        window.localStorage.setItem(key, Math.min(9, stage).toString());
        window.dispatchEvent(new Event("wavebakery_progress_changed"));
      }
    } catch {
      // ignore
    }
  }
}

export type RecipeDifficulty = "easy" | "medium" | "hard" | "masterchef";

export interface DifficultyConfig {
  id: RecipeDifficulty;
  name: string;
  badge: string;
  timeSeconds: number;
  timeDisplay: string;
  description: string;
  tag: string;
  colorClass: string;
  dotClass: string;
}

export const DIFFICULTY_CONFIGS: Record<RecipeDifficulty, DifficultyConfig> = {
  easy: {
    id: "easy",
    name: "EASY",
    badge: "EASY",
    timeSeconds: 420, // 7:00 (+120s)
    timeDisplay: "7:00",
    description: "Comfortable time to learn the recipe.",
    tag: "Relaxed",
    colorClass: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    dotClass: "bg-emerald-500",
  },
  medium: {
    id: "medium",
    name: "MEDIUM",
    badge: "MEDIUM",
    timeSeconds: 300, // 5:00 (+90s)
    timeDisplay: "5:00",
    description: "A balanced challenge.",
    tag: "Standard",
    colorClass: "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
    dotClass: "bg-amber-500",
  },
  hard: {
    id: "hard",
    name: "HARD",
    badge: "HARD",
    timeSeconds: 190, // 3:10 (+70s)
    timeDisplay: "3:10",
    description: "Fast execution required.",
    tag: "Challenging",
    colorClass: "text-orange-600 dark:text-orange-400 border-orange-500/40 bg-orange-500/10",
    dotClass: "bg-orange-500",
  },
  masterchef: {
    id: "masterchef",
    name: "MASTERCHEF",
    badge: "MASTERCHEF",
    timeSeconds: 120, // 2:00 (+60s)
    timeDisplay: "2:00",
    description: "No room for hesitation.",
    tag: "Expert",
    colorClass: "text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10",
    dotClass: "bg-rose-500",
  },
};

/** Score multiplier per difficulty — DIFFICULTIES in backend/app/gameplay.py. */
export const DIFFICULTY_MULTIPLIERS: Record<RecipeDifficulty, number> = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.25,
  masterchef: 1.5,
};

export function difficultyMultiplier(difficulty: RecipeDifficulty | undefined): number {
  return (difficulty && DIFFICULTY_MULTIPLIERS[difficulty]) ?? 1.0;
}

export interface RecipeRunSession {
  recipeId: string;
  difficulty: RecipeDifficulty;
  totalSeconds: number;
  startTime: number;
  endTime?: number;
  isCompleted: boolean;
  finalScore?: number;
  finalStars?: number;
  backendSessionId?: string;
  backendSeed?: number;
  backendSubmitResult?: SubmitResult;
  seasonGain?: number;
  seasonFreq?: number;
  marinateTime?: number;
  cookingAppliance?: string;
  cookingPos?: number;
  filteringAccuracy?: number;
  mixingAccuracy?: number;
  seasoningAccuracy?: number;
  marinatingAccuracy?: number;
  cookingAccuracy?: number;
  deliveryAccuracy?: number;
  systemAccuracy?: number;
  // Settings the server needs to rebuild and score the dish.
  bowl?: string[];
  countdownPending?: boolean;
  isPaused?: boolean;
  pausedRemaining?: number;
  pausedAt?: number;
  systemPreset?: "lowpass1" | "resonator2" | "moving_avg" | "notch";
  systemPoleRadius?: number;
  systemSamplingHz?: number;
  systemOmega?: number;
  /** Precision Oven equaliser, in game Hz, relative to the dish fundamental f0. */
  ovenSettings?: {
    f0: number;
    gains: [number, number, number];
    cutoffHz: number;
    notchHz: number;
    notchOn: boolean;
    /** The oven's verified sampling rate: it edits only up to fs/2. */
    fs?: number;
  };
}

export function startRecipeRun(recipeId: string, difficulty: RecipeDifficulty) {
  if (typeof window !== "undefined") {
    // Reset progress and transient pipeline signals for this recipe to ensure clean isolation
    resetRecipeProgress(recipeId);

    // Ensure target expected signal is precomputed and persisted for the recipe
    getOrSaveExpectedSignal(recipeId);

    const config = DIFFICULTY_CONFIGS[difficulty];
    const session: RecipeRunSession = {
      recipeId,
      difficulty,
      totalSeconds: config.timeSeconds,
      startTime: Date.now(),
      isCompleted: false,
      countdownPending: false,
      isPaused: false,
    };
    window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
    window.dispatchEvent(new Event("wavebakery_session_changed"));

    // Connect to backend session asynchronously (only for a signed-in chef;
    // otherwise the run stays local).
    api
      .ensureAuthenticated()
      .then(() => api.createSession(recipeId, difficulty))
      .then((backendSession) => {
        const stored = window.localStorage.getItem("wavebakery_recipe_session");
        if (stored) {
          const current: RecipeRunSession = JSON.parse(stored);
          if (current.recipeId === recipeId && !current.isCompleted) {
            current.backendSessionId = backendSession.id;
            current.backendSeed = backendSession.seed;
            window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(current));
            window.dispatchEvent(new Event("wavebakery_session_changed"));
          }
        }
      })
      .catch((err) => {
        console.warn("Could not create backend session (using local fallback):", err);
      });
  }
}

/**
 * Pauses active recipe gameplay: freezes the timer and pauses active audio.
 */
export function pauseRecipeRun() {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        const session: RecipeRunSession = JSON.parse(stored);
        if (!session.isCompleted && !session.countdownPending && !session.isPaused) {
          const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
          const remaining = Math.max(0, session.totalSeconds - elapsed);
          session.isPaused = true;
          session.pausedRemaining = remaining;
          session.pausedAt = Date.now();
          window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
          window.dispatchEvent(new Event("wavebakery_session_changed"));
          pauseAllActiveAudio();
        }
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Resumes recipe gameplay: re-anchors startTime to preserve exact remaining time and resumes audio.
 */
export function resumeRecipeRun() {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        const session: RecipeRunSession = JSON.parse(stored);
        if (session.isPaused) {
          const remaining =
            typeof session.pausedRemaining === "number"
              ? session.pausedRemaining
              : session.totalSeconds;
          session.isPaused = false;
          session.startTime = Date.now() - (session.totalSeconds - remaining) * 1000;
          delete session.pausedRemaining;
          delete session.pausedAt;
          window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
          window.dispatchEvent(new Event("wavebakery_session_changed"));
          resumeAllActiveAudio();
        }
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Resets recipe timer to full allocation for current difficulty, holding in paused state until countdown finishes.
 */
export function resetRecipeTimerToFull(recipeId?: string) {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        const session: RecipeRunSession = JSON.parse(stored);
        const config = DIFFICULTY_CONFIGS[session.difficulty];
        session.totalSeconds = config.timeSeconds;
        session.pausedRemaining = config.timeSeconds;
        session.startTime = Date.now();
        session.isPaused = true;
        session.isCompleted = false;
        delete session.endTime;
        window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
        window.dispatchEvent(new Event("wavebakery_session_changed"));
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Resets the current station's transient data and triggers a clean re-mount.
 */
export function resetCurrentStage(recipeId?: string, currentPath?: string) {
  if (typeof window !== "undefined") {
    try {
      const activeId = recipeId ?? getRecipeRunSession()?.recipeId ?? getActiveRecipe().id;
      const path = currentPath ?? window.location.pathname;

      if (path.includes("generate")) {
        window.localStorage.removeItem(`wavebakery_selected_ingredients_${activeId}`);
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_raw`);
      } else if (path.includes("filter")) {
        window.localStorage.removeItem(`wavebakery_filtered_ingredients_${activeId}`);
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_filtered`);
      } else if (path.includes("chop")) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_chop`);
      } else if (path.includes("mix")) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_mixed`);
      } else if (path.includes("caramelize")) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_caramelize`);
      } else if (path.includes("transform")) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_seasoned`);
      } else if (path.includes("marinate")) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_marinated`);
      } else if (path.includes("cooking")) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_cooked`);
        window.localStorage.removeItem(`wavebakery_cooked_signal_${activeId}`);
      } else if (path.includes("beam")) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_delivered`);
      } else if (path.includes("system")) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_system`);
      }

      window.dispatchEvent(
        new CustomEvent("wavebakery_stage_reset", { detail: { recipeId: activeId, path } }),
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Completes the pre-gameplay 3-2-1-GO countdown, officially starting the recipe run timer.
 */
export function completeCountdown() {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        const session: RecipeRunSession = JSON.parse(stored);
        if (session.countdownPending) {
          session.countdownPending = false;
          session.startTime = Date.now();
          window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
          window.dispatchEvent(new Event("wavebakery_session_changed"));
        }
      }
    } catch {
      // ignore
    }
  }
}

export function updateRecipeRunSession(partial: Partial<RecipeRunSession>) {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        const current: RecipeRunSession = JSON.parse(stored);
        const updated = { ...current, ...partial };
        window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(updated));
        window.dispatchEvent(new Event("wavebakery_session_changed"));
      }
    } catch {
      // ignore
    }
  }
}

export async function syncSessionParamsToBackend(recipeId?: string): Promise<void> {
  const session = getRecipeRunSession();
  if (!session || !session.backendSessionId) return;
  const activeRecipe = recipeId ? recipes.find((r) => r.id === recipeId) : getActiveRecipe();
  if (!activeRecipe) return;

  const appliance = session.cookingAppliance || activeRecipe.cookingMethod.id;
  const seasonFreq = session.seasonFreq ?? activeRecipe.seasoningTarget.frequency;
  // Field names must match backend schemas.CookParams exactly (seasoning,
  // frequency, blend, marinate, appliances, ...) — pydantic silently drops
  // unrecognized keys and falls back to defaults instead of erroring, so a
  // mismatch here means the player's actual dials never reach the score.
  const payload = {
    seasoning: session.seasonGain ?? activeRecipe.seasoningTarget.amplitude,
    frequency: seasonFreq,
    blend: seasonFreq,
    marinate: session.marinateTime ?? activeRecipe.marinateTarget.timeScale,
    appliances: [appliance],
    ...(session.bowl ? { bowl: session.bowl } : {}),
    // Finishing stations send their SETTINGS; the server applies the same
    // burnt overtone, oven filter, road vibration and cart H(z) to its own
    // dish and scores the result (backend/app/delivery.py).
    ...(session.ovenSettings
      ? {
          oven_f0: session.ovenSettings.f0,
          oven_gains: session.ovenSettings.gains,
          oven_cutoff: session.ovenSettings.cutoffHz,
          oven_notch: session.ovenSettings.notchHz,
          oven_notch_on: session.ovenSettings.notchOn,
          oven_fs: session.ovenSettings.fs ?? null,
        }
      : {}),
    ...(session.systemPreset
      ? {
          system_preset: session.systemPreset,
          system_pole_radius: session.systemPoleRadius ?? 0,
          system_omega: session.systemOmega ?? 0,
          system_sampling_hz: session.systemSamplingHz ?? 8000,
        }
      : {}),
  };

  try {
    await api.setParams(session.backendSessionId, payload);
  } catch (err) {
    console.warn("Could not sync cooking params to backend session:", err);
  }
}

// One in-flight submit per backend session, shared by every caller (score
// screen re-renders, leaderboard retry), so a dish is never served twice.
const inflightSubmits = new Map<string, Promise<SubmitResult | null>>();

/** The current run's submit if it is still waiting for the server, else null. */
export function inflightSubmit(): Promise<SubmitResult | null> | null {
  const sid = getRecipeRunSession()?.backendSessionId;
  return sid ? (inflightSubmits.get(sid) ?? null) : null;
}

/**
 * Serves the current run's dish to the backend and stores the result on the
 * session. Safe to call repeatedly: returns the stored result if there is
 * one, joins an in-flight request, and otherwise syncs params then submits.
 * Returns null when there is no backend session or the server is unreachable
 * (the run stays unserved, so a later call can retry it).
 */
export function submitRunToBackend(recipeId?: string): Promise<SubmitResult | null> {
  const session = getRecipeRunSession();
  const sid = session?.backendSessionId;
  if (!session || !sid) return Promise.resolve(null);
  if (session.backendSubmitResult) return Promise.resolve(session.backendSubmitResult);

  const existing = inflightSubmits.get(sid);
  if (existing) return existing;

  const request = syncSessionParamsToBackend(recipeId ?? session.recipeId)
    .then(() => api.submitSession(sid))
    .then((result) => {
      // The server's verdict IS the run's final score. Store it here, not on
      // whichever page happens to be open: leaving the score screen before
      // the reply arrived used to leave the Complete page showing 0.
      const total =
        result.total_score ??
        Math.round(result.score * 10 * difficultyMultiplier(session.difficulty));
      updateRecipeRunSession({
        backendSubmitResult: result,
        finalScore: total,
        finalStars: result.stars,
      });
      saveRecipeBestScore(recipeId ?? session.recipeId, total);
      return result;
    })
    .catch((err) => {
      console.warn("Backend session submit failed (will retry later):", err);
      return null;
    })
    .finally(() => {
      inflightSubmits.delete(sid);
    });
  inflightSubmits.set(sid, request);
  return request;
}

export function recordStageAccuracy(
  stage: "filtering" | "mixing" | "seasoning" | "marinating" | "cooking" | "delivery" | "system",
  accuracy: number,
) {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        const session: RecipeRunSession = JSON.parse(stored);
        const clamped = Math.max(0, Math.min(100, Math.round(accuracy)));
        if (stage === "filtering") session.filteringAccuracy = clamped;
        else if (stage === "mixing") session.mixingAccuracy = clamped;
        else if (stage === "seasoning") session.seasoningAccuracy = clamped;
        else if (stage === "marinating") session.marinatingAccuracy = clamped;
        else if (stage === "cooking") session.cookingAccuracy = clamped;
        else if (stage === "delivery") session.deliveryAccuracy = clamped;
        else if (stage === "system") session.systemAccuracy = clamped;

        window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
        window.dispatchEvent(new Event("wavebakery_session_changed"));
      }
    } catch {
      // ignore
    }
  }
}

export function completeRecipeRun(recipeId?: string, score?: number) {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        const session: RecipeRunSession = JSON.parse(stored);
        if (!session.isCompleted) {
          session.isCompleted = true;
          session.endTime = Date.now();
          if (score != null && !isNaN(score)) {
            session.finalScore = Math.round(score);
          }
          window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
          window.dispatchEvent(new Event("wavebakery_session_changed"));
        } else if (score != null && !isNaN(score) && session.finalScore === undefined) {
          session.finalScore = Math.round(score);
          window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
          window.dispatchEvent(new Event("wavebakery_session_changed"));
        }
      }
      const targetRecipeId = recipeId ?? getRecipeRunSession()?.recipeId;
      if (targetRecipeId && score != null && !isNaN(score) && score > 0) {
        saveRecipeBestScore(targetRecipeId, score);
      }
    } catch {
      // ignore
    }
  }
}

export function getRecipeRunSession(): RecipeRunSession | null {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        return JSON.parse(stored) as RecipeRunSession;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function useRecipeTimer() {
  const [session, setSession] = useState<RecipeRunSession | null>(getRecipeRunSession);
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const s = getRecipeRunSession();
    if (!s) return 300;
    if (s.isPaused) {
      return s.pausedRemaining ?? s.totalSeconds;
    }
    if (s.countdownPending) {
      return s.totalSeconds;
    }
    if (s.isCompleted && s.endTime) {
      const elapsed = Math.floor((s.endTime - s.startTime) / 1000);
      return Math.max(0, s.totalSeconds - elapsed);
    }
    const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
    return Math.max(0, s.totalSeconds - elapsed);
  });

  useEffect(() => {
    const handleSessionChange = () => {
      const currentSession = getRecipeRunSession();
      setSession(currentSession);
      if (currentSession?.isPaused) {
        setTimeRemaining(currentSession.pausedRemaining ?? currentSession.totalSeconds);
      } else if (currentSession?.countdownPending) {
        setTimeRemaining(currentSession.totalSeconds);
      }
    };
    window.addEventListener("wavebakery_session_changed", handleSessionChange);
    window.addEventListener("storage", handleSessionChange);

    const interval = setInterval(() => {
      const currentSession = getRecipeRunSession();
      if (currentSession) {
        if (currentSession.isPaused) {
          setTimeRemaining(currentSession.pausedRemaining ?? currentSession.totalSeconds);
        } else if (currentSession.countdownPending) {
          setTimeRemaining(currentSession.totalSeconds);
        } else if (currentSession.isCompleted && currentSession.endTime) {
          const elapsed = Math.floor((currentSession.endTime - currentSession.startTime) / 1000);
          setTimeRemaining(Math.max(0, currentSession.totalSeconds - elapsed));
        } else {
          const elapsed = Math.floor((Date.now() - currentSession.startTime) / 1000);
          const rem = Math.max(0, currentSession.totalSeconds - elapsed);
          setTimeRemaining(rem);
        }
      }
    }, 500);

    return () => {
      clearInterval(interval);
      window.removeEventListener("wavebakery_session_changed", handleSessionChange);
      window.removeEventListener("storage", handleSessionChange);
    };
  }, []);

  const isPaused = Boolean(session?.isPaused);
  const isCountdownPending = Boolean(session?.countdownPending);
  const isExpired = session
    ? !session.isCompleted && !isCountdownPending && !isPaused && timeRemaining <= 0
    : false;
  const isLowTime = !isCountdownPending && !isPaused && timeRemaining <= 45 && timeRemaining > 15;
  const isCritical = !isCountdownPending && !isPaused && timeRemaining <= 15 && timeRemaining > 0;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return {
    session,
    timeRemaining,
    formattedTime,
    isExpired,
    isLowTime,
    isCritical,
    difficultyConfig: session ? DIFFICULTY_CONFIGS[session.difficulty] : null,
    isCountdownPending,
    isPaused,
    pauseRun: pauseRecipeRun,
    resumeRun: resumeRecipeRun,
  };
}

export function resetRecipeProgress(recipeId?: string) {
  if (typeof window !== "undefined") {
    try {
      const activeId = recipeId ?? getActiveRecipe().id;
      const key = `wavebakery_progress_${activeId}`;
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(`wavebakery_selected_ingredients_${activeId}`);
      window.localStorage.removeItem(`wavebakery_filtered_ingredients_${activeId}`);
      window.localStorage.removeItem(`wavebakery_cooked_signal_${activeId}`);

      const stages = [
        "raw",
        "filtered",
        "mixed",
        "seasoned",
        "marinated",
        "cooked",
        "delivered",
        "served",
      ];
      for (const stage of stages) {
        window.localStorage.removeItem(`wavebakery_pipeline_${activeId}_${stage}`);
      }

      window.dispatchEvent(new Event("wavebakery_progress_changed"));
      window.dispatchEvent(new Event("wavebakery_selected_ingredients_changed"));
      window.dispatchEvent(new Event("wavebakery_filtered_ingredients_changed"));
      window.dispatchEvent(new Event("wavebakery_cooked_signal_changed"));
      window.dispatchEvent(new Event("wavebakery_pipeline_signal_changed"));
    } catch {
      // ignore
    }
  }
}

export function useRecipeProgress(): [number, (stage: number) => void] {
  const [stage, setStageState] = useState<number>(() => getUnlockedStage());

  useEffect(() => {
    const handler = () => {
      setStageState(getUnlockedStage());
    };
    window.addEventListener("wavebakery_progress_changed", handler);
    window.addEventListener("wavebakery_recipe_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_progress_changed", handler);
      window.removeEventListener("wavebakery_recipe_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const unlock = useCallback((newStage: number) => {
    setUnlockedStage(newStage);
    setStageState(getUnlockedStage());
  }, []);

  return [stage, unlock];
}

export const ALL_AVAILABLE_INGREDIENTS: IngredientDetail[] = [
  // Produce / Washables
  {
    name: "Lettuce",
    instrument: "Parametric Signal",
    freq: 3,
    washable: true,
    idealCutoff: 380,
    kind: "lettuce",
    category: "Produce",
    emoji: "🥬",
  },
  {
    name: "Tomato",
    instrument: "Parametric Signal",
    freq: 5,
    washable: true,
    idealCutoff: 520,
    kind: "tomato",
    category: "Produce",
    emoji: "🍅",
  },
  {
    name: "Onion",
    instrument: "Parametric Signal",
    freq: 6,
    washable: true,
    idealCutoff: 640,
    kind: "onion",
    category: "Produce",
    emoji: "🧅",
  },
  {
    name: "Cucumber",
    instrument: "Mathematical Signal",
    freq: 7,
    washable: true,
    idealCutoff: 450,
    kind: "cucumber",
    category: "Produce",
    emoji: "🥒",
  },

  {
    name: "Carrot",
    instrument: "Mathematical Signal",
    freq: 4.5,
    washable: true,
    idealCutoff: 500,
    kind: "carrot",
    category: "Produce",
    emoji: "🥕",
  },

  // Bakery & Grains
  {
    name: "Bun",
    instrument: "Mathematical Signal",
    freq: 3,
    washable: false,
    kind: "bun",
    category: "Bakery",
    emoji: "🍞",
  },
  {
    name: "Bread",
    instrument: "Mathematical Signal",
    freq: 3,
    washable: false,
    kind: "bread",
    category: "Bakery",
    emoji: "🍞",
  },
  {
    name: "Noodles",
    instrument: "Parametric Signal",
    freq: 3,
    washable: false,
    kind: "noodles",
    category: "Bakery",
    emoji: "🍜",
  },
  {
    name: "Flour",
    instrument: "Mathematical Signal",
    freq: 2,
    washable: false,
    kind: "flour",
    category: "Bakery",
    emoji: "🌾",
  },

  // Proteins & Dairy
  {
    name: "Beef Patty",
    instrument: "Parametric Signal",
    freq: 2,
    washable: false,
    kind: "patty",
    category: "Protein",
    emoji: "🥩",
  },
  {
    name: "Chicken",
    instrument: "Recorded Signal",
    freq: 2.5,
    washable: false,
    kind: "chicken",
    category: "Protein",
    emoji: "🍗",
  },
  {
    name: "Cheese",
    instrument: "Mathematical Signal",
    freq: 6,
    washable: false,
    kind: "cheese",
    category: "Dairy",
    emoji: "🧀",
  },
  {
    name: "Egg",
    instrument: "Parametric Signal",
    freq: 4,
    washable: true,
    idealCutoff: 460,
    kind: "egg",
    category: "Protein",
    emoji: "🥚",
  },
  {
    name: "Milk",
    instrument: "Mathematical Signal",
    freq: 5,
    washable: false,
    kind: "milk",
    category: "Dairy",
    emoji: "🥛",
  },
  {
    name: "Butter",
    instrument: "Mathematical Signal",
    freq: 3,
    washable: false,
    kind: "butter",
    category: "Dairy",
    emoji: "🧈",
  },

  // Pantry
  {
    name: "Sugar",
    instrument: "Mathematical Signal",
    freq: 5,
    washable: false,
    kind: "sugar",
    category: "Pantry",
    emoji: "🍬",
  },
  {
    name: "Salt",
    instrument: "Mathematical Signal",
    freq: 12,
    washable: false,
    kind: "salt",
    category: "Pantry",
    emoji: "🧂",
  },
  {
    name: "Sauce",
    instrument: "Parametric Signal",
    freq: 4,
    washable: false,
    kind: "sauce",
    category: "Pantry",
    emoji: "🥫",
  },
];

export function getSelectedIngredients(recipeId?: string): IngredientDetail[] {
  if (typeof window !== "undefined") {
    try {
      const activeId = recipeId ?? getActiveRecipe().id;
      const key = `wavebakery_selected_ingredients_${activeId}`;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const names: string[] = JSON.parse(stored);
        if (Array.isArray(names)) {
          const matched = names
            .map((n) =>
              ALL_AVAILABLE_INGREDIENTS.find((i) => i.name.toLowerCase() === n.toLowerCase()),
            )
            .filter((i): i is IngredientDetail => Boolean(i));
          return matched;
        }
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export function setSelectedIngredients(
  ingredients: (string | IngredientDetail)[],
  recipeId?: string,
) {
  if (typeof window !== "undefined") {
    try {
      const activeId = recipeId ?? getActiveRecipe().id;
      const key = `wavebakery_selected_ingredients_${activeId}`;
      const names = ingredients.map((i) => (typeof i === "string" ? i : i.name));
      window.localStorage.setItem(key, JSON.stringify(names));
      window.dispatchEvent(new Event("wavebakery_selected_ingredients_changed"));
    } catch {
      // ignore
    }
  }
}

export function useSelectedIngredients(): [
  IngredientDetail[],
  (ings: (string | IngredientDetail)[]) => void,
] {
  const [selected, setSelectedState] = useState<IngredientDetail[]>(() => getSelectedIngredients());

  useEffect(() => {
    const handler = () => {
      setSelectedState(getSelectedIngredients());
    };
    window.addEventListener("wavebakery_selected_ingredients_changed", handler);
    window.addEventListener("wavebakery_recipe_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_selected_ingredients_changed", handler);
      window.removeEventListener("wavebakery_recipe_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = (newIngs: (string | IngredientDetail)[]) => {
    setSelectedIngredients(newIngs);
    setSelectedState(getSelectedIngredients());
  };

  return [selected, update];
}

export const CHEF_NAME_KEY = "wavebakery_chef_name";
export const MAX_CHEF_NAME_LENGTH = 20;

export function getChefName(): string | null {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(CHEF_NAME_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim().slice(0, MAX_CHEF_NAME_LENGTH);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function setChefName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_CHEF_NAME_LENGTH);
  if (typeof window !== "undefined") {
    try {
      if (trimmed.length > 0) {
        window.localStorage.setItem(CHEF_NAME_KEY, trimmed);
      } else {
        window.localStorage.removeItem(CHEF_NAME_KEY);
      }
      window.dispatchEvent(new Event("wavebakery_chef_name_changed"));
    } catch {
      // ignore
    }
  }
  return trimmed;
}

export function logoutChef() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(CHEF_NAME_KEY);
      window.localStorage.removeItem("wavebakery_recipe_session");
      window.dispatchEvent(new Event("wavebakery_chef_name_changed"));
      window.dispatchEvent(new Event("wavebakery_session_changed"));
    } catch {
      // ignore
    }
  }
}

export function useChefName(): [string | null, (name: string) => void] {
  const [chefName, setChefNameState] = useState<string | null>(() => getChefName());

  useEffect(() => {
    const handler = () => {
      setChefNameState(getChefName());
    };
    window.addEventListener("wavebakery_chef_name_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_chef_name_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = (newName: string) => {
    const saved = setChefName(newName);
    setChefNameState(saved.length > 0 ? saved : null);
  };

  return [chefName, update];
}

export interface CookedSignalData {
  recipeId: string;
  methodId: "grill" | "fry" | "bake" | "boil";
  methodName: string;
  frequency: number;
  amplitude: number;
  noise: number;
  shift: number;
  pos: number;
  timestamp: number;
  samples: number[];
  metadata?: Record<string, unknown>;
}

const COOKING_METHOD_CONFIGS: Record<string, { name: string; freq: number; amp: number }> = {
  grill: { name: "GRILL", freq: 8, amp: 0.9 },
  fry: { name: "FRY", freq: 12, amp: 0.8 },
  bake: { name: "BAKE", freq: 2, amp: 0.6 },
  boil: { name: "BOIL", freq: 3, amp: 0.7 },
};

/**
 * Computes the actual discrete cooked output samples produced by the Cooking Lab convolution.
 * Matches the mathematical convolution model of input signal x(t) and cooking impulse h(t).
 */
export function computeCookedSamples(params: {
  frequency: number;
  amplitude: number;
  noise: number;
  shift: number;
  stretch?: number;
  seed?: number;
  width?: number;
}): number[] {
  const { frequency, amplitude, noise, shift, stretch = 1, seed = 1, width = 400 } = params;
  const samples: number[] = [];
  for (let x = 0; x <= width; x += 1) {
    const t = ((x / width) * stretch - shift) * Math.PI * 2 * frequency;
    const n = noise ? Math.sin(x * 12.9898 + seed * 78.233) * noise * 0.485 : 0;
    const s = Math.sin(t + seed) * amplitude - n;
    samples.push(s);
  }
  return samples;
}

/**
 * Computes the actual discrete raw ingredient signal samples.
 * Matches the time-domain signal generator model of ingredients: x(t) = sin(2*pi*f*t) - noise.
 */
export function computeIngredientSamples(ing: {
  freq: number;
  washable?: boolean;
  noise?: number;
  amplitude?: number;
  seed?: number;
  width?: number;
  name?: string;
}): number[] {
  const { freq, washable, amplitude = 1.0, seed = 1, width = 400, name } = ing;

  if (name) {
    const mathSignal = getMathematicalSignal(name);
    if (mathSignal) {
      const defaultAmp = mathSignal.defaultAmplitude ?? 1.0;
      const amp = ing.amplitude !== undefined ? ing.amplitude : defaultAmp;
      return mathSignal.generateSamples({
        freq,
        amplitude: amp,
        phase: ing.seed !== undefined ? ing.seed : 0,
        noise: ing.noise !== undefined ? ing.noise : washable ? 0.75 : 0.0,
        sampleCount: width + 1,
      });
    }
  }

  const noise = ing.noise !== undefined ? ing.noise : washable ? 0.75 : 0.05;
  const samples: number[] = [];
  for (let x = 0; x <= width; x += 1) {
    const t = (x / width) * Math.PI * 2 * freq;
    const n = noise ? Math.sin(x * 12.9898 + seed * 78.233) * noise * 0.485 : 0;
    const s = Math.sin(t + seed) * amplitude - n;
    samples.push(s);
  }
  return samples;
}

export function getDefaultCookedSignal(recipeId?: string): CookedSignalData {
  const activeRecipe = recipeId
    ? (recipes.find((r) => r.id === recipeId) ?? getActiveRecipe())
    : getActiveRecipe();
  const methodId = activeRecipe.cookingMethod.id;
  const cfg = COOKING_METHOD_CONFIGS[methodId] ?? {
    name: activeRecipe.cookingMethod.name,
    freq: 6,
    amp: 0.7,
  };
  const ideal = getIdealDishSignal(activeRecipe.id);
  const frequency = ideal.frequency;
  const amplitude = 1.0;
  const noise = methodId === "fry" ? 0.25 : 0.05;
  const shift = 0.5;
  const samples = ideal.samples;

  return {
    recipeId: activeRecipe.id,
    methodId,
    methodName: cfg.name,
    frequency,
    amplitude,
    noise,
    shift,
    pos: 100,
    timestamp: Date.now(),
    samples,
  };
}

export function saveCookedSignal(signal: CookedSignalData) {
  if (typeof window !== "undefined") {
    try {
      const key = `wavebakery_cooked_signal_${signal.recipeId}`;
      window.localStorage.setItem(key, JSON.stringify(signal));
      window.dispatchEvent(new Event("wavebakery_cooked_signal_changed"));
    } catch {
      // ignore
    }
  }
}

export function getCookedSignal(recipeId?: string): CookedSignalData {
  if (typeof window !== "undefined") {
    try {
      const activeId = recipeId ?? getActiveRecipe().id;
      const key = `wavebakery_cooked_signal_${activeId}`;
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as CookedSignalData;
        if (!parsed.samples || parsed.samples.length === 0) {
          const ideal = getIdealDishSignal(activeId);
          parsed.samples = ideal.samples;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  return getDefaultCookedSignal(recipeId);
}

export function useCookedSignal(
  recipeId?: string,
): [CookedSignalData, (signal: CookedSignalData) => void] {
  const [signal, setSignalState] = useState<CookedSignalData>(() => getCookedSignal(recipeId));

  useEffect(() => {
    const handler = () => {
      setSignalState(getCookedSignal(recipeId));
    };
    window.addEventListener("wavebakery_cooked_signal_changed", handler);
    window.addEventListener("wavebakery_recipe_changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_cooked_signal_changed", handler);
      window.removeEventListener("wavebakery_recipe_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [recipeId]);

  const update = (newSignal: CookedSignalData) => {
    saveCookedSignal(newSignal);
    setSignalState(newSignal);
  };

  return [signal, update];
}
