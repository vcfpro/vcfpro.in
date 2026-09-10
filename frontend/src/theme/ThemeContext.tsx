import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSettings } from "../api/endpoints";
import type { ThemeSettings } from "../api/types";

/*
 * Reconstructed directly from public_html/assets/index-BxfIvHoc.js (the
 * ThemeProvider component and its applyTheme/loadTheme/setTheme closures),
 * NOT reverse-engineered from behaviour alone - see capture/interactions.md
 * and capture/design-system.md for the supporting evidence. This is the
 * highest-risk piece of the whole rebuild: the admin's colour picker works
 * by this exact set of CSS custom property NAMES existing on <html>, so
 * every property name and literal value below is copied from the bundle,
 * not renamed or "cleaned up".
 *
 * Two things worth knowing before touching this file:
 *
 * 1. Both --theme-X and --color-X are set to the same value for every
 *    colour, redundantly. The stylesheet's own @theme block defines
 *    --color-bg: var(--theme-bg) etc. (see index.css), so setting only
 *    --theme-* would already work - but the original sets both directly on
 *    every call, so this does too, for exact parity.
 *
 * 2. --theme-line, --theme-card-bg, --theme-card-border, --theme-muted, and
 *    --card-shadow are NOT derived from the admin's bg/ink colours at
 *    runtime - they are hardcoded literal strings that only depend on
 *    dark/light mode, never on the configured accent/bg/ink values. Do not
 *    "fix" this into a computed formula; the live site genuinely behaves
 *    this way.
 */

const FALLBACK_THEME: ThemeSettings = {
  mode: "dark",
  accentColor: "#818cf8",
  dayBg: "#FAF9F6",
  dayInk: "#111827",
  nightBg: "#050505",
  nightInk: "#F5F5F5",
  editorDayBg: "#FAF9F6",
  editorDayInk: "#111827",
  // Note: these two differ from what's actually configured in the live
  // database (#000000 / #ffffff) - this pair is only the bundle's built-in
  // fallback for before /api/settings resolves, copied verbatim.
  editorNightBg: "#0c0c0c",
  editorNightInk: "#F5F5F5",
};

function readStoredMode(): "light" | "dark" | null {
  try {
    const stored = localStorage.getItem("vcf_theme_mode");
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement.style;
  root.setProperty("--theme-accent", theme.accentColor || "#818cf8");
  root.setProperty("--color-accent", theme.accentColor || "#818cf8");

  if (theme.mode === "light") {
    const bg = theme.dayBg || "#FAF9F6";
    const ink = theme.dayInk || "#111827";
    const editorBg = theme.editorDayBg || bg;
    const editorInk = theme.editorDayInk || ink;

    root.setProperty("--theme-bg", bg);
    root.setProperty("--color-bg", bg);
    root.setProperty("--theme-ink", ink);
    root.setProperty("--color-ink", ink);
    root.setProperty("--editor-bg", editorBg);
    root.setProperty("--editor-ink", editorInk);
    root.setProperty("--theme-line", "rgba(17, 24, 39, 0.08)");
    root.setProperty("--color-line", "rgba(17, 24, 39, 0.08)");
    root.setProperty("--theme-card-bg", "rgba(255, 255, 255, 0.6)");
    root.setProperty("--color-card-bg", "rgba(255, 255, 255, 0.6)");
    root.setProperty("--theme-card-border", "rgba(17, 24, 39, 0.08)");
    root.setProperty("--color-card-border", "rgba(17, 24, 39, 0.08)");
    root.setProperty("--theme-muted", "rgba(17, 24, 39, 0.6)");
    root.setProperty("--color-muted", "rgba(17, 24, 39, 0.6)");
    root.setProperty("--card-shadow", "0 10px 30px -10px rgba(0, 0, 0, 0.05)");
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
  } else {
    const bg = theme.nightBg || "#050505";
    const ink = theme.nightInk || "#F5F5F5";
    const editorBg = theme.editorNightBg || "#0c0c0c";
    const editorInk = theme.editorNightInk || ink || "#F5F5F5";

    root.setProperty("--theme-bg", bg);
    root.setProperty("--color-bg", bg);
    root.setProperty("--theme-ink", ink);
    root.setProperty("--color-ink", ink);
    root.setProperty("--editor-bg", editorBg);
    root.setProperty("--editor-ink", editorInk);
    root.setProperty("--theme-line", "rgba(255, 255, 255, 0.05)");
    root.setProperty("--color-line", "rgba(255, 255, 255, 0.05)");
    root.setProperty("--theme-card-bg", "rgba(255, 255, 255, 0.03)");
    root.setProperty("--color-card-bg", "rgba(255, 255, 255, 0.03)");
    root.setProperty("--theme-card-border", "rgba(255, 255, 255, 0.08)");
    root.setProperty("--color-card-border", "rgba(255, 255, 255, 0.08)");
    root.setProperty("--theme-muted", "rgba(245, 245, 245, 0.5)");
    root.setProperty("--color-muted", "rgba(245, 245, 245, 0.5)");
    root.setProperty("--card-shadow", "0 25px 50px -12px rgba(0, 0, 0, 0.5)");
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }
}

interface ThemeContextValue {
  theme: ThemeSettings;
  setTheme: (theme: ThemeSettings) => void;
  loadTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: FALLBACK_THEME,
  setTheme: () => {},
  loadTheme: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeSettings>(() => ({
    ...FALLBACK_THEME,
    mode: readStoredMode() ?? "dark",
  }));

  const loadTheme = async () => {
    try {
      const settings = await getSettings();
      if (!settings.theme) return;
      const storedMode = readStoredMode();
      const merged: ThemeSettings = {
        mode: storedMode ?? settings.theme.mode,
        accentColor: settings.theme.accentColor || "#818cf8",
        dayBg: settings.theme.dayBg || "#FAF9F6",
        dayInk: settings.theme.dayInk || "#111827",
        nightBg: settings.theme.nightBg || "#050505",
        nightInk: settings.theme.nightInk || "#F5F5F5",
        editorDayBg: settings.theme.editorDayBg || settings.theme.dayBg || "#FAF9F6",
        editorDayInk: settings.theme.editorDayInk || settings.theme.dayInk || "#111827",
        editorNightBg: settings.theme.editorNightBg || "#0c0c0c",
        editorNightInk: settings.theme.editorNightInk || settings.theme.nightInk || "#F5F5F5",
      };
      setThemeState(merged);
      applyTheme(merged);
    } catch (err) {
      console.error("Failed to load theme settings", err);
    }
  };

  const setTheme = (next: ThemeSettings) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem("vcf_theme_mode", next.mode);
    } catch {
      // ignore, matches original
    }
  };

  useEffect(() => {
    // Apply the fallback/localStorage-mode theme synchronously on mount
    // (avoids a flash of unstyled content), then fetch the real values.
    applyTheme(theme);
    void loadTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, loadTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
