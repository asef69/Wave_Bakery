import { useEffect, useState } from "react";
import {
  Award,
  ChefHat,
  Check,
  LogIn,
  LogOut,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { ChefFourier } from "@/components/game/ChefFourier";
import { GameButton } from "@/components/game/GameButton";
import { api } from "@/lib/api";
import { formatChefDisplayName } from "@/lib/leaderboard";
import { MAX_CHEF_NAME_LENGTH, logoutChef, setChefName, useChefName } from "@/lib/recipes";
import { cn } from "@/lib/utils";

interface ChefAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess?: (handle: string) => void;
  defaultTab?: "profile" | "switch" | "register";
}

interface ChefProfileData {
  id: string;
  handle: string;
  points: number;
  unlocked_tier: number;
  rank_title: string;
  rank_emoji?: string;
  next_rank?: string;
  points_to_next?: number;
  dishes_served: number;
  best_scores: Record<string, number>;
}

interface ChefSummary {
  id: string;
  handle: string;
  points: number;
  unlocked_tier: number;
  rank_title: string;
  rank_emoji: string;
  dishes_served: number;
  created_at: string;
}

export function ChefAuthModal({ isOpen, onClose, onSuccess, defaultTab }: ChefAuthModalProps) {
  const [currentChef, setLocalChefName] = useChefName();
  const [activeTab, setActiveTab] = useState<"profile" | "switch" | "register">("profile");

  const [inputHandle, setInputHandle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ChefProfileData | null>(null);
  const [chefList, setChefList] = useState<ChefSummary[]>([]);

  // Synchronize active tab based on presence of currentChef
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (defaultTab) {
        setActiveTab(defaultTab);
      } else if (currentChef) {
        setActiveTab("profile");
      } else {
        setActiveTab("register");
      }
      loadProfileAndList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentChef, defaultTab]);

  const loadProfileAndList = async () => {
    setIsLoading(true);
    try {
      if (api.getToken() || currentChef) {
        const me = await api.getPlayerMe().catch(() => null);
        if (me) setProfileData(me);
      }
      const list = await api.listChefs(30).catch(() => []);
      setChefList(list);
    } catch {
      // offline fallback
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleClose = () => {
    setErrorMessage(null);
    onClose?.();
  };

  const handleRegisterOrLogin = async (handleToAuth?: string) => {
    const handle = (handleToAuth ?? inputHandle).trim();
    if (!handle) {
      setErrorMessage("Please enter a chef name.");
      return;
    }
    if (handle.length > MAX_CHEF_NAME_LENGTH) {
      setErrorMessage(`Chef handle must be ${MAX_CHEF_NAME_LENGTH} characters or less.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.authOrRegisterPlayer(handle);
      setChefName(res.handle);
      setLocalChefName(res.handle);
      setInputHandle("");
      onSuccess?.(res.handle);
      handleClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Failed to authenticate chef.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchChef = async (chef: ChefSummary) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.authOrRegisterPlayer(chef.handle);
      setChefName(res.handle);
      setLocalChefName(res.handle);
      onSuccess?.(res.handle);
      handleClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Failed to switch chef.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    api.logoutPlayer();
    logoutChef();
    setProfileData(null);
    setActiveTab("register");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chef-auth-title"
    >
      <div className="kitchen-card relative w-full max-w-xl border-2 border-border bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-border/70 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-inner">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-primary uppercase">
                Culinary Identity
              </span>
            </div>
            <h2
              id="chef-auth-title"
              className="font-display text-2xl font-extrabold uppercase text-foreground"
            >
              CHEF HEADQUARTERS
            </h2>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="mt-5 flex gap-2 border-b border-border/60 pb-3">
          {currentChef && (
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 font-display text-xs font-extrabold uppercase transition-all cursor-pointer",
                activeTab === "profile"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <ChefHat className="h-3.5 w-3.5" />
              <span>Active Profile</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("switch")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 font-display text-xs font-extrabold uppercase transition-all cursor-pointer",
              activeTab === "switch"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Switch Chef</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("register")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 font-display text-xs font-extrabold uppercase transition-all cursor-pointer",
              activeTab === "register"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>New / Sign In</span>
          </button>
        </div>

        {/* TAB 1: ACTIVE PROFILE */}
        {activeTab === "profile" && currentChef && (
          <div className="mt-5 space-y-5 animate-in fade-in duration-150">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Authenticated Chef
                  </p>
                  <h3 className="font-display text-2xl font-extrabold text-foreground">
                    {formatChefDisplayName(currentChef)}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                      {profileData?.rank_emoji ?? "👨‍🍳"} {profileData?.rank_title ?? "Sous Chef"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      Tier {profileData?.unlocked_tier ?? 1} Access
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    Culinary Points
                  </span>
                  <span className="font-display text-3xl font-black text-gradient-warm">
                    {profileData?.points ?? 0}
                  </span>
                </div>
              </div>

              {/* Progress to next rank */}
              {profileData?.next_rank && profileData?.points_to_next && (
                <div className="mt-4 border-t border-primary/20 pt-3">
                  <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                    <span>Next Rank: {profileData.next_rank}</span>
                    <span>{profileData.points_to_next} pts needed</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-[image:var(--gradient-warm)]"
                      style={{
                        width: `${Math.min(100, Math.max(10, ((profileData.points % 1000) / 1000) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">
                  Dishes Served
                </p>
                <p className="font-display text-xl font-extrabold text-foreground">
                  {profileData?.dishes_served ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">
                  Tiers Unlocked
                </p>
                <p className="font-display text-xl font-extrabold text-primary">
                  {profileData?.unlocked_tier ?? 1} / 3
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-border bg-secondary/40 p-3 text-center sm:col-span-1">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">
                  Best Dish Score
                </p>
                <p className="font-display text-xl font-extrabold text-amber-500">
                  {profileData?.best_scores && Object.keys(profileData.best_scores).length > 0
                    ? Math.max(...Object.values(profileData.best_scores))
                    : "—"}
                </p>
              </div>
            </div>

            {/* Chef Fourier dialogue */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-secondary/50 p-3">
              <ChefFourier
                size="sm"
                float={false}
                message="Your kitchen profile is synchronized with authoritative DSP grading servers!"
              />
            </div>

            {/* Profile Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 font-mono text-xs font-bold text-destructive transition-all hover:bg-destructive/20 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out Active Profile</span>
              </button>

              <GameButton
                size="sm"
                onClick={handleClose}
                className="uppercase font-bold tracking-wider"
              >
                Back to Kitchen →
              </GameButton>
            </div>
          </div>
        )}

        {/* TAB 2: SWITCH CHEF */}
        {activeTab === "switch" && (
          <div className="mt-5 space-y-4 animate-in fade-in duration-150">
            <p className="font-mono text-xs text-muted-foreground">
              Select an existing chef roster account or switch between workstations:
            </p>

            {chefList.length > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {chefList.map((chef) => {
                  const isCurrent = currentChef?.toLowerCase() === chef.handle.toLowerCase();
                  return (
                    <div
                      key={chef.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all",
                        isCurrent
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border bg-secondary/40 hover:bg-secondary/80",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{chef.rank_emoji || "👨‍🍳"}</span>
                        <div>
                          <p className="font-display text-sm font-extrabold text-foreground">
                            {formatChefDisplayName(chef.handle)}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {chef.rank_title} · {chef.points} pts · {chef.dishes_served} dishes
                          </p>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 font-mono text-[10px] font-bold text-primary-foreground">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleSwitchChef(chef)}
                          className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95 cursor-pointer"
                        >
                          <LogIn className="h-3.5 w-3.5" />
                          <span>Switch</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <p className="font-mono text-xs text-muted-foreground">
                  No saved chef profiles found.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <GameButton
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab("register")}
                className="uppercase"
              >
                + Register New Chef
              </GameButton>
            </div>
          </div>
        )}

        {/* TAB 3: REGISTER / SIGN IN */}
        {activeTab === "register" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRegisterOrLogin();
            }}
            className="mt-5 space-y-4 animate-in fade-in duration-150"
          >
            <div>
              <label
                htmlFor="chefHandleInput"
                className="block font-mono text-[11px] font-bold text-foreground uppercase tracking-wider"
              >
                Enter Chef Name / Handle
              </label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 font-mono text-sm font-bold text-primary">
                  Chef
                </span>
                <input
                  id="chefHandleInput"
                  type="text"
                  value={inputHandle}
                  autoFocus
                  maxLength={MAX_CHEF_NAME_LENGTH}
                  placeholder="e.g. Fourier, Nyquist, Shannon"
                  onChange={(e) => {
                    setInputHandle(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full rounded-2xl border-2 border-border bg-secondary/50 py-3.5 pr-4 pl-14 font-display text-base font-extrabold text-foreground transition-all placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {errorMessage && (
                <p className="mt-2 font-mono text-xs font-semibold text-destructive">
                  ⚠️ {errorMessage}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-secondary/50 p-3">
              <ChefFourier
                size="sm"
                float={false}
                message="Your chef handle is used to record real-time DSP dish accuracy and leaderboard rankings."
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <GameButton
                type="button"
                variant="secondary"
                className="uppercase sm:w-28"
                onClick={handleClose}
              >
                Cancel
              </GameButton>

              <GameButton
                type="submit"
                disabled={!inputHandle.trim() || isLoading}
                className="uppercase flex-1 sm:flex-initial sm:min-w-40 text-base tracking-wider"
              >
                {isLoading ? "Signing In..." : "Enter Kitchen →"}
              </GameButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
