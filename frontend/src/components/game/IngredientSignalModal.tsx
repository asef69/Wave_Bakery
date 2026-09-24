import { useEffect, useMemo, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, X, Square, RectangleHorizontal } from "lucide-react";

import { GameButton } from "@/components/game/GameButton";
import { IngredientGlyph } from "@/components/game/IngredientGlyph";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";
import { SignalAudioPlayer, type PlaybackState } from "@/lib/audio";
import {
  computeIngredientSamples,
  getMathematicalSignal,
  type IngredientDetail,
} from "@/lib/recipes";
import {
  loadChickenAudio,
  getCachedChickenAudio,
  getChickenStaticSamples,
  type DecodedChickenAudio,
} from "@/lib/chicken-audio";
import { cn } from "@/lib/utils";

interface IngredientSignalModalProps {
  ingredient: IngredientDetail | null;
  onClose: () => void;
}

export function IngredientSignalModal({ ingredient, onClose }: IngredientSignalModalProps) {
  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    isEnded: false,
    currentTime: 0,
    duration: 3.0,
    progress: 0,
  });

  const isChicken = ingredient?.name === "Chicken" || ingredient?.kind === "chicken";
  const [chickenAudio, setChickenAudio] = useState<DecodedChickenAudio | null>(() =>
    getCachedChickenAudio(),
  );

  useEffect(() => {
    if (!isChicken) return;
    let isCancelled = false;

    loadChickenAudio("/sounds/chicken.wav")
      .then((data) => {
        if (!isCancelled) {
          setChickenAudio(data);
        }
      })
      .catch((err) => {
        console.error("Failed to decode chicken.wav:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [isChicken]);

  // Plot aspect ratio mode: Tomato, Onion, Sauce, and Egg start in Square mode, all other ingredients in Rectangle mode
  const [plotMode, setPlotMode] = useState<"square" | "rectangle">(() =>
    ingredient?.name === "Tomato" ||
    ingredient?.name === "Onion" ||
    ingredient?.name === "Sauce" ||
    ingredient?.name === "Egg"
      ? "square"
      : "rectangle",
  );

  // Synchronize plot mode default when a new ingredient is opened
  useEffect(() => {
    if (ingredient) {
      setPlotMode(
        ingredient.name === "Tomato" ||
          ingredient.name === "Onion" ||
          ingredient.name === "Sauce" ||
          ingredient.name === "Egg"
          ? "square"
          : "rectangle",
      );
    }
  }, [ingredient?.name, ingredient]);

  const mathSignal = useMemo(() => {
    return ingredient ? getMathematicalSignal(ingredient.name) : null;
  }, [ingredient]);

  const parametricPoints = useMemo(() => {
    if (!mathSignal?.parametricCurve) return null;
    return mathSignal.parametricCurve.generatePoints();
  }, [mathSignal]);

  const samples = useMemo(() => {
    if (!ingredient) return [];
    if (isChicken) {
      return chickenAudio ? chickenAudio.samples : getChickenStaticSamples();
    }
    return computeIngredientSamples({
      freq: ingredient.freq,
      washable: mathSignal ? false : ingredient.washable,
      name: ingredient.name,
      seed: 0,
    });
  }, [ingredient, mathSignal, isChicken, chickenAudio]);

  useEffect(() => {
    if (!ingredient) return;

    if (isChicken) {
      const chickenSamples = chickenAudio ? chickenAudio.samples : getChickenStaticSamples();
      const dur = chickenAudio ? chickenAudio.duration : 2.158;

      setPlaybackState({
        isPlaying: false,
        isPaused: false,
        isEnded: false,
        currentTime: 0,
        duration: dur,
        progress: 0,
      });

      const p = new SignalAudioPlayer(
        {
          samples: chickenSamples,
          frequency: 4,
          duration: dur,
          audioBuffer: chickenAudio?.buffer ?? null,
        },
        (state) => {
          setPlaybackState(state);
        },
      );
      setPlayer(p);

      return () => {
        p.destroy();
      };
    }

    if (samples.length === 0) return;

    setPlaybackState({
      isPlaying: false,
      isPaused: false,
      isEnded: false,
      currentTime: 0,
      duration: 3.0,
      progress: 0,
    });

    const p = new SignalAudioPlayer(
      { samples, frequency: ingredient.freq, duration: 3.0 },
      (state) => {
        setPlaybackState(state);
      },
    );
    setPlayer(p);

    return () => {
      p.destroy();
    };
  }, [ingredient, samples, isChicken, chickenAudio]);

  // Handle escape key
  useEffect(() => {
    if (!ingredient) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [ingredient, onClose]);

  if (!ingredient) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingredient-signal-title"
    >
      <div className="kitchen-card relative w-full max-w-4xl max-h-[92vh] overflow-y-auto border-2 border-primary/40 bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close X Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
          aria-label="Close signal inspector"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4 pr-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/30 bg-secondary/80 p-2 shadow-inner">
            <IngredientGlyph kind={ingredient.kind ?? "generic"} className="h-10 w-10" />
          </div>
          <div>
            <h2
              id="ingredient-signal-title"
              className="font-display text-2xl font-extrabold tracking-tight text-foreground uppercase sm:text-3xl"
            >
              {ingredient.name} SIGNAL
            </h2>
            <p className="font-mono text-[11px] font-extrabold tracking-[0.24em] text-primary uppercase">
              {isChicken
                ? "RECORDED ACOUSTIC SIGNAL"
                : mathSignal?.parametricCurve
                  ? "PARAMETRIC SIGNAL"
                  : mathSignal
                    ? "MATHEMATICAL SIGNAL"
                    : "INGREDIENT SIGNAL"}
            </p>
          </div>
        </div>

        {/* Technical Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
          <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider text-primary uppercase">
            {isChicken
              ? "RECORDED PCM AUDIO"
              : mathSignal?.parametricCurve
                ? "PARAMETRIC 2D"
                : "TIME DOMAIN"}
          </span>
          <span className="rounded-md border border-border bg-secondary px-2.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase">
            {isChicken
              ? "WAV RECORDING"
              : mathSignal?.parametricCurve
                ? "PARAMETRIC CURVE"
                : mathSignal
                  ? `${mathSignal.waveformType.toUpperCase()} WAVE`
                  : "RAW INGREDIENT"}
          </span>
          <span className="rounded-md border border-signal/40 bg-signal/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider text-signal uppercase">
            {isChicken
              ? `${(chickenAudio?.sampleRate ?? 44100).toLocaleString()} Hz · ${(chickenAudio?.duration ?? 2.16).toFixed(2)}s`
              : mathSignal?.parametricCurve
                ? (mathSignal.parametricCurve.domainDisplay ?? "Parametric")
                : mathSignal?.domainDisplay
                  ? mathSignal.domainDisplay
                  : mathSignal
                    ? `f = ${ingredient.freq} Hz`
                    : `${ingredient.instrument} · ${ingredient.freq} Hz`}
          </span>
          {ingredient.washable ? (
            <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider text-amber-500 uppercase">
              Noisy (Needs Washing)
            </span>
          ) : (
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider text-emerald-500 uppercase">
              Clean Tone
            </span>
          )}
        </div>

        {/* Side-by-Side: Plot on Left, SOUND Controls on Right */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Left: Plot with Aspect Ratio Toggle */}
          <div className="flex flex-col">
            {/* Plot View Header & Aspect Ratio Toggle */}
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-mono text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                PLOT VIEW
              </span>

              {/* Mode Toggle: Square vs Rectangle */}
              <div
                role="group"
                aria-label="Plot aspect ratio"
                className="inline-flex items-center rounded-lg border border-border/80 bg-secondary/80 p-0.5 text-xs font-mono shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setPlotMode("square")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer",
                    plotMode === "square"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Square plot (1:1 equal visual scaling)"
                >
                  <Square className="h-3 w-3" />
                  Square
                </button>
                <button
                  type="button"
                  onClick={() => setPlotMode("rectangle")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer",
                    plotMode === "rectangle"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Rectangle plot (original proportions)"
                >
                  <RectangleHorizontal className="h-3 w-3" />
                  Rectangle
                </button>
              </div>
            </div>

            <WaveformDisplay
              square={plotMode === "square"}
              height={180}
              label={
                isChicken
                  ? `Chicken · Recorded Acoustic Signal (/sounds/chicken.wav · 44.1 kHz)`
                  : mathSignal?.parametricCurve
                    ? `${ingredient.name} · Parametric Curve (${mathSignal.parametricCurve.xDisplay}, ${mathSignal.parametricCurve.yDisplay})`
                    : mathSignal
                      ? `${ingredient.name} · Mathematical Signal (${mathSignal.equationDisplay})`
                      : `${ingredient.name} · Raw Input Signal (${ingredient.instrument})`
              }
              cursorProgress={playbackState.progress}
              samples={samples}
              parametricPoints={parametricPoints ?? undefined}
              color={ingredient.washable ? "var(--signal-alt)" : "var(--signal)"}
            />
          </div>

          {/* Right: SOUND Controls Card */}
          <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-secondary/50 p-5 shadow-sm">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-primary" />
                  <span className="font-mono text-xs font-extrabold tracking-widest text-foreground uppercase">
                    SOUND
                  </span>
                </div>
                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary uppercase">
                  {isChicken ? "44.1 kHz WAV" : `${ingredient.freq} Hz OSC`}
                </span>
              </div>

              {/* Status & Timer */}
              <div className="mt-4 flex items-center justify-between font-mono text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      playbackState.isPlaying ? "bg-primary animate-ping" : "bg-muted-foreground/40"
                    }`}
                  />
                  <span className="text-foreground uppercase tracking-wider font-bold">
                    {playbackState.isPlaying
                      ? "Playing Audio..."
                      : playbackState.isPaused
                        ? "Playback Paused"
                        : "Signal Ready"}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-primary font-mono">
                    {playbackState.currentTime.toFixed(1)}s
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {playbackState.duration.toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Scrub Track */}
              <div
                className="mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary border border-border cursor-pointer relative"
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
                  className="h-full bg-gradient-to-r from-primary via-primary-glow to-signal transition-[width] duration-75"
                  style={{ width: `${(playbackState.progress * 100).toFixed(1)}%` }}
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {playbackState.isPlaying ? (
                  <GameButton
                    size="md"
                    variant="lab"
                    onClick={() => player?.pause()}
                    className="flex-1 uppercase font-extrabold tracking-wider"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </GameButton>
                ) : (
                  <GameButton
                    size="md"
                    onClick={() => player?.play()}
                    className="flex-1 uppercase font-extrabold tracking-wider bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  >
                    <Play className="mr-2 h-4 w-4 fill-current" />
                    {playbackState.isEnded
                      ? "Replay Signal"
                      : playbackState.isPaused
                        ? "Resume Signal"
                        : "▶ Play Signal"}
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
            </div>

            {/* Pitch & Metadata */}
            <div className="mt-6 pt-3 border-t border-border/50 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground font-medium">
                    {isChicken ? "Source:" : "Base Pitch:"}
                  </span>
                  <span className="text-primary font-bold">
                    {isChicken ? "Recorded WAV" : `${Math.round(220 * (ingredient.freq / 4))} Hz`}
                  </span>
                </div>
                {ingredient.washable && ingredient.idealCutoff && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground font-medium text-[10px] uppercase tracking-wider">
                      Ideal Cutoff:
                    </span>
                    <span className="text-destructive font-bold text-[10px]">
                      {ingredient.idealCutoff} Hz
                    </span>
                  </div>
                )}
              </div>
              <div className="text-[11px]">Duration: {playbackState.duration.toFixed(2)}s</div>
            </div>
          </div>
        </div>

        {/* Recorded Chicken Signal Metadata Card */}
        {isChicken && (
          <div className="mt-5 rounded-xl border-2 border-primary/40 bg-primary/10 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-extrabold tracking-widest text-primary uppercase">
                RECORDED AUDIO SIGNAL METADATA
              </span>
              <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[9px] font-bold text-primary uppercase">
                PCM WAV • 16-BIT STEREO
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="rounded-lg bg-background/60 p-2.5 border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase">Duration</div>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {(chickenAudio?.duration ?? 2.158).toFixed(3)}s
                </div>
              </div>
              <div className="rounded-lg bg-background/60 p-2.5 border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase">Sample Rate</div>
                <div className="mt-0.5 text-sm font-bold text-primary">
                  {(chickenAudio?.sampleRate ?? 44100).toLocaleString()} Hz
                </div>
              </div>
              <div className="rounded-lg bg-background/60 p-2.5 border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase">Sample Count</div>
                <div className="mt-0.5 text-sm font-bold text-foreground">
                  {(chickenAudio?.totalSamples ?? 95154).toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-background/60 p-2.5 border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase">Source Asset</div>
                <div
                  className="mt-0.5 text-sm font-bold text-signal truncate"
                  title="public/sounds/chicken.wav"
                >
                  chicken.wav
                </div>
              </div>
            </div>
            <p className="mt-2.5 font-mono text-[10px] text-muted-foreground">
              Real acoustic recording decoded via Web Audio API AudioBuffer
              (public/sounds/chicken.wav). Waveform display and audio playback stream from the exact
              same decoded PCM samples.
            </p>
          </div>
        )}

        {/* Mathematical Signal Function Card */}
        {!isChicken && mathSignal && (
          <div className="mt-5 rounded-xl border-2 border-primary/40 bg-primary/10 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-extrabold tracking-widest text-primary uppercase">
                {mathSignal.parametricCurve
                  ? "PARAMETRIC SIGNAL DEFINITION"
                  : "MATHEMATICAL SIGNAL"}
              </span>
              <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[9px] font-bold text-primary uppercase">
                {mathSignal.waveformType}
              </span>
            </div>
            <div className="mt-2 font-mono text-sm font-bold text-foreground sm:text-base tracking-wide select-all">
              {mathSignal.parametricCurve ? (
                <div className="space-y-0.5">
                  <div>{mathSignal.parametricCurve.xDisplay}</div>
                  <div>{mathSignal.parametricCurve.yDisplay}</div>
                  <div className="text-xs text-signal font-normal font-mono">
                    {mathSignal.parametricCurve.rangeDisplay}
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div>{mathSignal.equationDisplay}</div>
                  {mathSignal.domainDisplay && (
                    <div className="text-xs text-signal font-normal font-mono">
                      Domain: {mathSignal.domainDisplay}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              {mathSignal.description}
              {mathSignal.ingredientName === "Salt"
                ? ` (f = ${ingredient.freq} Hz, As = ${mathSignal.defaultAmplitude}, φ = 0)`
                : mathSignal.ingredientName === "Bread"
                  ? ` (f₁ = 3 Hz, f₂ = 9 Hz, A₁ = 0.8, A₂ = 0.6, ratio = 3:1)`
                  : mathSignal.ingredientName === "Lettuce"
                    ? ` (parametric leaf curve, A₁ = 2.2, A₂ = 0.45, -8π ≤ t ≤ 8π)`
                    : mathSignal.ingredientName === "Milk"
                      ? ` (scattered liquid ripples, non-harmonic superposition: 0.7x, 1.3x, 2.1x)`
                      : mathSignal.ingredientName === "Beef Patty" ||
                          mathSignal.ingredientName === "Patty"
                        ? ` (parametric repeated horizontal ovals, a = 2.5, b = 0.7, 2π ≤ t ≤ 8π)`
                        : mathSignal.ingredientName === "Bun"
                          ? ` (smooth bun dome profile with fine surface variation, f = ${ingredient.freq} Hz)`
                          : mathSignal.ingredientName === "Noodles" ||
                              mathSignal.ingredientName === "Noodle"
                            ? ` (parametric trochoid curve with 12 curling loops, -12π ≤ t ≤ 12π)`
                            : mathSignal.ingredientName === "Butter"
                              ? ` (periodic trapezoidal blocks, period = 14, A = 1.2, domain: -21 < x < 21)`
                              : mathSignal.ingredientName === "Tomato"
                                ? ` (parametric tomato contour, 3 lobes, 0 ≤ t ≤ 6π)`
                                : mathSignal.ingredientName === "Onion"
                                  ? ` (parametric Archimedean onion spiral, 9 concentric layers, 0 ≤ t ≤ 6π)`
                                  : mathSignal.ingredientName === "Carrot"
                                    ? ` (quartic cosine taper waveform, f = ${ingredient.freq} Hz)`
                                    : mathSignal.ingredientName === "Cucumber"
                                      ? ` (hyperbolic tangent saturated waveform, f = ${ingredient.freq} Hz)`
                                      : mathSignal.ingredientName === "Sauce"
                                        ? ` (parametric 5-lobed sauce rosette, 0 ≤ t ≤ 6π)`
                                        : mathSignal.ingredientName === "Egg"
                                          ? ` (parametric egg contour, 0 ≤ t ≤ 6π)`
                                          : ` (f = ${ingredient.freq} Hz, A = ${mathSignal.defaultAmplitude}, φ = 0)`}
            </p>
          </div>
        )}

        {/* Footer Technical Tagline */}
        <div className="mt-5 text-center font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
          {isChicken
            ? "TIME DOMAIN • RECORDED CHICKEN SIGNAL"
            : mathSignal
              ? "TIME DOMAIN • MATHEMATICAL SIGNAL"
              : "TIME DOMAIN • RAW INGREDIENT"}
        </div>
      </div>
    </div>
  );
}
