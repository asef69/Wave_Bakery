import { useEffect, useRef } from "react";
import {
  type RestaurantTable,
  RESTAURANT_TABLES,
  type SpeakerState,
  computeArrayFactor,
} from "@/lib/beamforming";
import { cn } from "@/lib/utils";

interface RestaurantFloorplanRadarProps {
  speakers: SpeakerState[];
  steeredAngle: number;
  targetAngle: number;
  targetTableId: number;
  isAligned: boolean;
  isDelivering: boolean;
  isDelivered: boolean;
  dishEmoji?: string;
  className?: string;
}

export function RestaurantFloorplanRadar({
  speakers,
  steeredAngle,
  targetAngle,
  targetTableId,
  isAligned,
  isDelivering,
  isDelivered,
  dishEmoji = "🍔",
  className,
}: RestaurantFloorplanRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.035;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Origin at bottom center (Kitchen Array position)
      const originX = width / 2;
      const originY = height - 35;
      const maxRadius = Math.min(width / 2 - 20, height - 60);

      // --- 1. Background Grid & Polar Guide Rings ---
      ctx.strokeStyle = "rgba(80, 220, 240, 0.09)";
      ctx.lineWidth = 1;
      const rings = [0.35, 0.65, 0.95];
      rings.forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(originX, originY, maxRadius * ratio, Math.PI, 2 * Math.PI);
        ctx.stroke();
      });

      // Radial angle guidelines (-60°, -45°, -30°, -15°, 0°, 15°, 30°, 45°, 60°)
      [-60, -45, -30, -15, 0, 15, 30, 45, 60].forEach((ang) => {
        const rad = ((ang - 90) * Math.PI) / 180;
        const x = originX + Math.cos(rad) * maxRadius;
        const y = originY + Math.sin(rad) * maxRadius;
        ctx.strokeStyle = ang === 0 ? "rgba(80, 220, 240, 0.2)" : "rgba(80, 220, 240, 0.06)";
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Degree numbers
        ctx.fillStyle = "rgba(160, 200, 220, 0.4)";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${ang > 0 ? `+${ang}` : ang}°`, x, y - 4);
      });

      // --- 2. Acoustic Array Factor Radiation Field Envelope ---
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      const angleSteps = 90;
      for (let i = 0; i <= angleSteps; i++) {
        const thetaDeg = -80 + (i / angleSteps) * 160;
        const gain = computeArrayFactor(speakers, thetaDeg);
        const rad = ((thetaDeg - 90) * Math.PI) / 180;
        const r = gain * maxRadius * 0.92;
        const px = originX + Math.cos(rad) * r;
        const py = originY + Math.sin(rad) * r;
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = isAligned ? "rgba(72, 187, 120, 0.12)" : "rgba(255, 152, 0, 0.09)";
      ctx.fill();
      ctx.strokeStyle = isAligned ? "rgba(72, 187, 120, 0.6)" : "rgba(255, 152, 0, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // --- 3. Main Focused Beam Ray ---
      const beamRad = ((steeredAngle - 90) * Math.PI) / 180;
      const bx = originX + Math.cos(beamRad) * maxRadius;
      const by = originY + Math.sin(beamRad) * maxRadius;

      // Glow cone
      const coneHalfAngle = Math.PI / 16;
      ctx.fillStyle = isAligned ? "rgba(72, 187, 120, 0.15)" : "rgba(255, 152, 0, 0.1)";
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.arc(originX, originY, maxRadius, beamRad - coneHalfAngle, beamRad + coneHalfAngle);
      ctx.closePath();
      ctx.fill();

      // Center Line
      ctx.strokeStyle = isAligned ? "#48bb78" : "#f59e0b";
      ctx.lineWidth = isAligned ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Acoustic wave pulse packets traveling along the beam
      const numPackets = 5;
      for (let p = 0; p < numPackets; p++) {
        const prog = (((time * 1.8 + p * (1 / numPackets)) % 1) + 1) % 1;
        const px = originX + Math.cos(beamRad) * (prog * maxRadius);
        const py = originY + Math.sin(beamRad) * (prog * maxRadius);
        ctx.fillStyle = isAligned ? "#48bb78" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(px, py, 2.5 + (1 - prog) * 2, 0, 2 * Math.PI);
        ctx.fill();
      }

      // --- 4. Render All Dining Tables on the Floorplan ---
      RESTAURANT_TABLES.forEach((table) => {
        const isTarget = table.id === targetTableId;
        const tableRad = ((table.angle - 90) * Math.PI) / 180;
        const tableDistRatio = 0.45 + (table.distanceMeters / 6.0) * 0.45;
        const tx = originX + Math.cos(tableRad) * (maxRadius * tableDistRatio);
        const ty = originY + Math.sin(tableRad) * (maxRadius * tableDistRatio);

        const receivedGain = computeArrayFactor(speakers, table.angle);
        const isSpillover = !isTarget && receivedGain > 0.35;

        // Glow Ring
        if (isTarget) {
          ctx.strokeStyle = isAligned ? "rgba(72, 187, 120, 0.8)" : "rgba(80, 220, 240, 0.5)";
          ctx.lineWidth = isAligned ? 2.5 : 1.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(tx, ty, 24 + Math.sin(time * 3) * 2, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (isSpillover) {
          ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(tx, ty, 20 + Math.sin(time * 4) * 2, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Table Base Circle
        ctx.fillStyle = isTarget
          ? isDelivered
            ? "oklch(0.45 0.18 145)"
            : isAligned
              ? "oklch(0.38 0.14 140)"
              : "oklch(0.3 0.05 250)"
          : isSpillover
            ? "oklch(0.32 0.12 25)"
            : "oklch(0.24 0.03 250)";

        ctx.strokeStyle = isTarget
          ? isAligned
            ? "#48bb78"
            : "#38bdf8"
          : isSpillover
            ? "#ef4444"
            : "oklch(0.4 0.04 250)";
        ctx.lineWidth = isTarget ? 2 : 1;

        ctx.beginPath();
        ctx.arc(tx, ty, 18, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Table Emoji
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isTarget && isDelivered ? "😋" : table.dishEmoji, tx, ty - 1);

        // Table Name text
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = isTarget
          ? isAligned
            ? "#48bb78"
            : "#38bdf8"
          : isSpillover
            ? "#ef4444"
            : "rgba(200, 220, 240, 0.7)";
        ctx.fillText(`T${table.id}`, tx, ty + 26);

        // Power intensity badge
        ctx.font = "8px monospace";
        ctx.fillStyle = isTarget
          ? isAligned
            ? "#86efac"
            : "rgba(160, 200, 240, 0.8)"
          : isSpillover
            ? "#fca5a5"
            : "rgba(140, 160, 180, 0.5)";
        ctx.fillText(`${Math.round(receivedGain * 100)}% pwr`, tx, ty + 36);
      });

      // --- 5. Levitating Delivery Dish Animation ---
      if (isDelivering) {
        const targetTable = RESTAURANT_TABLES.find((t) => t.id === targetTableId);
        const tAngle = targetTable ? targetTable.angle : targetAngle;
        const targetRad = ((tAngle - 90) * Math.PI) / 180;
        const targetDistRatio = 0.45 + ((targetTable?.distanceMeters ?? 4.5) / 6.0) * 0.45;
        const targetX = originX + Math.cos(targetRad) * (maxRadius * targetDistRatio);
        const targetY = originY + Math.sin(targetRad) * (maxRadius * targetDistRatio);

        const deliveryProgress = (time * 1.5) % 1.2;
        const clampedProg = Math.min(1.0, deliveryProgress);
        const dishX = originX + (targetX - originX) * clampedProg;
        const dishY = originY + (targetY - originY) * clampedProg;

        ctx.fillStyle = "rgba(72, 187, 120, 0.4)";
        ctx.beginPath();
        ctx.arc(dishX, dishY, 18, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = "20px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(dishEmoji, dishX, dishY);
      }

      // --- 6. Kitchen Array (Origin) ---
      const activeCount = speakers.length;
      const spkSpacing = 16;
      const arrayStartX = originX - ((activeCount - 1) * spkSpacing) / 2;

      ctx.fillStyle = "oklch(0.25 0.05 250)";
      ctx.strokeStyle = "oklch(0.5 0.1 250)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(arrayStartX - 10, originY - 6, (activeCount - 1) * spkSpacing + 20, 14, 6);
      ctx.fill();
      ctx.stroke();

      speakers.forEach((spk, idx) => {
        const sx = arrayStartX + idx * spkSpacing;
        const sy = originY;

        ctx.fillStyle = spk.isActive ? "oklch(0.72 0.17 50)" : "oklch(0.4 0.05 250)";
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "oklch(0.72 0.17 50)";
      ctx.textAlign = "center";
      ctx.fillText("KITCHEN ACOUSTIC ARRAY", originX, originY + 22);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    speakers,
    steeredAngle,
    targetAngle,
    targetTableId,
    isAligned,
    isDelivering,
    isDelivered,
    dishEmoji,
  ]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-signal/25 bg-[oklch(0.14_0.03_250)] p-4 shadow-inner",
        className,
      )}
    >
      {/* Top HUD Badges */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2 font-mono text-[9px] text-signal/80 uppercase">
        <span className="flex h-2 w-2 rounded-full bg-signal animate-ping" />
        <span>Restaurant Dining Room Radar</span>
      </div>

      <div className="absolute top-3 right-4 z-10 flex items-center gap-2 font-mono text-[10px]">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-bold uppercase tracking-wider",
            isAligned
              ? "border-signal-alt/60 bg-signal-alt/20 text-signal-alt"
              : "border-border bg-secondary text-muted-foreground",
          )}
        >
          {isAligned ? "🎯 Locked on Table" : "Steering Beam..."}
        </span>
      </div>

      <canvas ref={canvasRef} width={520} height={340} className="w-full max-w-xl h-auto" />

      {/* Legend Footer */}
      <div className="mt-2 flex flex-wrap items-center justify-between w-full border-t border-border/40 pt-2 font-mono text-[9px] text-muted-foreground uppercase">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-signal-alt" />
            <span>Target Table</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            <span>Sidelobe Spillover Risk</span>
          </span>
        </div>
        <span>Acoustic Waveguide Mode</span>
      </div>
    </div>
  );
}
