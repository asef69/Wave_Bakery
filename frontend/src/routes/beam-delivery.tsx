import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Radio, Send, CheckCircle2, AlertCircle, Sparkles, Volume2, Trophy, Compass, Waves } from "lucide-react";

import { BeamPatternGraph } from "@/components/beamforming/BeamPatternGraph";
import { BeamTarget } from "@/components/beamforming/BeamTarget";
import { BeamformingVisualizer } from "@/components/beamforming/BeamformingVisualizer";
import { RestaurantFloorplanRadar } from "@/components/beamforming/RestaurantFloorplanRadar";
import { PhaseControls } from "@/components/beamforming/PhaseControls";
import { SpeakerArray } from "@/components/beamforming/SpeakerArray";
import { GameButton } from "@/components/game/GameButton";
import { LabShell } from "@/components/game/LabShell";
import {
  SignalAudioPlayer,
  playTargetLockSound,
  playLevitationLaunchSound,
} from "@/lib/audio";
import {
  calculateSteeredBeamAngle,
  calculateTransmissionEfficiency,
  checkBeamAlignment,
  generateArrayFactorPattern,
  applyWindowTapering,
  evaluateTableSpillover,
  type SpeakerState,
  type WindowType,
} from "@/lib/beamforming";
import {
  recordStageAccuracy,
  useActiveRecipe,
  useCookedSignal,
  useRecipeProgress,
  useRecipeTimer,
} from "@/lib/recipes";
import { saveCurrentDishScoreToLeaderboard } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/beam-delivery")({
  head: () => ({
    meta: [
      { title: "Beam Delivery — WaveBakery" },
      {
        name: "description",
        content:
          "Align the multi-speaker acoustic array to beam your cooked dish directly to the eater.",
      },
      { property: "og:title", content: "Beam Delivery — WaveBakery" },
      {
        property: "og:description",
        content: "Phased array acoustic beam delivery serving mechanic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BeamDeliveryScreen,
});

const DEFAULT_SPEAKERS: SpeakerState[] = [
  { id: 1, phase: 0, amplitude: 1, isActive: true },
  { id: 2, phase: 0, amplitude: 1, isActive: true },
  { id: 3, phase: 0, amplitude: 1, isActive: true },
  { id: 4, phase: 0, amplitude: 1, isActive: true },
  { id: 5, phase: 0, amplitude: 1, isActive: true },
  { id: 6, phase: 0, amplitude: 1, isActive: true },
  { id: 7, phase: 0, amplitude: 1, isActive: true },
  { id: 8, phase: 0, amplitude: 1, isActive: true },
];

interface DestinationConfig {
  tableNumber: number;
  tableName: string;
  eaterName: string;
  angle: number;
  dishEmoji: string;
}

const RECIPE_DESTINATIONS: Record<string, DestinationConfig> = {
  burger: {
    tableNumber: 1,
    tableName: "Table 1 · Window Booth",
    eaterName: "Speedy Diner #1",
    angle: -30,
    dishEmoji: "🍔",
  },
  noodles: {
    tableNumber: 2,
    tableName: "Table 2 · Ramen Counter",
    eaterName: "Hungry Noodle Fan #2",
    angle: 15,
    dishEmoji: "🍜",
  },
  cake: {
    tableNumber: 5,
    tableName: "Table 5 · VIP Celebration Lounge",
    eaterName: "Party Host #5",
    angle: 45,
    dishEmoji: "🧁",
  },
  sandwich: {
    tableNumber: 3,
    tableName: "Table 3 · Sunlit Terrace",
    eaterName: "Lunch Patron #3",
    angle: -15,
    dishEmoji: "🥪",
  },
};

function BeamDeliveryScreen() {
  const [recipe] = useActiveRecipe();
  const [unlockedStep] = useRecipeProgress();
  const { difficultyConfig } = useRecipeTimer();
  const navigate = useNavigate();

  const destination = useMemo<DestinationConfig>(() => {
    return (
      RECIPE_DESTINATIONS[recipe.id] ?? {
        tableNumber: 4,
        tableName: "Table 4 · Center Dining Table",
        eaterName: "Gourmet Critic #4",
        angle: 35,
        dishEmoji: "🍽️",
      }
    );
  }, [recipe.id]);

  const targetAngle = destination.angle;

  const [speakers, setSpeakers] = useState<SpeakerState[]>(DEFAULT_SPEAKERS);
  const [selectedWindow, setSelectedWindow] = useState<WindowType>("uniform");
  const [viewMode, setViewMode] = useState<"radar" | "wavefield">("radar");
  const [isDelivering, setIsDelivering] = useState(false);
  const [isDelivered, setIsDelivered] = useState(false);
  const [attemptedFailed, setAttemptedFailed] = useState(false);
  const [cookedSignal] = useCookedSignal(recipe.id);
  const [player, setPlayer] = useState<SignalAudioPlayer | null>(null);
  const wasAlignedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (player) player.destroy();
    };
  }, [player]);

  // Calculate real physical steered beam angle, array factor pattern, and efficiency
  const steeredAngle = calculateSteeredBeamAngle(speakers);
  const efficiency = calculateTransmissionEfficiency(speakers, targetAngle);
  const tolerance = difficultyConfig?.id === "masterchef" || difficultyConfig?.id === "hard" ? 4 : 6;
  const isAligned = checkBeamAlignment(steeredAngle, targetAngle, tolerance) || efficiency >= 80;
  const beamPatternData = generateArrayFactorPattern(speakers);
  const deliveryBonus = Math.round((efficiency / 100) * 150);

  // Play lock chime once when aligned
  useEffect(() => {
    if (isAligned && !wasAlignedRef.current && !isDelivered) {
      playTargetLockSound();
      wasAlignedRef.current = true;
    } else if (!isAligned) {
      wasAlignedRef.current = false;
    }
  }, [isAligned, isDelivered]);

  // Check for sidelobe spillover on neighboring tables
  const spillovers = evaluateTableSpillover(speakers, destination.tableNumber, 0.38);

  const handlePlayBeamAudio = () => {
    if (player) player.destroy();
    // Modulate amplitude & clarity based on beam alignment efficiency, with stereo pan
    const gainFactor = isAligned ? 1.0 : Math.max(0.2, efficiency / 100);
    const modulatedSamples = cookedSignal.samples.map((s) => s * gainFactor);
    const stereoPan = Math.max(-1.0, Math.min(1.0, steeredAngle / 45));

    const p = new SignalAudioPlayer({
      samples: modulatedSamples,
      frequency: cookedSignal.frequency,
      duration: 2.5,
      pan: stereoPan,
    });
    p.play();
    setPlayer(p);
  };

  const handleSelectWindow = (wType: WindowType) => {
    setSelectedWindow(wType);
    setSpeakers((prev) => applyWindowTapering(prev, wType));
  };

  const handleUpdatePhase = (id: number, phase: number) => {
    setAttemptedFailed(false);
    setSpeakers((prev) =>
      applyWindowTapering(
        prev.map((s) => (s.id === id ? { ...s, phase } : s)),
        selectedWindow,
      ),
    );
  };

  const handleUpdateAllPhases = (phases: number[]) => {
    setAttemptedFailed(false);
    setSpeakers((prev) =>
      applyWindowTapering(
        prev.map((s, idx) => ({ ...s, phase: phases[idx] ?? s.phase })),
        selectedWindow,
      ),
    );
  };

  const handleResetPhases = () => {
    setAttemptedFailed(false);
    setSelectedWindow("uniform");
    setSpeakers(DEFAULT_SPEAKERS);
  };

  const handleDeliver = () => {
    if (isAligned) {
      setAttemptedFailed(false);
      setIsDelivering(true);
      recordStageAccuracy("delivery", efficiency);
      const stereoPan = Math.max(-1.0, Math.min(1.0, steeredAngle / 45));
      playLevitationLaunchSound(stereoPan);
      handlePlayBeamAudio();
      setTimeout(() => {
        setIsDelivering(false);
        setIsDelivered(true);
        saveCurrentDishScoreToLeaderboard({
          recipeId: recipe.id,
          deliveryBonus,
        });
      }, 1400);
    } else {
      setAttemptedFailed(true);
    }
  };

  const chefLine = isDelivered
    ? `Bullseye! The ${recipe.name} signal rode the acoustic waveguide straight to ${destination.tableName}! Precision Bonus: +${deliveryBonus} pts!`
    : isAligned
      ? `Target locked at ${targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`}! Press DELIVER to beam the ${recipe.name} to ${destination.eaterName}.`
      : attemptedFailed
        ? `Beam not aligned. Adjust speaker phase delays to steer acoustic power toward ${targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`}.`
        : `Align the phased array beam to steer the acoustic dish to ${destination.tableName} (${targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`}).`;

  return (
    <LabShell
      eyebrow="Serve Station · Phased Array"
      title="Beam Delivery"
      chefLine={chefLine}
      backTo="/score"
      backLabel="← Back to Results"
      nextTo={isDelivered ? "/score" : undefined}
      nextLabel="View Final Score & Customer Critique →"
    >
      {/* HUD Header */}
      <div className="kitchen-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-secondary/80 px-3 py-1.5 shadow-sm">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <div>
              <p className="font-mono text-[9px] font-extrabold tracking-[0.2em] text-primary uppercase">
                Ready to Serve
              </p>
              <p className="font-display text-sm font-extrabold uppercase text-foreground">
                {recipe.name}
              </p>
            </div>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
              Target Destination
            </p>
            <p className="font-display text-sm font-bold tracking-[0.08em] text-foreground uppercase">
              {destination.tableName} ({targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`})
            </p>
          </div>

          {difficultyConfig && (
            <div>
              <p className="font-mono text-[9px] tracking-[0.26em] text-muted-foreground uppercase">
                Difficulty
              </p>
              <p className="font-display text-sm font-bold tracking-[0.08em] text-foreground uppercase">
                {difficultyConfig.badge}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Beam Alignment:
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs font-extrabold uppercase transition-all",
              isAligned
                ? "border-signal-alt/60 bg-signal-alt/20 text-signal-alt shadow-xs"
                : "border-border bg-secondary text-muted-foreground",
            )}
          >
            {isAligned ? `✓ ${Math.round(efficiency)}% Focus (Locked)` : `⚠ ${Math.round(efficiency)}% Focus`}
          </span>
        </div>
      </div>

      {/* Main Delivery Workspace */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left Column: Visualizer & Target */}
        <div className="space-y-6">
          {/* Visualizer Container with Radar / Field Mode Toggle */}
          <div className="kitchen-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Acoustic Phased-Array Visualizer
                </p>
                <h3 className="font-display text-lg font-extrabold text-foreground uppercase">
                  {viewMode === "radar" ? "Restaurant Floorplan Radar" : "Spatial Wave Interference Field"}
                </h3>
              </div>
              
              <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/80 p-1 font-mono text-[10px] font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setViewMode("radar")}
                  className={cn(
                    "rounded px-2.5 py-1 transition-all cursor-pointer",
                    viewMode === "radar"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Dining Radar
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("wavefield")}
                  className={cn(
                    "rounded px-2.5 py-1 transition-all cursor-pointer",
                    viewMode === "wavefield"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Wavefield
                </button>
              </div>
            </div>

            {viewMode === "radar" ? (
              <RestaurantFloorplanRadar
                speakers={speakers}
                steeredAngle={steeredAngle}
                targetAngle={targetAngle}
                targetTableId={destination.tableNumber}
                isAligned={isAligned}
                isDelivering={isDelivering}
                isDelivered={isDelivered}
                dishEmoji={destination.dishEmoji}
              />
            ) : (
              <BeamformingVisualizer
                speakers={speakers}
                steeredAngle={steeredAngle}
                targetAngle={targetAngle}
                isAligned={isAligned}
                isDelivering={isDelivering}
                isDelivered={isDelivered}
                dishEmoji={destination.dishEmoji}
              />
            )}
          </div>

          {/* Sidelobe Spillover Alert Box */}
          {spillovers.length > 0 && !isDelivered && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive-foreground">
              <div className="flex items-center gap-2 font-display font-extrabold text-destructive uppercase">
                <AlertCircle className="h-4 w-4" />
                <span>Acoustic Sidelobe Spillover Detected!</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Secondary lobes are radiating {spillovers.map((s) => `${s.table.name} (${s.spilloverIntensity}% power)`).join(", ")}.
                Switch to <strong>Hamming</strong> or <strong>Blackman</strong> windowing in Phase Controls to suppress sidelobes.
              </p>
            </div>
          )}

          {/* Target Eater Card */}
          <BeamTarget
            targetAngle={targetAngle}
            isAligned={isAligned}
            isDelivered={isDelivered}
            eaterName={destination.eaterName}
          />
        </div>

        {/* Right Column: Speaker Array, Phase Controls, & Directivity Graph */}
        <div className="space-y-6">
          <SpeakerArray speakers={speakers} />

          <PhaseControls
            speakers={speakers}
            onUpdatePhase={handleUpdatePhase}
            onUpdateAllPhases={handleUpdateAllPhases}
            onResetPhases={handleResetPhases}
            steeredAngle={steeredAngle}
            selectedWindow={selectedWindow}
            onSelectWindow={handleSelectWindow}
          />

          <BeamPatternGraph
            data={beamPatternData}
            steeredAngle={steeredAngle}
            targetAngle={targetAngle}
            isAligned={isAligned}
          />
        </div>
      </div>

      {/* Delivery Action Card / Feedback */}
      <div className="mt-8 kitchen-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-display text-xl font-extrabold text-foreground uppercase">
                {isDelivered
                  ? "DISH DELIVERED SUCCESSFULLY!"
                  : isAligned
                    ? "BEAM IN FOCUS — READY FOR DELIVERY"
                    : "CALIBRATE ARRAY FOR SERVING"}
              </h4>
              {isDelivered && (
                <span className="rounded-md border border-signal-alt/50 bg-signal-alt/20 px-2.5 py-0.5 font-mono text-xs font-extrabold text-signal-alt uppercase animate-pulse">
                  +{deliveryBonus} Bonus Pts
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isDelivered
                ? `${destination.eaterName} at ${destination.tableName} happily received their acoustic ${recipe.name}! Precision bonus +${deliveryBonus} pts awarded.`
                : isAligned
                  ? `The acoustic wave energy is focused at ${destination.tableName} (${targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`}). Press Deliver to send the dish.`
                  : `Adjust element phases until the main lobe directs acoustic energy toward ${destination.tableName} at ${targetAngle > 0 ? `+${targetAngle}°` : `${targetAngle}°`}.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <GameButton
              variant="lab"
              size="md"
              onClick={handlePlayBeamAudio}
              className="uppercase font-bold tracking-wider"
            >
              <Volume2 className="mr-2 h-4 w-4" />
              ▶ Play Beam Output
            </GameButton>

            {isDelivered ? (
              <Link to="/complete">
                <GameButton size="lg" className="uppercase font-bold tracking-wider">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Proceed to Score →
                </GameButton>
              </Link>
            ) : (
              <>
                <Link to="/complete">
                  <GameButton variant="secondary" size="md" className="uppercase">
                    Skip / Serve Normally
                  </GameButton>
                </Link>
                <GameButton
                  size="lg"
                  onClick={handleDeliver}
                  disabled={isDelivering}
                  className="uppercase font-extrabold tracking-wider"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Deliver Dish ⚡
                </GameButton>
              </>
            )}
          </div>
        </div>

        {/* Friendly Failure Notice */}
        {attemptedFailed && !isAligned && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-primary/40 bg-primary/10 p-3 font-mono text-xs font-bold text-primary">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Beam not aligned. Adjust the speakers and try again.</span>
          </div>
        )}
      </div>
    </LabShell>
  );
}
