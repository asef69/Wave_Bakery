import { DishGlyph } from "@/components/game/DishGlyph";
import { GameButton } from "@/components/game/GameButton";
import {
  enrichRecipeWithBestScore,
  progressLabel,
  useRecipeBestScores,
  type Recipe,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

const difficultyTone: Record<Recipe["difficulty"], string> = {
  Easy: "text-signal-alt border-signal-alt/50",
  Medium: "text-primary border-primary/50",
  Hard: "text-destructive border-destructive/50",
};

function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={cn("h-4 w-4", i < count ? "text-primary-glow" : "text-border")}
          aria-hidden
        >
          <path
            d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"
            fill="currentColor"
          />
        </svg>
      ))}
    </span>
  );
}

export function RecipeCard({ recipe, onCook }: { recipe: Recipe; onCook: () => void }) {
  const bestScores = useRecipeBestScores();
  const effectiveRecipe = enrichRecipeWithBestScore(recipe, bestScores);

  return (
    <article className="group kitchen-card relative flex flex-col gap-4 p-5 transition-transform duration-200 hover:-translate-y-1">
      {/* stitched cookbook edge */}
      <span
        className="absolute inset-y-4 left-1.5 w-px border-l-2 border-dashed border-primary/25"
        aria-hidden
      />

      <header className="flex items-start justify-between gap-2 pl-3">
        <div>
          <h3 className="font-display text-2xl font-extrabold text-foreground">
            {effectiveRecipe.name}
          </h3>
          <p className="text-xs font-semibold text-muted-foreground">{effectiveRecipe.tagline}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border bg-secondary/70 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] uppercase",
            difficultyTone[effectiveRecipe.difficulty],
          )}
        >
          {effectiveRecipe.difficulty}
        </span>
      </header>

      <div className="pl-3">
        <DishGlyph dish={effectiveRecipe.id} />
      </div>

      <dl className="grid grid-cols-2 gap-2 pl-3 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
        <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2">
          <dt>Ingredients</dt>
          <dd className="font-display text-base font-bold text-foreground">
            {effectiveRecipe.ingredients.length}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2">
          <dt>Signal steps</dt>
          <dd className="font-display text-base font-bold text-foreground">
            {effectiveRecipe.pipeline.length}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-2 pl-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            {progressLabel[effectiveRecipe.progress]}
          </p>
          <p className="font-display text-sm font-bold text-foreground">
            Best {effectiveRecipe.bestScore !== null ? `${effectiveRecipe.bestScore} pts` : "— — —"}
          </p>
        </div>
        <Stars count={effectiveRecipe.stars} />
      </div>

      <div className="pl-3">
        <GameButton className="w-full uppercase" onClick={onCook}>
          Cook
        </GameButton>
      </div>
    </article>
  );
}
