import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Flame, Sparkles, Volume2, Waves, Activity } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";
import { SignalAudioPlayer } from "@/lib/audio";
import {
  recordStageAccuracy,
  syncSessionParamsToBackend,
  updateRecipeRunSession,
  useActiveRecipe,
  usePipelineStageSignal,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/caramelize")({
  head: () => ({
    meta: [
      { title: "Caramelize Lab (AM Modulation) — WaveBakery" },
      {
        name: "description",
        content:
          "Caramelize your recipe with Amplitude Modulation: adjust carrier frequency and modulation depth to create harmonic sidebands.",
      },
      { property: "og:title", content: "Caramelize Lab — WaveBakery" },
      {
        property: "og:description",
        content: "Amplitude Modulation (AM) and sideband generation in the culinary kitchen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaramelizeLabScreen,
});

function CaramelizeLabScreen() {
  const [recipe] = useActiveRecipe();
  const [marinatedSignal] = usePipelineStageSignal(recipe.id, "marinated");
  const navigate = useNavigate();

  const [carrierFreq, setCarrierFreq] = useState<number>(180);
  const [depth, setDepth] = useState<number>(0.55);
  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      if (player) player.destroy();
    };
  }, [player]);

  const targetCarrier = 180;
  const targetDepth = 0.55;

  // AM Modulated samples: x_AM(t) = x_in(t) * (1 + m * cos(2*pi*fc*t))
  const modulatedSamples = useMemo(() => {
    const inSamples = marinatedSignal.samples;
    const len = inSamples.length;
    const out: number[] = new Array(len);

    for (let i = 0; i < len; i++) {
      const t = i / (len - 1);
      const carrier = Math.cos(2 * Math.PI * (carrierFreq / 10) * t);
      const raw = inSamples[i] ?? 0;
      out[i] = raw * (1.0 + depth * carrier);
    }

    // Normalize
    let maxAbs = 0;
    for (let i = 0; i < len; i++) {
      const abs = Math.abs(out[i] ?? 0);
      if (abs > maxAbs) maxAbs = abs;
    }
    const scale = maxAbs > 0.95 ? 0.95 / maxAbs : 1.0;
    return out.map((s) => s * scale);
  }, [marinatedSignal.samples, carrierFreq, depth]);

  const accuracy = useMemo(() => {
    const carrierErr = Math.abs(carrierFreq - targetCarrier) / targetCarrier;
    const depthErr = Math.abs(depth - targetDepth);
    const score = Math.max(10, Math.min(100, Math.round(100 - (carrierErr * 45 + depthErr * 55))));
    return score;
  }, [carrierFreq, depth]);

  const handlePlayAudio = () => {
    if (player) player.destroy();
    const p = new SignalAudioPlayer({
      samples: modulatedSamples,
      frequency: carrierFreq / 10,
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

  const chefLine =
    accuracy >= 90
      ? "🔥 Gorgeous caramelization! The AM envelope and carrier sidebands match the master recipe."
      : "Adjust the torch carrier frequency and modulation depth dials until the golden harmonic crust forms.";

  return (
    <LabShell
      eyebrow="Station 05 · Amplitude Modulation"
      title="Caramelize / AM Lab"
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
            <Flame className="h-4 w-4 text-primary" />
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
              Carrier Frequency (f_c)
            </p>
            <p className="font-display text-sm font-bold text-foreground">{carrierFreq} Hz</p>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
              Modulation Depth (m)
            </p>
            <p className="font-display text-sm font-bold text-foreground">
              {(depth * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary uppercase">
            Sidebands: {carrierFreq - 30} Hz &amp; {carrierFreq + 30} Hz
          </span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Waveforms & Spectrum */}
        <div className="space-y-6">
          <div className="kitchen-card p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Time Domain AM Waveform
                </p>
                <h3 className="font-display text-lg font-extrabold text-foreground uppercase">
                  Carrier with Modulating Envelope x_AM(t)
                </h3>
              </div>

              <GameButton variant="lab" size="sm" onClick={handlePlayAudio}>
                <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                Play AM Audio
              </GameButton>
            </div>

            <div className="mt-4">
              <WaveformDisplay
                label={`AM Modulated Signal (f_c = ${carrierFreq} Hz, m = ${(depth * 100).toFixed(0)}%)`}
                samples={modulatedSamples}
                color="var(--primary)"
              />
            </div>
          </div>

          {/* Theory card */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 font-mono text-xs text-muted-foreground space-y-2">
            <p className="font-bold text-foreground">
              📻 <strong>Standard Amplitude Modulation Formula:</strong>
            </p>
            <div className="rounded-lg bg-black/30 p-2 text-center text-primary font-bold">
              x_{"{AM}"}(t) = x_{"{in}"}(t) \\cdot [ 1 + m \\cos(2\\pi f_c t) ]
            </div>
            <p>
              Modulating the culinary signal creates dual sidebands at $f_c - f_m$ (Lower Sideband)
              and $f_c + f_m$ (Upper Sideband), producing the crisp oscillating texture of
              caramelization.
            </p>
          </div>
        </div>

        {/* Controls Column */}
        <div className="space-y-6">
          {/* Carrier Frequency Slider */}
          <div className="kitchen-card p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                <h4 className="font-display text-base font-extrabold uppercase text-foreground">
                  Torch Carrier Frequency (f_c)
                </h4>
              </div>
              <span className="rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 font-mono text-xs font-extrabold text-primary">
                {carrierFreq} Hz
              </span>
            </div>

            <input
              type="range"
              min={50}
              max={500}
              step={10}
              value={carrierFreq}
              onChange={(e) => setCarrierFreq(Number(e.target.value))}
              className="mt-4 h-2.5 w-full cursor-grab accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
            />

            <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
              <span>50 Hz (Warm)</span>
              <span>Target: {targetCarrier} Hz</span>
              <span>500 Hz (Sharp)</span>
            </div>
          </div>

          {/* Modulation Depth Slider */}
          <div className="kitchen-card p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h4 className="font-display text-base font-extrabold uppercase text-foreground">
                  Modulation Depth (m)
                </h4>
              </div>
              <span className="rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 font-mono text-xs font-extrabold text-primary">
                {(depth * 100).toFixed(0)}% Depth
              </span>
            </div>

            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="mt-4 h-2.5 w-full cursor-grab accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
            />

            <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
              <span>10% (Subtle)</span>
              <span>Target: {(targetDepth * 100).toFixed(0)}%</span>
              <span>100% (Full Envelope)</span>
            </div>
          </div>

          {/* Action Card */}
          <div className="kitchen-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground uppercase">
                Caramelization Accuracy:
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
              Accept Caramelize &amp; Continue →
            </GameButton>
          </div>
        </div>
      </div>
    </LabShell>
  );
}
