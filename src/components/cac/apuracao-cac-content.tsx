import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCacUnidadesResumo } from "@/hooks/use-cac";
import { brl } from "@/components/audit/format";
import { usePermissions } from "@/hooks/use-permissions";

export function ApuracaoCacContent() {
  const { isAdmin, loading } = usePermissions();
  const { data, isLoading } = useCacUnidadesResumo();

  const rows = data?.rows ?? [];

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito a usuários admin.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CAC por unidade</h1>
          <p className="text-sm text-muted-foreground">
            Repasse de CAC por cliente novo: 50% até 7 dias após a assinatura, 50% depois que o cliente
            faz o primeiro pagamento pra Planning. Lista contínua — não é por mês, o que importa é se a 2ª
            parcela de cada cliente já foi cobrada.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando unidades…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((u) => (
            <Card key={u.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{u.nome_da_praca}</div>
                {u.parcela2_pendente > 0 ? (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                    {u.parcela2_pendente} pendente{u.parcela2_pendente > 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline">Em dia</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">2ª parcela a cobrar</div>
                  <div className="font-medium">{brl(u.valor_parcela2_pendente)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Aguardando cliente pagar</div>
                  <div className="font-medium">{u.parcela2_aguardando_cliente}</div>
                </div>
                {u.parcela1_atrasado > 0 && (
                  <div className="col-span-2 text-red-700 dark:text-red-300">
                    {u.parcela1_atrasado} cliente{u.parcela1_atrasado > 1 ? "s" : ""} com 1ª parcela atrasada
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-muted-foreground">Clientes com CAC atribuído</div>
                  <div className="text-base font-semibold">{u.total_clientes}</div>
                </div>
              </div>
              <Link to="/cac/$unidadeId" params={{ unidadeId: String(u.id) }} className="inline-block">
                <Button size="sm" variant="outline" className="w-full">
                  Ver clientes
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
