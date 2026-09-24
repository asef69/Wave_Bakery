import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, HelpCircle, LogOut, Settings as SettingsIcon, Trophy } from "lucide-react";

import kitchenBg from "@/assets/kitchen-bg.jpg";
import { ChefAuthModal } from "@/components/game/ChefAuthModal";
import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { WaveformDisplay } from "@/components/game/WaveformDisplay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useChefName } from "@/lib/recipes";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Main Menu — WaveBakery" },
      {
        name: "description",
        content:
          "Start cooking with signals, browse the recipe book, or learn how to play WaveBakery with Chef Fourier.",
      },
      { property: "og:title", content: "Main Menu — WaveBakery" },
      {
        property: "og:description",
        content: "Start cooking with signals or learn how to play WaveBakery.",
      },
    ],
  }),
  component: MainMenu,
});

const navIcons = [
  { label: "Recipe Book", to: "/recipe-book" as const, icon: BookOpen },
  { label: "Leaderboard", to: "/leaderboard" as const, icon: Trophy },
  { label: "How to Play", to: "/how-to-play" as const, icon: HelpCircle },
  { label: "Settings", to: "/settings" as const, icon: SettingsIcon },
];

function MainMenu() {
  const [chefName] = useChefName();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleEnterKitchen = () => {
    if (!chefName) {
      setIsAuthModalOpen(true);
    } else {
      navigate({ to: "/kitchen-hub" });
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <main className="relative min-h-screen overflow-hidden">
        <ChefAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => navigate({ to: "/kitchen-hub" })}
        />

        {/* TOP-RIGHT UTILITY HUD ICON CLUSTER */}
        <nav
          aria-label="Quick Navigation"
          className="absolute top-6 right-6 z-20 flex items-center gap-1.5 rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-lg shadow-black/20 backdrop-blur-md sm:top-8 sm:right-10"
        >
          {navIcons.map(({ label, to, icon: Icon }) => (
            <Tooltip key={to}>
              <TooltipTrigger asChild>
                <Link
                  to={to}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-secondary/80 text-muted-foreground transition-all duration-150 hover:scale-105 hover:border-primary/50 hover:bg-primary/15 hover:text-primary active:scale-95 cursor-pointer sm:h-11 sm:w-11"
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={8}
                className="border border-border/90 bg-card px-3 py-1.5 font-mono text-xs font-bold text-foreground shadow-xl tracking-wider"
              >
                {label}
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Dedicated Log Out Button in top bar if signed in */}
          {chefName && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  aria-label="Chef Profile"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary transition-all duration-150 hover:scale-105 hover:border-primary hover:bg-primary hover:text-white active:scale-95 cursor-pointer sm:h-11 sm:w-11"
                >
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={8}
                className="border border-primary/50 bg-card px-3 py-1.5 font-mono text-xs font-bold text-primary shadow-xl tracking-wider"
              >
                Profile / Switch Chef ({chefName})
              </TooltipContent>
            </Tooltip>
          )}
        </nav>

        <img
          src={kitchenBg}
          alt="Warm futuristic kitchen with glowing signal displays"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(105deg,oklch(0.18_0.03_255/85%)_0%,oklch(0.24_0.05_40/55%)_55%,oklch(0.2_0.04_250/70%)_100%)]"
          aria-hidden
        />
        <div className="lab-grid absolute inset-0 opacity-15" aria-hidden />

        <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-10 px-12 py-14 lg:grid-cols-[1.05fr_0.95fr]">
          <section>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-signal/40 bg-lab/70 px-4 py-1.5 font-mono text-[11px] tracking-[0.28em] text-signal uppercase">
                Signals &amp; Linear Systems
              </span>
              {chefName && (
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 pl-3 pr-1.5 py-1 font-mono text-[11px] font-bold text-primary uppercase shadow-xs">
                  <span>👨‍🍳 Chef {chefName}</span>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/25 text-primary hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                    title="Log Out / Switch Chef"
                    aria-label="Log Out"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            <h1 className="mt-6 font-display text-7xl leading-[0.95] font-extrabold tracking-tight text-signal drop-shadow-[0_0_36px_rgba(80,220,240,0.35)] xl:text-8xl">
              WAVE
              <span className="text-gradient-warm">BAKERY</span>
            </h1>
            <p className="mt-4 font-display text-2xl font-bold text-primary-glow">
              Cook. Process. Create.
            </p>
            <p className="mt-4 max-w-xl text-lg text-lab-foreground/80">
              Filter, mix, scale, shift and convolve your ingredients. Every dish is a signal
              waiting to be plated.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <GameButton
                size="lg"
                onClick={handleEnterKitchen}
                className="uppercase text-base font-extrabold tracking-wider cursor-pointer"
              >
                Enter Kitchen
              </GameButton>
              <Link to="/labs">
                <GameButton
                  size="lg"
                  variant="lab"
                  className="uppercase text-base font-extrabold tracking-wider"
                >
                  Signal Playground ⚡
                </GameButton>
              </Link>
            </div>

            <WaveformDisplay
              className="mt-12 max-w-xl"
              label="today's flavour spectrum"
              variant="spectrum"
            />
          </section>

          <section className="flex justify-center lg:justify-end">
            <ChefFourier
              size="lg"
              bubbleSide="left"
              message={
                chefName
                  ? `Welcome back, Chef ${chefName}! Ready to process some signals?`
                  : "Ready to cook something... scientifically?"
              }
            />
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
