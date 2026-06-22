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
    let from = 0;
    const all: ContaReceber[] = [];
    // paginate to bypass the 1000-row default cap
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("contas_receber")
        .select(
          "id,num_documento,data_vencimento,data_competencia,data_pagamento,status_pagamento,valor,cliente,cpf_cnpj,unidade,codigo_omie",
        )
        .order("data_vencimento", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as ContaReceber[];
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return { rows: all };
  });
