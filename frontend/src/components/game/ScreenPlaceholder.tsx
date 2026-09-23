import { Link } from "@tanstack/react-router";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";

type ScreenPlaceholderProps = {
  eyebrow: string;
  title: string;
  purpose: string;
  bullets?: string[];
};

/** Shared stub used by screens that are routed but not yet designed. */
export function ScreenPlaceholder({
  eyebrow,
  title,
  purpose,
  bullets = [],
}: ScreenPlaceholderProps) {
  return (
    <main className="min-h-screen bg-background px-10 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <Link to="/menu" className="w-fit">
          <GameButton variant="ghost" size="sm">
            ← Back to Main Menu
          </GameButton>
        </Link>

        <div className="kitchen-card p-10">
          <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-extrabold text-foreground">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{purpose}</p>

          {bullets.length > 0 ? (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {bullets.map((b) => (
                <li
                  key={b}
                  className="rounded-2xl border border-border bg-secondary/60 px-5 py-3 text-sm font-semibold text-secondary-foreground"
                >
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <WaveformDisplay label="signal preview" variant="spectrum" />
          <ChefFourier size="sm" message="This screen is coming soon!" float={false} />
        </div>
      </div>
    </main>
  );
}
