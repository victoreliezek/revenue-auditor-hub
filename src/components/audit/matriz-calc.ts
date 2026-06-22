import type { AuditRegistro, PagamentoMensal, Unidade } from "@/lib/audit-types";

export interface ClienteMatriz {
  registro: AuditRegistro;
  unidadeNome: string | null;
  unidade: Unidade | null;
  pctRoyalties: number; // 0..1
  // CAC
  cacRecebido: number; // valor do 1º pagamento se houver
  cacMes: string | null; // YYYY-MM
  cacEstimado: number; // mrr se ainda não pagou nada
  pagouAlgo: boolean;
  // Royalties (por pagamento, do 2º em diante)
  royaltiesPorMes: { month: string; valorPago: number; royalties: number }[];
  totalRoyalties: number;
}

export interface UnidadeAggregate {
  nome: string;
  unidade: Unidade | null;
  pctRoyalties: number; // 0..1
  clientes: ClienteMatriz[];
  // CAC
  cacRealizado: number;
  cacPendente: number;
  qtdAquisicoes: number; // clientes com 1º pagamento
  qtdPendentes: number;
  // Royalties
  royaltiesAcumulado: number;
  royaltiesPorMes: Map<string, number>;
  cacPorMes: Map<string, number>;
}

function sortedPagamentos(p: PagamentoMensal[] | null | undefined): PagamentoMensal[] {
  if (!p) return [];
  let arr: PagamentoMensal[];
  if (Array.isArray(p)) {
    arr = p;
  } else if (typeof p === "string") {
    try {
      const parsed = JSON.parse(p);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else {
    return [];
  }
  return [...arr]
    .filter((x): x is PagamentoMensal => !!x && typeof x.month === "string")
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function calcCliente(
  r: AuditRegistro,
  unidadeNome: string | null,
  unidade: Unidade | null,
): ClienteMatriz {
  const pct = (unidade?.royalties_percentual ?? 0) / 100;
  const pagos = sortedPagamentos(r.pagamentos_mensais);

  const cacRecebido = pagos.length > 0 ? pagos[0].value ?? 0 : 0;
  const cacMes = pagos.length > 0 ? pagos[0].month : null;
  const pagouAlgo = pagos.length > 0;
  const cacEstimado = !pagouAlgo ? r.mrr ?? 0 : 0;

  const royaltiesPorMes = pagos.slice(1).map((p) => ({
    month: p.month,
    valorPago: p.value ?? 0,
    royalties: (p.value ?? 0) * pct,
  }));
  const totalRoyalties = royaltiesPorMes.reduce((s, x) => s + x.royalties, 0);

  return {
    registro: r,
    unidadeNome,
    unidade,
    pctRoyalties: pct,
    cacRecebido,
    cacMes,
    cacEstimado,
    pagouAlgo,
    royaltiesPorMes,
    totalRoyalties,
  };
}

export function enrichAll(
  registros: AuditRegistro[],
  cnpjToUnidade: Map<string, string | null>,
  unidadesByName: Map<string, Unidade>,
): ClienteMatriz[] {
  return registros.map((r) => {
    const nome = r.cnpj ? cnpjToUnidade.get(r.cnpj) ?? null : null;
    const u = nome ? unidadesByName.get(nome) ?? null : null;
    return calcCliente(r, nome, u);
  });
}

/**
 * Mês (YYYY-MM) de início do cliente — preferindo inicio_contrato,
 * caindo no mês do primeiro pagamento se necessário.
 */
function clienteStartMonth(c: ClienteMatriz): string | null {
  const ic = c.registro.inicio_contrato;
  if (ic && ic.length >= 7) return ic.slice(0, 7);
  return c.cacMes;
}

/**
 * Valor do 1º honorário do cliente (CAC previsto).
 * Usa o primeiro pagamento recebido; se ainda não pagou, usa o MRR como proxy.
 */
function clientePrimeiroHonorario(c: ClienteMatriz): number {
  if (c.cacRecebido > 0) return c.cacRecebido;
  return c.registro.mrr ?? 0;
}

/**
 * Projeta o previsto de royalties e CAC por mês para um cliente.
 * - Royalties: MRR × pct em todo mês >= mês seguinte ao início (cliente ativo).
 * - CAC: 1º honorário lançado no mês de início.
 */
function projectClientePrevisto(
  c: ClienteMatriz,
  monthsList: string[],
): { royalties: Map<string, number>; cac: Map<string, number> } {
  const royalties = new Map<string, number>();
  const cac = new Map<string, number>();
  const start = clienteStartMonth(c);
  const mrr = c.registro.mrr ?? 0;
  const pct = c.pctRoyalties;
  const honor = clientePrimeiroHonorario(c);

  for (const ym of monthsList) {
    if (start && ym === start && honor > 0) {
      cac.set(ym, honor);
    }
    if (start && ym > start && mrr > 0 && pct > 0) {
      royalties.set(ym, mrr * pct);
    }
  }
  return { royalties, cac };
}

/**
 * Agrega clientes por unidade.
 *
 * @param monthsList Janela de meses a projetar para "previsto" (royalties/cac).
 *   Padrão = últimos 18 meses (cobre os filtros de 3/6/12 meses + histórico do drawer).
 */
export function aggregateByUnit(
  clientes: ClienteMatriz[],
  monthsList?: string[],
): UnidadeAggregate[] {
  const months = monthsList ?? lastNMonths(18);
  const map = new Map<string, UnidadeAggregate>();
  for (const c of clientes) {
    const key = c.unidadeNome ?? "__sem_unidade__";
    let agg = map.get(key);
    if (!agg) {
      agg = {
        nome: c.unidadeNome ?? "Sem unidade",
        unidade: c.unidade,
        pctRoyalties: c.pctRoyalties,
        clientes: [],
        cacRealizado: 0,
        cacPendente: 0,
        qtdAquisicoes: 0,
        qtdPendentes: 0,
        royaltiesAcumulado: 0,
        royaltiesPorMes: new Map(),
        cacPorMes: new Map(),
      };
      map.set(key, agg);
    }
    agg.clientes.push(c);
    agg.cacRealizado += c.cacRecebido;
    agg.cacPendente += c.cacEstimado;
    if (c.pagouAlgo) agg.qtdAquisicoes += 1;
    else agg.qtdPendentes += 1;

    agg.royaltiesAcumulado += c.totalRoyalties;

    const proj = projectClientePrevisto(c, months);
    for (const [ym, v] of proj.royalties) {
      agg.royaltiesPorMes.set(ym, (agg.royaltiesPorMes.get(ym) ?? 0) + v);
    }
    for (const [ym, v] of proj.cac) {
      agg.cacPorMes.set(ym, (agg.cacPorMes.get(ym) ?? 0) + v);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.nome === "Sem unidade") return 1;
    if (b.nome === "Sem unidade") return -1;
    return a.nome.localeCompare(b.nome);
  });
}

/** Soma global por mês (CAC ou Royalties). */
export function aggregateMonthly(
  clientes: ClienteMatriz[],
  kind: "cac" | "royalties",
): { month: string; value: number }[] {
  const map = new Map<string, number>();
  for (const c of clientes) {
    if (kind === "cac") {
      if (c.cacMes && c.cacRecebido > 0) {
        map.set(c.cacMes, (map.get(c.cacMes) ?? 0) + c.cacRecebido);
      }
    } else {
      for (const rm of c.royaltiesPorMes) {
        map.set(rm.month, (map.get(rm.month) ?? 0) + rm.royalties);
      }
    }
  }
  return Array.from(map.entries())
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function lastNMonths(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
