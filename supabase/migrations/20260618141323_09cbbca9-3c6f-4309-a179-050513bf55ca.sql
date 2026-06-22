DROP VIEW IF EXISTS public.v_confronto_cm;
DROP VIEW IF EXISTS public.despesas_cm;

CREATE VIEW public.despesas_cm AS
SELECT
  CASE
    WHEN origem = 'recorrente'::text THEN override_id
    ELSE '-1'::integer * COALESCE((SELECT a.id FROM despesas_cm_avulsos a WHERE a.mes = m.mes AND a.fornecedor = m.fornecedor LIMIT 1), 0::bigint)
  END AS id,
  mes,
  fornecedor,
  COALESCE(tipo, ''::text) AS tipo_despesa,
  COALESCE(departamento, ''::text) AS dpto,
  COALESCE(valor_total, 0::numeric) AS valor_total,
  valor_pago,
  status,
  data_pagamento,
  codigo_omie,
  origem,
  COALESCE(categoria, ''::text) AS categoria
FROM v_despesas_cm_mes m
WHERE valor_total IS NOT NULL AND valor_total > 0::numeric;

CREATE VIEW public.v_confronto_cm AS
SELECT
  mes,
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
  categoria
FROM despesas_cm
ORDER BY mes DESC, fornecedor;

GRANT SELECT ON public.despesas_cm TO authenticated, anon, service_role;
GRANT SELECT ON public.v_confronto_cm TO authenticated, anon, service_role;