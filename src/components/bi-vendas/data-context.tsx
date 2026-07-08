import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VendaRow {
  unidade: string;
  mrr: number;
  ganho_em: string; // ISO date
}

export interface PropostaRow {
  mes: string; // YYYY-MM-DD
  unidade: string;
  valor: number;
}

// Buckets agregados de sqls_por_bu que não representam uma unidade individual
// (usados só no rateio de custos em despesas-cm.tsx) — não exibir como BU aqui.
const BUCKETS_AGREGADOS = new Set(["Partners"]);

export interface InvestimentoRow {
  mes: string; // YYYY-MM-DD
  bu: string;
  valor: number;
}

// Nomes que divergem entre a planilha de investimento / Pipedrive e o nome canônico da unidade.
const NAME_MAP: Record<string, string> = {
  "Bélem": "Belém",
};

export function canonicalUnidade(nome: string): string {
  const t = nome.trim();
  return NAME_MAP[t] ?? t;
}

interface BiVendasDataValue {
  vendas: VendaRow[];
  propostas: PropostaRow[];
  investimento: InvestimentoRow[];
  mesesDisponiveis: string[]; // YYYY-MM, união de todas as fontes
}

const Ctx = createContext<BiVendasDataValue | null>(null);

export function useBiVendasData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBiVendasData must be used within BiVendasDataProvider");
  return v;
}

export function BiVendasDataProvider({ children }: { children: ReactNode }) {
  const [vendas, setVendas] = useState<VendaRow[] | null>(null);
  const [propostas, setPropostas] = useState<PropostaRow[] | null>(null);
  const [investimento, setInvestimento] = useState<InvestimentoRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const sb = supabase as unknown as {
          from: (t: string) => { select: (s: string) => { limit: (n: number) => Promise<{ data: unknown; error: unknown }> } };
        };
        const [contRes, empRes, propRes, invRes] = await Promise.all([
          sb.from("contratos").select("mrr_mensal, ganho_em, status_contrato, empresa_pipefy_id").limit(20000),
          supabase.from("empresas").select("pipefy_record_id, unidade").limit(20000),
          sb.from("sqls_por_bu").select("mes, bu, valor").limit(5000),
          sb.from("investimento_bu").select("mes, bu, valor").limit(5000),
        ]);
        if (contRes.error) throw contRes.error;
        if (empRes.error) throw empRes.error;
        if (propRes.error) throw propRes.error;
        if (invRes.error) throw invRes.error;
        if (cancel) return;

        const empMap = new Map<string, string | null>();
        for (const e of (empRes.data ?? []) as Array<{ pipefy_record_id: string | null; unidade: string | null }>) {
          if (e.pipefy_record_id) empMap.set(e.pipefy_record_id, e.unidade);
        }

        const vendasRows: VendaRow[] = (
          (contRes.data ?? []) as Array<{
            mrr_mensal: number | null;
            ganho_em: string | null;
            empresa_pipefy_id: string | null;
          }>
        )
          .filter((r) => r.ganho_em)
          .map((r) => ({
            mrr: Number(r.mrr_mensal ?? 0),
            ganho_em: r.ganho_em as string,
            unidade: canonicalUnidade(
              (r.empresa_pipefy_id ? empMap.get(r.empresa_pipefy_id) : null) ?? "Não mapeado",
            ),
          }));

        const propostasRows: PropostaRow[] = ((propRes.data ?? []) as Array<{ mes: string; bu: string; valor: number }>)
          .filter((r) => !BUCKETS_AGREGADOS.has(r.bu))
          .map((r) => ({
            mes: r.mes,
            unidade: canonicalUnidade(r.bu),
            valor: Number(r.valor),
          }));

        const investimentoRows: InvestimentoRow[] = ((invRes.data ?? []) as InvestimentoRow[]).map((r) => ({
          ...r,
          bu: canonicalUnidade(r.bu),
          valor: Number(r.valor),
        }));

        setVendas(vendasRows);
        setPropostas(propostasRows);
        setInvestimento(investimentoRows);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const value = useMemo<BiVendasDataValue | null>(() => {
    if (!vendas || !propostas || !investimento) return null;
    const mesesSet = new Set<string>();
    for (const v of vendas) mesesSet.add(v.ganho_em.slice(0, 7));
    for (const p of propostas) mesesSet.add(p.mes.slice(0, 7));
    for (const i of investimento) mesesSet.add(i.mes.slice(0, 7));
    const mesesDisponiveis = Array.from(mesesSet).sort();
    return { vendas, propostas, investimento, mesesDisponiveis };
  }, [vendas, propostas, investimento]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-semibold text-destructive">Erro ao carregar BI de Vendas</h2>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando BI de Vendas…</p>
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
