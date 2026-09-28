import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";

import { DifficultyModal } from "@/components/game/DifficultyModal";
import { GameButton } from "@/components/game/GameButton";
import { StationCountdown } from "@/components/game/StationCountdown";
import {
  DIFFICULTY_CONFIGS,
  type RecipeDifficulty,
  resetCurrentStage,
  resetRecipeProgress,
  resetRecipeTimerToFull,
  startRecipeRun,
  useActiveRecipe,
  useRecipeTimer,
} from "@/lib/recipes";
import { useSoundSettings } from "@/lib/sound";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface PauseModalProps {
  onClose?: () => void;
}

export function PauseModal({ onClose }: PauseModalProps) {
  const [recipe] = useActiveRecipe();
  const { session, timeRemaining, formattedTime, difficultyConfig, isPaused, resumeRun } =
    useRecipeTimer();
  const [soundSettings, setSoundSettings] = useSoundSettings();
  const [theme, setTheme] = useTheme();
  const navigate = useNavigate();

  // Dialog sub-states
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
  const [isDifficultyModalOpen, setIsDifficultyModalOpen] = useState(false);

  // Countdown state: 0 = none, 1 = resume countdown, 2 = restart countdown, 3 = change difficulty countdown
  const [countdownMode, setCountdownMode] = useState<"none" | "resume" | "restart" | "difficulty">(
    "none",
  );
  const [pendingDifficulty, setPendingDifficulty] = useState<RecipeDifficulty | null>(null);

  // Keyboard shortcut to toggle pause/resume with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in input elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (isDifficultyModalOpen) {
          setIsDifficultyModalOpen(false);
        } else if (isRestartConfirmOpen) {
          setIsRestartConfirmOpen(false);
        } else if (isPaused && countdownMode === "none") {
          handleResumeClick();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPaused, isRestartConfirmOpen, isDifficultyModalOpen, countdownMode]);

  // Handle clicking Resume
  const handleResumeClick = () => {
    setIsRestartConfirmOpen(false);
    setIsDifficultyModalOpen(false);
    setCountdownMode("resume");
  };

  // When Resume countdown finishes
  const handleResumeCountdownComplete = () => {
    setCountdownMode("none");
    resumeRun();
    onClose?.();
  };

  // Handle [NO, RESTART] clicked (restart current stage with same difficulty)
  const handleRestartSameDifficulty = () => {
    if (!recipe) return;
    setIsRestartConfirmOpen(false);
    // Reset current stage and freeze timer at full allocation for current difficulty
    resetCurrentStage(recipe.id);
    resetRecipeTimerToFull(recipe.id);
    // Trigger countdown overlay
    setCountdownMode("restart");
  };

  // When Restart countdown finishes
  const handleRestartCountdownComplete = () => {
    setCountdownMode("none");
    resumeRun(); // Unfreezes timer to count down from full allocation
    onClose?.();
  };

  // Handle [YES, CHANGE DIFFICULTY] clicked
  const handleChangeDifficultyClick = () => {
    setIsRestartConfirmOpen(false);
    setIsDifficultyModalOpen(true);
  };

  // When a new difficulty is chosen from DifficultyModal
  const handleDifficultyChosen = (chosen: RecipeDifficulty) => {
    if (!recipe) return;
    setPendingDifficulty(chosen);
    setIsDifficultyModalOpen(false);
    resetRecipeProgress(recipe.id);
    startRecipeRun(recipe.id, chosen);
    // Hold timer in paused state during countdown
    resetRecipeTimerToFull(recipe.id);
    setCountdownMode("difficulty");
  };

  // When Difficulty Change countdown finishes
  const handleDifficultyCountdownComplete = () => {
    setCountdownMode("none");
    resumeRun(); // Officially start timer counting down from new difficulty time
    navigate({ to: "/generate" });
    onClose?.();
  };

  // Render countdown if active
  if (countdownMode !== "none") {
    return (
      <StationCountdown
        onComplete={
          countdownMode === "resume"
            ? handleResumeCountdownComplete
            : countdownMode === "restart"
              ? handleRestartCountdownComplete
              : handleDifficultyCountdownComplete
        }
      />
    );
  }

  // Render difficulty selection modal if requested from pause restart flow
  if (isDifficultyModalOpen && recipe) {
    return (
      <DifficultyModal
        recipe={recipe}
        isOpen={true}
        onClose={() => setIsDifficultyModalOpen(false)}
        onProceed={handleDifficultyChosen}
      />
    );
  }

  // If not paused, don't render anything
  if (!isPaused || !session) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-menu-title"
    >
      <div className="kitchen-card relative w-full max-w-md overflow-hidden rounded-[2.5rem] border-2 border-primary/50 bg-card p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] text-center animate-in zoom-in-95 duration-200">
        {/* Glow accent */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
          aria-hidden
        />

        {/* 1. RESTART CONFIRMATION VIEW */}
        {isRestartConfirmOpen ? (
          <div className="relative z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary shadow-inner">
              <RotateCcw className="h-7 w-7" />
            </div>

            <p className="mt-3 font-mono text-[10px] font-extrabold tracking-[0.28em] text-primary uppercase">
              Restart Stage
            </p>
            <h2
              id="pause-menu-title"
              className="mt-1 font-display text-2xl font-extrabold tracking-tight text-foreground uppercase sm:text-3xl"
            >
              Restart Cooking?
            </h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Would you like to change difficulty?
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleChangeDifficultyClick}
                className="w-full rounded-2xl border-2 border-primary/40 bg-secondary/80 hover:bg-secondary px-5 py-3.5 font-display text-sm font-extrabold tracking-wider text-foreground uppercase transition-all shadow-xs cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Zap className="h-4 w-4 text-primary" />
                <span>YES, CHANGE DIFFICULTY</span>
              </button>

              <button
                type="button"
                onClick={handleRestartSameDifficulty}
                className="w-full rounded-2xl bg-[image:var(--gradient-warm)] hover:brightness-110 px-5 py-3.5 font-display text-sm font-black tracking-wider text-primary-foreground uppercase transition-all shadow-md cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>NO, RESTART ({difficultyConfig?.name ?? "CURRENT"})</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRestartConfirmOpen(false)}
                className="mt-1 w-full rounded-xl border border-border bg-card/60 hover:bg-secondary px-4 py-2 font-mono text-xs font-bold text-muted-foreground hover:text-foreground uppercase transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* 2. MAIN PAUSE MENU VIEW */
          <div className="relative z-10">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3.5 py-1 text-amber-500">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" aria-hidden />
              <span className="font-mono text-[10px] font-extrabold tracking-[0.24em] uppercase">
                Game Suspended
              </span>
            </div>

            {/* Title */}
            <h2
              id="pause-menu-title"
              className="mt-2 font-display text-4xl font-black tracking-tight text-foreground uppercase sm:text-5xl"
            >
              PAU<span className="text-gradient-warm">SED</span>
            </h2>

            {/* Frozen Timer Status Card */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/80 bg-secondary/50 px-4 py-3 font-mono text-xs">
              <div className="text-left">
                <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Active Recipe
                </span>
                <span className="font-display text-sm font-extrabold text-foreground uppercase">
                  {recipe.name}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Remaining Time
                </span>
                <span className="font-mono text-base font-black text-amber-500">
                  {formattedTime}
                </span>
              </div>
            </div>

            {/* Core Action Buttons */}
            <div className="mt-6 flex flex-col gap-3">
              {/* Resume Button */}
              <button
                type="button"
                onClick={handleResumeClick}
                className="w-full rounded-2xl bg-[image:var(--gradient-warm)] hover:brightness-110 px-6 py-4 font-display text-lg font-black tracking-wider text-primary-foreground uppercase transition-all shadow-lg cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2.5"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>RESUME</span>
              </button>

              {/* Restart Button */}
              <button
                type="button"
                onClick={() => setIsRestartConfirmOpen(true)}
                className="w-full rounded-2xl border-2 border-border bg-secondary/80 hover:bg-secondary hover:border-primary/40 px-6 py-3 font-display text-sm font-extrabold tracking-wider text-foreground uppercase transition-all shadow-xs cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                <span>RESTART</span>
              </button>
            </div>

            {/* Settings Divider */}
            <div className="mt-6 border-t border-border/70 pt-5 text-left space-y-4">
              {/* Theme Toggle */}
              <div>
                <label className="font-mono text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase block mb-2">
                  Kitchen Atmosphere
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border p-2.5 font-display text-xs font-extrabold uppercase transition-all cursor-pointer",
                      theme === "light"
                        ? "border-primary bg-primary/15 text-primary shadow-xs ring-1 ring-primary/40"
                        : "border-border bg-card/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <span>☀️</span>
                    <span>Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border p-2.5 font-display text-xs font-extrabold uppercase transition-all cursor-pointer",
                      theme === "dark"
                        ? "border-primary bg-primary/15 text-primary shadow-xs ring-1 ring-primary/40"
                        : "border-border bg-card/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <span>🌙</span>
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Sound Controls */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-mono text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase">
                    Sound & Volume
                  </label>
                  <button
                    type="button"
                    onClick={() => setSoundSettings({ soundEnabled: !soundSettings.soundEnabled })}
                    className={cn(
                      "rounded-lg px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase transition-all cursor-pointer",
                      soundSettings.soundEnabled
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-secondary text-muted-foreground",
                    )}
                  >
                    {soundSettings.soundEnabled ? "Sound ON" : "Sound OFF"}
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/40 p-2.5">
                  <button
                    type="button"
                    onClick={() => setSoundSettings({ soundEnabled: !soundSettings.soundEnabled })}
                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label="Toggle sound mute"
                  >
                    {!soundSettings.soundEnabled || soundSettings.volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-primary" />
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={soundSettings.soundEnabled ? soundSettings.volume : 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSoundSettings({ volume: val, soundEnabled: val > 0 });
                    }}
                    className="h-2 w-full cursor-grab rounded-full accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
                    aria-label="Game sound volume slider"
                  />

                  <span className="w-9 font-mono text-[11px] font-extrabold text-foreground text-right">
                    {soundSettings.soundEnabled ? `${soundSettings.volume}%` : "0%"}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer keyboard hint */}
            <p className="mt-5 font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase">
              Press{" "}
              <kbd className="rounded border border-border px-1 py-0.5 text-[9px] font-bold">
                ESC
              </kbd>{" "}
              to resume
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
