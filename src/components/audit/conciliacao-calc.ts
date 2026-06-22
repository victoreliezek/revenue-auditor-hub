import type { ContratoLite, Empresa } from "@/lib/audit-types";
import type { ContaReceber } from "@/lib/contas-receber.functions";
import { normalizeCnpj } from "./data-context";

export type Bucket =
  | "completo" // empresa + contrato + omie recente
  | "vendido_sem_faturar" // contrato sem omie recente (com ou sem empresa)
  | "faturado_sem_crm" // empresa + omie sem contrato
  | "faturado_sem_cadastro" // omie sem empresa e sem contrato
  | "vendido_sem_cadastro" // contrato sem empresa (com omie ou não)
  | "cadastro_orfao" // só empresa (sem contrato e sem omie)
  | "outro";

export interface ReconRow {
  cnpj: string; // normalizado
  cnpjFmt: string | null; // formatado (do dado original)
  razaoSocial: string | null;
  unidade: string | null;
  origemBase: string | null;
  bucket: Bucket;
  temContrato: boolean;
  temEmpresa: boolean;
  temOmieRecente: boolean;
  temOmieQualquer: boolean;
  viaGrupo: boolean;
  contratos: ContratoLite[];

  mrrContratado: number; // soma
  valorContratado: number; // soma
  empresa: Empresa | null;
  ultimaFaturaRecebida: ContaReceber | null;
  totalRecebido60d: number;
  qtdFaturasRecente: number;
  contratoMaisRecente: string | null; // ganho_em
}

const CUTOFF_DAYS = 60;

export interface GrupoFilialLink {
  contrato_id: number;
  cpf_cnpj: string; // só dígitos
}

export function buildReconciliation(
  empresas: Empresa[],
  contratos: ContratoLite[],
  contasReceber: ContaReceber[],
  now: Date = new Date(),
  grupos: GrupoFilialLink[] = [],
): ReconRow[] {
  const cutoff = new Date(now.getTime() - CUTOFF_DAYS * 86_400_000);
  const map = new Map<string, ReconRow>();

  // Map filial CNPJ → parent contract CNPJ (para absorver pagamentos)
  const filialToParent = new Map<string, string>();
  const contratoIdToCnpj = new Map<number, string>();
  for (const c of contratos) {
    const k = normalizeCnpj(c.cnpj);
    if (k && c.id != null) contratoIdToCnpj.set(c.id as number, k);
  }
  for (const g of grupos) {
    const parent = contratoIdToCnpj.get(g.contrato_id);
    const filial = normalizeCnpj(g.cpf_cnpj);
    if (parent && filial && parent !== filial) filialToParent.set(filial, parent);
  }

  const get = (cnpj: string, cnpjFmt: string | null): ReconRow => {
    let row = map.get(cnpj);
    if (!row) {
      row = {
        cnpj,
        cnpjFmt,
        razaoSocial: null,
        unidade: null,
        origemBase: null,
        bucket: "outro",
        temContrato: false,
        temEmpresa: false,
        temOmieRecente: false,
        temOmieQualquer: false,
        viaGrupo: false,
        contratos: [],
        mrrContratado: 0,
        valorContratado: 0,
        empresa: null,
        ultimaFaturaRecebida: null,
        totalRecebido60d: 0,
        qtdFaturasRecente: 0,
        contratoMaisRecente: null,
      };
      map.set(cnpj, row);
    } else if (!row.cnpjFmt && cnpjFmt) {
      row.cnpjFmt = cnpjFmt;
    }
    return row!;
  };

  for (const e of empresas) {
    const key = normalizeCnpj(e.cnpj);
    if (!key) continue;
    const row = get(key, e.cnpj);
    row.temEmpresa = true;
    row.empresa = e;
    row.razaoSocial = row.razaoSocial ?? e.razao_social ?? e.titulo ?? null;
    row.unidade = row.unidade ?? e.unidade ?? null;
    row.origemBase = row.origemBase ?? e.origem_da_base ?? null;
  }

  for (const c of contratos) {
    const key = normalizeCnpj(c.cnpj);
    if (!key) continue;
    const row = get(key, c.cnpj);
    row.temContrato = true;
    row.contratos.push(c);
    row.mrrContratado += Number(c.mrr ?? 0) || 0;
    row.valorContratado += Number(c.valor_total ?? 0) || 0;
    if (!row.razaoSocial && c.titulo) row.razaoSocial = c.titulo;
    if (c.ganho_em) {
      if (!row.contratoMaisRecente || c.ganho_em > row.contratoMaisRecente) {
        row.contratoMaisRecente = c.ganho_em;
      }
    }
  }

  for (const f of contasReceber) {
    const rawKey = normalizeCnpj(f.cpf_cnpj);
    if (!rawKey) continue;
    // Se este CNPJ é filial de um contrato, redireciona para o CNPJ pai
    const parent = filialToParent.get(rawKey);
    const key = parent ?? rawKey;
    const row = get(key, parent ? null : f.cpf_cnpj);
    row.temOmieQualquer = true;
    if (parent) row.viaGrupo = true;
    if (!row.razaoSocial && f.cliente) row.razaoSocial = f.cliente;
    if (!row.unidade && f.unidade) row.unidade = f.unidade;
    const status = (f.status_pagamento ?? "").toUpperCase();
    const isRecebido = status === "RECEBIDO" || status === "PAGO" || status === "LIQUIDADO";
    if (isRecebido && f.data_pagamento) {
      const dt = new Date(f.data_pagamento);
      if (!isNaN(dt.getTime()) && dt >= cutoff) {
        row.temOmieRecente = true;
        row.qtdFaturasRecente += 1;
        row.totalRecebido60d += Number(f.valor ?? 0) || 0;
        if (
          !row.ultimaFaturaRecebida ||
          (row.ultimaFaturaRecebida.data_pagamento ?? "") < (f.data_pagamento ?? "")
        ) {
          row.ultimaFaturaRecebida = f;
        }
      }
    }
  }

  for (const row of map.values()) {
    row.bucket = classify(row);
  }
  return Array.from(map.values());
}


function classify(r: ReconRow): Bucket {
  if (r.temContrato && r.temEmpresa && r.temOmieRecente) return "completo";
  if (r.temContrato && !r.temOmieRecente) {
    if (!r.temEmpresa) return "vendido_sem_cadastro";
    return "vendido_sem_faturar";
  }
  if (!r.temContrato && r.temOmieRecente) {
    if (!r.temEmpresa) return "faturado_sem_cadastro";
    return "faturado_sem_crm";
  }
  if (!r.temContrato && !r.temOmieRecente && !r.temOmieQualquer && r.temEmpresa) return "cadastro_orfao";
  return "outro";
}

export function daysSince(d: string | null | undefined, now: Date = new Date()): number | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return Math.floor((now.getTime() - dt.getTime()) / 86_400_000);
}
