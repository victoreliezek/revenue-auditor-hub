
-- Apuração mensal: status de revisão financeira nas despesas avulsas
ALTER TABLE public.despesas_cm_avulsos
  ADD COLUMN IF NOT EXISTS apuracao_status text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS motivo_contestacao text NULL,
  ADD COLUMN IF NOT EXISTS origem_apuracao text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS importado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS importado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS revisado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS importacao_lote text NULL;

ALTER TABLE public.despesas_cm_avulsos
  DROP CONSTRAINT IF EXISTS despesas_cm_avulsos_apuracao_status_chk;
ALTER TABLE public.despesas_cm_avulsos
  ADD CONSTRAINT despesas_cm_avulsos_apuracao_status_chk
  CHECK (apuracao_status IN ('pendente','aprovado','contestado'));

ALTER TABLE public.despesas_cm_avulsos
  DROP CONSTRAINT IF EXISTS despesas_cm_avulsos_origem_apuracao_chk;
ALTER TABLE public.despesas_cm_avulsos
  ADD CONSTRAINT despesas_cm_avulsos_origem_apuracao_chk
  CHECK (origem_apuracao IN ('manual','financeiro-mensal'));

CREATE INDEX IF NOT EXISTS idx_despesas_cm_avulsos_mes_apuracao
  ON public.despesas_cm_avulsos (mes, apuracao_status);

-- Recriar view expondo as novas colunas (overrides ficam como 'aprovado' por padrão)
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
        CASE WHEN f.tipo = 'fixo'::text THEN f.valor_base ELSE NULL::numeric END
    ) AS valor_total,
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
    'recorrente'::text AS origem,
    'aprovado'::text AS apuracao_status,
    NULL::text AS motivo_contestacao,
    'manual'::text AS origem_apuracao
   FROM despesas_cm_overrides o
     JOIN despesas_cm_fornecedores f ON f.id = o.fornecedor_id
     LEFT JOIN criterios_rateio_cm crit ON crit.ativo = true AND lower(btrim(crit.fornecedor)) = lower(btrim(f.nome))
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
    'avulso'::text AS origem,
    a.apuracao_status,
    a.motivo_contestacao,
    a.origem_apuracao
   FROM despesas_cm_avulsos a
     LEFT JOIN criterios_rateio_cm crit ON crit.ativo = true AND lower(btrim(crit.fornecedor)) = lower(btrim(a.fornecedor));

-- Recriar despesas_cm para expor as colunas de apuração
CREATE OR REPLACE VIEW public.despesas_cm AS
SELECT
    CASE WHEN origem = 'recorrente'::text THEN override_id
         ELSE '-1'::integer * COALESCE(( SELECT a.id FROM despesas_cm_avulsos a
                                          WHERE a.mes = m.mes AND a.fornecedor = m.fornecedor LIMIT 1), 0::bigint)
    END AS id,
    mes, fornecedor,
    COALESCE(tipo, ''::text) AS tipo_despesa,
    COALESCE(departamento, ''::text) AS dpto,
    COALESCE(valor_total, 0::numeric) AS valor_total,
    valor_pago, status, data_pagamento, codigo_omie, origem, observacao,
    COALESCE(categoria, ''::text) AS categoria,
    apuracao_status, motivo_contestacao, origem_apuracao
FROM v_despesas_cm_mes m
WHERE valor_total IS NOT NULL AND valor_total > 0::numeric;
