import { supabase } from "@/integrations/supabase/client";

export interface FxcRecord {
  id: number;
  tipo: "RECEBER" | "PAGAR";
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor: number;
  status: string;
  codigo_categoria: string;
  departamento: string;
  razao_social: string;
  unidade: string;
  mes_caixa: string | null;
}

export interface FxcData {
  records: FxcRecord[];
  categorias_map: Map<string, string>;
  saldos: Map<string, number>;
  unidades_map: Map<string, string>;
  updated_at: string;
}

const DRE_GRUPOS_BASE = [
  { key: "csc_expansao",   label: "CSC Expansão",                    match: (r: FxcRecord) => r.tipo === "RECEBER" && r.codigo_categoria === "1.01.96",                                                                                           sinal: 1  as 1,  secao: "receita_direta"    },
  { key: "royalties",      label: "Royalties",                        match: (r: FxcRecord) => r.tipo === "RECEBER" && (r.codigo_categoria === "1.01.95" || r.codigo_categoria === "1.01.93"),                                                     sinal: 1  as 1,  secao: "receita_direta"    },
  { key: "outras_rx_exp",  label: "Outras Receitas Expansão",         match: (r: FxcRecord) => r.tipo === "RECEBER" && (r.codigo_categoria === "1.01.94" || r.codigo_categoria === "1.01.97"),                                                     sinal: 1  as 1,  secao: "receita_direta"    },
  { key: "csc_trafego",    label: "CSC Tráfego pago CAC",             match: (r: FxcRecord) => r.tipo === "RECEBER" && r.codigo_categoria === "1.03.96",                                                                                           sinal: 1  as 1,  secao: "receita_direta"    },
  { key: "nao_classif",    label: "Receitas Não Classificadas",       match: (r: FxcRecord) => r.tipo === "RECEBER" && r.codigo_categoria === "",                                                                                                   sinal: 1  as 1,  secao: "receita_direta"    },
  { key: "devolucoes",     label: "(-) Devolução de Receita",         match: (r: FxcRecord) => r.tipo === "PAGAR"   && r.codigo_categoria.startsWith("2.08"),                                                                                      sinal: -1 as -1, secao: "receita_direta"    },
  { key: "outras_receitas",label: "(+) Outras Receitas",              match: (r: FxcRecord) => r.tipo === "RECEBER" && r.codigo_categoria !== "" && (r.codigo_categoria.startsWith("1.01") || r.codigo_categoria.startsWith("1.02") || r.codigo_categoria.startsWith("1.03")) && !["1.01.96", "1.01.95", "1.01.93", "1.01.94", "1.01.97", "1.03.96"].includes(r.codigo_categoria), sinal: 1 as 1, secao: "outras_receitas" },
  { key: "repasses",       label: "(-) Custos Diretos / Repasse",     match: (r: FxcRecord) => r.tipo === "PAGAR"   && r.codigo_categoria.startsWith("2.01"),                                                                                      sinal: -1 as -1, secao: "custo_direto"      },
  { key: "impostos",       label: "(-) Impostos",                     match: (r: FxcRecord) => r.tipo === "PAGAR"   && r.codigo_categoria.startsWith("2.06"),                                                                                      sinal: -1 as -1, secao: "custo_direto"      },
  { key: "folha",          label: "(-) Folha de Pagamento",           match: (r: FxcRecord) => r.tipo === "PAGAR"   && r.codigo_categoria.startsWith("2.03"),                                                                                      sinal: -1 as -1, secao: "custo_direto"      },
  { key: "desp_pessoal",   label: "(-) Despesas com Pessoal",         match: (r: FxcRecord) => r.tipo === "PAGAR"   && r.codigo_categoria === "2.04.97",                                                                                           sinal: -1 as -1, secao: "custo_direto"      },
  { key: "desp_cm",        label: "(-) Despesas Comerciais e Marketing", match: (r: FxcRecord) => r.tipo === "PAGAR" && r.codigo_categoria.startsWith("2.02"),                                                                                     sinal: -1 as -1, secao: "desp_operacional"  },
  { key: "desp_admin",     label: "(-) Despesas Administrativas",     match: (r: FxcRecord) => r.tipo === "PAGAR"   && (r.codigo_categoria.startsWith("2.04") && r.codigo_categoria !== "2.04.97" || r.codigo_categoria.startsWith("2.05") || r.codigo_categoria.startsWith("2.11")), sinal: -1 as -1, secao: "desp_operacional" },
  { key: "extraordinario", label: "(+/-) Extraordinário / Financeiro",match: (r: FxcRecord) => r.codigo_categoria !== "" && (r.codigo_categoria.startsWith("1.04") || r.codigo_categoria.startsWith("1.05") || r.codigo_categoria.startsWith("2.07") || r.codigo_categoria.startsWith("2.09") || r.codigo_categoria.startsWith("2.10")), sinal: (r: FxcRecord) => r.tipo === "RECEBER" ? 1 : -1, secao: "extraordinario" },
] as const;

// Catch-all: garante que nenhum lançamento PAGO/RECEBIDO do Omie fique de fora do
// Grand Total, mesmo que venha com um código de categoria novo/inesperado que os
// grupos acima ainda não mapeiam. Sem isso, categorias fora da lista fixa
// desapareciam silenciosamente do FCx enquanto continuavam contando na DFC/Omie.
const NAO_CLASSIFICADO_GRUPO = {
  key: "nao_classificado",
  label: "(+/-) Não Classificado (categoria fora do mapa)",
  match: (r: FxcRecord) => !DRE_GRUPOS_BASE.some((g) => g.match(r)),
  sinal: (r: FxcRecord) => (r.tipo === "RECEBER" ? 1 : -1),
  secao: "nao_classificado",
} as const;

export const DRE_GRUPOS = [...DRE_GRUPOS_BASE, NAO_CLASSIFICADO_GRUPO] as const;

const MESES: Record<string, string> = {
  "01": "jan", "02": "fev", "03": "mar", "04": "abr",
  "05": "mai", "06": "jun", "07": "jul", "08": "ago",
  "09": "set", "10": "out", "11": "nov", "12": "dez",
};

export function mesLabel(ym: string): string {
  const [, m] = ym.split("-");
  return MESES[m] ?? m;
}

function mesReferencia(status: string, data_pagamento: string | null, data_vencimento: string | null): string | null {
  if (status === "PAGO" || status === "RECEBIDO")
    return (data_pagamento ?? data_vencimento)?.slice(0, 7) ?? null;
  return data_vencimento?.slice(0, 7) ?? null;
}

async function fetchAllPf(): Promise<any[]> {
  const all: any[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("partners_financeiro")
      .select("id,tipo,data_vencimento,data_pagamento,valor_documento,status_titulo,codigo_categoria,departamento,razao_social,unidade,synced_at")
      .neq("status_titulo", "CANCELADO")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchFxcData(): Promise<FxcData> {
  const [pfData, catsData, saldoData, franqData] = await Promise.all([
    fetchAllPf(),
    supabase.from("categorias_omie").select("codigo,descricao").then(({ data }) => data ?? []),
    supabase.from("partners_saldo_mensal").select("mes,saldo_final").eq("unidade", "Partners").order("mes").then(({ data }) => data ?? []),
    supabase.from("recebimentos_franquias").select("cliente,unidade").neq("unidade", "").then(({ data }) => data ?? []),
  ]);

  const categorias_map = new Map<string, string>(catsData.map((c: any) => [c.codigo as string, c.descricao as string]));
  const saldos = new Map<string, number>(saldoData.map((s: any) => [s.mes as string, Number(s.saldo_final)]));
  const unidades_map = new Map<string, string>(franqData.filter((f: any) => f.cliente && f.unidade).map((f: any) => [f.cliente as string, f.unidade as string]));

  const records: FxcRecord[] = pfData.map((r: any) => ({
    id:               r.id,
    tipo:             r.tipo as "RECEBER" | "PAGAR",
    data_vencimento:  r.data_vencimento ?? null,
    data_pagamento:   r.data_pagamento ?? null,
    valor:            Number(r.valor_documento ?? 0),
    status:           r.status_titulo ?? "",
    codigo_categoria: r.codigo_categoria ?? "",
    departamento:     r.departamento ?? "",
    razao_social:     r.razao_social ?? "",
    unidade:          r.unidade ?? "",
    mes_caixa:        mesReferencia(r.status_titulo, r.data_pagamento, r.data_vencimento),
  }));

  const rawTs = pfData[0]?.synced_at ?? null;
  const updated_at = rawTs
    ? (() => {
        const d = new Date(rawTs);
        return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      })()
    : `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  return { records, categorias_map, saldos, unidades_map, updated_at };
}

export interface DreMes {
  mes: string;
  label: string;
  grupos: Record<string, number>;
  grand_total: number;
  saldo_inicial: number;
  saldo_final: number;
}

export function buildDre(records: FxcRecord[], saldos: Map<string, number>, ano: string): DreMes[] {
  const mesesSet = new Set<string>();
  for (const r of records) {
    if (!r.mes_caixa?.startsWith(ano)) continue;
    if (r.status !== "PAGO" && r.status !== "RECEBIDO") continue;
    mesesSet.add(r.mes_caixa);
  }
  const mesesOrdenados = [...mesesSet].sort();

  return mesesOrdenados.map((mes, idx) => {
    const grupos: Record<string, number> = {};
    let grand_total = 0;
    for (const grupo of DRE_GRUPOS) {
      let total = 0;
      for (const r of records) {
        if (r.mes_caixa !== mes) continue;
        if (r.status !== "PAGO" && r.status !== "RECEBIDO") continue;
        if (!grupo.match(r)) continue;
        const sinal = typeof grupo.sinal === "function" ? grupo.sinal(r) : grupo.sinal;
        total += sinal * r.valor;
      }
      grupos[grupo.key] = total;
      grand_total += total;
    }

    const saldo_final_omie = saldos.get(mes);
    let saldo_final: number;
    let saldo_inicial: number;
    if (saldo_final_omie !== undefined) {
      saldo_final = saldo_final_omie;
      const mes_anterior = mesesOrdenados[idx - 1];
      const saldo_ant = mes_anterior ? saldos.get(mes_anterior) : undefined;
      saldo_inicial = saldo_ant !== undefined ? saldo_ant : saldo_final - grand_total;
    } else {
      saldo_final = 0;
      saldo_inicial = 0;
    }

    return { mes, label: mesLabel(mes), grupos, grand_total, saldo_inicial, saldo_final };
  });
}
