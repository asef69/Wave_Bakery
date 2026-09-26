import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Truck,
  Volume2,
} from "lucide-react";

import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { StationLocked } from "@/components/game/StationLocked";
import { RecipeTimerBadge, TimeExpiredModal } from "@/components/game/RecipeTimer";
import {
  SystemResponsePlotter,
  type SystemPresetType,
} from "@/components/system/SystemResponsePlotter";
import { CookedSignalAudioPlayer, type PlaybackState } from "@/lib/audio";
import { deliverOnCart, deliveryProfile, roadOmega, sensedRoadOmega } from "@/lib/delivery";
import { hasPipelineStageSignal, savePipelineStageSignal } from "@/lib/pipeline";
import {
  recordStageAccuracy,
  updateRecipeRunSession,
  useActiveRecipe,
  useCookedSignal,
  usePipelineStageSignal,
  useRecipeProgress,
  useRecipeTimer,
} from "@/lib/recipes";
import { SYSTEM_ALIAS_FREE_FS, gainAt, systemPolesZeros } from "@/lib/z-system";
import { cn } from "@/lib/utils";

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
  const [preset, setPreset] = useState<SystemPresetType>("notch");
  const [poleRadius, setPoleRadius] = useState<number>(0.85);
  const [frequency, setFrequency] = useState<number>(Math.PI * 0.35);
  const [samplingRateHz, setSamplingRateHz] = useState<number>(8000);

  const [audioMode, setAudioMode] = useState<"after" | "before">("after");
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

  // The road shakes the dish: a vibration tone at the recipe's road frequency
  // (lib/delivery.ts). The cart's H(z) must reject it without dulling the dish.
  // The dish really goes through the cart's H(z) and the output is what gets
  // served; the score is how close it is to the dish before the road shook it.
  const delivery = useMemo(
    () => deliverOnCart(recipe.id, dishSamples, system),
    [recipe.id, dishSamples, system],
  );
  const cartInput = delivery.input;
  const equalizedSamples = delivery.served;
  const accuracy = delivery.accuracy;
  // The vibration sensor samples at `samplingRateHz`; a slow sensor reports an
  // aliased frequency, so a notch aimed at that reading misses the real tone.
  const sensedOmega = sensedRoadOmega(recipe.id, samplingRateHz);
  // What the cart does to the two things that matter: the road tone (at its
  // TRUE frequency) and the dish (low frequencies, ≈ DC).
  const roadGain = gainAt(system, roadOmega(recipe.id));
  const dishGain = gainAt(system, 0);

  const profile = useMemo(() => deliveryProfile(recipe.id), [recipe.id]);

  // Record the result once per settings change
  const lastSavedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${recipe.id}|${preset}|${poleRadius}|${frequency}|${samplingRateHz}|${accuracy}`;
    if (lastSavedRef.current === key) return;
    lastSavedRef.current = key;
    recordStageAccuracy("system", accuracy);
    // The server rebuilds this from the settings
    updateRecipeRunSession({
      systemPreset: preset,
      systemPoleRadius: poleRadius,
      systemOmega: frequency,
      systemSamplingHz: samplingRateHz,
    });
    savePipelineStageSignal(recipe.id, "served", {
      ...(deliveredSignal ?? {}),
      recipeId: recipe.id,
      stage: "served",
      samples: equalizedSamples,
      timestamp: Date.now(),
    });
  }, [
    recipe.id,
    preset,
    poleRadius,
    frequency,
    samplingRateHz,
    accuracy,
    equalizedSamples,
    deliveredSignal,
  ]);

  // A new system means a new signal: drop the old player
  useEffect(() => {
    setAudioPlayer(null);
    setPlaybackState((prev) => ({ ...prev, isPlaying: false, isPaused: false, progress: 0 }));
  }, [equalizedSamples]);

  const handlePlayAudio = (mode: "after" | "before" = "after") => {
    setAudioMode(mode);
    const targetSamples = mode === "before" ? cartInput : equalizedSamples;
    if (audioPlayer) {
      audioPlayer.destroy();
      setAudioPlayer(null);
    }
    const p = new CookedSignalAudioPlayer(
      { ...cookedSignal, samples: targetSamples },
      (state) => setPlaybackState(state),
    );
    setAudioPlayer(p);
    p.play();
  };

  const handleToggleAudio = () => {
    if (!audioPlayer) {
      handlePlayAudio(audioMode);
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

  const chefLine = useMemo(() => {
    if (!isStable) {
      return "⚠️ Careful! The delivery cart's wheel wobble r ≥ 1.0 is past the safe limit (|z|=1) — runaway resonance will shake the dish right off the tray!";
    }
    if (samplingRateHz < SYSTEM_ALIAS_FREE_FS) {
      return "⚠️ The wobble sensor is sampling too slowly (fs < 2·f_max) — it's reporting an aliased ghost shake! Switch to 8.0 kHz to see the true rattle.";
    }
    if (roadGain > 1.0) {
      return `⚠️ Your cart is AMPLIFYING the road vibration ×${roadGain.toFixed(1)}! Put zeros (a notch) on the road ω instead.`;
    }
    if (accuracy >= 90) {
      return `🌟 Smooth delivery! The road vibration is cancelled (×${roadGain.toFixed(2)}) and the dish flavor is intact. Give it a quick listen and serve!`;
    }
    return `The cart is rattling at ${profile.roadHz} Hz! Choose the Notch filter and slide the zero over the orange road marker.`;
  }, [isStable, samplingRateHz, roadGain, accuracy, profile.roadHz]);

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
      eyebrow={`STATION 07 • RECIPE: ${recipe.name}`}
      title="🚚 System Delivery"
      chefLine={chefLine}
      backTo="/beam-delivery"
      backLabel="← Back to Precision Oven"
      nextTo="/score"
      nextLabel="SERVE DISH →"
    >
      <TimeExpiredModal />

      <div className="mx-auto max-w-6xl space-y-5 pb-12">
        {/* 1. LIGHTWEIGHT STATION HUD */}
        <div className="kitchen-card flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-2 border-border/80 bg-card/90 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="font-display text-sm font-extrabold text-foreground uppercase flex items-center gap-2">
              <span>🍲</span> {recipe.name}
            </span>
            <span className="h-4 w-px bg-border/80 hidden sm:inline" />
            <span className="font-mono text-xs font-bold uppercase text-primary hidden sm:inline">
              Station 07 · SYSTEM DELIVERY
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold uppercase border",
                isStable
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-rose-500/40 bg-rose-500/15 text-rose-400 animate-pulse",
              )}
            >
              {isStable ? "✓ Stable Suspension" : "⚠️ Resonance Risk (|z| ≥ 1.0)"}
            </span>
            {session && <RecipeTimerBadge />}
          </div>
        </div>

        {/* 2. COMPACT MISSION CARD */}
        <div className="kitchen-card relative overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                  <Truck className="h-4 w-4 animate-bounce" />
                </span>
                <h2 className="font-display text-xl font-black uppercase text-foreground">
                  🚚 THE CART IS SHAKING!
                </h2>
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Road vibration is disturbing your dish. Tune the suspension filter before delivery.
              </p>
              <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                <span className="text-muted-foreground">Road vibration:</span>
                <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  {(profile.roadHz / 1000).toFixed(1)} kHz ({profile.roadHz} Hz)
                </span>
              </div>
            </div>

            {/* Compact Chef Fourier speech line */}
            <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2.5 max-w-md">
              <span className="text-2xl" aria-hidden>👨‍🍳</span>
              <p className="font-mono text-xs text-muted-foreground italic">
                &ldquo;The cart is rattling! Find the vibration and cancel it before we serve.&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* 3. MAIN INTERACTIVE LAB AREA (TWO-COLUMN GAME CONSOLE) */}
        <SystemResponsePlotter
          preset={preset}
          poleRadius={poleRadius}
          frequency={frequency}
          samplingRateHz={samplingRateHz}
          onPresetChange={setPreset}
          onPoleRadiusChange={setPoleRadius}
          onFrequencyChange={setFrequency}
          onSamplingRateChange={setSamplingRateHz}
          dishSignal={cartInput}
          equalizedSignal={equalizedSamples}
          vibrationOmega={sensedOmega}
          roadGain={roadGain}
          dishGain={dishGain}
          accuracy={accuracy}
          roadHz={profile.roadHz}
          recipeName={recipe.name}
          onToggleAudio={handleToggleAudio}
          onPlayBeforeAudio={() => handlePlayAudio("before")}
          onPlayAfterAudio={() => handlePlayAudio("after")}
          audioMode={audioMode}
          isPlaying={playbackState.isPlaying}
        />

        {/* 4. FOOTER NAVIGATION & CLEAR ACTION CTAS */}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/80 pt-6">
          <Link to="/beam-delivery">
            <GameButton variant="secondary" size="lg" className="uppercase font-bold">
              ← Back to Precision Oven
            </GameButton>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <GameButton
              variant="lab"
              size="lg"
              onClick={() => handlePlayAudio("after")}
              className="uppercase font-extrabold tracking-wider"
            >
              <Truck className="mr-2 h-4 w-4" />
              🚚 TEST DELIVERY
            </GameButton>

            <Link to="/score">
              <GameButton
                size="lg"
                className="uppercase font-extrabold tracking-wider text-base px-8 py-3.5 shadow-xl bg-primary text-primary-foreground cursor-pointer"
              >
                SERVE DISH →
              </GameButton>
            </Link>
          </div>
        </footer>
      </div>
    </LabShell>
  );
}
