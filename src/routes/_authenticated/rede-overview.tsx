import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Users, RefreshCw, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/rede-overview")({
  component: RedeOverviewPage,
});

type ReconcRow = {
  mes: string | null;
  unidade: string | null;
  mrr_contratado: number | null;
  faturado: number | null;
  recebido: number | null;
  num_contratos: number | null;
};

const ALL = "__all__";

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (v: number | null | undefined, decimals = 1) =>
  v == null ? "—" : `${v.toFixed(decimals)}%`;

const fmtMes = (m: string | null | undefined) => {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  return `${mo}/${y?.slice(2)}`;
};

const fmtMesLong = (m: string | null | undefined) => {
  if (!m) return "—";
  const d = new Date(m + "-01");
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
};

function RedeOverviewPage() {
  const [rows, setRows] = useState<ReconcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unidadeFilter, setUnidadeFilter] = useState(ALL);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("v_reconciliacao_mensal")
        .select("mes,unidade,mrr_contratado,faturado,recebido,num_contratos")
        .order("mes", { ascending: true });
      if (!mounted) return;
      setRows((data ?? []) as ReconcRow[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const unidades = useMemo(
    () => Array.from(new Set(rows.map((r) => r.unidade).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) => unidadeFilter === ALL || r.unidade === unidadeFilter),
    [rows, unidadeFilter],
  );

  const byMes = useMemo(() => {
    const map = new Map<string, { mrr: number; faturado: number; recebido: number; contratos: number }>();
    for (const r of filtered) {
      const m = r.mes ?? "";
      if (!m) continue;
      const cur = map.get(m) ?? { mrr: 0, faturado: 0, recebido: 0, contratos: 0 };
      cur.mrr += r.mrr_contratado ?? 0;
      cur.faturado += r.faturado ?? 0;
      cur.recebido += r.recebido ?? 0;
      cur.contratos += r.num_contratos ?? 0;
      map.set(m, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, label: fmtMes(mes), ...v }));
  }, [filtered]);

  const ultimo = byMes[byMes.length - 1];
  const penultimo = byMes[byMes.length - 2];

  const kpis = useMemo(() => {
    if (!ultimo) return { receita: 0, mrr: 0, clientes: 0, churn: null, nrr: null, vsAnterior: null };
    const receita = ultimo.recebido;
    const mrr = ultimo.mrr;
    const clientes = ultimo.contratos;
    const vsAnterior = penultimo ? receita - penultimo.recebido : null;
    const nrr = penultimo && penultimo.mrr > 0 ? (mrr / penultimo.mrr) * 100 : null;
    const churnClientes = penultimo ? Math.max(0, penultimo.contratos - clientes) : null;
    const churnPct = penultimo && penultimo.contratos > 0 ? (churnClientes! / penultimo.contratos) * 100 : null;
    return { receita, mrr, clientes, churnClientes, churnPct, vsAnterior, nrr };
  }, [ultimo, penultimo]);

  const chartData = useMemo(() =>
    byMes.map((m, i) => {
      const prev = byMes[i - 1];
      const crescimento = prev && prev.recebido > 0 ? ((m.recebido - prev.recebido) / prev.recebido) * 100 : null;
      const churnPct = prev && prev.contratos > 0
        ? Math.max(0, (prev.contratos - m.contratos) / prev.contratos * 100)
        : 0;
      const nrr = prev && prev.mrr > 0 ? (m.mrr / prev.mrr) * 100 : 100;
      return { ...m, crescimento, churnPct, nrr, anterior: prev?.recebido ?? null };
    }),
    [byMes],
  );

  const byUnidade = useMemo(() => {
    const map = new Map<string, { mrr: number; recebido: number; contratos: number }>();
    for (const r of filtered) {
      const u = r.unidade ?? "—";
      const cur = map.get(u) ?? { mrr: 0, recebido: 0, contratos: 0 };
      cur.mrr = Math.max(cur.mrr, r.mrr_contratado ?? 0);
      cur.recebido += r.recebido ?? 0;
      cur.contratos = Math.max(cur.contratos, r.num_contratos ?? 0);
      map.set(u, cur);
    }
    return Array.from(map.entries())
      .map(([unidade, v]) => ({ unidade, ...v }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [filtered]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Overview — Gestão da Rede</h1>
            <p className="text-sm text-muted-foreground">Receita, clientes e retenção da rede</p>
          </div>
        </div>
        <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Receita Total</div>
          <div className="mt-1 text-xl font-bold">{fmtBRL(kpis.receita)}</div>
          {kpis.vsAnterior != null && (
            <div className={`text-xs mt-0.5 ${kpis.vsAnterior >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {kpis.vsAnterior >= 0 ? "▲" : "▼"} {fmtBRL(Math.abs(kpis.vsAnterior))} vs anterior
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Receita Recorrente</div>
          <div className="mt-1 text-xl font-bold">{fmtBRL(kpis.mrr)}</div>
          {kpis.receita > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {fmtPct((kpis.mrr / kpis.receita) * 100)} do total
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Clientes Ativos</div>
          <div className="mt-1 text-2xl font-bold">{kpis.clientes || "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Churn Receita</div>
          <div className="mt-1 text-2xl font-bold text-muted-foreground">—</div>
          <div className="text-xs text-muted-foreground mt-0.5">Churn %: —</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Churn Logo</div>
          <div className="mt-1 text-xl font-bold text-muted-foreground">—</div>
          {kpis.churnPct != null && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {kpis.churnClientes} clientes
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">KPI — NRR</div>
          <div className={`mt-1 text-xl font-bold ${kpis.nrr != null && kpis.nrr >= 100 ? "text-emerald-600" : "text-amber-600"}`}>
            {kpis.nrr != null ? `${kpis.nrr.toFixed(1)}%` : "—"}
          </div>
          {penultimo && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Retido: {fmtBRL(ultimo?.mrr)}
            </div>
          )}
        </Card>
      </div>

      {loading && <Card className="p-6 text-sm text-muted-foreground">Carregando dados…</Card>}

      {!loading && chartData.length > 0 && (
        <>
          {/* Receita Recorrente e Crescimento */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2 text-sm font-medium">Receita Recorrente por Mês</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gradMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} labelFormatter={(l) => `Mês: ${l}`} />
                    <Area type="monotone" dataKey="mrr" name="MRR" stroke="hsl(var(--primary))" fill="url(#gradMrr)" strokeWidth={2} />
                    <Area type="monotone" dataKey="recebido" name="Recebido" stroke="hsl(142 71% 45%)" fill="none" strokeWidth={2} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-2 text-sm font-medium">Crescimento % e Receita Total vs Mês Anterior</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v?.toFixed(1)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === "Crescimento %" ? fmtPct(v) : fmtBRL(v)
                      }
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="recebido" name="Receita Total" fill="hsl(var(--primary) / 0.7)" />
                    <Line yAxisId="right" type="monotone" dataKey="crescimento" name="Crescimento %" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Clientes Ativos e Churn */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2 text-sm font-medium">Clientes Ativos</div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gradClientes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="contratos" name="Clientes" stroke="hsl(142 71% 45%)" fill="url(#gradClientes)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-2 text-sm font-medium">% NRR por Mês</div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[90, 110]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) =>
                      name === "NRR %" ? `${v?.toFixed(1)}%` : fmtBRL(v)
                    } />
                    <Legend />
                    <Bar yAxisId="left" dataKey="mrr" name="MRR Retido" fill="hsl(var(--primary) / 0.7)" />
                    <Line yAxisId="right" type="monotone" dataKey="nrr" name="NRR %" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Resumo por unidade */}
      {!loading && (
        <Card className="overflow-x-auto">
          <div className="border-b p-3 text-sm font-semibold">Resumo por Unidade</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">MRR Atual</TableHead>
                <TableHead className="text-right">Receita Total</TableHead>
                <TableHead className="text-right">Clientes</TableHead>
                <TableHead className="text-right">ARPA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byUnidade.map((u) => (
                <TableRow key={u.unidade}>
                  <TableCell className="font-medium">{u.unidade}</TableCell>
                  <TableCell className="text-right">{fmtBRL(u.mrr)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(u.recebido)}</TableCell>
                  <TableCell className="text-right">{u.contratos || "—"}</TableCell>
                  <TableCell className="text-right">
                    {u.contratos > 0 ? fmtBRL(u.mrr / u.contratos) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {byUnidade.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhum dado disponível.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
