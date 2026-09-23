import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Package, ArrowRight, UtensilsCrossed, LogOut } from "lucide-react";

import kitchenBg from "@/assets/kitchen-bg.jpg";
import { ChefFourier } from "@/components/game/ChefFourier";
import { LogoutModal } from "@/components/game/LogoutModal";
import { GameButton } from "@/components/game/GameButton";
import { useChefName } from "@/lib/recipes";

export const Route = createFileRoute("/kitchen-hub")({
  head: () => ({
    meta: [
      { title: "Kitchen Hub — WaveBakery" },
      {
        name: "description",
        content:
          "Your culinary home base in WaveBakery: open your recipe book to select a dish or enter the pantry to inspect ingredient signals.",
      },
      { property: "og:title", content: "Kitchen Hub — WaveBakery" },
      {
        property: "og:description",
        content: "Open your recipe book or inspect ingredient signals in the pantry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KitchenHubScreen,
});

function KitchenHubScreen() {
  const [chefName] = useChefName();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onLoggedOut={() => navigate({ to: "/menu" })}
      />

      {/* Background Room Imagery & Warm Atmosphere */}
      <img
        src={kitchenBg}
        alt="Warm cozy kitchen"
        width={1920}
        height={1088}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(110deg,oklch(0.16_0.03_250/92%)_0%,oklch(0.22_0.05_45/70%)_50%,oklch(0.18_0.04_250/88%)_100%)]"
        aria-hidden
      />
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-15" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-6 py-8 sm:px-10 lg:py-10">
        {/* Top Header & Navigation */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-6 backdrop-blur-xs">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/menu">
                <GameButton variant="secondary" size="sm" className="font-mono text-xs uppercase">
                  ← Main Menu
                </GameButton>
              </Link>
              {chefName && (
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 pl-3 pr-1.5 py-1 font-mono text-[11px] font-bold text-primary uppercase shadow-xs">
                  <span>👨‍🍳 Chef {chefName}</span>
                  <button
                    type="button"
                    onClick={() => setIsLogoutModalOpen(true)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/25 text-primary hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                    title="Log Out / Switch Chef"
                    aria-label="Log Out"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-signal drop-shadow-md sm:text-5xl">
              KITCHEN <span className="text-gradient-warm">HUB</span>
            </h1>
            <p className="mt-1 font-mono text-xs tracking-[0.24em] text-lab-foreground/75 uppercase">
              Your home base between signal-processing labs
            </p>
          </div>

          <div className="flex items-center gap-3">
            {chefName && (
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3.5 py-1.5 font-mono text-xs font-bold text-rose-400 uppercase transition-all hover:bg-rose-500 hover:text-white cursor-pointer shadow-xs active:scale-95"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            )}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 font-mono text-[11px] text-muted-foreground uppercase shadow-md backdrop-blur-md">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              <span>Select a destination to continue</span>
            </div>
          </div>
        </header>

        {/* Main Kitchen Scene: Counter with Recipe Book + Pantry Door */}
        <section
          aria-label="Kitchen Destinations"
          className="my-auto grid items-center gap-8 py-8 lg:grid-cols-2 lg:gap-12"
        >
          {/* ================= DESTINATION 1: RECIPE BOOK ON COUNTER ================= */}
          <div className="flex flex-col items-center">
            {/* Hardwood Countertop Island */}
            <div className="relative w-full max-w-md rounded-[2.5rem] border-4 border-[oklch(0.55_0.07_45)] dark:border-border bg-[linear-gradient(180deg,oklch(0.93_0.03_85),oklch(0.82_0.04_72))] dark:bg-[linear-gradient(180deg,oklch(0.24_0.035_255),oklch(0.18_0.03_255))] p-6 sm:p-8 shadow-[0_24px_50px_-15px_rgba(0,0,0,0.6),0_8px_0_oklch(0.42_0.07_38)] dark:shadow-[0_24px_50px_-15px_rgba(0,0,0,0.8),0_8px_0_oklch(0.12_0.02_255)]">
              {/* Countertop woodgrain subtle texture */}
              <div
                className="absolute inset-x-4 top-2 h-1 rounded-full bg-white/40 dark:bg-white/15 opacity-70"
                aria-hidden
              />


              {/* Physical Hardbound Recipe Book Resting On Top */}
              <Link to="/recipe-book" className="group block cursor-pointer focus:outline-none">
                <div className="relative rounded-2xl border-3 border-[oklch(0.68_0.09_55)] bg-[linear-gradient(135deg,oklch(0.54_0.08_45),oklch(0.42_0.07_38))] p-6 shadow-2xl transition-all duration-200 group-hover:-translate-y-1.5 group-hover:scale-[1.02] group-hover:shadow-[0_20px_40px_rgba(235,160,50,0.35)]">
                  {/* Decorative Bookmark Ribbon hanging from pages */}
                  <div
                    className="pointer-events-none absolute -top-3 right-8 z-20 h-14 w-6 rounded-b-md bg-[image:var(--gradient-warm)] shadow-md transition-transform duration-200 group-hover:translate-y-1"
                    aria-hidden
                  />

                  {/* Faux Page Leaves Edge */}
                  <div
                    className="absolute -bottom-2.5 inset-x-6 h-2 rounded-b-md border-b-2 border-r-2 border-l-2 border-[oklch(0.5_0.07_45)] bg-[oklch(0.95_0.02_88)] shadow-inner"
                    aria-hidden
                  />

                  {/* Book Cover Content Plaque */}
                  <div className="rounded-xl border border-[oklch(0.7_0.1_65)]/60 bg-[oklch(0.35_0.06_36)]/90 p-5 text-center backdrop-blur-xs">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/50 bg-primary/20 text-primary shadow-inner transition-transform duration-200 group-hover:scale-110">
                      <BookOpen className="h-7 w-7" />
                    </div>

                    <p className="mt-4 font-mono text-[10px] font-extrabold tracking-[0.3em] text-primary uppercase">
                      Cookbook Volume 1
                    </p>
                    <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground uppercase drop-shadow-sm sm:text-4xl">
                      RECIPE BOOK
                    </h2>

                    <p className="mt-2 text-sm font-semibold text-muted-foreground">
                      Browse master recipes, study target signal waveforms, and choose a dish to
                      cook.
                    </p>

                    <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-4 py-2 font-display text-sm font-extrabold tracking-wider text-primary uppercase shadow-xs transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                      <span>Open Recipe Book</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>

              {/* Counter Label */}
              <p className="mt-4 text-center font-mono text-[10px] tracking-[0.25em] text-[oklch(0.42_0.07_38)] uppercase font-extrabold">
                Kitchen Prep Counter
              </p>
            </div>
          </div>

          {/* ================= DESTINATION 2: PANTRY DOOR ================= */}
          <div className="flex flex-col items-center">
            {/* Arched Architectural Doorframe */}
            <div className="w-full max-w-md">
              <Link to="/pantry" className="group block cursor-pointer focus:outline-none">
                <div className="relative overflow-hidden rounded-t-[5rem] rounded-b-2xl border-4 border-[oklch(0.52_0.07_42)] bg-[linear-gradient(180deg,oklch(0.36_0.06_36),oklch(0.25_0.05_30))] p-6 sm:p-8 shadow-[0_24px_50px_-15px_rgba(0,0,0,0.6),0_8px_0_oklch(0.2_0.04_28)] transition-all duration-200 group-hover:-translate-y-1.5 group-hover:scale-[1.02] group-hover:shadow-[0_20px_40px_rgba(80,220,240,0.3)]">
                  {/* Frosted Transom Arch with Warm Backlight */}
                  <div className="mx-auto mb-6 flex h-20 w-44 items-center justify-center rounded-t-[4rem] border-2 border-[oklch(0.55_0.06_45)] bg-[radial-gradient(ellipse_at_bottom,oklch(0.88_0.11_78/55%),oklch(0.25_0.05_30/80%))] shadow-inner transition-colors group-hover:bg-[radial-gradient(ellipse_at_bottom,oklch(0.92_0.14_80/75%),oklch(0.28_0.06_32/80%))]">
                    <span className="font-mono text-[10px] font-extrabold tracking-[0.3em] text-primary uppercase">
                      Stockroom
                    </span>
                  </div>

                  {/* Brass Door Plaque */}
                  <div className="mx-auto max-w-xs rounded-xl border-2 border-[oklch(0.75_0.12_65)] bg-[linear-gradient(135deg,oklch(0.48_0.09_48),oklch(0.36_0.07_38))] p-4 text-center shadow-lg transition-transform duration-200 group-hover:scale-105">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[oklch(0.75_0.12_65)] bg-primary/20 text-primary shadow-xs">
                      <Package className="h-6 w-6" />
                    </div>
                    <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground uppercase drop-shadow-xs sm:text-3xl">
                      PANTRY
                    </h2>
                  </div>

                  {/* Door Panels & Brass Knob */}
                  <div className="relative mt-6 rounded-xl border border-white/10 bg-black/20 p-5 text-center">
                    {/* Brass Door Handle / Knob */}
                    <div
                      className="absolute top-1/2 right-4 h-10 w-3.5 -translate-y-1/2 rounded-full border border-[oklch(0.8_0.14_70)] bg-[linear-gradient(180deg,oklch(0.85_0.14_75),oklch(0.65_0.12_60))] shadow-md transition-transform group-hover:scale-110"
                      aria-hidden
                    />

                    <p className="pr-4 text-sm font-semibold text-muted-foreground">
                      Inspect raw ingredient frequencies, clean vs. noisy spectra, and listen to
                      pure time-domain waveforms.
                    </p>

                    <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-signal/40 bg-signal/15 px-4 py-2 font-display text-sm font-extrabold tracking-wider text-signal uppercase shadow-xs transition-all group-hover:bg-signal group-hover:text-background">
                      <span>Enter Pantry</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>

              {/* Doorframe Label */}
              <p className="mt-4 text-center font-mono text-[10px] tracking-[0.25em] text-[oklch(0.42_0.07_38)] uppercase font-extrabold">
                Ingredient Reserve
              </p>
            </div>
          </div>
        </section>

        {/* Footer with Chef Fourier guidance */}
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-6 border-t border-border/50 pt-4 backdrop-blur-xs">
          <ChefFourier
            size="sm"
            float={false}
            message={
              chefName
                ? `Welcome to your kitchen, Chef ${chefName}! Review the recipe book on the counter to pick a dish, or step into the pantry to inspect raw ingredient signals.`
                : "Welcome to your kitchen, Chef! Review the recipe book on the counter to pick a dish, or step into the pantry to inspect raw ingredient signals."
            }
          />

          <div className="flex items-center gap-3">
            <Link to="/labs">
              <GameButton variant="ghost" size="sm" className="font-mono text-xs uppercase">
                Signal Playground ⚡
              </GameButton>
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
