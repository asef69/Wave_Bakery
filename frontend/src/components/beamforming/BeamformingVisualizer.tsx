import { useEffect, useRef, useState } from "react";
import type { SpeakerState } from "@/lib/beamforming";
import { WAVE_NUMBER, WAVELENGTH, ELEMENT_SPACING } from "@/lib/beamforming";
import { cn } from "@/lib/utils";
import { Layers, Sparkles, Waves } from "lucide-react";

interface BeamformingVisualizerProps {
  speakers: SpeakerState[];
  steeredAngle: number;
  targetAngle?: number | undefined;
  isAligned?: boolean;
  isDelivering?: boolean;
  isDelivered?: boolean;
  showTarget?: boolean;
  className?: string;
  dishEmoji?: string;
}

export function BeamformingVisualizer({
  speakers,
  steeredAngle,
  targetAngle,
  isAligned = false,
  isDelivering = false,
  isDelivered = false,
  showTarget = true,
  className,
  dishEmoji = "🍔",
}: BeamformingVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showDualDomain, setShowDualDomain] = useState(true);

  // Main 2D Spatial Wavefield Interference Simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.045;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Coordinate origins
      const originX = width / 2;
      const originY = height - 28;

      // 1. Grid & polar guides
      ctx.strokeStyle = "rgba(80, 220, 240, 0.08)";
      ctx.lineWidth = 1;

      for (let r = 40; r <= 260; r += 45) {
        ctx.beginPath();
        ctx.arc(originX, originY, r, Math.PI, 2 * Math.PI);
        ctx.stroke();
      }

      [-60, -30, 0, 30, 60].forEach((ang) => {
        const rad = ((ang - 90) * Math.PI) / 180;
        const x2 = originX + Math.cos(rad) * 260;
        const y2 = originY + Math.sin(rad) * 260;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      // Target Ray
      if (showTarget && targetAngle !== undefined) {
        const targetRad = ((targetAngle - 90) * Math.PI) / 180;
        const tx = originX + Math.cos(targetRad) * 255;
        const ty = originY + Math.sin(targetRad) * 255;

        ctx.strokeStyle = isAligned ? "rgba(72, 187, 120, 0.75)" : "rgba(80, 220, 240, 0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Speaker array positions
      const activeCount = speakers.length;
      const spacing = Math.min(36, (width - 100) / activeCount);
      const startX = originX - ((activeCount - 1) * spacing) / 2;

      // 2. Individual Speaker Spherical Waves Summing into Coherent Wavefront
      const activeSpeakers = speakers.filter((s) => s.isActive);

      // Draw individual radiating waves per speaker
      activeSpeakers.forEach((spk, idx) => {
        const sx = startX + idx * spacing;
        const sy = originY;

        // Speaker element dot
        ctx.fillStyle = isAligned ? "#48bb78" : "oklch(0.72 0.17 50)";
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, 2 * Math.PI);
        ctx.fill();

        // Wavefront ripples with phase delay
        const phaseRad = (spk.phase * Math.PI) / 180;
        const numRings = 6;

        for (let ring = 0; ring < numRings; ring++) {
          const progress =
            (((time * 1.4 + ring * (1 / numRings) + phaseRad / (2 * Math.PI)) % 1) + 1) % 1;
          const radius = progress * 170;
          const alpha = Math.max(0, (1 - progress) * (spk.amplitude ?? 1.0) * 0.22);

          ctx.strokeStyle = isAligned
            ? `rgba(72, 187, 120, ${alpha * 1.3})`
            : `rgba(255, 152, 0, ${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(sx, sy, radius, Math.PI, 2 * Math.PI);
          ctx.stroke();
        }
      });

      // 3. Constructive Interference Main Lobe Wavefronts (The resulting beam)
      const beamRad = ((steeredAngle - 90) * Math.PI) / 180;
      const beamLength = isDelivering || isDelivered ? 255 : 220;
      const bx = originX + Math.cos(beamRad) * beamLength;
      const by = originY + Math.sin(beamRad) * beamLength;

      // Coherent beam cone
      const coneAngle = Math.PI / 14;
      ctx.fillStyle = isAligned ? "rgba(72, 187, 120, 0.18)" : "rgba(255, 152, 0, 0.14)";
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.arc(originX, originY, beamLength, beamRad - coneAngle, beamRad + coneAngle);
      ctx.closePath();
      ctx.fill();

      // Main beam central wavefront energy
      const beamGrad = ctx.createLinearGradient(originX, originY, bx, by);
      if (isAligned) {
        beamGrad.addColorStop(0, "rgba(72, 187, 120, 0.95)");
        beamGrad.addColorStop(1, "rgba(72, 187, 120, 0.25)");
      } else {
        beamGrad.addColorStop(0, "rgba(255, 152, 0, 0.9)");
        beamGrad.addColorStop(1, "rgba(255, 193, 7, 0.2)");
      }

      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = isAligned ? 4.5 : 3;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Constructive crest packets traveling outward
      const numPackets = 5;
      for (let p = 0; p < numPackets; p++) {
        const pProg = (((time * 2.0 + p * 0.2) % 1) + 1) % 1;
        const px = originX + Math.cos(beamRad) * (pProg * beamLength);
        const py = originY + Math.sin(beamRad) * (pProg * beamLength);

        // Perpendicular constructive wave crest segment
        const perpAngle = beamRad + Math.PI / 2;
        const crestLen = 14 * pProg;
        ctx.strokeStyle = isAligned ? "rgba(72, 187, 120, 0.85)" : "rgba(255, 193, 7, 0.85)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(perpAngle) * crestLen, py - Math.sin(perpAngle) * crestLen);
        ctx.lineTo(px + Math.cos(perpAngle) * crestLen, py + Math.sin(perpAngle) * crestLen);
        ctx.stroke();

        ctx.fillStyle = isAligned ? "#48bb78" : "#ff9800";
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [speakers, steeredAngle, targetAngle, isAligned, isDelivering, isDelivered, showTarget]);

  // Mini Time-Domain Superposition Replay Canvas
  useEffect(() => {
    const canvas = timeCanvasRef.current;
    if (!canvas || !showDualDomain) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const renderTimeDomain = () => {
      time += 0.05;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Baseline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Component waves: x1(t), x2(t), x3(t)
      const colors = [
        "rgba(236, 72, 153, 0.4)",
        "rgba(59, 130, 246, 0.4)",
        "rgba(234, 179, 8, 0.4)",
      ];
      const freqs = [2, 4, 6];

      freqs.forEach((f, idx) => {
        ctx.strokeStyle = colors[idx]!;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const t = (x / w) * Math.PI * 2 * f + time * 1.5;
          const y = h / 2 + Math.sin(t) * 12;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // Summed superposition wave x_mix(t) = (x1 + x2 + x3)/sqrt(3)
      ctx.strokeStyle = "var(--primary)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        let sum = 0;
        freqs.forEach((f) => {
          const t = (x / w) * Math.PI * 2 * f + time * 1.5;
          sum += Math.sin(t);
        });
        const y = h / 2 + (sum / Math.sqrt(3)) * 18;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(renderTimeDomain);
    };

    renderTimeDomain();
    return () => cancelAnimationFrame(animId);
  }, [showDualDomain]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-signal/25 bg-[oklch(0.16_0.03_250)] p-4 shadow-inner",
        className,
      )}
    >
      {/* HUD Top Info */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md border border-signal/40 bg-signal/15 text-signal">
          <Waves className="h-3 w-3" />
        </span>
        <span className="font-mono text-[9px] font-bold tracking-wider text-signal/90 uppercase">
          Spatial Superposition &amp; Wave Interference Field
        </span>
      </div>

      <div className="absolute top-3 right-4 z-10 flex items-center gap-2 font-mono text-[10px]">
        <button
          type="button"
          onClick={() => setShowDualDomain((prev) => !prev)}
          className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-bold uppercase text-primary hover:bg-primary/20 cursor-pointer"
          title="Toggle Dual-Domain Comparison"
        >
          {showDualDomain ? "Hide Time Replay" : "Show Dual-Domain Replay"}
        </button>

        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-bold uppercase",
            isAligned
              ? "border-signal-alt/60 bg-signal-alt/20 text-signal-alt"
              : "border-border bg-secondary text-muted-foreground",
          )}
        >
          {isAligned ? "✓ In Focus" : "Unfocused"}
        </span>
      </div>

      {/* Main 2D Wavefield Canvas */}
      <div className="mt-6 w-full flex flex-col items-center">
        <canvas ref={canvasRef} width={480} height={290} className="w-full max-w-lg h-auto" />
      </div>

      {/* Side-by-Side Dual-Domain Replay Panel */}
      {showDualDomain && (
        <div className="mt-3 w-full rounded-xl border border-border/80 bg-black/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold text-foreground uppercase">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Dual-Domain Superposition Analogy</span>
            </div>
            <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[8px] font-black text-primary uppercase">
              CSE 220 Unified Concept
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Time-Domain Mixing Replay */}
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2 text-center">
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground uppercase">
                <span>Time Domain (Mixing Lab)</span>
                <span className="font-bold text-primary">x_mix(t) = ∑ x_k(t)</span>
              </div>
              <canvas
                ref={timeCanvasRef}
                width={220}
                height={50}
                className="mt-1 w-full h-auto rounded"
              />
              <p className="mt-1 font-mono text-[8px] text-muted-foreground">
                Summing ingredient audio tracks sample-by-sample
              </p>
            </div>

            {/* Spatial-Domain Phased Array */}
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2 text-center">
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground uppercase">
                <span>Spatial Domain (Beam Delivery)</span>
                <span className="font-bold text-signal">p(r, t) = ∑ s_m(r, t)</span>
              </div>
              <div className="mt-1 flex h-[50px] items-center justify-center rounded bg-black/40 font-mono text-[10px] font-extrabold text-signal-alt">
                Coherent Wavefront Constructive Focus
              </div>
              <p className="mt-1 font-mono text-[8px] text-muted-foreground">
                Summing radiating pressure waves across space
              </p>
            </div>
          </div>

          <div className="mt-2.5 rounded-lg border border-signal/30 bg-signal/10 px-2.5 py-1.5 font-mono text-[10px] text-signal leading-tight text-center">
            💡 <strong>Core Principle:</strong> Same addition, different domain. Constructive
            interference in space operates by the exact same linear superposition rule as combining
            flavors in the mixing bowl.
          </div>
        </div>
      )}

      {/* Travelling Dish Delivery Animation */}
      {isDelivering && (
        <div
          className="pointer-events-none absolute z-20 text-3xl animate-bounce"
          style={{
            bottom: "45%",
            left: "50%",
            transform: `translate(-50%, -50%) rotate(${steeredAngle}deg)`,
            transition: "all 1s ease-out",
          }}
        >
          {dishEmoji}
        </div>
      )}
    </div>
  );
}
