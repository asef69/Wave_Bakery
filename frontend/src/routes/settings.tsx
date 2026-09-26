import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { ChefNameModal } from "@/components/game/ChefNameModal";
import { LogoutModal } from "@/components/game/LogoutModal";
import { GameButton } from "@/components/game/GameButton";
import { useChefName } from "@/lib/recipes";
import { useSoundSettings } from "@/lib/sound";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WaveBakery" },
      {
        name: "description",
        content:
          "Fine-tune your kitchen experience: audio levels, gameplay hints, and display preferences.",
      },
      { property: "og:title", content: "Settings — WaveBakery" },
      { property: "og:description", content: "Fine-tune your kitchen experience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsScreen,
});

type SettingsState = {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  chefTips: boolean;
  tutorialHints: boolean;
  fullscreen: boolean;
  reducedMotion: boolean;
};

const defaultSettings: SettingsState = {
  masterVolume: 80,
  sfxVolume: 70,
  musicVolume: 60,
  chefTips: true,
  tutorialHints: true,
  fullscreen: false,
  reducedMotion: false,
};

function SettingsScreen() {
  const [soundSettings, setSoundSettings] = useSoundSettings();
  const [settings, setSettings] = useState<SettingsState>(() => ({
    ...defaultSettings,
    masterVolume: soundSettings.volume,
  }));
  const [showResetNotice, setShowResetNotice] = useState(false);
  const [chefName, saveChefName] = useChefName();
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [theme, setTheme] = useTheme();

  // Sync external volume updates
  useEffect(() => {
    setSettings((prev) =>
      prev.masterVolume !== soundSettings.volume
        ? { ...prev, masterVolume: soundSettings.volume }
        : prev,
    );
  }, [soundSettings.volume]);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (key === "masterVolume") {
      setSoundSettings({ volume: Number(value) });
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setSoundSettings({ volume: 80, soundEnabled: true });
    setTheme("light");
    setShowResetNotice(true);
    setTimeout(() => setShowResetNotice(false), 3000);
  };

  return (
    <main className="relative min-h-screen bg-background pb-16">
      <ChefNameModal
        isOpen={isNameModalOpen}
        onClose={() => setIsNameModalOpen(false)}
        onConfirm={(name) => {
          saveChefName(name);
          setIsNameModalOpen(false);
        }}
        currentName={chefName}
        allowCancel={true}
      />

      <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} />

      <div className="lab-grid pointer-events-none absolute inset-0 opacity-[0.06]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-8 sm:px-10">
        {/* HEADER */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border/80 pb-6">
          <div>
            <Link to="/menu" className="w-fit">
              <GameButton variant="ghost" size="sm">
                ← Back to Main Menu
              </GameButton>
            </Link>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              SETT<span className="text-gradient-warm">INGS</span>
            </h1>
            <p className="mt-1 text-base font-semibold text-muted-foreground">
              Fine-tune your kitchen experience.
            </p>
          </div>

          <div className="flex flex-col items-end">
            <ChefFourier
              size="sm"
              float={false}
              bubbleSide="left"
              message="Everything looks good, Chef! Adjust anything you need."
            />
          </div>
        </header>

        {/* RESET CONFIRMATION TOAST */}
        {showResetNotice ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-signal/40 bg-signal/15 px-4 py-2.5 font-mono text-xs font-bold text-signal-alt shadow-sm">
            <span>✓ All settings restored to default values.</span>
            <button
              onClick={() => setShowResetNotice(false)}
              className="text-signal hover:underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* SETTINGS CARDS */}
        <div className="mt-8 space-y-6">
          {/* 0. CHEF PROFILE CARD */}
          <section className="kitchen-card p-6 sm:p-8">
            <div className="flex items-center gap-3 border-b border-border/70 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary font-mono text-xl shadow-inner">
                👨‍🍳
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Player Identity
                </p>
                <h2 className="font-display text-2xl font-extrabold text-foreground uppercase">
                  Chef Profile
                </h2>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  Current Chef Name
                </p>
                <p className="font-display text-2xl font-extrabold text-foreground">
                  {chefName ? `Chef ${chefName}` : "No Chef Name Set"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Displayed on your completed recipe scorecards and leaderboards.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <GameButton
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsNameModalOpen(true)}
                  className="uppercase tracking-wider font-bold"
                >
                  Change Chef Name
                </GameButton>

                {chefName && (
                  <button
                    type="button"
                    onClick={() => setIsLogoutModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 font-mono text-xs font-bold text-rose-500 uppercase transition-all hover:bg-rose-500 hover:text-white cursor-pointer active:scale-95"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 1. AUDIO CARD */}
          <section className="kitchen-card p-6 sm:p-8">
            <div className="flex items-center gap-3 border-b border-border/70 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary font-mono text-xl shadow-inner">
                🔊
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Sound Controls
                </p>
                <h2 className="font-display text-2xl font-extrabold text-foreground uppercase">
                  Audio
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {/* Master Volume */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="masterVolume"
                    className="font-display text-sm font-extrabold text-foreground uppercase"
                  >
                    Master Volume
                  </label>
                  <span className="font-mono text-xs font-bold text-primary">
                    {settings.masterVolume}%
                  </span>
                </div>
                <input
                  id="masterVolume"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.masterVolume}
                  onChange={(e) => updateSetting("masterVolume", Number(e.target.value))}
                  className="mt-2 h-2.5 w-full cursor-grab rounded-full accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
                />
              </div>

              {/* Sound Effects */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="sfxVolume"
                    className="font-display text-sm font-extrabold text-foreground uppercase"
                  >
                    Sound Effects
                  </label>
                  <span className="font-mono text-xs font-bold text-primary">
                    {settings.sfxVolume}%
                  </span>
                </div>
                <input
                  id="sfxVolume"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.sfxVolume}
                  onChange={(e) => updateSetting("sfxVolume", Number(e.target.value))}
                  className="mt-2 h-2.5 w-full cursor-grab rounded-full accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
                />
              </div>

              {/* Music */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="musicVolume"
                    className="font-display text-sm font-extrabold text-foreground uppercase"
                  >
                    Music
                  </label>
                  <span className="font-mono text-xs font-bold text-primary">
                    {settings.musicVolume}%
                  </span>
                </div>
                <input
                  id="musicVolume"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.musicVolume}
                  onChange={(e) => updateSetting("musicVolume", Number(e.target.value))}
                  className="mt-2 h-2.5 w-full cursor-grab rounded-full accent-[oklch(0.72_0.17_50)] active:cursor-grabbing"
                />
              </div>
            </div>
          </section>

          {/* 2. GAMEPLAY CARD */}
          <section className="kitchen-card p-6 sm:p-8">
            <div className="flex items-center gap-3 border-b border-border/70 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary font-mono text-xl shadow-inner">
                🎮
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Assistance & Guidance
                </p>
                <h2 className="font-display text-2xl font-extrabold text-foreground uppercase">
                  Gameplay
                </h2>
              </div>
            </div>

            <div className="mt-6 divide-y divide-border/60 space-y-5">
              {/* Chef Fourier Tips */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="max-w-md">
                  <p className="font-display text-base font-extrabold text-foreground uppercase">
                    Chef Fourier Tips
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Show helpful guidance during each signal-processing stage.
                  </p>
                </div>
                <button
                  onClick={() => updateSetting("chefTips", !settings.chefTips)}
                  className={cn(
                    "flex h-9 w-20 items-center justify-center rounded-xl font-mono text-xs font-extrabold uppercase transition-all duration-150 cursor-pointer",
                    settings.chefTips
                      ? "bg-[image:var(--gradient-warm)] text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                      : "border border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {settings.chefTips ? "ON" : "OFF"}
                </button>
              </div>

              {/* Tutorial Hints */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
                <div className="max-w-md">
                  <p className="font-display text-base font-extrabold text-foreground uppercase">
                    Tutorial Hints
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Show short explanations while learning the game.
                  </p>
                </div>
                <button
                  onClick={() => updateSetting("tutorialHints", !settings.tutorialHints)}
                  className={cn(
                    "flex h-9 w-20 items-center justify-center rounded-xl font-mono text-xs font-extrabold uppercase transition-all duration-150 cursor-pointer",
                    settings.tutorialHints
                      ? "bg-[image:var(--gradient-warm)] text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                      : "border border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {settings.tutorialHints ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </section>

          {/* 3. THEME CARD */}
          <section className="kitchen-card p-6 sm:p-8">
            <div className="flex items-center gap-3 border-b border-border/70 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary font-mono text-xl shadow-inner">
                🌓
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Atmosphere & Style
                </p>
                <h2 className="font-display text-2xl font-extrabold text-foreground uppercase">
                  Theme
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
                Choose your kitchen atmosphere. Light theme is the classic sunlit bakery, and Dark
                theme provides an electric midnight signal lab with high contrast.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Light Theme Option */}
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 cursor-pointer",
                    theme === "light"
                      ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary/60",
                  )}
                  aria-pressed={theme === "light"}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono text-2xl shadow-sm transition-all",
                      theme === "light"
                        ? "bg-[image:var(--gradient-warm)] text-primary-foreground scale-105"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    ☀️
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-base sm:text-lg font-extrabold text-foreground">
                        Light Theme
                      </span>
                      {theme === "light" ? (
                        <span className="rounded-full bg-primary px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-primary-foreground uppercase shadow-xs">
                          Active
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Classic warm kitchen with bright surfaces and signature copper accents.
                    </p>
                  </div>
                </button>

                {/* Dark Theme Option */}
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 cursor-pointer",
                    theme === "dark"
                      ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary/60",
                  )}
                  aria-pressed={theme === "dark"}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono text-2xl shadow-sm transition-all",
                      theme === "dark"
                        ? "bg-[image:var(--gradient-warm)] text-primary-foreground scale-105"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    🌙
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-base sm:text-lg font-extrabold text-foreground">
                        Dark Theme
                      </span>
                      {theme === "dark" ? (
                        <span className="rounded-full bg-primary px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-primary-foreground uppercase shadow-xs">
                          Active
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                          Select
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Midnight slate kitchen with luminous signal traces and low eye strain.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </section>

          {/* 4. DISPLAY CARD */}
          <section className="kitchen-card p-6 sm:p-8">
            <div className="flex items-center gap-3 border-b border-border/70 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary font-mono text-xl shadow-inner">
                🖥️
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-primary uppercase">
                  Visual Preferences
                </p>
                <h2 className="font-display text-2xl font-extrabold text-foreground uppercase">
                  Display
                </h2>
              </div>
            </div>

            <div className="mt-6 divide-y divide-border/60 space-y-5">
              {/* Fullscreen */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="max-w-md">
                  <p className="font-display text-base font-extrabold text-foreground uppercase">
                    Fullscreen
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Display WaveBakery in fullscreen mode.
                  </p>
                </div>
                <button
                  onClick={() => updateSetting("fullscreen", !settings.fullscreen)}
                  className={cn(
                    "flex h-9 w-20 items-center justify-center rounded-xl font-mono text-xs font-extrabold uppercase transition-all duration-150 cursor-pointer",
                    settings.fullscreen
                      ? "bg-[image:var(--gradient-warm)] text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                      : "border border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {settings.fullscreen ? "ON" : "OFF"}
                </button>
              </div>

              {/* Reduced Motion */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
                <div className="max-w-md">
                  <p className="font-display text-base font-extrabold text-foreground uppercase">
                    Reduced Motion
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Reduce decorative animations and waveform movement.
                  </p>
                </div>
                <button
                  onClick={() => updateSetting("reducedMotion", !settings.reducedMotion)}
                  className={cn(
                    "flex h-9 w-20 items-center justify-center rounded-xl font-mono text-xs font-extrabold uppercase transition-all duration-150 cursor-pointer",
                    settings.reducedMotion
                      ? "bg-[image:var(--gradient-warm)] text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                      : "border border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {settings.reducedMotion ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* CHEF FOURIER TIP CARD */}
        <section className="mt-8 rounded-3xl border border-primary/30 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-3xl" aria-hidden>
              👨‍🍳
            </span>
            <p className="font-display text-base font-bold text-foreground">
              "Your settings won't change the science. They just make the kitchen more comfortable!"
            </p>
          </div>
        </section>

        {/* BOTTOM NAVIGATION & ACTIONS */}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/80 pt-6">
          <Link to="/menu">
            <GameButton variant="secondary" size="lg" className="uppercase">
              ← Back to Menu
            </GameButton>
          </Link>

          <GameButton
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="font-mono text-xs text-muted-foreground hover:text-foreground uppercase"
          >
            ↻ Reset Settings
          </GameButton>
        </footer>
      </div>
    </main>
  );
}
