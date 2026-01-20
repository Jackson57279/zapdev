"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  getColorTheme,
  type ColorTheme,
} from "@/lib/themes";

const COLOR_THEME_STORAGE_KEY = "zapdev-color-theme";

type ColorThemeContextType = {
  colorTheme: ColorTheme;
  colorThemeId: string;
  setColorTheme: (id: string) => void;
  availableThemes: ColorTheme[];
};

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(
  undefined
);

function applyColorTheme(theme: ColorTheme, isDark: boolean) {
  const colors = isDark ? theme.colors.dark : theme.colors.light;
  const root = document.documentElement;

  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-foreground", colors.primaryForeground);
  root.style.setProperty("--ring", colors.ring);
  root.style.setProperty("--chart-1", colors.chart1);
  root.style.setProperty("--chart-2", colors.chart2);
  root.style.setProperty("--chart-5", colors.chart5);
  root.style.setProperty("--sidebar-primary", colors.sidebarPrimary);
}

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [colorThemeId, setColorThemeId] = useState<string>(DEFAULT_COLOR_THEME);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
      if (stored && COLOR_THEMES.some((t) => t.id === stored)) {
        setColorThemeId(stored);
      }
    } catch {
      // localStorage unavailable (e.g., Safari private browsing)
    }
  }, []);

  const colorTheme = getColorTheme(colorThemeId);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (mounted) {
      applyColorTheme(colorTheme, isDark);
    }
  }, [colorTheme, isDark, mounted]);

  const setColorTheme = useCallback((id: string) => {
    const theme = getColorTheme(id);
    setColorThemeId(theme.id);
    try {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme.id);
    } catch {
      // localStorage unavailable or quota exceeded
    }
  }, []);

  const value: ColorThemeContextType = {
    colorTheme,
    colorThemeId,
    setColorTheme,
    availableThemes: COLOR_THEMES,
  };

  return (
    <ColorThemeContext.Provider value={value}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (context === undefined) {
    throw new Error("useColorTheme must be used within a ColorThemeProvider");
  }
  return context;
}
