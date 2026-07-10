import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRoyaltiesUnidades } from "@/hooks/use-royalties";
import { brl } from "@/components/audit/format";
import { usePermissions } from "@/hooks/use-permissions";

function defaultMes(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isMesEmAndamento(mes: string): boolean {
  const d = new Date();
  const atual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return mes >= atual;
}

function formatMesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  em_revisao: { label: "Em revisão", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" },
  confirmado: { label: "Confirmado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" },
  faturado: { label: "Faturado", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200" },
};

export function ApuracaoRoyaltiesContent() {
  const { isAdmin, loading } = usePermissions();
  const [mes, setMes] = useState(defaultMes());
  const { data, isLoading } = useRoyaltiesUnidades(mes);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const totais = useMemo(
    () =>
      rows.reduce(
        (acc, u) => {
          const ap = u.apuracao;
          if (!ap) return acc;
          acc.royalties += Number(ap.royalties_valor ?? 0);
          acc.csc += Number((ap.csc_valor_fixo ?? ap.csc_base_antiga_valor ?? 0) as number);
          acc.cac += Number(ap.cac_valor ?? 0);
          acc.totalFatura += Number(ap.total_fatura ?? 0);
          acc.comApuracao += 1;
          return acc;
        },
        { royalties: 0, csc: 0, cac: 0, totalFatura: 0, comApuracao: 0 },
      ),
    [rows],
  );

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito a usuários admin.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Apuração de Royalties</h1>
            <p className="text-sm text-muted-foreground">
              Gere a base de cobrança mensal de cada unidade.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMes(shiftMes(mes, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] rounded-md border bg-card px-3 py-1.5 text-center text-sm font-medium capitalize">
            {formatMesLabel(mes)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setMes(shiftMes(mes, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isMesEmAndamento(mes) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Mês em andamento — a apuração só fecha depois que o mês termina. Use as setas para voltar ao mês anterior.
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">Total da rede</div>
            <div className="text-xs text-muted-foreground">
              {totais.comApuracao} de {rows.length} unidades com apuração
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Royalties</div>
              <div className="font-medium">{brl(totais.royalties)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">CSC</div>
              <div className="font-medium">{brl(totais.csc)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">CAC</div>
              <div className="font-medium">{brl(totais.cac)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total fatura</div>
              <div className="text-base font-semibold">{brl(totais.totalFatura)}</div>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando unidades…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((u) => {
            const ap = u.apuracao;
            const statusKey = ap?.status ?? "nao_iniciada";
            const badge = STATUS_BADGE[statusKey];
            const cscModel = u.csc_percentual_base_antiga != null ? `${u.csc_percentual_base_antiga}% base antiga` : `CSC fixo ${brl(u.csc_valor_fixo ?? 0)}`;
            return (
              <Card key={u.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{u.nome_da_praca}</div>
                    <div className="text-xs text-muted-foreground">
                      Royalties {u.royalties_percentual ?? 0}% • {cscModel}
                    </div>
                  </div>
                  {badge ? (
                    <Badge className={badge.cls}>{badge.label}</Badge>
                  ) : (
                    <Badge variant="outline">Não iniciada</Badge>
                  )}
                </div>
                {ap && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Royalties</div>
                      <div className="font-medium">{brl(ap.royalties_valor ?? 0)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">CSC</div>
                      <div className="font-medium">
                        {brl((ap.csc_valor_fixo ?? ap.csc_base_antiga_valor ?? 0) as number)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">CAC</div>
                      <div className="font-medium">{brl(ap.cac_valor ?? 0)}</div>
                    </div>
                    <div className="col-span-3">
                      <div className="text-muted-foreground">Total fatura</div>
                      <div className="text-base font-semibold">{brl(ap.total_fatura ?? 0)}</div>
                    </div>
                  </div>
                )}
                <Link
                  to="/royalties/$unidadeId/$mes"
                  params={{ unidadeId: String(u.id), mes }}
                  className="inline-block"
                >
                  <Button size="sm" variant={ap ? "outline" : "default"} className="w-full">
                    {ap?.status === "confirmado" || ap?.status === "faturado"
                      ? "Ver apuração"
                      : ap
                        ? "Continuar"
                        : "Iniciar apuração"}
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
