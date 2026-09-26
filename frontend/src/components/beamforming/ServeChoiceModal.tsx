import { Link } from "@tanstack/react-router";
import { Utensils, Flame, X } from "lucide-react";
import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";

interface ServeChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeName: string;
}

export function ServeChoiceModal({ isOpen, onClose, recipeName }: ServeChoiceModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="serve-modal-title"
    >
      <div className="kitchen-card relative w-full max-w-lg border-2 border-border bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close X Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
          aria-label="Close serving modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center sm:text-left pr-6">
          <p className="font-mono text-[10px] font-extrabold tracking-[0.28em] text-primary uppercase">
            Dish Ready · {recipeName}
          </p>
          <h2
            id="serve-modal-title"
            className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground uppercase sm:text-4xl"
          >
            SERVE DISH
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            How would you like to plate and send your culinary signal to the dining room?
          </p>
        </div>

        {/* Serving Options 2x1 Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Option 1: Serve As-Is */}
          <Link to="/score" onClick={onClose} className="block group">
            <div className="flex h-full flex-col justify-between rounded-2xl border-2 border-border bg-secondary/40 p-5 transition-all duration-150 hover:border-primary/60 hover:bg-secondary/70 hover:scale-[1.02] cursor-pointer">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <Utensils className="h-5 w-5" />
                </div>
                <h4 className="mt-3 font-display text-lg font-extrabold text-foreground uppercase">
                  Serve As-Is
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Plate the cooked dish as-is with its slight overcooking note, and proceed directly to tasting and scoring.
                </p>
              </div>

              <span className="mt-4 inline-block font-mono text-[11px] font-bold text-primary group-hover:underline">
                Proceed with Burnt Note →
              </span>
            </div>
          </Link>

          {/* Option 2: Save the Dish with Precision Oven */}
          <Link to="/beam-delivery" onClick={onClose} className="block group">
            <div className="flex h-full flex-col justify-between rounded-2xl border-2 border-primary/50 bg-primary/10 p-5 shadow-xs transition-all duration-150 hover:border-primary hover:bg-primary/15 hover:scale-[1.02] cursor-pointer">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary bg-primary text-primary-foreground shadow-xs">
                  <Flame className="h-5 w-5 animate-pulse" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <h4 className="font-display text-lg font-extrabold text-foreground uppercase">
                    🧪 Save the Dish!
                  </h4>
                  <span className="rounded-md bg-signal/20 px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-signal uppercase">
                    Precision Oven
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  The intense cooking heat left an unwanted burnt flavor signature. Use the Precision Oven's frequency-domain filtering to suppress the burnt component and restore flavor balance.
                </p>
              </div>

              <span className="mt-4 inline-block font-mono text-[11px] font-bold text-primary group-hover:underline">
                Enter Precision Oven 🧪 →
              </span>
            </div>
          </Link>
        </div>

        {/* Chef Fourier dialogue */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border/80 bg-secondary/50 p-3">
          <ChefFourier
            size="sm"
            float={false}
            message="Looks like we got a little too much heat on the grill! That burnt flavor has a frequency of its own. Plate it now with the charred note, or use the Precision Oven to notch out the burnt component and save the dish!"
          />
        </div>

        {/* Close footer button */}
        <div className="mt-6 flex justify-end">
          <GameButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="uppercase font-mono text-xs"
          >
            Cancel
          </GameButton>
        </div>
      </div>
    </div>
  );
}
