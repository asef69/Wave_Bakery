import { useState } from "react";
import { LogOut, X, AlertTriangle, ChefHat } from "lucide-react";
import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { api } from "@/lib/api";
import { logoutChef, useChefName } from "@/lib/recipes";

interface LogoutModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onLoggedOut?: () => void;
}

export function LogoutModal({
  isOpen,
  open,
  onClose,
  onOpenChange,
  onLoggedOut,
}: LogoutModalProps) {
  const [chefName] = useChefName();
  const isModalOpen = isOpen ?? open ?? false;

  if (!isModalOpen) return null;

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  const handleConfirmLogout = () => {
    // Drop the server token too; keeping it credited the next person's runs
    // to this chef.
    api.logoutPlayer();
    logoutChef();
    handleClose();
    if (onLoggedOut) {
      onLoggedOut();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      <div className="kitchen-card relative w-full max-w-md border-2 border-border bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close X Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
          aria-label="Close logout dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 border-b border-border/60 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/15 text-rose-500 shadow-inner">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-rose-500 uppercase">
              Profile Management
            </p>
            <h2
              id="logout-modal-title"
              className="font-display text-2xl font-extrabold tracking-tight text-foreground uppercase"
            >
              Sign Out / Log Out
            </h2>
          </div>
        </div>

        {/* Modal Content */}
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-secondary/50 p-4">
            <div className="flex items-center gap-2.5">
              <ChefHat className="h-5 w-5 text-primary" />
              <p className="font-display text-base font-extrabold text-foreground">
                Active Chef:{" "}
                <span className="text-gradient-warm">
                  {chefName ? `Chef ${chefName}` : "Active Chef"}
                </span>
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Logging out will clear your active session on this kitchen station. Your leaderboard
              scores, star ratings, and recipe progress remain safely stored.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
            <ChefFourier
              size="sm"
              float={false}
              message="Taking a break from the kitchen? You can log back in anytime with your chef name!"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-2">
          <GameButton
            variant="ghost"
            size="md"
            onClick={onClose}
            className="uppercase font-mono text-xs"
          >
            Cancel
          </GameButton>

          <button
            type="button"
            onClick={handleConfirmLogout}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 px-5 py-2.5 font-display text-sm font-extrabold uppercase text-white shadow-md shadow-rose-600/25 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Confirm Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
