import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { RedeContent } from "@/components/page-content/rede-content";
import { ApuracaoRoyaltiesContent } from "@/components/royalties/apuracao-royalties-content";
import { ApuracaoCacContent } from "@/components/cac/apuracao-cac-content";

export const Route = createFileRoute("/_authenticated/unidades")({
  head: () => ({
    meta: [
      { title: "Unidades – Planning" },
      { name: "description", content: "Regras das unidades e apuração de royalties." },
    ],
  }),
  component: UnidadesRoute,
});

type Tab = "regras" | "royalties" | "cac";

const TABS: { key: Tab; label: string }[] = [
  { key: "regras", label: "Regras" },
  { key: "royalties", label: "Royalties" },
  { key: "cac", label: "CAC" },
];

function UnidadesRoute() {
  useAuth();
  const [tab, setTab] = useState<Tab>("regras");

  return (
    <AppShell title="Unidades" subtitle="Regras da rede e apuração de royalties">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4">
          <nav className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      {tab === "regras" && <RedeContent />}
      {tab === "royalties" && <ApuracaoRoyaltiesContent />}
      {tab === "cac" && <ApuracaoCacContent />}
    </AppShell>
  );
}
