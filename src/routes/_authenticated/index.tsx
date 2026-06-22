import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  DollarSign,
  Smile,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Hub Executivo – Planning" },
      { name: "description", content: "Painel executivo: MRR, ARR, inadimplência e saúde da rede." },
    ],
  }),
  component: HubExecutivoPage,
});

// ============================================================
// Types
// ============================================================
type Periodo = "mes" | "trimestre" | "ano" | "acumulado";

type Contrato = {
  pipedrive_deal_id: string | null;
  mrr_mensal: number | null;
  status_contrato: string | null;
  ganho_em: string | null;
};
type ContaReceber = {
  valor: number | null;
  status_pagamento: string | null;
  data_competencia: string | null;
  data_pagamento: string | null;
  cpf_cnpj: string | null;
};
type Empresa = {
  id: number;
  razao_social: string | null;
  cnpj: string | null;
  unidade: string | null;
  pipedrive_id: string | null;
  status_financeiro: string | null;
};
type Nps = { nps_recomendacao: string | null; created_at: string | null };
type Unidade = { data_inauguracao: string | null };

// ============================================================
// Helpers
// ============================================================
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtCompact = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return fmtBRL(v);
};

const fmtData = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D+/g, "");

function periodoRange(p: Periodo): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (p === "acumulado") return { start: null, end: null };
  if (p === "mes") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
  if (p === "trimestre") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(now.getFullYear(), q * 3, 1),
      end: new Date(now.getFullYear(), q * 3 + 3, 1),
    };
  }
  // ano
  return {
    start: new Date(now.getFullYear(), 0, 1),
    end: new Date(now.getFullYear() + 1, 0, 1),
  };
}

function inRange(dateStr: string | null, start: Date | null, end: Date | null) {
  if (!start || !end) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d < end;
}

const COLORS = [
  "hsl(220 70% 50%)",
  "hsl(160 60% 45%)",
  "hsl(30 80% 55%)",
  "hsl(280 65% 60%)",
  "hsl(340 75% 55%)",
  "hsl(190 60% 45%)",
  "hsl(50 80% 55%)",
  "hsl(0 70% 55%)",
  "hsl(120 50% 45%)",
  "hsl(250 60% 60%)",
];

// ============================================================
// Page
// ============================================================
function HubExecutivoPage() {
  const { primaryRole, loading: permLoading } = usePermissions();
  if (!permLoading && primaryRole === "socio_franqueado") {
    return <Navigate to="/painel-unidade" replace />;
  }
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [multiplo, setMultiplo] = useState<number>(36);
  const [loading, setLoading] = useState(true);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cr, setCr] = useState<ContaReceber[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nps, setNps] = useState<Nps[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [atualizadoEm, setAtualizadoEm] = useState<Date>(new Date());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      // paginate contas_receber to bypass 1000-row cap
      const pageSize = 1000;
      let from = 0;
      const allCr: ContaReceber[] = [];
      while (true) {
        const { data } = await supabase
          .from("contas_receber")
          .select("valor,status_pagamento,data_competencia,data_pagamento,cpf_cnpj")
          .neq("status_pagamento", "CANCELADO")
          .range(from, from + pageSize - 1);
        const batch = (data ?? []) as ContaReceber[];
        allCr.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      const [c, e, n, u] = await Promise.all([
        supabase
          .from("contratos")
          .select("pipedrive_deal_id,mrr_mensal,status_contrato,ganho_em")
          .eq("tipo_unidade", "franquia")
          .limit(10000),
        supabase
          .from("empresas")
          .select("id,razao_social,cnpj,unidade,pipedrive_id,status_financeiro")
          .eq("tipo_unidade", "franquia")
          .limit(10000),
        supabase
          .from("nps_pesquisas")
          .select("nps_recomendacao,created_at")
          .limit(10000),
        supabase.from("unidades").select("data_inauguracao").limit(1000),
      ]);

      if (!alive) return;
      setContratos((c.data ?? []) as Contrato[]);
      setCr(allCr);
      setEmpresas((e.data ?? []) as Empresa[]);
      setNps((n.data ?? []) as Nps[]);
      setUnidades((u.data ?? []) as Unidade[]);
      setAtualizadoEm(new Date());
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { start, end } = periodoRange(periodo);

  // ============ SEÇÃO 1 ============
  // contratos.mrr_mensal já vem com o valor mensal (coluna gerada = mrr/12).
  const ativos = contratos.filter((c) => c.status_contrato === "Ativo");
  const mrr = ativos.reduce((s, c) => s + Number(c.mrr_mensal ?? 0), 0);
  const arr = mrr * 12;
  const valuation = mrr * multiplo;


  // ============ SEÇÃO 2 ============
  const inadimplentes = cr.filter((r) =>
    ["ATRASADO", "VENCIDO"].includes(r.status_pagamento ?? ""),
  );
  const inadValor = inadimplentes.reduce((s, r) => s + Number(r.valor ?? 0), 0);
  const inadClientes = new Set(inadimplentes.map((r) => onlyDigits(r.cpf_cnpj))).size;
  const inadPctMrr = mrr > 0 ? (inadValor / mrr) * 100 : 0;

  // Novos clientes do período + mês anterior
  const novosPeriodo = ativos.filter((c) => inRange(c.ganho_em, start, end)).length;
  const { start: prevStart, end: prevEnd } = useMemo(() => {
    if (!start || !end) return { start: null, end: null };
    const ms = end.getTime() - start.getTime();
    return { start: new Date(start.getTime() - ms), end: start };
  }, [start, end]);
  const novosAnterior = ativos.filter((c) => inRange(c.ganho_em, prevStart, prevEnd)).length;
  const novosVar =
    novosAnterior > 0 ? ((novosPeriodo - novosAnterior) / novosAnterior) * 100 : null;

  const risco = empresas.filter((e) =>
    ["SEM_ATIVIDADE", "INADIMPLENTE", "NUNCA_PAGOU"].includes(e.status_financeiro ?? ""),
  );
  const riscoBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    risco.forEach((r) => {
      const k = r.status_financeiro ?? "—";
      m[k] = (m[k] ?? 0) + 1;
    });
    return m;
  }, [risco]);

  const npsFiltered = nps.filter((n) => inRange(n.created_at, start, end));
  const npsScores = npsFiltered
    .map((n) => Number(n.nps_recomendacao))
    .filter((v) => Number.isFinite(v));
  const npsMedio = npsScores.length > 0 ? npsScores.reduce((s, v) => s + v, 0) / npsScores.length : 0;
  const npsRespostas = npsScores.length;

  const hoje = new Date();
  const unidadesAtivas = unidades.filter(
    (u) => u.data_inauguracao && new Date(u.data_inauguracao) <= hoje,
  ).length;

  // ============ SEÇÃO 3 — MRR por unidade ============
  const mrrPorUnidade = useMemo(() => {
    const cnpjToUni = new Map<string, string>();
    empresas.forEach((e) => {
      if (e.pipedrive_id) cnpjToUni.set(String(e.pipedrive_id), e.unidade ?? "Sem unidade");
    });
    const m = new Map<string, { mrr: number; contratos: number }>();
    ativos.forEach((c) => {
      const uni = cnpjToUni.get(String(c.pipedrive_deal_id ?? "")) ?? "Sem unidade";
      const cur = m.get(uni) ?? { mrr: 0, contratos: 0 };
      cur.mrr += Number(c.mrr_mensal ?? 0);
      cur.contratos += 1;
      m.set(uni, cur);
    });
    const total = mrr || 1;
    return Array.from(m.entries())
      .map(([unidade, v]) => ({ unidade, mrr: v.mrr, contratos: v.contratos, pct: (v.mrr / total) * 100 }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [ativos, empresas, mrr]);

  // ============ SEÇÃO 4 — Novos clientes últimos 6 meses ============
  const seriePorMes = useMemo(() => {
    const buckets: { mes: string; key: string; novos: number; mrr_add: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        mes: `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        novos: 0,
        mrr_add: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    ativos.forEach((c) => {
      if (!c.ganho_em) return;
      const k = c.ganho_em.slice(0, 7);
      const i = idx.get(k);
      if (i === undefined) return;
      buckets[i].novos += 1;
      buckets[i].mrr_add += Number(c.mrr_mensal ?? 0);
    });
    return buckets;
  }, [ativos]);

  // ============ SEÇÃO 5 — Radar ============
  const radar = useMemo(() => {
    const crByCnpj = new Map<string, ContaReceber[]>();
    cr.forEach((r) => {
      const k = onlyDigits(r.cpf_cnpj);
      if (!k) return;
      const arr2 = crByCnpj.get(k) ?? [];
      arr2.push(r);
      crByCnpj.set(k, arr2);
    });
    return empresas
      .filter((e) =>
        ["INADIMPLENTE", "NUNCA_PAGOU", "EM_ATRASO"].includes(e.status_financeiro ?? ""),
      )
      .map((e) => {
        const k = onlyDigits(e.cnpj);
        const rows = crByCnpj.get(k) ?? [];
        const ultimoPag = rows
          .filter((r) => r.status_pagamento === "RECEBIDO" && r.data_pagamento)
          .map((r) => r.data_pagamento as string)
          .sort()
          .pop();
        const valorAtraso = rows
          .filter((r) => ["ATRASADO", "VENCIDO"].includes(r.status_pagamento ?? ""))
          .reduce((s, r) => s + Number(r.valor ?? 0), 0);
        return {
          id: e.id,
          razao_social: e.razao_social ?? "—",
          unidade: e.unidade ?? "—",
          status: e.status_financeiro ?? "—",
          pipedrive_id: e.pipedrive_id,
          ultimoPag: ultimoPag ?? null,
          valorAtraso,
        };
      })
      .sort((a, b) => b.valorAtraso - a.valorAtraso)
      .slice(0, 10);
  }, [empresas, cr]);

  // ============ Render ============
  return (
    <AppShell
      title="Hub Executivo"
      subtitle={`Atualizado em ${atualizadoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
      headerExtra={
        <div className="flex items-center gap-1 rounded-md border p-1">
          {(["mes", "trimestre", "ano", "acumulado"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium capitalize",
                periodo === p ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {p === "mes" ? "Mês Atual" : p === "trimestre" ? "Trimestre" : p === "ano" ? "Ano" : "Acumulado"}
            </button>
          ))}
        </div>
      }
    >
      <TooltipProvider>
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
          {/* SEÇÃO 1 — Números do Negócio */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <BigCard
              title="MRR"
              value={fmtCompact(mrr)}
              exact={fmtBRL(mrr)}
              sub="Receita Recorrente Mensal"
              icon={<DollarSign className="h-4 w-4" />}
              tone="indigo"
              loading={loading}
              to="/clientes"
            />

            <BigCard
              title="ARR"
              value={fmtCompact(arr)}
              exact={fmtBRL(arr)}
              sub="Receita Anualizada"
              icon={<TrendingUp className="h-4 w-4" />}
              tone="blue"
              loading={loading}
            />
            <BigCard
              title="Valuation"
              value={fmtCompact(valuation)}
              exact={fmtBRL(valuation)}
              sub={`MRR × ${multiplo}×`}
              icon={<Wallet className="h-4 w-4" />}
              tone="violet"
              loading={loading}
              extra={
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={multiplo}
                  onChange={(e) => setMultiplo(Number(e.target.value) || 1)}
                  className="h-7 w-16 text-xs"
                  aria-label="Múltiplo"
                />
              }
            />
          </div>

          {/* SEÇÃO 2 — Alertas de Saúde */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <AlertCard
              title="Inadimplência"
              value={fmtCompact(inadValor)}
              sub={`${inadClientes} clientes`}
              badge={`${inadPctMrr.toFixed(1)}% do MRR`}
              tone={inadPctMrr > 5 ? "red" : inadPctMrr >= 2 ? "amber" : "green"}
              showAlert={inadPctMrr > 5}
              loading={loading}
            />
            <AlertCard
              title="Novos Clientes"
              value={String(novosPeriodo)}
              sub={
                novosVar !== null
                  ? `${novosVar >= 0 ? "+" : ""}${novosVar.toFixed(1)}% vs período anterior`
                  : "—"
              }
              tone="green"
              loading={loading}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <AlertCard
                    title="Churn / Em Risco"
                    value={String(risco.length)}
                    sub="clientes em risco"
                    tone="orange"
                    loading={loading}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="text-xs space-y-0.5">
                  {Object.entries(riscoBreakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
            <AlertCard
              title="NPS"
              value={npsMedio.toFixed(1)}
              sub={`${npsRespostas} respostas`}
              tone={npsMedio > 8 ? "green" : npsMedio >= 6 ? "amber" : "red"}
              loading={loading}
              extra={
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
                  <div
                    className={cn(
                      "h-full rounded transition-all",
                      npsMedio > 8 ? "bg-emerald-500" : npsMedio >= 6 ? "bg-amber-500" : "bg-red-500",
                    )}
                    style={{ width: `${Math.max(0, Math.min(100, (npsMedio / 10) * 100))}%` }}
                  />
                </div>
              }
            />
            <AlertCard
              title="Unidades Ativas"
              value={String(unidadesAtivas)}
              sub={`de ${unidades.length} na rede`}
              tone="indigo"
              loading={loading}
              icon={<Building2 className="h-4 w-4" />}
            />
          </div>

          {/* SEÇÃO 3 — MRR por Unidade */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">MRR por Unidade</h2>
              <span className="text-xs text-muted-foreground">Total: {fmtBRL(mrr)}</span>
            </div>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, mrrPorUnidade.length * 28)}>
                <BarChart data={mrrPorUnidade} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="unidade" type="category" width={130} tick={{ fontSize: 11 }} />
                  <RTooltip
                    formatter={(v: number, _n, p) => [
                      `${fmtBRL(v)} (${p?.payload?.pct?.toFixed(1)}%)`,
                      "MRR",
                    ]}
                  />
                  <Bar dataKey="mrr">
                    {mrrPorUnidade.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* SEÇÃO 4 — Novos clientes por mês */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Novos Clientes — Últimos 6 Meses</h2>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={seriePorMes}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <RTooltip
                    formatter={(v: number, n) =>
                      n === "MRR adicionado" ? fmtBRL(v) : String(v)
                    }
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="novos" name="Novos clientes" fill="hsl(220 70% 50%)" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="mrr_add"
                    name="MRR adicionado"
                    stroke="hsl(160 60% 45%)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* SEÇÃO 5 — Radar de Clientes */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b p-3">
              <h2 className="text-sm font-semibold">Radar de Clientes — Top 10 alertas</h2>
              <Link
                to="/clientes"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : radar.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum cliente em alerta.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Empresa</th>
                    <th className="px-3 py-2 text-left">Unidade</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Último Pagamento</th>
                    <th className="px-3 py-2 text-right">Em Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {radar.map((r) => (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-t",
                        r.pipedrive_id && "cursor-pointer hover:bg-muted/40",
                      )}
                      onClick={() => {
                        if (r.pipedrive_id) {
                          window.open(`https://app.pipedrive.com/deal/${r.pipedrive_id}`, "_blank");
                        }
                      }}
                    >
                      <td className="px-3 py-2 font-medium">{r.razao_social}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.unidade}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtData(r.ultimoPag)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600">
                        {fmtBRL(r.valorAtraso)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </TooltipProvider>
    </AppShell>
  );
}

// ============================================================
// Sub-components
// ============================================================
function BigCard({
  title,
  value,
  exact,
  sub,
  icon,
  tone,
  extra,
  loading,
  to,
}: {
  title: string;
  value: string;
  exact?: string;
  sub: string;
  icon: React.ReactNode;
  tone: "indigo" | "blue" | "violet" | "emerald" | "emerald-dark";
  extra?: React.ReactNode;
  loading?: boolean;
  to?: string;
}) {
  const toneCls = {
    indigo: "text-indigo-700 dark:text-indigo-300",
    blue: "text-sky-600 dark:text-sky-300",
    violet: "text-violet-600 dark:text-violet-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    "emerald-dark": "text-emerald-800 dark:text-emerald-200",
  }[tone];

  return (
    <Card className={cn("p-4", to && "transition-shadow hover:shadow-md")}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {icon}
          {title}
        </span>
        {extra}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            {to ? (
              <Link to={to} className={cn("mt-1.5 block text-2xl font-bold hover:underline", toneCls)}>
                {value}
              </Link>
            ) : (
              <div className={cn("mt-1.5 text-2xl font-bold", toneCls)}>{value}</div>
            )}
          </TooltipTrigger>
          {exact && <TooltipContent>{exact}</TooltipContent>}
        </Tooltip>
      )}
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function AlertCard({
  title,
  value,
  sub,
  badge,
  tone,
  showAlert,
  loading,
  extra,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  badge?: string;
  tone: "red" | "amber" | "green" | "orange" | "indigo";
  showAlert?: boolean;
  loading?: boolean;
  extra?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const toneCls = {
    red: "text-red-600 dark:text-red-300",
    amber: "text-amber-600 dark:text-amber-300",
    green: "text-emerald-600 dark:text-emerald-300",
    orange: "text-orange-600 dark:text-orange-300",
    indigo: "text-indigo-600 dark:text-indigo-300",
  }[tone];
  const badgeCls = {
    red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {icon ?? (showAlert ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Smile className="h-4 w-4" />)}
          {title}
        </span>
        {badge && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", badgeCls)}>
            {badge}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <div className={cn("mt-1.5 text-xl font-bold", toneCls)}>{value}</div>
      )}
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      {extra}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    INADIMPLENTE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    NUNCA_PAGOU: "bg-slate-700 text-slate-100 dark:bg-slate-200 dark:text-slate-900",
    EM_ATRASO: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    SEM_ATIVIDADE: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    ATIVO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        map[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}
