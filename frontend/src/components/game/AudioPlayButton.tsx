import { useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { GameButton } from "./GameButton";
import { cn } from "@/lib/utils";

interface AudioPlayButtonProps {
  onPlay: () => void;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}

export function AudioPlayButton({
  onPlay,
  label = "Listen",
  size = "sm",
  variant = "secondary",
  className,
}: AudioPlayButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleClick = () => {
    setIsPlaying(true);
    try {
      onPlay();
    } catch {
      // ignore
    }
    setTimeout(() => {
      setIsPlaying(false);
    }, 1000);
  };

  return (
    <GameButton
      size={size}
      variant={variant}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs uppercase cursor-pointer transition-all",
        isPlaying && "ring-2 ring-primary bg-primary/20 text-primary animate-pulse",
        className
      )}
    >
      {isPlaying ? (
        <Volume2 className="h-3.5 w-3.5 text-primary animate-bounce" />
      ) : (
        <Play className="h-3.5 w-3.5 fill-current" />
      )}
      <span>{isPlaying ? "Playing..." : label}</span>
    </GameButton>
  );
}

