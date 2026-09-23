import { useState } from "react";
import { Clock, Flame, Timer, X, Zap } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { DIFFICULTY_CONFIGS, type Recipe, type RecipeDifficulty } from "@/lib/recipes";
import { cn } from "@/lib/utils";

const difficultyIcons: Record<RecipeDifficulty, typeof Clock> = {
  easy: Clock,
  medium: Timer,
  hard: Zap,
  masterchef: Flame,
};

interface DifficultyModalProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
  onProceed: (difficulty: RecipeDifficulty) => void;
}

export function DifficultyModal({ recipe, isOpen, onClose, onProceed }: DifficultyModalProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<RecipeDifficulty>("medium");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="difficulty-modal-title"
    >
      <div className="kitchen-card relative w-full max-w-2xl border-2 border-border bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close X Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
          aria-label="Close difficulty modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center sm:text-left pr-8">
          <p className="font-mono text-[10px] font-extrabold tracking-[0.28em] text-primary uppercase">
            Recipe Mode · {recipe.name}
          </p>
          <h2
            id="difficulty-modal-title"
            className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground uppercase sm:text-4xl"
          >
            CHOOSE DIFFICULTY
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-muted-foreground">
            How much time will you give yourself?
          </p>
        </div>

        {/* 4 Difficulty Cards Grid */}
        <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
          {(Object.keys(DIFFICULTY_CONFIGS) as RecipeDifficulty[]).map((diffKey) => {
            const cfg = DIFFICULTY_CONFIGS[diffKey];
            const isSelected = selectedDifficulty === diffKey;
            const IconComp = difficultyIcons[diffKey];

            return (
              <div
                key={cfg.id}
                onClick={() => setSelectedDifficulty(diffKey)}
                className={cn(
                  "relative flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition-all select-none cursor-pointer group",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40"
                    : "border-border bg-secondary/40 hover:border-primary/40 hover:bg-secondary/80",
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border",
                          cfg.colorClass,
                        )}
                      >
                        <IconComp className="h-4 w-4" />
                      </span>
                      <span className="font-display text-base font-extrabold uppercase text-foreground">
                        {cfg.name}
                      </span>
                    </div>

                    <span
                      className={cn(
                        "rounded-lg border px-2.5 py-1 font-mono text-xs font-extrabold tracking-wider",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground",
                      )}
                    >
                      {cfg.timeDisplay}
                    </span>
                  </div>

                  <p className="mt-2.5 text-xs font-semibold text-muted-foreground leading-snug">
                    "{cfg.description}"
                  </p>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] font-mono uppercase">
                  <span className="text-muted-foreground font-bold">{cfg.tag} Pace</span>
                  {isSelected ? (
                    <span className="font-extrabold text-primary">✓ SELECTED</span>
                  ) : (
                    <span className="text-muted-foreground group-hover:text-foreground">
                      Click to select
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chef Fourier mini dialogue */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border/80 bg-secondary/50 p-3">
          <ChefFourier size="sm" float={false} message="Choose your challenge, chef!" />
        </div>

        {/* Modal Action Buttons */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <GameButton
            type="button"
            variant="secondary"
            className="uppercase sm:w-32"
            onClick={onClose}
          >
            CANCEL
          </GameButton>

          <GameButton
            type="button"
            className="uppercase flex-1 sm:flex-initial sm:min-w-44 text-base tracking-wider"
            onClick={() => onProceed(selectedDifficulty)}
          >
            PROCEED
          </GameButton>
        </div>
      </div>
    </div>
  );
}
