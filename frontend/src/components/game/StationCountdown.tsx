import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getSoundSettings } from "@/lib/sound";

interface StationCountdownProps {
  onComplete: () => void;
}

/**
 * Plays a short synth blip/chime for each countdown tick.
 * Wrapped in try/catch to gracefully handle environments without Web Audio support.
 */
function playCountdownTone(isGo: boolean = false) {
  if (typeof window === "undefined") return;
  const sound = getSoundSettings();
  if (!sound.soundEnabled || sound.volume <= 0) return;
  const volMult = sound.volume / 100;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isGo) {
      // Energetic rising chime for GO!
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2 * volMult, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else {
      // Short crisp pip for 3, 2, 1
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.16 * volMult, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 600);
  } catch {
    // ignore
  }
}

export function StationCountdown({ onComplete }: StationCountdownProps) {
  // Stage 0 = "3", Stage 1 = "2", Stage 2 = "1", Stage 3 = "GO!", Stage 4 = Finished
  const [stage, setStage] = useState<number>(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Initial tone for '3'
    playCountdownTone(false);

    const t1 = setTimeout(() => {
      setStage(1);
      playCountdownTone(false);
    }, 1000);

    const t2 = setTimeout(() => {
      setStage(2);
      playCountdownTone(false);
    }, 2000);

    const t3 = setTimeout(() => {
      setStage(3);
      playCountdownTone(true);
    }, 3000);

    const t4 = setTimeout(() => {
      setStage(4);
      onCompleteRef.current();
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  if (stage >= 4) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto select-none animate-in fade-in duration-200"
      aria-live="assertive"
      aria-label={stage === 3 ? "GO!" : String(3 - stage)}
    >
      <div className="relative flex flex-col items-center justify-center">
        <span
          key={stage}
          className={cn(
            "inline-block font-display font-black tracking-tight leading-none uppercase select-none transition-transform animate-in zoom-in-75 fade-in duration-300",
            stage === 3
              ? "text-8xl sm:text-9xl md:text-[13rem] text-emerald-400 drop-shadow-[0_0_60px_rgba(52,211,153,0.8)]"
              : "text-9xl sm:text-[11rem] md:text-[14rem] text-amber-400 drop-shadow-[0_0_50px_rgba(251,191,36,0.7)]",
          )}
        >
          {stage === 0 && "3"}
          {stage === 1 && "2"}
          {stage === 2 && "1"}
          {stage === 3 && "GO!"}
        </span>
      </div>
    </div>
  );
}
