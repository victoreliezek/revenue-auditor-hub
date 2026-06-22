
ALTER TABLE public.despesas_cm_overrides ADD COLUMN IF NOT EXISTS observacao text;

DROP VIEW IF EXISTS public.v_confronto_cm CASCADE;
DROP VIEW IF EXISTS public.despesas_cm CASCADE;
DROP VIEW IF EXISTS public.v_despesas_cm_mes CASCADE;

CREATE VIEW public.v_despesas_cm_mes AS
SELECT o.id AS override_id,
    f.id AS fornecedor_id,
    o.mes,
    f.nome AS fornecedor,
    f.categoria,
    f.departamento,
    f.funcao,
    f.tipo,
    f.valor_base,
    COALESCE(o.valor,
        CASE WHEN f.tipo = 'fixo'::text THEN f.valor_base ELSE NULL::numeric END) AS valor_total,
    o.valor IS NOT NULL AND o.valor IS DISTINCT FROM f.valor_base AS tem_override,
    o.status,
    o.codigo_omie,
    o.valor_pago,
    o.data_pagamento,
    o.observacao,
    o.inativo_no_mes,
    COALESCE(crit.tipo_rateio, f.rateio_regra, 'padrao'::text) AS rateio_regra,
    COALESCE(crit.bu_direto, f.rateio_bu_direto) AS rateio_bu_direto,
    COALESCE(crit.percentuais_custom, f.rateio_custom) AS rateio_custom,
    'recorrente'::text AS origem
   FROM public.despesas_cm_overrides o
     JOIN public.despesas_cm_fornecedores f ON f.id = o.fornecedor_id
     LEFT JOIN public.criterios_rateio_cm crit ON crit.ativo = true AND lower(btrim(crit.fornecedor)) = lower(btrim(f.nome))
  WHERE NOT o.inativo_no_mes
UNION ALL
 SELECT NULL::bigint AS override_id,
    NULL::bigint AS fornecedor_id,
    a.mes,
    a.fornecedor,
    a.categoria,
    a.departamento,
    NULL::text AS funcao,
    'pontual'::text AS tipo,
    NULL::numeric AS valor_base,
    a.valor_total,
    false AS tem_override,
    a.status,
    a.codigo_omie,
    a.valor_pago,
    a.data_pagamento,
    a.observacao,
    false AS inativo_no_mes,
    COALESCE(crit.tipo_rateio, a.rateio_regra, 'padrao'::text) AS rateio_regra,
    COALESCE(crit.bu_direto, a.rateio_bu_direto) AS rateio_bu_direto,
    COALESCE(crit.percentuais_custom, a.rateio_custom) AS rateio_custom,
    'avulso'::text AS origem
   FROM public.despesas_cm_avulsos a
     LEFT JOIN public.criterios_rateio_cm crit ON crit.ativo = true AND lower(btrim(crit.fornecedor)) = lower(btrim(a.fornecedor));

CREATE VIEW public.despesas_cm AS
SELECT
        CASE
            WHEN origem = 'recorrente'::text THEN override_id
            ELSE '-1'::integer * COALESCE(( SELECT a.id
               FROM public.despesas_cm_avulsos a
              WHERE a.mes = m.mes AND a.fornecedor = m.fornecedor
             LIMIT 1), 0::bigint)
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
    observacao,
    COALESCE(categoria, ''::text) AS categoria
   FROM public.v_despesas_cm_mes m
  WHERE valor_total IS NOT NULL AND valor_total > 0::numeric;

CREATE VIEW public.v_confronto_cm AS
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
    origem
   FROM public.despesas_cm
  ORDER BY mes DESC, fornecedor;

GRANT SELECT ON public.v_despesas_cm_mes TO anon, authenticated, service_role;
GRANT SELECT ON public.despesas_cm TO anon, authenticated, service_role;
GRANT SELECT ON public.v_confronto_cm TO anon, authenticated, service_role;
