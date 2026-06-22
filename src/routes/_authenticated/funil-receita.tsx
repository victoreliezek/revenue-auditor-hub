import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { FunilContent } from "@/components/page-content/funil-content";
import { AuditoriaContent } from "@/components/page-content/auditoria-content";
import { AuditoriaFaturamentoContent } from "@/components/page-content/auditoria-faturamento-content";

export const Route = createFileRoute("/_authenticated/funil-receita")({
  head: () => ({
    meta: [{ title: "Funil de Receita – Planning" }],
  }),
  component: FunilReceitaPage,
});

type Tab = "funil" | "vendas-sem-recebimento" | "esperado-recebido";

const TABS: { key: Tab; label: string }[] = [
  { key: "funil", label: "Funil" },
  { key: "vendas-sem-recebimento", label: "Vendas sem recebimento" },
  { key: "esperado-recebido", label: "Esperado × Recebido" },
];

function FunilReceitaPage() {
  useAuth();
  const [tab, setTab] = useState<Tab>("funil");

  return (
    <AppShell title="Funil de Receita" subtitle="MRR contratado → Faturado → Recebido">
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
      {tab === "funil" && <FunilContent />}
      {tab === "vendas-sem-recebimento" && <AuditoriaContent />}
      {tab === "esperado-recebido" && <AuditoriaFaturamentoContent />}
    </AppShell>
  );
}
