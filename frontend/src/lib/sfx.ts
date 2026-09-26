/**
 * Sound effects only: a UI click for buttons, and the cooking-process sounds
 * played while the Cooking lab's convolution slider is being dragged. Nothing
 * here reads or writes game state, signals, scores or storage.
 */
import bakingSfxUrl from "../../sounds/baking.mp3";
import boilingSfxUrl from "../../sounds/Boiling.mp3";
import fryingSfxUrl from "../../sounds/Fry.mp3";
import grillingSfxUrl from "../../sounds/Grill.mp3";

import { getSoundSettings } from "@/lib/sound";

// ---------------------------------------------------------------------------
// Cooking-process sound files (frontend/sounds). Change a path here to swap a
// sound; an empty string ("") silences that process.
// "Cooking" is the FRY method (the game's four methods: grill, fry, bake, boil).
// ---------------------------------------------------------------------------
export const COOKING_SFX: string = fryingSfxUrl;
export const BOILING_SFX: string = boilingSfxUrl;
export const BAKING_SFX: string = bakingSfxUrl;
export const GRILLING_SFX: string = grillingSfxUrl;

const COOKING_SFX_BY_METHOD: Record<string, string> = {
  fry: COOKING_SFX,
  boil: BOILING_SFX,
  bake: BAKING_SFX,
  grill: GRILLING_SFX,
};

const COOKING_SFX_VOLUME = 0.45;
const CLICK_VOLUME = 0.08;

/** The Settings page's sound switch and volume (lib/sound.ts): 0 when sound is off. */
function settingsVolume(): number {
  const sound = getSoundSettings();
  return sound.soundEnabled ? sound.volume / 100 : 0;
}

// ---------------------------------------------------------------------------
// Button click: a short synthesised tick (no file needed).
// ---------------------------------------------------------------------------
let clickCtx: AudioContext | null = null;

export function playClickSfx() {
  if (typeof window === "undefined") return;
  const vol = settingsVolume();
  if (vol <= 0) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    clickCtx ??= new Ctx();
    const ctx = clickCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.04);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(CLICK_VOLUME * vol, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch {
    // Audio unavailable: stay silent.
  }
}

let clickListenerInstalled = false;

/**
 * One click per activated button, app-wide, through a single delegated
 * listener (so no button's own handler changes). Passive: it never prevents
 * or alters the click. Disabled buttons never fire click events.
 */
export function installButtonClickSfx(): () => void {
  if (typeof document === "undefined" || clickListenerInstalled) return () => {};
  const onClick = (e: MouseEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    const button = target?.closest("button");
    if (button && !button.disabled) playClickSfx();
  };
  document.addEventListener("click", onClick, { capture: true, passive: true });
  clickListenerInstalled = true;
  return () => {
    document.removeEventListener("click", onClick, { capture: true });
    clickListenerInstalled = false;
  };
}

// ---------------------------------------------------------------------------
// Cooking-process sounds: one reused, looping audio element per method.
// ---------------------------------------------------------------------------
const cookingPlayers = new Map<string, HTMLAudioElement>();
let activeCookingMethod: string | null = null;
let idleStopTimer: ReturnType<typeof setTimeout> | null = null;

function cookingPlayer(methodId: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const src = COOKING_SFX_BY_METHOD[methodId];
  if (!src) return null;
  let audio = cookingPlayers.get(methodId);
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = COOKING_SFX_VOLUME;
    cookingPlayers.set(methodId, audio);
  }
  return audio;
}

/** Start (or keep) the method's cooking sound; any other method's stops. */
export function startCookingSfx(methodId: string) {
  if (idleStopTimer) {
    clearTimeout(idleStopTimer);
    idleStopTimer = null;
  }
  if (activeCookingMethod && activeCookingMethod !== methodId) stopCookingSfx();
  const vol = settingsVolume();
  if (vol <= 0) return;
  const audio = cookingPlayer(methodId);
  if (!audio) return;
  audio.volume = COOKING_SFX_VOLUME * vol;
  activeCookingMethod = methodId;
  if (audio.paused) {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked or file missing: stay silent.
    });
  }
}

/** Stop whichever cooking sound is playing. */
export function stopCookingSfx() {
  if (idleStopTimer) {
    clearTimeout(idleStopTimer);
    idleStopTimer = null;
  }
  for (const audio of cookingPlayers.values()) {
    if (!audio.paused) audio.pause();
    audio.currentTime = 0;
  }
  activeCookingMethod = null;
}

/**
 * Keyboard nudges (arrow keys) have no press/release: play briefly, and stop
 * once the slider has been idle for a moment.
 */
export function nudgeCookingSfx(methodId: string, idleMs = 350) {
  startCookingSfx(methodId);
  idleStopTimer = setTimeout(stopCookingSfx, idleMs);
}
