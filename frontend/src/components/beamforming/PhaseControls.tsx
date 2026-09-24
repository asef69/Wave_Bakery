import { Sliders, RotateCcw, Compass, Waves } from "lucide-react";
import type { SpeakerState, WindowType } from "@/lib/beamforming";
import { getPresetPhasesForAngle } from "@/lib/beamforming";
import { WindowSelector } from "@/components/game/WindowSelector";
import { GameButton } from "@/components/game/GameButton";
import { cn } from "@/lib/utils";

interface PhaseControlsProps {
  speakers: SpeakerState[];
  onUpdatePhase: (id: number, phase: number) => void;
  onUpdateAllPhases: (phases: number[]) => void;
  onResetPhases: () => void;
  steeredAngle: number;
  selectedWindow?: WindowType;
  onSelectWindow?: (window: WindowType) => void;
  className?: string;
}

export function PhaseControls({
  speakers,
  onUpdatePhase,
  onUpdateAllPhases,
  onResetPhases,
  steeredAngle,
  selectedWindow = "uniform",
  onSelectWindow,
  className,
}: PhaseControlsProps) {
  const handleSteeringSlider = (targetAngle: number) => {
    const newPhases = getPresetPhasesForAngle(targetAngle, speakers.length);
    onUpdateAllPhases(newPhases);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm backdrop-blur-xs",
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
            <Sliders className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-primary uppercase">
              Phase Shift & Windowing Controls
            </p>
            <h4 className="font-display text-base font-extrabold text-foreground uppercase">
              Beam Steering & Sidelobe Tapering
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GameButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetPhases}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset (0°)</span>
          </GameButton>
        </div>
      </div>

      {/* Sidelobe Tapering Window Selector */}
      {onSelectWindow && (
        <div className="mt-4">
          <WindowSelector
            selectedWindow={selectedWindow}
            onSelectWindow={onSelectWindow}
            title="Spatial Array Windowing / Sidelobe Suppression"
            subtitle="Applies amplitude tapering across the array to eliminate sidelobe leakage into other diners."
          />
        </div>
      )}

      {/* Progressive Array Steering Quick Slider */}
      <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-foreground uppercase">
            <Compass className="h-3.5 w-3.5 text-primary" />
            <span>Linear Progressive Phase Steering</span>
          </div>
          <span className="rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 font-mono text-xs font-extrabold text-primary">
            {steeredAngle > 0 ? `+${steeredAngle}°` : `${steeredAngle}°`}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Calculates progressive $\Delta\phi$ across adjacent elements to steer the acoustic beam.
        </p>

        <input
          type="range"
          min={-60}
          max={60}
          step={1}
          value={steeredAngle}
          onChange={(e) => handleSteeringSlider(Number(e.target.value))}
          className="mt-2.5 h-2 w-full cursor-grab accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
          aria-label="Progressive phase steering angle"
        />
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground uppercase">
          <span>-60° (Left)</span>
          <span>0° (Boresight)</span>
          <span>+60° (Right)</span>
        </div>
      </div>

      {/* Individual Speaker Phase Sliders Grid */}
      <div className="mt-4">
        <p className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
          Individual Element Phase Adjustments
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8">
          {speakers.map((s, idx) => (
            <div
              key={s.id}
              className="rounded-xl border border-border/80 bg-secondary/50 p-2.5 text-center shadow-2xs"
            >
              <div className="flex items-center justify-between font-mono text-[9px] font-bold text-muted-foreground uppercase">
                <span>Spk #{idx + 1}</span>
                <span className={cn(s.phase !== 0 ? "text-primary font-extrabold" : "")}>
                  {s.phase > 0 ? `+${s.phase}°` : `${s.phase}°`}
                </span>
              </div>

              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={s.phase}
                onChange={(e) => onUpdatePhase(s.id, Number(e.target.value))}
                className="mt-2 h-1.5 w-full cursor-grab accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
                aria-label={`Speaker ${idx + 1} phase`}
              />

              <div className="mt-1.5 flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(-180, s.phase - 15);
                    onUpdatePhase(s.id, next);
                  }}
                  className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px] hover:border-primary/50 text-foreground cursor-pointer"
                >
                  -15°
                </button>
                <button
                  type="button"
                  onClick={() => onUpdatePhase(s.id, 0)}
                  className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px] hover:border-primary/50 text-muted-foreground cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(180, s.phase + 15);
                    onUpdatePhase(s.id, next);
                  }}
                  className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px] hover:border-primary/50 text-foreground cursor-pointer"
                >
                  +15°
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
