import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { DREPartnersPage } from "@/routes/_authenticated/dre-partners";
import { DreProjetadaView } from "@/components/financeiro-partners/dre-projetada";
import { FxcView } from "@/components/financeiro-partners/fxc-view";

type TabId = "dre" | "dfc" | "fcx";

export const Route = createFileRoute("/_authenticated/financeiro-partners")({
  head: () => ({
    meta: [
      { title: "Financeiro Partners – Planning" },
      {
        name: "description",
        content:
          "Visão consolidada: DRE projetada, DFC e FCx da Planning Partners.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tab: TabId } => {
    const t = search.tab;
    const valid: TabId[] = ["dre", "dfc", "fcx"];
    return { tab: (valid.includes(t as TabId) ? (t as TabId) : "dre") };
  },
  component: FinanceiroPartnersPage,
});

const TABS = [
  { id: "dre", label: "DRE Projetada" },
  { id: "dfc", label: "DFC" },
  { id: "fcx", label: "FCx" },
] as const;

function FinanceiroPartnersPage() {
  const { tab } = useSearch({ from: "/_authenticated/financeiro-partners" });

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b bg-card/50 px-4 pt-2">
        <nav className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <Link
                key={t.id}
                to="/financeiro-partners"
                search={{ tab: t.id }}
                className={cn(
                  "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1">
        {tab === "dfc" && <DREPartnersPage />}
        {tab === "dre" && <DreProjetadaView />}
        {tab === "fcx" && <FxcView />}
      </div>
    </div>
  );
}
