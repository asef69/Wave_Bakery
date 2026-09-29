import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph, type IngredientKind } from "@/components/game/IngredientGlyph";
import { MiniWave } from "@/components/game/MiniWave";
import { DeliveryLab } from "@/components/playground/DeliveryLab";
import { FullChainLab } from "@/components/playground/FullChainLab";
import { OvenLab } from "@/components/playground/OvenLab";
import { TastingLab } from "@/components/playground/TastingLab";
import { SignalAudioPlayer } from "@/lib/audio";
import { getStaticCookingKernel } from "@/lib/cooking-audio";
import {
  cookSource,
  marinateSource,
  mixSources,
  seasonSource,
  sourceAsMix,
  sourceCurvePoints,
  sourceSamples,
  washSource,
  type PlaygroundSource,
} from "@/lib/playground";
import { ALL_AVAILABLE_INGREDIENTS } from "@/lib/recipes";
import { nudgeCookingSfx, startCookingSfx, stopCookingSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

/** The playground signal as the gameplay pipeline sees it. */
function toSource(sig: PlaygroundSignal): PlaygroundSource {
  return {
    category: sig.category,
    name: sig.name,
    freq: sig.freq,
    waveShape: sig.waveShape,
    idealCutoff: sig.idealCutoff,
  };
}

export const Route = createFileRoute("/labs")({
  head: () => ({
    meta: [
      { title: "Signal Playground — WaveBakery" },
      {
        name: "description",
        content:
          "The whole WaveBakery game as a free lab: generate, filter, mix, season, marinate, convolve, sample and equalise in the Precision Oven, filter the delivery cart's road vibration, and see how a dish is scored.",
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
  idealCutoff?: number | undefined;
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
  idealCutoff: ing.idealCutoff,
}));

const ALL_PLAYGROUND_SIGNALS: PlaygroundSignal[] = [...INGREDIENT_SIGNALS, ...OSCILLATOR_SIGNALS];

type PlaygroundStation =
  | "overview"
  | "generate"
  | "filter"
  | "mix"
  | "season"
  | "marinate"
  | "convolve"
  | "oven"
  | "delivery"
  | "tasting"
  | "chain";

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
    title: "Marinating / Time Shift",
    shortLabel: "Marinating",
    icon: "🥩",
    concept: "Time Shift: x(t − t₀)",
    description: "Delay the signal along the time axis: y(t) = x(t − t₀), silence first.",
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
    id: "oven",
    title: "Precision Oven",
    shortLabel: "Oven",
    icon: "♨️",
    concept: "Sampling · FFT · Equaliser · IFFT",
    description:
      "Add a burnt overtone, pick a sampling rate (Nyquist and aliasing), then fix the spectrum with band gains, a cutoff and a notch.",
  },
  {
    id: "delivery",
    title: "System Delivery",
    shortLabel: "Delivery",
    icon: "🚚",
    concept: "Z-Plane · H(z) · Stability",
    description:
      "A road vibration shakes the dish. Place poles and zeros, read |H(e^jω)|, and keep the cart stable while cancelling the road.",
  },
  {
    id: "tasting",
    title: "Tasting & Scoring",
    shortLabel: "Tasting",
    icon: "👅",
    concept: "Correlation · NRMSE · SNR · Spectrum",
    description:
      "Compare a dish with its target the way the game does: the live match and the server's dish score, part by part.",
  },
  {
    id: "chain",
    title: "Full Chain",
    shortLabel: "Full Chain",
    icon: "🍽️",
    concept: "The Whole Recipe, Station by Station",
    description:
      "Run a recipe from mixing to delivery, change any station's dial, and hear what it costs the served dish.",
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
      samples = sourceSamples(toSource(activeSignal), activeSignal.noise);
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
        return `Marinating is a time shift: y(t) = x(t − t₀). ${activeSignal.name} starts later, with silence first, and its shape does not change.`;
      case "convolve":
        return `Convolution blends ${activeSignal.name} with an impulse response kernel. Every tap ripples across the input signal!`;
      case "oven":
        return `A burnt overtone is hiding in ${activeSignal.name}! Keep fs ≥ 2·fmax or it aliases, then find the overtone in the spectrum and notch it out.`;
      case "delivery":
        return "The cart is rattling! Put the notch's zeros on the road's ω, keep every pole inside the unit circle, and check the sensor isn't aliasing.";
      case "tasting":
        return `This is how every dish is judged. Season, delay, add noise or an overtone to ${activeSignal.name} and watch which metric suffers.`;
      case "chain":
        return "The whole kitchen in one lab! With the recipe's own dials the served dish matches the reference; move one dial and hear what that station costs.";
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
          {activeStation === "oven" && (
            <OvenLab
              key={activeSignal.id}
              source={toSource(activeSignal)}
              signalId={activeSignal.id}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "delivery" && (
            <DeliveryLab
              source={toSource(activeSignal)}
              signalId={activeSignal.id}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "tasting" && (
            <TastingLab
              source={toSource(activeSignal)}
              signalId={activeSignal.id}
              onPlayAudio={playAudio}
              playingClip={playingClip}
            />
          )}
          {activeStation === "chain" && (
            <FullChainLab onPlayAudio={playAudio} playingClip={playingClip} />
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
            Every station of the game, with no timer and no locked stages. Pick an active signal,
            run it through any station — from washing and mixing to the Precision Oven and the
            delivery cart — watch the waveform and spectrum, and compare the audio. The Tasting lab
            shows how a dish is scored, and Full Chain runs a whole recipe.
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
              desc: "Filter, Mix, Season, Cook, Bake, Deliver",
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

      {/* STATION CARDS (one per game station, plus Tasting and Full Chain) */}
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
  // An ingredient keeps its own gameplay model (parametric curve, maths
  // signal or recording); only an oscillator takes the wave-shape buttons.
  // (This used to turn every ingredient into a plain sine.)
  const [category, setCategory] = useState<PlaygroundSignal["category"]>(activeSignal.category);
  const [idealCutoff, setIdealCutoff] = useState(activeSignal.idealCutoff);

  const source: PlaygroundSource = { category, name: sourceName, freq, waveShape, idealCutoff };
  const currentSamples = useMemo(
    () => sourceSamples({ category, name: sourceName, freq, waveShape }, noise),
    [category, sourceName, freq, waveShape, noise],
  );
  const currentCurve = useMemo(
    () => sourceCurvePoints({ category, name: sourceName, freq }),
    [category, sourceName, freq],
  );

  const applyCustomSignal = () => {
    const customSignal: PlaygroundSignal = {
      id: `custom-${Date.now()}`,
      name: sourceName || "Custom Tone",
      category: source.category,
      instrument: instrument || "Synthesizer",
      freq,
      noise,
      kind,
      waveShape,
      idealCutoff,
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
                  setCategory(sig.category);
                  setIdealCutoff(sig.idealCutoff);
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

        {/* Wave Shape Selection (oscillators only; an ingredient keeps its model) */}
        {category === "ingredient" ? (
          <p className="rounded-xl border border-border bg-secondary/50 p-3 font-mono text-[10px] text-muted-foreground uppercase">
            Model: {instrument} — the same signal the recipe stations use
          </p>
        ) : (
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
        )}

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
                {sourceName} · {category === "ingredient" ? instrument : waveShape} (
                {freq.toFixed(1)} Hz)
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
            className="mt-4 border-0 p-0 rounded-none"
            samples={currentSamples}
            parametricPoints={currentCurve}
            noise={currentCurve ? noise : 0}
            label={`${sourceName} · ${category === "ingredient" ? instrument : `${waveShape} wave`}`}
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
  const [cutoff, setCutoff] = useState(900);
  const baseFreq = activeSignal.freq;
  const source = toSource(activeSignal);
  const ideal = source.idealCutoff ?? 400;
  // The Filtering lab's own washing model on the dirty ingredient: below the
  // ingredient's band the cutoff starts cutting the ingredient itself.
  // (This used to just regenerate the signal with less noise, so it could
  // never over-filter.)
  const { raw: rawSamples, filtered: filteredSamples } = useMemo(
    () => washSource(source, cutoff),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSignal, cutoff],
  );
  const curveRef = useMemo(
    () => sourceAsMix(source),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSignal],
  );
  const verdict =
    cutoff < ideal - 20
      ? "Over-filtered: the cutoff is cutting the ingredient itself"
      : cutoff > ideal + 150
        ? "Still noisy: lower the cutoff toward the ingredient's band"
        : "Clean: noise removed, ingredient intact";

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
            min={0}
            max={900}
            step={10}
            value={cutoff}
            onChange={(e) => setCutoff(Number(e.target.value))}
            className="w-full cursor-grab accent-primary active:cursor-grabbing"
          />
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
            <span>0 Hz (Heavy Filter)</span>
            <span>Ingredient band ≈ {ideal} Hz</span>
            <span>900 Hz (Wide Open)</span>
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
              style={{ width: `${(cutoff / 900) * 100}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] font-bold text-primary uppercase">{verdict}</p>
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
            onClick={() =>
              onPlayAudio(`filter-result-${activeSignal.id}`, filteredSamples, baseFreq)
            }
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
            className="mt-3 border-0 p-0 rounded-none"
            samples={rawSamples}
            curveRef={curveRef}
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
            className="mt-3 border-0 p-0 rounded-none"
            samples={filteredSamples}
            curveRef={curveRef}
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
  // Each channel carries a real signal: an ingredient's gameplay model or an
  // oscillator (these used to be plain sines named after ingredients).
  const byId = (id: string): PlaygroundSignal =>
    id === activeSignal.id
      ? activeSignal
      : (ALL_PLAYGROUND_SIGNALS.find((sig) => sig.id === id) ?? activeSignal);
  const firstOther = (names: string[]) =>
    ALL_PLAYGROUND_SIGNALS.find((sig) => names.includes(sig.name) && sig.id !== activeSignal.id)
      ?.id ?? "osc-sine";
  const [track1, setTrack1] = useState({ id: activeSignal.id, gain: 1.0, active: true });
  const [track2, setTrack2] = useState({
    id: firstOther(["Tomato", "Cheese"]),
    gain: 1.0,
    active: true,
  });
  const [track3, setTrack3] = useState({
    id: firstOther(["Lettuce", "Bun"]),
    gain: 1.0,
    active: true,
  });
  const [track4, setTrack4] = useState({
    id: firstOther(["Cheese", "Salt"]),
    gain: 1.0,
    active: false,
  });

  const tracks = useMemo(() => [track1, track2, track3, track4], [track1, track2, track3, track4]);
  const setTracks = [setTrack1, setTrack2, setTrack3, setTrack4];

  // The Mixing lab's bowl: Σ g·x / √K on the real signals, and its 2-D curve
  // when a parametric ingredient is in the bowl.
  const mix = useMemo(
    () =>
      mixSources(
        tracks.filter((t) => t.active).map((t) => ({ src: toSource(byId(t.id)), gain: t.gain })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, activeSignal],
  );
  const mixedSamples = mix.samples;

  const getTrackSamples = (t: { id: string; gain: number }) =>
    sourceSamples(toSource(byId(t.id))).map((v) => v * t.gain);

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
              key={idx}
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
                  <select
                    value={t.id}
                    onChange={(e) => setTracks[idx]!((prev) => ({ ...prev, id: e.target.value }))}
                    className="rounded-lg border border-border bg-card px-2 py-1 font-display text-xs font-extrabold text-foreground"
                    aria-label={`Channel ${idx + 1} signal`}
                  >
                    {!ALL_PLAYGROUND_SIGNALS.some((sig) => sig.id === activeSignal.id) && (
                      <option value={activeSignal.id}>{activeSignal.name}</option>
                    )}
                    {ALL_PLAYGROUND_SIGNALS.map((sig) => (
                      <option key={sig.id} value={sig.id}>
                        {sig.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <GameButton
                    size="sm"
                    variant="ghost"
                    className="font-mono text-[9px] uppercase px-2 py-0.5 h-6 min-h-0"
                    onClick={() =>
                      onPlayAudio(`track-${idx}-${t.id}`, getTrackSamples(t), byId(t.id).freq)
                    }
                  >
                    {playingClip === `track-${idx}-${t.id}` ? "🔊 Playing" : "▶ Play Track"}
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

          <MiniWave
            className="mt-3 border-0 p-0 rounded-none"
            height={180}
            samples={mixedSamples}
            parametricPoints={mix.curvePoints}
            color="var(--signal)"
            label="Bowl: Σ x_k / √K"
          />
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

  // The Seasoning lab's y = A · x(αt) on the real signal (and its 2-D curve).
  const original = useMemo(() => sourceAsMix(toSource(activeSignal)), [activeSignal]);
  const origSamples = original.samples;
  const seasoned = useMemo(
    () => seasonSource(toSource(activeSignal), amp, freq),
    [activeSignal, amp, freq],
  );
  const scaledSamples = seasoned.samples;

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
            onClick={() =>
              onPlayAudio(`season-orig-${activeSignal.id}`, origSamples, activeSignal.freq)
            }
          >
            {playingClip === `season-orig-${activeSignal.id}`
              ? "🔊 Playing Original..."
              : `▶ Play Original (${activeSignal.name})`}
          </GameButton>
          <GameButton
            size="sm"
            variant="lab"
            className="uppercase text-xs"
            onClick={() =>
              onPlayAudio(
                `season-result-${activeSignal.id}`,
                scaledSamples,
                activeSignal.freq * freq,
              )
            }
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
            className="mt-3 border-0 p-0 rounded-none"
            samples={origSamples}
            curveRef={original}
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
            className="mt-3 border-0 p-0 rounded-none"
            samples={scaledSamples}
            curveRef={seasoned}
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
  // The Marinating lab's time SHIFT y = x(t − t₀) (this sandbox used to
  // stretch the signal instead, a different operation).
  const [shift, setShift] = useState(1.25);

  const original = useMemo(() => sourceAsMix(toSource(activeSignal)), [activeSignal]);
  const origSamples = original.samples;
  const marinated = useMemo(
    () => marinateSource(toSource(activeSignal), shift),
    [activeSignal, shift],
  );
  const shiftedSamples = marinated.samples;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {/* LEFT: PROCESSING CONTROLS */}
      <section className="kitchen-card p-6 space-y-6">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            Step 2: Time Shift
          </span>
          <h3 className="font-display text-xl font-extrabold text-foreground uppercase">
            Marinating Time (Delay)
          </h3>
          <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            Delay the signal: y(t) = x(t − t₀) on active signal: {activeSignal.name}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-border bg-secondary/50 p-4 space-y-2">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-muted-foreground uppercase">Marinating Time (t₀):</span>
            <span className="font-display text-base font-bold text-foreground">
              {shift.toFixed(2)} s
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.05}
            value={shift}
            onChange={(e) => setShift(Number(e.target.value))}
            className="w-full cursor-grab accent-primary active:cursor-grabbing"
          />
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
            <span>0 s (No Delay)</span>
            <span>1.25 s</span>
            <span>2.50 s (Long Rest)</span>
          </div>
        </div>

        {/* Audio Comparison Buttons */}
        <div className="border-t border-border/60 pt-4 flex flex-wrap gap-3">
          <GameButton
            size="sm"
            variant="secondary"
            className="uppercase text-xs"
            onClick={() =>
              onPlayAudio(`mar-orig-${activeSignal.id}`, origSamples, activeSignal.freq)
            }
          >
            {playingClip === `mar-orig-${activeSignal.id}`
              ? "🔊 Playing Original..."
              : `▶ Play Original (${activeSignal.name})`}
          </GameButton>
          <GameButton
            size="sm"
            variant="lab"
            className="uppercase text-xs"
            onClick={() =>
              onPlayAudio(`mar-result-${activeSignal.id}`, shiftedSamples, activeSignal.freq)
            }
          >
            {playingClip === `mar-result-${activeSignal.id}`
              ? "🔊 Playing Marinated..."
              : `▶ Play Marinated Result (t₀ = ${shift.toFixed(2)} s)`}
          </GameButton>
        </div>
      </section>

      {/* RIGHT: ORIGINAL VS TIME-SCALED WAVEFORM */}
      <section className="space-y-5">
        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal/70 uppercase">
              1. Original Signal (No Delay)
            </p>
            <span className="font-mono text-[9px] text-muted-foreground uppercase">
              {activeSignal.name}
            </span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0 rounded-none"
            samples={origSamples}
            curveRef={original}
            color="var(--signal-alt)"
            label={`Original ${activeSignal.name}`}
          />
        </div>

        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
              2. Marinated Result: x(t − {shift.toFixed(2)})
            </p>
            <span className="font-mono text-[9px] text-signal uppercase">
              Delay: {shift.toFixed(2)} s
            </span>
          </div>
          <MiniWave
            className="mt-3 border-0 p-0 rounded-none"
            samples={shiftedSamples}
            curveRef={marinated}
            color="var(--signal)"
            label={`Marinated ${activeSignal.name} (t₀ = ${shift.toFixed(2)} s)`}
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

  // The cooking sound plays while the depth slider is held (as in the Cooking
  // station) and stops on release anywhere or on leaving the lab.
  const sfxHeldRef = useRef(false);
  useEffect(() => {
    const release = () => {
      if (!sfxHeldRef.current) return;
      sfxHeldRef.current = false;
      stopCookingSfx();
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      stopCookingSfx();
    };
  }, []);

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

  // The Cooking lab's convolution: same kernels, same circular convolution,
  // and the depth slider really sets how far the impulse has slid in.
  const input = useMemo(() => sourceAsMix(toSource(activeSignal)), [activeSignal]);
  const inputSamples = input.samples;
  const kernelSamples = useMemo(() => getStaticCookingKernel(method), [method]);
  const cooked = useMemo(
    () => cookSource(toSource(activeSignal), method, pos),
    [activeSignal, method, pos],
  );
  const convolvedSamples = cooked.samples;
  // h[n] is tiny (Σ|h| = 1): scale it to the plot's height to show its shape.
  const kernelPlot = useMemo(() => {
    const peak = kernelSamples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
    return kernelSamples.map((v) => (v / peak) * 0.9);
  }, [kernelSamples]);

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
            <span className="text-muted-foreground uppercase">Convolution Depth (τ):</span>
            <span className="font-bold text-foreground">{pos}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onPointerDown={() => {
              sfxHeldRef.current = true;
              startCookingSfx(method);
            }}
            onChange={(e) => {
              setPos(Number(e.target.value));
              if (!sfxHeldRef.current) nudgeCookingSfx(method);
            }}
            className="w-full cursor-grab accent-primary active:cursor-grabbing"
          />
        </div>

        {/* Audio Comparison Buttons */}
        <div className="border-t border-border/60 pt-4 flex flex-wrap gap-3">
          <GameButton
            size="sm"
            variant="secondary"
            className="uppercase text-xs"
            onClick={() =>
              onPlayAudio(`conv-orig-${activeSignal.id}`, inputSamples, activeSignal.freq)
            }
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
            onClick={() =>
              onPlayAudio(
                `conv-result-${activeSignal.id}-${method}`,
                convolvedSamples,
                activeSignal.freq,
              )
            }
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
              className="mt-2 border-0 p-0 rounded-none"
              samples={inputSamples}
              curveRef={input}
              color="var(--signal-alt)"
              label={activeSignal.name}
            />
          </div>
          <div className="lab-panel p-4">
            <p className="font-mono text-[9px] tracking-[0.2em] text-primary uppercase">
              2. Impulse Kernel h(t)
            </p>
            <MiniWave
              className="mt-2 border-0 p-0 rounded-none"
              samples={kernelPlot}
              color="var(--primary)"
              label={`${activeProfile.label} · h[n], ${kernelSamples.length} taps`}
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
            className="mt-3 border-0 p-0 rounded-none"
            samples={convolvedSamples}
            curveRef={cooked}
            color="var(--signal)"
            label={`Convolved Output · ${activeSignal.name} ✱ ${activeProfile.label} · depth ${pos}%`}
          />
        </div>
      </section>
    </div>
  );
}
