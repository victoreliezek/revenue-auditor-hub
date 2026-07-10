import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type ThemeMode = Theme | "auto";

const STORAGE_KEY = "planning-theme";

// Horário comercial considerado "dia" no modo automático.
const DIA_INICIO_HORA = 6;
const DIA_FIM_HORA = 18;

function autoTheme(): Theme {
  const hora = new Date().getHours();
  return hora >= DIA_INICIO_HORA && hora < DIA_FIM_HORA ? "light" : "dark";
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "auto") return stored;
  return "auto"; // padrão: acompanha o horário do computador
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode());
  const [theme, setThemeState] = useState<Theme>(() => (mode === "auto" ? autoTheme() : mode));

  // Modo automático: recalcula ao entrar no modo e reavalia a cada minuto,
  // pra pegar a virada dia/noite sem precisar recarregar a página.
  useEffect(() => {
    if (mode !== "auto") {
      setThemeState(mode);
      return;
    }
    setThemeState(autoTheme());
    const id = window.setInterval(() => setThemeState(autoTheme()), 60_000);
    return () => window.clearInterval(id);
  }, [mode]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  return {
    theme,
    mode,
    setMode,
    // Ciclo: automático → claro → escuro → automático...
    toggle: () => setMode((m) => (m === "auto" ? "light" : m === "light" ? "dark" : "auto")),
  };
}
