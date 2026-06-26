import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import React from "react";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/rede-financeiro")({
  component: RedeFinanceiroPage,
});

type RoyaltiesRow = {
  mes: string | null;
  unidade: string | null;
  csc_valor: number | null;
  csc_valor_fixo: number | null;
  royalties_valor: number | null;
  total_due_matriz: number | null;
  faturado: number | null;
  recebido: number | null;
};

type Unidade = {
  nome_da_praca: string;
  midia_mensal: number | null;
};

const ALL = "__all__";

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtMes = (m: string | null | undefined) => {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  return `${mo}/${y?.slice(2)}`;
};

const COLORS = {
  csc: "hsl(221 83% 53%)",
  royalties: "hsl(142 71% 45%)",
  midia: "hsl(271 81% 56%)",
  taxa: "hsl(38 92% 50%)",
};

function RedeFinanceiroPage() {
  const [royalties, setRoyalties] = useState<RoyaltiesRow[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [unidadeFilter, setUnidadeFilter] = useState(ALL);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [r, u] = await Promise.all([
        supabase
          .from("v_royalties_mensais")
          .select("mes,unidade,csc_valor,csc_valor_fixo,royalties_valor,total_due_matriz,faturado,recebido")
          .order("mes", { ascending: true }),
        supabase
          .from("unidades")
          .select("nome_da_praca,midia_mensal")
          .neq("tipo", "interna"),
      ]);
      if (!mounted) return;
      setRoyalties((r.data ?? []) as RoyaltiesRow[]);
      setUnidades((u.data ?? []) as Unidade[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const midiaByUnidade = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of unidades) {
      map.set(u.nome_da_praca, u.midia_mensal ?? 0);
    }
    return map;
  }, [unidades]);

  const unidadesOpts = useMemo(
    () => Array.from(new Set(royalties.map((r) => r.unidade).filter(Boolean) as string[])).sort(),
    [royalties],
  );

  const filtered = useMemo(
    () => royalties.filter((r) => unidadeFilter === ALL || r.unidade === unidadeFilter),
    [royalties, unidadeFilter],
  );

  const enriched = useMemo(
    () => filtered.map((r) => ({
      ...r,
      midia: r.unidade ? (midiaByUnidade.get(r.unidade) ?? 0) : 0,
      csc: r.csc_valor ?? r.csc_valor_fixo ?? 0,
    })),
    [filtered, midiaByUnidade],
  );

  const byMes = useMemo(() => {
    const map = new Map<string, { csc: number; royalties: number; midia: number; total: number; faturado: number }>();
    for (const r of enriched) {
      const m = r.mes ?? "";
      if (!m) continue;
      const cur = map.get(m) ?? { csc: 0, royalties: 0, midia: 0, total: 0, faturado: 0 };
      cur.csc += r.csc;
      cur.royalties += r.royalties_valor ?? 0;
      cur.midia += r.midia;
      cur.faturado += r.faturado ?? 0;
      cur.total += (r.csc) + (r.royalties_valor ?? 0) + r.midia;
      map.set(m, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, label: fmtMes(mes), ...v }));
  }, [enriched]);

  const ultimoMes = byMes[byMes.length - 1];

  const kpis = useMemo(() => {
    if (!ultimoMes) return { total: 0, csc: 0, royalties: 0, midia: 0 };
    return {
      total: ultimoMes.total,
      csc: ultimoMes.csc,
      royalties: ultimoMes.royalties,
      midia: ultimoMes.midia,
    };
  }, [ultimoMes]);

  const { pivot, months } = useMemo(() => {
    const umap = new Map<string, PivotUnidade>();
    const monthsSet = new Set<string>();

    for (const r of enriched) {
      const m = r.mes ?? "";
      const u = r.unidade ?? "—";
      if (!m) continue;
      monthsSet.add(m);

      if (!umap.has(u)) {
        umap.set(u, { nome: u, monthly: {}, csc: {}, royalties: {}, midia: {}, total: 0 });
      }
      const p = umap.get(u)!;
      const cscVal = r.csc;
      const royVal = r.royalties_valor ?? 0;
      const midVal = r.midia;
      const rowTotal = cscVal + royVal + midVal;

      p.monthly[m] = (p.monthly[m] ?? 0) + rowTotal;
      p.csc[m] = (p.csc[m] ?? 0) + cscVal;
      p.royalties[m] = (p.royalties[m] ?? 0) + royVal;
      p.midia[m] = (p.midia[m] ?? 0) + midVal;
      p.total += rowTotal;
    }

    const sortedMonths = Array.from(monthsSet).sort();
    const sortedPivot = Array.from(umap.values()).sort((a, b) => b.total - a.total);
    return { pivot: sortedPivot, months: sortedMonths };
  }, [enriched]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro — Gestão da Rede</h1>
            <p className="text-sm text-muted-foreground">CSC, Royalties e Mídia por unidade</p>
          </div>
        </div>
        <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {unidadesOpts.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Card className="p-4 lg:col-span-2">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="mt-1 text-xl font-bold">{fmtBRL(kpis.total)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">último mês</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">CSC</div>
          <div className="mt-1 text-xl font-bold">{fmtBRL(kpis.csc)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Mídia</div>
          <div className="mt-1 text-xl font-bold">{fmtBRL(kpis.midia)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Royalties</div>
          <div className="mt-1 text-xl font-bold">{fmtBRL(kpis.royalties)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Taxa de Franquia</div>
          <div className="mt-1 text-xl font-bold text-muted-foreground">—</div>
          <div className="text-xs text-muted-foreground mt-0.5">via Omie</div>
        </Card>
      </div>

      {loading && <Card className="p-6 text-sm text-muted-foreground">Carregando dados…</Card>}

      {!loading && byMes.length > 0 && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Stacked bar por tipo */}
            <Card className="p-4">
              <div className="mb-2 text-sm font-medium">Faturamento por Tipo e Mês</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMes}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Legend />
                    <Bar dataKey="csc" name="CSC" stackId="a" fill={COLORS.csc} />
                    <Bar dataKey="royalties" name="Royalties" stackId="a" fill={COLORS.royalties} />
                    <Bar dataKey="midia" name="Mídia" stackId="a" fill={COLORS.midia} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Linha de tendência */}
            <Card className="p-4">
              <div className="mb-2 text-sm font-medium">Tendência por Componente</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={byMes}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="csc" name="CSC" stroke={COLORS.csc} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="royalties" name="Royalties" stroke={COLORS.royalties} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="midia" name="Mídia" stroke={COLORS.midia} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="hsl(0 0% 40%)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Tabela de Faturamento — pivot por unidade */}
          <PivotTable pivot={pivot} months={months} />
        </>
      )}
    </div>
  );
}

type PivotUnidade = {
  nome: string;
  monthly: Record<string, number>;
  csc: Record<string, number>;
  royalties: Record<string, number>;
  midia: Record<string, number>;
  total: number;
};

function PivotTable({ pivot, months }: { pivot: PivotUnidade[]; months: string[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (nome: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });

  const grandTotal = useMemo(() => {
    const monthly: Record<string, number> = {};
    let total = 0;
    for (const u of pivot) {
      for (const m of months) {
        monthly[m] = (monthly[m] ?? 0) + (u.monthly[m] ?? 0);
      }
      total += u.total;
    }
    return { monthly, total };
  }, [pivot, months]);

  const SUB_ROWS = [
    { key: "csc" as const, label: "CSC" },
    { key: "royalties" as const, label: "Royalties" },
    { key: "midia" as const, label: "Mídia" },
  ];

  return (
    <Card className="overflow-x-auto">
      <div className="border-b p-3 text-sm font-semibold">Faturamento por Unidade</div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="sticky left-0 bg-muted/50 w-[200px] font-semibold">Unidade</TableHead>
            {months.map((m) => (
              <TableHead key={m} className="text-right min-w-[110px] font-semibold">
                {fmtMes(m)}
              </TableHead>
            ))}
            <TableHead className="text-right min-w-[120px] font-semibold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pivot.map((u) => {
            const isOpen = expanded.has(u.nome);
            return (
              <React.Fragment key={u.nome}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40 bg-muted/20"
                  onClick={() => toggle(u.nome)}
                >
                  <TableCell className="sticky left-0 bg-muted/20 py-2 font-semibold">
                    <div className="flex items-center gap-2">
                      {isOpen
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      {u.nome}
                    </div>
                  </TableCell>
                  {months.map((m) => (
                    <TableCell key={m} className="text-right tabular-nums py-2 font-semibold">
                      {u.monthly[m] ? fmtBRL(u.monthly[m]) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums py-2 font-bold">
                    {fmtBRL(u.total)}
                  </TableCell>
                </TableRow>
                {isOpen && SUB_ROWS.map(({ key, label }) => (
                  <TableRow key={`${u.nome}|${key}`} className="hover:bg-muted/10">
                    <TableCell className="sticky left-0 bg-background pl-10 py-1.5 text-sm text-muted-foreground">
                      {label}
                    </TableCell>
                    {months.map((m) => (
                      <TableCell key={m} className="text-right tabular-nums py-1.5 text-sm">
                        {u[key][m] ? fmtBRL(u[key][m]) : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums py-1.5 text-sm font-medium">
                      {fmtBRL(Object.values(u[key]).reduce((s, v) => s + v, 0) || null)}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/40 font-bold">
            <td className="sticky left-0 bg-muted/40 py-2.5 px-4 text-sm">Grand Total</td>
            {months.map((m) => (
              <td key={m} className="py-2.5 px-4 text-right tabular-nums text-sm">
                {grandTotal.monthly[m] ? fmtBRL(grandTotal.monthly[m]) : "—"}
              </td>
            ))}
            <td className="py-2.5 px-4 text-right tabular-nums text-sm">
              {fmtBRL(grandTotal.total)}
            </td>
          </tr>
        </tfoot>
      </Table>
    </Card>
  );
}
