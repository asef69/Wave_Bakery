import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";

type LabShellProps = {
  eyebrow: string;
  title: string;
  chefLine: string;
  children: ReactNode;
  /** rough mockup footer navigation */
  backTo?: string | undefined;
  backLabel?: string | undefined;
  nextTo?: string | undefined;
  nextLabel?: string | undefined;
};

/** Shared full-screen lab layout: HUD header, content, Chef Fourier, flow buttons. */
export function LabShell({
  eyebrow,
  title,
  chefLine,
  children,
  backTo = "/kitchen",
  backLabel = "← Back to Kitchen",
  nextTo,
  nextLabel = "Continue →",
}: LabShellProps) {
  const [stageKey, setStageKey] = useState<number>(0);

  useEffect(() => {
    const handleStageReset = () => {
      setStageKey((prev) => prev + 1);
    };
    window.addEventListener("wavebakery_stage_reset", handleStageReset);
    return () => window.removeEventListener("wavebakery_stage_reset", handleStageReset);
  }, []);

  return (
    <main className="relative min-h-screen bg-background">
      <TimeExpiredModal />
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
      <div className="relative z-10 mx-auto max-w-7xl px-8 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to={backTo}>
              <GameButton variant="ghost" size="sm">
                {backLabel}
              </GameButton>
            </Link>
            <p className="mt-3 font-mono text-[10px] tracking-[0.3em] text-primary uppercase">
              {eyebrow}
            </p>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground uppercase">
              {title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <RecipeTimerBadge />
            <span className="rounded-full border border-border bg-card px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Signal Processing Lab
            </span>
          </div>
        </header>

        <span
          className="mt-5 block h-1.5 w-full rounded-full bg-[image:var(--gradient-warm)] opacity-70"
          aria-hidden
        />

        <div key={stageKey} className="mt-8">
          {children}
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <ChefFourier size="sm" float={false} message={chefLine} />
          {nextTo ? (
            <Link to={nextTo}>
              <GameButton size="lg" className="uppercase">
                {nextLabel}
              </GameButton>
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
