export interface AuditStats {
  total_registros: number;
  matched: number;
  deal_sem_planning: number;
  planning_sem_deal: number;
  sem_origem: number;
  ever_paid: number;
  inadimplentes: number;
  media_dias: number;
  mediana_dias: number;
  n_amostra_dias: number;
  gerado_em: string;
}

export interface PagamentoMensal {
  month: string;
  value: number;
}

export interface AuditRegistro {
  deal_id: number | null;
  deal_titulo: string | null;
  razao_social: string | null;
  cnpj: string | null;
  cidade: string | null;
  unidade: string | null;
  data_fechamento: string | null;
  mrr: number | null;
  valor_contrato: number | null;
  tipo_contrato: string | null;
  produto: string | null;
  segmento: string | null;
  is_copia: boolean | null;
  status_match: "matched" | "deal_sem_planning" | "planning_sem_deal" | "sem_origem" | string;
  status_pagamento: "adimplente" | "inadimplente" | "recente" | "sem_dados" | string;
  pagou: boolean | null;
  data_primeiro_pag: string | null;
  dias_ate_primeiro_pag: number | null;
  meses_pagos: number | null;
  total_pago: number | null;
  pagamentos_mensais: PagamentoMensal[] | null;
  inicio_contrato: string | null;
}

export interface Unidade {
  id: number;
  nome_da_praca: string;
  royalties_percentual: number | null;
  csc_percentual_base_antiga: number | null;
  csc_valor_fixo: number | null;
  midia_mensal: number | null;
  midia_cac: boolean | null;
}

export interface Empresa {
  id: number;
  cnpj: string | null;
  razao_social: string | null;
  unidade: string | null;
  origem_da_base: string | null;
  titulo?: string | null;
  pipefy_record_id?: string | null;
  pipedrive_id?: string | null;
  omie_codigo_cliente?: string | null;
  uf?: string | null;
  segmento?: string | null;
}

export interface ContratoLite {
  id: number;
  cnpj: string | null;
  mrr: number | null;
  valor_total: number | null;
  status_contrato: string | null;
  pipedrive_deal_id: string | number | null;
  ganho_em: string | null;
  titulo: string | null;
  tipo?: string | null;
  produto?: string | null;
}
