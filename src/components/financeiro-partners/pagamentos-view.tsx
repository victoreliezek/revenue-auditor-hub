import { useEffect, useMemo, useState, type ComponentType } from "react";
import { CheckCircle2, CircleDollarSign, Clock, AlertTriangle, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { brl, date, num } from "@/components/audit/format";

const ALL = "__all__";

type StatusValidado = "pendente" | "confirmado_pago" | "confirmado_pendente";

interface PfRow {
  id: number;
  unidade: string | null;
  razao_social: string | null;
  codigo_categoria: string | null;
  numero_documento: string | null;
  data_vencimento: string | null;
  valor_documento: number | null;
  status_titulo: string | null;
  status_validado: StatusValidado;
  validado_em: string | null;
  validado_por: string | null;
  observacao_validacao: string | null;
}

const SELECT_COLS =
  "id,unidade,razao_social,codigo_categoria,numero_documento,data_vencimento,valor_documento,status_titulo,status_validado,validado_em,validado_por,observacao_validacao";

async function fetchAll(): Promise<PfRow[]> {
  const all: PfRow[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("partners_financeiro")
      .select(SELECT_COLS)
      .eq("tipo", "RECEBER")
      .neq("status_titulo", "CANCELADO")
      .order("data_vencimento", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PfRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

function omieStatusBadge(s: string | null) {
  const v = (s ?? "").toUpperCase();
  if (v === "RECEBIDO")
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200">Recebido</Badge>;
  if (v === "ATRASADO")
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-200">Atrasado</Badge>;
  if (v === "A VENCER" || v === "VENCE HOJE")
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200">A vencer</Badge>;
  return <Badge variant="outline">{s || "—"}</Badge>;
}

function isOmiePago(s: string | null) {
  return (s ?? "").toUpperCase() === "RECEBIDO";
}

function hasDivergencia(r: PfRow) {
  const omiePago = isOmiePago(r.status_titulo);
  if (r.status_validado === "confirmado_pago") return !omiePago;
  if (r.status_validado === "confirmado_pendente") return omiePago;
  // ainda não conferido: só sinaliza se o Omie já diz recebido há tempo e ninguém validou
  return false;
}

const STATUS_LABEL: Record<StatusValidado, string> = {
  pendente: "Não conferido",
  confirmado_pago: "Confirmado — pago",
  confirmado_pendente: "Confirmado — pendente",
};

export function PagamentosView() {
  const [rows, setRows] = useState<PfRow[]>([]);
  const [categoriasMap, setCategoriasMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [unidadeFilter, setUnidadeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<StatusValidado | typeof ALL>(ALL);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchAll(),
      supabase.from("categorias_omie").select("codigo,descricao").then(({ data }) => data ?? []),
    ])
      .then(([pfRows, cats]) => {
        setRows(pfRows);
        setCategoriasMap(new Map((cats as any[]).map((c) => [c.codigo as string, c.descricao as string])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const unidadeOpcoes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.unidade ?? r.razao_social ?? "—"))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const display = r.unidade ?? r.razao_social ?? "—";
      if (unidadeFilter !== ALL && display !== unidadeFilter) return false;
      if (statusFilter !== ALL && r.status_validado !== statusFilter) return false;
      if (term) {
        const cat = categoriasMap.get(r.codigo_categoria ?? "") ?? r.codigo_categoria ?? "";
        const hay = [r.razao_social, r.numero_documento, cat].filter(Boolean).map((v) => String(v).toLowerCase()).join(" ");
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, unidadeFilter, statusFilter, categoriasMap]);

  const kpis = useMemo(() => {
    let total = 0;
    let recebido = 0;
    let pendente = 0;
    let naoConferido = 0;
    let divergencias = 0;
    for (const r of filtered) {
      const v = Number(r.valor_documento ?? 0);
      total += v;
      if (r.status_validado === "confirmado_pago") recebido += v;
      else pendente += v;
      if (r.status_validado === "pendente") naoConferido += v;
      if (hasDivergencia(r)) divergencias += 1;
    }
    return { total, recebido, pendente, naoConferido, divergencias };
  }, [filtered]);

  const updateRow = async (id: number, patch: Partial<PfRow>) => {
    setSavingId(id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const fullPatch = {
      ...patch,
      validado_em: new Date().toISOString(),
      validado_por: user?.email ?? null,
    };
    const { error: updErr } = await supabase.from("partners_financeiro").update(fullPatch).eq("id", id);
    if (updErr) {
      setError(updErr.message);
    } else {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...fullPatch } : r)));
    }
    setSavingId(null);
  };

  const hasFilters = q !== "" || unidadeFilter !== ALL || statusFilter !== ALL;
  const clearFilters = () => {
    setQ("");
    setUnidadeFilter(ALL);
    setStatusFilter(ALL);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <CircleDollarSign className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pagamentos das Unidades</h1>
          <p className="text-sm text-muted-foreground">
            Faturas por categoria (royalties, CSC, CAC, tráfego pago...) — status do Omie + validação manual contra o extrato bancário.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard icon={CircleDollarSign} label="Total a Receber" value={brl(kpis.total)} tone="slate" />
        <KpiCard icon={CheckCircle2} label="Recebido (validado)" value={brl(kpis.recebido)} tone="emerald" />
        <KpiCard icon={Clock} label="Pendente (validado)" value={brl(kpis.pendente)} tone="amber" />
        <KpiCard
          icon={AlertTriangle}
          label="Não conferido / divergências"
          value={brl(kpis.naoConferido)}
          hint={kpis.divergencias > 0 ? `${num(kpis.divergencias)} divergência(s) Omie x validação` : undefined}
          tone={kpis.divergencias > 0 ? "red" : "slate"}
        />
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar unidade, documento ou categoria..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as unidades</SelectItem>
            {unidadeOpcoes.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusValidado | typeof ALL)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status validado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            <SelectItem value="pendente">Não conferido</SelectItem>
            <SelectItem value="confirmado_pago">Confirmado — pago</SelectItem>
            <SelectItem value="confirmado_pendente">Confirmado — pendente</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </Card>

      {error && (
        <Card className="p-4 border-red-300 bg-red-50 text-sm text-red-700">{error}</Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">
            {loading ? "Carregando..." : `${num(filtered.length)} fatura(s)`}
          </span>
        </div>
        <div className="relative max-h-[calc(100vh-420px)] overflow-auto">
          <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_hsl(var(--border))]">
              <TableRow>
                <TableHead className="bg-card">Omie</TableHead>
                <TableHead className="bg-card">Validação manual</TableHead>
                <TableHead className="bg-card">Unidade</TableHead>
                <TableHead className="bg-card">Categoria</TableHead>
                <TableHead className="bg-card">Vencimento</TableHead>
                <TableHead className="bg-card text-right">Valor</TableHead>
                <TableHead className="bg-card">Obs.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const divergente = hasDivergencia(r);
                const categoria = categoriasMap.get(r.codigo_categoria ?? "") ?? r.codigo_categoria ?? "—";
                return (
                  <TableRow key={r.id} className={divergente ? "bg-red-50/50 dark:bg-red-950/10" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {omieStatusBadge(r.status_titulo)}
                        {divergente && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status_validado}
                        onValueChange={(v) => updateRow(r.id, { status_validado: v as StatusValidado })}
                        disabled={savingId === r.id}
                      >
                        <SelectTrigger className="w-[190px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">{STATUS_LABEL.pendente}</SelectItem>
                          <SelectItem value="confirmado_pago">{STATUS_LABEL.confirmado_pago}</SelectItem>
                          <SelectItem value="confirmado_pendente">{STATUS_LABEL.confirmado_pendente}</SelectItem>
                        </SelectContent>
                      </Select>
                      {r.validado_em && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {date(r.validado_em)} {r.validado_por ? `· ${r.validado_por}` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.unidade || r.razao_social || "—"}</div>
                      {r.unidade && r.razao_social && (
                        <div className="text-xs text-muted-foreground">{r.razao_social}</div>
                      )}
                    </TableCell>
                    <TableCell>{categoria}</TableCell>
                    <TableCell>{date(r.data_vencimento)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">
                      {brl(Number(r.valor_documento ?? 0))}
                    </TableCell>
                    <TableCell>
                      <ObservacaoCell
                        value={r.observacao_validacao}
                        onSave={(obs) => updateRow(r.id, { observacao_validacao: obs })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma fatura encontrada.
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

function ObservacaoCell({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <Popover onOpenChange={(open) => !open && draft !== (value ?? "") && onSave(draft)}>
      <PopoverTrigger asChild>
        <button className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted max-w-[160px] truncate text-left">
          {value ? value : "adicionar nota"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ex: conferido no extrato do dia 15/07, caiu na conta X"
          rows={3}
        />
      </PopoverContent>
    </Popover>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone: "amber" | "red" | "emerald" | "slate";
}) {
  const toneMap = {
    amber: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    red: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
    emerald: "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    slate: "border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40",
  } as const;
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneMap[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
