import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useCallback } from "react";
import { X, ChevronRight, Link2, AlertCircle, CheckCircle2, Circle, Minus, Plus, Eye, EyeOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import {
  listReconciliacao,
  updateReconciliacao,
  addAssociacao,
  removeAssociacao,
  type ReconciliacaoRow,
  type OmieNaoMapeado,
} from "@/lib/reconciliacao.functions";

export const Route = createFileRoute("/_authenticated/reconciliacao")({
  head: () => ({ meta: [{ title: "Reconciliação – Planning" }] }),
  component: ReconciliacaoPage,
});

// ─── Formatters ──────────────────────────────────────────────
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const mesLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const n = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${n[Number(mo)-1]}/${y.slice(2)}`;
};
const dtLabel = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

// ─── Column definitions ───────────────────────────────────────
type ColKey = "deal_id" | "nome" | "mrr" | "cnpj" | "data_venda" | "razao_social" | "pipedrive" | "omie" | "ana" | "fonte" | "status" | "primeiro_pag" | "total_rec";

const COLS: { key: ColKey; label: string; defaultVisible: boolean }[] = [
  { key: "deal_id",     label: "ID Deal",        defaultVisible: true  },
  { key: "nome",        label: "Nome",            defaultVisible: true  },
  { key: "mrr",         label: "MRR",             defaultVisible: true  },
  { key: "cnpj",        label: "CNPJ",            defaultVisible: true  },
  { key: "data_venda",  label: "Data da Venda",   defaultVisible: true  },
  { key: "razao_social",label: "Razão Social",    defaultVisible: false },
  { key: "pipedrive",   label: "Pipedrive",       defaultVisible: true  },
  { key: "omie",        label: "Omie Sócio",      defaultVisible: true  },
  { key: "ana",         label: "Planilha Ana",    defaultVisible: true  },
  { key: "fonte",       label: "Fonte",           defaultVisible: false },
  { key: "status",      label: "Status",          defaultVisible: true  },
  { key: "primeiro_pag",label: "1º Pagamento",    defaultVisible: true  },
  { key: "total_rec",   label: "Total Recebido",  defaultVisible: true  },
];

function useColVisibility() {
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(() => {
    try {
      const stored = localStorage.getItem("reconciliacao_cols");
      if (stored) return JSON.parse(stored);
    } catch {}
    return Object.fromEntries(COLS.map((c) => [c.key, c.defaultVisible])) as Record<ColKey, boolean>;
  });

  const toggle = useCallback((key: ColKey) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("reconciliacao_cols", JSON.stringify(next));
      return next;
    });
  }, []);

  return { visible, toggle };
}

// ─── Status badge ─────────────────────────────────────────────
const STATUS_CFG = {
  ativo:  { label: "Ativo",  cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  churn:  { label: "Churn",  cls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
  pausa:  { label: "Pausa",  cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status || !(status in STATUS_CFG)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", cfg.cls)}>{cfg.label}</span>;
}

function Flag({ ok }: { ok: boolean | null }) {
  if (ok === null) return <Minus className="h-4 w-4 text-muted-foreground/40" />;
  return ok
    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    : <Circle className="h-4 w-4 text-muted-foreground/30" />;
}

// ─── Drawer ───────────────────────────────────────────────────
function RecordDrawer({
  row,
  naoMapeados,
  onClose,
  onUpdate,
}: {
  row: ReconciliacaoRow;
  naoMapeados: OmieNaoMapeado[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateReconciliacao);
  const addFn = useServerFn(addAssociacao);
  const removeFn = useServerFn(removeAssociacao);

  const [obs, setObs] = useState(row.obs_reconciliacao ?? "");
  const [addingCnpj, setAddingCnpj] = useState("");
  const [addingRazao, setAddingRazao] = useState("");
  const [showAssocForm, setShowAssocForm] = useState(false);

  const updateMut = useMutation({
    mutationFn: (p: Parameters<typeof updateReconciliacao>[0]["data"]) => updateFn({ data: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reconciliacao"] }); onUpdate(); },
  });

  const addMut = useMutation({
    mutationFn: (p: Parameters<typeof addAssociacao>[0]["data"]) => addFn({ data: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reconciliacao"] }); onUpdate(); setAddingCnpj(""); setAddingRazao(""); setShowAssocForm(false); },
  });

  const removeMut = useMutation({
    mutationFn: (p: Parameters<typeof removeAssociacao>[0]["data"]) => removeFn({ data: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reconciliacao"] }); onUpdate(); },
  });

  function saveStatus(s: string | null) {
    updateMut.mutate({ contrato_id: row.contrato_id, status_reconciliacao: s });
  }

  function saveObs() {
    updateMut.mutate({ contrato_id: row.contrato_id, obs_reconciliacao: obs || null });
  }

  function toggleAna() {
    updateMut.mutate({ contrato_id: row.contrato_id, na_planilha_ana: !row.na_planilha_ana });
  }

  function handleAddCnpj() {
    const clean = addingCnpj.replace(/\D/g, "");
    if (!clean) return;
    addMut.mutate({ contrato_id: row.contrato_id, cpf_cnpj: clean, razao_social: addingRazao || undefined });
  }

  // Sugerir CNPJs não mapeados da mesma unidade
  const sugestoes = useMemo(
    () => naoMapeados.filter((n) => n.unidade === row.unidade).slice(0, 10),
    [naoMapeados, row.unidade],
  );

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-card shadow-2xl sm:w-[520px]">
      {/* Header */}
      <div className="flex items-start justify-between border-b p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.unidade}</p>
          <h2 className="text-base font-semibold text-foreground">{row.nome}</h2>
          {row.razao_social && row.razao_social !== row.nome && (
            <p className="text-xs text-muted-foreground">{row.razao_social}</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Identidade */}
        <Section label="Identificação">
          <Grid2>
            <Kv label="Deal ID" value={row.deal_id ?? "—"} mono />
            <Kv label="CNPJ" value={row.cnpj ? row.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "—"} mono />
            <Kv label="MRR Contratado" value={row.mrr ? brl(row.mrr) : "—"} />
            <Kv label="Data da Venda" value={dtLabel(row.data_venda)} />
          </Grid2>
          {row.deal_id && (
            <a
              href={`https://app.pipedrive.com/deal/${row.deal_id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ChevronRight className="h-3 w-3" /> Ver no Pipedrive
            </a>
          )}
        </Section>

        {/* Rastreabilidade */}
        <Section label="Rastreabilidade">
          <div className="flex flex-col gap-2">
            <FlagRow icon={<Flag ok={row.em_pipedrive} />} label="Pipedrive" ok={row.em_pipedrive} />
            <FlagRow icon={<Flag ok={row.em_omie} />} label="Omie Sócio" ok={row.em_omie} />
            <div className="flex items-center justify-between">
              <FlagRow icon={<Flag ok={row.na_planilha_ana} />} label="Planilha Ana" ok={row.na_planilha_ana} />
              <button
                type="button"
                onClick={toggleAna}
                disabled={updateMut.isPending}
                className="text-xs text-primary hover:underline"
              >
                {row.na_planilha_ana ? "Remover" : "Marcar como Sim"}
              </button>
            </div>
          </div>
        </Section>

        {/* Status */}
        <Section label="Status de Reconciliação">
          <div className="flex flex-wrap gap-2">
            {(["ativo", "churn", "pausa"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => saveStatus(row.status_reconciliacao === s ? null : s)}
                disabled={updateMut.isPending}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  row.status_reconciliacao === s
                    ? cn(STATUS_CFG[s].cls, "border-transparent")
                    : "border-border text-muted-foreground hover:border-foreground/30",
                )}
              >
                {STATUS_CFG[s].label}
              </button>
            ))}
          </div>
          <textarea
            className="mt-2 w-full rounded-md border bg-background p-2 text-sm resize-none"
            rows={2}
            placeholder="Observações (motivo de churn, pausa, etc.)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={saveObs}
          />
        </Section>

        {/* CNPJs associados */}
        <Section label="CNPJs Associados (Omie)">
          {row.cnpjs_associados.length === 0 && !row.cnpj && (
            <p className="text-xs text-muted-foreground">Nenhum CNPJ vinculado a este contrato.</p>
          )}
          {row.cnpj && (
            <div className="flex items-center gap-2 rounded bg-muted/50 px-3 py-1.5 text-xs">
              <span className="font-mono text-foreground">{row.cnpj}</span>
              <span className="text-muted-foreground">(principal)</span>
            </div>
          )}
          {row.cnpjs_associados.map((a) => (
            <div key={a.cnpj} className="flex items-center justify-between rounded bg-muted/30 px-3 py-1.5 text-xs">
              <span className="font-mono">{a.cnpj}</span>
              {a.razao_social && <span className="truncate text-muted-foreground ml-2">{a.razao_social}</span>}
              <button
                type="button"
                onClick={() => removeMut.mutate({ contrato_id: row.contrato_id, cpf_cnpj: a.cnpj })}
                className="ml-2 rounded p-0.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Sugestões de não-mapeados */}
          {sugestoes.length > 0 && !showAssocForm && (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Sugestões ({row.unidade})</p>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                {sugestoes.map((s) => (
                  <button
                    key={s.cnpj}
                    type="button"
                    onClick={() => addMut.mutate({ contrato_id: row.contrato_id, cpf_cnpj: s.cnpj, razao_social: s.razao_social })}
                    className="flex items-center justify-between rounded border border-dashed px-3 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <span className="font-mono">{s.cnpj}</span>
                    <span className="truncate text-muted-foreground ml-2 max-w-[160px]">{s.razao_social}</span>
                    <span className="ml-auto shrink-0 text-primary">{brl(s.total_recebido)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAssocForm((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> Associar CNPJ manualmente
          </button>

          {showAssocForm && (
            <div className="mt-1 flex gap-2">
              <input
                className="h-8 w-40 rounded-md border bg-background px-2 font-mono text-xs"
                placeholder="CNPJ (só dígitos)"
                value={addingCnpj}
                onChange={(e) => setAddingCnpj(e.target.value)}
              />
              <input
                className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                placeholder="Razão social (opcional)"
                value={addingRazao}
                onChange={(e) => setAddingRazao(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddCnpj}
                disabled={addMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
              >
                OK
              </button>
            </div>
          )}
        </Section>

        {/* Histórico de pagamento */}
        <Section label="Histórico de Pagamento (Omie)">
          {row.pagamentos_mensais.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum recebimento encontrado no Omie.</p>
          ) : (
            <>
              <div className="mb-2 flex gap-4 text-xs">
                <span>1º pag: <strong>{row.primeiro_pagamento ? mesLabel(row.primeiro_pagamento.slice(0,7)) : "—"}</strong></span>
                {row.dias_ate_primeiro_pag !== null && (
                  <span className={cn(row.dias_ate_primeiro_pag > 60 ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                    {row.dias_ate_primeiro_pag}d após venda
                    {row.dias_ate_primeiro_pag > 60 && " ⚠️"}
                  </span>
                )}
                <span>Total: <strong>{brl(row.total_recebido)}</strong></span>
              </div>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {row.pagamentos_mensais.map((p) => (
                  <div key={p.mes} className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5 text-xs">
                    <span className="font-medium">{mesLabel(p.mes)}</span>
                    <span>{brl(p.valor)}</span>
                    {row.mrr && (
                      <span className={cn("text-[10px]", p.valor / row.mrr >= 0.8 ? "text-emerald-600" : "text-amber-600")}>
                        {Math.round((p.valor / row.mrr) * 100)}% MRR
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>;
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-sm text-foreground", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}

function FlagRow({ icon, label, ok }: { icon: React.ReactNode; label: string; ok: boolean | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span className={cn(ok === null ? "text-muted-foreground" : ok ? "text-foreground" : "text-muted-foreground/60")}>{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
function ReconciliacaoPage() {
  const listFn = useServerFn(listReconciliacao);
  const [selected, setSelected] = useState<ReconciliacaoRow | null>(null);
  const [q, setQ] = useState("");
  const [unidadeFilter, setUnidadeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "sem_omie" | "sem_ana" | "churn" | "pausa" | "atraso60">("todos");
  const [showColPicker, setShowColPicker] = useState(false);
  const { visible, toggle } = useColVisibility();

  const qResult = useQuery({
    queryKey: ["reconciliacao"],
    queryFn: () => listFn({ data: undefined }),
    staleTime: 30_000,
  });

  const { rows = [], nao_mapeados = [] } = qResult.data ?? {};

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return rows.filter((r) => {
      if (unidadeFilter && r.unidade !== unidadeFilter) return false;
      if (statusFilter === "sem_omie" && r.em_omie) return false;
      if (statusFilter === "sem_ana" && r.na_planilha_ana !== false && r.na_planilha_ana !== null) return false;
      if (statusFilter === "churn" && r.status_reconciliacao !== "churn") return false;
      if (statusFilter === "pausa" && r.status_reconciliacao !== "pausa") return false;
      if (statusFilter === "atraso60" && (r.dias_ate_primeiro_pag === null || r.dias_ate_primeiro_pag <= 60)) return false;
      if (ql) {
        const hay = `${r.nome} ${r.razao_social ?? ""} ${r.cnpj ?? ""} ${r.deal_id ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, q, unidadeFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: rows.length,
    sem_omie: rows.filter((r) => !r.em_omie).length,
    sem_ana: rows.filter((r) => r.na_planilha_ana === false).length,
    atraso60: rows.filter((r) => (r.dias_ate_primeiro_pag ?? 0) > 60).length,
    churn: rows.filter((r) => r.status_reconciliacao === "churn").length,
  }), [rows]);

  const unidades = useMemo(() => [...new Set(rows.map((r) => r.unidade).filter(Boolean))].sort(), [rows]);

  function refreshSelected(r: ReconciliacaoRow) {
    const updated = rows.find((x) => x.contrato_id === r.contrato_id);
    if (updated) setSelected(updated);
  }

  if (qResult.isLoading) {
    return (
      <AppShell title="Reconciliação" subtitle="Pipedrive × Omie × Planilha Ana">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Reconciliação"
      subtitle={`${stats.total} deals · ${stats.sem_omie} sem Omie · ${nao_mapeados.length} Omie não mapeados`}
    >
      {/* KPIs */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="Deals Pipedrive" value={String(stats.total)} />
          <Kpi label="Sem Omie" value={String(stats.sem_omie)} pct={stats.total ? stats.sem_omie/stats.total : 0} tone="warn" onClick={() => setStatusFilter("sem_omie")} />
          <Kpi label="Atraso > 60d" value={String(stats.atraso60)} tone="warn" onClick={() => setStatusFilter("atraso60")} />
          <Kpi label="Churn" value={String(stats.churn)} tone="bad" onClick={() => setStatusFilter("churn")} />
          <Kpi label="Omie não mapeados" value={String(nao_mapeados.length)} tone="warn" onClick={() => {}} />
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto max-w-7xl px-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-9 w-56 rounded-md border bg-background px-3 text-sm"
            placeholder="Buscar nome / CNPJ / Deal ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={unidadeFilter}
            onChange={(e) => setUnidadeFilter(e.target.value)}
          >
            <option value="">Todas as unidades</option>
            {unidades.map((u) => <option key={u!} value={u!}>{u}</option>)}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="todos">Todos</option>
            <option value="sem_omie">Sem Omie</option>
            <option value="sem_ana">Sem Planilha Ana</option>
            <option value="atraso60">Atraso &gt; 60d</option>
            <option value="churn">Churn</option>
            <option value="pausa">Pausa</option>
          </select>
          <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>

          <button
            type="button"
            onClick={() => setShowColPicker((v) => !v)}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent"
          >
            {showColPicker ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Colunas
          </button>
        </div>

        {/* Column picker */}
        {showColPicker && (
          <div className="mt-2 flex flex-wrap gap-2 rounded-lg border bg-card p-3">
            {COLS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  visible[c.key]
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30",
                )}
              >
                {visible[c.key] ? <Eye className="mr-1 inline h-3 w-3" /> : <EyeOff className="mr-1 inline h-3 w-3" />}
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className="overflow-auto rounded-lg border bg-card shadow-sm" style={{ maxHeight: "65vh" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <tr>
                {visible.deal_id    && <Th>ID Deal</Th>}
                {visible.nome       && <Th>Nome</Th>}
                {visible.mrr        && <Th align="right">MRR</Th>}
                {visible.cnpj       && <Th>CNPJ</Th>}
                {visible.data_venda && <Th>Data Venda</Th>}
                {visible.razao_social && <Th>Razão Social</Th>}
                {visible.pipedrive  && <Th align="center">PD</Th>}
                {visible.omie       && <Th align="center">Omie</Th>}
                {visible.ana        && <Th align="center">Ana</Th>}
                {visible.fonte      && <Th>Fonte</Th>}
                {visible.status     && <Th>Status</Th>}
                {visible.primeiro_pag && <Th>1º Pag.</Th>}
                {visible.total_rec  && <Th align="right">Recebido</Th>}
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const late = (r.dias_ate_primeiro_pag ?? 0) > 60;
                return (
                  <tr
                    key={r.contrato_id}
                    onClick={() => setSelected(r)}
                    className={cn(
                      "cursor-pointer border-t transition-colors hover:bg-accent/40",
                      selected?.contrato_id === r.contrato_id && "bg-accent/60",
                      late && "bg-orange-50/60 dark:bg-orange-950/15",
                      r.status_reconciliacao === "churn" && "opacity-60",
                    )}
                  >
                    {visible.deal_id    && <Td mono>{r.deal_id ?? "—"}</Td>}
                    {visible.nome       && <Td><span className="font-medium">{r.nome}</span></Td>}
                    {visible.mrr        && <Td align="right">{r.mrr ? brl(r.mrr) : "—"}</Td>}
                    {visible.cnpj       && (
                      <Td mono>
                        {r.cnpj ? r.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "—"}
                        {r.cnpjs_associados.length > 0 && (
                          <span className="ml-1 rounded bg-primary/10 px-1 text-[10px] text-primary">
                            +{r.cnpjs_associados.length}
                          </span>
                        )}
                      </Td>
                    )}
                    {visible.data_venda && <Td>{dtLabel(r.data_venda)}</Td>}
                    {visible.razao_social && <Td>{r.razao_social ?? "—"}</Td>}
                    {visible.pipedrive  && <Td align="center"><Flag ok={r.em_pipedrive} /></Td>}
                    {visible.omie       && <Td align="center"><Flag ok={r.em_omie} /></Td>}
                    {visible.ana        && <Td align="center"><Flag ok={r.na_planilha_ana} /></Td>}
                    {visible.fonte      && <Td><span className="text-xs text-muted-foreground">{r.fonte}</span></Td>}
                    {visible.status     && <Td><StatusBadge status={r.status_reconciliacao} /></Td>}
                    {visible.primeiro_pag && (
                      <Td>
                        <span className={cn("text-xs", late && "font-semibold text-orange-600 dark:text-orange-400")}>
                          {r.primeiro_pagamento ? mesLabel(r.primeiro_pagamento.slice(0,7)) : <span className="text-muted-foreground/40">—</span>}
                          {late && ` (${r.dias_ate_primeiro_pag}d)`}
                        </span>
                      </Td>
                    )}
                    {visible.total_rec  && (
                      <Td align="right">
                        {r.total_recebido > 0 ? brl(r.total_recebido) : <span className="text-muted-foreground/30">—</span>}
                      </Td>
                    )}
                    <Td>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </Td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={20} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum resultado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Omie não mapeados */}
        {nao_mapeados.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Omie sem deal Pipedrive — {nao_mapeados.length} registros
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              CNPJs que aparecem em contas_receber mas não têm contrato no banco.
              Podem ser vendas sem CNPJ cadastrado, filiais não associadas, ou clientes que migraram.
            </p>
            <div className="overflow-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <Th>CNPJ</Th>
                    <Th>Razão Social / Unidade</Th>
                    <Th>Unidade</Th>
                    <Th>1º Pagamento</Th>
                    <Th align="right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {nao_mapeados.slice(0, 30).map((n) => (
                    <tr key={n.cnpj} className="border-t hover:bg-accent/30">
                      <Td mono>{n.cnpj}</Td>
                      <Td>{n.razao_social}</Td>
                      <Td>{n.unidade}</Td>
                      <Td>{n.primeiro_pagamento ? mesLabel(n.primeiro_pagamento.slice(0,7)) : "—"}</Td>
                      <Td align="right">{brl(n.total_recebido)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Drawer overlay */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelected(null)} />
          <RecordDrawer
            row={selected}
            naoMapeados={nao_mapeados}
            onClose={() => setSelected(null)}
            onUpdate={() => refreshSelected(selected)}
          />
        </>
      )}
    </AppShell>
  );
}

// ─── Small table primitives ───────────────────────────────────
function Th({ children, align }: { children?: React.ReactNode; align?: "center" | "right" }) {
  return (
    <th className={cn(
      "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap",
      align === "center" && "text-center",
      align === "right" && "text-right",
    )}>
      {children}
    </th>
  );
}

function Td({ children, align, mono }: { children?: React.ReactNode; align?: "center" | "right"; mono?: boolean }) {
  return (
    <td className={cn(
      "px-3 py-2 whitespace-nowrap",
      align === "center" && "text-center",
      align === "right" && "text-right",
      mono && "font-mono text-xs",
    )}>
      {children}
    </td>
  );
}

function Kpi({ label, value, pct, tone, onClick }: {
  label: string; value: string; pct?: number; tone?: "warn" | "bad"; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm",
        onClick && "cursor-pointer hover:bg-accent/30 transition-colors",
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 text-xl font-semibold",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "bad" && "text-red-600 dark:text-red-400",
      )}>
        {value}
        {pct !== undefined && pct > 0 && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{Math.round(pct * 100)}%</span>
        )}
      </div>
    </div>
  );
}
