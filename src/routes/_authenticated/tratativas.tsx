import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageSquareWarning, Search } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { usePermissions, unitMatches } from "@/hooks/use-permissions";
import { isFranquiaUnidade } from "@/lib/franquias";

export const Route = createFileRoute("/_authenticated/tratativas")({
  component: TratativasPage,
});

type Tratativa = {
  id: number;
  titulo: string | null;
  estagio: string | null;
  status: string | null;
  unidade: string | null;
  mrr: number | null;
  update_time: string | null;
  stage_change_time: string | null;
  motivo: string | null;
  data_churn: string | null;
  pipedrive_deal_id: number | null;
};

const NA = "—";
const COLORS = ["hsl(var(--primary))", "#ef4444", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#8b5cf6"];

function fmtMoney(v: number | null | undefined) {
  if (v == null) return NA;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtDate(s: string | null) {
  if (!s) return NA;
  const d = new Date(s);
  if (isNaN(d.getTime())) return NA;
  return d.toLocaleDateString("pt-BR");
}

function statusBadge(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "won") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Ganho</Badge>;
  if (s === "lost") return <Badge variant="destructive">Perdido</Badge>;
  if (s === "open") return <Badge variant="secondary">Aberto</Badge>;
  return <Badge variant="outline">{status ?? NA}</Badge>;
}

function TratativasPage() {
  const perms = usePermissions();
  const [rows, setRows] = useState<Tratativa[]>([]);
  const [ganhoEmPorDealId, setGanhoEmPorDealId] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [unidadeFilter, setUnidadeFilter] = useState<string>("__all__");
  const [estagioFilter, setEstagioFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [q, setQ] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [tratativasRes, contratosRes] = await Promise.all([
        supabase
          .from("central_tratativas")
          .select("id,titulo,estagio,status,unidade,mrr,update_time,stage_change_time,motivo,data_churn,pipedrive_deal_id")
          .limit(5000),
        supabase
          .from("contratos")
          .select("pipedrive_deal_id,ganho_em")
          .not("pipedrive_deal_id", "is", null)
          .not("ganho_em", "is", null)
          .limit(10000),
      ]);
      if (!mounted) return;
      if (tratativasRes.data) setRows(tratativasRes.data as Tratativa[]);
      if (contratosRes.data) {
        const map = new Map<string, string>();
        for (const c of contratosRes.data as { pipedrive_deal_id: string | null; ganho_em: string | null }[]) {
          if (c.pipedrive_deal_id && c.ganho_em) map.set(String(c.pipedrive_deal_id), c.ganho_em);
        }
        setGanhoEmPorDealId(map);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function tenureDias(r: Tratativa): number | null {
    if (r.pipedrive_deal_id == null || !r.data_churn) return null;
    const ganhoEm = ganhoEmPorDealId.get(String(r.pipedrive_deal_id));
    if (!ganhoEm) return null;
    const inicio = new Date(ganhoEm).getTime();
    const fim = new Date(r.data_churn).getTime();
    if (isNaN(inicio) || isNaN(fim) || fim < inicio) return null;
    return Math.round((fim - inicio) / (1000 * 60 * 60 * 24));
  }

  function fmtTenure(dias: number | null): string {
    if (dias == null) return NA;
    const meses = dias / 30;
    if (meses < 1) return `${dias} dias`;
    return `${meses.toFixed(1)} meses`;
  }

  const visiveis = useMemo(() => {
    // Hard filter: somente unidades da rede de franquias (OpsBoard).
    const onlyFranchise = rows.filter((r) => isFranquiaUnidade(r.unidade));
    if (perms.scopedToOwnUnit && perms.unidade) {
      return onlyFranchise.filter((r) => unitMatches(perms.unidade, r.unidade ?? ""));
    }
    return onlyFranchise;
  }, [rows, perms.scopedToOwnUnit, perms.unidade]);

  const unidades = useMemo(
    () => Array.from(new Set(visiveis.map((r) => r.unidade ?? NA))).sort(),
    [visiveis],
  );
  const estagios = useMemo(
    () => Array.from(new Set(visiveis.map((r) => r.estagio ?? NA))).sort(),
    [visiveis],
  );
  const statuses = useMemo(
    () => Array.from(new Set(visiveis.map((r) => r.status ?? NA))).sort(),
    [visiveis],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return visiveis.filter((r) => {
      if (unidadeFilter !== "__all__" && (r.unidade ?? NA) !== unidadeFilter) return false;
      if (estagioFilter !== "__all__" && (r.estagio ?? NA) !== estagioFilter) return false;
      if (statusFilter !== "__all__" && (r.status ?? NA) !== statusFilter) return false;
      if (term && !(r.titulo ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [visiveis, unidadeFilter, estagioFilter, statusFilter, q]);

  const kpis = useMemo(() => {
    let perdidos = 0;
    let recuperados = 0;
    let abertos = 0;
    let mrrPerdido = 0;
    let mrrRecuperado = 0;
    const tenures: number[] = [];
    for (const r of filtered) {
      const s = (r.status ?? "").toLowerCase();
      const mrr = r.mrr ?? 0;
      if (s === "lost") {
        perdidos += 1;
        mrrPerdido += mrr;
        const t = tenureDias(r);
        if (t != null) tenures.push(t);
      } else if (s === "won") {
        recuperados += 1;
        mrrRecuperado += mrr;
      } else if (s === "open") {
        abertos += 1;
      }
    }
    const tenureMedioDias = tenures.length > 0 ? tenures.reduce((a, b) => a + b, 0) / tenures.length : null;
    return {
      total: filtered.length,
      perdidos,
      recuperados,
      abertos,
      mrrPerdido,
      mrrRecuperado,
      taxaRecuperacao: perdidos + recuperados > 0 ? (recuperados / (perdidos + recuperados)) * 100 : 0,
      tenureMedioDias,
      tenureAmostra: tenures.length,
    };
  }, [filtered, ganhoEmPorDealId]);

  const motivosPerda = useMemo(() => {
    const map = new Map<string, { motivo: string; count: number; mrr: number }>();
    for (const r of filtered) {
      if ((r.status ?? "").toLowerCase() !== "lost") continue;
      const motivo = (r.motivo ?? "").trim();
      if (!motivo) continue;
      const g = map.get(motivo) ?? { motivo, count: 0, mrr: 0 };
      g.count += 1;
      g.mrr += r.mrr ?? 0;
      map.set(motivo, g);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const perdidosSemMotivo = useMemo(
    () => filtered.filter((r) => (r.status ?? "").toLowerCase() === "lost" && !(r.motivo ?? "").trim()).length,
    [filtered],
  );

  const porUnidade = useMemo(() => {
    const map = new Map<string, { unidade: string; total: number; perdidos: number; recuperados: number; mrrPerdido: number }>();
    for (const r of filtered) {
      const u = r.unidade ?? NA;
      const g = map.get(u) ?? { unidade: u, total: 0, perdidos: 0, recuperados: 0, mrrPerdido: 0 };
      g.total += 1;
      const s = (r.status ?? "").toLowerCase();
      if (s === "lost") {
        g.perdidos += 1;
        g.mrrPerdido += r.mrr ?? 0;
      } else if (s === "won") {
        g.recuperados += 1;
      }
      map.set(u, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const porEstagio = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const e = r.estagio ?? NA;
      map.set(e, (map.get(e) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const tabela = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const da = a.update_time ? new Date(a.update_time).getTime() : 0;
        const db = b.update_time ? new Date(b.update_time).getTime() : 0;
        return db - da;
      }),
    [filtered],
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <MessageSquareWarning className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Tratativas</h1>
          <p className="text-sm text-muted-foreground">
            Análise gerencial de churn, recuperações e tratativas em aberto
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{kpis.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Em aberto</div>
          <div className="text-2xl font-bold">{kpis.abertos}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Perdidos</div>
          <div className="text-2xl font-bold text-destructive">{kpis.perdidos}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Recuperados</div>
          <div className="text-2xl font-bold text-emerald-600">{kpis.recuperados}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">MRR perdido</div>
          <div className="text-xl font-bold text-destructive">{fmtMoney(kpis.mrrPerdido)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Taxa de recuperação</div>
          <div className="text-2xl font-bold">{kpis.taxaRecuperacao.toFixed(1)}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Tempo médio até churn</div>
          <div className="text-xl font-bold">{fmtTenure(kpis.tenureMedioDias)}</div>
          <div className="text-[11px] text-muted-foreground">
            {kpis.tenureAmostra > 0 ? `${kpis.tenureAmostra} caso(s) com contrato + data de churn` : "sem dados suficientes"}
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título…"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
            <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as unidades</SelectItem>
              {unidades.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={estagioFilter} onValueChange={setEstagioFilter}>
            <SelectTrigger><SelectValue placeholder="Estágio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os estágios</SelectItem>
              {estagios.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os status</SelectItem>
              {statuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold">Tratativas por unidade</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porUnidade}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="unidade" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="perdidos" stackId="a" fill="#ef4444" name="Perdidos" />
                <Bar dataKey="recuperados" stackId="a" fill="#10b981" name="Recuperados" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold">Distribuição por estágio</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porEstagio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {porEstagio.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Motivos de perda */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="text-sm font-semibold">Motivos de perda</div>
          {perdidosSemMotivo > 0 && (
            <div className="text-xs text-muted-foreground">
              {perdidosSemMotivo} perdido(s) sem motivo registrado no Pipefy
            </div>
          )}
        </div>
        {motivosPerda.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            Nenhum motivo de perda registrado ainda para os filtros atuais.
          </div>
        ) : (
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="bg-background">Motivo</TableHead>
                  <TableHead className="bg-background text-right">Ocorrências</TableHead>
                  <TableHead className="bg-background text-right">MRR perdido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {motivosPerda.map((m) => (
                  <TableRow key={m.motivo}>
                    <TableCell className="font-medium">{m.motivo}</TableCell>
                    <TableCell className="text-right">{m.count}</TableCell>
                    <TableCell className="text-right">{fmtMoney(m.mrr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}
      </Card>

      {/* Resumo por unidade */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="text-sm font-semibold">Resumo por unidade</div>
        </div>
        <div className="overflow-auto max-h-[360px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b">
                <TableHead className="bg-background">Unidade</TableHead>
                <TableHead className="bg-background text-right">Total</TableHead>
                <TableHead className="bg-background text-right">Perdidos</TableHead>
                <TableHead className="bg-background text-right">Recuperados</TableHead>
                <TableHead className="bg-background text-right">MRR perdido</TableHead>
                <TableHead className="bg-background text-right">% recuperação</TableHead>
              </tr>
            </thead>
            <TableBody>
              {porUnidade.map((u) => {
                const denom = u.perdidos + u.recuperados;
                const taxa = denom > 0 ? (u.recuperados / denom) * 100 : 0;
                return (
                  <TableRow key={u.unidade}>
                    <TableCell className="font-medium">{u.unidade}</TableCell>
                    <TableCell className="text-right">{u.total}</TableCell>
                    <TableCell className="text-right text-destructive">{u.perdidos}</TableCell>
                    <TableCell className="text-right text-emerald-600">{u.recuperados}</TableCell>
                    <TableCell className="text-right">{fmtMoney(u.mrrPerdido)}</TableCell>
                    <TableCell className="text-right">{taxa.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        </div>
      </Card>

      {/* Tabela detalhada */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="text-sm font-semibold">Tratativas</div>
          <div className="text-xs text-muted-foreground">{loading ? "Carregando…" : `${tabela.length} registros`}</div>
        </div>
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead className="bg-background">Título</TableHead>
                <TableHead className="bg-background">Unidade</TableHead>
                <TableHead className="bg-background">Estágio</TableHead>
                <TableHead className="bg-background">Status</TableHead>
                <TableHead className="bg-background text-right">MRR</TableHead>
                <TableHead className="bg-background">Motivo da perda</TableHead>
                <TableHead className="bg-background">Tempo como cliente</TableHead>
                <TableHead className="bg-background">Mudança de estágio</TableHead>
                <TableHead className="bg-background">Última atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tabela.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.titulo ?? NA}</TableCell>
                  <TableCell>{r.unidade ?? NA}</TableCell>
                  <TableCell>{r.estagio ?? NA}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.mrr)}</TableCell>
                  <TableCell className="max-w-[280px] truncate" title={r.motivo ?? undefined}>
                    {r.motivo ?? NA}
                  </TableCell>
                  <TableCell>{fmtTenure(tenureDias(r))}</TableCell>
                  <TableCell>{fmtDate(r.stage_change_time)}</TableCell>
                  <TableCell>{fmtDate(r.update_time)}</TableCell>
                </TableRow>
              ))}
              {!loading && tabela.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Nenhuma tratativa encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
      </Card>
    </div>
  );
}
