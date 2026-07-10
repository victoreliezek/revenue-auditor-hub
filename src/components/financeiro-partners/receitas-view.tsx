import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check,
  XCircle,
  Settings2,
  Plus,
  Pencil,
  Trash2,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CadastrosReceitasDialog } from "@/components/receitas/cadastros-dialog";
import { useCategoriasReceita } from "@/hooks/use-cadastros-receitas";
import { useDepartamentosDespesa } from "@/hooks/use-cadastros-despesas";
import { useRoyaltiesPorUnidade, useGarantirApuracoesAno } from "@/hooks/use-royalties";

const BRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

function toMesISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

type ApuracaoStatus = "pendente" | "aprovado" | "contestado";

interface FornecedorRow {
  id: number;
  nome: string;
  categoria: string | null;
  departamento: string | null;
  tipo: string;
  valor_base: number | null;
  ativo: boolean;
  mes_inicio: number | null;
  parcelas: number | null;
  meses_pontuais: number[] | null;
  unidade: string | null;
}

interface OverrideRow {
  id: number;
  fornecedor_id: number;
  mes: string;
  valor: number | null;
  inativo_no_mes: boolean;
  status: string | null;
  codigo_omie: number | null;
  valor_pago: number | null;
  data_pagamento: string | null;
  observacao: string | null;
  apuracao_status: ApuracaoStatus;
  motivo_contestacao: string | null;
}

interface ContaReceberRow {
  codigo_omie: number;
  num_documento: string | null;
  cliente: string | null;
  valor: number | null;
  data_competencia: string | null;
  data_pagamento: string | null;
  status_pagamento: string | null;
}

interface GridRow {
  fornecedor: FornecedorRow;
  override: OverrideRow | null;
  planejado: number;
  omie: ContaReceberRow | null;
  realizado: number;
  diff: number;
  apuracao: ApuracaoStatus;
  // null = não é linha de Royalties (planejado editável normalmente); true/false
  // = vem da apuração de royalties, mês fechado (Realizado) ou não (Projetado).
  royaltiesRealizado: boolean | null;
}

function itemAtivoNoMes(f: FornecedorRow, mesISO: string): boolean {
  if (!f.ativo) return false;
  const m = Number(mesISO.slice(5, 7));
  if (f.tipo === "pontual") {
    return (f.meses_pontuais ?? []).includes(m);
  }
  if (f.tipo === "parcelado" && f.mes_inicio && f.parcelas) {
    const inicio = f.mes_inicio;
    for (let i = 0; i < f.parcelas; i++) {
      const mm = ((inicio - 1 + i) % 12) + 1;
      if (mm === m) return true;
    }
    return false;
  }
  // fixo / variavel: ativo todo mês
  return true;
}

export function ReceitasView() {
  const today = new Date();
  const [mes, setMes] = useState<string>(toMesISO(today));
  const [fornecedores, setFornecedores] = useState<FornecedorRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [contas, setContas] = useState<ContaReceberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editing, setEditing] = useState<FornecedorRow | null>(null);
  const [vincular, setVincular] = useState<GridRow | null>(null);

  const cats = useCategoriasReceita();
  const deps = useDepartamentosDespesa();

  const ano = Number(mes.slice(0, 4));
  const royaltiesQuery = useRoyaltiesPorUnidade(ano);
  const garantirApuracoes = useGarantirApuracoesAno();

  async function load() {
    setLoading(true);
    const [y, m] = mes.slice(0, 7).split("-").map(Number);
    const startISO = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(y, m, 0);
    const endISO = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    const [fRes, oRes, crRes] = await Promise.all([
      supabase
        .from("receitas_cm_fornecedores")
        .select(
          "id,nome,categoria,departamento,tipo,valor_base,ativo,mes_inicio,parcelas,meses_pontuais,unidade",
        )
        .order("nome"),
      supabase
        .from("receitas_cm_overrides")
        .select("*")
        .eq("mes", mes),
      supabase
        .from("contas_receber")
        .select(
          "codigo_omie,num_documento,cliente,valor,data_competencia,data_pagamento,status_pagamento",
        )
        .gte("data_competencia", startISO)
        .lte("data_competencia", endISO)
        .limit(20000),
    ]);

    if (fRes.error) toast.error("Erro itens: " + fRes.error.message);
    if (oRes.error) toast.error("Erro overrides: " + oRes.error.message);
    if (crRes.error) toast.error("Erro Omie: " + crRes.error.message);

    setFornecedores((fRes.data ?? []) as FornecedorRow[]);
    setOverrides((oRes.data ?? []) as unknown as OverrideRow[]);
    setContas((crRes.data ?? []) as ContaReceberRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const overrideMap = useMemo(() => {
    const m = new Map<number, OverrideRow>();
    for (const o of overrides) m.set(o.fornecedor_id, o);
    return m;
  }, [overrides]);

  const contasMap = useMemo(() => {
    const m = new Map<number, ContaReceberRow>();
    for (const c of contas) if (c.codigo_omie) m.set(c.codigo_omie, c);
    return m;
  }, [contas]);

  const gridRows: GridRow[] = useMemo(() => {
    const rows: GridRow[] = [];
    const mesNum = mes.slice(5, 7);
    for (const f of fornecedores) {
      if (!itemAtivoNoMes(f, mes)) {
        // ainda permite linha se houver override naquele mês
        if (!overrideMap.has(f.id)) continue;
      }
      const ov = overrideMap.get(f.id) ?? null;
      if (ov?.inativo_no_mes) continue;

      const royaltiesInfo =
        f.categoria === "Royalties" && f.unidade
          ? royaltiesQuery.data?.get(`${f.unidade}|${mesNum}`)
          : undefined;
      const planejado =
        royaltiesInfo != null
          ? royaltiesInfo.valor
          : Number(ov?.valor != null ? ov.valor : (f.valor_base ?? 0));

      const omie = ov?.codigo_omie ? (contasMap.get(ov.codigo_omie) ?? null) : null;
      const realizado = Number(omie?.valor ?? 0);
      const apuracao = (ov?.apuracao_status ?? "pendente") as ApuracaoStatus;
      rows.push({
        fornecedor: f,
        override: ov,
        planejado,
        omie,
        realizado,
        diff: realizado - planejado,
        apuracao,
        royaltiesRealizado: royaltiesInfo != null ? royaltiesInfo.realizado : null,
      });
    }
    return rows.sort((a, b) =>
      a.fornecedor.nome.localeCompare(b.fornecedor.nome),
    );
  }, [fornecedores, overrideMap, contasMap, mes, royaltiesQuery.data]);

  const kpis = useMemo(() => {
    const planejado = gridRows.reduce((s, r) => s + r.planejado, 0);
    let recebido = 0;
    let aVencer = 0;
    let atrasado = 0;
    let faturado = 0;
    for (const c of contas) {
      const v = Number(c.valor ?? 0);
      const st = (c.status_pagamento ?? "").toUpperCase();
      if (st !== "CANCELADO") faturado += v;
      if (st === "RECEBIDO") recebido += v;
      if (st === "A VENCER" || st === "VENCE HOJE") aVencer += v;
      if (st === "ATRASADO") atrasado += v;
    }
    return {
      planejado,
      recebido,
      aVencer,
      atrasado,
      faturado,
      diff: faturado - planejado,
    };
  }, [gridRows, contas]);

  const vinculadasIds = useMemo(
    () =>
      new Set(
        overrides
          .map((o) => o.codigo_omie)
          .filter((x): x is number => x != null),
      ),
    [overrides],
  );
  const semVinculo = useMemo(
    () =>
      contas.filter(
        (c) =>
          c.codigo_omie != null &&
          !vinculadasIds.has(c.codigo_omie) &&
          (c.status_pagamento ?? "").toUpperCase() !== "CANCELADO",
      ),
    [contas, vinculadasIds],
  );

  async function ensureOverride(fornecedor_id: number): Promise<OverrideRow> {
    const existing = overrideMap.get(fornecedor_id);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("receitas_cm_overrides")
      .insert({
        fornecedor_id,
        mes,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as OverrideRow;
  }

  async function setPlanejado(row: GridRow, valor: number) {
    try {
      const ov = await ensureOverride(row.fornecedor.id);
      const { error } = await supabase
        .from("receitas_cm_overrides")
        .update({ valor })
        .eq("id", ov.id);
      if (error) throw error;
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function setApuracao(
    row: GridRow,
    novo: ApuracaoStatus,
    motivo: string | null = null,
  ) {
    try {
      const ov = await ensureOverride(row.fornecedor.id);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("receitas_cm_overrides")
        .update({
          apuracao_status: novo,
          motivo_contestacao: novo === "contestado" ? motivo : null,
          revisado_em: new Date().toISOString(),
          revisado_por: u.user?.id ?? null,
        })
        .eq("id", ov.id);
      if (error) throw error;
      toast.success(
        novo === "aprovado"
          ? "Aprovado."
          : novo === "contestado"
            ? "Contestado."
            : "Marcado como pendente.",
      );
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function vincularOmie(row: GridRow, c: ContaReceberRow) {
    try {
      const ov = await ensureOverride(row.fornecedor.id);
      const { error } = await supabase
        .from("receitas_cm_overrides")
        .update({
          codigo_omie: c.codigo_omie,
          valor_pago: c.valor,
          data_pagamento: c.data_pagamento,
          origem_apuracao: "omie",
        })
        .eq("id", ov.id);
      if (error) throw error;
      toast.success("Vinculado.");
      setVincular(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function desvincularOmie(row: GridRow) {
    if (!row.override) return;
    const { error } = await supabase
      .from("receitas_cm_overrides")
      .update({
        codigo_omie: null,
        valor_pago: null,
        data_pagamento: null,
      })
      .eq("id", row.override.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  }

  async function excluirItem(f: FornecedorRow) {
    if (!confirm(`Excluir item "${f.nome}" e todos os overrides?`)) return;
    const { error: e1 } = await supabase
      .from("receitas_cm_overrides")
      .delete()
      .eq("fornecedor_id", f.id);
    if (e1) {
      toast.error(e1.message);
      return;
    }
    const { error: e2 } = await supabase
      .from("receitas_cm_fornecedores")
      .delete()
      .eq("id", f.id);
    if (e2) {
      toast.error(e2.message);
      return;
    }
    toast.success("Excluído.");
    await load();
  }

  const [y, m] = mes.slice(0, 7).split("-").map(Number);
  const meses = [
    "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez",
  ];
  const yearNow = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => yearNow - 3 + i);

  return (
    <AppShell
      title="Receitas Partners"
      subtitle="Planejado (manual, exceto Royalties — vem da apuração) vs Realizado (Omie · contas_receber)"
      headerExtra={
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
          <Button
            variant="outline"
            size="sm"
            disabled={garantirApuracoes.isPending}
            onClick={() =>
              garantirApuracoes.mutate(
                { ano },
                {
                  onSuccess: (res) =>
                    toast.success(
                      res.criadas > 0
                        ? `${res.criadas} apuração(ões) futura(s) criada(s).`
                        : "Apurações futuras já estavam em dia.",
                    ),
                },
              )
            }
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-1", garantirApuracoes.isPending && "animate-spin")}
            />
            Gerar apurações futuras
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCadastrosOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-1" /> Cadastros
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setItemOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo item
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6 p-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Planejado" value={BRL(kpis.planejado)} tone="neutral" />
          <Kpi label="Faturado" value={BRL(kpis.faturado)} tone="neutral" />
          <Kpi label="Recebido" value={BRL(kpis.recebido)} tone="green" />
          <Kpi label="A vencer" value={BRL(kpis.aVencer)} tone="amber" />
          <Kpi label="Em atraso" value={BRL(kpis.atrasado)} tone="red" />
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>Diferença (Faturado − Planejado)</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              kpis.diff < 0 ? "text-red-600" : "text-emerald-700",
            )}
          >
            {BRL(kpis.diff)}
          </span>
        </div>

        {/* Grid */}
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Planejado x Realizado — {mes.slice(0, 7)}
              </h2>
              <p className="text-xs text-muted-foreground">
                Edite o valor planejado e vincule cada item ao lançamento no
                Omie.
              </p>
            </div>
          </div>
          <div className="p-4 overflow-auto">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : gridRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum item de receita ativo neste mês.{" "}
                <button
                  className="underline"
                  onClick={() => {
                    setEditing(null);
                    setItemOpen(true);
                  }}
                >
                  Cadastrar item
                </button>
                .
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 pr-2">Item</th>
                    <th className="text-left py-2 pr-2">Categoria</th>
                    <th className="text-left py-2 pr-2">Depto</th>
                    <th className="text-right py-2 pr-2">Planejado</th>
                    <th className="text-right py-2 pr-2">Realizado (Omie)</th>
                    <th className="text-right py-2 pr-2">Diferença</th>
                    <th className="text-left py-2 pr-2">Status Omie</th>
                    <th className="text-center py-2 pr-2">Apuração</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((r) => (
                    <RowEditor
                      key={r.fornecedor.id}
                      row={r}
                      onPlanejado={(v) => setPlanejado(r, v)}
                      onApuracao={(s, motivo) => setApuracao(r, s, motivo)}
                      onVincular={() => setVincular(r)}
                      onDesvincular={() => desvincularOmie(r)}
                      onEditItem={() => {
                        setEditing(r.fornecedor);
                        setItemOpen(true);
                      }}
                      onExcluir={() => excluirItem(r.fornecedor)}
                    />
                  ))}
                </tbody>
                <tfoot className="border-t font-semibold">
                  <tr>
                    <td colSpan={3} className="py-2 text-right pr-2">
                      Totais
                    </td>
                    <td className="text-right tabular-nums py-2 pr-2">
                      {BRL(gridRows.reduce((s, r) => s + r.planejado, 0))}
                    </td>
                    <td className="text-right tabular-nums py-2 pr-2">
                      {BRL(gridRows.reduce((s, r) => s + r.realizado, 0))}
                    </td>
                    <td className="text-right tabular-nums py-2 pr-2">
                      {BRL(gridRows.reduce((s, r) => s + r.diff, 0))}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* Recebimentos sem vínculo */}
        <section className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">
              Recebimentos no Omie sem vínculo ({semVinculo.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Lançamentos do mês que ainda não foram associados a nenhum item
              planejado.
            </p>
          </div>
          <div className="p-4 overflow-auto">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : semVinculo.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Nada pendente.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 pr-2">Cliente</th>
                    <th className="text-left py-2 pr-2">Documento</th>
                    <th className="text-left py-2 pr-2">Competência</th>
                    <th className="text-right py-2 pr-2">Valor</th>
                    <th className="text-left py-2 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {semVinculo.slice(0, 50).map((c) => (
                    <tr key={c.codigo_omie} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">{c.cliente ?? "—"}</td>
                      <td className="py-1.5 pr-2">{c.num_documento ?? "—"}</td>
                      <td className="py-1.5 pr-2">{c.data_competencia ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {BRL(Number(c.valor ?? 0))}
                      </td>
                      <td className="py-1.5 pr-2 text-xs">
                        {c.status_pagamento ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {semVinculo.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">
                Mostrando 50 de {semVinculo.length}.
              </p>
            )}
          </div>
        </section>
      </div>

      <CadastrosReceitasDialog
        open={cadastrosOpen}
        onOpenChange={setCadastrosOpen}
      />

      <ItemFormDialog
        open={itemOpen}
        onOpenChange={setItemOpen}
        editing={editing}
        categorias={cats.items}
        departamentos={deps.items}
        onSaved={async () => {
          setItemOpen(false);
          setEditing(null);
          await load();
        }}
      />

      {vincular && (
        <VincularOmieDialog
          row={vincular}
          contas={contas.filter(
            (c) =>
              c.codigo_omie != null &&
              (!vinculadasIds.has(c.codigo_omie) ||
                c.codigo_omie === vincular.override?.codigo_omie),
          )}
          onClose={() => setVincular(null)}
          onPick={(c) => vincularOmie(vincular, c)}
        />
      )}
    </AppShell>
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
    green:
      "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-100",
    amber:
      "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-100",
    red: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-900 dark:text-red-100",
  } as const;
  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function RowEditor({
  row,
  onPlanejado,
  onApuracao,
  onVincular,
  onDesvincular,
  onEditItem,
  onExcluir,
}: {
  row: GridRow;
  onPlanejado: (v: number) => void;
  onApuracao: (s: ApuracaoStatus, motivo: string | null) => void;
  onVincular: () => void;
  onDesvincular: () => void;
  onEditItem: () => void;
  onExcluir: () => void;
}) {
  const [val, setVal] = useState<string>(String(row.planejado.toFixed(2)));
  const [motivo, setMotivo] = useState(row.override?.motivo_contestacao ?? "");

  useEffect(() => {
    setVal(String(row.planejado.toFixed(2)));
  }, [row.planejado]);

  const apuracaoIcon = {
    pendente: <Clock className="h-3.5 w-3.5 text-amber-600" />,
    aprovado: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
    contestado: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />,
  };

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="py-1.5 pr-2 font-medium">{row.fornecedor.nome}</td>
      <td className="py-1.5 pr-2 text-xs text-muted-foreground">
        {row.fornecedor.categoria ?? "—"}
      </td>
      <td className="py-1.5 pr-2 text-xs text-muted-foreground">
        {row.fornecedor.departamento ?? "—"}
      </td>
      <td className="py-1.5 pr-2">
        {row.royaltiesRealizado != null ? (
          <div className="flex items-center justify-end gap-1.5">
            <span className="tabular-nums">{BRL(row.planejado)}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                row.royaltiesRealizado
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
              )}
              title="Vem da apuração de royalties — não editável aqui."
            >
              {row.royaltiesRealizado ? "Realizado" : "Projetado"}
            </span>
          </div>
        ) : (
          <Input
            type="number"
            step="0.01"
            className="h-7 w-28 text-right tabular-nums"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => {
              const n = Number(val);
              if (!Number.isNaN(n) && n !== row.planejado) onPlanejado(n);
            }}
          />
        )}
      </td>
      <td className="py-1.5 pr-2 text-right tabular-nums">
        {row.omie ? BRL(row.realizado) : <span className="text-muted-foreground">—</span>}
      </td>
      <td
        className={cn(
          "py-1.5 pr-2 text-right tabular-nums",
          row.diff < 0 && "text-red-600",
          row.diff > 0 && "text-emerald-700",
        )}
      >
        {row.omie ? BRL(row.diff) : "—"}
      </td>
      <td className="py-1.5 pr-2 text-xs">
        {row.omie ? (
          <span className="inline-flex items-center gap-1">
            {row.omie.status_pagamento ?? "—"}
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={onDesvincular}
              title="Desvincular"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={onVincular}
          >
            <LinkIcon className="h-3.5 w-3.5 mr-1" />
            Vincular
          </Button>
        )}
      </td>
      <td className="py-1.5 pr-2 text-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1">
              {apuracaoIcon[row.apuracao]}
              <span className="text-xs capitalize">{row.apuracao}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-2">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={row.apuracao === "aprovado" ? "default" : "outline"}
                className="h-7 flex-1"
                onClick={() => onApuracao("aprovado", null)}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant={row.apuracao === "pendente" ? "default" : "outline"}
                className="h-7 flex-1"
                onClick={() => onApuracao("pendente", null)}
              >
                <Clock className="h-3.5 w-3.5 mr-1" /> Pendente
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Motivo da contestação</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Explique o motivo"
              />
              <Button
                size="sm"
                variant="destructive"
                className="h-7 w-full"
                onClick={() => onApuracao("contestado", motivo.trim() || null)}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Contestar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </td>
      <td className="py-1.5 pr-2">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEditItem}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600"
            onClick={onExcluir}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ItemFormDialog({
  open,
  onOpenChange,
  editing,
  categorias,
  departamentos,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: FornecedorRow | null;
  categorias: { id: string; nome: string }[];
  departamentos: { id: string; nome: string }[];
  onSaved: () => void | Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [departamento, setDepartamento] = useState<string>("");
  const [tipo, setTipo] = useState<string>("fixo");
  const [valorBase, setValorBase] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      setNome(editing.nome);
      setCategoria(editing.categoria ?? "");
      setDepartamento(editing.departamento ?? "");
      setTipo(editing.tipo);
      setValorBase(String(editing.valor_base ?? ""));
    } else {
      setNome("");
      setCategoria("");
      setDepartamento("");
      setTipo("fixo");
      setValorBase("");
    }
  }, [editing, open]);

  async function save() {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setBusy(true);
    try {
      const payload: {
        nome: string;
        categoria: string | null;
        departamento: string | null;
        tipo: string;
        valor_base?: number;
        ativo: boolean;
      } = {
        nome: nome.trim(),
        categoria: categoria || null,
        departamento: departamento || null,
        tipo,
        ativo: true,
      };
      if (valorBase) payload.valor_base = Number(valorBase);
      if (editing) {
        const { error } = await supabase
          .from("receitas_cm_fornecedores")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Atualizado.");
      } else {
        const { error } = await supabase
          .from("receitas_cm_fornecedores")
          .insert(payload);
        if (error) throw error;
        toast.success("Item criado.");
      }
      await onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar item de receita" : "Novo item de receita"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={departamento} onValueChange={setDepartamento}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.nome}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Fixo (todo mês)</SelectItem>
                  <SelectItem value="variavel">Variável (todo mês)</SelectItem>
                  <SelectItem value="pontual">Pontual</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor base</Label>
              <Input
                type="number"
                step="0.01"
                value={valorBase}
                onChange={(e) => setValorBase(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VincularOmieDialog({
  row,
  contas,
  onClose,
  onPick,
}: {
  row: GridRow;
  contas: ContaReceberRow[];
  onClose: () => void;
  onPick: (c: ContaReceberRow) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const f = filter.toLowerCase();
    return contas.filter(
      (c) =>
        !f ||
        (c.cliente ?? "").toLowerCase().includes(f) ||
        (c.num_documento ?? "").toLowerCase().includes(f) ||
        String(c.codigo_omie).includes(f),
    );
  }, [contas, filter]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Vincular "{row.fornecedor.nome}" a um lançamento do Omie
          </DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar por cliente, documento ou código"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="max-h-80 overflow-auto border rounded">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum lançamento disponível.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b sticky top-0 bg-card">
                <tr>
                  <th className="text-left py-2 px-2">Cliente</th>
                  <th className="text-left py-2 px-2">Doc</th>
                  <th className="text-right py-2 px-2">Valor</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.codigo_omie} className="border-b last:border-0">
                    <td className="py-1.5 px-2">{c.cliente ?? "—"}</td>
                    <td className="py-1.5 px-2 text-xs">
                      {c.num_documento ?? "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {BRL(Number(c.valor ?? 0))}
                    </td>
                    <td className="py-1.5 px-2 text-xs">
                      {c.status_pagamento ?? "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <Button size="sm" className="h-7" onClick={() => onPick(c)}>
                        Vincular
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
