import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TipoRepasse = "royalties" | "cac";

export interface RepasseRow {
  id: string;
  unidade: string;
  competencia: string; // YYYY-MM-DD (primeiro dia do mês)
  tipo: TipoRepasse;
  valor_recebido: number;
  observacao: string | null;
  origem: string;
  arquivo_nome: string | null;
}

async function assertCanManage(supabase: any) {
  const { data, error } = await supabase.rpc("can", { _key: "manage.repasses" });
  if (error) throw new Error("Erro de autorização.");
  if (!data) throw new Error("Acesso negado: você não pode lançar repasses.");
}

export const listarRepasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tipo: TipoRepasse }) => {
    if (input.tipo !== "royalties" && input.tipo !== "cac") throw new Error("Tipo inválido.");
    return { tipo: input.tipo };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("repasses_unidade")
      .select("id, unidade, competencia, tipo, valor_recebido, observacao, origem, arquivo_nome")
      .eq("tipo", data.tipo)
      .order("competencia", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as RepasseRow[] };
  });

export const lancarRepasseManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    unidade: string;
    competencia: string; // YYYY-MM-DD
    tipo: TipoRepasse;
    valor: number;
    observacao?: string;
  }) => {
    const unidade = (input.unidade ?? "").trim();
    if (!unidade) throw new Error("Unidade obrigatória.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.competencia)) throw new Error("Competência inválida.");
    if (input.tipo !== "royalties" && input.tipo !== "cac") throw new Error("Tipo inválido.");
    const valor = Number(input.valor);
    if (!Number.isFinite(valor) || valor < 0) throw new Error("Valor inválido.");
    return {
      unidade,
      competencia: input.competencia,
      tipo: input.tipo,
      valor,
      observacao: (input.observacao ?? "").trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("repasses_unidade").upsert(
      {
        unidade: data.unidade,
        competencia: data.competencia,
        tipo: data.tipo,
        valor_recebido: data.valor,
        observacao: data.observacao,
        origem: "manual",
        created_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "unidade,competencia,tipo" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importarRepasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    tipo: TipoRepasse;
    competencia: string;
    arquivo_nome?: string;
    linhas: { unidade: string; valor: number }[];
  }) => {
    if (input.tipo !== "royalties" && input.tipo !== "cac") throw new Error("Tipo inválido.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.competencia)) throw new Error("Competência inválida.");
    if (!Array.isArray(input.linhas) || input.linhas.length === 0) throw new Error("Nenhuma linha para importar.");
    const linhas = input.linhas
      .map((l) => ({ unidade: (l.unidade ?? "").trim(), valor: Number(l.valor) }))
      .filter((l) => l.unidade && Number.isFinite(l.valor) && l.valor >= 0);
    if (linhas.length === 0) throw new Error("Nenhuma linha válida.");
    return {
      tipo: input.tipo,
      competencia: input.competencia,
      arquivo_nome: (input.arquivo_nome ?? "").trim() || null,
      linhas,
    };
  })
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const payload = data.linhas.map((l) => ({
      unidade: l.unidade,
      competencia: data.competencia,
      tipo: data.tipo,
      valor_recebido: l.valor,
      origem: "upload",
      arquivo_nome: data.arquivo_nome,
      created_by: context.userId,
      updated_at: now,
    }));
    const { error, count } = await supabaseAdmin
      .from("repasses_unidade")
      .upsert(payload, { onConflict: "unidade,competencia,tipo", count: "exact" });
    if (error) throw new Error(error.message);
    return { ok: true, total: count ?? payload.length };
  });

export const excluirRepasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input.id) throw new Error("ID obrigatório.");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("repasses_unidade").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
