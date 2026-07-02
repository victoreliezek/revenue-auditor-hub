import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  MessageSquare,
  Pencil,
  Plus,
  ChevronDown,
  ChevronRight,
  Settings2,
  Trash2,
  Upload,
  FileDown,
  Check,
  XCircle,
} from "lucide-react";
import { ImportarPlanilhaDialog } from "@/components/despesas/importar-planilha-dialog";
import { exportDevolutivaPdf, exportDevolutivaXlsx, type DespesaApuracaoRow } from "@/lib/despesas-devolutiva";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useCategoriasDespesa,
  useDepartamentosDespesa,
} from "@/hooks/use-cadastros-despesas";
import { CadastrosDespesasDialog } from "@/components/despesas/cadastros-dialog";

export const Route = createFileRoute("/_authenticated/despesas-cm")({
  head: () => ({ meta: [{ title: "Despesas Partners – Planning" }] }),
  component: () => <DespesasCmPage section="despesas" />,
});

// ---------------- helpers ----------------

const BRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

// Categorias de despesa e departamentos são carregados dinamicamente
// via hooks `useCategoriasDespesa` / `useDepartamentosDespesa`
// (tabelas dre_sim_categorias / dre_sim_departamentos).

const BU_COLORS: Record<string, string> = {
  Matriz: "#6366f1",
  Partners: "#10b981",
  "Construção Civil": "#f59e0b",
  Consultoria: "#ef4444",
};

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function toMesISO(d: Date) {
  const m = firstOfMonth(d);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
}
function fromMonthInput(v: string) {
  // v: "YYYY-MM"
  const [y, m] = v.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}
function toMonthInput(iso: string) {
  return iso.slice(0, 7);
}

// ---------------- types ----------------

type Status =
  | "pendente"
  | "pago"
  | "pago_a_maior"
  | "pago_a_menor"
  | "nao_encontrado";

type ApuracaoStatus = "pendente" | "aprovado" | "contestado";

interface ConfrontoRow {
  mes: string;
  fornecedor: string;
  tipo_despesa: string;
  categoria: string;
  dpto: string;
  valor_planejado: number;
  valor_realizado: number | null;
  data_pagamento: string | null;
  status: Status;
  resultado: string | null;
  diferenca: number | null;
  observacao: string | null;
  apuracao_status: ApuracaoStatus;
  motivo_contestacao: string | null;
  origem_apuracao: string | null;
  origem: string;
}

interface DespesaRow {
  id: number;
  mes: string;
  fornecedor: string;
  tipo_despesa: string;
  categoria: string;
  dpto: string;
  valor_total: number;
  valor_pago: number | null;
  data_pagamento: string | null;
  observacao: string | null;
  origem: "recorrente" | "avulso";
  status: Status;
  apuracao_status: ApuracaoStatus;
  motivo_contestacao: string | null;
  origem_apuracao: string | null;
}




interface RateioRow {
  mes: string;
  bu: string;
  fornecedor: string;
  tipo_despesa: string;
  dpto: string;
  valor_total: number;
  valor_alocado: number;
  status: string;
  despesa_id: number;
}

interface Criterio {
  id: number;
  fornecedor: string;
  tipo_rateio: string;
  bu_direto: string | null;
  percentuais_custom: Record<string, number> | null;
}

interface SqlRow {
  bu: string;
  valor: number;
  updated_at: string | null;
}

interface ResumoMes {
  mes: string;
  planejado: number;
  pago: number;
  pendente: number;
  divergencias: number;
}

interface OrcRow {
  tipo: "RECEITA" | "DESPESA";
  categoria: string;
  valor: number;
}

// ---------------- badges ----------------

function DptoBadge({ value }: { value: string }) {
  const cls =
    value === "Marketing"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
      : value === "Comercial"
        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        : "bg-slate-100 text-slate-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {value}
    </span>
  );
}

function StatusBadge({ row }: { row: ConfrontoRow }) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof Clock }> =
    {
      pendente: {
        label: "Pendente",
        cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        Icon: Clock,
      },
      pago: {
        label: "Pago",
        cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        Icon: CheckCircle2,
      },
      pago_a_maior: {
        label: "Pago a maior",
        cls: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
        Icon: AlertTriangle,
      },
      pago_a_menor: {
        label: "Pago a menor",
        cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
        Icon: AlertTriangle,
      },
      nao_encontrado: {
        label: "Não encontrado",
        cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
        Icon: HelpCircle,
      },
    };
  const it = map[row.status] ?? map.pendente;
  const Icon = it.Icon;
  const showDiff =
    (row.status === "pago_a_maior" || row.status === "pago_a_menor") &&
    row.diferenca != null;
  return (
    <span
      title={showDiff ? `Diferença: ${BRL(row.diferenca!)}` : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        it.cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {it.label}
      {showDiff && (
        <span className="opacity-75">({BRL(row.diferenca!)})</span>
      )}
    </span>
  );
}

// ---------------- KPI card ----------------

function Kpi({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: "neutral" | "green" | "amber" | "red";
  sub?: string;
}) {
  const tones = {
    neutral:
      "bg-card border-border text-foreground",
    green:
      "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-100",
    amber:
      "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-100",
    red: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-900 dark:text-red-100",
  } as const;
  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-sm",
        tones[tone],
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-75">{sub}</div>}
    </div>
  );
}

// ---------------- main page ----------------

export function DespesasCmPage({ section }: { section?: "dre" | "despesas" } = {}) {
  const showDre = section !== "despesas";
  const showRest = section !== "dre";
  const today = new Date();
  const [mes, setMes] = useState<string>(toMesISO(today)); // YYYY-MM-01
  const [despesas, setDespesas] = useState<DespesaRow[]>([]);
  const [confronto, setConfronto] = useState<ConfrontoRow[]>([]);
  const [rateio, setRateio] = useState<RateioRow[]>([]);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DespesaRow | null>(null);
  const [sortKey, setSortKey] = useState<keyof ConfrontoRow>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sqls, setSqls] = useState<SqlRow[]>([]);
  const [resumo, setResumo] = useState<ResumoMes[]>([]);
  const [criterioModal, setCriterioModal] = useState<{ fornecedor: string } | null>(null);
  const [orc, setOrc] = useState<OrcRow[]>([]);
  const [deleting, setDeleting] = useState<DespesaRow | null>(null);
  const [deleteScope, setDeleteScope] = useState<"mes" | "futuros" | "tudo">("mes");
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [fApuracao, setFApuracao] = useState<"all" | ApuracaoStatus>("all");
  const [contestando, setContestando] = useState<{ row: ConfrontoRow; dp: DespesaRow } | null>(null);
  const [motivo, setMotivo] = useState("");

  async function setApuracao(
    dp: DespesaRow,
    novo: ApuracaoStatus,
    motivoText: string | null = null,
  ) {
    if (dp.origem !== "avulso" || dp.id >= 0) {
      toast.error("Só despesas avulsas podem ser revisadas.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const { error } = await supabase
      .from("despesas_cm_avulsos")
      .update({
        apuracao_status: novo,
        motivo_contestacao: novo === "contestado" ? motivoText : null,
        revisado_em: new Date().toISOString(),
        revisado_por: uid,
      })
      .eq("id", -dp.id);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
      return;
    }
    toast.success(novo === "aprovado" ? "Aprovado." : novo === "contestado" ? "Contestado." : "Marcado como pendente.");
    await load();
  }

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      if (deleting.id < 0) {
        const { error } = await supabase
          .from("despesas_cm_avulsos")
          .delete()
          .eq("id", -deleting.id);
        if (error) throw error;
      } else {
        const { data: ovr, error: eOv } = await supabase
          .from("despesas_cm_overrides")
          .select("fornecedor_id")
          .eq("id", deleting.id)
          .single();
        if (eOv) throw eOv;
        const fid = ovr.fornecedor_id;
        if (deleteScope === "mes") {
          const { error } = await supabase
            .from("despesas_cm_overrides")
            .delete()
            .eq("id", deleting.id);
          if (error) throw error;
        } else if (deleteScope === "futuros") {
          const { error: e1 } = await supabase
            .from("despesas_cm_overrides")
            .delete()
            .eq("fornecedor_id", fid)
            .gte("mes", mes);
          if (e1) throw e1;
          const { error: e2 } = await supabase
            .from("despesas_cm_fornecedores")
            .update({ ativo: false })
            .eq("id", fid);
          if (e2) throw e2;
        } else {
          const { error: e1 } = await supabase
            .from("despesas_cm_overrides")
            .delete()
            .eq("fornecedor_id", fid);
          if (e1) throw e1;
          const { error: e2 } = await supabase
            .from("despesas_cm_fornecedores")
            .delete()
            .eq("id", fid);
          if (e2) throw e2;
        }
      }
      toast.success("Despesa excluída.");
      setDeleting(null);
      setDeleteScope("mes");
      await load();
      await loadResumo();
    } catch (e) {
      toast.error("Erro ao excluir: " + (e as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const [d, c, r, cr, s, o] = await Promise.all([
      supabase
        .from("despesas_cm")
        .select("id,mes,fornecedor,tipo_despesa,categoria,dpto,valor_total,valor_pago,data_pagamento,observacao,origem,status,apuracao_status,motivo_contestacao,origem_apuracao")
        .eq("mes", mes),
      supabase.from("v_confronto_cm").select("*").eq("mes", mes),
      supabase.from("v_rateio_cm_mensal").select("*").eq("mes", mes),
      supabase
        .from("criterios_rateio_cm")
        .select("id,fornecedor,tipo_rateio,bu_direto,percentuais_custom")
        .eq("ativo", true),
      supabase.from("sqls_por_bu").select("bu,valor,updated_at").eq("mes", mes),
      supabase.from("partners_orcamento").select("tipo,categoria,valor").eq("mes", mes),
    ]);
    if (d.error) toast.error("Erro carregando despesas: " + d.error.message);
    if (c.error) toast.error("Erro carregando confronto: " + c.error.message);
    if (r.error) toast.error("Erro carregando rateio: " + r.error.message);
    setDespesas((d.data ?? []) as unknown as DespesaRow[]);
    setConfronto((c.data ?? []) as unknown as ConfrontoRow[]);
    setRateio((r.data ?? []) as unknown as RateioRow[]);
    setCriterios((cr.data ?? []) as Criterio[]);
    setSqls((s.data ?? []) as SqlRow[]);
    setOrc(((o.data ?? []) as OrcRow[]).filter((x) => x.categoria !== "_TOTAL"));
    setLoading(false);
  };


  const loadResumo = async () => {
    const [y, m] = mes.slice(0, 7).split("-").map(Number);
    const start = new Date(y, m - 12, 1);
    const startISO = toMesISO(start);
    const { data, error } = await supabase
      .from("despesas_cm")
      .select("mes, valor_total, valor_pago, status")
      .gte("mes", startISO)
      .lte("mes", mes);
    if (error) {
      toast.error("Erro carregando resumo: " + error.message);
      return;
    }
    const acc = new Map<string, ResumoMes>();
    for (const row of data ?? []) {
      const mesKey = row.mes as string;
      const cur =
        acc.get(mesKey) ??
        { mes: mesKey, planejado: 0, pago: 0, pendente: 0, divergencias: 0 };
      cur.planejado += Number(row.valor_total ?? 0);
      if (["pago", "pago_a_maior", "pago_a_menor"].includes(row.status as string)) {
        cur.pago += Number(row.valor_pago ?? 0);
      }
      if (row.status === "pendente") cur.pendente += Number(row.valor_total ?? 0);
      if (["pago_a_maior", "pago_a_menor"].includes(row.status as string)) {
        cur.divergencias += 1;
      }
      acc.set(mesKey, cur);
    }
    setResumo(Array.from(acc.values()).sort((a, b) => a.mes.localeCompare(b.mes)));
  };

  useEffect(() => {
    load();
    loadResumo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const sqlsTotal = useMemo(() => sqls.reduce((s, r) => s + Number(r.valor ?? 0), 0), [sqls]);

  // KPIs
  const kpis = useMemo(() => {
    const planejado = despesas.reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
    const confirmado = despesas
      .filter((r) => ["pago", "pago_a_maior", "pago_a_menor"].includes(r.status))
      .reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
    const pendente = despesas
      .filter((r) => r.status === "pendente")
      .reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
    const divergencias = despesas.filter((r) =>
      ["pago_a_maior", "pago_a_menor"].includes(r.status),
    ).length;
    return { planejado, confirmado, pendente, divergencias };
  }, [despesas]);

  // KPIs de apuração (avulsos importados)
  const apuracao = useMemo(() => {
    const t = { aprovado: 0, contestado: 0, pendente: 0 };
    let totalLinhas = 0;
    let importadas = 0;
    for (const r of confronto) {
      const v = Number(r.valor_planejado ?? 0);
      t[r.apuracao_status] = (t[r.apuracao_status] ?? 0) + v;
      totalLinhas++;
      if (r.origem_apuracao === "financeiro-mensal") importadas++;
    }
    return { ...t, totalLinhas, importadas };
  }, [confronto]);

  // Rateio agregado por BU
  const rateioPorBu = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rateio) {
      map.set(r.bu, (map.get(r.bu) ?? 0) + Number(r.valor_alocado ?? 0));
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([bu, valor]) => ({
        bu,
        valor,
        pct: total > 0 ? (valor / total) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [rateio]);

  // Ordenação tabela
  const statusOrder: Record<Status, number> = {
    pago_a_maior: 0,
    pago_a_menor: 1,
    nao_encontrado: 2,
    pendente: 3,
    pago: 4,
  };
  const confrontoOrdenado = useMemo(() => {
    const arr = confronto.filter((r) => fApuracao === "all" || r.apuracao_status === fApuracao);
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "status") {
        cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        if (cmp === 0) cmp = a.fornecedor.localeCompare(b.fornecedor);
      } else {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confronto, sortKey, sortDir, fApuracao]);

  const handleSort = (k: keyof ConfrontoRow) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  // map confronto -> despesa_id (para edição e expand)
  const despesaIdByKey = useMemo(() => {
    const m = new Map<string, DespesaRow>();
    for (const d of despesas) {
      m.set(`${d.fornecedor}||${d.tipo_despesa}||${d.dpto}`, d);
    }
    return m;
  }, [despesas]);

  // ---- inline edição do realizado / observação ----
  const todayISO = () => new Date().toISOString().slice(0, 10);

  async function persistRealizado(dp: DespesaRow, novoValor: number | null) {
    const payload: {
      valor_pago: number | null;
      data_pagamento: string | null;
      status: string;
    } = {
      valor_pago: novoValor,
      data_pagamento:
        novoValor != null ? (dp.data_pagamento ?? todayISO()) : null,
      status: novoValor != null ? "pago" : "pendente",
    };
    if (dp.id > 0) {
      const { error } = await supabase
        .from("despesas_cm_overrides")
        .update(payload)
        .eq("id", dp.id);
      if (error) throw error;
    } else if (dp.id < 0) {
      const { error } = await supabase
        .from("despesas_cm_avulsos")
        .update(payload)
        .eq("id", -dp.id);
      if (error) throw error;
    }
  }

  async function persistObservacao(dp: DespesaRow, texto: string) {
    const value = texto.trim() === "" ? null : texto.trim();
    if (dp.id > 0) {
      const { error } = await supabase
        .from("despesas_cm_overrides")
        .update({ observacao: value })
        .eq("id", dp.id);
      if (error) throw error;
    } else if (dp.id < 0) {
      const { error } = await supabase
        .from("despesas_cm_avulsos")
        .update({ observacao: value })
        .eq("id", -dp.id);
      if (error) throw error;
    }
  }

  async function handleRealizadoBlur(row: ConfrontoRow, raw: string) {
    const key = `${row.fornecedor}||${row.tipo_despesa}||${row.dpto}`;
    const dp = despesaIdByKey.get(key);
    if (!dp) return;
    const trimmed = raw.trim();
    let novo: number | null = null;
    if (trimmed !== "") {
      const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n)) {
        toast.error("Valor inválido");
        return;
      }
      novo = n;
    }
    const atual = row.valor_realizado;
    if ((atual ?? null) === novo) return;
    try {
      await persistRealizado(dp, novo);
      await load();
      await loadResumo();
    } catch (e) {
      toast.error("Erro ao salvar realizado: " + (e as Error).message);
    }
  }

  async function handleObservacaoSave(row: ConfrontoRow, texto: string) {
    const key = `${row.fornecedor}||${row.tipo_despesa}||${row.dpto}`;
    const dp = despesaIdByKey.get(key);
    if (!dp) return;
    try {
      await persistObservacao(dp, texto);
      toast.success("Justificativa salva.");
      await load();
    } catch (e) {
      toast.error("Erro ao salvar justificativa: " + (e as Error).message);
    }
  }



  return (
    <AppShell
      title="Financeiro Partners"
      subtitle="DRE · Despesas C&M · Rateio por BU"
      headerExtra={
        <>
          {(() => {
            const [yStr, mStr] = mes.slice(0, 7).split("-");
            const y = Number(yStr);
            const m = Number(mStr);
            const meses = [
              "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
              "Jul", "Ago", "Set", "Out", "Nov", "Dez",
            ];
            const currentYear = new Date().getFullYear();
            const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);
            return (
              <div className="flex items-center gap-2">
                <Select
                  value={String(m)}
                  onValueChange={(v) =>
                    setMes(`${y}-${String(Number(v)).padStart(2, "0")}-01`)
                  }
                >
                  <SelectTrigger className="h-8 w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((nome, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1)}>
                        {nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(y)}
                  onValueChange={(v) =>
                    setMes(`${v}-${String(m).padStart(2, "0")}-01`)
                  }
                >
                  <SelectTrigger className="h-8 w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={mes}
                  onChange={(e) =>
                    e.target.value && setMes(toMesISO(new Date(e.target.value)))
                  }
                  className="h-8 w-[150px]"
                />
              </div>
            );
          })()}
          {showRest && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const [y, m] = mes.slice(0, 7).split("-").map(Number);
                  const prevDate = new Date(y, m - 2, 1);
                  const prev = toMesISO(prevDate);
                  const { data, error } = await supabase.rpc("clonar_despesas_cm", {
                    mes_origem: prev,
                    mes_destino: mes,
                  });
                  if (error) {
                    toast.error("Erro ao replicar: " + error.message);
                    return;
                  }
                  const r = Array.isArray(data) ? data[0] : data;
                  toast.success(
                    `Replicado: ${r?.clonados ?? 0} nova(s) · ${r?.ja_existiam ?? 0} já existia(m)`,
                  );
                  load();
                }}
              >
                Replicar mês anterior
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> Importar planilha
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const rows: DespesaApuracaoRow[] = confronto.map((r) => ({
                    fornecedor: r.fornecedor,
                    categoria: r.categoria,
                    dpto: r.dpto,
                    valor_planejado: r.valor_planejado,
                    apuracao_status: r.apuracao_status,
                    motivo_contestacao: r.motivo_contestacao,
                    origem_apuracao: r.origem_apuracao,
                    origem: r.origem,
                  }));
                  if (rows.length === 0) {
                    toast.error("Sem despesas no mês para exportar.");
                    return;
                  }
                  exportDevolutivaXlsx(rows, mes);
                  exportDevolutivaPdf(rows, mes);
                }}
              >
                <FileDown className="h-4 w-4" /> Exportar devolutiva
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Lançar Despesa
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6 p-4">
        {/* KPIs */}
        {showRest && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))
            ) : (
              <>
                <Kpi label="Total Planejado" value={BRL(kpis.planejado)} tone="neutral" />
                <Kpi label="Total Confirmado" value={BRL(kpis.confirmado)} tone="green" />
                <Kpi label="Pendente no Omie" value={BRL(kpis.pendente)} tone="amber" />
                <Kpi
                  label="Divergências"
                  value={String(kpis.divergencias)}
                  tone="red"
                  sub={kpis.divergencias > 0 ? "valores divergentes do Omie" : "sem divergências"}
                />
              </>
            )}
          </div>
        )}

        {/* DRE do mês */}
        {showDre && (() => {
          const receitas = orc.filter((r) => r.tipo === "RECEITA");
          const despesasOrc = orc.filter((r) => r.tipo === "DESPESA");
          const totalReceita = receitas.reduce((s, r) => s + Number(r.valor ?? 0), 0);
          const totalDespesaOrc = despesasOrc.reduce((s, r) => s + Number(r.valor ?? 0), 0);
          const totalCmRealizado = despesas
            .filter((r) => ["pago", "pago_a_maior", "pago_a_menor"].includes(r.status))
            .reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
          const totalCmPlanejado = despesas.reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
          const totalDespesa = totalDespesaOrc + totalCmPlanejado;
          const resultado = totalReceita - totalDespesa;
          const margem = totalReceita > 0 ? (resultado / totalReceita) * 100 : 0;
          const groupBy = (arr: OrcRow[]) => {
            const m = new Map<string, number>();
            for (const r of arr) m.set(r.categoria, (m.get(r.categoria) ?? 0) + Number(r.valor ?? 0));
            return Array.from(m.entries())
              .map(([categoria, valor]) => ({ categoria, valor }))
              .sort((a, b) => b.valor - a.valor);
          };
          const recLinhas = groupBy(receitas);
          const despLinhas = groupBy(despesasOrc);
          return (
            <section className="rounded-lg border bg-card shadow-sm">
              <div className="border-b px-4 py-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">DRE Partners — {mes.slice(0, 7)}</h2>
                  <p className="text-xs text-muted-foreground">
                    Receitas e despesas planejadas (Orçamento Partners) + Despesas C&amp;M lançadas neste mês.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Resultado</div>
                  <div className={cn("text-xl font-bold tabular-nums", resultado >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {BRL(resultado)}
                  </div>
                  <div className="text-xs text-muted-foreground">Margem: {margem.toFixed(1)}%</div>
                </div>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    <span>Receitas</span>
                    <span className="tabular-nums">{BRL(totalReceita)}</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {recLinhas.length === 0 ? (
                        <tr><td className="py-2 text-xs text-muted-foreground">Sem receitas lançadas neste mês.</td></tr>
                      ) : (
                        recLinhas.map((l) => (
                          <tr key={l.categoria} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">{l.categoria}</td>
                            <td className="py-1.5 text-right tabular-nums">{BRL(l.valor)}</td>
                            <td className="py-1.5 pl-2 text-right text-xs text-muted-foreground tabular-nums">
                              {totalReceita > 0 ? `${((l.valor / totalReceita) * 100).toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-red-700">
                    <span>Despesas</span>
                    <span className="tabular-nums">{BRL(totalDespesa)}</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {despLinhas.map((l) => (
                        <tr key={l.categoria} className="border-b last:border-0">
                          <td className="py-1.5 pr-3">{l.categoria}</td>
                          <td className="py-1.5 text-right tabular-nums">{BRL(l.valor)}</td>
                          <td className="py-1.5 pl-2 text-right text-xs text-muted-foreground tabular-nums">
                            {totalDespesa > 0 ? `${((l.valor / totalDespesa) * 100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b bg-muted/30 last:border-0">
                        <td className="py-1.5 pr-3">
                          Comercial &amp; Marketing
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            (realizado: {BRL(totalCmRealizado)})
                          </span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{BRL(totalCmPlanejado)}</td>
                        <td className="py-1.5 pl-2 text-right text-xs text-muted-foreground tabular-nums">
                          {totalDespesa > 0 ? `${((totalCmPlanejado / totalDespesa) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })()}

        {showRest && (<>
        {/* Rateio por BU */}
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Rateio por BU</h2>
            <p className="text-xs text-muted-foreground">
              Alocação total das despesas de C&M deste mês.
            </p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-[1fr_240px]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">BU</th>
                    <th className="py-2 pr-3 text-right">Total Alocado</th>
                    <th className="py-2 pr-3 text-right">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="py-4"><Skeleton className="h-16 w-full" /></td></tr>
                  ) : rateioPorBu.length === 0 ? (
                    <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Sem dados de rateio neste mês.</td></tr>
                  ) : (
                    rateioPorBu.map((r) => (
                      <tr key={r.bu} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: BU_COLORS[r.bu] ?? "#94a3b8" }}
                            />
                            {r.bu}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-medium tabular-nums">{BRL(r.valor)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                          {r.pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="h-[200px]">
              {rateioPorBu.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rateioPorBu}
                      dataKey="valor"
                      nameKey="bu"
                      innerRadius={45}
                      outerRadius={80}
                      stroke="none"
                    >
                      {rateioPorBu.map((r) => (
                        <Cell key={r.bu} fill={BU_COLORS[r.bu] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <RTooltip
                      formatter={(v: number) => BRL(v)}
                      contentStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          {/* Propostas (SQLs) usadas no rateio padrão */}
          <div className="border-t bg-muted/20 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Propostas (SQLs) usadas no rateio padrão deste mês
              </h3>
              <div className="flex items-center gap-3">
                {(() => {
                  const ts = sqls
                    .map((s) => (s.updated_at ? new Date(s.updated_at).getTime() : 0))
                    .filter((n) => n > 0);
                  if (ts.length === 0) return null;
                  const last = new Date(Math.max(...ts));
                  const stale = Date.now() - last.getTime() > 36 * 3600 * 1000;
                  return (
                    <span
                      className={cn("text-xs", stale ? "text-amber-600" : "text-muted-foreground")}
                      title={stale ? "Script externo pode estar atrasado" : undefined}
                    >
                      Atualizado em{" "}
                      {last.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  );
                })()}
                <span className="text-xs text-muted-foreground">Total: {BRL(sqlsTotal)}</span>
              </div>
            </div>
            {sqls.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Sem propostas em <code>sqls_por_bu</code> para {mes.slice(0, 7)} — rateio padrão usa divisão igual entre as 4 BUs.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {sqls
                  .slice()
                  .sort((a, b) => Number(b.valor) - Number(a.valor))
                  .map((s) => {
                    const pct = sqlsTotal > 0 ? (Number(s.valor) / sqlsTotal) * 100 : 0;
                    return (
                      <div key={s.bu} className="rounded-md border bg-card p-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: BU_COLORS[s.bu] ?? "#94a3b8" }}
                          />
                          {s.bu}
                        </div>
                        <div className="mt-1 text-sm font-semibold tabular-nums">{BRL(Number(s.valor))}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">{pct.toFixed(1)}%</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </section>

        {/* Resumo mês a mês */}
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Resumo mês a mês</h2>
            <p className="text-xs text-muted-foreground">Últimos 12 meses até o mês selecionado. Clique numa linha para abrir o mês.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pl-4 pr-3">Mês</th>
                  <th className="py-2 pr-3 text-right">Planejado</th>
                  <th className="py-2 pr-3 text-right">Pago</th>
                  <th className="py-2 pr-3 text-right">Pendente</th>
                  <th className="py-2 pr-4 text-right">Divergências</th>
                </tr>
              </thead>
              <tbody>
                {resumo.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem dados.</td></tr>
                ) : (
                  resumo.map((r) => {
                    const isAtual = r.mes === mes;
                    return (
                      <tr
                        key={r.mes}
                        className={cn(
                          "border-b last:border-0 cursor-pointer hover:bg-muted/30",
                          isAtual && "bg-primary/5 font-medium",
                        )}
                        onClick={() => setMes(r.mes)}
                      >
                        <td className="py-2 pl-4 pr-3">{r.mes.slice(0, 7)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{BRL(r.planejado)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{BRL(r.pago)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-300">{BRL(r.pendente)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {r.divergencias > 0 ? (
                            <span className="text-red-600 dark:text-red-300">{r.divergencias}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>


        {/* Tabela despesas */}
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Despesas do mês</h2>
              <p className="text-xs text-muted-foreground">
                Clique em uma linha para ver o rateio por BU.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Apuração:</span>
                {[
                  { v: "all", label: `Todos (${apuracao.totalLinhas})`, cls: "" },
                  { v: "pendente", label: `Pendentes (${BRL(apuracao.pendente)})`, cls: "text-amber-700" },
                  { v: "aprovado", label: `Aprovados (${BRL(apuracao.aprovado)})`, cls: "text-emerald-700" },
                  { v: "contestado", label: `Contestados (${BRL(apuracao.contestado)})`, cls: "text-red-700" },
                ].map((b) => (
                  <button
                    key={b.v}
                    onClick={() => setFApuracao(b.v as "all" | ApuracaoStatus)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 hover:bg-muted",
                      fApuracao === b.v && "bg-primary/10 border-primary/40 font-medium",
                      b.cls,
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 py-2 pl-3"></th>
                  <Th onClick={() => handleSort("fornecedor")} active={sortKey === "fornecedor"} dir={sortDir}>Fornecedor</Th>
                  <Th onClick={() => handleSort("dpto")} active={sortKey === "dpto"} dir={sortDir}>Dpto</Th>
                  <Th onClick={() => handleSort("categoria")} active={sortKey === "categoria"} dir={sortDir} className="hidden md:table-cell">Categoria</Th>
                  <Th onClick={() => handleSort("valor_planejado")} active={sortKey === "valor_planejado"} dir={sortDir} className="hidden md:table-cell text-right">Planejado</Th>
                  <Th onClick={() => handleSort("valor_realizado")} active={sortKey === "valor_realizado"} dir={sortDir} className="hidden md:table-cell text-right">Realizado</Th>
                  <Th onClick={() => handleSort("diferenca")} active={sortKey === "diferenca"} dir={sortDir} className="hidden md:table-cell text-right">Diferença</Th>
                  <Th onClick={() => handleSort("status")} active={sortKey === "status"} dir={sortDir}>Status</Th>
                  <th className="py-2 pr-3 text-xs">Apuração</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="p-4"><Skeleton className="h-24 w-full" /></td></tr>
                ) : confrontoOrdenado.length === 0 ? (
                  <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhuma despesa lançada neste mês.</td></tr>
                ) : (
                  confrontoOrdenado.map((row) => {
                    const key = `${row.fornecedor}||${row.tipo_despesa}||${row.dpto}`;
                    const dp = despesaIdByKey.get(key);
                    const isOpen = expanded === key;
                    const rateioDessa = dp
                      ? rateio.filter((x) => x.despesa_id === dp.id)
                      : [];
                    return (
                      <Fragment key={key}>
                        <tr
                          className="border-b hover:bg-muted/30 cursor-pointer"
                          onClick={() => setExpanded(isOpen ? null : key)}
                        >
                          <td className="py-2 pl-3 text-muted-foreground">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="py-2 pr-3 font-medium">{row.fornecedor}</td>
                          <td className="py-2 pr-3"><DptoBadge value={row.dpto} /></td>
                          <td className="hidden md:table-cell py-2 pr-3 text-muted-foreground">{row.categoria}</td>
                          <td className="hidden md:table-cell py-2 pr-3 text-right tabular-nums">{BRL(row.valor_planejado)}</td>
                          <td className="hidden md:table-cell py-2 pr-3 text-right tabular-nums" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              inputMode="decimal"
                              defaultValue={
                                row.valor_realizado != null
                                  ? row.valor_realizado.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  : ""
                              }
                              placeholder="—"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") {
                                  (e.target as HTMLInputElement).value =
                                    row.valor_realizado != null
                                      ? row.valor_realizado.toLocaleString("pt-BR", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })
                                      : "";
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              onBlur={(e) => handleRealizadoBlur(row, e.target.value)}
                              className="w-24 bg-transparent text-right outline-none focus:ring-1 focus:ring-primary rounded px-1"
                            />
                          </td>
                          <td className="hidden md:table-cell py-2 pr-3 text-right tabular-nums" onClick={(e) => e.stopPropagation()}>
                            <DiferencaCell row={row} onSave={handleObservacaoSave} />
                          </td>
                          <td className="py-2 pr-3"><StatusBadge row={row} /></td>
                          <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const isAvulso = dp && dp.origem === "avulso";
                              const st = row.apuracao_status;
                              const cls =
                                st === "aprovado"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                  : st === "contestado"
                                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
                              const label = st === "aprovado" ? "Aprovado" : st === "contestado" ? "Contestado" : "Pendente";
                              return (
                                <div className="flex items-center gap-1">
                                  <span
                                    title={row.motivo_contestacao ?? undefined}
                                    className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}
                                  >
                                    {label}
                                  </span>
                                  {isAvulso && st !== "aprovado" && (
                                    <button
                                      type="button"
                                      title="Aprovar"
                                      onClick={() => dp && setApuracao(dp, "aprovado")}
                                      className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-950"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {isAvulso && st !== "contestado" && (
                                    <button
                                      type="button"
                                      title="Contestar"
                                      onClick={() => {
                                        if (!dp) return;
                                        setMotivo(row.motivo_contestacao ?? "");
                                        setContestando({ row, dp });
                                      }}
                                      className="rounded p-0.5 text-red-700 hover:bg-red-100 dark:hover:bg-red-950"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>


                          <td className="py-2 pr-3 text-right">
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                type="button"
                                title="Critério de rateio"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCriterioModal({ fornecedor: row.fornecedor });
                                }}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <Settings2 className="h-4 w-4" />
                              </button>
                              {dp && (
                                <button
                                  type="button"
                                  title="Editar despesa"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditing(dp);
                                    setModalOpen(true);
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {dp && (
                                <button
                                  type="button"
                                  title="Excluir despesa"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteScope("mes");
                                    setDeleting(dp);
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={key + "-exp"} className="border-b bg-muted/20">
                            <td colSpan={10} className="p-4 space-y-3">
                              {(() => {
                                const crit = criterios.find(
                                  (c) => c.fornecedor.toLowerCase() === row.fornecedor.toLowerCase(),
                                );
                                const label =
                                  !crit ? "Padrão (50% igual + 50% SQLs)" :
                                  crit.tipo_rateio === "direto" ? `100% ${crit.bu_direto ?? "—"}` :
                                  crit.tipo_rateio === "custom" ? "Personalizado por BU" :
                                  "Padrão (50% igual + 50% SQLs)";
                                return (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Critério de rateio:</span>
                                    <span className="font-medium">{label}</span>
                                    <button
                                      type="button"
                                      onClick={() => setCriterioModal({ fornecedor: row.fornecedor })}
                                      className="ml-1 inline-flex items-center gap-1 rounded border bg-card px-2 py-0.5 text-xs hover:bg-muted"
                                    >
                                      <Settings2 className="h-3 w-3" /> Alterar
                                    </button>
                                  </div>
                                );
                              })()}
                              {rateioDessa.length === 0 ? (
                                <div className="text-xs text-muted-foreground">Sem rateio calculado para esta despesa.</div>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                  {rateioDessa.map((x) => (
                                    <div key={x.bu} className="rounded-md border bg-card p-3">
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: BU_COLORS[x.bu] ?? "#94a3b8" }} />
                                        {x.bu}
                                      </div>
                                      <div className="mt-1 text-base font-semibold tabular-nums">{BRL(x.valor_alocado)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
        </>)}
      </div>

      <DespesaModal
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setEditing(null);
        }}
        mesPadrao={mes}
        editing={editing}
        criterios={criterios}
        onSaved={load}
      />
      <CriterioModal
        open={criterioModal != null}
        onOpenChange={(o: boolean) => { if (!o) setCriterioModal(null); }}
        fornecedor={criterioModal?.fornecedor ?? ""}
        criterios={criterios}
        onSaved={load}
      />
      <AlertDialog
        open={deleting != null}
        onOpenChange={(o) => { if (!o && !deletingBusy) { setDeleting(null); setDeleteScope("mes"); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>
                  Tem certeza que deseja excluir <strong>{deleting?.fornecedor}</strong>?
                  {deleting && deleting.id < 0 && " Esta ação não pode ser desfeita."}
                </div>
                {deleting && deleting.id > 0 && (
                  <RadioGroup
                    value={deleteScope}
                    onValueChange={(v) => setDeleteScope(v as "mes" | "futuros" | "tudo")}
                    className="space-y-2 pt-1"
                  >
                    <label className="flex items-start gap-2 cursor-pointer">
                      <RadioGroupItem value="mes" className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium text-foreground">Apenas este mês</span>
                        <span className="block text-xs text-muted-foreground">
                          Volta a aparecer nos próximos meses.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <RadioGroupItem value="futuros" className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium text-foreground">Este mês e meses futuros</span>
                        <span className="block text-xs text-muted-foreground">
                          Desativa o fornecedor para não gerar mais. Meses passados ficam intactos.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <RadioGroupItem value="tudo" className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium text-foreground">Excluir fornecedor inteiro</span>
                        <span className="block text-xs text-muted-foreground">
                          Remove o fornecedor e todos os lançamentos (passado e futuro).
                        </span>
                      </span>
                    </label>
                  </RadioGroup>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingBusy}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBusy ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportarPlanilhaDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        mesPadrao={mes}
        onImported={() => {
          load();
          loadResumo();
        }}
      />

      <Dialog open={contestando != null} onOpenChange={(o) => { if (!o) { setContestando(null); setMotivo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contestar despesa</DialogTitle>
          </DialogHeader>
          {contestando && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{contestando.row.fornecedor}</div>
                <div className="text-xs text-muted-foreground">
                  {contestando.row.dpto} · {BRL(contestando.row.valor_planejado)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo da contestação *</Label>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: valor divergente do contrato, despesa não reconhecida, lançada em duplicidade…"
                  maxLength={500}
                  rows={4}
                />
                <div className="text-right text-xs text-muted-foreground">{motivo.length}/500</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setContestando(null); setMotivo(""); }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length === 0}
              onClick={async () => {
                if (!contestando) return;
                await setApuracao(contestando.dp, "contestado", motivo.trim());
                setContestando(null);
                setMotivo("");
              }}
            >
              Contestar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "py-2 pr-3 select-none",
        onClick && "cursor-pointer hover:text-foreground",
        active && "text-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

// ---------------- Diferença + Justificativa ----------------

function DiferencaCell({
  row,
  onSave,
}: {
  row: ConfrontoRow;
  onSave: (row: ConfrontoRow, texto: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState(row.observacao ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setTexto(row.observacao ?? "");
  }, [open, row.observacao]);

  const diff = row.diferenca;
  const hasReal = row.valor_realizado != null;
  const color =
    !hasReal || diff == null || Math.abs(diff) < 0.005
      ? "text-muted-foreground"
      : diff > 0
        ? "text-red-600 dark:text-red-300"
        : "text-emerald-700 dark:text-emerald-300";
  const label = !hasReal || diff == null
    ? "—"
    : (diff > 0 ? "+" : "") + BRL(diff);

  const hasObs = (row.observacao ?? "").trim() !== "";

  return (
    <div className="inline-flex items-center gap-1 justify-end">
      <span className={cn("tabular-nums", color)}>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={hasObs ? row.observacao ?? "" : "Adicionar justificativa"}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "rounded p-1 hover:bg-muted",
              hasObs ? "text-amber-600" : "text-muted-foreground/60",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-72 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-medium">Justificativa da diferença</div>
          <Textarea
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Por que o realizado ficou diferente do planejado?"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(row, texto);
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}



// ---------------- Modal ----------------

const BUS_FIXAS = ["Matriz", "Partners", "Construção Civil", "Consultoria"] as const;
type BuFixa = (typeof BUS_FIXAS)[number];

function DespesaModal({
  open,
  onOpenChange,
  mesPadrao,
  editing,
  criterios,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mesPadrao: string;
  editing: DespesaRow | null;
  criterios: Criterio[];
  onSaved: () => void;
}) {
  const cats = useCategoriasDespesa();
  const deps = useDepartamentosDespesa();
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const [fornecedor, setFornecedor] = useState("");
  const [tipoDespesa, setTipoDespesa] = useState<string>("");
  const [dpto, setDpto] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [mes, setMes] = useState<string>(mesPadrao);
  const [recorrente, setRecorrente] = useState(false);
  const [mesFim, setMesFim] = useState<string>(mesPadrao);
  const [valorRealizado, setValorRealizado] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [tipoRateio, setTipoRateio] = useState<"padrao" | "direto" | "custom">("padrao");
  const [buDireto, setBuDireto] = useState<BuFixa>("Partners");
  const [pctsCustom, setPctsCustom] = useState<Record<BuFixa, string>>({
    Matriz: "25", Partners: "25", "Construção Civil": "25", Consultoria: "25",
  });

  const customSum = useMemo(
    () => BUS_FIXAS.reduce((s, bu) => s + (parseFloat(pctsCustom[bu].replace(",", ".")) || 0), 0),
    [pctsCustom],
  );

  // pré-preenche tipo de rateio com base no critério existente do fornecedor
  useEffect(() => {
    if (!open) return;
    const nome = (fornecedor ?? "").trim().toLowerCase();
    if (!nome) {
      setTipoRateio("padrao");
      setBuDireto("Partners");
      setPctsCustom({ Matriz: "25", Partners: "25", "Construção Civil": "25", Consultoria: "25" });
      return;
    }
    const c = criterios.find((x) => x.fornecedor.toLowerCase() === nome);
    if (!c) return;
    const t = (c.tipo_rateio as "padrao" | "direto" | "custom") ?? "padrao";
    setTipoRateio(t);
    if (t === "direto" && c.bu_direto) setBuDireto(c.bu_direto as BuFixa);
    if (t === "custom" && c.percentuais_custom) {
      const np: Record<BuFixa, string> = { Matriz: "25", Partners: "25", "Construção Civil": "25", Consultoria: "25" };
      for (const bu of BUS_FIXAS) {
        const v = c.percentuais_custom[bu];
        if (typeof v === "number") np[bu] = String(Math.round(v * 1000) / 10);
      }
      setPctsCustom(np);
    }
  }, [open, fornecedor, criterios]);

  useEffect(() => {
    if (open) {

      if (editing) {
        setFornecedor(editing.fornecedor);
        setTipoDespesa(editing.tipo_despesa);
        setDpto(editing.dpto ?? "");
        setValor(String(editing.valor_total));
        setMes(editing.mes);
        setRecorrente(false);
        setMesFim(editing.mes);
        setValorRealizado(
          editing.valor_pago != null
            ? editing.valor_pago.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "",
        );
        setDataPagamento(editing.data_pagamento ?? "");
        setObservacao(editing.observacao ?? "");
      } else {
        setFornecedor("");
        setTipoDespesa(cats.items[0]?.nome ?? "");
        setDpto(deps.items[0]?.nome ?? "");
        setValor("");
        setMes(mesPadrao);
        setRecorrente(false);
        const [y] = mesPadrao.split("-").map(Number);
        setMesFim(`${y}-12-01`);
        setValorRealizado("");
        setDataPagamento("");
        setObservacao("");
      }
    }
  }, [open, editing, mesPadrao, cats.items, deps.items]);

  const sugestoes = useMemo(() => {
    const q = fornecedor.trim().toLowerCase();
    if (!q) return [];
    return criterios
      .filter((c) => c.fornecedor.toLowerCase().includes(q) && c.fornecedor.toLowerCase() !== q)
      .slice(0, 6);
  }, [fornecedor, criterios]);

  const handleSave = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!fornecedor.trim() || !tipoDespesa || !dpto || !Number.isFinite(v) || v <= 0) {
      toast.error("Preencha fornecedor, tipo, departamento e valor.");
      return;
    }
    if (tipoRateio === "custom" && Math.abs(customSum - 100) > 0.01) {
      toast.error(`Percentuais do rateio devem somar 100% (atual: ${customSum.toFixed(1)}%)`);
      return;
    }
    setSaving(true);

    try {
      // realizado / pagamento / observação (somente edição)
      let realizadoNum: number | null = null;
      if (editing) {
        const t = valorRealizado.trim();
        if (t !== "") {
          const n = Number(t.replace(/\./g, "").replace(",", "."));
          if (!Number.isFinite(n)) {
            toast.error("Valor realizado inválido.");
            setSaving(false);
            return;
          }
          realizadoNum = n;
        }
      }
      const obsTrim = observacao.trim();
      const realizadoPayload = editing
        ? {
            valor_pago: realizadoNum,
            data_pagamento:
              realizadoNum != null
                ? (dataPagamento || new Date().toISOString().slice(0, 10))
                : null,
            status: realizadoNum != null ? "pago" : "pendente",
            observacao: obsTrim === "" ? null : obsTrim,
          }
        : null;

      if (editing) {
        // id > 0 ⇒ vem do catálogo (override de fornecedor recorrente)
        // id < 0 ⇒ vem de despesas_cm_avulsos (id = -avulso.id)
        if (editing.id > 0) {
          const { data: ovr, error: eOv } = await supabase
            .from("despesas_cm_overrides")
            .select("fornecedor_id")
            .eq("id", editing.id)
            .single();
          if (eOv) throw eOv;
          const fid = ovr.fornecedor_id;
          const { error: eF } = await supabase
            .from("despesas_cm_fornecedores")
            .update({
              nome: fornecedor.trim(),
              categoria: tipoDespesa,
              departamento: dpto as string,
            })
            .eq("id", fid);
          if (eF) throw eF;
          const { error: eO } = await supabase
            .from("despesas_cm_overrides")
            .update({ valor: v, ...realizadoPayload! })
            .eq("id", editing.id);
          if (eO) throw eO;
        } else if (editing.id < 0) {
          const aid = -editing.id;
          const { error } = await supabase
            .from("despesas_cm_avulsos")
            .update({
              fornecedor: fornecedor.trim(),
              categoria: tipoDespesa,
              departamento: dpto as string,
              valor_total: v,
              mes,
              ...realizadoPayload!,
            })
            .eq("id", aid);
          if (error) throw error;
        }
        toast.success("Despesa atualizada.");
      } else {
        // gera lista de meses
        const meses: string[] = [];
        if (recorrente) {
          const [yi, mi] = mes.split("-").map(Number);
          const [yf, mf] = mesFim.split("-").map(Number);
          const start = yi * 12 + (mi - 1);
          const end = yf * 12 + (mf - 1);
          if (end < start) throw new Error("Mês final deve ser ≥ mês inicial.");
          for (let k = start; k <= end; k++) {
            const y = Math.floor(k / 12);
            const m = (k % 12) + 1;
            meses.push(`${y}-${String(m).padStart(2, "0")}-01`);
          }
        } else {
          meses.push(mes);
        }

        if (recorrente) {
          // catálogo unificado: garante fornecedor + insere overrides nos meses
          const { data: fExist } = await supabase
            .from("despesas_cm_fornecedores")
            .select("id")
            .ilike("nome", fornecedor.trim())
            .limit(1)
            .maybeSingle();
          let fid: number | undefined = fExist?.id as number | undefined;
          if (!fid) {
            const { data: fNew, error: eFN } = await supabase
              .from("despesas_cm_fornecedores")
              .insert({
                nome: fornecedor.trim(),
                categoria: tipoDespesa,
                departamento: dpto as string,
                tipo: "fixo",
                valor_base: v,
                rateio_regra: "padrao",
                ativo: true,
              })
              .select("id")
              .single();
            if (eFN) throw eFN;
            fid = fNew.id;
          }

          const { data: ovrExist } = await supabase
            .from("despesas_cm_overrides")
            .select("mes")
            .eq("fornecedor_id", fid)
            .in("mes", meses);
          const jaExistem = new Set((ovrExist ?? []).map((r) => r.mes as string));
          const novos = meses.filter((m) => !jaExistem.has(m));

          if (novos.length === 0) {
            toast.info("Despesa já existe em todos os meses selecionados.");
          } else {
            const rows = novos.map((m) => ({
              fornecedor_id: fid!,
              mes: m,
              valor: v,
              status: "pendente",
            }));
            const { error } = await supabase.from("despesas_cm_overrides").insert(rows);
            if (error) throw error;
            const pulou = meses.length - novos.length;
            toast.success(
              `${novos.length} despesa(s) lançada(s)` +
                (pulou > 0 ? ` · ${pulou} já existia(m)` : ""),
            );
          }
        } else {
          // pontual: registra em despesas_cm_avulsos
          const rows = meses.map((m) => ({
            mes: m,
            fornecedor: fornecedor.trim(),
            categoria: tipoDespesa,
            departamento: dpto as string,
            valor_total: v,
            status: "pendente",
          }));
          const { error } = await supabase.from("despesas_cm_avulsos").insert(rows);
          if (error) throw error;
          toast.success(`${rows.length} despesa(s) lançada(s).`);
        }
      }

      // upsert do critério de rateio para este fornecedor
      const nomeFornecedor = fornecedor.trim();
      const criterioPayload = {
        fornecedor: nomeFornecedor,
        tipo_rateio: tipoRateio,
        bu_direto: tipoRateio === "direto" ? buDireto : null,
        percentuais_custom:
          tipoRateio === "custom"
            ? Object.fromEntries(
                BUS_FIXAS.map((bu) => [
                  bu,
                  (parseFloat(pctsCustom[bu].replace(",", ".")) || 0) / 100,
                ]),
              )
            : null,
        ativo: true,
      };
      const existente = criterios.find(
        (c) => c.fornecedor.toLowerCase() === nomeFornecedor.toLowerCase(),
      );
      if (existente) {
        const { error: eCr } = await supabase
          .from("criterios_rateio_cm")
          .update(criterioPayload)
          .eq("id", existente.id);
        if (eCr) throw eCr;
      } else {
        const { error: eCr } = await supabase
          .from("criterios_rateio_cm")
          .insert(criterioPayload);
        if (eCr) throw eCr;
      }

      onOpenChange(false);
      onSaved();

    } catch (e) {
      toast.error("Erro ao salvar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>{editing ? "Editar despesa" : "Lançar despesa"}</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCadastrosOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Gerenciar cadastros
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <Input
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Ex.: GOOGLE BR INTERNET"
              list="fornecedores-cm"
            />
            <datalist id="fornecedores-cm">
              {criterios.map((c) => (
                <option key={c.id} value={c.fornecedor} />
              ))}
            </datalist>
            {sugestoes.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Sugestões: {sugestoes.map((s) => s.fornecedor).join(" · ")}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de Despesa</Label>
            <Select value={tipoDespesa} onValueChange={setTipoDespesa}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {cats.items.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhuma categoria cadastrada.
                  </div>
                )}
                {cats.items.map((t) => (
                  <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                ))}
                {editing && tipoDespesa && !cats.items.some((c) => c.nome === tipoDespesa) && (
                  <SelectItem value={tipoDespesa}>{tipoDespesa} (legado)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Departamento</Label>
            <Select value={dpto} onValueChange={setDpto}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {deps.items.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum departamento cadastrado.
                  </div>
                )}
                {deps.items.map((d) => (
                  <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                ))}
                {editing && dpto && !deps.items.some((d) => d.nome === dpto) && (
                  <SelectItem value={dpto}>{dpto} (legado)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label>Rateio entre BUs</Label>
              <Select value={tipoRateio} onValueChange={(v) => setTipoRateio(v as typeof tipoRateio)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Padrão (50% igual + 50% por SQLs)</SelectItem>
                  <SelectItem value="direto">100% para uma BU</SelectItem>
                  <SelectItem value="custom">Personalizado (% por BU)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipoRateio === "direto" && (
              <div className="space-y-1.5">
                <Label className="text-xs">BU que assume 100%</Label>
                <Select value={buDireto} onValueChange={(v) => setBuDireto(v as BuFixa)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUS_FIXAS.map((bu) => (
                      <SelectItem key={bu} value={bu}>{bu}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tipoRateio === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Percentual por BU</Label>
                <div className="grid grid-cols-2 gap-2">
                  {BUS_FIXAS.map((bu) => (
                    <div key={bu} className="space-y-1">
                      <span className="text-xs text-muted-foreground">{bu}</span>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.1"
                          value={pctsCustom[bu]}
                          onChange={(e) => setPctsCustom({ ...pctsCustom, [bu]: e.target.value })}
                          className="pr-7"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={cn(
                    "text-xs",
                    Math.abs(customSum - 100) < 0.01 ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  Soma: {customSum.toFixed(1)}% {Math.abs(customSum - 100) >= 0.01 && "(deve ser 100%)"}
                </div>
              </div>
            )}
          </div>


          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{recorrente ? "Mês inicial" : "Mês de referência"}</Label>
              <Input
                type="month"
                value={toMonthInput(mes)}
                onChange={(e) => e.target.value && setMes(fromMonthInput(e.target.value))}
              />
            </div>
          </div>

          {editing && (() => {
            const planejado = parseFloat(valor.replace(",", ".")) || 0;
            const realNum = (() => {
              const t = valorRealizado.trim();
              if (t === "") return null;
              const n = Number(t.replace(/\./g, "").replace(",", "."));
              return Number.isFinite(n) ? n : null;
            })();
            const diff = realNum != null ? realNum - planejado : null;
            const diffColor =
              diff == null || Math.abs(diff) < 0.005
                ? "text-muted-foreground"
                : diff > 0
                  ? "text-red-600"
                  : "text-emerald-700";
            return (
              <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Realizado
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Valor realizado (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={valorRealizado}
                      onChange={(e) => setValorRealizado(e.target.value)}
                      placeholder="—"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data do pagamento</Label>
                    <Input
                      type="date"
                      value={dataPagamento}
                      onChange={(e) => setDataPagamento(e.target.value)}
                    />
                  </div>
                </div>
                <div className={cn("text-xs tabular-nums", diffColor)}>
                  Diferença: {diff == null ? "—" : (diff > 0 ? "+" : "") + BRL(diff)}
                </div>
                <div className="space-y-1.5">
                  <Label>Justificativa da diferença (opcional)</Label>
                  <Textarea
                    rows={3}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Por que o realizado ficou diferente do planejado?"
                  />
                </div>
              </div>
            );
          })()}



          {!editing && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                  className="h-4 w-4"
                />
                Despesa recorrente (replicar em vários meses)
              </label>
              {recorrente && (
                <div className="space-y-1.5 pl-6">
                  <Label className="text-xs">Repetir até o mês</Label>
                  <Input
                    type="month"
                    value={toMonthInput(mesFim)}
                    onChange={(e) =>
                      e.target.value && setMesFim(fromMonthInput(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Será criada uma despesa por mês. Meses que já têm esse fornecedor são pulados.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <CadastrosDespesasDialog open={cadastrosOpen} onOpenChange={setCadastrosOpen} />
    </Dialog>
  );
}

// ---------------- Critério de Rateio Modal ----------------



function CriterioModal({
  open,
  onOpenChange,
  fornecedor,
  criterios,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fornecedor: string;
  criterios: Criterio[];
  onSaved: () => void;
}) {
  const existente = useMemo(
    () =>
      criterios.find(
        (c) => c.fornecedor.toLowerCase() === (fornecedor ?? "").toLowerCase(),
      ) ?? null,
    [criterios, fornecedor],
  );

  const [tipo, setTipo] = useState<"padrao" | "direto" | "custom">("padrao");
  const [buDireto, setBuDireto] = useState<BuFixa>("Partners");
  const [pcts, setPcts] = useState<Record<BuFixa, string>>({
    Matriz: "25",
    Partners: "25",
    "Construção Civil": "25",
    Consultoria: "25",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existente) {
      const t = (existente.tipo_rateio as "padrao" | "direto" | "custom") ?? "padrao";
      setTipo(t);
      if (t === "direto" && existente.bu_direto) {
        setBuDireto(existente.bu_direto as BuFixa);
      }
      if (t === "custom" && existente.percentuais_custom) {
        const np = { ...pcts };
        for (const bu of BUS_FIXAS) {
          const v = existente.percentuais_custom[bu];
          if (typeof v === "number") np[bu] = String(Math.round(v * 1000) / 10);
        }
        setPcts(np);
      }
    } else {
      setTipo("padrao");
      setBuDireto("Partners");
      setPcts({ Matriz: "25", Partners: "25", "Construção Civil": "25", Consultoria: "25" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existente]);

  const customSum = useMemo(
    () => BUS_FIXAS.reduce((s, bu) => s + (parseFloat(pcts[bu].replace(",", ".")) || 0), 0),
    [pcts],
  );

  const handleSave = async () => {
    if (!fornecedor.trim()) return;
    if (tipo === "custom" && Math.abs(customSum - 100) > 0.01) {
      toast.error(`Percentuais devem somar 100% (atual: ${customSum.toFixed(1)}%)`);
      return;
    }
    setSaving(true);
    try {
      const payload: {
        fornecedor: string;
        tipo_rateio: string;
        bu_direto: string | null;
        percentuais_custom: Record<string, number> | null;
        ativo: boolean;
      } = {
        fornecedor: fornecedor.trim(),
        tipo_rateio: tipo,
        bu_direto: tipo === "direto" ? buDireto : null,
        percentuais_custom:
          tipo === "custom"
            ? Object.fromEntries(
                BUS_FIXAS.map((bu) => [
                  bu,
                  (parseFloat(pcts[bu].replace(",", ".")) || 0) / 100,
                ]),
              )
            : null,
        ativo: true,
      };
      if (existente) {
        const { error } = await supabase
          .from("criterios_rateio_cm")
          .update(payload)
          .eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("criterios_rateio_cm").insert(payload);
        if (error) throw error;
      }
      toast.success("Critério de rateio salvo.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Erro ao salvar critério: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Critério de rateio — {fornecedor}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de rateio</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="padrao">Padrão (50% igual entre BUs + 50% por SQLs)</SelectItem>
                <SelectItem value="direto">100% para uma BU</SelectItem>
                <SelectItem value="custom">Personalizado (% por BU)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "direto" && (
            <div className="space-y-1.5">
              <Label>BU que assume 100% da despesa</Label>
              <Select value={buDireto} onValueChange={(v) => setBuDireto(v as BuFixa)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUS_FIXAS.map((bu) => (
                    <SelectItem key={bu} value={bu}>{bu}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === "custom" && (
            <div className="space-y-2">
              <Label>Percentual por BU</Label>
              <div className="grid grid-cols-2 gap-2">
                {BUS_FIXAS.map((bu) => (
                  <div key={bu} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{bu}</span>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={pcts[bu]}
                        onChange={(e) => setPcts({ ...pcts, [bu]: e.target.value })}
                        className="pr-7"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className={cn(
                  "text-xs",
                  Math.abs(customSum - 100) < 0.01
                    ? "text-emerald-600"
                    : "text-red-600",
                )}
              >
                Soma: {customSum.toFixed(1)}% {Math.abs(customSum - 100) >= 0.01 && "(deve ser 100%)"}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
