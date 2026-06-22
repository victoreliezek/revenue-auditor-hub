import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, ExternalLink, FileSpreadsheet, Search, X } from "lucide-react";
import { exportRowsToXlsx } from "@/lib/xlsx-export";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { usePermissions, unitMatches } from "@/hooks/use-permissions";
import { PrePlanningTab } from "@/components/clientes/pre-planning-tab";

type StatusFinanceiro =
  | "ATIVO"
  | "EM_ATRASO"
  | "INADIMPLENTE"
  | "SEM_ATIVIDADE"
  | "NUNCA_PAGOU"
  | "SEM_AR";

type Cliente = {
  id: number;
  razao_social: string | null;
  titulo: string | null;
  cnpj: string | null;
  unidade: string | null;
  pipedrive_id: string | null;
  fonte_cadastro: string | null;
  status_financeiro: StatusFinanceiro | null;
};

const ALL = "__all__";

const STATUS_ORDER: StatusFinanceiro[] = [
  "ATIVO",
  "INADIMPLENTE",
  "NUNCA_PAGOU",
  "EM_ATRASO",
  "SEM_ATIVIDADE",
  "SEM_AR",
];

const STATUS_META: Record<
  StatusFinanceiro,
  { label: string; card: string; badge: string; description: string }
> = {
  ATIVO: {
    label: "Ativo",
    card: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-100",
    badge: "bg-emerald-500 text-white hover:bg-emerald-500",
    description: "Pagou nos últimos 90 dias",
  },
  EM_ATRASO: {
    label: "Em atraso",
    card: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-100",
    badge: "bg-amber-400 text-amber-950 hover:bg-amber-400",
    description: "Título vencido, mas pagou recentemente",
  },
  INADIMPLENTE: {
    label: "Inadimplente",
    card: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-900 dark:text-red-100",
    badge: "bg-red-600 text-white hover:bg-red-600",
    description: "Vencido + sem pagamento há mais de 90 dias",
  },
  SEM_ATIVIDADE: {
    label: "Sem atividade",
    card: "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950 dark:border-orange-900 dark:text-orange-100",
    badge: "bg-orange-500 text-white hover:bg-orange-500",
    description: "Sem pagamento >90 dias, sem título em aberto",
  },
  NUNCA_PAGOU: {
    label: "Nunca pagou",
    card: "bg-slate-700 border-slate-800 text-white dark:bg-slate-800 dark:border-slate-900",
    badge: "bg-slate-700 text-white hover:bg-slate-700",
    description: "Sem nenhum pagamento registrado",
  },
  SEM_AR: {
    label: "Sem AR",
    card: "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200",
    badge: "bg-slate-300 text-slate-800 hover:bg-slate-300",
    description: "Sem histórico de faturamento (Pipedrive sem Omie)",
  },
};

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  const perms = usePermissions();
  const [rows, setRows] = useState<Cliente[]>([]);
  const [mrrByPipedriveId, setMrrByPipedriveId] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [unidade, setUnidade] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<StatusFinanceiro | null>(null);
  type SortKey =
    | "razao_social"
    | "unidade"
    | "mrr"
    | "cnpj"
    | "status_financeiro"
    | "pipedrive_id"
    | "fonte_cadastro";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [empRes, contRes] = await Promise.all([
        supabase
          .from("empresas")
          .select(
            "id,razao_social,titulo,cnpj,unidade,pipedrive_id,fonte_cadastro,status_financeiro",
          )
          .eq("tipo_unidade", "franquia")
          .order("razao_social", { ascending: true })
          .limit(5000),
        supabase
          .from("contratos")
          .select("mrr_mensal,pipedrive_deal_id,status_contrato,tipo")
          .eq("status_contrato", "Ativo")
          .eq("tipo", "Recorrente")
          .eq("tipo_unidade", "franquia")
          .limit(20000),
      ]);
      if (!mounted) return;
      if (empRes.data) setRows(empRes.data as Cliente[]);
      const m = new Map<string, number>();
      for (const c of contRes.data ?? []) {
        const id = c.pipedrive_deal_id != null ? String(c.pipedrive_deal_id) : null;
        if (!id) continue;
        // contratos.mrr_mensal já é o valor mensal (coluna gerada = mrr/12)
        m.set(id, (m.get(id) ?? 0) + Number(c.mrr_mensal ?? 0));
      }
      setMrrByPipedriveId(m);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });


  const unidades = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.unidade).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const visiveis = useMemo(() => {
    if (perms.scopedToOwnUnit && perms.unidade) {
      return rows.filter((r) => unitMatches(perms.unidade, r.unidade));
    }
    return rows;
  }, [rows, perms.scopedToOwnUnit, perms.unidade]);

  const counts = useMemo(() => {
    const c = {} as Record<StatusFinanceiro, number>;
    STATUS_ORDER.forEach((s) => (c[s] = 0));
    visiveis.forEach((r) => {
      if (r.status_financeiro && c[r.status_financeiro] != null) c[r.status_financeiro]++;
    });
    return c;
  }, [visiveis]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = visiveis.filter((r) => {
      if (statusFilter && r.status_financeiro !== statusFilter) return false;
      if (!perms.scopedToOwnUnit && unidade !== ALL && r.unidade !== unidade) return false;
      if (term) {
        const hay = [r.razao_social, r.titulo, r.cnpj]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase())
          .join(" ");
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    const rank = new Map<string, number>();
    STATUS_ORDER.forEach((s, i) => rank.set(s, i));
    const mrrOf = (r: Cliente) => mrrByPipedriveId.get(r.pipedrive_id ?? "") ?? 0;
    if (!sort) {
      return out.sort((a, b) => {
        const ra = rank.get(a.status_financeiro ?? "") ?? 99;
        const rb = rank.get(b.status_financeiro ?? "") ?? 99;
        if (ra !== rb) return ra - rb;
        return (a.razao_social ?? "").localeCompare(b.razao_social ?? "", "pt-BR");
      });
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    const cmpStr = (a: string | null | undefined, b: string | null | undefined) => {
      const av = a ?? "";
      const bv = b ?? "";
      if (!av && bv) return 1;
      if (av && !bv) return -1;
      if (!av && !bv) return 0;
      return av.localeCompare(bv, "pt-BR");
    };
    const cmpNum = (a: number, b: number) => a - b;
    return out.sort((a, b) => {
      let c = 0;
      switch (sort.key) {
        case "razao_social":
          c = cmpStr(a.razao_social ?? a.titulo, b.razao_social ?? b.titulo);
          break;
        case "unidade":
          c = cmpStr(a.unidade, b.unidade);
          break;
        case "mrr":
          c = cmpNum(mrrOf(a), mrrOf(b));
          break;
        case "cnpj":
          c = cmpStr(a.cnpj, b.cnpj);
          break;
        case "status_financeiro": {
          const ra = rank.get(a.status_financeiro ?? "") ?? 99;
          const rb = rank.get(b.status_financeiro ?? "") ?? 99;
          c = ra - rb;
          break;
        }
        case "pipedrive_id":
          c = cmpNum(Number(a.pipedrive_id ?? 0), Number(b.pipedrive_id ?? 0));
          break;
        case "fonte_cadastro":
          c = cmpStr(a.fonte_cadastro, b.fonte_cadastro);
          break;
      }
      if (c !== 0) return c * dir;
      return (a.razao_social ?? "").localeCompare(b.razao_social ?? "", "pt-BR");
    });
  }, [visiveis, q, unidade, statusFilter, perms.scopedToOwnUnit, sort, mrrByPipedriveId]);

  const hasFilters = q !== "" || unidade !== ALL || statusFilter !== null;
  const clearFilters = () => {
    setQ("");
    setUnidade(ALL);
    setStatusFilter(null);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Diretório da rede com status financeiro consolidado.
          </p>
        </div>
      </div>

      <Tabs defaultValue="planning" className="space-y-6">
        <TabsList>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="pre-planning">Pré-Planning</TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-6">
          {/* Status cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {STATUS_ORDER.map((s) => {
              const meta = STATUS_META[s];
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(active ? null : s)}
                  className={cn(
                    "rounded-lg border p-4 text-left shadow-sm transition-all hover:shadow-md",
                    meta.card,
                    active && "ring-2 ring-offset-2 ring-primary",
                  )}
                  title={meta.description}
                >
                  <div className="text-xs font-medium uppercase tracking-wide opacity-80">
                    {meta.label}
                  </div>
                  <div className="mt-1 text-3xl font-bold">{counts[s]}</div>
                  <div className="mt-1 text-[11px] opacity-75 line-clamp-2">
                    {meta.description}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <Card className="sticky top-0 z-20 flex flex-wrap items-center gap-2 p-3 shadow-sm">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por razão social ou CNPJ..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            {perms.scopedToOwnUnit && perms.unidade ? (
              <Badge variant="secondary" className="h-9 px-3 text-sm">
                Unidade: {perms.unidade}
              </Badge>
            ) : (
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as unidades</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {statusFilter && (
              <Badge className={cn("gap-1", STATUS_META[statusFilter].badge)}>
                {STATUS_META[statusFilter].label}
                <button onClick={() => setStatusFilter(null)} aria-label="Limpar status">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" /> Limpar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={loading || filtered.length === 0}
              onClick={() => {
                const data = filtered.map((r) => ({
                  "Razão Social": r.razao_social || r.titulo || "",
                  Unidade: r.unidade || "",
                  MRR: mrrByPipedriveId.get(r.pipedrive_id ?? "") ?? 0,
                  CNPJ: r.cnpj || "",
                  "Status Financeiro": r.status_financeiro
                    ? STATUS_META[r.status_financeiro].label
                    : "",
                  "Pipedrive ID": r.pipedrive_id || "",
                  "Fonte Cadastro": r.fonte_cadastro || "",
                }));
                exportRowsToXlsx(data, "clientes-planning", "Planning", [
                  40, 18, 14, 20, 18, 14, 18,
                ]);
              }}
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Exportar Excel
            </Button>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-medium">
                {loading ? "Carregando..." : `${filtered.length} cliente(s)`}
              </span>
              {!loading && (
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                  MRR total: {fmtBRL(filtered.reduce((s, r) => s + (mrrByPipedriveId.get(r.pipedrive_id ?? "") ?? 0), 0))}
                </span>
              )}
            </div>
            <div className="max-h-[calc(100vh-360px)] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm shadow-[inset_0_-1px_0_hsl(var(--border))]">
                  <TableRow>
                    {([
                      { key: "razao_social", label: "Razão Social", align: "left" },
                      { key: "unidade", label: "Unidade", align: "left" },
                      { key: "mrr", label: "MRR", align: "right" },
                      { key: "cnpj", label: "CNPJ", align: "left" },
                      { key: "status_financeiro", label: "Status Financeiro", align: "left" },
                      { key: "pipedrive_id", label: "Pipedrive ID", align: "left" },
                      { key: "fonte_cadastro", label: "Fonte Cadastro", align: "left" },
                    ] as { key: SortKey; label: string; align: "left" | "right" }[]).map((col) => {
                      const active = sort?.key === col.key;
                      const Icon = !active
                        ? ArrowUpDown
                        : sort?.dir === "asc"
                          ? ArrowUp
                          : ArrowDown;
                      return (
                        <TableHead
                          key={col.key}
                          className={cn(
                            "sticky top-0 bg-card/95 backdrop-blur-sm",
                            col.align === "right" && "text-right",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className={cn(
                              "inline-flex items-center gap-1 select-none hover:text-foreground transition-colors",
                              col.align === "right" && "ml-auto",
                              active ? "text-foreground font-semibold" : "text-muted-foreground",
                            )}
                          >
                            {col.label}
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5",
                                active ? "text-primary" : "text-muted-foreground/60",
                              )}
                            />
                          </button>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const meta = r.status_financeiro ? STATUS_META[r.status_financeiro] : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.razao_social || r.titulo || "—"}
                        </TableCell>
                        <TableCell>
                          {r.unidade ? <Badge variant="secondary">{r.unidade}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {(() => {
                            const v = mrrByPipedriveId.get(r.pipedrive_id ?? "") ?? 0;
                            return v > 0 ? fmtBRL(v) : <span className="text-muted-foreground">—</span>;
                          })()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.cnpj || "—"}</TableCell>

                        <TableCell>
                          {meta ? (
                            <Badge className={meta.badge}>{meta.label}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.pipedrive_id ? (
                            <a
                              href={`https://planningpartners.pipedrive.com/organization/${r.pipedrive_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              {r.pipedrive_id}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{r.fonte_cadastro || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pre-planning">
          <PrePlanningTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
