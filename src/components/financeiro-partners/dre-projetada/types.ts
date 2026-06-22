export type Natureza = "receita" | "despesa";
export type TipoItem = "fixo" | "fixo_variavel" | "parcelado" | "pontual";

/** Seleção do select de cenário: built-in (base-total/base-partners) ou UUID. */
export type CenarioSel = "base-total" | "base-partners" | string;

/** Normaliza nome para casar item ↔ critério de rateio. */
export function normNome(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Mapa de rateio Partners:
 *  - direct[nome_normalizado] = pct fixo (bu_direto ou custom)
 *  - padrao = Set de nomes com tipo_rateio='padrao' (pct depende do mês via SQLs)
 *  - padraoPctPorMes[1..12] = pct Partners do mês (0.125 + 0.5 * pct_sqls; 0.25 se sem SQLs)
 *  - itens fora de direct e padrao → 100% Partners (sem critério cadastrado)
 */
export interface RateioPartners {
  direct: Map<string, number>;
  padrao: Set<string>;
  padraoPctPorMes: number[]; // length 12, index = mes-1
}

/**
 * Retorna o % Partners (0..1) a aplicar sobre uma despesa em um dado mês.
 */
export function pctPartnersFor(itemNome: string, mes: number, r: RateioPartners | undefined): number {
  if (!r) return 1;
  const key = normNome(itemNome);
  const d = r.direct.get(key);
  if (d !== undefined) return d;
  if (r.padrao.has(key)) {
    const i = Math.max(1, Math.min(12, mes)) - 1;
    return r.padraoPctPorMes[i] ?? 0.25;
  }
  return 1;
}

export interface Cenario {
  id: string;
  nome: string;
  ano: number;
}

export interface Cadastro {
  id: string;
  nome: string;
}

export type GrupoDRE =
  | "entrada"
  | "aporte"
  | "imposto_direto"
  | "custo_variavel"
  | "custo_fixo"
  | "capex";

export const GRUPO_DRE_LABEL: Record<GrupoDRE, string> = {
  entrada: "Entradas (Receita Bruta)",
  aporte: "Aportes de Capital",
  imposto_direto: "Impostos Diretos",
  custo_variavel: "Custos Variáveis",
  custo_fixo: "Custos Fixos",
  capex: "CAPEX",
};

export interface CategoriaRow extends Cadastro {
  natureza: Natureza;
  grupo_dre: GrupoDRE | null;
}

/**
 * Item unificado (espelha as colunas de *_cm_fornecedores).
 * - cenario_id NULL = visão real/base (mesma fonte da aba Despesas)
 * - cenario_id ≠ NULL = projeção do cenário
 */
export interface Item {
  id: string;
  cenario_id: string | null;
  natureza: Natureza;
  nome: string;
  categoria: string | null;
  departamento: string | null;
  tipo_rateio: string | null;
  tipo: TipoItem;
  valor_base: number;
  mes_inicio: number;
  parcelas: number | null;
  meses_pontuais: number[] | null;
}

/** Override mensal (1..12). `customizado` indica se há linha em *_cm_overrides. */
export interface Valor {
  id: string;
  item_id: string;
  mes: number;
  valor: number;
  customizado: boolean;
}

export const MESES_LABEL = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export type Granularidade = "mensal" | "trimestral" | "semestral";

/**
 * Agrupa 12 valores mensais em buckets de acordo com a granularidade.
 * - mensal: 12 buckets (Jan..Dez)
 * - trimestral: 4 buckets (T1..T4)
 * - semestral: 2 buckets (S1, S2)
 */
export function agruparMeses(
  vals12: number[],
  g: Granularidade,
): { label: string; valor: number; meses: number[] }[] {
  const safe = (i: number) => Number(vals12[i] ?? 0) || 0;
  if (g === "mensal") {
    return MESES_LABEL.map((label, i) => ({ label, valor: safe(i), meses: [i + 1] }));
  }
  if (g === "trimestral") {
    return [0, 1, 2, 3].map((q) => {
      const meses = [q * 3 + 1, q * 3 + 2, q * 3 + 3];
      const valor = safe(q * 3) + safe(q * 3 + 1) + safe(q * 3 + 2);
      return { label: `T${q + 1}`, valor, meses };
    });
  }
  // semestral
  return [0, 1].map((s) => {
    const meses = Array.from({ length: 6 }, (_, k) => s * 6 + k + 1);
    let valor = 0;
    for (let k = 0; k < 6; k++) valor += safe(s * 6 + k);
    return { label: `S${s + 1}`, valor, meses };
  });
}

export const BRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

export const BRLcompact = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};

/** Gera os 12 valores mensais (1..12) para um item segundo seu tipo. */
export function gerarValoresLocal(item: Pick<Item, "tipo" | "valor_base" | "mes_inicio" | "parcelas" | "meses_pontuais">): number[] {
  const out = Array(12).fill(0);
  const base = Number(item.valor_base) || 0;
  const inicio = Math.max(1, Math.min(12, item.mes_inicio || 1));
  switch (item.tipo) {
    case "fixo":
    case "fixo_variavel":
      for (let m = inicio; m <= 12; m++) out[m - 1] = base;
      break;
    case "parcelado": {
      const n = Math.max(1, item.parcelas ?? 1);
      for (let i = 0; i < n; i++) {
        const m = inicio + i;
        if (m >= 1 && m <= 12) out[m - 1] = base;
      }
      break;
    }
    case "pontual":
      (item.meses_pontuais ?? []).forEach((m) => {
        if (m >= 1 && m <= 12) out[m - 1] = base;
      });
      break;
  }
  return out;
}
