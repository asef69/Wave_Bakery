import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Clock, RotateCcw } from "lucide-react";

import { GameButton } from "@/components/game/GameButton";
import {
  resetRecipeProgress,
  startRecipeRun,
  useActiveRecipe,
  useRecipeTimer,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

/**
 * HUD Badge showing the active recipe's difficulty and countdown timer.
 */
export function RecipeTimerBadge({ className }: { className?: string }) {
  const { formattedTime, difficultyConfig, isLowTime, isCritical, isExpired, session } =
    useRecipeTimer();

  if (!session) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 font-mono text-xs font-bold transition-all select-none shadow-sm",
        isExpired
          ? "border-destructive bg-destructive/15 text-destructive animate-pulse"
          : isCritical
            ? "border-destructive bg-destructive/15 text-destructive animate-pulse ring-2 ring-destructive/40"
            : isLowTime
              ? "border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "border-border bg-card/80 text-foreground",
        className,
      )}
      title={`Cooking Timer: ${difficultyConfig?.name ?? "Recipe"} Mode`}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0",
          difficultyConfig?.dotClass ?? "bg-primary",
        )}
        aria-hidden
      />
      <span className="tracking-wider uppercase text-[10px] text-muted-foreground">
        {difficultyConfig?.name ?? "TIMER"}:
      </span>
      <span
        className={cn(
          "font-mono font-extrabold tracking-widest text-sm",
          isExpired || isCritical
            ? "text-destructive"
            : isLowTime
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground",
        )}
      >
        {formattedTime}
      </span>
    </div>
  );
}

/**
 * Blocking overlay modal displayed when the recipe countdown timer hits 00:00.
 */
export function TimeExpiredModal() {
  const [recipe] = useActiveRecipe();
  const { isExpired, session, difficultyConfig } = useRecipeTimer();
  const navigate = useNavigate();

  if (!isExpired || !session) return null;

  const handleRetry = () => {
    resetRecipeProgress(recipe.id);
    startRecipeRun(recipe.id, session.difficulty);
    navigate({ to: "/generate" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-md">
      <div className="kitchen-card relative w-full max-w-lg border-2 border-destructive/60 bg-card p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-destructive/40 bg-destructive/15 text-destructive shadow-inner">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <p className="mt-4 font-mono text-[10px] font-extrabold tracking-[0.28em] text-destructive uppercase">
          Time Limit Exceeded
        </p>

        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground uppercase sm:text-4xl">
          TIME'S UP!
        </h2>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          The countdown timer reached <strong>00:00</strong> before{" "}
          <strong className="text-foreground">{recipe.name}</strong> could be completed on{" "}
          <strong className="text-foreground">{difficultyConfig?.name}</strong> difficulty.
        </p>

        <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-3 font-mono text-xs text-muted-foreground">
          No completion score awarded for expired cooking runs.
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <GameButton
            className="w-full flex-1 uppercase inline-flex items-center justify-center gap-2"
            onClick={handleRetry}
          >
            <RotateCcw className="h-4 w-4" />
            Retry Recipe ({difficultyConfig?.timeDisplay})
          </GameButton>

          <Link to="/recipe-book" className="w-full sm:w-auto">
            <GameButton
              variant="secondary"
              className="w-full uppercase inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Recipe Book
            </GameButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
