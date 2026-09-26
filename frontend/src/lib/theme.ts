import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "wavebakery_theme";
export const THEME_CHANGE_EVENT = "wavebakery_theme_changed";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark") return "dark";
    return "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function setTheme(theme: Theme): Theme {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage quota / permissions errors
    }
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
  }
  return theme;
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    // Ensure the DOM class matches the stored theme on mount
    applyTheme(getTheme());

    const handler = () => {
      const current = getTheme();
      setThemeState(current);
      applyTheme(current);
    };

    window.addEventListener(THEME_CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = (newTheme: Theme) => {
    setTheme(newTheme);
    setThemeState(newTheme);
  };

  return [theme, update];
}
