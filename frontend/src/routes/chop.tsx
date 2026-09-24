import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Scissors, Sparkles, AlertTriangle, ShieldCheck, Volume2, ArrowRight } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";
import { SignalAudioPlayer } from "@/lib/audio";
import {
  api,
  getRecipeRunSession,
  recordStageAccuracy,
  syncSessionParamsToBackend,
  updateRecipeRunSession,
  useActiveRecipe,
  usePipelineStageSignal,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chop")({
  head: () => ({
    meta: [
      { title: "Chop Lab (Nyquist & Decimation) — WaveBakery" },
      {
        name: "description",
        content:
          "Chop your dish to perfection: decimate the signal sampling rate and prevent aliasing with anti-aliasing lowpass filters.",
      },
      { property: "og:title", content: "Chop Lab — WaveBakery" },
      {
        property: "og:description",
        content: "Sampling, downsampling, and Nyquist-Shannon aliasing prevention.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChopLabScreen,
});

function ChopLabScreen() {
  const [recipe] = useActiveRecipe();
  const [marinatedSignal] = usePipelineStageSignal(recipe.id, "marinated");
  const [, setCookedSignal] = usePipelineStageSignal(recipe.id, "cooked");
  const navigate = useNavigate();

  const [chopFactor, setChopFactor] = useState<number>(2);
  const [antiAlias, setAntiAlias] = useState<boolean>(true);
  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      if (player) player.destroy();
    };
  }, [player]);

  const targetChopFactor = 3; // Standard target decimation factor
  const sampleRate = 22050;
  const effectiveFs = Math.round(sampleRate / chopFactor);
  const nyquistFreq = Math.round(effectiveFs / 2);
  const signalHighestFreq = Math.round(marinatedSignal.frequency * 800);

  // Aliasing condition: if signal frequencies exceed the downsampled Nyquist limit without pre-filtering
  const isAliasing = !antiAlias && chopFactor > 1 && signalHighestFreq > nyquistFreq;

  // Discrete decimation of the samples
  const decimatedSamples = useMemo(() => {
    const inSamples = marinatedSignal.samples;
    const len = inSamples.length;
    const out: number[] = new Array(len);

    for (let i = 0; i < len; i++) {
      // Subsample by keeping every M-th sample, Zero-Order Hold (ZOH)
      const stepIdx = Math.floor(i / chopFactor) * chopFactor;
      let val = inSamples[Math.min(len - 1, stepIdx)] ?? 0;

      // Add harmonic aliasing noise distortion if anti-aliasing is disabled
      if (isAliasing) {
        const foldedFreq = Math.abs(effectiveFs - signalHighestFreq);
        const aliasedPhase = (i / len) * Math.PI * 2 * (foldedFreq / 100);
        val += Math.sin(aliasedPhase) * 0.35;
      }
      out[i] = val;
    }

    // Normalize
    let maxAbs = 0;
    for (let i = 0; i < len; i++) {
      const abs = Math.abs(out[i] ?? 0);
      if (abs > maxAbs) maxAbs = abs;
    }
    const scale = maxAbs > 0.95 ? 0.95 / maxAbs : 1.0;
    return out.map((s) => s * scale);
  }, [marinatedSignal.samples, chopFactor, isAliasing, effectiveFs, signalHighestFreq]);

  const accuracy = useMemo(() => {
    const factorDiff = Math.abs(chopFactor - targetChopFactor);
    let base = Math.max(20, 100 - factorDiff * 25);
    if (!antiAlias && chopFactor > 1) base = Math.max(15, base - 35);
    return base;
  }, [chopFactor, antiAlias]);

  const handlePlayAudio = () => {
    if (player) player.destroy();
    const p = new SignalAudioPlayer({
      samples: decimatedSamples,
      frequency: marinatedSignal.frequency,
      duration: 2.5,
    });
    p.play();
    setPlayer(p);
  };

  const handleProceed = () => {
    updateRecipeRunSession({
      cookingAppliance: recipe.cookingMethod.id,
    });
    syncSessionParamsToBackend(recipe.id).catch(() => {});
    recordStageAccuracy("cooking", accuracy);
    navigate({ to: "/cooking" });
  };

  const chefLine = isAliasing
    ? "⚠️ Warning! High frequencies exceeded the Nyquist limit without an anti-aliasing filter. The textures are rough and folded over!"
    : chopFactor === targetChopFactor && antiAlias
      ? "🎯 Perfect! Clean discrete decimation with zero aliasing artifacts."
      : "Adjust the chop coarseness dial (decimation factor M) and enable anti-aliasing filtering to protect the waveform.";

  return (
    <LabShell
      eyebrow="Station 06 · Sampling & Decimation"
      title="Chop / Nyquist Lab"
      chefLine={chefLine}
      backTo="/marinate"
      backLabel="← Back to Marinating"
      nextTo="/cooking"
      nextLabel="Proceed to Cooking →"
    >
      {/* HUD Header */}
      <div className="kitchen-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-secondary/80 px-3 py-1.5 shadow-sm">
            <Scissors className="h-4 w-4 text-primary" />
            <div>
              <p className="font-mono text-[9px] font-extrabold tracking-[0.2em] text-primary uppercase">
                Active Recipe
              </p>
              <p className="font-display text-sm font-extrabold uppercase text-foreground">
                {recipe.name}
              </p>
            </div>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
              Effective Sampling Rate
            </p>
            <p className="font-display text-sm font-bold text-foreground">
              f_s' = {effectiveFs} Hz
            </p>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
              New Nyquist Boundary
            </p>
            <p className="font-display text-sm font-bold text-foreground">
              f_Nyquist = {nyquistFreq} Hz
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs font-extrabold uppercase",
              isAliasing
                ? "border-destructive bg-destructive/15 text-destructive"
                : "border-signal-alt/60 bg-signal-alt/20 text-signal-alt",
            )}
          >
            {isAliasing ? "⚠ Aliasing Detected" : "✓ Nyquist Satisfied"}
          </span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Waveforms & Aliasing Comparison */}
        <div className="space-y-6">
          <div className="kitchen-card p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Time Domain Discrete Decimation
                </p>
                <h3 className="font-display text-lg font-extrabold text-foreground uppercase">
                  Decimated Dish Waveform (M = {chopFactor}x)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <GameButton variant="lab" size="sm" onClick={handlePlayAudio}>
                  <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                  Play Output
                </GameButton>
              </div>
            </div>

            <div className="mt-4">
              <WaveformDisplay
                label={`Decimated Signal (Sampling Factor M = ${chopFactor})`}
                samples={decimatedSamples}
                color={isAliasing ? "rgba(244, 63, 94, 0.9)" : "var(--signal)"}
              />
            </div>

            {isAliasing && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Spectral Aliasing Active:</strong> Frequencies above {nyquistFreq} Hz are
                  folding back into audible distortion. Enable <strong>Anti-Aliasing Filter</strong>{" "}
                  to suppress frequencies above Nyquist prior to decimation.
                </span>
              </div>
            )}
          </div>

          {/* Academic Principle Callout */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 font-mono text-xs text-muted-foreground space-y-2">
            <p className="font-bold text-foreground">
              📐 <strong>Nyquist-Shannon Sampling Theorem:</strong>
            </p>
            <p>
              Downsampling an audio signal by factor $M$ reduces the effective sampling frequency to
              $f_s' = f_s / M$. To reconstruct the signal without irreversible aliasing distortion,
              all frequencies must satisfy:
            </p>
            <div className="rounded-lg bg-black/30 p-2 text-center text-primary font-bold">
              f_{"{max}"} &lt; f_{"{Nyquist}"} = \frac{`{f_s'}`}
              {`{2}`} = \frac{`{f_s}`}
              {`{2M}`}
            </div>
          </div>
        </div>

        {/* Controls Column */}
        <div className="space-y-6">
          {/* Decimation Factor Slider */}
          <div className="kitchen-card p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-primary" />
                <h4 className="font-display text-base font-extrabold uppercase text-foreground">
                  Chop Factor (Downsampling M)
                </h4>
              </div>
              <span className="rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 font-mono text-xs font-extrabold text-primary">
                {chopFactor}x Downsample
              </span>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Controls discrete decimation {"x_dec[n] = x[M · n]"}. Retains every M-th sample.
            </p>

            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={chopFactor}
              onChange={(e) => setChopFactor(Number(e.target.value))}
              className="mt-4 h-2.5 w-full cursor-grab accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
            />

            <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
              <span>1x (Continuous)</span>
              <span>Target: {targetChopFactor}x</span>
              <span>8x (Coarse)</span>
            </div>
          </div>

          {/* Anti-Aliasing Filter Toggle */}
          <div className="kitchen-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-base font-extrabold uppercase text-foreground">
                  Anti-Aliasing Pre-Filter
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Low-pass filters signal at cutoff $f_c = f_s / 2M$ prior to subsampling.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAntiAlias((prev) => !prev)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-xs font-extrabold uppercase transition-all cursor-pointer",
                  antiAlias
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-xs"
                    : "border-destructive bg-destructive/15 text-destructive",
                )}
              >
                {antiAlias ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span>{antiAlias ? "ENABLED (Protected)" : "OFF (Raw Aliasing)"}</span>
              </button>
            </div>
          </div>

          {/* Action Card */}
          <div className="kitchen-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground uppercase">
                Chop Accuracy Rating:
              </span>
              <span className="font-display text-xl font-extrabold text-gradient-warm">
                {accuracy}% Match
              </span>
            </div>

            <GameButton
              size="lg"
              className="w-full uppercase font-bold tracking-wider"
              onClick={handleProceed}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Accept Chop &amp; Continue →
            </GameButton>
          </div>
        </div>
      </div>
    </LabShell>
  );
}
