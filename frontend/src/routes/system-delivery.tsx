import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Play, Radio, RotateCcw, Sliders, Volume2 } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";
import {
  SystemResponsePlotter,
  type SystemPresetType,
} from "@/components/system/SystemResponsePlotter";
import { CookedSignalAudioPlayer, type PlaybackState } from "@/lib/audio";
import { useActiveRecipe, useCookedSignal, useRecipeProgress, useRecipeTimer } from "@/lib/recipes";

export const Route = createFileRoute("/system-delivery")({
  head: () => ({
    meta: [
      { title: "System Delivery Lab — WaveBakery" },
      {
        name: "description",
        content:
          "Equalize dish signals using z-plane poles and zeros, Radix-2 FFT spectrum analysis, and Nyquist sampling before serving.",
      },
      { property: "og:title", content: "System Delivery Lab — WaveBakery" },
      {
        property: "og:description",
        content:
          "z-Plane unit circle poles & zeros, Radix-2 FFT, and Nyquist sampling rate calibration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemDeliveryLab,
});

export function SystemDeliveryLab() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const { session } = useRecipeTimer();
  const [cookedSignal] = useCookedSignal(recipe.id);

  // System controls state (No Dragging!)
  const [preset, setPreset] = useState<SystemPresetType>("resonator2");
  const [poleRadius, setPoleRadius] = useState<number>(0.85);
  const [frequency, setFrequency] = useState<number>(Math.PI * 0.35);
  const [samplingRateHz, setSamplingRateHz] = useState<number>(8000);

  const [audioPlayer, setAudioPlayer] = useState<CookedSignalAudioPlayer | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    isEnded: false,
    currentTime: 0,
    duration: 3.0,
    progress: 0,
  });

  useEffect(() => {
    unlock(7);
  }, [unlock]);

  useEffect(() => {
    return () => {
      if (audioPlayer) audioPlayer.destroy();
    };
  }, [audioPlayer]);

  const isStable = poleRadius < 1.0;

  const handleToggleAudio = () => {
    if (!audioPlayer) {
      const p = new CookedSignalAudioPlayer(cookedSignal, (state) => setPlaybackState(state));
      setAudioPlayer(p);
      p.play();
    } else {
      if (playbackState.isPlaying) {
        audioPlayer.pause();
      } else if (playbackState.isEnded) {
        audioPlayer.replay();
      } else {
        audioPlayer.play();
      }
    }
  };

  const chefLine = !isStable
    ? "⚠️ Careful! The delivery cart's wheel wobble r ≥ 1.0 is past the safe limit — it'll shake the dish right off the tray!"
    : samplingRateHz < 4000
      ? "⚠️ The wobble sensor is sampling too slowly (fs < 2·f_max) — it's misreading fast shakes as slow ones!"
      : "Cart's rolling smooth! Wobble stays inside the safe limit and the sensor keeps up with every shake.";

  return (
    <LabShell
      eyebrow="Station 07 · System Delivery"
      title="System Delivery Lab"
      chefLine={chefLine}
      backTo="/beam-delivery"
      backLabel="← Back to Precision Oven"
      nextTo="/score"
      nextLabel="SERVE DISH TO TASTING TABLE →"
    >
      <TimeExpiredModal />

      {/* HUD HEADER */}
      <div className="kitchen-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-secondary/80 px-3 py-1.5 shadow-sm">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <div>
              <p className="font-mono text-[9px] font-extrabold tracking-[0.2em] text-primary uppercase">
                Active Recipe
              </p>
              <p className="font-display text-sm font-extrabold text-foreground">{recipe.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-muted-foreground uppercase text-[10px]">Sampling:</span>
            <span className="font-bold text-foreground">{samplingRateHz} Hz</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground uppercase text-[10px]">Cart Status:</span>
            <span className={isStable ? "font-bold text-emerald-400" : "font-bold text-rose-400"}>
              {isStable ? "Rolling Smooth" : "Shaking Apart!"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleAudio}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-display text-xs font-extrabold uppercase text-primary-foreground shadow-md hover:bg-primary/90 cursor-pointer"
          >
            {playbackState.isPlaying ? (
              <>
                <Volume2 className="h-4 w-4 animate-bounce" />
                <span>Pause Audio</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Listen Equalized Dish</span>
              </>
            )}
          </button>

          {session && <RecipeTimerBadge />}
        </div>
      </div>

      {/* MAIN SYSTEM RESPONSE PLOTTER (Z-PLANE, PRESETS, SLIDERS, FFT, SAMPLING) */}
      <section className="mt-6">
        <SystemResponsePlotter
          preset={preset}
          poleRadius={poleRadius}
          frequency={frequency}
          samplingRateHz={samplingRateHz}
          onPresetChange={setPreset}
          onPoleRadiusChange={setPoleRadius}
          onFrequencyChange={setFrequency}
          onSamplingRateChange={setSamplingRateHz}
          dishSignal={cookedSignal.samples}
        />
      </section>

      {/* FOOTER CTA */}
      <footer className="mt-8 flex items-center justify-between border-t border-border/80 pt-6">
        <Link to="/beam-delivery">
          <GameButton variant="secondary" size="lg" className="uppercase font-bold">
            ← Back to Precision Oven
          </GameButton>
        </Link>

        <Link to="/score">
          <GameButton
            size="lg"
            className="uppercase font-extrabold tracking-wider text-base px-8 py-3.5"
          >
            SERVE DISH TO TASTING TABLE →
          </GameButton>
        </Link>
      </footer>
    </LabShell>
  );
}
