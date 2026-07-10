import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ContaReceber {
  id: number;
  num_documento: string | null;
  data_vencimento: string | null;
  data_competencia: string | null;
  data_pagamento: string | null;
  status_pagamento: string | null;
  valor: number | null;
  cliente: string | null;
  cpf_cnpj: string | null;
  unidade: string | null;
  codigo_omie: number | null;
}

export const listContasReceber = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: ContaReceber[] }> => {
    const { supabase } = context;
    const pageSize = 1000;

    // Busca o total primeiro pra saber quantas páginas existem, depois dispara
    // todas em paralelo — com a tabela em ~29 mil linhas, buscar em série (30
    // requisições sequenciais) passa de 15s e estoura o timeout da function.
    const { count, error: countErr } = await supabase
      .from("contas_receber")
      .select("id", { count: "exact", head: true });
    if (countErr) throw new Error(countErr.message);

    const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
    const pagePromises = Array.from({ length: totalPages }, (_, i) => {
      const from = i * pageSize;
      return supabase
        .from("contas_receber")
        .select(
          "id,num_documento,data_vencimento,data_competencia,data_pagamento,status_pagamento,valor,cliente,cpf_cnpj,unidade,codigo_omie",
        )
        .order("data_vencimento", { ascending: false })
        .range(from, from + pageSize - 1);
    });

    const results = await Promise.all(pagePromises);
    const all: ContaReceber[] = [];
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      all.push(...((data ?? []) as ContaReceber[]));
    }
    return { rows: all };
  });
