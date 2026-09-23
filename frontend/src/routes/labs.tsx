import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { BeamPatternGraph } from "@/components/beamforming/BeamPatternGraph";
import { BeamformingVisualizer } from "@/components/beamforming/BeamformingVisualizer";
import { PhaseControls } from "@/components/beamforming/PhaseControls";
import { SpeakerArray } from "@/components/beamforming/SpeakerArray";
import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph, type IngredientKind } from "@/components/game/IngredientGlyph";
import { MiniWave } from "@/components/game/MiniWave";
import { SignalAudioPlayer } from "@/lib/audio";
import {
  calculateMockBeamAngle,
  calculateTransmissionEfficiency,
  generateMockBeamPattern,
  type SpeakerState,
} from "@/lib/beamforming";
import { getStaticCookingKernel } from "@/lib/cooking-audio";
import { applyLowPassFilter, convolve } from "@/lib/dsp";
import {
  ALL_AVAILABLE_INGREDIENTS,
  computeIngredientSamples,
  type IngredientDetail,
} from "@/lib/recipes";
import { cn } from "@/lib/utils";

export function generatePlaygroundSamples(params: {
  freq: number;
  noise?: number;
  waveShape?: "sine" | "triangle" | "square";
  amplitude?: number;
  width?: number;
}): number[] {
  const { freq, noise = 0, waveShape = "sine", amplitude = 1.0, width = 400 } = params;
  const samples: number[] = [];
  for (let i = 0; i <= width; i++) {
    const t = i / width;
    let s = 0;
    if (waveShape === "triangle") {
      const sinVal = Math.sin(2 * Math.PI * freq * t);
      s = (2 / Math.PI) * Math.asin(Math.max(-1, Math.min(1, sinVal)));
    } else if (waveShape === "square") {
      s = Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1;
    } else {
      s = Math.sin(2 * Math.PI * freq * t);
    }
    const n = noise > 0 ? Math.sin(i * 12.9898 + 78.233) * noise * 0.485 : 0;
    samples.push(s * amplitude - n);
  }
  return samples;
}

export const Route = createFileRoute("/labs")({
  head: () => ({
    meta: [
      { title: "Signal Playground — WaveBakery" },
      {
        name: "description",
        content:
          "Free signal experimentation area: generate, filter, mix, scale, time-stretch, convolve and beamform signals freely without recipe constraints.",
      },
      { property: "og:title", content: "Signal Playground — WaveBakery" },
      {
        property: "og:description",
        content: "Explore signal processing freely in the WaveBakery Signal Playground.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlaygroundScreen,
});

export interface PlaygroundSignal {
  id: string;
  name: string;
  category: "ingredient" | "oscillator";
  instrument: string;
  freq: number;
  noise: number;
  kind: IngredientKind;
  icon?: string;
  waveShape?: "sine" | "triangle" | "square";
}

const OSCILLATOR_SIGNALS: PlaygroundSignal[] = [
  {
    id: "osc-sine",
    name: "Sine Wave",
    category: "oscillator",
    instrument: "Pure Oscillator",
    freq: 4,
    noise: 0,
    kind: "generic",
    icon: "∿",
    waveShape: "sine",
  },
  {
    id: "osc-triangle",
    name: "Triangle Wave",
    category: "oscillator",
    instrument: "Harmonic Oscillator",
    freq: 4,
    noise: 0,
    kind: "generic",
    icon: "△",
    waveShape: "triangle",
  },
  {
    id: "osc-square",
    name: "Square Wave",
    category: "oscillator",
    instrument: "Pulse Oscillator",
    freq: 4,
    noise: 0,
    kind: "generic",
    icon: "⊓",
    waveShape: "square",
  },
];

const INGREDIENT_SIGNALS: PlaygroundSignal[] = ALL_AVAILABLE_INGREDIENTS.map((ing) => ({
  id: `ing-${ing.name.toLowerCase().replace(/\s+/g, "-")}`,
  name: ing.name,
  category: "ingredient",
  instrument: ing.instrument,
  freq: ing.freq ?? 4,
  noise: ing.washable ? 0.75 : 0.05,
  kind: (ing.kind ?? "generic") as IngredientKind,
}));

const ALL_PLAYGROUND_SIGNALS: PlaygroundSignal[] = [...INGREDIENT_SIGNALS, ...OSCILLATOR_SIGNALS];

type PlaygroundStation =
  "overview" | "generate" | "filter" | "mix" | "season" | "marinate" | "convolve" | "beamforming";

interface StationInfo {
  id: PlaygroundStation;
  title: string;
  shortLabel: string;
  icon: string;
  concept: string;
  description: string;
}

const STATIONS: StationInfo[] = [
  {
    id: "generate",
    title: "Signal Generator",
    shortLabel: "Generator",
    icon: "⚡",
    concept: "Oscillators & Synthesis",
    description: "Synthesize ingredient tones and oscillators with adjustable frequency and noise.",
  },
  {
    id: "filter",
    title: "Frequency Filter",
    shortLabel: "Filtering",
    icon: "🧼",
    concept: "Low-Pass Filtering",
    description: "Sweep cutoff frequencies and listen to high-frequency noise get attenuated.",
  },
  {
    id: "mix",
    title: "Multi-Track Mixer",
    shortLabel: "Mixing",
    icon: "🥣",
    concept: "Linear Superposition",
    description: "Combine multiple ingredient signals and adjust individual channel gains.",
  },
  {
    id: "season",
    title: "Seasoning / Scaling",
    shortLabel: "Seasoning",
    icon: "🌶️",
    concept: "Amplitude & Frequency Scaling",
    description: "Scale vertical magnitude (energy) and oscillation density (pitch) independently.",
  },
  {
    id: "marinate",
    title: "Marinating / Time Scaling",
    shortLabel: "Marinating",
    icon: "🥩",
    concept: "Time Compression & Stretch",
    description:
      "Transform the signal along the time axis to stretch duration or speed up playback.",
  },
  {
    id: "convolve",
    title: "Cooking & Convolution",
    shortLabel: "Convolution",
    icon: "🔥",
    concept: "LTI Convolution: x(t) * h(t)",
    description:
      "Convolve input signals with cooking impulse response kernels (Grill, Bake, Boil, Fry).",
  },
  {
    id: "beamforming",
    title: "Beamforming Lab",
    shortLabel: "Beamforming",
    icon: "📡",
    concept: "Phased Array Superposition",
    description:
      "Control the speakers and see how their waves combine to form directional acoustic beams.",
  },
];

function PlaygroundScreen() {
  const [activeStation, setActiveStation] = useState<PlaygroundStation>("overview");
  const [activeSignal, setActiveSignal] = useState<PlaygroundSignal>(INGREDIENT_SIGNALS[0]!); // Default: Tomato
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<SignalAudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      if (audioPlayer) audioPlayer.destroy();
    };
  }, [audioPlayer]);

  const playAudio = (clipId: string, customSamples?: number[], customFreq?: number) => {
    if (audioPlayer) {
      audioPlayer.destroy();
    }
    setPlayingClip(clipId);

    let samples: number[];
    const freq = customFreq ?? activeSignal.freq;

    if (customSamples && customSamples.length > 0) {
      samples = customSamples;
    } else {
      if (activeSignal.category === "ingredient") {
        samples = computeIngredientSamples({
          name: activeSignal.name,
          freq: activeSignal.freq,
          washable: activeSignal.noise > 0.3,
          noise: activeSignal.noise,
        });
      } else {
        samples = generatePlaygroundSamples({
          freq: activeSignal.freq,
          noise: activeSignal.noise,
          waveShape: activeSignal.waveShape ?? "sine",
        });
      }
    }

    const p = new SignalAudioPlayer(
      {
        samples,
        frequency: freq,
        duration: 2.5,
      },
      (state) => {
        if (state.isEnded) {
          setPlayingClip((curr) => (curr === clipId ? null : curr));
        }
      },
    );
    setAudioPlayer(p);
    p.play();
  };

  const getChefMessage = () => {
    switch (activeStation) {
      case "generate":
        return `Synthesizing signals! Tweak parameters and click "Set as Current Signal" to send your custom sound to other labs.`;
      case "filter":
        return `You are filtering the ${activeSignal.name} signal (${activeSignal.instrument}). Listen to the original, then sweep the cutoff lower to hear the difference!`;
      case "mix":
        return `Superposition in action! When signals combine in the bowl, their instantaneous amplitudes add together point-by-point.`;
      case "season":
        return `Amplitude scales the strength of ${activeSignal.name}, while frequency alters its harmonic density. Listen to both original and transformed results!`;
      case "marinate":
        return `Time scaling changes how quickly ${activeSignal.name} unfolds across the horizontal time axis. Notice how stretching spreads out the waveform!`;
      case "convolve":
        return `Convolution blends ${activeSignal.name} with an impulse response kernel. Every tap ripples across the input signal!`;
      case "beamforming":
        return "Control the speakers and see how their waves combine! Adjust phase delays across the array to steer directional acoustic energy.";
      default:
        return `Welcome to the Signal Playground! You are currently working with the ${activeSignal.name} signal (${activeSignal.instrument}, ${activeSignal.freq} Hz). Choose any lab to process it!`;
    }
  };

  return (
    <main className="relative min-h-screen bg-background">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 sm:px-8">
        {/* TOP HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/menu">
                <GameButton variant="secondary" size="sm">
                  ← Main Menu
                </GameButton>
              </Link>
              {activeStation !== "overview" && (
                <GameButton variant="ghost" size="sm" onClick={() => setActiveStation("overview")}>
                  ⌂ Playground Home
                </GameButton>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-2xl shadow-sm">
                ⚡
              </span>
              <div>
                <p className="font-mono text-[10px] tracking-[0.28em] text-primary uppercase">
                  Sandbox Mode · Free Signal Exploration
                </p>
                <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
                  SIGNAL PLAYGROUND
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-signal/40 bg-signal/10 px-4 py-1.5 font-mono text-[11px] font-bold text-signal uppercase">
              Sandbox · No Rules
            </span>
          </div>
        </header>

        {/* PERSISTENT CURRENT ACTIVE SIGNAL BAR */}
        <section className="mt-6 kitchen-card flex flex-wrap items-center justify-between gap-4 border-2 border-primary/30 bg-[linear-gradient(135deg,oklch(0.96_0.03_85),oklch(0.99_0.015_90))] dark:bg-[linear-gradient(135deg,oklch(0.22_0.03_255),oklch(0.17_0.025_255))] p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-border bg-secondary shadow-sm">
              {activeSignal.category === "ingredient" ? (
                <IngredientGlyph kind={activeSignal.kind} className="h-9 w-9" />
              ) : (
                <span className="font-mono text-2xl text-primary font-bold">
                  {activeSignal.icon}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.22em] text-primary font-bold uppercase">
                  Current Active Signal
                </span>
                <span className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[9px] font-bold text-muted-foreground uppercase">
                  {activeSignal.category}
                </span>
              </div>
              <h2 className="font-display text-2xl font-extrabold text-foreground uppercase sm:text-3xl">
                {activeSignal.name}
              </h2>
              <p className="font-mono text-xs text-muted-foreground uppercase">
                {activeSignal.instrument} · Fundamental: {activeSignal.freq} Hz · Noise:{" "}
                {Math.round(activeSignal.noise * 100)}%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <GameButton
              size="sm"
              variant="lab"
              className="uppercase text-xs"
              onClick={() => playAudio(`orig-${activeSignal.id}`)}
            >
              {playingClip === `orig-${activeSignal.id}`
                ? "🔊 Playing Original..."
                : `▶ Play Original (${activeSignal.name})`}
            </GameButton>

            <GameButton
              size="sm"
              variant="secondary"
              className="uppercase text-xs"
              onClick={() => setShowSourceSelector(!showSourceSelector)}
            >
              {showSourceSelector ? "▲ Hide Source Selector" : "▼ Change Source Signal"}
            </GameButton>
          </div>
        </section>

        {/* QUICK SIGNAL SOURCE SELECTOR DRAWER */}
        {showSourceSelector && (
          <section className="mt-3 rounded-2xl border-2 border-border bg-card/90 p-5 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <p className="font-display text-base font-extrabold text-foreground uppercase">
                  Select Active Signal Source
                </p>
                <p className="font-mono text-[10px] text-muted-foreground uppercase">
                  Choose any ingredient or standard oscillator to feed into the playground labs
                </p>
              </div>
              <GameButton size="sm" variant="ghost" onClick={() => setShowSourceSelector(false)}>
                ✕ Close
              </GameButton>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
                  Ingredient Signals ({INGREDIENT_SIGNALS.length})
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 max-h-48 overflow-y-auto pr-1">
                  {INGREDIENT_SIGNALS.map((ing) => {
                    const isSelected = activeSignal.id === ing.id;
                    return (
                      <button
                        key={ing.id}
                        onClick={() => {
                          setActiveSignal(ing);
                          setShowSourceSelector(false);
                        }}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all",
                          isSelected
                            ? "border-primary bg-secondary shadow-sm ring-2 ring-primary/30"
                            : "border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/60",
                        )}
                      >
                        <IngredientGlyph kind={ing.kind} className="h-6 w-6 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="truncate font-display text-xs font-extrabold text-foreground">
                            {ing.name}
                          </p>
                          <p className="truncate font-mono text-[8px] text-muted-foreground uppercase">
                            {ing.instrument}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/60 pt-3">
                <p className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
                  Fundamental Oscillator Waves
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-3 max-w-lg">
                  {OSCILLATOR_SIGNALS.map((osc) => {
                    const isSelected = activeSignal.id === osc.id;
                    return (
                      <button
                        key={osc.id}
                        onClick={() => {
                          setActiveSignal(osc);
                          setShowSourceSelector(false);
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-all",
                          isSelected
                            ? "border-primary bg-secondary shadow-sm ring-2 ring-primary/30"
                            : "border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/60",
                        )}
                      >
                        <span className="font-mono text-xl text-primary font-bold">{osc.icon}</span>
                        <div>
                          <p className="font-display text-xs font-extrabold text-foreground">
                            {osc.name}
                          </p>
                          <p className="font-mono text-[8px] text-muted-foreground uppercase">
                            Oscillator
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* STATION NAVIGATION TABS */}
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Playground Stations">
          <button
            onClick={() => setActiveStation("overview")}
            className={cn(
              "rounded-xl px-4 py-2 font-display text-xs font-extrabold tracking-wider uppercase transition-all select-none",
              activeStation === "overview"
                ? "border-2 border-primary bg-[image:var(--gradient-warm)] text-primary-foreground shadow-sm"
                : "border-2 border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            Playground Home
          </button>
          {STATIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStation(s.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 font-display text-xs font-extrabold tracking-wider uppercase transition-all select-none",
                activeStation === s.id
                  ? "border-2 border-primary bg-[image:var(--gradient-warm)] text-primary-foreground shadow-sm"
                  : "border-2 border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <span>{s.icon}</span>
              <span>{s.shortLabel}</span>
            </button>
          ))}
        </nav>

        {/* DYNAMIC STATION CONTENT */}
        <div className="mt-8">
          {activeStation === "overview" && (
            <OverviewHub
              activeSignal={activeSignal}
              onSelectStation={setActiveStation}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "generate" && (
            <GeneratorSandbox
              activeSignal={activeSignal}
              onSetActiveSignal={setActiveSignal}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "filter" && (
            <FilterSandbox
              activeSignal={activeSignal}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "mix" && (
            <MixerSandbox
              activeSignal={activeSignal}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "season" && (
            <SeasoningSandbox
              activeSignal={activeSignal}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "marinate" && (
            <MarinatingSandbox
              activeSignal={activeSignal}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "convolve" && (
            <ConvolutionSandbox
              activeSignal={activeSignal}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "beamforming" && (
            <BeamformingSandbox
              activeSignal={activeSignal}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
        </div>

        {/* BOTTOM CHEF FOURIER DIALOGUE */}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl border-2 border-border bg-card/60 p-6 backdrop-blur-sm">
          <ChefFourier size="sm" float={false} message={getChefMessage()} />
          <div className="flex items-center gap-3">
            {activeStation !== "overview" ? (
              <GameButton
                variant="secondary"
                size="sm"
                onClick={() => setActiveStation("overview")}
              >
                ← Back to Playground Home
              </GameButton>
            ) : (
              <Link to="/menu">
                <GameButton variant="secondary" size="sm">
                  ← Back to Main Menu
                </GameButton>
              </Link>
            )}
          </div>
        </footer>
      </div>
    </main>
  );
}

// -------------------------------------------------------------
// 1. PLAYGROUND OVERVIEW HUB (LANDING PAGE)
// -------------------------------------------------------------
function OverviewHub({
  activeSignal,
  onSelectStation,
  onPlayAudio,
  playingClip,
}: {
  activeSignal: PlaygroundSignal;
  onSelectStation: (s: PlaygroundStation) => void;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}) {
  return (
    <div className="space-y-8">
      {/* 5-STEP PLAYGROUND CONCEPT FLOW */}
      <section className="kitchen-card p-6 sm:p-8">
        <div>
          <p className="font-mono text-[10px] tracking-[0.28em] text-primary uppercase">
            Signal Playground Concept
          </p>
          <h2 className="font-display text-2xl font-extrabold text-foreground uppercase sm:text-3xl">
            How Free Experimentation Works
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Unlike Recipe Mode, there are no objectives, targets, accuracy scores, or locked stages.
            Pick an active signal, apply any DSP operation, observe the resulting waveform, and
            compare the audio!
          </p>
        </div>

        {/* Visual Workflow Steps */}
        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {[
            {
              step: "01",
              title: "CHOOSE A SIGNAL",
              desc: `Currently ${activeSignal.name}`,
              icon: "🎙️",
            },
            { step: "02", title: "PLAY ORIGINAL", desc: "Listen to unprocessed source", icon: "▶" },
            {
              step: "03",
              title: "APPLY A PROCESS",
              desc: "Filter, Mix, Scale, Convolve",
              icon: "⚙️",
            },
            { step: "04", title: "WATCH WAVEFORM", desc: "Inspect live output shape", icon: "📈" },
            { step: "05", title: "LISTEN TO RESULT", desc: "Hear the processed audio", icon: "🔊" },
          ].map((item, idx) => (
            <div
              key={item.step}
              className="relative rounded-2xl border-2 border-border bg-secondary/50 p-4 transition-all hover:border-primary/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-primary">{item.step}</span>
                <span className="text-base">{item.icon}</span>
              </div>
              <h3 className="mt-2 font-display text-xs font-extrabold text-foreground uppercase">
                {item.title}
              </h3>
              <p className="mt-1 font-mono text-[9px] text-muted-foreground uppercase leading-relaxed">
                {item.desc}
              </p>
              {idx < 4 && (
                <span className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 font-mono text-xs text-primary font-bold">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 6 EXPERIMENTAL STATION CARDS */}
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-xl font-extrabold text-foreground uppercase">
            Choose an Operation Lab
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            Working with: {activeSignal.name}
          </span>
        </div>

        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STATIONS.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelectStation(s.id)}
              className="kitchen-card group flex cursor-pointer flex-col justify-between p-6 transition-all hover:border-primary/60 hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-border bg-secondary text-2xl group-hover:border-primary/40">
                    {s.icon}
                  </span>
                  <span className="rounded-md border border-border bg-card px-2.5 py-0.5 font-mono text-[9px] font-bold text-primary uppercase">
                    {s.concept}
                  </span>
                </div>
                <h4 className="mt-4 font-display text-xl font-extrabold text-foreground group-hover:text-primary uppercase">
                  {s.title}
                </h4>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  Input: {activeSignal.name}
                </span>
                <GameButton size="sm" variant="lab" className="uppercase text-xs">
                  Launch Lab →
                </GameButton>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 2. SIGNAL GENERATOR SANDBOX
// -------------------------------------------------------------
function GeneratorSandbox({
  activeSignal,
  onSetActiveSignal,
  onPlayAudio,
  playingClip,
}: {
  activeSignal: PlaygroundSignal;
  onSetActiveSignal: (s: PlaygroundSignal) => void;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}) {
  const [sourceName, setSourceName] = useState(activeSignal.name);
  const [instrument, setInstrument] = useState(activeSignal.instrument);
  const [freq, setFreq] = useState(activeSignal.freq);
  const [noise, setNoise] = useState(activeSignal.noise);
  const [waveShape, setWaveShape] = useState<"sine" | "triangle" | "square">(
    activeSignal.waveShape ?? "sine",
  );
  const [kind, setKind] = useState<IngredientKind>(activeSignal.kind);

  const currentSamples = useMemo(() => {
    return generatePlaygroundSamples({
      freq,
      noise,
      waveShape,
    });
  }, [freq, noise, waveShape]);

  const applyCustomSignal = () => {
    const customSignal: PlaygroundSignal = {
      id: `custom-${Date.now()}`,
      name: sourceName || "Custom Tone",
      category: "oscillator",
      instrument: instrument || "Synthesizer",
      freq,
      noise,
      kind,
      waveShape,
    };
    onSetActiveSignal(customSignal);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {/* LEFT: SIGNAL SOURCE & SYNTHESIS CONTROLS */}
      <section className="kitchen-card p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              Step 1: Signal Source & Parameters
            </span>
          </div>
          <h3 className="font-display text-xl font-extrabold text-foreground uppercase">
            Oscillator & Instrument Synthesizer
          </h3>
          <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            Adjust fundamental parameters to synthesize a raw input signal
          </p>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            Load Existing Signal Preset
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-40 overflow-y-auto pr-1">
            {ALL_PLAYGROUND_SIGNALS.slice(0, 9).map((sig) => (
              <button
                key={sig.id}
                onClick={() => {
                  setSourceName(sig.name);
                  setInstrument(sig.instrument);
                  setFreq(sig.freq);
                  setNoise(sig.noise);
                  setWaveShape(sig.waveShape ?? "sine");
                  setKind(sig.kind);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 p-2 text-left transition-all",
                  sourceName === sig.name
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                {sig.category === "ingredient" ? (
                  <IngredientGlyph kind={sig.kind} className="h-5 w-5 shrink-0" />
                ) : (
                  <span className="font-mono text-sm font-bold text-primary">{sig.icon}</span>
                )}
                <div className="overflow-hidden">
                  <p className="truncate font-display text-xs font-extrabold">{sig.name}</p>
                  <p className="truncate font-mono text-[8px] text-muted-foreground uppercase">
                    {sig.freq} Hz
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Wave Shape Selection */}
        <div>
          <label className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            Waveform Shape
          </label>
          <div className="mt-2 flex gap-2">
            {(["sine", "triangle", "square"] as const).map((shape) => (
              <button
                key={shape}
                onClick={() => setWaveShape(shape)}
                className={cn(
                  "flex-1 rounded-xl border-2 py-2 font-mono text-xs font-bold uppercase transition-all",
                  waveShape === shape
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>

        {/* Parameter Sliders */}
        <div className="space-y-4 pt-2 border-t border-border/60">
          <div>
            <div className="flex justify-between font-mono text-xs">
              <span className="text-muted-foreground uppercase">Fundamental Frequency:</span>
              <span className="font-bold text-foreground">{freq.toFixed(1)} Hz</span>
            </div>
            <input
              type="range"
              min={1}
              max={16}
              step={0.5}
              value={freq}
              onChange={(e) => setFreq(Number(e.target.value))}
              className="mt-2 w-full cursor-grab accent-primary active:cursor-grabbing"
            />
          </div>

          <div>
            <div className="flex justify-between font-mono text-xs">
              <span className="text-muted-foreground uppercase">
                High-Frequency Noise Injection:
              </span>
              <span className="font-bold text-foreground">{Math.round(noise * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={noise}
              onChange={(e) => setNoise(Number(e.target.value))}
              className="mt-2 w-full cursor-grab accent-primary active:cursor-grabbing"
            />
          </div>
        </div>
      </section>

      {/* RIGHT: GENERATED SIGNAL OUTPUT & AUDIO CONTROLS */}
      <section className="space-y-5">
        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
                Generated Signal Output
              </p>
              <p className="font-display text-lg font-extrabold text-signal uppercase">
                {sourceName} · {waveShape} ({freq.toFixed(1)} Hz)
              </p>
            </div>
            <GameButton
              size="sm"
              variant="lab"
              className="uppercase text-xs"
              onClick={() => onPlayAudio(`gen-${sourceName}`, currentSamples, freq)}
            >
              {playingClip === `gen-${sourceName}`
                ? "🔊 Playing Signal..."
                : "▶ Play Generated Signal"}
            </GameButton>
          </div>

          <MiniWave
            className="mt-4 border-0 p-0"
            frequency={freq}
            noise={noise}
            label={`${sourceName} · ${waveShape} wave`}
          />
        </div>

        {/* Set as Active Signal Action Card */}
        <div className="kitchen-card p-5 space-y-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
            Pipe Signal to Other Playground Labs
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Clicking below sets this synthesized waveform as your{" "}
            <strong>Current Active Signal</strong>, automatically feeding it into Filtering,
            Seasoning, Marinating, Mixing, and Convolution.
          </p>
          <GameButton className="w-full uppercase text-xs" onClick={applyCustomSignal}>
            ✓ Set as Current Active Signal
          </GameButton>
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// 3. FREQUENCY FILTER SANDBOX
// -------------------------------------------------------------
function FilterSandbox({
  activeSignal,
  onPlayAudio,
  playingClip,
}: {
  activeSignal: PlaygroundSignal;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}) {
  const [cutoff, setCutoff] = useState(480);
  const baseFreq = activeSignal.freq;
  const rawNoise = Math.max(0.7, activeSignal.noise);
  const filteredNoise = Math.max(0, Math.min(rawNoise, ((cutoff - 150) / 1050) * rawNoise));

  const rawSamples = useMemo(() => {
    return activeSignal.category === "ingredient"
      ? computeIngredientSamples({
          name: activeSignal.name,
          freq: baseFreq,
          washable: true,
          noise: rawNoise,
        })
      : generatePlaygroundSamples({
          freq: baseFreq,
          noise: rawNoise,
          waveShape: activeSignal.waveShape ?? "sine",
        });
  }, [activeSignal, baseFreq, rawNoise]);

  const filteredSamples = useMemo(() => {
    return activeSignal.category === "ingredient"
      ? computeIngredientSamples({
          name: activeSignal.name,
          freq: baseFreq,
          washable: false,
          noise: filteredNoise,
        })
      : generatePlaygroundSamples({
          freq: baseFreq,
          noise: filteredNoise,
          waveShape: activeSignal.waveShape ?? "sine",
        });
  }, [activeSignal, baseFreq, filteredNoise]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {/* LEFT: PROCESSING CONTROLS */}
      <section className="kitchen-card p-6 space-y-6">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            Step 2: Low-Pass Filter
          </span>
          <h3 className="font-display text-xl font-extrabold text-foreground uppercase">
            Filter Controls & Spectral Cutoff
          </h3>
          <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            Input: {activeSignal.name} ({activeSignal.instrument})
          </p>
        </div>

        {/* Cutoff Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground uppercase">Cutoff Frequency (fc):</span>
            <span className="font-display text-xl font-bold text-foreground">{cutoff} Hz</span>
          </div>
          <input
            type="range"
            min={100}
            max={1200}
            step={20}
            value={cutoff}
            onChange={(e) => setCutoff(Number(e.target.value))}
            className="w-full cursor-grab accent-primary active:cursor-grabbing"
          />
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
            <span>100 Hz (Heavy Filter)</span>
            <span>600 Hz (Mid Band)</span>
            <span>1200 Hz (Wide Open)</span>
          </div>
        </div>

        {/* Spectral Passband Visualizer */}
        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground uppercase">
            <span>Passband: 0 Hz — {cutoff} Hz</span>
            <span className="text-primary font-bold">Stopband: {cutoff} Hz — ∞</span>
          </div>
          <div className="relative mt-2 h-4 w-full overflow-hidden rounded-full border border-border bg-card">
            <div
              className="h-full bg-[image:var(--gradient-warm)] transition-all duration-150"
              style={{ width: `${(cutoff / 1200) * 100}%` }}
            />
          </div>
        </div>

        {/* Audio Comparison Buttons */}
        <div className="border-t border-border/60 pt-4 flex flex-wrap gap-3">
          <GameButton
            size="sm"
            variant="secondary"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`filter-orig-${activeSignal.id}`, rawSamples, baseFreq)}
          >
            {playingClip === `filter-orig-${activeSignal.id}`
              ? "🔊 Playing Original..."
              : `▶ Play Original (${activeSignal.name})`}
          </GameButton>
          <GameButton
            size="sm"
            variant="lab"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`filter-result-${activeSignal.id}`, filteredSamples, baseFreq)}
          >
            {playingClip === `filter-result-${activeSignal.id}`
              ? "🔊 Playing Filtered..."
              : `▶ Play Filtered Output (${cutoff} Hz)`}
          </GameButton>
        </div>
      </section>

      {/* RIGHT: INPUT VS OUTPUT WAVEFORMS */}
      <section className="space-y-5">
        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
              1. Original Input Signal (Unfiltered)
            </p>
            <span className="font-mono text-[9px] text-muted-foreground uppercase">
              {activeSignal.name} · Raw Noise
            </span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0"
            frequency={baseFreq}
            noise={rawNoise}
            color="var(--signal-alt)"
            label={`Raw ${activeSignal.name}`}
          />
        </div>

        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
              2. Filtered Output Signal (After LPF Cutoff)
            </p>
            <span className="font-mono text-[9px] text-signal uppercase">{cutoff} Hz Cutoff</span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0"
            frequency={baseFreq}
            noise={filteredNoise}
            color="var(--signal)"
            label={`Filtered ${activeSignal.name} · ${cutoff} Hz`}
          />
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// 4. MULTI-TRACK MIXER SANDBOX
// -------------------------------------------------------------
function MixerSandbox({
  activeSignal,
  onPlayAudio,
  playingClip,
}: {
  activeSignal: PlaygroundSignal;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}) {
  const [track1, setTrack1] = useState({
    name: activeSignal.name,
    freq: activeSignal.freq,
    gain: 1.0,
    active: true,
  });
  const [track2, setTrack2] = useState({
    name: "Kalimba (Egg/Tomato)",
    freq: 5.0,
    gain: 0.8,
    active: true,
  });
  const [track3, setTrack3] = useState({
    name: "Shaker (Lettuce)",
    freq: 8.0,
    gain: 0.5,
    active: true,
  });
  const [track4, setTrack4] = useState({
    name: "Flute (Cheese)",
    freq: 6.0,
    gain: 0.6,
    active: false,
  });

  const tracks = [track1, track2, track3, track4];
  const setTracks = [setTrack1, setTrack2, setTrack3, setTrack4];

  const mixedSamples = useMemo(() => {
    const W = 400;
    const activeTracks = tracks.filter((t) => t.active);
    const totalGain = Math.max(
      1,
      activeTracks.reduce((sum, t) => sum + t.gain, 0),
    );
    const out: number[] = [];
    for (let i = 0; i <= W; i++) {
      const tNorm = i / W;
      let val = 0;
      activeTracks.forEach((t, idx) => {
        val += Math.sin(2 * Math.PI * t.freq * tNorm + idx * 0.8) * t.gain;
      });
      out.push(val / totalGain);
    }
    return out;
  }, [track1, track2, track3, track4]);

  const getTrackSamples = (t: { name: string; freq: number; gain: number }) => {
    return generatePlaygroundSamples({
      freq: t.freq,
      amplitude: t.gain,
      waveShape: "sine",
    });
  };

  const sumPath = useMemo(() => {
    const W = 600;
    const H = 200;
    const MID = H / 2;
    const pts: string[] = [];
    const activeTracks = tracks.filter((t) => t.active);
    const totalGain = Math.max(
      1,
      activeTracks.reduce((sum, t) => sum + t.gain, 0),
    );

    for (let x = 0; x <= W; x += 2) {
      let val = 0;
      activeTracks.forEach((t, i) => {
        val += Math.sin((x / W) * Math.PI * 2 * t.freq + i * 0.8) * t.gain;
      });
      const y = MID - (val / totalGain) * (H * 0.4);
      pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
    }
    return pts.join(" ");
  }, [track1, track2, track3, track4]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {/* LEFT: MIXER CHANNELS */}
      <section className="kitchen-card p-6 space-y-6">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            Step 2: Linear Superposition
          </span>
          <h3 className="font-display text-xl font-extrabold text-foreground uppercase">
            Multi-Signal Track Mixer
          </h3>
          <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            Adjust individual channel gains and combine multiple signals simultaneously
          </p>
        </div>

        <div className="space-y-3">
          {tracks.map((t, idx) => (
            <div
              key={t.name}
              className={cn(
                "rounded-2xl border-2 p-3 transition-all",
                t.active
                  ? "border-border bg-secondary/60"
                  : "border-border/40 bg-card/40 opacity-50",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTracks[idx]!((prev) => ({ ...prev, active: !prev.active }))}
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-mono text-[9px] font-bold uppercase",
                      t.active
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-muted-foreground",
                    )}
                  >
                    {t.active ? "ON" : "MUTE"}
                  </button>
                  <span className="font-display text-xs font-extrabold text-foreground">
                    {t.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <GameButton
                    size="sm"
                    variant="ghost"
                    className="font-mono text-[9px] uppercase px-2 py-0.5 h-6"
                    onClick={() => onPlayAudio(`track-${idx}-${t.name}`, getTrackSamples(t), t.freq)}
                  >
                    {playingClip === `track-${idx}-${t.name}` ? "🔊 Playing" : "▶ Play Track"}
                  </GameButton>
                  <span className="font-mono text-xs font-bold text-primary">
                    Gain: {(t.gain * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {t.active && (
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={t.gain}
                  onChange={(e) =>
                    setTracks[idx]!((prev) => ({ ...prev, gain: Number(e.target.value) }))
                  }
                  className="mt-2 w-full cursor-grab accent-primary active:cursor-grabbing"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* RIGHT: SUPERPOSITION SUM & PLAY MIX */}
      <section className="space-y-5">
        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
              Superposition Sum: Σ x_i(t)
            </p>
            <GameButton
              size="sm"
              variant="lab"
              className="uppercase text-xs"
              onClick={() => onPlayAudio("mixer-full-mix", mixedSamples, 4.0)}
            >
              {playingClip === "mixer-full-mix" ? "🔊 Playing Mix..." : "▶ Play Combined Mix"}
            </GameButton>
          </div>

          <div className="relative mt-3 h-48 w-full overflow-hidden rounded-xl border border-signal/20 bg-[oklch(0.16_0.03_255)]">
            <div className="lab-grid absolute inset-0 opacity-20" aria-hidden />
            <svg viewBox="0 0 600 200" className="h-full w-full" preserveAspectRatio="none">
              <line
                x1="0"
                y1="100"
                x2="600"
                y2="100"
                stroke="rgba(80,220,240,0.2)"
                strokeDasharray="4 4"
              />
              <path
                d={sumPath}
                fill="none"
                stroke="var(--signal)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground text-center uppercase">
            {tracks.filter((t) => t.active).length} Active Channels Mixed into Sum Wave
          </p>
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// 5. SEASONING / SCALING SANDBOX
// -------------------------------------------------------------
function SeasoningSandbox({
  activeSignal,
  onPlayAudio,
  playingClip,
}: {
  activeSignal: PlaygroundSignal;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}) {
  const [amp, setAmp] = useState(1.5);
  const [freq, setFreq] = useState(1.0);

  const origSamples = useMemo(() => {
    return activeSignal.category === "ingredient"
      ? computeIngredientSamples({ name: activeSignal.name, freq: activeSignal.freq, noise: 0 })
      : generatePlaygroundSamples({ freq: activeSignal.freq, noise: 0, waveShape: activeSignal.waveShape ?? "sine" });
  }, [activeSignal]);

  const scaledSamples = useMemo(() => {
    return activeSignal.category === "ingredient"
      ? computeIngredientSamples({
          name: activeSignal.name,
          freq: activeSignal.freq * freq,
          amplitude: amp,
          noise: 0,
        })
      : generatePlaygroundSamples({
          freq: activeSignal.freq * freq,
          amplitude: amp,
          noise: 0,
          waveShape: activeSignal.waveShape ?? "sine",
        });
  }, [activeSignal, amp, freq]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {/* LEFT: PROCESSING CONTROLS */}
      <section className="kitchen-card p-6 space-y-6">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            Step 2: Amplitude & Frequency Scaling
          </span>
          <h3 className="font-display text-xl font-extrabold text-foreground uppercase">
            Seasoning Transformation Dials
          </h3>
          <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            Transform y(t) = A · x(f · t) on active signal: {activeSignal.name}
          </p>
        </div>

        {/* Amplitude Dial */}
        <div className="rounded-2xl border-2 border-border bg-secondary/50 p-4 space-y-2">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-muted-foreground uppercase">Amplitude Multiplier (A):</span>
            <span className="font-display text-base font-bold text-foreground">
              × {amp.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={3.0}
            step={0.1}
            value={amp}
            onChange={(e) => setAmp(Number(e.target.value))}
            className="w-full cursor-grab accent-primary active:cursor-grabbing"
          />
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
            <span>0.2× (Gentle)</span>
            <span>1.0× (Standard)</span>
            <span>3.0× (Maximum)</span>
          </div>
        </div>

        {/* Frequency Dial */}
        <div className="rounded-2xl border-2 border-border bg-secondary/50 p-4 space-y-2">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-muted-foreground uppercase">Frequency Multiplier (f):</span>
            <span className="font-display text-base font-bold text-foreground">
              × {freq.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={3.0}
            step={0.1}
            value={freq}
            onChange={(e) => setFreq(Number(e.target.value))}
            className="w-full cursor-grab accent-primary active:cursor-grabbing"
          />
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
            <span>0.2× (Sparse / Low Pitch)</span>
            <span>1.0× (Standard)</span>
            <span>3.0× (Dense / High Pitch)</span>
          </div>
        </div>

        {/* Audio Comparison Buttons */}
        <div className="border-t border-border/60 pt-4 flex flex-wrap gap-3">
          <GameButton
            size="sm"
            variant="secondary"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`season-orig-${activeSignal.id}`, origSamples, activeSignal.freq)}
          >
            {playingClip === `season-orig-${activeSignal.id}`
              ? "🔊 Playing Original..."
              : `▶ Play Original (${activeSignal.name})`}
          </GameButton>
          <GameButton
            size="sm"
            variant="lab"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`season-result-${activeSignal.id}`, scaledSamples, activeSignal.freq * freq)}
          >
            {playingClip === `season-result-${activeSignal.id}`
              ? "🔊 Playing Scaled Result..."
              : `▶ Play Scaled Result (A: ×${amp.toFixed(2)}, f: ×${freq.toFixed(2)})`}
          </GameButton>
        </div>
      </section>

      {/* RIGHT: ORIGINAL VS TRANSFORMED WAVEFORM */}
      <section className="space-y-5">
        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
              1. Original Signal (Unscaled Baseline)
            </p>
            <span className="font-mono text-[9px] text-muted-foreground uppercase">
              {activeSignal.name} · 1.0×
            </span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0"
            frequency={activeSignal.freq}
            noise={0.02}
            color="var(--signal-alt)"
            label={`Original ${activeSignal.name}`}
          />
        </div>

        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
              2. Transformed Result: {amp.toFixed(2)} · x({freq.toFixed(2)} · t)
            </p>
            <span className="font-mono text-[9px] text-signal uppercase">
              Amp ×{amp.toFixed(2)} · Freq ×{freq.toFixed(2)}
            </span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0"
            frequency={activeSignal.freq * freq}
            noise={0.02}
            color="var(--signal)"
            label={`Transformed ${activeSignal.name}`}
          />
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// 6. MARINATING / TIME SCALING SANDBOX
// -------------------------------------------------------------
function MarinatingSandbox({
  activeSignal,
  onPlayAudio,
  playingClip,
}: {
  activeSignal: PlaygroundSignal;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}) {
  const [timeScale, setTimeScale] = useState(1.25);

  const origSamples = useMemo(() => {
    return activeSignal.category === "ingredient"
      ? computeIngredientSamples({ name: activeSignal.name, freq: activeSignal.freq, noise: 0 })
      : generatePlaygroundSamples({ freq: activeSignal.freq, noise: 0, waveShape: activeSignal.waveShape ?? "sine" });
  }, [activeSignal]);

  const timeScaledSamples = useMemo(() => {
    return activeSignal.category === "ingredient"
      ? computeIngredientSamples({
          name: activeSignal.name,
          freq: activeSignal.freq / timeScale,
          noise: 0,
        })
      : generatePlaygroundSamples({
          freq: activeSignal.freq / timeScale,
          noise: 0,
          waveShape: activeSignal.waveShape ?? "sine",
        });
  }, [activeSignal, timeScale]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {/* LEFT: PROCESSING CONTROLS */}
      <section className="kitchen-card p-6 space-y-6">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            Step 2: Time Scaling
          </span>
          <h3 className="font-display text-xl font-extrabold text-foreground uppercase">
            Temporal Axis Scaling & Rest Time
          </h3>
          <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            Scale signal duration: y(t) = x(t / s) on active signal: {activeSignal.name}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-border bg-secondary/50 p-4 space-y-2">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-muted-foreground uppercase">Time Scale Factor (s):</span>
            <span className="font-display text-base font-bold text-foreground">
              × {timeScale.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.05}
            value={timeScale}
            onChange={(e) => setTimeScale(Number(e.target.value))}
            className="w-full cursor-grab accent-primary active:cursor-grabbing"
          />
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
            <span>0.30× (Compressed / Fast)</span>
            <span>1.00× (Original Baseline)</span>
            <span>2.50× (Stretched / Prolonged)</span>
          </div>
        </div>

        {/* Audio Comparison Buttons */}
        <div className="border-t border-border/60 pt-4 flex flex-wrap gap-3">
          <GameButton
            size="sm"
            variant="secondary"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`mar-orig-${activeSignal.id}`, origSamples, activeSignal.freq)}
          >
            {playingClip === `mar-orig-${activeSignal.id}`
              ? "🔊 Playing Original..."
              : `▶ Play Original (${activeSignal.name})`}
          </GameButton>
          <GameButton
            size="sm"
            variant="lab"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`mar-result-${activeSignal.id}`, timeScaledSamples, activeSignal.freq / timeScale)}
          >
            {playingClip === `mar-result-${activeSignal.id}`
              ? "🔊 Playing Time-Scaled..."
              : `▶ Play Time-Scaled Result (×${timeScale.toFixed(2)})`}
          </GameButton>
        </div>
      </section>

      {/* RIGHT: ORIGINAL VS TIME-SCALED WAVEFORM */}
      <section className="space-y-5">
        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
              1. Original Signal (1.00× Baseline Duration)
            </p>
            <span className="font-mono text-[9px] text-muted-foreground uppercase">
              {activeSignal.name}
            </span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0"
            frequency={activeSignal.freq}
            noise={0.02}
            color="var(--signal-alt)"
            label={`Original ${activeSignal.name}`}
          />
        </div>

        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
              2. Time-Scaled Result: x(t / {timeScale.toFixed(2)})
            </p>
            <span className="font-mono text-[9px] text-signal uppercase">
              Duration: ×{timeScale.toFixed(2)}
            </span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0"
            frequency={activeSignal.freq / timeScale}
            noise={0.02}
            color="var(--signal)"
            label={`Time-Scaled ${activeSignal.name} (×${timeScale.toFixed(2)})`}
          />
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// 7. COOKING & CONVOLUTION SANDBOX
// -------------------------------------------------------------
function ConvolutionSandbox({
  activeSignal,
  onPlayAudio,
  playingClip,
}: {
  activeSignal: PlaygroundSignal;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}) {
  const [method, setMethod] = useState<"grill" | "bake" | "boil" | "fry">("grill");
  const [pos, setPos] = useState(50);

  const impulseProfiles = {
    grill: {
      label: "GRILL",
      icon: "🔥",
      desc: "Sharp spiky taps (sparse high-transient response)",
      freq: 5,
      noise: 0.2,
    },
    bake: {
      label: "BAKE",
      icon: "🧁",
      desc: "Long smooth reverberant diffusion tail",
      freq: 2.5,
      noise: 0.05,
    },
    boil: {
      label: "BOIL",
      icon: "♨️",
      desc: "Rolling bubbling periodic envelope",
      freq: 4,
      noise: 0.35,
    },
    fry: {
      label: "FRY",
      icon: "🍳",
      desc: "Dense noisy high-frequency sizzle burst",
      freq: 7,
      noise: 0.8,
    },
  };

  const activeProfile = impulseProfiles[method];

  const inputSamples = useMemo(() => {
    return activeSignal.category === "ingredient"
      ? computeIngredientSamples({ name: activeSignal.name, freq: activeSignal.freq, noise: 0.05 })
      : generatePlaygroundSamples({ freq: activeSignal.freq, noise: 0.05, waveShape: activeSignal.waveShape ?? "sine" });
  }, [activeSignal]);

  const kernelSamples = useMemo(() => {
    return getStaticCookingKernel(method);
  }, [method]);

  const convolvedSamples = useMemo(() => {
    return convolve(inputSamples, kernelSamples);
  }, [inputSamples, kernelSamples]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {/* LEFT: IMPULSE RESPONSE SELECTOR */}
      <section className="kitchen-card p-6 space-y-6">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            Step 2: Linear Time-Invariant Convolution
          </span>
          <h3 className="font-display text-xl font-extrabold text-foreground uppercase">
            LTI Impulse Response Kernel
          </h3>
          <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            Convolve: y(t) = ∫ x(τ) h(t - τ) dτ on active signal: {activeSignal.name}
          </p>
        </div>

        {/* Impulse Response Methods */}
        <div className="space-y-2">
          <label className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            Choose Impulse Response h(t)
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["grill", "bake", "boil", "fry"] as const).map((m) => {
              const prof = impulseProfiles[m];
              return (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all",
                    method === m
                      ? "border-primary bg-secondary text-foreground shadow-sm"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <span className="text-2xl">{prof.icon}</span>
                  <div>
                    <p className="font-display text-sm font-extrabold">{prof.label}</p>
                    <p className="font-mono text-[8px] text-muted-foreground uppercase">
                      {prof.desc.slice(0, 24)}...
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Shift Slider */}
        <div className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-2">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-muted-foreground uppercase">Impulse Response Shift (τ):</span>
            <span className="font-bold text-foreground">{pos}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="w-full cursor-grab accent-primary active:cursor-grabbing"
          />
        </div>

        {/* Audio Comparison Buttons */}
        <div className="border-t border-border/60 pt-4 flex flex-wrap gap-3">
          <GameButton
            size="sm"
            variant="secondary"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`conv-orig-${activeSignal.id}`, inputSamples, activeSignal.freq)}
          >
            {playingClip === `conv-orig-${activeSignal.id}`
              ? "🔊 Playing Input..."
              : `▶ Play Input (${activeSignal.name})`}
          </GameButton>
          <GameButton
            size="sm"
            variant="secondary"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`conv-ir-${method}`, kernelSamples, activeProfile.freq)}
          >
            {playingClip === `conv-ir-${method}`
              ? "🔊 Playing Impulse..."
              : `▶ Play Impulse (${activeProfile.label})`}
          </GameButton>
          <GameButton
            size="sm"
            variant="lab"
            className="uppercase text-xs"
            onClick={() => onPlayAudio(`conv-result-${activeSignal.id}-${method}`, convolvedSamples, activeSignal.freq)}
          >
            {playingClip === `conv-result-${activeSignal.id}-${method}`
              ? "🔊 Playing Convolved..."
              : `▶ Play Convolved Result`}
          </GameButton>
        </div>
      </section>

      {/* RIGHT: INPUT + IMPULSE -> CONVOLVED OUTPUT */}
      <section className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="lab-panel p-4">
            <p className="font-mono text-[9px] tracking-[0.2em] text-signal/70 uppercase">
              1. Input Signal x(t)
            </p>
            <MiniWave
              className="mt-2 border-0 p-0"
              frequency={activeSignal.freq}
              noise={0.05}
              color="var(--signal-alt)"
              label={activeSignal.name}
            />
          </div>
          <div className="lab-panel p-4">
            <p className="font-mono text-[9px] tracking-[0.2em] text-primary uppercase">
              2. Impulse Kernel h(t)
            </p>
            <MiniWave
              className="mt-2 border-0 p-0"
              frequency={activeProfile.freq}
              noise={activeProfile.noise}
              color="var(--primary)"
              label={activeProfile.label}
            />
          </div>
        </div>

        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
              3. Convolved Output: (x * h)(t)
            </p>
            <span className="font-mono text-[9px] text-signal uppercase">
              {activeSignal.name} ✱ {activeProfile.label}
            </span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0"
            frequency={activeSignal.freq + activeProfile.freq * 0.2}
            noise={activeProfile.noise * 0.5}
            color="var(--signal)"
            label={`Convolved Output · ${activeSignal.name} ✱ ${activeProfile.label}`}
          />
        </div>
      </section>
    </div>
  );
}

function BeamformingSandbox({
  activeSignal,
  onPlayAudio,
  playingClip,
}: {
  activeSignal: PlaygroundSignal;
  onPlayAudio: (id: string, samples?: number[], freq?: number) => void;
  playingClip: string | null;
}) {
  const [numSpeakers, setNumSpeakers] = useState<number>(8);
  const [speakers, setSpeakers] = useState<SpeakerState[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      phase: 0,
      amplitude: 1,
      isActive: true,
    })),
  );

  const activeSpeakers = speakers.slice(0, numSpeakers);
  const steeredAngle = calculateMockBeamAngle(activeSpeakers);
  const beamPatternData = generateMockBeamPattern(steeredAngle);

  const handleUpdatePhase = (id: number, phase: number) => {
    setSpeakers((prev) => prev.map((s) => (s.id === id ? { ...s, phase } : s)));
  };

  const handleUpdateAllPhases = (phases: number[]) => {
    setSpeakers((prev) => prev.map((s, idx) => ({ ...s, phase: phases[idx] ?? s.phase })));
  };

  const handleResetPhases = () => {
    setSpeakers((prev) => prev.map((s) => ({ ...s, phase: 0 })));
  };

  const handlePlayBeamAudio = () => {
    const eff = calculateTransmissionEfficiency(activeSpeakers, steeredAngle);
    const gainFactor = Math.max(0.2, eff / 100);
    const beamSamples = generatePlaygroundSamples({
      freq: activeSignal.freq,
      amplitude: gainFactor,
      waveShape: activeSignal.waveShape ?? "sine",
    });
    onPlayAudio("beamforming-output", beamSamples, activeSignal.freq);
  };

  return (
    <div className="space-y-6">
      {/* Station Header */}
      <section className="kitchen-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            Station 7: Phased Array Beamforming
          </span>
          <h3 className="font-display text-2xl font-extrabold text-foreground uppercase">
            Beamforming Lab
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Control the speakers and see how their waves combine. Adjust phase delays across the
            array to steer directional acoustic energy.
          </p>
        </div>

        {/* Array Size Selector & Play Audio */}
        <div className="flex flex-wrap items-center gap-3">
          <GameButton
            size="sm"
            variant="lab"
            className="uppercase text-xs"
            onClick={handlePlayBeamAudio}
          >
            {playingClip === "beamforming-output" ? "🔊 Playing Beam..." : "▶ Play Beam Sound"}
          </GameButton>

          <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/50 p-2">
            <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase px-2">
              Array Size:
            </span>
            {[4, 6, 8].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setNumSpeakers(count)}
                className={cn(
                  "rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all cursor-pointer",
                  numSpeakers === count
                    ? "bg-[image:var(--gradient-warm)] text-primary-foreground shadow-xs"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {count} Speakers
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main 2-column Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Wavefield Visualizer & Speaker Array */}
        <div className="space-y-6">
          <div className="kitchen-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Wave Interference Simulation
                </p>
                <h4 className="font-display text-lg font-extrabold text-foreground uppercase">
                  2D Acoustic Radiation Field
                </h4>
              </div>
              <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                Beam: {steeredAngle > 0 ? `+${steeredAngle}°` : `${steeredAngle}°`}
              </span>
            </div>

            <BeamformingVisualizer
              speakers={activeSpeakers}
              steeredAngle={steeredAngle}
              showTarget={false}
            />
          </div>

          <SpeakerArray speakers={activeSpeakers} />
        </div>

        {/* Right: Phase Controls & Directivity Spectrum Graph */}
        <div className="space-y-6">
          <PhaseControls
            speakers={activeSpeakers}
            onUpdatePhase={handleUpdatePhase}
            onUpdateAllPhases={handleUpdateAllPhases}
            onResetPhases={handleResetPhases}
            steeredAngle={steeredAngle}
          />

          <BeamPatternGraph data={beamPatternData} steeredAngle={steeredAngle} />
        </div>
      </div>
    </div>
  );
}
