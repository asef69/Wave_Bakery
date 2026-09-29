import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const gameButtonVariants = cva(
  "inline-flex max-w-full items-center justify-center gap-2 rounded-full text-center leading-tight font-display font-bold tracking-wide transition-all duration-200 outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 active:translate-y-[2px]",
  {
    variants: {
      variant: {
        primary:
          "bg-[image:var(--gradient-warm)] text-primary-foreground border-2 border-[oklch(0.32_0.08_40)] shadow-[0_6px_0_oklch(0.32_0.08_40),var(--shadow-card)] hover:shadow-[0_4px_0_oklch(0.32_0.08_40),var(--shadow-warm-glow)] hover:-translate-y-0.5 active:shadow-[0_2px_0_oklch(0.32_0.08_40)]",
        secondary:
          "bg-card text-secondary-foreground border-2 border-border shadow-[0_5px_0_var(--border)] hover:border-primary/60 hover:bg-secondary hover:-translate-y-0.5 active:shadow-[0_2px_0_var(--border)]",
        lab: "lab-panel text-signal border border-signal/40 hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary",
      },
      size: {
        sm: "min-h-10 px-5 py-1.5 text-sm",
        md: "min-h-12 px-5 py-2 text-base sm:px-7",
        lg: "min-h-14 px-7 py-2 text-lg sm:min-h-16 sm:px-12 sm:text-xl",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type GameButtonProps = ComponentProps<"button"> & VariantProps<typeof gameButtonVariants>;

export function GameButton({ className, variant, size, ...props }: GameButtonProps) {
  return <button className={cn(gameButtonVariants({ variant, size }), className)} {...props} />;
}
