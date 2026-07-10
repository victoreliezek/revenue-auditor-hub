import { Clock, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

const LABELS: Record<string, string> = {
  auto: "Automático (acompanha o horário do computador) — clique para tema claro",
  light: "Tema claro — clique para tema escuro",
  dark: "Tema escuro — clique para automático",
};

export function ThemeToggle() {
  const { mode, theme, toggle } = useTheme();
  const Icon = mode === "auto" ? Clock : theme === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={LABELS[mode]}
      title={LABELS[mode]}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-accent"
    >
      <Icon size={16} />
    </button>
  );
}
