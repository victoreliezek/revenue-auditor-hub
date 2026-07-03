import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, digits, monthRange } from "@/lib/server-utils";


// ============ Types ============
export interface UnidadeRoyalties {
  id: number;
  nome_da_praca: string;
  royalties_percentual: number | null;
  csc_valor_fixo: number | null;
  csc_percentual_base_antiga: number | null;
  observacoes_financeiras: string | null;
  apuracao: ApuracaoSummary | null;
}

export interface ApuracaoSummary {
  id: number;
  status: string;
  mes_referencia: string;
  total_fatura: number | null;
  receita_base: number | null;
  royalties_valor: number | null;
  csc_valor_fixo: number | null;
  csc_base_antiga_valor: number | null;
  confirmado_em: string | null;
}

export interface ApuracaoFull {
  id: number;
  unidade_id: number;
  mes_referencia: string;
  status: string;
  receita_base: number | null;
  royalties_percentual: number | null;
  royalties_valor: number | null;
  csc_valor_fixo: number | null;
  receita_base_antiga: number | null;
  csc_percentual_base_antiga: number | null;
  csc_base_antiga_valor: number | null;
  csc_trafego_pago: number | null;
  outras_receitas: number | null;
  total_fatura: number | null;
  confirmado_em: string | null;
  confirmado_por: string | null;
  observacao: string | null;
  unidade: {
    id: number;
    nome_da_praca: string;
    royalties_percentual: number | null;
    csc_valor_fixo: number | null;
    csc_percentual_base_antiga: number | null;
    observacoes_financeiras: string | null;
    tem_omie: boolean;
  };
}

export interface ApuracaoItem {
  id: number;
  apuracao_id: number;
  cnpj: string | null;
  razao_social: string;
  contrato_id: number | null;
  categoria: string; // 'royalties' | 'csc_base_antiga'
  mrr_contratado: number | null;
  valor_omie: number | null;
  valor_confirmado: number | null;
  royalties_percentual_override: number | null;
  royalties_item: number | null;
  fonte: string;
  status_match: string | null;
  confirmado: boolean | null;
  observacao: string | null;
  filiais_count?: number;
  churn_pipefy_card_id: string | null;
  churn_reportado_em: string | null;
}


// ============ listRoyaltiesUnidades ============
export const listRoyaltiesUnidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mes: string }) => d)
  .handler(async ({ data, context }): Promise<{ rows: UnidadeRoyalties[] }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { firstDay } = monthRange(data.mes);

    const { data: unidades, error: uErr } = await supabase
      .from("unidades")
      .select(
        "id,nome_da_praca,royalties_percentual,csc_valor_fixo,csc_percentual_base_antiga,observacoes_financeiras",
      )
      .eq("tipo", "regional")
      .order("nome_da_praca");
    if (uErr) throw new Error(uErr.message);

    const { data: aps, error: aErr } = await supabase
      .from("royalties_apuracao")
      .select(
        "id,unidade_id,status,mes_referencia,total_fatura,receita_base,royalties_valor,csc_valor_fixo,csc_base_antiga_valor,confirmado_em",
      )
      .eq("mes_referencia", firstDay);
    if (aErr) throw new Error(aErr.message);

    const byUnit = new Map<number, ApuracaoSummary>();
    for (const a of aps ?? []) byUnit.set(a.unidade_id, a as ApuracaoSummary);

    return {
      rows: (unidades ?? []).map((u: any) => ({
        ...u,
        apuracao: byUnit.get(u.id) ?? null,
      })),
    };
  });

// ============ getOrCreateApuracao ============
export const getOrCreateApuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { unidade_id: number; mes: string }) => d)
  .handler(async ({ data, context }): Promise<{ apuracao_id: number; created: boolean }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { firstDay } = monthRange(data.mes);

    const { data: existing, error: e1 } = await supabase
      .from("royalties_apuracao")
      .select("id")
      .eq("unidade_id", data.unidade_id)
      .eq("mes_referencia", firstDay)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (existing) return { apuracao_id: existing.id, created: false };

    const { data: u, error: uErr } = await supabase
      .from("unidades")
      .select("royalties_percentual,csc_valor_fixo,csc_percentual_base_antiga")
      .eq("id", data.unidade_id)
      .single();
    if (uErr) throw new Error(uErr.message);

    const { data: inserted, error: iErr } = await supabase
      .from("royalties_apuracao")
      .insert({
        unidade_id: data.unidade_id,
        mes_referencia: firstDay,
        status: "rascunho",
        royalties_percentual: u.royalties_percentual,
        csc_valor_fixo: u.csc_valor_fixo,
        csc_percentual_base_antiga: u.csc_percentual_base_antiga,
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);
    return { apuracao_id: inserted.id, created: true };
  });

// ============ gerarItensApuracao ============
export const gerarItensApuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apuracao_id: number; force?: boolean }) => d)
  .handler(async ({ data, context }): Promise<{ created: number; skipped: boolean }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (!data.force) {
      // Skip if items exist
      const { count, error: cErr } = await supabase
        .from("royalties_itens")
        .select("id", { count: "exact", head: true })
        .eq("apuracao_id", data.apuracao_id);
      if (cErr) throw new Error(cErr.message);
      if ((count ?? 0) > 0) return { created: 0, skipped: true };
    }


    const { data: ap, error: apErr } = await supabase
      .from("royalties_apuracao")
      .select("id,mes_referencia,unidade_id,status, unidade:unidades!inner(id,nome_da_praca,csc_percentual_base_antiga)")
      .eq("id", data.apuracao_id)
      .single();
    if (apErr) throw new Error(apErr.message);
    if (ap.status === "confirmado" || ap.status === "faturado") {
      throw new Error("Apuração já fechada — não é possível regerar itens.");
    }

    const unidadeNome: string = ap.unidade.nome_da_praca;
    const usaCscVariavel = ap.unidade.csc_percentual_base_antiga != null;
    const mes = String(ap.mes_referencia).slice(0, 7);
    const { start, end } = monthRange(mes);

    // contratos
    const { data: contratos, error: kErr } = await supabase
      .from("contratos")
      .select("id,cnpj,titulo,mrr_mensal")
      .eq("unidade", unidadeNome)
      .eq("tipo_unidade", "franquia")
      .eq("status_contrato", "Ativo");
    if (kErr) throw new Error(kErr.message);

    // contas_receber agregado por cnpj
    const { data: recs, error: rErr } = await supabase
      .from("contas_receber")
      .select("cpf_cnpj,cliente,valor")
      .eq("unidade", unidadeNome)
      .eq("status_pagamento", "RECEBIDO")
      .gte("data_pagamento", start)
      .lte("data_pagamento", end);
    if (rErr) throw new Error(rErr.message);

    type OmieAgg = { cnpj: string; cliente: string; valor: number };
    const omieMap = new Map<string, OmieAgg>();
    for (const r of recs ?? []) {
      const k = digits(r.cpf_cnpj);
      if (!k) continue;
      const cur = omieMap.get(k) ?? { cnpj: k, cliente: r.cliente ?? "—", valor: 0 };
      cur.valor += Number(r.valor ?? 0);
      omieMap.set(k, cur);
    }

    const contratoMap = new Map<string, { id: number; titulo: string; mrr: number; cnpj: string }>();
    const itensSemCnpj: any[] = [];
    for (const c of contratos ?? []) {
      const k = digits(c.cnpj);
      if (!k) {
        // Contrato sem CNPJ cadastrado nunca pode ser cruzado com o Omie (join é por CNPJ).
        // Sem isso, o contrato desaparece silenciosamente da apuração inteira.
        itensSemCnpj.push({
          apuracao_id: data.apuracao_id,
          cnpj: null,
          razao_social: c.titulo ?? "—",
          contrato_id: c.id,
          categoria: "royalties",
          mrr_contratado: Number(c.mrr_mensal ?? 0),
          valor_omie: null,
          valor_confirmado: null,
          fonte: "pipedrive",
          status_match: "so_pipedrive",
          observacao: "Contrato sem CNPJ cadastrado — não foi possível conciliar com o Omie.",
          confirmado: false,
        });
        continue;
      }
      contratoMap.set(k, { id: c.id, titulo: c.titulo ?? "—", mrr: Number(c.mrr_mensal ?? 0), cnpj: k });
    }

    // Carrega filiais vinculadas a contratos desta unidade
    const contratoIds = Array.from(contratoMap.values()).map((c) => c.id);
    const filiaisPorContrato = new Map<number, string[]>();
    if (contratoIds.length > 0) {
      const { data: grupos, error: gErr } = await supabase
        .from("contrato_omie_grupos")
        .select("contrato_id,cpf_cnpj")
        .in("contrato_id", contratoIds);
      if (gErr) throw new Error(gErr.message);
      for (const g of grupos ?? []) {
        const arr = filiaisPorContrato.get(g.contrato_id) ?? [];
        arr.push(digits(g.cpf_cnpj));
        filiaisPorContrato.set(g.contrato_id, arr);
      }
    }

    const itens: any[] = [...itensSemCnpj];

    // Matched + so_pipedrive (com expansão por filiais vinculadas)
    for (const [k, c] of contratoMap) {
      const filiais = filiaisPorContrato.get(c.id) ?? [];
      const cnpjsGrupo = [k, ...filiais];
      let omieValor = 0;
      let temOmie = false;
      for (const cn of cnpjsGrupo) {
        const om = omieMap.get(cn);
        if (om) {
          omieValor += om.valor;
          temOmie = true;
          omieMap.delete(cn);
        }
      }
      if (temOmie) {
        const diff = c.mrr > 0 ? Math.abs(omieValor - c.mrr) / c.mrr : 0;
        itens.push({
          apuracao_id: data.apuracao_id,
          cnpj: k,
          razao_social: c.titulo,
          contrato_id: c.id,
          categoria: "royalties",
          mrr_contratado: c.mrr,
          valor_omie: omieValor,
          valor_confirmado: omieValor,
          fonte: "pipedrive",
          status_match: diff > 0.25 ? "divergente" : "matched",
          confirmado: false,
        });
      } else {
        itens.push({
          apuracao_id: data.apuracao_id,
          cnpj: k,
          razao_social: c.titulo,
          contrato_id: c.id,
          categoria: "royalties",
          mrr_contratado: c.mrr,
          valor_omie: null,
          valor_confirmado: null,
          fonte: "pipedrive",
          status_match: "so_pipedrive",
          confirmado: false,
        });
      }
    }

    // Restantes do Omie → so_omie
    for (const [k, o] of omieMap) {
      itens.push({
        apuracao_id: data.apuracao_id,
        cnpj: k,
        razao_social: o.cliente,
        contrato_id: null,
        categoria: usaCscVariavel ? "csc_base_antiga" : "royalties",
        mrr_contratado: null,
        valor_omie: o.valor,
        valor_confirmado: o.valor,
        fonte: "omie",
        status_match: "so_omie",
        confirmado: false,
      });
    }

    if (itens.length === 0) return { created: 0, skipped: false };

    // Insert em chunks
    const chunkSize = 500;
    let created = 0;
    for (let i = 0; i < itens.length; i += chunkSize) {
      const chunk = itens.slice(i, i + chunkSize);
      const { error } = await supabase.from("royalties_itens").insert(chunk);
      if (error) throw new Error(error.message);
      created += chunk.length;
    }
    return { created, skipped: false };
  });

// ============ getApuracao ============
export const getApuracao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apuracao_id: number }) => d)
  .handler(async ({ data, context }): Promise<{ apuracao: ApuracaoFull; itens: ApuracaoItem[] }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: ap, error: apErr } = await supabase
      .from("royalties_apuracao")
      .select(
        "id,unidade_id,mes_referencia,status,receita_base,royalties_percentual,royalties_valor,csc_valor_fixo,receita_base_antiga,csc_percentual_base_antiga,csc_base_antiga_valor,csc_trafego_pago,outras_receitas,total_fatura,confirmado_em,confirmado_por,observacao,unidade:unidades!inner(id,nome_da_praca,royalties_percentual,csc_valor_fixo,csc_percentual_base_antiga,observacoes_financeiras)",
      )
      .eq("id", data.apuracao_id)
      .single();
    if (apErr) throw new Error(apErr.message);

    // tem_omie: existe pelo menos 1 recebimento histórico p/ unidade
    const { count: omieCount } = await supabase
      .from("contas_receber")
      .select("id", { count: "exact", head: true })
      .eq("unidade", ap.unidade.nome_da_praca)
      .limit(1);

    const { data: itens, error: iErr } = await supabase
      .from("royalties_itens")
      .select("*")
      .eq("apuracao_id", data.apuracao_id)
      .order("razao_social");
    if (iErr) throw new Error(iErr.message);

    // Conta filiais vinculadas por contrato
    const contratoIds = Array.from(
      new Set((itens ?? []).map((i: any) => i.contrato_id).filter((x: any) => x != null)),
    );
    const countByContrato = new Map<number, number>();
    if (contratoIds.length > 0) {
      const { data: grupos } = await supabase
        .from("contrato_omie_grupos")
        .select("contrato_id")
        .in("contrato_id", contratoIds as number[]);
      for (const g of grupos ?? []) {
        countByContrato.set(g.contrato_id, (countByContrato.get(g.contrato_id) ?? 0) + 1);
      }
    }
    const itensComFiliais = (itens ?? []).map((i: any) => ({
      ...i,
      filiais_count: i.contrato_id ? countByContrato.get(i.contrato_id) ?? 0 : 0,
    }));

    return {
      apuracao: { ...(ap as any), unidade: { ...(ap as any).unidade, tem_omie: (omieCount ?? 0) > 0 } },
      itens: itensComFiliais as ApuracaoItem[],
    };
  });


// ============ updateItem ============
export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: number;
      valor_confirmado?: number | null;
      confirmado?: boolean;
      observacao?: string | null;
      royalties_percentual_override?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Bloqueia se apuração fechada
    const { data: item, error: e1 } = await supabase
      .from("royalties_itens")
      .select("apuracao_id, apuracao:royalties_apuracao!inner(status)")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    const status = (item as any).apuracao.status;
    if (status === "confirmado" || status === "faturado") {
      throw new Error("Apuração fechada — reabra antes de editar.");
    }

    const patch: any = {};
    if ("valor_confirmado" in data) patch.valor_confirmado = data.valor_confirmado;
    if ("confirmado" in data) patch.confirmado = data.confirmado;
    if ("observacao" in data) patch.observacao = data.observacao;
    if ("royalties_percentual_override" in data)
      patch.royalties_percentual_override = data.royalties_percentual_override;

    const { error } = await supabase.from("royalties_itens").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ atualizarCnpjContrato ============
// Preenche/corrige o CNPJ de um contrato direto na tela de apuração (item "Só
// no Pipedrive" sem CNPJ cadastrado). O CNPJ é o campo que gerarItensApuracao
// usa pra cruzar com contas_receber — sem ele o contrato nunca casa com o Omie.
export const atualizarCnpjContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { contrato_id: number; cnpj: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const cnpj = digits(data.cnpj);
    if (cnpj.length !== 14) throw new Error("CNPJ inválido — precisa ter 14 dígitos.");

    const { error } = await supabase.from("contratos").update({ cnpj }).eq("id", data.contrato_id);
    if (error) throw new Error(error.message);
    return { ok: true, cnpj };
  });

// ============ marcarChurn ============
// Cria um card no pipe Pipefy "Tratativas" (307196408) já na fase "Perdido"
// (343394578), com motivo e data preenchidos. O card sincroniza de volta pra
// central_tratativas via sync_pipefy_tratativas.py (roda a cada 15min).
const PIPEFY_PIPE_TRATATIVAS = "307196408";
const PIPEFY_FASE_PERDIDO = "343394578";

export const marcarChurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; motivo: string; data_churn: string }) => d)
  .handler(async ({ data, context }): Promise<{ ok: true; pipefy_card_id: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (!data.motivo?.trim()) throw new Error("Motivo do churn é obrigatório.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.data_churn)) throw new Error("Data do churn inválida.");

    const { data: item, error: iErr } = await supabase
      .from("royalties_itens")
      .select(
        "id,razao_social,mrr_contratado,contrato_id,churn_pipefy_card_id,apuracao:royalties_apuracao!inner(status,unidade:unidades!inner(nome_da_praca)),contrato:contratos(pipedrive_deal_id)",
      )
      .eq("id", data.item_id)
      .single();
    if (iErr) throw new Error(iErr.message);

    const status = (item as any).apuracao.status;
    if (status === "confirmado" || status === "faturado") {
      throw new Error("Apuração fechada — reabra antes de marcar churn.");
    }
    if (!item.contrato_id) throw new Error("Só é possível marcar churn em itens com contrato vinculado.");
    if (item.churn_pipefy_card_id) throw new Error("Este cliente já tem churn registrado.");

    const pipefyToken = process.env.PIPEFY_TOKEN;
    if (!pipefyToken) throw new Error("PIPEFY_TOKEN não configurado no servidor.");

    const unidadeNome: string = (item as any).apuracao.unidade.nome_da_praca;
    const pipedriveDealId: string | number | null = (item as any).contrato?.pipedrive_deal_id ?? null;

    const mutation = `
      mutation($fields: [FieldValueInput!]) {
        createCard(input: {
          pipe_id: "${PIPEFY_PIPE_TRATATIVAS}"
          phase_id: "${PIPEFY_FASE_PERDIDO}"
          title: ${JSON.stringify(item.razao_social ?? "—")}
          fields_attributes: $fields
        }) { card { id } }
      }
    `;
    const fields = [
      { field_id: "unidade_de_neg_cio", field_value: [unidadeNome] },
      { field_id: "mrr_r", field_value: [String(item.mrr_contratado ?? 0)] },
      { field_id: "motivo_do_churn", field_value: [data.motivo.trim()] },
      { field_id: "data_do_churn", field_value: [data.data_churn] },
    ];
    // Link de volta pro deal do Pipedrive — é o que clientes.tsx usa pra cruzar
    // central_tratativas.pipedrive_deal_id com empresas.pipedrive_id e mostrar o
    // badge de churn. Sem isso o card fica órfão (Tratativas mostra, Clientes não).
    if (pipedriveDealId != null) {
      fields.push({ field_id: "id_deal_pipedrive", field_value: [String(pipedriveDealId)] });
    }
    const variables = { fields };

    const resp = await fetch("https://api.pipefy.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${pipefyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation, variables }),
    });
    const body = await resp.json();
    if (body.errors) throw new Error(`Pipefy: ${body.errors[0]?.message ?? "erro desconhecido"}`);
    const cardId: string = body.data.createCard.card.id;

    const churnReportadoEm = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("royalties_itens")
      .update({ churn_pipefy_card_id: cardId, churn_reportado_em: churnReportadoEm })
      .eq("id", data.item_id);
    if (uErr) throw new Error(uErr.message);

    // Propaga o churn pros itens do mesmo contrato em OUTRAS apurações (meses).
    // royalties_itens é gerado por apuração (uma linha por mês) — sem isso, marcar
    // churn só valeria pro mês em que o botão foi clicado, e o cliente continuaria
    // aparecendo pra apurar normalmente nos demais meses (inclusive meses passados
    // anteriores ao clique, mas posteriores à data do churn escolhida).
    const churnMonthStart = `${data.data_churn.slice(0, 7)}-01`;
    const { data: siblings, error: sErr } = await supabase
      .from("royalties_itens")
      .select("id, apuracao:royalties_apuracao!inner(status,mes_referencia)")
      .eq("contrato_id", item.contrato_id)
      .is("churn_pipefy_card_id", null)
      .neq("id", data.item_id);
    if (sErr) throw new Error(sErr.message);
    const idsParaPropagar = (siblings ?? [])
      .filter((s: any) => {
        const ap = s.apuracao;
        if (ap.status === "confirmado" || ap.status === "faturado") return false;
        return String(ap.mes_referencia) >= churnMonthStart;
      })
      .map((s: any) => s.id);
    if (idsParaPropagar.length > 0) {
      const { error: propErr } = await supabase
        .from("royalties_itens")
        .update({ churn_pipefy_card_id: cardId, churn_reportado_em: churnReportadoEm })
        .in("id", idsParaPropagar);
      if (propErr) throw new Error(propErr.message);
    }

    return { ok: true, pipefy_card_id: cardId };
  });

// ============ addItemManual ============
export const addItemManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      apuracao_id: number;
      razao_social: string;
      cnpj?: string | null;
      valor_confirmado?: number | null;
      observacao?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabase.from("royalties_itens").insert({
      apuracao_id: data.apuracao_id,
      razao_social: data.razao_social,
      cnpj: data.cnpj ? digits(data.cnpj) : null,
      valor_confirmado: data.valor_confirmado ?? null,
      observacao: data.observacao ?? null,
      categoria: "royalties",
      fonte: "manual",
      status_match: "manual",
      confirmado: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ updateApuracao ============
export const updateApuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: number;
      csc_trafego_pago?: number | null;
      outras_receitas?: number | null;
      observacao?: string | null;
      status?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const patch: any = {};
    if ("csc_trafego_pago" in data) patch.csc_trafego_pago = data.csc_trafego_pago;
    if ("outras_receitas" in data) patch.outras_receitas = data.outras_receitas;
    if ("observacao" in data) patch.observacao = data.observacao;
    if ("status" in data) patch.status = data.status;
    const { error } = await supabase.from("royalties_apuracao").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ fecharApuracao ============
export const fecharApuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await assertAdmin(supabase, userId);

    const { data: ap, error: apErr } = await supabase
      .from("royalties_apuracao")
      .select(
        "id,status,royalties_percentual,csc_valor_fixo,csc_percentual_base_antiga,outras_receitas",
      )
      .eq("id", data.id)
      .single();
    if (apErr) throw new Error(apErr.message);
    if (ap.status === "confirmado" || ap.status === "faturado") {
      throw new Error("Apuração já está fechada.");
    }

    const { data: itens, error: iErr } = await supabase
      .from("royalties_itens")
      .select("categoria,valor_confirmado,royalties_percentual_override,confirmado")
      .eq("apuracao_id", data.id);
    if (iErr) throw new Error(iErr.message);

    const confirmados = (itens ?? []).filter((x: any) => x.confirmado);
    if (confirmados.length === 0) throw new Error("Confirme ao menos 1 item antes de fechar.");

    const pctPadrao = Number(ap.royalties_percentual ?? 0);
    let receitaBase = 0;
    let royalties = 0;
    let receitaBaseAntiga = 0;
    for (const it of confirmados as any[]) {
      const v = Number(it.valor_confirmado ?? 0);
      if (it.categoria === "royalties") {
        receitaBase += v;
        const pct = it.royalties_percentual_override != null
          ? Number(it.royalties_percentual_override)
          : pctPadrao;
        royalties += (v * pct) / 100;
      } else if (it.categoria === "csc_base_antiga") {
        receitaBaseAntiga += v;
      }
    }
    const cscPctBaseAntiga = Number(ap.csc_percentual_base_antiga ?? 0);
    const cscBaseAntigaValor = (receitaBaseAntiga * cscPctBaseAntiga) / 100;
    const cscFixo = ap.csc_valor_fixo != null ? Number(ap.csc_valor_fixo) : null;
    const cscEfetivo = cscFixo ?? (ap.csc_percentual_base_antiga != null ? cscBaseAntigaValor : 0);
    const outras = Number(ap.outras_receitas ?? 0);
    const total = cscEfetivo + royalties + outras;

    // Atualizar royalties_item por item (em paralelo para evitar estado parcial)
    const { data: itensFull, error: itensFullErr } = await supabase
      .from("royalties_itens")
      .select("id,categoria,valor_confirmado,royalties_percentual_override,confirmado")
      .eq("apuracao_id", data.id);
    if (itensFullErr) throw new Error(itensFullErr.message);

    const updates = (itensFull ?? [])
      .filter((it: any) => it.categoria === "royalties")
      .map((it: any) => {
        const v = Number(it.valor_confirmado ?? 0);
        const pct = it.royalties_percentual_override != null
          ? Number(it.royalties_percentual_override)
          : pctPadrao;
        const rv = it.confirmado ? (v * pct) / 100 : 0;
        return supabase.from("royalties_itens").update({ royalties_item: rv }).eq("id", it.id);
      });
    const results = await Promise.all(updates);
    const failed = results.find((r: any) => r?.error);
    if (failed?.error) throw new Error(`Falha ao atualizar itens: ${failed.error.message}`);


    const email = (claims as any)?.email ?? null;
    const { error: uErr } = await supabase
      .from("royalties_apuracao")
      .update({
        status: "confirmado",
        receita_base: receitaBase,
        royalties_valor: royalties,
        receita_base_antiga: receitaBaseAntiga,
        csc_base_antiga_valor: ap.csc_percentual_base_antiga != null ? cscBaseAntigaValor : null,
        total_fatura: total,
        confirmado_em: new Date().toISOString(),
        confirmado_por: email ?? userId,
      })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

// ============ reabrirApuracao ============
export const reabrirApuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("royalties_apuracao")
      .update({ status: "em_revisao", confirmado_em: null, confirmado_por: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ deleteItem ============
export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: item, error: e1 } = await supabase
      .from("royalties_itens")
      .select("apuracao:royalties_apuracao!inner(status)")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    const status = (item as any).apuracao.status;
    if (status === "confirmado" || status === "faturado") {
      throw new Error("Apuração fechada — reabra antes de excluir.");
    }
    const { error } = await supabase.from("royalties_itens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
