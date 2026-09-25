import { Link } from "@tanstack/react-router";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { TimeExpiredModal } from "@/components/game/RecipeTimer";

/** The standard "Station Locked" screen shown before a station's prerequisite is done. */
export function StationLocked({
  station,
  reason,
  chefLine,
  goTo,
  goLabel,
}: {
  station: string;
  reason: string;
  chefLine: string;
  goTo: string;
  goLabel: string;
}) {
  return (
    <main className="relative min-h-screen bg-background">
      <TimeExpiredModal />
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
      <div className="relative z-10 mx-auto max-w-4xl px-8 py-16 text-center">
        <div className="kitchen-card p-10">
          <span className="text-4xl" aria-hidden>
            🔒
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground uppercase">
            Station Locked: {station}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to={goTo}>
              <GameButton size="lg" className="uppercase">
                {goLabel}
              </GameButton>
            </Link>
            <Link to="/kitchen">
              <GameButton size="lg" variant="secondary" className="uppercase">
                ← Back to Kitchen
              </GameButton>
            </Link>
          </div>
          <div className="mx-auto mt-8 max-w-md">
            <ChefFourier size="sm" float={false} message={chefLine} />
          </div>
        </div>
      </div>
    </main>
  );
}
