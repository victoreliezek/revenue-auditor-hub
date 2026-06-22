import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, digits, monthRange } from "@/lib/server-utils";


export interface FilialVinculada {
  id: number;
  contrato_id: number;
  cpf_cnpj: string;
  razao_social: string | null;
  unidade: string | null;
  criado_em: string;
  criado_por: string | null;
  valor_recebido_mes: number;
}

export interface FilialDisponivel {
  cpf_cnpj: string;
  razao_social: string;
  valor_recebido: number;
}

async function loadApuracaoContext(supabase: any, apuracao_id: number) {
  const { data: ap, error } = await supabase
    .from("royalties_apuracao")
    .select("id,mes_referencia,unidade:unidades!inner(id,nome_da_praca)")
    .eq("id", apuracao_id)
    .single();
  if (error) throw new Error(error.message);
  const mes = String(ap.mes_referencia).slice(0, 7);
  return {
    mes,
    unidade: ap.unidade.nome_da_praca as string,
    ...monthRange(mes),
  };
}

// ============ listGruposByContrato ============
export const listGruposByContrato = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apuracao_id: number; contrato_id: number }) => d)
  .handler(async ({ data, context }): Promise<{ filiais: FilialVinculada[] }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const ctx = await loadApuracaoContext(supabase, data.apuracao_id);

    const { data: vinc, error } = await supabase
      .from("contrato_omie_grupos")
      .select("*")
      .eq("contrato_id", data.contrato_id)
      .order("razao_social");
    if (error) throw new Error(error.message);

    if (!vinc || vinc.length === 0) return { filiais: [] };

    const cnpjs = vinc.map((v: any) => v.cpf_cnpj);
    const { data: recs, error: rErr } = await supabase
      .from("contas_receber")
      .select("cpf_cnpj,valor")
      .eq("unidade", ctx.unidade)
      .eq("status_pagamento", "RECEBIDO")
      .gte("data_pagamento", ctx.start)
      .lte("data_pagamento", ctx.end)
      .in("cpf_cnpj", cnpjs);
    if (rErr) throw new Error(rErr.message);

    const totals = new Map<string, number>();
    for (const r of recs ?? []) {
      const k = digits(r.cpf_cnpj);
      totals.set(k, (totals.get(k) ?? 0) + Number(r.valor ?? 0));
    }

    return {
      filiais: vinc.map((v: any) => ({
        ...v,
        valor_recebido_mes: totals.get(digits(v.cpf_cnpj)) ?? 0,
      })),
    };
  });

// ============ listFiliaisDisponiveis ============
export const listFiliaisDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apuracao_id: number; q?: string }) => d)
  .handler(async ({ data, context }): Promise<{ disponiveis: FilialDisponivel[] }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const ctx = await loadApuracaoContext(supabase, data.apuracao_id);

    const { data: recs, error: rErr } = await supabase
      .from("contas_receber")
      .select("cpf_cnpj,cliente,valor")
      .eq("unidade", ctx.unidade)
      .eq("status_pagamento", "RECEBIDO")
      .gte("data_pagamento", ctx.start)
      .lte("data_pagamento", ctx.end);
    if (rErr) throw new Error(rErr.message);

    const omieAgg = new Map<string, { cnpj: string; cliente: string; valor: number }>();
    for (const r of recs ?? []) {
      const k = digits(r.cpf_cnpj);
      if (!k) continue;
      const cur = omieAgg.get(k) ?? { cnpj: k, cliente: r.cliente ?? "—", valor: 0 };
      cur.valor += Number(r.valor ?? 0);
      omieAgg.set(k, cur);
    }
    if (omieAgg.size === 0) return { disponiveis: [] };

    // Exclui CNPJs já vinculados (qualquer contrato)
    const { data: jaVinc, error: vErr } = await supabase
      .from("contrato_omie_grupos")
      .select("cpf_cnpj");
    if (vErr) throw new Error(vErr.message);
    for (const v of jaVinc ?? []) omieAgg.delete(digits(v.cpf_cnpj));

    // Exclui CNPJs principais de contratos ativos da unidade
    const { data: contratos, error: cErr } = await supabase
      .from("contratos")
      .select("cnpj")
      .eq("unidade", ctx.unidade)
      .eq("status_contrato", "Ativo")
      .not("cnpj", "is", null);
    if (cErr) throw new Error(cErr.message);
    for (const c of contratos ?? []) omieAgg.delete(digits(c.cnpj));

    const term = (data.q ?? "").trim().toLowerCase();
    let list = Array.from(omieAgg.values());
    if (term) {
      list = list.filter(
        (x) => x.cnpj.includes(term.replace(/\D+/g, "")) || x.cliente.toLowerCase().includes(term),
      );
    }
    list.sort((a, b) => b.valor - a.valor);

    return {
      disponiveis: list.map((x) => ({
        cpf_cnpj: x.cnpj,
        razao_social: x.cliente,
        valor_recebido: x.valor,
      })),
    };
  });

// ============ addFiliais ============
export const addFiliais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      contrato_id: number;
      unidade: string;
      filiais: { cpf_cnpj: string; razao_social: string }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await assertAdmin(supabase, userId);

    const email = (claims as any)?.email ?? userId;
    const rows = data.filiais
      .map((f) => ({
        contrato_id: data.contrato_id,
        cpf_cnpj: digits(f.cpf_cnpj),
        razao_social: f.razao_social,
        unidade: data.unidade,
        criado_por: email,
      }))
      .filter((r) => r.cpf_cnpj.length === 14 || r.cpf_cnpj.length === 11);
    if (rows.length === 0) return { inserted: 0 };

    const { error } = await supabase.from("contrato_omie_grupos").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

// ============ removeFilial ============
export const removeFilial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("contrato_omie_grupos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ regerarMatchApuracao ============
// Remove itens automáticos (não confirmados, não-manuais) e força regeneração.
export const regerarMatchApuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apuracao_id: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: ap, error: apErr } = await supabase
      .from("royalties_apuracao")
      .select("status")
      .eq("id", data.apuracao_id)
      .single();
    if (apErr) throw new Error(apErr.message);
    if (ap.status === "confirmado" || ap.status === "faturado") {
      throw new Error("Apuração fechada — reabra antes de regerar.");
    }

    const { error: dErr } = await supabase
      .from("royalties_itens")
      .delete()
      .eq("apuracao_id", data.apuracao_id)
      .in("fonte", ["pipedrive", "omie"])
      .eq("confirmado", false);
    if (dErr) throw new Error(dErr.message);

    return { ok: true };
  });
