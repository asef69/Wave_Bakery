import { useEffect, useState } from "react";
import { getMathematicalSignal } from "./signals";
import { getIdealDishSignal } from "./pipeline";

export * from "./signals";
export * from "./pipeline";

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
      { name: "Beef Patty", instrument: "Parametric Signal", freq: 2, washable: false, kind: "patty" },
      { name: "Cheese", instrument: "Mathematical Signal", freq: 6, washable: false, kind: "cheese" },
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
    progress: "complete",
    bestScore: 940,
    stars: 3,
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
      { name: "Chicken", instrument: "Recorded Signal", freq: 2.5, washable: false, kind: "chicken" },
      { name: "Cheese", instrument: "Mathematical Signal", freq: 6, washable: false, kind: "cheese" },
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
    progress: "in-progress",
    bestScore: 610,
    stars: 2,
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
      { name: "Butter", instrument: "Mathematical Signal", freq: 3, washable: false, kind: "butter" },
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
      { name: "Noodles", instrument: "Parametric Signal", freq: 3, washable: false, kind: "noodles" },
      {
        name: "Egg",
        instrument: "Parametric Signal",
        freq: 4,
        washable: true,
        idealCutoff: 460,
        kind: "egg",
      },
      { name: "Chicken", instrument: "Recorded Signal", freq: 2.5, washable: false, kind: "chicken" },
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
      { name: "Chicken", instrument: "Recorded Signal", freq: 2.5, washable: false, kind: "chicken" },
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
      { name: "Butter", instrument: "Mathematical Signal", freq: 3, washable: false, kind: "butter" },
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

let currentActiveRecipeId = "burger";

export function getActiveRecipe(): Recipe {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_active_recipe");
      if (stored) {
        const found = recipes.find((r) => r.id === stored);
        if (found) return found;
      }
    } catch {
      // ignore
    }
  }
  return recipes.find((r) => r.id === currentActiveRecipeId) ?? recipes[0]!;
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
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("wavebakery_recipe_changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setRecipe = (id: string) => {
    setActiveRecipe(id);
    setRecipeState(getActiveRecipe());
  };

  return [recipe, setRecipe];
}

export const STAGE_ORDER = [
  { id: "generate", label: "Generate Signal", path: "/generate", step: 1 },
  { id: "filter", label: "Filter Lab", path: "/filtering", step: 2 },
  { id: "mix", label: "Mixing Lab", path: "/mixing", step: 3 },
  { id: "season", label: "Seasoning Lab", path: "/transform", step: 4 },
  { id: "marinate", label: "Marinating Lab", path: "/marinate", step: 5 },
  { id: "cook", label: "Cooking Lab", path: "/cooking", step: 6 },
  { id: "check-dish", label: "Check Dish", path: "/check-dish", step: 7 },
  { id: "score", label: "Final Comparison", path: "/score", step: 8 },
  { id: "complete", label: "Complete", path: "/complete", step: 9 },
] as const;

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
    timeSeconds: 300, // 5:00
    timeDisplay: "5:00",
    description: "Comfortable time to learn the recipe.",
    tag: "Relaxed",
    colorClass: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    dotClass: "bg-emerald-500",
  },
  medium: {
    id: "medium",
    name: "MEDIUM",
    badge: "MEDIUM",
    timeSeconds: 210, // 3:30
    timeDisplay: "3:30",
    description: "A balanced challenge.",
    tag: "Standard",
    colorClass: "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
    dotClass: "bg-amber-500",
  },
  hard: {
    id: "hard",
    name: "HARD",
    badge: "HARD",
    timeSeconds: 120, // 2:00
    timeDisplay: "2:00",
    description: "Fast execution required.",
    tag: "Challenging",
    colorClass: "text-orange-600 dark:text-orange-400 border-orange-500/40 bg-orange-500/10",
    dotClass: "bg-orange-500",
  },
  masterchef: {
    id: "masterchef",
    name: "MASTERCHEF",
    badge: "MASTERCHEF",
    timeSeconds: 60, // 1:00
    timeDisplay: "1:00",
    description: "No room for hesitation.",
    tag: "Expert",
    colorClass: "text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10",
    dotClass: "bg-rose-500",
  },
};

export interface RecipeRunSession {
  recipeId: string;
  difficulty: RecipeDifficulty;
  totalSeconds: number;
  startTime: number;
  endTime?: number;
  isCompleted: boolean;
  filteringAccuracy?: number;
  mixingAccuracy?: number;
  seasoningAccuracy?: number;
  marinatingAccuracy?: number;
  cookingAccuracy?: number;
  deliveryAccuracy?: number;
}

export function startRecipeRun(recipeId: string, difficulty: RecipeDifficulty) {
  if (typeof window !== "undefined") {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const session: RecipeRunSession = {
      recipeId,
      difficulty,
      totalSeconds: config.timeSeconds,
      startTime: Date.now(),
      isCompleted: false,
    };
    window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
    window.dispatchEvent(new Event("wavebakery_session_changed"));
  }
}

export function recordStageAccuracy(
  stage: "filtering" | "mixing" | "seasoning" | "marinating" | "cooking" | "delivery",
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

        window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
        window.dispatchEvent(new Event("wavebakery_session_changed"));
      }
    } catch {
      // ignore
    }
  }
}

export function completeRecipeRun() {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("wavebakery_recipe_session");
      if (stored) {
        const session: RecipeRunSession = JSON.parse(stored);
        if (!session.isCompleted) {
          session.isCompleted = true;
          session.endTime = Date.now();
          window.localStorage.setItem("wavebakery_recipe_session", JSON.stringify(session));
          window.dispatchEvent(new Event("wavebakery_session_changed"));
        }
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
    if (s.isCompleted && s.endTime) {
      const elapsed = Math.floor((s.endTime - s.startTime) / 1000);
      return Math.max(0, s.totalSeconds - elapsed);
    }
    const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
    return Math.max(0, s.totalSeconds - elapsed);
  });

  useEffect(() => {
    const handleSessionChange = () => {
      setSession(getRecipeRunSession());
    };
    window.addEventListener("wavebakery_session_changed", handleSessionChange);
    window.addEventListener("storage", handleSessionChange);

    const interval = setInterval(() => {
      const currentSession = getRecipeRunSession();
      if (currentSession) {
        if (currentSession.isCompleted && currentSession.endTime) {
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

  const isExpired = session ? !session.isCompleted && timeRemaining <= 0 : false;
  const isLowTime = timeRemaining <= 45 && timeRemaining > 15;
  const isCritical = timeRemaining <= 15 && timeRemaining > 0;

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

      const stages = ["raw", "filtered", "mixed", "seasoned", "marinated", "cooked"];
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

  const unlock = (newStage: number) => {
    setUnlockedStage(newStage);
    setStageState(getUnlockedStage());
  };

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
        noise: ing.noise !== undefined ? ing.noise : (washable ? 0.75 : 0.0),
        sampleCount: width + 1,
      });
    }
  }

  const noise = ing.noise !== undefined ? ing.noise : (washable ? 0.75 : 0.05);
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
    ? recipes.find((r) => r.id === recipeId) ?? getActiveRecipe()
    : getActiveRecipe();
  const methodId = activeRecipe.cookingMethod.id;
  const cfg = COOKING_METHOD_CONFIGS[methodId] ?? { name: activeRecipe.cookingMethod.name, freq: 6, amp: 0.7 };
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

export function useCookedSignal(recipeId?: string): [CookedSignalData, (signal: CookedSignalData) => void] {
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
