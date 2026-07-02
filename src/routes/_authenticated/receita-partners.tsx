import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { RedeFinanceiroView } from "@/components/financeiro-partners/rede-financeiro-view";
import { ReceitasView } from "@/components/financeiro-partners/receitas-view";

type TabId = "financeiro-rede" | "receitas";

export const Route = createFileRoute("/_authenticated/receita-partners")({
  head: () => ({
    meta: [
      { title: "Receita Partners – Planning" },
      {
        name: "description",
        content: "Financeiro — Gestão da Rede e Receitas da Planning Partners.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tab: TabId } => {
    const t = search.tab;
    const valid: TabId[] = ["financeiro-rede", "receitas"];
    return { tab: (valid.includes(t as TabId) ? (t as TabId) : "financeiro-rede") };
  },
  component: ReceitaPartnersPage,
});

const TABS = [
  { id: "financeiro-rede", label: "Financeiro — Gestão da Rede" },
  { id: "receitas", label: "Receitas" },
] as const;

function ReceitaPartnersPage() {
  const { tab } = useSearch({ from: "/_authenticated/receita-partners" });

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b bg-card/50 px-4 pt-2">
        <nav className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <Link
                key={t.id}
                to="/receita-partners"
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
        {tab === "financeiro-rede" && <RedeFinanceiroView />}
        {tab === "receitas" && <ReceitasView />}
      </div>
    </div>
  );
}
