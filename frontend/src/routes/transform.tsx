import { createFileRoute, Link } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DragTutorialCue } from "@/components/game/DragTutorialCue";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { SignalAudioPlayer, type PlaybackState } from "@/lib/audio";
import {
  computeSeasonedSignal,
  getRecipeRunSession,
  recipes,
  recordStageAccuracy,
  resampleSignal,
  savePipelineStageSignal,
  syncSessionParamsToBackend,
  updateRecipeRunSession,
  useActiveRecipe,
  usePipelineStageSignal,
  useRecipeProgress,
} from "@/lib/recipes";
import { invalidateDownstreamStages, pipelineSignalToPath } from "@/lib/pipeline";

export const Route = createFileRoute("/transform")({
  head: () => ({
    meta: [
      { title: "Seasoning Lab — WaveBakery" },
      {
        name: "description",
        content: "Fine-tune the amplitude and frequency of your WaveBakery ingredient signal.",
      },
      { property: "og:title", content: "Seasoning Lab — WaveBakery" },
      {
        property: "og:description",
        content: "Scale amplitude, shift frequencies and match the recipe target.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SeasoningLab,
});

const TOL = 0.08;

function SeasoningLab() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const [mixedSignal] = usePipelineStageSignal(recipe.id, "mixed");
  const targetAmp = recipe.seasoningTarget.amplitude;
  const targetFreq = recipe.seasoningTarget.frequency;

  const storedSeasoned = useMemo(() => {
    if (typeof window !== "undefined") {
      try {
        const key = `wavebakery_pipeline_${recipe.id}_seasoned`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as {
            metadata?: { amplitude?: number; freqScale?: number };
            samples?: number[];
          };
          if (Array.isArray(parsed?.samples) && parsed.samples.length > 0) {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  }, [recipe.id]);

  const initialAmp = useMemo(() => {
    if (typeof storedSeasoned?.metadata?.amplitude === "number") {
      return storedSeasoned.metadata.amplitude;
    }
    const session = getRecipeRunSession();
    if (typeof session?.seasonGain === "number") return session.seasonGain;
    return 0.4;
  }, [storedSeasoned]);

  const initialFreq = useMemo(() => {
    if (typeof storedSeasoned?.metadata?.freqScale === "number") {
      return storedSeasoned.metadata.freqScale;
    }
    const session = getRecipeRunSession();
    if (typeof session?.seasonFreq === "number") return session.seasonFreq;
    return 0.4;
  }, [storedSeasoned]);

  const [amp, setAmp] = useState(initialAmp);
  const [freq, setFreq] = useState(initialFreq);
  const [showDragCue, setShowDragCue] = useState(() => storedSeasoned == null);
  const userModifiedRef = useRef(false);

  const playerSeasoned = useMemo(() => {
    return computeSeasonedSignal(mixedSignal, amp, freq);
  }, [mixedSignal, amp, freq]);

  const targetSeasoned = useMemo(() => {
    return computeSeasonedSignal(mixedSignal, targetAmp, targetFreq);
  }, [mixedSignal, targetAmp, targetFreq]);

  const accuracy = Math.round(
    Math.max(
      0,
      100 -
        (Math.abs(amp - targetAmp) / targetAmp + Math.abs(freq - targetFreq) / targetFreq) *
          100 *
          0.7,
    ),
  );
  const done = accuracy >= 85;

  const [audioPlayer, setAudioPlayer] = useState<SignalAudioPlayer | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    isEnded: false,
    currentTime: 0,
    duration: 3.0,
    progress: 0,
  });

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayer) {
        audioPlayer.destroy();
      }
    };
  }, [audioPlayer]);

  // When player modifies sliders (amp, freq), keep playback synchronized with latest output signal
  useEffect(() => {
    if (audioPlayer) {
      audioPlayer.destroy();
      setAudioPlayer(null);
      setPlaybackState((prev) => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        isEnded: false,
        currentTime: 0,
        progress: 0,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amp, freq]);

  const handleTogglePlay = () => {
    if (!audioPlayer) {
      const p = new SignalAudioPlayer(
        {
          samples: playerSeasoned.samples,
          frequency: playerSeasoned.frequency,
          duration: 3.0,
        },
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

  const handleReplay = () => {
    if (!audioPlayer) {
      const p = new SignalAudioPlayer(
        {
          samples: playerSeasoned.samples,
          frequency: playerSeasoned.frequency,
          duration: 3.0,
        },
        (state) => setPlaybackState(state),
      );
      setAudioPlayer(p);
      p.play();
    } else {
      audioPlayer.replay();
    }
  };

  const lastSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (done || unlockedStep >= 5) {
      // Saving the signal/session below re-renders this component with fresh
      // object identities, which would re-fire this effect forever. Only sync
      // when the player's actual values change.
      const sig = `${recipe.id}|${done}|${amp}|${freq}|${accuracy}`;
      if (lastSyncRef.current === sig) return;
      lastSyncRef.current = sig;

      if (done) unlock(5);

      if (userModifiedRef.current) {
        invalidateDownstreamStages(recipe.id, "seasoned");
      }

      recordStageAccuracy("seasoning", accuracy);
      updateRecipeRunSession({
        seasonGain: amp,
        seasonFreq: freq,
        seasoningAccuracy: accuracy,
      });

      savePipelineStageSignal(recipe.id, "seasoned", playerSeasoned);

      // Shared sync reads the dials just saved to the session and keeps the
      // other stations' values (a hand-built payload here reset them).
      syncSessionParamsToBackend(recipe.id).catch(() => {});
    }
  }, [done, unlockedStep, playerSeasoned, recipe.id, unlock, accuracy, amp, freq]);

  const chefLine = done
    ? "Perfect! The signal has just the right flavor character."
    : accuracy >= 70
      ? "That's getting closer! Fine-tune the controls to balance the waveform."
      : amp > targetAmp + 0.35
        ? "Careful — that amplitude is too strong! Dial it down a bit."
        : amp < targetAmp - 0.35
          ? "Try a little more seasoning. The amplitude is still too weak."
          : freq > targetFreq + 0.35
            ? "The frequency feels too dense. Dial it back for a smoother taste."
            : freq < targetFreq - 0.35
              ? "Try increasing the frequency to add more harmonic flavor."
              : "Amplitude controls strength, frequency controls tone. Experiment with both controls!";

  const width = 900;
  const height = 300;

  if (unlockedStep < 4) {
    return (
      <main className="relative min-h-screen bg-background">
        <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
        <div className="relative z-10 mx-auto max-w-4xl px-8 py-16 text-center">
          <div className="kitchen-card p-10">
            <span className="text-4xl" aria-hidden>
              🔒
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground uppercase">
              Station Locked: Seasoning Lab
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete the previous steps first before adjusting signal seasoning.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/mixing">
                <GameButton size="lg" className="uppercase">
                  Go to Mixing Lab →
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
                message="Let's finish the earlier steps before we move on!"
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <LabShell
      eyebrow="Station 04 · Amplitude & Frequency"
      title="Seasoning Lab"
      chefLine={chefLine}
      backTo="/kitchen"
      backLabel="← Back to Kitchen"
      nextTo={done ? "/marinate" : undefined}
      nextLabel="Go to Marinating →"
    >
      {/* HUD */}
      <div className="kitchen-card flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <Hud label="recipe" value={recipe.name} />
        <Hud label="signal" value="Mixed Signal" />
        <Hud label="objective" value="Adjust the signal to match the recipe." />
        <Hud label="step" value="4 / 6" />
        <div className="ml-auto flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full border border-border bg-secondary">
            <span
              className="block h-full rounded-full bg-[image:var(--gradient-warm)] transition-all"
              style={{ width: `${(4 / 6) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            progress
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        {/* Oscilloscope */}
        <section className="lab-panel relative overflow-hidden p-6">
          <div className="lab-grid absolute inset-0 opacity-40" aria-hidden />
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-signal/70 uppercase">
                oscilloscope
              </p>
              <h2 className="font-display text-2xl font-extrabold tracking-[0.1em] text-signal uppercase">
                Seasoned Signal
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              <Legend dashed label="target signal (desired waveform)" color="var(--primary)" />
              <Legend label="player modified signal" color="var(--signal)" />
            </div>
          </div>

          <div className="relative z-10 mt-5 rounded-2xl border border-signal/25 bg-[oklch(0.19_0.03_250)]/60 p-4">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-[300px] w-full"
              preserveAspectRatio="none"
            >
              {/* grid */}
              {Array.from({ length: 13 }).map((_, i) => (
                <line
                  key={`v${i}`}
                  x1={(width / 12) * i}
                  x2={(width / 12) * i}
                  y1={0}
                  y2={height}
                  stroke="var(--signal)"
                  strokeWidth={i === 0 ? 1.4 : 0.5}
                  opacity={i === 0 ? 0.4 : 0.14}
                />
              ))}
              {Array.from({ length: 9 }).map((_, i) => (
                <line
                  key={`h${i}`}
                  y1={(height / 8) * i}
                  y2={(height / 8) * i}
                  x1={0}
                  x2={width}
                  stroke="var(--signal)"
                  strokeWidth={i === 4 ? 1.4 : 0.5}
                  opacity={i === 4 ? 0.45 : 0.14}
                />
              ))}
              {/* target reference waveform (hidden numerical target) */}
              <path
                d={pipelineSignalToPath(targetSeasoned, width, height)}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.4"
                strokeDasharray="6 5"
                opacity="0.85"
                style={{ filter: "drop-shadow(0 0 6px var(--primary-glow))" }}
              />
              {/* player seasoned waveform */}
              <path
                d={pipelineSignalToPath(playerSeasoned, width, height)}
                fill="none"
                stroke="var(--signal)"
                strokeWidth="3.4"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 10px var(--signal))" }}
              />
              {/* synchronized playback cursor line */}
              {playbackState.progress > 0 && (
                <line
                  x1={playbackState.progress * width}
                  y1={0}
                  x2={playbackState.progress * width}
                  y2={height}
                  stroke="var(--signal)"
                  strokeWidth="2.5"
                  opacity="0.9"
                  strokeDasharray="4 2"
                  style={{ filter: "drop-shadow(0 0 6px var(--signal))" }}
                />
              )}
            </svg>
            <div className="mt-2 flex justify-between font-mono text-[9px] tracking-[0.2em] text-signal/50 uppercase">
              <span>amplitude ↕</span>
              <span>time → (unchanged · 0.00 s — 1.00 s)</span>
            </div>
          </div>

          {/* Seasoning Output Playback Control Bar */}
          <div className="relative z-10 mt-4 rounded-xl border border-border/80 bg-secondary/50 p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    playbackState.isPlaying ? "bg-signal animate-ping" : "bg-muted-foreground/40"
                  }`}
                />
                <span className="font-mono text-xs font-bold tracking-wider text-foreground uppercase">
                  {playbackState.isPlaying
                    ? "Playing Seasoned Output..."
                    : playbackState.isPaused
                      ? "Seasoned Output Paused"
                      : "Seasoned Output Signal"}
                </span>
                <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold text-signal uppercase">
                  {Math.round(220 * ((playerSeasoned.frequency || 4) / 4))} Hz
                </span>
              </div>
              <div className="font-mono text-xs">
                <span className="font-bold text-signal">
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
              className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-secondary border border-border/80 relative cursor-pointer"
              onClick={handleTogglePlay}
              title="Click to toggle playback"
            >
              <div
                className="h-full bg-gradient-to-r from-signal via-signal/80 to-primary shadow-xs transition-[width] duration-75"
                style={{ width: `${(playbackState.progress * 100).toFixed(1)}%` }}
              />
            </div>

            {/* Play/Pause/Replay Controls */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {playbackState.isPlaying ? (
                  <GameButton
                    size="sm"
                    variant="lab"
                    onClick={handleTogglePlay}
                    className="font-mono uppercase font-bold text-xs"
                  >
                    <Pause className="mr-1.5 h-3.5 w-3.5" />
                    Pause
                  </GameButton>
                ) : (
                  <GameButton
                    size="sm"
                    onClick={handleTogglePlay}
                    className="font-mono uppercase font-extrabold text-xs bg-signal text-black hover:bg-signal/90 shadow-sm"
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                    {playbackState.isEnded
                      ? "Play Again"
                      : playbackState.isPaused
                        ? "Resume Output"
                        : "▶ Play Output"}
                  </GameButton>
                )}

                <GameButton
                  size="sm"
                  variant="secondary"
                  onClick={handleReplay}
                  className="font-mono uppercase font-bold text-xs"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Replay
                </GameButton>
              </div>

              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase">
                <span>Output Samples: {playerSeasoned.samples.length}</span>
                <span>•</span>
                <span>Amp: ×{amp.toFixed(2)}</span>
                <span>•</span>
                <span>Freq: ×{freq.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* meters */}
          <div className="relative z-10 mt-5 grid gap-4 sm:grid-cols-2">
            <Meter label="signal strength" value={amp / 2} readout={`× ${amp.toFixed(2)}`} />
            <Meter label="frequency character" value={freq / 2} readout={`× ${freq.toFixed(2)}`} />
          </div>
        </section>

        {/* Machine controls */}
        <div className="grid gap-6">
          <ControlCard
            title="Amplitude"
            hint="vertical magnitude — taller / shorter"
            icon={<ShakerIcon />}
            readout={`Amplitude × ${amp.toFixed(2)}`}
            min={0.4}
            max={2}
            step={0.05}
            value={amp}
            cue={
              showDragCue ? (
                <div className="mb-2 flex justify-start">
                  <DragTutorialCue
                    message="Drag this to adjust the seasoning."
                    direction="down"
                    onDismiss={() => setShowDragCue(false)}
                  />
                </div>
              ) : null
            }
            onDragStart={() => {
              userModifiedRef.current = true;
              setShowDragCue(false);
            }}
            onChange={(v) => {
              userModifiedRef.current = true;
              setShowDragCue(false);
              setAmp(v);
            }}
            onStep={(d) => {
              userModifiedRef.current = true;
              setShowDragCue(false);
              setAmp((v) => Math.min(2, Math.max(0.4, +(v + d).toFixed(2))));
            }}
          />

          <ControlCard
            title="Frequency"
            hint="oscillation density — denser / sparser"
            icon={<DialIcon value={freq} />}
            readout={`Frequency × ${freq.toFixed(2)}`}
            min={0.4}
            max={2}
            step={0.05}
            value={freq}
            onDragStart={() => {
              userModifiedRef.current = true;
              setShowDragCue(false);
            }}
            onChange={(e) => {
              userModifiedRef.current = true;
              setShowDragCue(false);
              setFreq(e);
            }}
            onStep={(d) => {
              userModifiedRef.current = true;
              setShowDragCue(false);
              setFreq((v) => Math.min(2, Math.max(0.4, +(v + d).toFixed(2))));
            }}
          />

          {/* Flavor Match Readout card */}
          <section className="kitchen-card p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.24em] text-primary uppercase">
                Seasoning Readout
              </p>
              <span className="font-mono text-[9px] text-muted-foreground uppercase">
                Target Matching
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="rounded-xl border-2 border-border bg-secondary/40 px-3 py-2">
                <dt className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Amplitude
                </dt>
                <dd className="mt-1 font-bold text-foreground">Current: × {amp.toFixed(2)}</dd>
              </div>
              <div className="rounded-xl border-2 border-border bg-secondary/40 px-3 py-2">
                <dt className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Frequency
                </dt>
                <dd className="mt-1 font-bold text-foreground">Current: × {freq.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              Visually align the bright cyan <strong>Player Signal</strong> with the dashed{" "}
              <strong>Target Signal</strong> on the oscilloscope.
            </p>
          </section>

          {done ? (
            <section className="lab-panel border-signal/50 p-5 text-center shadow-[var(--shadow-glow)]">
              <p className="font-display text-lg font-extrabold tracking-[0.14em] text-signal uppercase">
                ✓ Waveform Matched
              </p>
              <p className="mt-2 font-mono text-[11px] tracking-[0.16em] text-signal/80 uppercase">
                Target flavor character balanced
              </p>
            </section>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border px-5 py-4 text-center font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              adjust amplitude and frequency controls until the waveforms visually align
            </div>
          )}
        </div>
      </div>
    </LabShell>
  );
}

function Hud({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="font-display text-sm font-bold tracking-[0.08em] text-foreground uppercase">
        {value}
      </p>
    </div>
  );
}

function Legend({ label, color, dashed }: { label: string; color: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[9px] tracking-[0.16em] text-signal/70 uppercase">
      <svg width="30" height="8" aria-hidden>
        <line
          x1="0"
          y1="4"
          x2="30"
          y2="4"
          stroke={color}
          strokeWidth={dashed ? 2 : 3.2}
          strokeDasharray={dashed ? "6 5" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

function Meter({ label, value, readout }: { label: string; value: number; readout: string }) {
  return (
    <div className="rounded-xl border border-signal/25 bg-[oklch(0.19_0.03_250)]/50 px-3 py-2">
      <div className="flex justify-between font-mono text-[9px] tracking-[0.2em] uppercase">
        <span className="text-signal/60">{label}</span>
        <span className="text-foreground/80">{readout}</span>
      </div>
      <div className="mt-2 flex gap-[3px]">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="h-3 flex-1 rounded-[2px]"
            style={{
              background: i / 20 < value ? "var(--signal)" : "oklch(0.35 0.02 250)",
              opacity: i / 20 < value ? 1 : 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ControlCard({
  title,
  hint,
  icon,
  readout,
  min,
  max,
  step,
  value,
  onChange,
  onStep,
  cue,
  onDragStart,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  readout: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  onStep: (delta: number) => void;
  cue?: React.ReactNode;
  onDragStart?: () => void;
}) {
  return (
    <section className="kitchen-card relative p-5">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border-2 border-border bg-secondary/60 p-2">{icon}</div>
        <div className="flex-1">
          <h3 className="font-display text-xl font-extrabold tracking-[0.12em] text-foreground uppercase">
            {title}
          </h3>
          <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            {hint}
          </p>
          <p className="mt-2 font-mono text-sm font-bold text-foreground">{readout}</p>
        </div>
      </div>

      {cue}

      <div className="mt-4 flex items-center gap-3">
        <GameButton
          variant="secondary"
          size="sm"
          onClick={() => onStep(-step)}
          aria-label={`decrease ${title}`}
        >
          −
        </GameButton>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onPointerDown={onDragStart}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-grab accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
          aria-label={title}
        />
        <GameButton
          variant="secondary"
          size="sm"
          onClick={() => onStep(step)}
          aria-label={`increase ${title}`}
        >
          +
        </GameButton>
      </div>
    </section>
  );
}

function ShakerIcon() {
  return (
    <svg width="46" height="58" viewBox="0 0 46 58" aria-hidden>
      <rect
        x="11"
        y="16"
        width="24"
        height="36"
        rx="8"
        fill="oklch(0.78 0.09 60)"
        stroke="oklch(0.32 0.08 40)"
        strokeWidth="2"
      />
      <path
        d="M13 7h20l-2 8H15z"
        fill="oklch(0.62 0.05 250)"
        stroke="oklch(0.32 0.08 40)"
        strokeWidth="2"
      />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={17 + i * 6} cy={11} r="1.4" fill="oklch(0.25 0.03 250)" />
      ))}
      <path d="M15 30h16M15 38h16" stroke="oklch(0.32 0.08 40)" strokeWidth="1.6" opacity="0.5" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={16 + i * 7} cy={2 + i * 2} r="1.6" fill="var(--signal)" opacity="0.8" />
      ))}
    </svg>
  );
}

function DialIcon({ value }: { value: number }) {
  const angle = -120 + ((value - 0.4) / 1.6) * 240;
  return (
    <svg width="46" height="58" viewBox="0 0 46 58" aria-hidden>
      <circle
        cx="23"
        cy="29"
        r="18"
        fill="oklch(0.24 0.03 250)"
        stroke="var(--signal)"
        strokeWidth="2"
        opacity="0.9"
      />
      <circle
        cx="23"
        cy="29"
        r="12"
        fill="oklch(0.3 0.03 250)"
        stroke="oklch(0.32 0.08 40)"
        strokeWidth="1.5"
      />
      {Array.from({ length: 9 }).map((_, i) => {
        const a = ((-120 + i * 30) * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={23 + Math.sin(a) * 15}
            y1={29 - Math.cos(a) * 15}
            x2={23 + Math.sin(a) * 18}
            y2={29 - Math.cos(a) * 18}
            stroke="var(--signal)"
            strokeWidth="1.4"
            opacity="0.6"
          />
        );
      })}
      <line
        x1="23"
        y1="29"
        x2={23 + Math.sin((angle * Math.PI) / 180) * 12}
        y2={29 - Math.cos((angle * Math.PI) / 180) * 12}
        stroke="oklch(0.78 0.16 55)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
