import { useEffect, useRef } from "react";
import type { SpeakerState } from "@/lib/beamforming";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.04;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle polar coordinate grid lines
      const originX = width / 2;
      const originY = height - 30;

      ctx.strokeStyle = "rgba(80, 220, 240, 0.08)";
      ctx.lineWidth = 1;

      // Radial range rings
      for (let r = 50; r <= 280; r += 50) {
        ctx.beginPath();
        ctx.arc(originX, originY, r, Math.PI, 2 * Math.PI);
        ctx.stroke();
      }

      // Angle radial guide lines (-60, -30, 0, +30, +60 deg)
      [-60, -30, 0, 30, 60].forEach((ang) => {
        const rad = ((ang - 90) * Math.PI) / 180;
        const x2 = originX + Math.cos(rad) * 260;
        const y2 = originY + Math.sin(rad) * 260;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      // Target Angle Guide Ray
      if (showTarget && targetAngle !== undefined) {
        const targetRad = ((targetAngle - 90) * Math.PI) / 180;
        const tx = originX + Math.cos(targetRad) * 250;
        const ty = originY + Math.sin(targetRad) * 250;

        ctx.strokeStyle = isAligned ? "rgba(72, 187, 120, 0.7)" : "rgba(80, 220, 240, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw wavefronts emitted by each speaker
      const activeCount = speakers.length;
      const spacing = Math.min(38, (width - 100) / activeCount);
      const startX = originX - ((activeCount - 1) * spacing) / 2;

      speakers.forEach((spk, idx) => {
        if (!spk.isActive) return;
        const sx = startX + idx * spacing;
        const sy = originY;

        // Draw speaker dot
        ctx.fillStyle = "oklch(0.72 0.17 50)";
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, 2 * Math.PI);
        ctx.fill();

        // Wavefront ripples with phase delay
        const phaseRad = (spk.phase * Math.PI) / 180;
        const numRings = 5;

        for (let ring = 0; ring < numRings; ring++) {
          const progress =
            (((time * 1.5 + ring * (1 / numRings) + phaseRad / (2 * Math.PI)) % 1) + 1) % 1;
          const radius = progress * 160;
          const alpha = Math.max(0, (1 - progress) * 0.25);

          ctx.strokeStyle = isAligned
            ? `rgba(72, 187, 120, ${alpha * 1.2})`
            : `rgba(255, 152, 0, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, radius, Math.PI, 2 * Math.PI);
          ctx.stroke();
        }
      });

      // Draw Main Steered Directional Beam Envelope
      const beamRad = ((steeredAngle - 90) * Math.PI) / 180;
      const beamLength = isDelivering || isDelivered ? 250 : 210;
      const bx = originX + Math.cos(beamRad) * beamLength;
      const by = originY + Math.sin(beamRad) * beamLength;

      // Beam cone glow
      const coneAngle = Math.PI / 12; // ~15 deg width
      ctx.fillStyle = isAligned ? "rgba(72, 187, 120, 0.15)" : "rgba(255, 152, 0, 0.12)";
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.arc(originX, originY, beamLength, beamRad - coneAngle, beamRad + coneAngle);
      ctx.closePath();
      ctx.fill();

      // Main beam central ray
      const beamGrad = ctx.createLinearGradient(originX, originY, bx, by);
      if (isAligned) {
        beamGrad.addColorStop(0, "rgba(72, 187, 120, 0.9)");
        beamGrad.addColorStop(1, "rgba(72, 187, 120, 0.2)");
      } else {
        beamGrad.addColorStop(0, "rgba(255, 152, 0, 0.85)");
        beamGrad.addColorStop(1, "rgba(255, 193, 7, 0.15)");
      }

      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = isAligned ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Beam pulse packets traveling along the beam
      const numPackets = 4;
      for (let p = 0; p < numPackets; p++) {
        const pProg = (((time * 2.2 + p * 0.25) % 1) + 1) % 1;
        const px = originX + Math.cos(beamRad) * (pProg * beamLength);
        const py = originY + Math.sin(beamRad) * (pProg * beamLength);

        ctx.fillStyle = isAligned ? "#48bb78" : "#ff9800";
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [speakers, steeredAngle, targetAngle, isAligned, isDelivering, isDelivered, showTarget]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-signal/25 bg-[oklch(0.16_0.03_250)] p-4 shadow-inner",
        className,
      )}
    >
      {/* HUD Top Info */}
      <div className="absolute top-3 left-4 z-10 font-mono text-[9px] text-signal/70 uppercase">
        <span>Interferometric Field Simulation</span>
      </div>

      <div className="absolute top-3 right-4 z-10 flex items-center gap-2 font-mono text-[10px]">
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

      {/* 2D Simulation Canvas */}
      <canvas ref={canvasRef} width={480} height={300} className="w-full max-w-lg h-auto" />

      {/* Travelling Dish Delivery Animation */}
      {isDelivering && (
        <div
          className="pointer-events-none absolute z-20 text-3xl animate-bounce"
          style={{
            bottom: "40%",
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
