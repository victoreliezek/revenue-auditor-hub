import { cn } from "@/lib/utils";
import { useState } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  help?: string;
  tone?: "default" | "indigo" | "emerald" | "red" | "orange" | "purple";
  highlight?: boolean;
}

const tones: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "bg-card text-card-foreground",
  indigo: "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-900",
  emerald: "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-900",
  red: "bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900",
  orange: "bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-900",
  purple: "bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-950 dark:text-purple-100 dark:border-purple-900",
};

export function KpiCard({ label, value, sub, help, tone = "default", highlight }: KpiCardProps) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-sm transition-shadow",
        tones[tone],
        highlight && "ring-2 ring-indigo-400 dark:ring-indigo-500",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
        {help && (
          <button
            type="button"
            aria-label="O que significa?"
            title="O que significa?"
            onClick={() => setShowHelp((s) => !s)}
            className="shrink-0 rounded-full border border-current/30 px-1.5 text-[10px] font-bold opacity-60 hover:opacity-100"
          >
            ?
          </button>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-75">{sub}</div>}
      {showHelp && help && (
        <div className="mt-2 rounded-md border border-current/20 bg-background/70 p-2 text-xs leading-snug opacity-90">
          {help}
        </div>
      )}
    </div>
  );
}
