import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dre-partners")({
  head: () => ({
    meta: [
      { title: "DRE Partners – Planning" },
      { name: "description", content: "Demonstração de Resultado Gerencial da Planning Partners Brasil." },
    ],
  }),
  component: DREPartnersPage,
});

// ============================================================
// Types
// ============================================================
type Lanc = {
  tipo: string | null;
  categoria_codigo: string | null;
  departamento: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  valor_documento: number | null;
  status_titulo: string | null;
  numero_documento: string | null;
  codigo_lancamento_omie: number | null;
  codigo_cliente_fornecedor: number | null;
  razao_social: string | null;
};


type Visao = "realizado" | "projetado";

// ============================================================
// Helpers
// ============================================================
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_REAL = new Set(["PAGO", "RECEBIDO"]);
const STATUS_PROJ = new Set(["PAGO", "RECEBIDO", "A VENCER", "ATRASADO"]);

const RECEITA_RECORRENTE = new Set(["1.01.95", "1.01.93", "1.01.96", "1.01.97", "1.01.99"]);

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const DEPT_COLORS = [
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
// DRE structure
// ============================================================
type LineMatcher = (cod: string) => boolean;
type DRELine = { label: string; match: LineMatcher };
type DREGroup = { label: string; lines: DRELine[]; isCatchAll?: boolean };

const exact = (...codes: string[]): LineMatcher => (c) => codes.includes(c);
const prefixExcept = (prefix: string, except: string[]): LineMatcher => (c) =>
  c.startsWith(prefix) && !except.includes(c);

const RECEITAS_GROUPS: DREGroup[] = [
  {
    label: "Receita Operacional",
    lines: [
      { label: "Royalties", match: exact("1.01.95", "1.01.93") },
      { label: "CSC Expansão", match: exact("1.01.96") },
      { label: "Taxa de Expansão", match: exact("1.01.97") },
      { label: "Outras Receitas - Expansão", match: exact("1.01.94") },
      { label: "Receita com Serviços", match: exact("1.01.99") },
    ],
  },
  {
    label: "Reembolsos Recebidos",
    lines: [
      { label: "CSC - Tráfego Pago CAC", match: exact("1.03.96") },
      { label: "Reembolso de Tráfego Pago", match: exact("1.01.98", "1.03.97") },
      { label: "Outros Reembolsos", match: prefixExcept("1.03.", ["1.03.96", "1.03.97"]) },
    ],
  },
  {
    label: "Outras Receitas",
    isCatchAll: true,
    lines: [
      { label: "Aportes de Sócios", match: exact("1.04.02") },
      { label: "Rendimentos de Aplicações", match: exact("1.02.02") },
    ],
  },
];

const DESPESAS_GROUPS: DREGroup[] = [
  {
    label: "Pessoal",
    lines: [
      { label: "Salários e CLT", match: exact("2.03.01") },
      { label: "Serviços de Terceiros PJ", match: exact("2.03.99") },
      { label: "Outros encargos/benefícios", match: prefixExcept("2.03.", ["2.03.01", "2.03.99"]) },
    ],
  },
  {
    label: "Comercial & Marketing",
    lines: [
      { label: "Tráfego Pago", match: exact("2.02.98") },
      { label: "Comissões", match: exact("2.02.01") },
      { label: "Mídias", match: exact("2.02.99") },
      { label: "Demais comercial/marketing", match: prefixExcept("2.02.", ["2.02.98", "2.02.01", "2.02.99"]) },
    ],
  },
  {
    label: "Repasses",
    lines: [
      { label: "Repasse - Indicação Externa", match: exact("2.01.99") },
      { label: "Repasse - Indicação Interna", match: exact("2.01.98") },
    ],
  },
  {
    label: "Despesas Administrativas",
    lines: [
      { label: "Softwares e SaaS", match: exact("2.04.99") },
      { label: "Locação de Máq/Equip", match: exact("2.04.96") },
      { label: "Serviço de Consultoria", match: exact("2.04.95") },
      { label: "Cursos e Treinamentos", match: exact("2.04.97") },
      { label: "Aquisição de Máquinas", match: exact("2.04.94") },
      {
        label: "Demais despesas adm",
        match: prefixExcept("2.04.", ["2.04.99", "2.04.96", "2.04.95", "2.04.97", "2.04.94"]),
      },
    ],
  },
  {
    label: "Outros",
    isCatchAll: true,
    lines: [{ label: "Devoluções de Serviços", match: exact("2.08.99") }],
  },
];

// ============================================================
// Page
// ============================================================
export function DREPartnersPage() {
  useAuth();
  const now = new Date();
  const [ano, setAno] = useState<number>(2026);
  const [mes, setMes] = useState<string>("todos"); // "todos" | "0".."11"
  const [visao, setVisao] = useState<Visao>("realizado");
  const [data, setData] = useState<Lanc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ label: string; items: Lanc[] } | null>(null);
  const [categoriaMap, setCategoriaMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      // Carrega o ano todo + projeção 6 meses (próximos 6 meses do ano corrente real)
      const startYear = ano;
      const endYear = ano + 1;
      const { data: rows } = await supabase
        .from("partners_financeiro")
        .select("tipo,categoria_codigo,departamento,data_emissao,data_vencimento,valor_documento,status_titulo,numero_documento,codigo_lancamento_omie,codigo_cliente_fornecedor,razao_social")
        .gte("data_vencimento", `${startYear}-01-01`)
        .lt("data_vencimento", `${endYear + 1}-01-01`)
        .neq("status_titulo", "CANCELADO")
        .limit(20000);
      const { data: sync } = await supabase
        .from("partners_financeiro")
        .select("synced_at")
        .order("synced_at", { ascending: false, nullsFirst: false })
        .limit(1);
      const { data: cats } = await supabase
        .from("categorias_omie")
        .select("codigo,descricao")
        .limit(5000);
      if (!mounted) return;
      setData((rows ?? []) as Lanc[]);
      setLastSync(sync?.[0]?.synced_at ?? null);
      const cm = new Map<string, string>();
      (cats ?? []).forEach((c: any) => cm.set(c.codigo, c.descricao));
      setCategoriaMap(cm);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [ano, refreshKey]);

  // Filtro do ano/mês/visão aplicado
  const filtered = useMemo(() => {
    const allowed = visao === "realizado" ? STATUS_REAL : STATUS_PROJ;
    return data.filter((r) => {
      if (!r.data_vencimento) return false;
      if (!allowed.has(r.status_titulo ?? "")) return false;
      const d = new Date(r.data_vencimento);
      if (d.getFullYear() !== ano) return false;
      if (mes !== "todos" && d.getMonth() !== Number(mes)) return false;
      return true;
    });
  }, [data, ano, mes, visao]);

  // ============================================================
  // KPIs
  // ============================================================
  const totalReceitas = useMemo(
    () => filtered.filter((r) => r.tipo === "RECEBER").reduce((s, r) => s + (r.valor_documento ?? 0), 0),
    [filtered],
  );
  const totalDespesas = useMemo(
    () => filtered.filter((r) => r.tipo === "PAGAR").reduce((s, r) => s + (r.valor_documento ?? 0), 0),
    [filtered],
  );
  const resultado = totalReceitas - totalDespesas;

  const aReceberPend = useMemo(() => {
    // independente do toggle, sempre A VENCER/ATRASADO do período
    const items = data.filter((r) => {
      if (r.tipo !== "RECEBER") return false;
      if (!["A VENCER", "ATRASADO"].includes(r.status_titulo ?? "")) return false;
      if (!r.data_vencimento) return false;
      const d = new Date(r.data_vencimento);
      if (d.getFullYear() !== ano) return false;
      if (mes !== "todos" && d.getMonth() !== Number(mes)) return false;
      return true;
    });
    return { total: items.reduce((s, r) => s + (r.valor_documento ?? 0), 0), count: items.length };
  }, [data, ano, mes]);

  // ============================================================
  // DRE table
  // ============================================================
  const dreData = useMemo(() => {
    const receitas = filtered.filter((r) => r.tipo === "RECEBER");
    const despesas = filtered.filter((r) => r.tipo === "PAGAR");

    const buildGroup = (group: DREGroup, pool: Lanc[]) => {
      const matchedCodes = new Set<string>();
      const lines = group.lines.map((line) => {
        const items = pool.filter((r) => {
          const c = r.categoria_codigo ?? "";
          if (line.match(c)) {
            matchedCodes.add(c);
            return true;
          }
          return false;
        });
        return {
          label: line.label,
          valor: items.reduce((s, r) => s + (r.valor_documento ?? 0), 0),
          items,
        };
      });
      const subtotal = lines.reduce((s, l) => s + l.valor, 0);
      return { ...group, lines, subtotal, matchedCodes };
    };

    const receitasGroups = RECEITAS_GROUPS.map((g) => buildGroup(g, receitas));
    const allMatchedReceita = new Set<string>();
    receitasGroups.forEach((g) => g.matchedCodes.forEach((c) => allMatchedReceita.add(c)));
    const naoMapeadasRec = receitas.filter((r) => !allMatchedReceita.has(r.categoria_codigo ?? ""));
    const outrasIdx = receitasGroups.findIndex((g) => g.isCatchAll);
    if (outrasIdx >= 0 && naoMapeadasRec.length) {
      const v = naoMapeadasRec.reduce((s, r) => s + (r.valor_documento ?? 0), 0);
      receitasGroups[outrasIdx].lines.push({
        label: "Demais receitas não mapeadas",
        valor: v,
        items: naoMapeadasRec,
      });
      receitasGroups[outrasIdx].subtotal += v;
    }

    const despesasGroups = DESPESAS_GROUPS.map((g) => buildGroup(g, despesas));
    const allMatchedDesp = new Set<string>();
    despesasGroups.forEach((g) => g.matchedCodes.forEach((c) => allMatchedDesp.add(c)));
    const naoMapeadasDesp = despesas.filter((r) => !allMatchedDesp.has(r.categoria_codigo ?? ""));
    const outrosIdx = despesasGroups.findIndex((g) => g.isCatchAll);
    if (outrosIdx >= 0 && naoMapeadasDesp.length) {
      const v = naoMapeadasDesp.reduce((s, r) => s + (r.valor_documento ?? 0), 0);
      despesasGroups[outrosIdx].lines.push({
        label: "Despesas não classificadas",
        valor: v,
        items: naoMapeadasDesp,
      });
      despesasGroups[outrosIdx].subtotal += v;
    }


    return { receitasGroups, despesasGroups };
  }, [filtered]);

  // ============================================================
  // Despesas por departamento
  // ============================================================
  const deptData = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter((r) => r.tipo === "PAGAR")
      .forEach((r) => {
        const d = r.departamento || "Não classificado";
        map.set(d, (map.get(d) ?? 0) + (r.valor_documento ?? 0));
      });
    const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr;
  }, [filtered]);

  // ============================================================
  // Evolução mensal
  // ============================================================
  const evolucao = useMemo(() => {
    const allowed = visao === "realizado" ? STATUS_REAL : STATUS_PROJ;
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES[i],
      receitas: 0,
      despesas: 0,
      resultado: 0,
      acumulado: 0,
    }));
    data.forEach((r) => {
      if (!r.data_vencimento) return;
      if (!allowed.has(r.status_titulo ?? "")) return;
      const d = new Date(r.data_vencimento);
      if (d.getFullYear() !== ano) return;
      const i = d.getMonth();
      const v = r.valor_documento ?? 0;
      if (r.tipo === "RECEBER") buckets[i].receitas += v;
      else if (r.tipo === "PAGAR") buckets[i].despesas += v;
    });
    let acum = 0;
    buckets.forEach((b) => {
      b.resultado = b.receitas - b.despesas;
      acum += b.resultado;
      b.acumulado = acum;
    });
    return buckets;
  }, [data, ano, visao]);


  // ============================================================
  // Render
  // ============================================================
  return (
    <AppShell title="DFC Partners" subtitle="Planning Partners Brasil Ltda — Demonstrativo Financeiro de Caixa">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {/* Controles */}
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {MESES.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 rounded-md border p-1">
            <button
              onClick={() => setVisao("realizado")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium",
                visao === "realizado" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Realizado
            </button>
            <button
              onClick={() => setVisao("projetado")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium",
                visao === "projetado" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Realizado + A Vencer
            </button>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {lastSync && (
              <span className="text-xs text-muted-foreground">
                Última atualização: {new Date(lastSync).toLocaleString("pt-BR")}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
            </Button>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <KpiBox
            label="Total Receitas"
            value={totalReceitas}
            tone="green"
            icon={<TrendingUp className="h-4 w-4" />}
            loading={loading}
          />
          <KpiBox
            label="Total Despesas"
            value={totalDespesas}
            tone="red"
            icon={<TrendingDown className="h-4 w-4" />}
            loading={loading}
          />
          <KpiBox
            label="Resultado"
            value={resultado}
            tone={resultado >= 0 ? "green" : "red"}
            icon={<Wallet className="h-4 w-4" />}
            loading={loading}
          />
          <KpiBox
            label="A Receber Pendente"
            value={aReceberPend.total}
            tone="amber"
            icon={<AlertCircle className="h-4 w-4" />}
            sub={`${aReceberPend.count} lançamentos em aberto`}
            loading={loading}
          />
        </div>

        {/* DRE Tabela */}
        <Card className="overflow-hidden">
          <div className="border-b p-3 text-sm font-semibold">DFC</div>
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <DRETable
              receitasGroups={dreData.receitasGroups}
              despesasGroups={dreData.despesasGroups}
              totalReceitas={totalReceitas}
              totalDespesas={totalDespesas}
              resultado={resultado}
              onDrill={(label, items) => setDrill({ label, items })}
            />
          )}
        </Card>


        {/* Gráficos lado a lado */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">Despesas por Departamento</div>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : deptData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Sem despesas no período.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={deptData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      {deptData.map((_, i) => (
                        <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: number) => fmtBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 self-center text-xs">
                  {deptData.map((d, i) => {
                    const total = deptData.reduce((s, x) => s + x.value, 0) || 1;
                    return (
                      <div key={d.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded"
                            style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }}
                          />
                          {d.name}
                        </span>
                        <span className="text-muted-foreground">
                          {fmtBRL(d.value)} ({((d.value / total) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold">Evolução Mensal {ano}</div>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <RTooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="receitas" fill="hsl(160 60% 45%)" name="Receitas" />
                  <Bar yAxisId="left" dataKey="despesas" fill="hsl(0 70% 55%)" name="Despesas" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="acumulado"
                    stroke="hsl(30 90% 50%)"
                    name="Resultado acum."
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

      </div>
      <DrillDialog drill={drill} onClose={() => setDrill(null)} categoriaMap={categoriaMap} />
    </AppShell>
  );
}


// ============================================================
// Sub-components
// ============================================================
function KpiBox({
  label,
  value,
  tone,
  icon,
  sub,
  loading,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "amber";
  icon: React.ReactNode;
  sub?: string;
  loading?: boolean;
}) {
  const toneCls = {
    green: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={toneCls}>{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-32" />
      ) : (
        <div className={cn("mt-2 text-2xl font-bold", toneCls)}>{fmtBRL(value)}</div>
      )}
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

type GroupLine = { label: string; valor: number; items: Lanc[] };
type GroupData = { label: string; lines: GroupLine[]; subtotal: number };

function DRETable({
  receitasGroups,
  despesasGroups,
  totalReceitas,
  totalDespesas,
  resultado,
  onDrill,
}: {
  receitasGroups: GroupData[];
  despesasGroups: GroupData[];
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  onDrill: (label: string, items: Lanc[]) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !(p[k] ?? true) }));
  const isOpen = (k: string) => open[k] ?? true;
  const pct = (v: number) => (totalReceitas > 0 ? `${((v / totalReceitas) * 100).toFixed(1)}%` : "—");

  const groupItems = (g: GroupData) => g.lines.flatMap((l) => l.items);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descrição</TableHead>
          <TableHead className="text-right">Realizado</TableHead>
          <TableHead className="text-right w-24">% Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="bg-emerald-50 dark:bg-emerald-950/30">
          <TableCell colSpan={3} className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Receitas
          </TableCell>
        </TableRow>
        {receitasGroups.map((g) => (
          <GroupRows
            key={`r-${g.label}`}
            group={g}
            open={isOpen(`r-${g.label}`)}
            onToggle={() => toggle(`r-${g.label}`)}
            pct={pct}
            onDrill={onDrill}
            onDrillGroup={() => onDrill(g.label, groupItems(g))}
          />
        ))}
        <TableRow className="bg-emerald-100/60 dark:bg-emerald-950/50">
          <TableCell className="font-bold">TOTAL RECEITAS</TableCell>
          <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-300">
            {fmtBRL(totalReceitas)}
          </TableCell>
          <TableCell className="text-right font-bold">100%</TableCell>
        </TableRow>

        <TableRow className="bg-red-50 dark:bg-red-950/30">
          <TableCell colSpan={3} className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
            Despesas
          </TableCell>
        </TableRow>
        {despesasGroups.map((g) => (
          <GroupRows
            key={`d-${g.label}`}
            group={g}
            open={isOpen(`d-${g.label}`)}
            onToggle={() => toggle(`d-${g.label}`)}
            pct={pct}
            onDrill={onDrill}
            onDrillGroup={() => onDrill(g.label, groupItems(g))}
          />
        ))}
        <TableRow className="bg-red-100/60 dark:bg-red-950/50">
          <TableCell className="font-bold">TOTAL DESPESAS</TableCell>
          <TableCell className="text-right font-bold text-red-700 dark:text-red-300">
            {fmtBRL(totalDespesas)}
          </TableCell>
          <TableCell className="text-right font-bold">{pct(totalDespesas)}</TableCell>
        </TableRow>

        <TableRow className={cn(resultado >= 0 ? "bg-emerald-100/80 dark:bg-emerald-900/50" : "bg-red-100/80 dark:bg-red-900/50")}>
          <TableCell className="text-base font-bold">RESULTADO OPERACIONAL</TableCell>
          <TableCell
            className={cn(
              "text-right text-base font-bold",
              resultado >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300",
            )}
          >
            {fmtBRL(resultado)}
          </TableCell>
          <TableCell className="text-right font-bold">{pct(resultado)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function GroupRows({
  group,
  open,
  onToggle,
  pct,
  onDrill,
  onDrillGroup,
}: {
  group: GroupData;
  open: boolean;
  onToggle: () => void;
  pct: (v: number) => string;
  onDrill: (label: string, items: Lanc[]) => void;
  onDrillGroup: () => void;
}) {
  return (
    <>
      <TableRow className="bg-muted/30 hover:bg-muted/50">
        <TableCell className="font-semibold">
          <span className="inline-flex items-center gap-1">
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1 hover:text-primary"
              type="button"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {group.label}
            </button>
          </span>
        </TableCell>
        <TableCell className="text-right font-semibold">
          <button
            type="button"
            onClick={onDrillGroup}
            className="hover:underline hover:text-primary"
            title="Ver lançamentos"
          >
            {fmtBRL(group.subtotal)}
          </button>
        </TableCell>
        <TableCell className="text-right font-semibold">{pct(group.subtotal)}</TableCell>
      </TableRow>
      {open &&
        group.lines.map((l) => (
          <TableRow
            key={l.label}
            className="cursor-pointer hover:bg-muted/40"
            onClick={() => onDrill(l.label, l.items)}
            title="Clique para ver lançamentos"
          >
            <TableCell className="pl-10 text-sm text-muted-foreground">
              {l.label}
              <span className="ml-2 text-[10px] text-muted-foreground/70">
                ({l.items.length})
              </span>
            </TableCell>
            <TableCell className="text-right text-sm">{fmtBRL(l.valor)}</TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">{pct(l.valor)}</TableCell>
          </TableRow>
        ))}
    </>
  );
}

function DrillDialog({
  drill,
  onClose,
  categoriaMap,
}: {
  drill: { label: string; items: Lanc[] } | null;
  onClose: () => void;
  categoriaMap: Map<string, string>;
}) {
  const items = drill?.items ?? [];
  const sorted = [...items].sort((a, b) =>
    (b.data_vencimento ?? "").localeCompare(a.data_vencimento ?? ""),
  );
  const total = items.reduce((s, r) => s + (r.valor_documento ?? 0), 0);

  const catNome = (codigo: string | null) =>
    (codigo && categoriaMap.get(codigo)) || "";

  const exportCsv = () => {
    const head = [
      "data_vencimento",
      "data_emissao",
      "tipo",
      "status",
      "categoria_codigo",
      "categoria_nome",
      "cliente_fornecedor",
      "departamento",
      "numero_documento",
      "codigo_lancamento_omie",
      "valor",
    ].join(";");
    const rows = sorted.map((r) =>
      [
        r.data_vencimento ?? "",
        r.data_emissao ?? "",
        r.tipo ?? "",
        r.status_titulo ?? "",
        r.categoria_codigo ?? "",
        catNome(r.categoria_codigo),
        r.razao_social ?? "",
        r.departamento ?? "",
        r.numero_documento ?? "",
        r.codigo_lancamento_omie ?? "",
        (r.valor_documento ?? 0).toFixed(2).replace(".", ","),
      ].join(";"),
    );
    const csv = [head, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dre_${drill?.label ?? "lancamentos"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={!!drill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{drill?.label}</DialogTitle>
          <DialogDescription>
            {items.length} lançamentos — Total: <strong>{fmtBRL(total)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!items.length}>
            Exportar CSV
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Cliente / Fornecedor</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Doc.</TableHead>
                <TableHead>Omie ID</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Sem lançamentos.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((r, i) => {
                  const catN = catNome(r.categoria_codigo);
                  const cf = r.razao_social ?? "";
                  return (
                  <TableRow key={`${r.codigo_lancamento_omie ?? i}-${i}`}>
                    <TableCell className="whitespace-nowrap">
                      {r.data_vencimento
                        ? new Date(r.data_vencimento).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.data_emissao
                        ? new Date(r.data_emissao).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {r.status_titulo ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono">{r.categoria_codigo ?? "—"}</div>
                      {catN && <div className="text-muted-foreground">{catN}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {cf || (r.codigo_cliente_fornecedor ? <span className="font-mono text-muted-foreground">#{r.codigo_cliente_fornecedor}</span> : "—")}
                    </TableCell>
                    <TableCell className="text-xs">{r.departamento ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.numero_documento ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.codigo_lancamento_omie ?? "—"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {fmtBRL(r.valor_documento ?? 0)}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

