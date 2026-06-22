import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AuditRegistro, AuditStats, ContratoLite, Empresa, Unidade } from "@/lib/audit-types";
import { usePermissions, unitMatches } from "@/hooks/use-permissions";

export type OrigemBase = "Base Nova" | "Base Antiga" | null;
export type OrigemFilter = "" | "Base Nova" | "Base Antiga" | "sem";

interface DataContextValue {
  stats: AuditStats;
  /** Registros filtrados pelo filtro global de base E pelo escopo de unidade (se sócio). */
  registros: AuditRegistro[];
  /** Lista bruta sem filtro de base nem escopo. */
  allRegistros: AuditRegistro[];
  unidades: Unidade[];
  empresas: Empresa[];
  contratos: ContratoLite[];
  cnpjToUnidade: Map<string, string | null>;
  unidadesByName: Map<string, Unidade>;
  cnpjToOrigem: Map<string, OrigemBase>;
  getOrigem: (r: { cnpj: string | null; razao_social?: string | null }) => OrigemBase;
  origemFilter: OrigemFilter;
  setOrigemFilter: (f: OrigemFilter) => void;
  refresh: () => Promise<void>;
  refreshing: boolean;
  /** Se true, os dados já vêm filtrados pela unidade do usuário (sócio). */
  scopedToUnit: boolean;
  /** Nome da unidade do usuário, se aplicável. */
  scopedUnit: string | null;
}

export function normalizeCnpj(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Normaliza razão social para fallback de match: lowercase, remove "(cópia)" e colapsa espaços. */
export function normalizeRazao(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .replace(/\(c[óo]pia\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

// Aliases para corrigir divergências de nome entre empresas.unidade e unidades.nome_da_praca
const UNIDADE_ALIASES: Record<string, string> = {
  "Rio de Janeiro": "Sudeste (RJ)",
  "RJ": "Sudeste (RJ)",
};

function canonicalUnitName(raw: string | null | undefined, known: Set<string>): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (known.has(trimmed)) return trimmed;
  const aliased = UNIDADE_ALIASES[trimmed];
  if (aliased && known.has(aliased)) return aliased;
  return null;
}

interface RawData {
  stats: AuditStats;
  registros: AuditRegistro[];
  unidades: Unidade[];
  empresas: Empresa[];
  contratos: ContratoLite[];
  unidadesByName: Map<string, Unidade>;
  cnpjToUnidade: Map<string, string | null>;
  cnpjToOrigem: Map<string, OrigemBase>;
  nameToOrigem: Map<string, OrigemBase>;
}

function computeStats(rows: AuditRegistro[], base: AuditStats): AuditStats {
  const dias = rows
    .map((r) => r.dias_ate_primeiro_pag)
    .filter((d): d is number => d != null);
  const media = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
  const sorted = [...dias].sort((a, b) => a - b);
  const mediana = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0;
  return {
    ...base,
    total_registros: rows.length,
    matched: rows.filter((r) => r.status_match === "matched").length,
    deal_sem_planning: rows.filter((r) => r.status_match === "deal_sem_planning").length,
    planning_sem_deal: rows.filter((r) => r.status_match === "planning_sem_deal").length,
    sem_origem: rows.filter((r) => r.status_match === "sem_origem").length,
    ever_paid: rows.filter((r) => r.pagou).length,
    inadimplentes: rows.filter((r) => r.status_pagamento === "inadimplente").length,
    media_dias: Number(media.toFixed(2)),
    mediana_dias: Number(mediana.toFixed(2)),
    n_amostra_dias: dias.length,
  };
}

interface ContaReceberLite {
  cpf_cnpj: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status_pagamento: string | null;
  valor: number | null;
}

function diffDays(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.max(0, Math.round((db - da) / 86_400_000));
}

function buildRegistros(
  empresas: Empresa[],
  contratos: ContratoLite[],
  contas: ContaReceberLite[],
): AuditRegistro[] {
  // Indexa contratos por CNPJ
  const contratosByCnpj = new Map<string, ContratoLite[]>();
  for (const c of contratos) {
    const k = normalizeCnpj(c.cnpj);
    if (!k) continue;
    const arr = contratosByCnpj.get(k) ?? [];
    arr.push(c);
    contratosByCnpj.set(k, arr);
  }

  // Indexa contas a receber por CNPJ
  const contasByCnpj = new Map<string, ContaReceberLite[]>();
  for (const f of contas) {
    const k = normalizeCnpj(f.cpf_cnpj);
    if (!k) continue;
    const arr = contasByCnpj.get(k) ?? [];
    arr.push(f);
    contasByCnpj.set(k, arr);
  }

  const registros: AuditRegistro[] = [];
  for (const e of empresas) {
    const hasPd = !!(e.pipedrive_id && String(e.pipedrive_id).trim());
    const hasOmie = !!(e.omie_codigo_cliente && String(e.omie_codigo_cliente).trim());
    let status_match: AuditRegistro["status_match"];
    if (hasPd && hasOmie) status_match = "matched";
    else if (hasPd && !hasOmie) status_match = "planning_sem_deal";
    else if (!hasPd && hasOmie) status_match = "deal_sem_planning";
    else status_match = "sem_origem";

    const key = normalizeCnpj(e.cnpj);
    const cs = key ? contratosByCnpj.get(key) ?? [] : [];
    const fs = key ? contasByCnpj.get(key) ?? [] : [];

    // Agrega contratos
    let mrr = 0;
    let valor_contrato = 0;
    let tipo_contrato: string | null = null;
    let produto: string | null = null;
    let data_ganho: string | null = null;
    let deal_titulo: string | null = e.titulo ?? null;
    for (const c of cs) {
      mrr += Number(c.mrr ?? 0) || 0;
      valor_contrato += Number(c.valor_total ?? 0) || 0;
      if (!tipo_contrato && c.tipo) tipo_contrato = c.tipo;
      if (!produto && c.produto) produto = c.produto;
      if (!deal_titulo && c.titulo) deal_titulo = c.titulo;
      if (c.ganho_em && (!data_ganho || c.ganho_em < data_ganho)) data_ganho = c.ganho_em;
    }

    // Agrega contas a receber
    let total_pago = 0;
    let data_primeiro_pag: string | null = null;
    let hasAtrasado = false;
    let hasRecebido = false;
    const pagosPorMes = new Map<string, number>();
    for (const f of fs) {
      const status = (f.status_pagamento ?? "").toUpperCase();
      if (status === "ATRASADO") hasAtrasado = true;
      if (status === "RECEBIDO" && f.data_pagamento) {
        hasRecebido = true;
        const v = Number(f.valor ?? 0) || 0;
        total_pago += v;
        if (!data_primeiro_pag || f.data_pagamento < data_primeiro_pag) {
          data_primeiro_pag = f.data_pagamento;
        }
        const month = f.data_pagamento.slice(0, 7);
        pagosPorMes.set(month, (pagosPorMes.get(month) ?? 0) + v);
      }
    }
    const pagamentos_mensais = Array.from(pagosPorMes.entries())
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month));

    let status_pagamento: AuditRegistro["status_pagamento"];
    if (fs.length === 0) status_pagamento = "sem_dados";
    else if (hasAtrasado) status_pagamento = "inadimplente";
    else if (hasRecebido) status_pagamento = "adimplente";
    else status_pagamento = "recente";

    // dias_ate_primeiro_pag: do ganho_em ao 1º pagamento RECEBIDO
    let dias_ate_primeiro_pag: number | null = null;
    if (data_ganho && data_primeiro_pag && data_primeiro_pag >= data_ganho) {
      dias_ate_primeiro_pag = diffDays(data_ganho, data_primeiro_pag);
    }

    const razao = e.razao_social ?? null;
    const is_copia = !!razao && /\(c[óo]pia\)/i.test(razao);
    const pdNum = hasPd ? Number(e.pipedrive_id) : NaN;

    registros.push({
      deal_id: !isNaN(pdNum) ? pdNum : null,
      deal_titulo,
      razao_social: razao,
      cnpj: e.cnpj,
      cidade: e.unidade ?? e.uf ?? null,
      unidade: e.unidade ?? null,
      data_fechamento: data_ganho,
      mrr: mrr || null,
      valor_contrato: valor_contrato || null,
      tipo_contrato,
      produto,
      segmento: e.segmento ?? null,
      is_copia,
      status_match,
      status_pagamento,
      pagou: hasRecebido,
      data_primeiro_pag,
      dias_ate_primeiro_pag,
      meses_pagos: pagamentos_mensais.length,
      total_pago: total_pago || null,
      pagamentos_mensais: pagamentos_mensais.length ? pagamentos_mensais : null,
      inicio_contrato: data_ganho,
    });
  }
  return registros;
}

async function fetchAll(): Promise<RawData> {
  const [unidadesRes, empresasRes, contratosRes, contasRes] = await Promise.all([
    supabase.from("unidades").select("*").limit(500),
    supabase
      .from("empresas")
      .select(
        "id, cnpj, razao_social, unidade, origem_da_base, titulo, pipefy_record_id, pipedrive_id, omie_codigo_cliente, uf, segmento",
      )
      .eq("tipo_unidade", "franquia")
      .limit(5000),
    supabase
      .from("contratos")
      .select(
        "id, cnpj, mrr_mensal, valor_total, status_contrato, pipedrive_deal_id, ganho_em, titulo, tipo, produto",
      )
      .eq("tipo_unidade", "franquia")
      .limit(10000),
    supabase
      .from("contas_receber")
      .select("cpf_cnpj, data_vencimento, data_pagamento, status_pagamento, valor")
      .limit(50000),
  ]);
  if (unidadesRes.error) throw unidadesRes.error;
  if (empresasRes.error) throw empresasRes.error;
  if (contratosRes.error) throw contratosRes.error;
  if (contasRes.error) throw contasRes.error;

  const unidades = (unidadesRes.data ?? []) as unknown as Unidade[];
  const empresas = (empresasRes.data ?? []) as unknown as Empresa[];
  // Mapeia mrr_mensal (coluna gerada = mrr/12) para o campo `mrr` que o módulo
  // de auditoria trata semanticamente como MRR mensal.
  const contratos = ((contratosRes.data ?? []) as Array<
    Omit<ContratoLite, "mrr"> & { mrr_mensal: number | null }
  >).map((r) => ({
    ...r,
    mrr: r.mrr_mensal,
  })) as ContratoLite[];
  const contas = (contasRes.data ?? []) as unknown as ContaReceberLite[];

  const unidadesByName = new Map(unidades.map((u) => [u.nome_da_praca, u]));
  const known = new Set(unidades.map((u) => u.nome_da_praca));
  const cnpjToUnidade = new Map<string, string | null>();
  const cnpjToOrigem = new Map<string, OrigemBase>();
  const nameToOrigem = new Map<string, OrigemBase>();
  const nameConflict = new Set<string>();
  for (const e of empresas) {
    const o = e.origem_da_base?.trim();
    const origem: OrigemBase =
      o === "Base Nova" ? "Base Nova" : o === "Base Antiga" ? "Base Antiga" : null;
    if (e.cnpj) {
      cnpjToUnidade.set(e.cnpj, canonicalUnitName(e.unidade, known));
      const key = normalizeCnpj(e.cnpj);
      if (key) cnpjToOrigem.set(key, origem);
    }
    const nk = normalizeRazao(e.razao_social);
    if (nk && !nameConflict.has(nk)) {
      const prev = nameToOrigem.get(nk);
      if (prev === undefined) {
        nameToOrigem.set(nk, origem);
      } else if (prev !== origem) {
        nameToOrigem.delete(nk);
        nameConflict.add(nk);
      }
    }
  }

  const registros = buildRegistros(empresas, contratos, contas);
  const baseStats: AuditStats = {
    total_registros: 0,
    matched: 0,
    deal_sem_planning: 0,
    planning_sem_deal: 0,
    sem_origem: 0,
    ever_paid: 0,
    inadimplentes: 0,
    media_dias: 0,
    mediana_dias: 0,
    n_amostra_dias: 0,
    gerado_em: new Date().toISOString(),
  };
  const stats = computeStats(registros, baseStats);

  return {
    stats,
    registros,
    unidades,
    empresas,
    contratos,
    unidadesByName,
    cnpjToUnidade,
    cnpjToOrigem,
    nameToOrigem,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<RawData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [origemFilter, setOrigemFilter] = useState<OrigemFilter>("");
  const { scopedToOwnUnit, unidade: userUnidade } = usePermissions();

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchAll();
      setRaw(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAll();
        if (!cancelled) setRaw(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<DataContextValue | null>(() => {
    if (!raw) return null;
    const { cnpjToOrigem, nameToOrigem, registros: rawRegistros, stats: baseStats, cnpjToUnidade } = raw;
    const getOrigem = (r: { cnpj: string | null; razao_social?: string | null; deal_id?: number | null }): OrigemBase => {
      if (r.deal_id != null) return "Base Nova";
      const key = normalizeCnpj(r.cnpj);
      if (key) {
        const o = cnpjToOrigem.get(key);
        if (o) return o;
      }
      const nk = normalizeRazao(r.razao_social);
      if (nk) {
        const o = nameToOrigem.get(nk);
        if (o !== undefined) return o;
      }
      return null;
    };

    // Escopo de unidade (sócio): filtra registros pela unidade do usuário
    const scopedToUnit = !!(scopedToOwnUnit && userUnidade);
    const allRegistros: AuditRegistro[] = scopedToUnit
      ? rawRegistros.filter((r) => {
          const u = cnpjToUnidade.get(r.cnpj ?? "");
          if (u && unitMatches(userUnidade, u)) return true;
          // fallback por cidade (algumas unidades casam com a cidade)
          if (r.cidade && unitMatches(userUnidade, r.cidade)) return true;
          return false;
        })
      : rawRegistros;

    const filtered = !origemFilter
      ? allRegistros
      : allRegistros.filter((r) => {
          const o = getOrigem(r);
          if (origemFilter === "sem") return o === null;
          return o === origemFilter;
        });
    const stats =
      !origemFilter && !scopedToUnit ? baseStats : computeStats(filtered, baseStats);
    return {
      stats,
      registros: filtered,
      allRegistros,
      unidades: raw.unidades,
      empresas: raw.empresas,
      contratos: raw.contratos,
      unidadesByName: raw.unidadesByName,
      cnpjToUnidade: raw.cnpjToUnidade,
      cnpjToOrigem: raw.cnpjToOrigem,
      getOrigem,
      origemFilter,
      setOrigemFilter,
      refresh,
      refreshing,
      scopedToUnit,
      scopedUnit: scopedToUnit ? userUnidade : null,
    };
  }, [raw, origemFilter, refresh, refreshing, scopedToOwnUnit, userUnidade]);

  if (error && !raw) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h2 className="text-xl font-semibold text-destructive">Erro ao carregar dados</h2>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando dados do Supabase…</p>
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function BaseFilterSelect({ className }: { className?: string }) {
  const { origemFilter, setOrigemFilter, allRegistros, getOrigem } = useData();
  const counts = useMemo(() => {
    let nova = 0;
    let antiga = 0;
    let sem = 0;
    for (const r of allRegistros) {
      const o = getOrigem(r);
      if (o === "Base Nova") nova++;
      else if (o === "Base Antiga") antiga++;
      else sem++;
    }
    return { nova, antiga, sem, total: allRegistros.length };
  }, [allRegistros, getOrigem]);

  return (
    <select
      className={
        className ??
        "h-9 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground"
      }
      value={origemFilter}
      onChange={(e) => setOrigemFilter(e.target.value as OrigemFilter)}
      title="Filtro global de Base — afeta todas as abas"
    >
      <option value="">Todas as bases ({counts.total})</option>
      <option value="Base Nova">Base Nova ({counts.nova})</option>
      <option value="Base Antiga">Base Antiga ({counts.antiga})</option>
      <option value="sem">Sem cadastro ({counts.sem})</option>
    </select>
  );
}

export function RefreshButton({ className }: { className?: string }) {
  const { refresh, refreshing } = useData();
  return (
    <button
      type="button"
      onClick={() => void refresh()}
      disabled={refreshing}
      title="Atualizar dados do Supabase"
      className={
        className ??
        "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
      }
    >
      <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
      {refreshing ? "Atualizando…" : "Atualizar"}
    </button>
  );
}
