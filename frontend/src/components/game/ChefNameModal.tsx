import { useEffect, useState } from "react";
import { ChefHat, X } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { MAX_CHEF_NAME_LENGTH } from "@/lib/recipes";

interface ChefNameModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirm: (name: string) => void;
  currentName?: string | null;
  allowCancel?: boolean;
}

export function ChefNameModal({
  isOpen,
  onClose,
  onConfirm,
  currentName = "",
  allowCancel = true,
}: ChefNameModalProps) {
  const [name, setName] = useState(currentName ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName ?? "");
      setError(null);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a chef name to proceed.");
      return;
    }
    if (trimmed.length > MAX_CHEF_NAME_LENGTH) {
      setError(`Name must be ${MAX_CHEF_NAME_LENGTH} characters or less.`);
      return;
    }
    onConfirm(trimmed);
  };

  const isEditing = Boolean(currentName && currentName.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (allowCancel && onClose && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chef-name-modal-title"
    >
      <div className="kitchen-card relative w-full max-w-lg border-2 border-border bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close X Button (if cancel allowed) */}
        {allowCancel && onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Modal Header */}
        <div className="text-center sm:text-left pr-6">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <ChefHat className="h-3.5 w-3.5" />
            </span>
            <p className="font-mono text-[10px] font-extrabold tracking-[0.28em] text-primary uppercase">
              {isEditing ? "Player Profile" : "Chef Registration"}
            </p>
          </div>
          <h2
            id="chef-name-modal-title"
            className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground uppercase sm:text-3xl"
          >
            WHAT SHOULD WE CALL YOU, CHEF?
          </h2>
          <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
            {isEditing
              ? "Update your kitchen display name for recipes and leaderboard scores."
              : "Enter your kitchen display name before stepping up to the cooking stations."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="chefNameInput"
                className="font-mono text-[11px] font-bold text-foreground uppercase tracking-wider"
              >
                Chef Name
              </label>
              <span className="font-mono text-[10px] text-muted-foreground">
                {name.trim().length}/{MAX_CHEF_NAME_LENGTH}
              </span>
            </div>

            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 font-mono text-sm font-bold text-primary">
                Chef
              </span>
              <input
                id="chefNameInput"
                type="text"
                value={name}
                autoFocus
                maxLength={MAX_CHEF_NAME_LENGTH}
                placeholder="e.g. Fourier, Turing, Shannon"
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full rounded-2xl border-2 border-border bg-secondary/50 py-3.5 pr-4 pl-14 font-display text-base font-extrabold text-foreground transition-all placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {error && (
              <p className="mt-2 font-mono text-xs font-semibold text-destructive">⚠️ {error}</p>
            )}
          </div>

          {/* Chef Fourier mini dialogue */}
          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-secondary/50 p-3">
            <ChefFourier
              size="sm"
              float={false}
              message={
                isEditing
                  ? "A fresh title for a master signal chef!"
                  : "Welcome to WaveBakery! Every great signal chef needs a name."
              }
            />
          </div>

          {/* Modal Actions */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {allowCancel && onClose && (
              <GameButton
                type="button"
                variant="secondary"
                className="uppercase sm:w-28"
                onClick={onClose}
              >
                Cancel
              </GameButton>
            )}

            <GameButton
              type="submit"
              disabled={!name.trim()}
              className="uppercase flex-1 sm:flex-initial sm:min-w-40 text-base tracking-wider"
            >
              {isEditing ? "Save Name" : "Continue →"}
            </GameButton>
          </div>
        </form>
      </div>
    </div>
  );
}
