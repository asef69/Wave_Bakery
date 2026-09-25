import { createFileRoute, Link } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { DragTutorialCue } from "@/components/game/DragTutorialCue";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import { SignalAudioPlayer, type PlaybackState } from "@/lib/audio";
import {
  computeMarinatedSignal,
  getNextStationPath,
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

export const Route = createFileRoute("/marinate")({
  head: () => ({
    meta: [
      { title: "Marinating Lab — WaveBakery" },
      {
        name: "description",
        content:
          "Adjust how long the ingredient signal is stretched or compressed in the WaveBakery Marinating Lab.",
      },
      { property: "og:title", content: "Marinating Lab — WaveBakery" },
      {
        property: "og:description",
        content: "Time scaling — stretch or compress the waveform to hit the recipe target.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarinatingLab,
});

const DEFAULT_TIME = 1.0;
const MIN_TIME = 0.5;
const MAX_TIME = 2.0;
const STEP_TIME = 0.05;
const TOL = 0.08;

function MarinatingLab() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep, unlock] = useRecipeProgress();
  const [seasonedSignal] = usePipelineStageSignal(recipe.id, "seasoned");
  const targetTime = recipe.marinateTarget.timeScale;

  const storedMarinated = useMemo(() => {
    if (typeof window !== "undefined") {
      try {
        const key = `wavebakery_pipeline_${recipe.id}_marinated`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as {
            metadata?: { timeScale?: number };
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

  const initialTimeScale = useMemo(() => {
    if (typeof storedMarinated?.metadata?.timeScale === "number") {
      return storedMarinated.metadata.timeScale;
    }
    const session = getRecipeRunSession();
    if (typeof session?.marinateTime === "number") return session.marinateTime;
    return MIN_TIME;
  }, [storedMarinated]);

  const [timeScale, setTimeScale] = useState(initialTimeScale);
  const [showDragCue, setShowDragCue] = useState(() => storedMarinated == null);
  const userModifiedRef = useRef(false);

  const playerMarinated = useMemo(() => {
    return computeMarinatedSignal(seasonedSignal, timeScale);
  }, [seasonedSignal, timeScale]);

  const targetMarinated = useMemo(() => {
    return computeMarinatedSignal(seasonedSignal, targetTime);
  }, [seasonedSignal, targetTime]);

  const accuracy = Math.round(
    Math.max(0, 100 - (Math.abs(timeScale - targetTime) / targetTime) * 100 * 1.5),
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

  // When player modifies timeScale slider, keep playback synchronized with latest output signal
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
  }, [timeScale]);

  const handleTogglePlay = () => {
    if (!audioPlayer) {
      const p = new SignalAudioPlayer(
        {
          samples: playerMarinated.samples,
          frequency: playerMarinated.frequency,
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
          samples: playerMarinated.samples,
          frequency: playerMarinated.frequency,
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

  useEffect(() => {
    if (done || unlockedStep >= 6) {
      if (done) unlock(6);

      if (userModifiedRef.current) {
        invalidateDownstreamStages(recipe.id, "marinated");
      }

      recordStageAccuracy("marinating", accuracy);
      updateRecipeRunSession({
        marinateTime: timeScale,
        marinatingAccuracy: accuracy,
      });

      savePipelineStageSignal(recipe.id, "marinated", playerMarinated);

      // Shared sync reads the dials just saved to the session and keeps the
      // other stations' values (a hand-built payload here reset them).
      syncSessionParamsToBackend(recipe.id).catch(() => {});
    }
  }, [done, unlockedStep, playerMarinated, recipe.id, unlock, accuracy, timeScale]);

  const chefLine = done
    ? "That feels properly marinated! The waveform aligns with the target timing."
    : timeScale > targetTime + 0.35
      ? "Too much time — the waveform is stretching too far past the target!"
      : timeScale < targetTime - 0.35
        ? "Try giving it a little more time to let the waveform stretch."
        : accuracy >= 70
          ? "That's looking closer! Watch how the waves align on the oscilloscope."
          : "Marinating is all about time! Experiment with the slider to match the target curve.";

  const width = 900;
  const height = 300;

  if (unlockedStep < 5) {
    return (
      <main className="relative min-h-screen bg-background">
        <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden />
        <div className="relative z-10 mx-auto max-w-4xl px-8 py-16 text-center">
          <div className="kitchen-card p-10">
            <span className="text-4xl" aria-hidden>
              🔒
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-foreground uppercase">
              Station Locked: Marinating Lab
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete the previous steps first before adjusting signal marination time.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/transform">
                <GameButton size="lg" className="uppercase">
                  Go to Seasoning Lab →
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
      eyebrow="Station 05 · Time Scaling"
      title="Marinating Lab"
      chefLine={chefLine}
      backTo="/kitchen"
      backLabel="← Back to Kitchen"
      nextTo={done ? getNextStationPath("/marinate", recipe) : undefined}
      nextLabel="Next Station →"
    >
      {/* HUD */}
      <div className="kitchen-card flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <Hud label="recipe" value={recipe.name} />
        <Hud label="signal" value="Seasoned Signal" />
        <Hud label="objective" value="Adjust how long the signal is stretched or compressed." />
        <Hud label="step" value="5 / 6" />
        <div className="ml-auto flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full border border-border bg-secondary">
            <span
              className="block h-full rounded-full bg-[image:var(--gradient-warm)] transition-all"
              style={{ width: `${(5 / 6) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            progress
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        {/* Oscilloscope Area */}
        <section className="lab-panel relative overflow-hidden p-6">
          <div className="lab-grid absolute inset-0 opacity-40" aria-hidden />
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-signal/70 uppercase">
                oscilloscope
              </p>
              <h2 className="font-display text-2xl font-extrabold tracking-[0.1em] text-signal uppercase">
                Marinated Signal
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              <Legend dashed label="target signal (desired duration)" color="var(--primary)" />
              <Legend label={`marinated signal (${timeScale.toFixed(2)}×)`} color="var(--signal)" />
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="relative z-10 mt-5 rounded-2xl border border-signal/25 bg-[oklch(0.19_0.03_250)]/60 p-4">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-[300px] w-full"
              preserveAspectRatio="none"
            >
              {/* grid lines */}
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
                d={pipelineSignalToPath(targetMarinated, width, height, 0.35)}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.4"
                strokeDasharray="6 5"
                opacity="0.85"
                style={{ filter: "drop-shadow(0 0 6px var(--primary-glow))" }}
              />
              {/* player marinated waveform */}
              <path
                d={pipelineSignalToPath(playerMarinated, width, height, 0.35)}
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
              <span>
                time axis → (
                {timeScale < 0.95 ? "compressed" : timeScale > 1.05 ? "stretched" : "original"}
                {" · "}
                0.00 s — {(1.0 * timeScale).toFixed(2)} s)
              </span>
            </div>
          </div>

          {/* Marinating Output Playback Control Bar */}
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
                    ? "Playing Marinated Output..."
                    : playbackState.isPaused
                      ? "Marinated Output Paused"
                      : "Marinated Output Signal"}
                </span>
                <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold text-signal uppercase">
                  {Math.round(220 * ((playerMarinated.frequency || 4) / 4))} Hz
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
                <span>Output Samples: {playerMarinated.samples.length}</span>
                <span>•</span>
                <span>Scale: {timeScale.toFixed(2)}×</span>
                <span>•</span>
                <span>Duration: {(1.0 * timeScale).toFixed(2)}s</span>
              </div>
            </div>
          </div>

          {/* meters */}
          <div className="relative z-10 mt-5 grid gap-4 sm:grid-cols-2">
            <Meter
              label="time factor"
              value={timeScale / 2}
              readout={`× ${timeScale.toFixed(2)}`}
            />
            <Meter
              label="temporal stretch"
              value={Math.min(1, Math.max(0, (timeScale - 0.5) / 1.5))}
              readout={
                timeScale > 1.05 ? "stretched" : timeScale < 0.95 ? "compressed" : "standard"
              }
            />
          </div>
        </section>

        {/* Controls Area */}
        <div className="grid gap-6">
          {/* Time scaling control card */}
          <section className="kitchen-card p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border-2 border-border bg-secondary/60 p-2">
                <TimerDialIcon value={timeScale} />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-xl font-extrabold tracking-[0.12em] text-foreground uppercase">
                  Marination Time
                </h3>
                <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                  time scaling — shorter compresses, longer stretches
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs">
                  <div className="rounded-xl border-2 border-border bg-secondary/40 px-3 py-1.5">
                    <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      Current:{" "}
                    </span>
                    <span className="font-display font-extrabold text-foreground">
                      × {timeScale.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/40 px-3 py-1.5">
                    <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      Target Matching
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {showDragCue && !done && (
              <div className="mt-3 flex justify-start">
                <DragTutorialCue
                  message="Drag this to adjust the marination time."
                  direction="down"
                  onDismiss={() => setShowDragCue(false)}
                />
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <GameButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  userModifiedRef.current = true;
                  setShowDragCue(false);
                  setTimeScale((v) => Math.max(MIN_TIME, +(v - STEP_TIME).toFixed(2)));
                }}
                aria-label="decrease marination time"
              >
                −
              </GameButton>
              <input
                type="range"
                min={MIN_TIME}
                max={MAX_TIME}
                step={STEP_TIME}
                value={timeScale}
                onPointerDown={() => {
                  userModifiedRef.current = true;
                  setShowDragCue(false);
                }}
                onChange={(e) => {
                  userModifiedRef.current = true;
                  setShowDragCue(false);
                  setTimeScale(Number(e.target.value));
                }}
                className="w-full cursor-grab accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
                aria-label="Marination Time scale"
              />
              <GameButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  userModifiedRef.current = true;
                  setShowDragCue(false);
                  setTimeScale((v) => Math.min(MAX_TIME, +(v + STEP_TIME).toFixed(2)));
                }}
                aria-label="increase marination time"
              >
                +
              </GameButton>
            </div>

            <div className="mt-2 flex justify-between font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
              <span>0.50× (compressed)</span>
              <span>1.00× (original)</span>
              <span>2.00× (stretched)</span>
            </div>

            <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
              Visually align the bright cyan <strong>Marinated Signal</strong> with the dashed{" "}
              <strong>Target Signal</strong> on the oscilloscope.
            </p>
          </section>

          {/* Completion / Instruction state */}
          {done ? (
            <section className="lab-panel border-signal/50 p-5 text-center shadow-[var(--shadow-glow)]">
              <p className="font-display text-lg font-extrabold tracking-[0.14em] text-signal uppercase">
                ✓ Waveform Matched
              </p>
              <p className="mt-2 font-mono text-[11px] tracking-[0.16em] text-signal/80 uppercase">
                Time duration properly aligned with recipe target
              </p>
            </section>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border px-5 py-4 text-center font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              adjust the time slider until the waveforms visually align
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
    <span className="flex items-center gap-2 rounded-full border border-signal/25 bg-[oklch(0.19_0.03_250)]/70 px-3 py-1 font-mono text-[9px] tracking-[0.16em] text-lab-foreground uppercase">
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

function TimerDialIcon({ value }: { value: number }) {
  // angle maps value [0.5, 2.0] across 240 degrees (-120 to +120)
  const angle = -120 + ((value - 0.5) / 1.5) * 240;
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
      {/* Dial needle */}
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
