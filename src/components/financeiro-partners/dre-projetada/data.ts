import { supabase } from "@/integrations/supabase/client";
import {
  Cadastro,
  CategoriaRow,
  Cenario,
  Item,
  Natureza,
  RateioPartners,
  TipoItem,
  Valor,
  gerarValoresLocal,
  normNome,
} from "./types";

/**
 * Lê criterios_rateio_cm + sqls_por_bu(ano) e devolve a estrutura RateioPartners.
 * - bu_direto = 'Partners' → direct[nome] = 1
 * - bu_direto != 'Partners' → direct[nome] = 0
 * - tipo_rateio = 'custom' e percentuais_custom.Partners → direct[nome] = valor
 * - tipo_rateio = 'padrao' → entra em padrao Set; pct é por mês via SQLs:
 *     pct_partners_mes = 0.125 + 0.5 * (sql_partners_mes / sql_total_mes)
 *     mes sem SQLs → 0.25 (split igualitário entre 4 BUs)
 * - sem critério → não entra → consumer trata como 100% Partners
 */
export async function listRateioPartners(ano: number): Promise<RateioPartners> {
  const [{ data: criterios, error: e1 }, { data: sqls, error: e2 }] = await Promise.all([
    supabase
      .from("criterios_rateio_cm")
      .select("fornecedor, tipo_rateio, bu_direto, percentuais_custom, ativo"),
    supabase
      .from("sqls_por_bu")
      .select("mes, bu, valor")
      .gte("mes", `${ano}-01-01`)
      .lte("mes", `${ano}-12-31`),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const direct = new Map<string, number>();
  const padrao = new Set<string>();
  (criterios ?? []).forEach((r: any) => {
    if (r.ativo === false) return;
    const key = normNome(r.fornecedor);
    if (!key) return;
    if (r.bu_direto) {
      direct.set(key, r.bu_direto === "Partners" ? 1 : 0);
      return;
    }
    if (r.tipo_rateio === "custom" && r.percentuais_custom && typeof r.percentuais_custom === "object") {
      const raw = r.percentuais_custom.Partners;
      if (raw !== undefined && raw !== null) {
        const n = Number(raw);
        if (!Number.isNaN(n)) {
          direct.set(key, n > 1 ? n / 100 : n);
          return;
        }
      }
      // custom sem chave Partners → 0
      direct.set(key, 0);
      return;
    }
    if (r.tipo_rateio === "padrao") {
      padrao.add(key);
    }
  });

  // pct Partners por mês via SQLs
  const totaisPorMes: number[] = Array(12).fill(0);
  const partnersPorMes: number[] = Array(12).fill(0);
  (sqls ?? []).forEach((s: any) => {
    const m = new Date(s.mes).getUTCMonth(); // 0..11
    const v = Number(s.valor) || 0;
    totaisPorMes[m] += v;
    if (s.bu === "Partners") partnersPorMes[m] += v;
  });
  const padraoPctPorMes: number[] = Array(12).fill(0.25);
  for (let i = 0; i < 12; i++) {
    if (totaisPorMes[i] > 0) {
      padraoPctPorMes[i] = 0.125 + 0.5 * (partnersPorMes[i] / totaisPorMes[i]);
    }
  }

  return { direct, padrao, padraoPctPorMes };
}



/**
 * Fonte única: itens vivem em `despesas_cm_fornecedores` / `receitas_cm_fornecedores`.
 * Valores mensais em `*_cm_overrides`. Sem cenário (cenario_id = NULL) = visão real
 * compartilhada com a aba Despesas. Com cenário = projeção alternativa.
 */

function tableItens(natureza: Natureza): "despesas_cm_fornecedores" | "receitas_cm_fornecedores" {
  return natureza === "despesa" ? "despesas_cm_fornecedores" : "receitas_cm_fornecedores";
}
function tableOverrides(natureza: Natureza): "despesas_cm_overrides" | "receitas_cm_overrides" {
  return natureza === "despesa" ? "despesas_cm_overrides" : "receitas_cm_overrides";
}

function rowToItem(r: any, natureza: Natureza): Item {
  return {
    id: String(r.id),
    cenario_id: r.cenario_id ?? null,
    natureza,
    nome: r.nome,
    categoria: r.categoria ?? null,
    departamento: r.departamento ?? null,
    tipo_rateio: r.rateio_regra ?? null,
    tipo: (r.tipo ?? "fixo") as TipoItem,
    valor_base: Number(r.valor_base) || 0,
    mes_inicio: r.mes_inicio ?? 1,
    parcelas: r.parcelas ?? null,
    meses_pontuais: r.meses_pontuais ?? null,
  };
}

async function userId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ---------- Cenários ----------
export async function listCenarios(ano: number): Promise<Cenario[]> {
  const { data, error } = await supabase
    .from("dre_sim_cenarios")
    .select("id, nome, ano")
    .eq("ano", ano)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function criarCenario(nome: string, ano: number): Promise<Cenario> {
  const uid = await userId();
  if (!uid) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("dre_sim_cenarios")
    .insert({ nome, ano, user_id: uid })
    .select("id, nome, ano")
    .single();
  if (error) throw error;
  return data;
}

export async function renomearCenario(id: string, nome: string) {
  const { error } = await supabase.from("dre_sim_cenarios").update({ nome }).eq("id", id);
  if (error) throw error;
}

export async function excluirCenario(id: string) {
  const { error } = await supabase.from("dre_sim_cenarios").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Cadastros (categorias / departamentos / rateios) ----------
export async function listCategorias(natureza: Natureza): Promise<CategoriaRow[]> {
  const { data, error } = await supabase
    .from("dre_sim_categorias")
    .select("id, nome, natureza, grupo_dre")
    .eq("natureza", natureza)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as CategoriaRow[];
}
export async function criarCategoria(nome: string, natureza: Natureza, grupo_dre: string | null = null) {
  const uid = await userId();
  if (!uid) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("dre_sim_categorias")
    .insert({ nome, natureza, user_id: uid, grupo_dre } as never);
  if (error) throw error;
}
export async function atualizarCategoriaGrupo(id: string, grupo_dre: string | null) {
  const { error } = await supabase
    .from("dre_sim_categorias")
    .update({ grupo_dre } as never)
    .eq("id", id);
  if (error) throw error;
}
export async function excluirCategoria(id: string) {
  const { error } = await supabase.from("dre_sim_categorias").delete().eq("id", id);
  if (error) throw error;
}

export async function listDepartamentos(): Promise<Cadastro[]> {
  const { data, error } = await supabase
    .from("dre_sim_departamentos")
    .select("id, nome")
    .order("nome");
  if (error) throw error;
  return data ?? [];
}
export async function criarDepartamento(nome: string) {
  const uid = await userId();
  if (!uid) throw new Error("Não autenticado");
  const { error } = await supabase.from("dre_sim_departamentos").insert({ nome, user_id: uid });
  if (error) throw error;
}
export async function excluirDepartamento(id: string) {
  const { error } = await supabase.from("dre_sim_departamentos").delete().eq("id", id);
  if (error) throw error;
}

export async function listTiposRateio(): Promise<Cadastro[]> {
  const { data, error } = await supabase
    .from("dre_sim_tipos_rateio")
    .select("id, nome")
    .order("nome");
  if (error) throw error;
  return data ?? [];
}
export async function criarTipoRateio(nome: string) {
  const uid = await userId();
  if (!uid) throw new Error("Não autenticado");
  const { error } = await supabase.from("dre_sim_tipos_rateio").insert({ nome, user_id: uid });
  if (error) throw error;
}
export async function excluirTipoRateio(id: string) {
  const { error } = await supabase.from("dre_sim_tipos_rateio").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Itens ----------
/**
 * Lista itens do cenário (ou da base se cenarioId === null).
 * Para `cenarioId !== null`, devolve a UNIÃO da base (cenario_id IS NULL) + os itens do cenário,
 * permitindo que o cenário herde a fonte real e adicione/sobrescreva pontualmente.
 */
export async function listItens(cenarioId: string | null, natureza: Natureza): Promise<Item[]> {
  let q = supabase.from(tableItens(natureza)).select("*");
  if (cenarioId === null) {
    q = q.is("cenario_id", null);
  } else {
    q = q.or(`cenario_id.is.null,cenario_id.eq.${cenarioId}`);
  }
  const { data, error } = await q.order("ordem", { ascending: true }).order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToItem(r, natureza));
}

/** Overrides para o ano selecionado, para os itens dados. */
export async function listValoresAnoParaItens(itens: Item[], ano: number): Promise<Valor[]> {
  if (!itens.length) return [];
  // Itens sintéticos (id não numérico, ex.: avulsos "av:...") não têm overrides em tabela
  const realItens = itens.filter((i) => /^\d+$/.test(i.id));
  if (!realItens.length) return [];
  const ids = realItens.map((i) => Number(i.id));
  const despIds = realItens.filter((i) => i.natureza === "despesa").map((i) => Number(i.id));
  const recIds = realItens.filter((i) => i.natureza === "receita").map((i) => Number(i.id));
  const start = `${ano}-01-01`;
  const end = `${ano}-12-31`;

  const out: Valor[] = [];
  if (despIds.length) {
    const { data, error } = await supabase
      .from("despesas_cm_overrides")
      .select("id, fornecedor_id, mes, valor, inativo_no_mes")
      .in("fornecedor_id", despIds)
      .gte("mes", start)
      .lte("mes", end);
    if (error) throw error;
    (data ?? []).forEach((r: any) => {
      if (r.inativo_no_mes) return;
      const m = new Date(r.mes).getUTCMonth() + 1;
      out.push({
        id: String(r.id),
        item_id: String(r.fornecedor_id),
        mes: m,
        valor: Number(r.valor) || 0,
        customizado: true,
      });
    });
  }
  if (recIds.length) {
    const { data, error } = await supabase
      .from("receitas_cm_overrides")
      .select("id, fornecedor_id, mes, valor, inativo_no_mes")
      .in("fornecedor_id", recIds)
      .gte("mes", start)
      .lte("mes", end);
    if (error) throw error;
    (data ?? []).forEach((r: any) => {
      if (r.inativo_no_mes) return;
      const m = new Date(r.mes).getUTCMonth() + 1;
      out.push({
        id: String(r.id),
        item_id: String(r.fornecedor_id),
        mes: m,
        valor: Number(r.valor) || 0,
        customizado: true,
      });
    });
  }
  // Suprimir aviso "ids unused" preservando comportamento
  void ids;
  return out;
}

export async function criarItem(payload: Omit<Item, "id">): Promise<Item> {
  const row = {
    nome: payload.nome,
    categoria: payload.categoria,
    departamento: payload.departamento,
    tipo: payload.tipo,
    valor_base: payload.valor_base,
    rateio_regra: payload.tipo_rateio,
    mes_inicio: payload.mes_inicio,
    parcelas: payload.parcelas,
    meses_pontuais: payload.meses_pontuais,
    cenario_id: payload.cenario_id,
    ativo: true,
  };
  const { data, error } = await supabase
    .from(tableItens(payload.natureza))
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToItem(data, payload.natureza);
}

export async function atualizarItem(id: string, payload: Partial<Omit<Item, "id" | "cenario_id">> & { natureza: Natureza }): Promise<Item> {
  const row: Record<string, unknown> = {};
  if (payload.nome !== undefined) row.nome = payload.nome;
  if (payload.categoria !== undefined) row.categoria = payload.categoria;
  if (payload.departamento !== undefined) row.departamento = payload.departamento;
  if (payload.tipo_rateio !== undefined) row.rateio_regra = payload.tipo_rateio;
  if (payload.tipo !== undefined) row.tipo = payload.tipo;
  if (payload.valor_base !== undefined) row.valor_base = payload.valor_base;
  if (payload.mes_inicio !== undefined) row.mes_inicio = payload.mes_inicio;
  if (payload.parcelas !== undefined) row.parcelas = payload.parcelas;
  if (payload.meses_pontuais !== undefined) row.meses_pontuais = payload.meses_pontuais;

  const { data, error } = await supabase
    .from(tableItens(payload.natureza))
    .update(row as never)
    .eq("id", Number(id))
    .select("*")
    .single();
  if (error) throw error;
  return rowToItem(data, payload.natureza);
}

export async function excluirItem(id: string, natureza: Natureza) {
  const { error } = await supabase.from(tableItens(natureza)).delete().eq("id", Number(id));
  if (error) throw error;
}

/** Upsert do override mensal (customização do mês). */
export async function setValorCustomizado(itemId: string, natureza: Natureza, mes: number, valor: number, ano: number) {
  const mesDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const { error } = await supabase
    .from(tableOverrides(natureza))
    .upsert(
      { fornecedor_id: Number(itemId), mes: mesDate, valor, inativo_no_mes: false },
      { onConflict: "fornecedor_id,mes" },
    );
  if (error) throw error;
}

/** Remove TODAS as customizações do item (volta a usar projeção pura). */
export async function resetItem(itemId: string, natureza: Natureza, ano: number) {
  const start = `${ano}-01-01`;
  const end = `${ano}-12-31`;
  const { error } = await supabase
    .from(tableOverrides(natureza))
    .delete()
    .eq("fornecedor_id", Number(itemId))
    .gte("mes", start)
    .lte("mes", end);
  if (error) throw error;
}

/** Zera (marca inativo) apenas o mês solicitado — útil para "apagar este mês". */
export async function excluirValorMes(itemId: string, natureza: Natureza, mes: number, ano: number) {
  const mesDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const { error } = await supabase
    .from(tableOverrides(natureza))
    .upsert(
      { fornecedor_id: Number(itemId), mes: mesDate, valor: 0, inativo_no_mes: true },
      { onConflict: "fornecedor_id,mes" },
    );
  if (error) throw error;
}

/** Fallback re-export para mantém referência usada em UI. */
export { gerarValoresLocal };

/**
 * Lê despesas_cm_avulsos do ano e devolve como Itens + Valores sintéticos.
 * Agrupa por (fornecedor, categoria, departamento, rateio_regra) somando os meses.
 * IDs são prefixados com "av:" e NÃO são editáveis pela UI.
 */
export async function listAvulsosAno(ano: number): Promise<{ itens: Item[]; valores: Valor[] }> {
  const start = `${ano}-01-01`;
  const end = `${ano}-12-31`;
  const { data, error } = await supabase
    .from("despesas_cm_avulsos")
    .select("mes, fornecedor, categoria, departamento, valor_total, rateio_regra")
    .gte("mes", start)
    .lte("mes", end);
  if (error) throw error;

  type Agg = {
    fornecedor: string;
    categoria: string | null;
    departamento: string | null;
    rateio_regra: string | null;
    mensal: number[];
  };
  const groups = new Map<string, Agg>();
  (data ?? []).forEach((r: any) => {
    const forn = (r.fornecedor ?? "").trim() || "(sem fornecedor)";
    const cat = r.categoria ?? null;
    const dep = r.departamento ?? null;
    const reg = r.rateio_regra ?? null;
    const key = `${forn}|${cat ?? ""}|${dep ?? ""}|${reg ?? ""}`;
    const g = groups.get(key) ?? { fornecedor: forn, categoria: cat, departamento: dep, rateio_regra: reg, mensal: Array(12).fill(0) };
    const m = new Date(r.mes).getUTCMonth();
    g.mensal[m] += Number(r.valor_total) || 0;
    groups.set(key, g);
  });

  const itens: Item[] = [];
  const valores: Valor[] = [];
  let idx = 0;
  for (const [, g] of groups) {
    const id = `av:${idx++}`;
    itens.push({
      id,
      cenario_id: null,
      natureza: "despesa",
      nome: g.fornecedor,
      categoria: g.categoria,
      departamento: g.departamento,
      tipo_rateio: g.rateio_regra,
      tipo: "pontual",
      valor_base: 0,
      mes_inicio: 1,
      parcelas: null,
      meses_pontuais: g.mensal.map((v, i) => v > 0 ? i + 1 : 0).filter((v) => v > 0),
    });
    g.mensal.forEach((v, i) => {
      if (v !== 0) {
        valores.push({ id: `${id}:${i + 1}`, item_id: id, mes: i + 1, valor: v, customizado: true });
      }
    });
  }
  return { itens, valores };
}
