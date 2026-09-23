import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WaveBakery — Cook. Process. Create." },
      {
        name: "description",
        content:
          "WaveBakery is a cooking game where you prepare recipes with signal-processing tools: filtering, mixing, scaling, shifting and convolution.",
      },
      { property: "og:title", content: "WaveBakery — Cook. Process. Create." },
      {
        property: "og:description",
        content: "Cook recipes by filtering, mixing and convolving signals with Chef Fourier.",
      },
    ],
  }),
  component: LoadingScreen,
});

const steps = [
  "Calibrating the kitchen...",
  "Warming up the signal lab...",
  "Preparing your ingredients...",
  "Tuning the instruments...",
];

function LoadingScreen() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(4);

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((p) => (p >= 100 ? 100 : p + 2));
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (progress < 100) return;
    const id = window.setTimeout(() => navigate({ to: "/menu" }), 500);
    return () => window.clearTimeout(id);
  }, [progress, navigate]);

  const step = steps[Math.min(steps.length - 1, Math.floor(progress / (100 / steps.length)))];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[image:var(--gradient-lab)] px-8">
      <div className="lab-grid absolute inset-0 opacity-25" aria-hidden />
      <div
        className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--primary-glow),transparent_65%)] opacity-25 blur-2xl"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8 text-center">
        <div>
          <h1 className="font-display text-6xl font-extrabold tracking-tight text-signal drop-shadow-[0_0_28px_rgba(80,220,240,0.4)]">
            WAVE<span className="text-gradient-warm">BAKERY</span>
          </h1>
          <p className="mt-2 font-mono text-xs tracking-[0.42em] text-lab-foreground/70 uppercase">
            Cook. Process. Create.
          </p>
        </div>

        <ChefFourier size="sm" message="Ovens on. Let's bake some signals!" />

        <WaveformDisplay className="w-full" label="input signal" />

        <div className="w-full max-w-md">
          <div className="h-3 w-full overflow-hidden rounded-full bg-lab-grid/40">
            <div
              className="h-full rounded-full bg-[image:linear-gradient(to_right,var(--signal-alt),var(--signal))] transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-xs text-lab-foreground/70">
            <span className="animate-pulse-glow">{step}</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </main>
  );
}
