import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, Sparkles } from "lucide-react";

import { ServeChoiceModal } from "@/components/beamforming/ServeChoiceModal";
import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";
import { CookedSignalAudioPlayer, type PlaybackState } from "@/lib/audio";
import {
  useActiveRecipe,
  useCookedSignal,
  usePipelineStageSignal,
  useRecipeProgress,
  useRecipeTimer,
} from "@/lib/recipes";

export const Route = createFileRoute("/check-dish")({
  head: () => ({
    meta: [
      { title: "Dish Ready — Final Signal Inspection — WaveBakery" },
      {
        name: "description",
        content: "Inspect and listen to your finished cooked signal before plating and serving.",
      },
      { property: "og:title", content: "Dish Ready — Final Signal Inspection — WaveBakery" },
      {
        property: "og:description",
        content: "Final audio and visual inspection of the convolved signal in WaveBakery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckDishScreen,
});

function CheckDishScreen() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep] = useRecipeProgress();
  const { session } = useRecipeTimer();
  const [cookedSignal] = useCookedSignal(recipe.id);
  // The Mixing curve (carried through marinating) the dish is drawn along.
  const [curveRef] = usePipelineStageSignal(recipe.id, "marinated");

  const [isServeModalOpen, setIsServeModalOpen] = useState(false);
  const [player, setPlayer] = useState<CookedSignalAudioPlayer | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    isEnded: false,
    currentTime: 0,
    duration: 3.0,
    progress: 0,
  });

  useEffect(() => {
    const p = new CookedSignalAudioPlayer(cookedSignal, (state) => {
      setPlaybackState(state);
    });
    setPlayer(p);

    return () => {
      p.destroy();
    };
  }, [cookedSignal]);

  // Needs the Cooking lab done (it unlocks 7). This page used to unlock 7
  // itself on load — even while showing this lock — skipping Cooking.
  if (unlockedStep < 7) {
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
              Station Locked: Check Dish
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Cook your signal with an impulse response first before inspecting the finished dish.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/cooking">
                <GameButton size="lg" className="uppercase">
                  Go to Cooking Lab →
                </GameButton>
              </Link>
              <Link to="/kitchen">
                <GameButton size="lg" variant="secondary" className="uppercase">
                  ← Back to Kitchen
                </GameButton>
              </Link>
            </div>
            <div className="mx-auto mt-8 max-w-md">
              <ChefFourier
                size="sm"
                float={false}
                message="We have to convolve the signal in the Cooking Lab before we can inspect it!"
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const fundamentalHz = Math.round(220 * (cookedSignal.frequency / 4));

  return (
    <main className="relative min-h-screen bg-background">
      <ServeChoiceModal
        isOpen={isServeModalOpen}
        onClose={() => setIsServeModalOpen(false)}
        recipeName={recipe.name}
      />
      <TimeExpiredModal />

      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-8 py-10">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <div className="mb-2">
              <Link to="/cooking">
                <GameButton variant="ghost" size="sm">
                  ← Back to Cooking Lab
                </GameButton>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-0.5 font-mono text-[11px] font-extrabold tracking-wider text-primary uppercase">
                🍽️ DISH READY!
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Your signal has finished cooking.
              </span>
            </div>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground uppercase">
              FINAL SIGNAL — <span className="text-gradient-warm">LISTEN & INSPECT</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {session && <RecipeTimerBadge />}
            <span className="rounded-full border border-border bg-card px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Station 07 · Inspection
            </span>
          </div>
        </div>

        {/* HUD Bar */}
        <div className="kitchen-card mt-6 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-secondary/80 px-3 py-1.5 shadow-sm">
              <span className="text-xl" aria-hidden>
                {recipe.id === "burger"
                  ? "🍔"
                  : recipe.id === "cake"
                    ? "🧁"
                    : recipe.id === "noodles"
                      ? "🍜"
                      : recipe.id === "chicken-fry"
                        ? "🍗"
                        : "🥪"}
              </span>
              <div>
                <p className="font-mono text-[9px] font-extrabold tracking-[0.2em] text-primary uppercase">
                  Cooked Dish
                </p>
                <p className="font-display text-sm font-extrabold uppercase text-foreground">
                  {recipe.name}
                </p>
              </div>
            </div>

            <div>
              <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
                Cooking Impulse
              </p>
              <p className="font-display text-sm font-bold tracking-[0.08em] text-foreground uppercase">
                {cookedSignal.methodName} Response
              </p>
            </div>

            <div>
              <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
                Status
              </p>
              <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-signal">
                <Sparkles className="h-3 w-3" /> Ready for Plating
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-bold text-primary uppercase">
              Convolution Complete (x ∗ h)(t)
            </span>
          </div>
        </div>

        {/* Center Stage: Final Signal Waveform Box */}
        <div className="kitchen-card mt-6 border-2 border-primary/30 bg-card/95 p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-primary/50 bg-primary/15 px-3 py-1 font-mono text-[10px] font-extrabold tracking-wider text-primary uppercase shadow-xs">
                FINAL COOKED OUTPUT
              </span>
              <span className="rounded-md border border-border bg-secondary/90 px-3 py-1 font-mono text-[10px] font-extrabold tracking-wider text-foreground uppercase">
                TIME DOMAIN
              </span>
              <span className="rounded-md border border-signal/50 bg-signal/15 px-3 py-1 font-mono text-[10px] font-extrabold tracking-wider text-signal uppercase shadow-xs">
                {cookedSignal.methodName} IMPULSE
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs font-bold text-muted-foreground">
              <Volume2 className="h-4 w-4 text-primary" />
              <span>Acoustic Wave Inspection</span>
            </div>
          </div>

          {/* High-Contrast Waveform Display */}
          <div className="mt-5">
            <WaveformDisplay
              height={220}
              label={`Output Signal: (Input ∗ ${cookedSignal.methodName})(t)`}
              cursorProgress={playbackState.progress}
              samples={cookedSignal.samples}
              curveRef={curveRef}
              color="var(--signal)"
            />
          </div>

          {/* Playback Controls & Audio Bar */}
          <div className="mt-6 rounded-2xl border border-border/80 bg-secondary/60 p-5 shadow-inner">
            {/* Time & Progress Indicators */}
            <div className="flex items-center justify-between font-mono text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    playbackState.isPlaying ? "bg-primary animate-ping" : "bg-muted-foreground/50"
                  }`}
                />
                <span className="text-foreground uppercase tracking-wider font-bold">
                  {playbackState.isPlaying
                    ? "Playing Audio..."
                    : playbackState.isPaused
                      ? "Playback Paused"
                      : "Audio Ready"}
                </span>
              </div>
              <div className="font-mono">
                <span className="font-bold text-primary text-sm">
                  {playbackState.currentTime.toFixed(1)}s
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  / {playbackState.duration.toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Scrub & Progress Bar */}
            <div
              className="mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary border border-border/80 relative cursor-pointer"
              onClick={() => {
                if (playbackState.isPlaying) {
                  player?.pause();
                } else {
                  player?.play();
                }
              }}
              title="Click to toggle playback"
            >
              <div
                className="h-full bg-gradient-to-r from-primary via-primary-glow to-signal shadow-sm transition-[width] duration-75"
                style={{ width: `${(playbackState.progress * 100).toFixed(1)}%` }}
              />
            </div>

            {/* Controls Bar & DSP Characteristics */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {playbackState.isPlaying ? (
                  <GameButton
                    size="md"
                    variant="lab"
                    onClick={() => player?.pause()}
                    className="uppercase font-extrabold tracking-wider"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </GameButton>
                ) : (
                  <GameButton
                    size="md"
                    onClick={() => player?.play()}
                    className="uppercase font-extrabold tracking-wider bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  >
                    <Play className="mr-2 h-4 w-4 fill-current" />
                    {playbackState.isEnded
                      ? "Play Again"
                      : playbackState.isPaused
                        ? "Resume Audio"
                        : "▶ Play Final Sound"}
                  </GameButton>
                )}

                <GameButton
                  size="md"
                  variant="secondary"
                  onClick={() => player?.replay()}
                  className="uppercase font-bold tracking-wider"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Replay
                </GameButton>
              </div>

              {/* Signal Acoustic Parameters */}
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                <div className="rounded-lg border border-border bg-card/80 px-3 py-1.5">
                  <span className="text-muted-foreground uppercase text-[10px] block">Pitch</span>
                  <span className="font-bold text-foreground">{fundamentalHz} Hz</span>
                </div>
                <div className="rounded-lg border border-border bg-card/80 px-3 py-1.5">
                  <span className="text-muted-foreground uppercase text-[10px] block">
                    Amplitude
                  </span>
                  <span className="font-bold text-foreground">
                    {(cookedSignal.amplitude * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-card/80 px-3 py-1.5">
                  <span className="text-muted-foreground uppercase text-[10px] block">
                    Harmonics
                  </span>
                  <span className="font-bold text-foreground">
                    {cookedSignal.noise > 0 ? "Crackle + Rich" : "Clean Sines"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation & Serving Actions */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <ChefFourier
            size="sm"
            float={false}
            message="Smells like perfect math! Give that signal a listen before we plate it."
          />

          <div className="flex flex-wrap items-center gap-4">
            <Link to="/cooking">
              <GameButton size="lg" variant="secondary" className="uppercase font-bold">
                ← Back to Cooking Lab
              </GameButton>
            </Link>

            <GameButton
              size="lg"
              className="uppercase font-extrabold tracking-wider bg-primary text-primary-foreground shadow-xl shadow-primary/30 hover:scale-[1.02] cursor-pointer text-base px-8 py-3.5"
              onClick={() => setIsServeModalOpen(true)}
            >
              SERVE DISH →
            </GameButton>
          </div>
        </div>
      </div>
    </main>
  );
}
