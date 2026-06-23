import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Coins, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pagamentos-unidades")({
  component: PagamentosUnidadesPage,
});

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

type PfRow = {
  id: number;
  razao_social: string | null;
  cnpj: string | null;
  codigo_categoria: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor_documento: number;
  valor_recebido: number;
  status_titulo: string;
};

type LinhaResumo = {
  codigo: string;
  descricao: string;
  total: number;
  recebido: number;
  aVencer: number;
  atrasado: number;
  qtd: number;
};

type UnidadeGrupo = {
  nomeDisplay: string;
  razaoSocial: string;
  total: number;
  recebido: number;
  aVencer: number;
  atrasado: number;
  qtd: number;
  linhas: LinhaResumo[];
};

type Status = "RECEBIDO" | "A VENCER" | "ATRASADO" | "outro";

function classifyStatus(row: PfRow): Status {
  const s = row.status_titulo?.toUpperCase() ?? "";
  if (s === "RECEBIDO") return "RECEBIDO";
  if (s === "ATRASADO") return "ATRASADO";
  if (s.includes("VENCER") || s === "A VENCER" || s === "VENCE HOJE") return "A VENCER";
  return "outro";
}

async function fetchAll(ano: string): Promise<PfRow[]> {
  const all: PfRow[] = [];
  const PAGE = 1000;
  let offset = 0;
  const start = `${ano}-01-01`;
  const end = `${ano}-12-31`;
  while (true) {
    const { data, error } = await supabase
      .from("partners_financeiro")
      .select(
        "id,razao_social,cnpj,codigo_categoria,data_vencimento,data_pagamento,valor_documento,valor_recebido,status_titulo",
      )
      .eq("tipo", "RECEBER")
      .neq("status_titulo", "CANCELADO")
      .gte("data_vencimento", start)
      .lte("data_vencimento", end)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows: PfRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      razao_social: r.razao_social ?? null,
      cnpj: r.cnpj ?? null,
      codigo_categoria: r.codigo_categoria ?? null,
      data_vencimento: r.data_vencimento ?? null,
      data_pagamento: r.data_pagamento ?? null,
      valor_documento: Number(r.valor_documento ?? 0),
      valor_recebido: Number(r.valor_recebido ?? 0),
      status_titulo: r.status_titulo ?? "",
    }));
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

function PagamentosUnidadesPage() {
  const anoAtual = String(new Date().getFullYear());
  const [ano, setAno] = useState(anoAtual);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [unidadeFilter, setUnidadeFilter] = useState<string>("__all__");

  const [rows, setRows] = useState<PfRow[]>([]);
  const [categoriasMap, setCategoriasMap] = useState<Map<string, string>>(new Map());
  const [unidadesMap, setUnidadesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchAll(ano),
      supabase
        .from("categorias_omie")
        .select("codigo,descricao")
        .then(({ data }) => data ?? []),
      supabase
        .from("recebimentos_franquias")
        .select("cliente,unidade")
        .neq("unidade", "")
        .then(({ data }) => data ?? []),
    ])
      .then(([pfRows, cats, franqs]) => {
        setRows(pfRows);
        setCategoriasMap(
          new Map((cats as any[]).map((c) => [c.codigo as string, c.descricao as string])),
        );
        setUnidadesMap(
          new Map(
            (franqs as any[])
              .filter((f) => f.cliente && f.unidade)
              .map((f) => [f.cliente as string, f.unidade as string]),
          ),
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ano]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "__all__") {
        const s = classifyStatus(r);
        if (statusFilter === "RECEBIDO" && s !== "RECEBIDO") return false;
        if (statusFilter === "A VENCER" && s !== "A VENCER") return false;
        if (statusFilter === "ATRASADO" && s !== "ATRASADO") return false;
      }
      if (unidadeFilter !== "__all__") {
        const display = unidadesMap.get(r.razao_social ?? "") ?? r.razao_social ?? "—";
        if (display !== unidadeFilter) return false;
      }
      return true;
    });
  }, [rows, statusFilter, unidadeFilter, unidadesMap]);

  // Compute KPIs
  const kpis = useMemo(() => {
    let recebido = 0, aVencer = 0, atrasado = 0;
    const unidadesSet = new Set<string>();
    for (const r of filtered) {
      const s = classifyStatus(r);
      const v = r.valor_documento;
      if (s === "RECEBIDO") recebido += v;
      else if (s === "A VENCER") aVencer += v;
      else if (s === "ATRASADO") atrasado += v;
      const display = unidadesMap.get(r.razao_social ?? "") ?? r.razao_social ?? "—";
      unidadesSet.add(display);
    }
    return { recebido, aVencer, atrasado, total: recebido + aVencer + atrasado, unidades: unidadesSet.size };
  }, [filtered, unidadesMap]);

  // Group por unidade
  const porUnidade = useMemo<UnidadeGrupo[]>(() => {
    const map = new Map<string, UnidadeGrupo>();
    for (const r of filtered) {
      const rs = r.razao_social ?? "—";
      const display = unidadesMap.get(rs) ?? rs;
      const s = classifyStatus(r);
      const v = r.valor_documento;

      let g = map.get(display);
      if (!g) {
        g = { nomeDisplay: display, razaoSocial: rs, total: 0, recebido: 0, aVencer: 0, atrasado: 0, qtd: 0, linhas: [] };
        map.set(display, g);
      }
      g.total += v;
      g.qtd += 1;
      if (s === "RECEBIDO") g.recebido += v;
      else if (s === "A VENCER") g.aVencer += v;
      else if (s === "ATRASADO") g.atrasado += v;

      const cat = r.codigo_categoria ?? "";
      const descricao = categoriasMap.get(cat) ?? (cat || "Sem categoria");
      let linha = g.linhas.find((l) => l.codigo === cat);
      if (!linha) {
        linha = { codigo: cat, descricao, total: 0, recebido: 0, aVencer: 0, atrasado: 0, qtd: 0 };
        g.linhas.push(linha);
      }
      linha.total += v;
      linha.qtd += 1;
      if (s === "RECEBIDO") linha.recebido += v;
      else if (s === "A VENCER") linha.aVencer += v;
      else if (s === "ATRASADO") linha.atrasado += v;
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((g) => ({ ...g, linhas: g.linhas.sort((a, b) => b.total - a.total) }));
  }, [filtered, unidadesMap, categoriasMap]);

  // Group por linha de receita (pivot)
  const porLinha = useMemo<LinhaResumo[]>(() => {
    const map = new Map<string, LinhaResumo>();
    for (const r of filtered) {
      const cat = r.codigo_categoria ?? "";
      const descricao = categoriasMap.get(cat) ?? (cat || "Sem categoria");
      const s = classifyStatus(r);
      const v = r.valor_documento;
      let linha = map.get(cat);
      if (!linha) {
        linha = { codigo: cat, descricao, total: 0, recebido: 0, aVencer: 0, atrasado: 0, qtd: 0 };
        map.set(cat, linha);
      }
      linha.total += v;
      linha.qtd += 1;
      if (s === "RECEBIDO") linha.recebido += v;
      else if (s === "A VENCER") linha.aVencer += v;
      else if (s === "ATRASADO") linha.atrasado += v;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, categoriasMap]);

  const anos = Array.from({ length: 4 }, (_, i) => String(Number(anoAtual) - 1 + i));
  const unidadeOpcoes = useMemo(
    () =>
      Array.from(
        new Set(
          rows.map((r) => unidadesMap.get(r.razao_social ?? "") ?? r.razao_social ?? "—"),
        ),
      ).sort(),
    [rows, unidadesMap],
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Coins className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Pagamentos das Unidades</h1>
          <p className="text-sm text-muted-foreground">
            Tudo que as unidades franqueadas pagaram para Partners — discriminado por linha de receita
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anos.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            <SelectItem value="RECEBIDO">Pago</SelectItem>
            <SelectItem value="A VENCER">A vencer</SelectItem>
            <SelectItem value="ATRASADO">Em atraso</SelectItem>
          </SelectContent>
        </Select>

        <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as unidades</SelectItem>
            {unidadeOpcoes.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {error && (
        <Card className="p-4 border-red-300 bg-red-50 text-sm text-red-700">{error}</Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label={`Total ${ano}`} value={BRL(kpis.total)} tone="neutral" />
        <Kpi label="Recebido" value={BRL(kpis.recebido)} tone="green" />
        <Kpi label="A vencer" value={BRL(kpis.aVencer)} tone="amber" />
        <Kpi label="Em atraso" value={BRL(kpis.atrasado)} tone="red" />
        <Kpi label="Unidades" value={String(kpis.unidades)} tone="neutral" />
      </div>

      <Tabs defaultValue="por-unidade">
        <TabsList>
          <TabsTrigger value="por-unidade">Por Unidade</TabsTrigger>
          <TabsTrigger value="por-linha">Por Linha de Receita</TabsTrigger>
        </TabsList>

        {/* ── Tab: Por Unidade ── */}
        <TabsContent value="por-unidade" className="space-y-3">
          {loading ? (
            <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
          ) : porUnidade.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Nenhum recebimento encontrado para os filtros selecionados.
            </Card>
          ) : (
            porUnidade.map((g) => {
              const isOpen = expanded.has(g.nomeDisplay);
              return (
                <Card key={g.nomeDisplay} className="overflow-hidden">
                  <button
                    onClick={() => toggle(g.nomeDisplay)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{g.nomeDisplay}</div>
                      {g.nomeDisplay !== g.razaoSocial && (
                        <div className="text-xs text-muted-foreground truncate">{g.razaoSocial}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs justify-end shrink-0">
                      <Badge variant="outline">{g.qtd} notas</Badge>
                      {g.recebido > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                          {BRL(g.recebido)}
                        </Badge>
                      )}
                      {g.aVencer > 0 && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                          A vencer: {BRL(g.aVencer)}
                        </Badge>
                      )}
                      {g.atrasado > 0 && (
                        <Badge variant="destructive">
                          Atraso: {BRL(g.atrasado)}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="font-semibold">
                        Total: {BRL(g.total)}
                      </Badge>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Linha de Receita</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Recebido</TableHead>
                            <TableHead className="text-right">A vencer</TableHead>
                            <TableHead className="text-right">Em atraso</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.linhas.map((l) => (
                            <TableRow key={l.codigo}>
                              <TableCell>
                                <span className="font-medium">{l.descricao}</span>
                                {l.codigo && (
                                  <span className="ml-2 text-xs text-muted-foreground">{l.codigo}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">{l.qtd}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {l.recebido > 0 ? (
                                  <span className="text-emerald-700">{BRL(l.recebido)}</span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {l.aVencer > 0 ? (
                                  <span className="text-amber-700">{BRL(l.aVencer)}</span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {l.atrasado > 0 ? (
                                  <span className="text-red-600">{BRL(l.atrasado)}</span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">
                                {BRL(l.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <tfoot className="border-t bg-muted/30">
                          <tr>
                            <td className="py-2 px-4 text-sm font-semibold">Total</td>
                            <td className="py-2 px-4 text-right text-sm">{g.qtd}</td>
                            <td className="py-2 px-4 text-right tabular-nums text-sm text-emerald-700 font-medium">
                              {g.recebido > 0 ? BRL(g.recebido) : "—"}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-sm text-amber-700 font-medium">
                              {g.aVencer > 0 ? BRL(g.aVencer) : "—"}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-sm text-red-600 font-medium">
                              {g.atrasado > 0 ? BRL(g.atrasado) : "—"}
                            </td>
                            <td className="py-2 px-4 text-right tabular-nums text-sm font-bold">
                              {BRL(g.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            })
          )}

          {/* Totalizador geral */}
          {!loading && porUnidade.length > 0 && (
            <Card className="p-3 flex flex-wrap items-center justify-between gap-2 bg-muted/30">
              <span className="text-sm font-semibold">
                {porUnidade.length} unidades · {filtered.length} lançamentos
              </span>
              <div className="flex gap-3 text-sm">
                <span className="text-emerald-700 font-medium">{BRL(kpis.recebido)} recebido</span>
                {kpis.aVencer > 0 && (
                  <span className="text-amber-700 font-medium">{BRL(kpis.aVencer)} a vencer</span>
                )}
                {kpis.atrasado > 0 && (
                  <span className="text-red-600 font-medium">{BRL(kpis.atrasado)} em atraso</span>
                )}
                <span className="font-bold">{BRL(kpis.total)} total</span>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Por Linha de Receita ── */}
        <TabsContent value="por-linha">
          <Card className="overflow-x-auto">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
            ) : porLinha.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                Nenhum dado disponível.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha de Receita</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead className="text-right">A vencer</TableHead>
                    <TableHead className="text-right">Em atraso</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">% do total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porLinha.map((l) => (
                    <TableRow key={l.codigo}>
                      <TableCell>
                        <span className="font-medium">{l.descricao}</span>
                        {l.codigo && (
                          <span className="ml-2 text-xs text-muted-foreground">{l.codigo}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{l.qtd}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.recebido > 0 ? (
                          <span className="text-emerald-700">{BRL(l.recebido)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.aVencer > 0 ? (
                          <span className="text-amber-700">{BRL(l.aVencer)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.atrasado > 0 ? (
                          <span className="text-red-600">{BRL(l.atrasado)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {BRL(l.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {kpis.total > 0
                          ? `${((l.total / kpis.total) * 100).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <td className="py-2 px-4 text-sm font-semibold">Total</td>
                    <td className="py-2 px-4 text-right text-sm">
                      {porLinha.reduce((s, l) => s + l.qtd, 0)}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-sm text-emerald-700 font-medium">
                      {kpis.recebido > 0 ? BRL(kpis.recebido) : "—"}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-sm text-amber-700 font-medium">
                      {kpis.aVencer > 0 ? BRL(kpis.aVencer) : "—"}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-sm text-red-600 font-medium">
                      {kpis.atrasado > 0 ? BRL(kpis.atrasado) : "—"}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-sm font-bold">
                      {BRL(kpis.total)}
                    </td>
                    <td className="py-2 px-4 text-right text-sm">100%</td>
                  </tr>
                </tfoot>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "green" | "amber" | "red";
}) {
  const tones = {
    neutral: "bg-card border-border text-foreground",
    green: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-100",
    amber: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-100",
    red: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-900 dark:text-red-100",
  } as const;
  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
