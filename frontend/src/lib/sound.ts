import { useCallback, useEffect, useState } from "react";

export interface SoundSettings {
  soundEnabled: boolean;
  volume: number; // 0 to 100
}

export const SOUND_STORAGE_KEY = "wavebakery_sound_settings";
export const SOUND_CHANGE_EVENT = "wavebakery_sound_changed";

const DEFAULT_SETTINGS: SoundSettings = {
  soundEnabled: true,
  volume: 80,
};

export function getSoundSettings(): SoundSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        soundEnabled: typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : true,
        volume:
          typeof parsed.volume === "number" && !isNaN(parsed.volume)
            ? Math.max(0, Math.min(100, Math.round(parsed.volume)))
            : 80,
      };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_SETTINGS };
}

export function setSoundSettings(partial: Partial<SoundSettings>): SoundSettings {
  const current = getSoundSettings();
  const updated: SoundSettings = {
    soundEnabled: partial.soundEnabled !== undefined ? Boolean(partial.soundEnabled) : current.soundEnabled,
    volume:
      partial.volume !== undefined && !isNaN(partial.volume)
        ? Math.max(0, Math.min(100, Math.round(partial.volume)))
        : current.volume,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(SOUND_CHANGE_EVENT, { detail: updated }));
  }

  return updated;
}

export function useSoundSettings(): [SoundSettings, (partial: Partial<SoundSettings>) => void] {
  const [settings, setSettings] = useState<SoundSettings>(() => getSoundSettings());

  useEffect(() => {
    const handler = () => {
      setSettings(getSoundSettings());
    };
    window.addEventListener(SOUND_CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(SOUND_CHANGE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = useCallback((partial: Partial<SoundSettings>) => {
    const updated = setSoundSettings(partial);
    setSettings(updated);
  }, []);

  return [settings, update];
}
