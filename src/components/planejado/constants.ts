// Shared constants/types for Planejado vs Realizado

export type OrcRow = {
  id: number;
  tipo: string;
  mes: string;
  descricao: string | null;
  categoria: string | null;
  departamento: string | null;
  unidade: string | null;
  valor: number;
  tipo_custo: string | null;
  origem?: string | null;
};

export type FinRow = {
  numero_documento: string | null;
  departamento: string | null;
  data_vencimento: string | null;
  data_emissao: string | null;
  valor_documento: number | null;
  status_titulo: string | null;
  categoria_codigo: string | null;
  codigo_lancamento_omie: number | null;
  codigo_cliente_fornecedor: number | null;
  tipo: string | null;
};

export const BRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export const BRL2 = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

export const MES_OPTS = [
  { value: "2026-01", label: "Jan/26" },
  { value: "2026-02", label: "Fev/26" },
  { value: "2026-03", label: "Mar/26" },
  { value: "2026-04", label: "Abr/26" },
  { value: "2026-05", label: "Mai/26" },
  { value: "2026-06", label: "Jun/26" },
  { value: "2026-07", label: "Jul/26" },
  { value: "2026-08", label: "Ago/26" },
  { value: "2026-09", label: "Set/26" },
  { value: "2026-10", label: "Out/26" },
  { value: "2026-11", label: "Nov/26" },
  { value: "2026-12", label: "Dez/26" },
];

export const mesLabel = (ym: string) =>
  MES_OPTS.find((m) => m.value === ym)?.label ?? ym;

// Receita mapping
export type GroupDef = { key: string; label: string; codes: string[] };

export const RECEITA_GROUPS: GroupDef[] = [
  { key: "royalties", label: "Royalties", codes: ["1.01.95", "1.01.93"] },
  { key: "csc", label: "CSC", codes: ["1.01.96"] },
  { key: "midia", label: "Verba Mídia + CAC", codes: ["1.03.96", "1.01.98"] },
  { key: "cs", label: "CS", codes: ["1.01.97"] },
];

export const RECEITA_ORC_MAP: Record<string, string> = {
  Royalties: "royalties",
  CSC: "csc",
  Marketing: "midia",
  "Reembolso CAC": "midia",
  Operação: "cs",
  CS: "cs",
};

export const DESPESA_GROUPS: GroupDef[] = [
  { key: "sal_pj", label: "Salários Fixo PJ", codes: ["2.03.99", "2.03.96", "2.03.02"] },
  { key: "sal_clt", label: "Salários Fixo CLT", codes: ["2.03.01"] },
  { key: "midias", label: "Mídias", codes: ["2.02.98", "2.02.99"] },
  { key: "terc_pj", label: "Serviço de Terceiros PJ", codes: ["2.03.99"] },
  { key: "consult", label: "Serviços de Consultoria", codes: ["2.04.95", "2.08.01"] },
  { key: "soft", label: "Softwares", codes: ["2.04.99", "2.04.92"] },
  {
    key: "admin",
    label: "Despesas Administrativas",
    codes: [
      "2.04.01","2.04.02","2.04.03","2.04.04","2.04.05",
      "2.04.06","2.04.07","2.04.08","2.04.96","2.04.97","2.04.98",
    ],
  },
  { key: "repasses", label: "Repasses", codes: ["2.01.98", "2.01.99"] },
];

export const DESPESA_ORC_MAP: Record<string, string> = {
  "Salários Fixo PJ": "sal_pj",
  "Salários Fixo CLT": "sal_clt",
  "Mídias": "midias",
  "Serviço de Terceiros PJ": "terc_pj",
  "Serviços de Consultoria": "consult",
  Softwares: "soft",
  "Despesas Administrativas": "admin",
  Repasses: "repasses",
};

// Reverse: group key -> categoria label expected on partners_orcamento
export const groupKeyToOrcCategoria = (key: string, tipo: "RECEITA" | "DESPESA"): string => {
  if (tipo === "RECEITA") {
    const entry = Object.entries(RECEITA_ORC_MAP).find(([, v]) => v === key);
    return entry?.[0] ?? "";
  }
  const entry = Object.entries(DESPESA_ORC_MAP).find(([, v]) => v === key);
  return entry?.[0] ?? "";
};

export const CATEGORIA_DESPESA_OPTS = [
  "Salários Fixo PJ",
  "Salários Fixo CLT",
  "Serviço de Terceiros PJ",
  "Mídias",
  "Softwares",
  "Serviços de Consultoria",
  "Despesas Administrativas",
  "Repasses",
  "Capex",
  "Bônus",
  "Passagem Aérea",
  "Outros",
];

export const CATEGORIA_RECEITA_OPTS = [
  "Royalties",
  "CSC",
  "CS",
  "Marketing",
  "Reembolso CAC",
  "Outras Receitas",
];

export const DEPARTAMENTO_OPTS = [
  "Growth",
  "Comercial",
  "Marketing",
  "Operação",
  "Mídias",
  "CSC Planning Grupo",
  "Todos",
];

export const UNIDADE_OPTS = [
  "Planning",
  "Geral",
  "Curitiba",
  "Patos de Minas",
  "Belém",
  "Sudeste RJ",
  "Campo Novo",
  "São Luís",
  "Fortaleza",
  "Maceió",
];

export const TIPO_CUSTO_OPTS = ["Fixo", "Fixo Variável", "Pontual", "Parcelado", "Budget Categoria"];

export const STATUS_REAL = new Set(["PAGO", "RECEBIDO"]);
export const STATUS_INCLUI_AVENCER = new Set(["PAGO", "RECEBIDO", "A VENCER", "ATRASADO"]);

export function nextYM(ym: string, delta = 1): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
