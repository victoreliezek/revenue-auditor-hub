
-- 1) Drop legacy table and the confronto view (which depends on it)
DROP VIEW IF EXISTS public.v_confronto_cm;
DROP TABLE IF EXISTS public.despesas_cm;

-- 2) Recreate despesas_cm as a view over the unified catalog source
CREATE VIEW public.despesas_cm AS
SELECT
  -- stable surrogate id (overrides have positive ids; avulsos get negative ids)
  CASE WHEN m.origem = 'recorrente' THEN m.override_id
       ELSE -1 * COALESCE((SELECT a.id FROM public.despesas_cm_avulsos a
                            WHERE a.mes = m.mes AND a.fornecedor = m.fornecedor
                            LIMIT 1), 0)
  END AS id,
  m.mes,
  m.fornecedor,
  COALESCE(m.tipo, '')                       AS tipo_despesa,
  COALESCE(m.departamento, '')               AS dpto,
  COALESCE(m.valor_total, 0)::numeric        AS valor_total,
  m.valor_pago,
  m.status,
  m.data_pagamento,
  m.codigo_omie,
  m.origem
FROM public.v_despesas_cm_mes m
WHERE m.valor_total IS NOT NULL AND m.valor_total > 0;

GRANT SELECT ON public.despesas_cm TO authenticated;
GRANT SELECT ON public.despesas_cm TO service_role;

-- 3) Recreate v_confronto_cm using the unified source
CREATE VIEW public.v_confronto_cm AS
SELECT
  mes,
  fornecedor,
  tipo_despesa,
  dpto,
  valor_total       AS valor_planejado,
  valor_pago        AS valor_realizado,
  data_pagamento,
  status,
  CASE
    WHEN valor_pago IS NULL THEN 'aguardando_pagamento'
    WHEN abs(valor_pago - valor_total) < 0.05 THEN 'ok'
    WHEN valor_pago > valor_total THEN 'pago_a_maior'
    ELSE 'pago_a_menor'
  END AS resultado,
  (COALESCE(valor_pago, 0) - valor_total) AS diferenca
FROM public.despesas_cm
ORDER BY mes DESC, fornecedor;

GRANT SELECT ON public.v_confronto_cm TO authenticated;
GRANT SELECT ON public.v_confronto_cm TO service_role;
