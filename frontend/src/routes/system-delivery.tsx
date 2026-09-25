import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Play, Radio, RotateCcw, Sliders, Volume2 } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { StationLocked } from "@/components/game/StationLocked";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";
import {
  SystemResponsePlotter,
  type SystemPresetType,
} from "@/components/system/SystemResponsePlotter";
import { CookedSignalAudioPlayer, type PlaybackState } from "@/lib/audio";
import { hasPipelineStageSignal } from "@/lib/pipeline";
import {
  recordStageAccuracy,
  updateRecipeRunSession,
  useActiveRecipe,
  useCookedSignal,
  usePipelineStageSignal,
  useRecipeProgress,
  useRecipeTimer,
} from "@/lib/recipes";
import {
  SYSTEM_ALIAS_FREE_FS,
  applySystem,
  systemAccuracy,
  systemPolesZeros,
} from "@/lib/z-system";

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

function SystemDeliveryLab() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep] = useRecipeProgress();
  const { session } = useRecipeTimer();
  const [cookedSignal] = useCookedSignal(recipe.id);
  // The dish arriving here is the Precision Oven's output (the delivered
  // stage); fall back to the cooked dish if the oven was skipped.
  const [deliveredSignal] = usePipelineStageSignal(recipe.id, "delivered");
  const dishSamples = useMemo(
    () =>
      hasPipelineStageSignal(recipe.id, "delivered") && deliveredSignal.samples.length > 0
        ? deliveredSignal.samples
        : cookedSignal.samples,
    [recipe.id, deliveredSignal.samples, cookedSignal.samples],
  );

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
    return () => {
      if (audioPlayer) audioPlayer.destroy();
    };
  }, [audioPlayer]);

  const system = useMemo(
    () => systemPolesZeros(preset, poleRadius, frequency),
    [preset, poleRadius, frequency],
  );
  const isStable = system.poles.every((p) => Math.hypot(p.re, p.im) < 1);

  // The dish really goes through the cart's H(z). An unstable system blows
  // up; normalizing keeps it audible as the runaway ringing it is.
  const equalizedSamples = useMemo(() => {
    const y = applySystem(dishSamples, system);
    const peak = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    return peak > 1e-9 ? y.map((v) => (v / peak) * 0.95) : y;
  }, [dishSamples, system]);

  const accuracy = systemAccuracy(system, samplingRateHz);
  useEffect(() => {
    recordStageAccuracy("system", accuracy);
  }, [accuracy]);

  // The server scores this station from the settings themselves (sent with
  // the next params sync, e.g. right before the dish is submitted).
  useEffect(() => {
    updateRecipeRunSession({
      systemPreset: preset,
      systemPoleRadius: poleRadius,
      systemSamplingHz: samplingRateHz,
    });
  }, [preset, poleRadius, samplingRateHz]);

  // A new system means a new signal: drop the old player (the cleanup effect
  // above destroys it) so the next play uses the current filter.
  useEffect(() => {
    setAudioPlayer(null);
    setPlaybackState((prev) => ({ ...prev, isPlaying: false, isPaused: false, progress: 0 }));
  }, [equalizedSamples]);

  const handleToggleAudio = () => {
    if (!audioPlayer) {
      const p = new CookedSignalAudioPlayer(
        { ...cookedSignal, samples: equalizedSamples },
        (state) => setPlaybackState(state),
      );
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
    : samplingRateHz < SYSTEM_ALIAS_FREE_FS
      ? "⚠️ The wobble sensor is sampling too slowly (fs < 2·f_max) — it's misreading fast shakes as slow ones!"
      : "Cart's rolling smooth! Wobble stays inside the safe limit and the sensor keeps up with every shake.";

  // Reached from the Precision Oven, which unlocks 8. This page used to
  // unlock 7 on load, so opening its URL skipped straight to the score.
  if (unlockedStep < 8) {
    return (
      <StationLocked
        station="System Delivery"
        reason="Finish the dish in the Precision Oven before loading it onto the delivery cart."
        chefLine="The cart only carries dishes that have been through the Precision Oven!"
        goTo="/beam-delivery"
        goLabel="Go to Precision Oven →"
      />
    );
  }

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
          dishSignal={dishSamples}
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
