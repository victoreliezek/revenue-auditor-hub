
CREATE OR REPLACE VIEW public.v_confronto_cm AS
SELECT mes,
    fornecedor,
    tipo_despesa,
    dpto,
    valor_total AS valor_planejado,
    valor_pago AS valor_realizado,
    data_pagamento,
    status,
    CASE
        WHEN valor_pago IS NULL THEN 'aguardando_pagamento'::text
        WHEN abs(valor_pago - valor_total) < 0.05 THEN 'ok'::text
        WHEN valor_pago > valor_total THEN 'pago_a_maior'::text
        ELSE 'pago_a_menor'::text
    END AS resultado,
    COALESCE(valor_pago, 0::numeric) - valor_total AS diferenca,
    observacao,
    categoria,
    origem,
    apuracao_status,
    motivo_contestacao,
    origem_apuracao
   FROM despesas_cm
  ORDER BY mes DESC, fornecedor;
