import type { ReactNode } from "react";
import { ValidationBanner } from "@/components/validation-banner";
import { DataFreshnessBar } from "@/components/data-freshness-bar";


interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerExtra?: ReactNode;
}

export function AppShell({ title, subtitle, children, headerExtra }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <ValidationBanner />
      <div className="flex items-center gap-3 border-b bg-card/50 px-4 py-2.5">

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</h1>
          {subtitle && (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
          )}
        </div>
        {headerExtra && <div className="flex items-center gap-2">{headerExtra}</div>}
      </div>
      <DataFreshnessBar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
