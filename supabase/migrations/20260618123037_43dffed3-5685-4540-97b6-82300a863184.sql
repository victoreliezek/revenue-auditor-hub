CREATE OR REPLACE VIEW public.v_despesas_cm_mes AS
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
    (o.valor IS NOT NULL AND o.valor IS DISTINCT FROM f.valor_base) AS tem_override,
    o.status,
    o.codigo_omie,
    o.valor_pago,
    o.data_pagamento,
    o.inativo_no_mes,
    COALESCE(crit.tipo_rateio, f.rateio_regra, 'padrao') AS rateio_regra,
    COALESCE(crit.bu_direto, f.rateio_bu_direto) AS rateio_bu_direto,
    COALESCE(crit.percentuais_custom, f.rateio_custom) AS rateio_custom,
    'recorrente'::text AS origem
FROM despesas_cm_overrides o
JOIN despesas_cm_fornecedores f ON f.id = o.fornecedor_id
LEFT JOIN criterios_rateio_cm crit
    ON crit.ativo = true
   AND lower(btrim(crit.fornecedor)) = lower(btrim(f.nome))
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
    false AS inativo_no_mes,
    COALESCE(crit.tipo_rateio, a.rateio_regra, 'padrao') AS rateio_regra,
    COALESCE(crit.bu_direto, a.rateio_bu_direto) AS rateio_bu_direto,
    COALESCE(crit.percentuais_custom, a.rateio_custom) AS rateio_custom,
    'avulso'::text AS origem
FROM despesas_cm_avulsos a
LEFT JOIN criterios_rateio_cm crit
    ON crit.ativo = true
   AND lower(btrim(crit.fornecedor)) = lower(btrim(a.fornecedor));

ALTER VIEW public.v_despesas_cm_mes SET (security_invoker = on);