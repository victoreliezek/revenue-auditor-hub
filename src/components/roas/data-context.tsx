import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePermissions, unitMatches } from "@/hooks/use-permissions";
import type { ContratoLite, UnidadeCfg } from "./calculations";

export type MetricaMensal = Database["public"]["Tables"]["roas_mensal"]["Row"];
export type RoasUnidade = Database["public"]["Tables"]["roas_por_unidade"]["Row"];
export type UnidadeConfig = {
  nome: string;
  tipo: string | null;
  midia_mensal: number | null;
  royalties_pct: number | null;
  paga_cac: boolean | null;
  absorve_midia: boolean | null;
};

interface RoasDataValue {
  metricasMensais: MetricaMensal[];
  porUnidade: RoasUnidade[];
  unidadesConfig: UnidadeConfig[];
  unidadesByNome: Map<string, UnidadeConfig>;
  unidadesDisponiveis: string[];
  unidadeFilter: string | "all";
  setUnidadeFilter: (u: string | "all") => void;
  meses: string[];
  lastNMonths: (n: number) => string[];
  calcPayback: (cac: number | null, mrr: number | null, royaltiesPct: number | null) => number | null;
  contratos: ContratoLite[];
  configs: UnidadeCfg[];
  mesesDisponiveis: string[]; // YYYY-MM derivados dos contratos
}

const Ctx = createContext<RoasDataValue | null>(null);

export function useRoasData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoasData must be used within RoasDataProvider");
  return v;
}

export function calcPayback(
  cac: number | null,
  mrr: number | null,
  royaltiesPct: number | null,
): number | null {
  const c = Number(cac ?? 0);
  const m = Number(mrr ?? 0);
  if (!m) return null;
  if (m >= c) return 0;
  const r = Number(royaltiesPct ?? 0);
  if (!r) return null;
  const royFrac = r > 1 ? r / 100 : r;
  const denom = royFrac * m;
  if (!denom) return null;
  return (c - m) / denom;
}

export function RoasDataProvider({ children }: { children: ReactNode }) {
  const [metricasMensais, setM] = useState<MetricaMensal[] | null>(null);
  const [porUnidadeRaw, setU] = useState<RoasUnidade[] | null>(null);
  const [unidadesConfig, setC] = useState<UnidadeConfig[] | null>(null);
  const [contratos, setContratos] = useState<ContratoLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unidadeFilter, setUnidadeFilter] = useState<string | "all">("all");
  const { scopedToOwnUnit, unidade: userUnidade } = usePermissions();

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const sb = supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              order?: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
              limit?: (n: number) => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
        const [a, b, c, contRes, empRes] = await Promise.all([
          supabase.from("roas_mensal").select("*").order("mes", { ascending: true }),
          supabase.from("roas_por_unidade").select("*").order("mes", { ascending: true }),
          (sb.from("unidades_config").select("*").order!("nome", { ascending: true })),
          (sb.from("contratos").select("mrr_mensal, ganho_em, status_contrato, empresa_pipefy_id").limit!(20000)),
          supabase.from("empresas").select("pipefy_record_id, unidade").limit(20000),
        ]);
        if (a.error) throw a.error;
        if (b.error) throw b.error;
        if (c.error) throw c.error;
        if (contRes.error) throw contRes.error;
        if (empRes.error) throw empRes.error;
        if (cancel) return;
        const empMap = new Map<string, string | null>();
        for (const e of empRes.data ?? []) {
          if (e.pipefy_record_id) empMap.set(e.pipefy_record_id, e.unidade);
        }
        const cl: ContratoLite[] = ((contRes.data ?? []) as Array<{ mrr_mensal: number | null; ganho_em: string | null; status_contrato: string | null; empresa_pipefy_id: string | null }>).map((row) => ({
          mrr: Number(row.mrr_mensal ?? 0),
          ganho_em: row.ganho_em,
          status_contrato: row.status_contrato,
          unidade: row.empresa_pipefy_id ? empMap.get(row.empresa_pipefy_id) ?? null : null,
        }));
        setM((a.data ?? []) as MetricaMensal[]);
        setU((b.data ?? []) as RoasUnidade[]);
        setC(((c.data ?? []) as unknown) as UnidadeConfig[]);
        setContratos(cl);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const value = useMemo<RoasDataValue | null>(() => {
    if (!metricasMensais || !porUnidadeRaw || !unidadesConfig || !contratos) return null;
    const scopedToUnit = !!(scopedToOwnUnit && userUnidade);
    const scoped = scopedToUnit
      ? porUnidadeRaw.filter((r) => unitMatches(userUnidade, r.unidade))
      : porUnidadeRaw;
    const porUnidade =
      unidadeFilter === "all"
        ? scoped
        : scoped.filter((r) => unitMatches(unidadeFilter, r.unidade));
    const unidadesDisponiveis = Array.from(new Set(scoped.map((r) => r.unidade))).sort();
    const unidadesByNome = new Map(unidadesConfig.map((u) => [u.nome, u]));
    const meses = Array.from(new Set(metricasMensais.map((m) => m.mes))).sort();
    const lastNMonths = (n: number) => meses.slice(-n);
    const configs: UnidadeCfg[] = unidadesConfig.map((u) => ({
      nome: u.nome,
      tipo: u.tipo,
      midia_mensal: Number(u.midia_mensal ?? 0),
      royalties_pct: Number(u.royalties_pct ?? 0),
      paga_cac: u.paga_cac,
      absorve_midia: u.absorve_midia,
    }));
    const mesesSet = new Set<string>();
    for (const ct of contratos) {
      if (ct.ganho_em) mesesSet.add(ct.ganho_em.slice(0, 7));
    }
    const mesesDisponiveis = Array.from(mesesSet).sort();
    return {
      metricasMensais,
      porUnidade,
      unidadesConfig,
      unidadesByNome,
      unidadesDisponiveis,
      unidadeFilter,
      setUnidadeFilter,
      meses,
      lastNMonths,
      calcPayback,
      contratos,
      configs,
      mesesDisponiveis,
    };
  }, [metricasMensais, porUnidadeRaw, unidadesConfig, contratos, scopedToOwnUnit, userUnidade, unidadeFilter]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-semibold text-destructive">Erro ao carregar ROAS</h2>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando métricas de ROAS…</p>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function monthLabel(mes: string): string {
  const iso = mes.length === 7 ? `${mes}-01` : mes;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return mes;
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}
