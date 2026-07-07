import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCacUnidades } from "@/hooks/use-cac";
import { brl } from "@/components/audit/format";
import { usePermissions } from "@/hooks/use-permissions";

function defaultMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  em_revisao: { label: "Em revisão", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" },
  confirmado: { label: "Confirmado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" },
};

export function ApuracaoCacContent() {
  const { isAdmin, loading } = usePermissions();
  const [mes, setMes] = useState(defaultMes());
  const { data, isLoading } = useCacUnidades(mes);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito a usuários admin.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Apuração de CAC</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe o repasse de CAC por cliente novo: 50% até 7 dias após a assinatura, 50% após o
              recebimento do cliente.
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

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando unidades…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((u) => {
            const ap = u.apuracao;
            const statusKey = ap?.status ?? "nao_iniciada";
            const badge = STATUS_BADGE[statusKey];
            return (
              <Card key={u.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{u.nome_da_praca}</div>
                  {badge ? (
                    <Badge className={badge.cls}>{badge.label}</Badge>
                  ) : (
                    <Badge variant="outline">Não iniciada</Badge>
                  )}
                </div>
                {ap && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Parcela 1</div>
                      <div className="font-medium">{brl(ap.total_parcela_1 ?? 0)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Parcela 2</div>
                      <div className="font-medium">{brl(ap.total_parcela_2 ?? 0)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Total CAC</div>
                      <div className="text-base font-semibold">{brl(ap.total_cac ?? 0)}</div>
                    </div>
                  </div>
                )}
                <Link to="/cac/$unidadeId/$mes" params={{ unidadeId: String(u.id), mes }} className="inline-block">
                  <Button size="sm" variant={ap ? "outline" : "default"} className="w-full">
                    {ap?.status === "confirmado" ? "Ver apuração" : ap ? "Continuar" : "Iniciar apuração"}
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
