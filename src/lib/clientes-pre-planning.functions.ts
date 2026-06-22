import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PrePlanningCliente {
  id: number | null;
  codigo_omie: number | null;
  unidade: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj_cpf: string | null;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  telefone: string | null;
  pessoa_fisica: boolean | null;
  synced_at: string | null;
  honorario: number | null;
  ultimo_pagamento: string | null;
}

export const listClientesPrePlanning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: PrePlanningCliente[] }> => {
    const { supabase } = context;
    const pageSize = 1000;
    let from = 0;
    const all: PrePlanningCliente[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("omie_clientes")
        .select(
          "codigo_omie,unidade,razao_social,nome_fantasia,cnpj_cpf,cidade,estado,email,updated_at",
        )
        .order("unidade", { ascending: true })
        .order("razao_social", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{
        codigo_omie: number | null;
        unidade: string | null;
        razao_social: string | null;
        nome_fantasia: string | null;
        cnpj_cpf: string | null;
        cidade: string | null;
        estado: string | null;
        email: string | null;
        updated_at: string | null;
      }>;
      const batch: PrePlanningCliente[] = rows.map((r) => ({
        id: r.codigo_omie,
        codigo_omie: r.codigo_omie,
        unidade: r.unidade,
        razao_social: r.razao_social,
        nome_fantasia: r.nome_fantasia,
        cnpj_cpf: r.cnpj_cpf,
        cidade: r.cidade,
        estado: r.estado,
        email: r.email,
        telefone: null,
        pessoa_fisica: null,
        synced_at: r.updated_at,
        honorario: null,
        ultimo_pagamento: null,
      }));
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return { rows: all };
  });
