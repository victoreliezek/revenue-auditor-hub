// Centralized business logic for ROAS dashboard.
// Aligns naming inconsistencies between empresas.unidade and unidades_config.nome.

export type Modelo = "verba" | "absorcao" | "interna";

export interface UnidadeCfg {
  nome: string;
  tipo: string | null; // 'regional' | 'interna'
  midia_mensal: number;
  royalties_pct: number;
  paga_cac: boolean | null;
  absorve_midia: boolean | null;
}

export interface ContratoLite {
  mrr: number;
  ganho_em: string | null; // ISO date
  status_contrato: string | null;
  unidade: string | null; // joined from empresas
}

// Map de nomes vindos de empresas.unidade → nome canônico em unidades_config.
const NAME_MAP: Record<string, string> = {
  "Sudeste (RJ)": "Rio de Janeiro",
  "São Luís": "São Luis",
};

export function canonicalUnidade(u: string | null | undefined): string | null {
  if (!u) return null;
  const t = u.trim();
  return NAME_MAP[t] ?? t;
}

export function modeloDe(cfg: UnidadeCfg): Modelo {
  if (cfg.tipo === "interna") return "interna";
  if (cfg.absorve_midia || cfg.paga_cac) return "absorcao";
  return "verba";
}

export function investimentoEfetivo(cfg: UnidadeCfg): number {
  // Absorção: Planning investe ~R$20k do próprio bolso por unidade,
  // ainda que midia_mensal esteja zerada na config.
  if (modeloDe(cfg) === "absorcao") {
    return cfg.midia_mensal && cfg.midia_mensal > 0 ? Number(cfg.midia_mensal) : 20000;
  }
  return Number(cfg.midia_mensal ?? 0);
}

export function monthKey(iso: string): string {
  // YYYY-MM
  return iso.slice(0, 7);
}

export interface UnidadeMesAgg {
  unidade: string;
  modelo: Modelo;
  cfg: UnidadeCfg;
  investimento: number;
  deals: number; // fechados no mês
  mrrMes: number; // SUM(mrr) fechados no mês
  mrrAtivosTotal: number; // SUM(mrr) de todos contratos ativos (base recorrente)
  royaltiesMes: number; // mrrAtivosTotal × pct
  cacRecebido: number; // só Absorção; = mrrMes
  roas: number; // por modelo
  paybackDias: number | null;
  paybackTexto: string;
}

export function aggregateUnidades(
  contratos: ContratoLite[],
  configs: UnidadeCfg[],
  mesYYYYMM: string,
): UnidadeMesAgg[] {
  const cfgByNome = new Map(configs.map((c) => [c.nome, c]));
  const result: UnidadeMesAgg[] = [];

  for (const cfg of configs) {
    const modelo = modeloDe(cfg);
    const inv = investimentoEfetivo(cfg);
    let deals = 0;
    let mrrMes = 0;
    let mrrAtivos = 0;
    for (const c of contratos) {
      const canon = canonicalUnidade(c.unidade);
      if (canon !== cfg.nome) continue;
      const ativo = (c.status_contrato ?? "").toLowerCase() === "ativo";
      if (ativo) mrrAtivos += Number(c.mrr ?? 0);
      if (c.ganho_em && monthKey(c.ganho_em) === mesYYYYMM && ativo) {
        deals += 1;
        mrrMes += Number(c.mrr ?? 0);
      }
    }
    const pct = Number(cfg.royalties_pct ?? 0) / 100;
    const royaltiesMes = mrrAtivos * pct;
    const cacRecebido = modelo === "absorcao" ? mrrMes : 0;

    let roas = 0;
    if (inv > 0) {
      if (modelo === "absorcao") roas = cacRecebido / inv;
      else roas = mrrMes / inv;
    }

    let paybackDias: number | null = null;
    let paybackTexto = "—";
    if (modelo === "interna") {
      paybackTexto = "N/A";
    } else {
      const recebido = modelo === "absorcao" ? cacRecebido : mrrMes;
      if (recebido >= inv && inv > 0) {
        paybackDias = 0;
        paybackTexto = "No ato";
      } else if (royaltiesMes > 0) {
        const falta = inv - recebido;
        const dias = falta / (royaltiesMes / 30);
        paybackDias = Math.ceil(dias);
        const meses = Math.ceil(falta / royaltiesMes);
        paybackTexto = `${meses} ${meses === 1 ? "mês" : "meses"}`;
      } else {
        paybackTexto = "N/A";
      }
    }

    result.push({
      unidade: cfg.nome,
      modelo,
      cfg,
      investimento: inv,
      deals,
      mrrMes,
      mrrAtivosTotal: mrrAtivos,
      royaltiesMes,
      cacRecebido,
      roas,
      paybackDias,
      paybackTexto,
    });
  }
  // garantir ordenação estável
  return result.sort((a, b) => a.unidade.localeCompare(b.unidade));
}

export function unidadesNaoMapeadas(
  contratos: ContratoLite[],
  configs: UnidadeCfg[],
): { unidade: string; deals: number; mrr: number }[] {
  const conhecidos = new Set(configs.map((c) => c.nome));
  const map = new Map<string, { deals: number; mrr: number }>();
  for (const c of contratos) {
    const canon = canonicalUnidade(c.unidade);
    const key = canon ?? "N/A";
    if (conhecidos.has(key)) continue;
    const cur = map.get(key) ?? { deals: 0, mrr: 0 };
    cur.deals += 1;
    cur.mrr += Number(c.mrr ?? 0);
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([unidade, v]) => ({ unidade, ...v }))
    .sort((a, b) => b.mrr - a.mrr);
}
