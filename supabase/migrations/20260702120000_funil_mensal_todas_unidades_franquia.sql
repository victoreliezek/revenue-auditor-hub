-- v_funil_mensal antes: só listava (unidade, mês) quando havia fatura em contas_receber
-- naquele mês, então unidades sem sync/emissão de fatura no Omie sumiam do filtro por completo
-- (mesmo tendo contrato ativo). Também misturava unidade=matriz/segmento (Agronegócio,
-- Construção Civil, Consultoria, Matriz) com franquias reais no mesmo total.
--
-- Agora: base é sempre o conjunto de unidades franquia com contrato ativo × todos os
-- meses observados em contas_receber (+ mês corrente), com LEFT JOIN para faturamento.
-- Unidades sem fatura no mês aparecem com faturado/recebido = 0 (badge "Sem dados no Omie").

CREATE OR REPLACE VIEW public.v_funil_mensal AS
WITH mrr_snap AS (
  SELECT contratos.unidade,
         count(*) AS contratos_ativos,
         sum(contratos.mrr / 12::numeric) AS mrr
  FROM contratos
  WHERE contratos.status_contrato = 'Ativo'::text
    AND contratos.unidade IS NOT NULL
    AND contratos.tipo_unidade = 'franquia'::text
  GROUP BY contratos.unidade
),
meses AS (
  SELECT DISTINCT date_trunc('month'::text, contas_receber.data_competencia::timestamp with time zone) AS mes
  FROM contas_receber
  UNION
  SELECT date_trunc('month'::text, now())
),
fat AS (
  SELECT contas_receber.unidade,
         date_trunc('month'::text, contas_receber.data_competencia::timestamp with time zone) AS mes,
         sum(CASE WHEN contas_receber.status_pagamento <> 'CANCELADO'::text THEN contas_receber.valor ELSE 0::numeric END) AS faturado,
         sum(CASE WHEN contas_receber.status_pagamento = 'RECEBIDO'::text THEN contas_receber.valor ELSE 0::numeric END) AS recebido,
         count(CASE WHEN contas_receber.status_pagamento <> 'CANCELADO'::text THEN 1 ELSE NULL::integer END) AS num_faturas,
         count(CASE WHEN contas_receber.status_pagamento = 'RECEBIDO'::text THEN 1 ELSE NULL::integer END) AS num_recebidos
  FROM contas_receber
  GROUP BY contas_receber.unidade, (date_trunc('month'::text, contas_receber.data_competencia::timestamp with time zone))
),
base AS (
  SELECT m.unidade, mo.mes
  FROM mrr_snap m
  CROSS JOIN meses mo
)
SELECT
  b.mes,
  b.unidade,
  m.contratos_ativos,
  round(m.mrr, 2) AS mrr_contratado,
  round(COALESCE(f.faturado, 0::numeric), 2) AS faturado,
  COALESCE(f.num_faturas, 0::bigint) AS faturas_emitidas,
  round(COALESCE(f.recebido, 0::numeric), 2) AS recebido,
  COALESCE(f.num_recebidos, 0::bigint) AS faturas_recebidas,
  CASE WHEN m.mrr > 0::numeric THEN round(COALESCE(f.faturado, 0::numeric) / m.mrr * 100::numeric, 1) ELSE NULL::numeric END AS conv_mrr_to_faturado_pct,
  CASE WHEN COALESCE(f.faturado, 0::numeric) > 0::numeric THEN round(COALESCE(f.recebido, 0::numeric) / f.faturado * 100::numeric, 1) ELSE NULL::numeric END AS conv_faturado_to_recebido_pct,
  CASE WHEN m.mrr > 0::numeric THEN round(COALESCE(f.recebido, 0::numeric) / m.mrr * 100::numeric, 1) ELSE NULL::numeric END AS conv_mrr_to_recebido_pct
FROM base b
JOIN mrr_snap m ON b.unidade = m.unidade
LEFT JOIN fat f ON f.unidade = b.unidade AND f.mes = b.mes
ORDER BY b.mes DESC, b.unidade;

ALTER VIEW public.v_funil_mensal SET (security_invoker = true);
