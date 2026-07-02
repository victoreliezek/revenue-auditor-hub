-- v_reconciliacao_mensal e v_royalties_mensais tinham o mesmo problema já corrigido em
-- v_funil_mensal (20260702120000 / 20260702130000): eram construídas a partir de
-- contas_receber (Omie) via JOIN, então uma unidade só aparecia num mês se tivesse
-- fatura lançada naquele mês. Fortaleza, Maceió e São Luís (sem integração Omie) nunca
-- apareciam; e o "último mês" usado no card "Receita Recorrente" do Overview somava só
-- as 2-3 unidades que por acaso já tinham fatura sincronizada naquele momento, dando um
-- MRR muito abaixo do real (ex.: R$434k em vez de R$912k).
--
-- Agora ambas partem sempre das 8 unidades regionais (tabela `unidades`, tipo='regional')
-- × todos os meses observados em contas_receber, com LEFT JOIN para faturamento/royalties.
-- Unidade sem fatura no mês aparece com faturado/recebido = 0 em vez de sumir.

CREATE OR REPLACE VIEW public.v_reconciliacao_mensal AS
WITH mrr_unidade AS (
  SELECT contratos.unidade,
         count(*) AS num_contratos,
         sum(contratos.mrr / 12::numeric) AS mrr
  FROM contratos
  JOIN unidades ON unidades.nome_da_praca = contratos.unidade AND unidades.tipo = 'regional'::text
  WHERE contratos.status_contrato = 'Ativo'::text AND contratos.unidade IS NOT NULL
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
         count(CASE WHEN contas_receber.status_pagamento = 'RECEBIDO'::text THEN 1 ELSE NULL::integer END) AS num_recebidos,
         sum(CASE WHEN contas_receber.status_pagamento = ANY (ARRAY['A VENCER'::text, 'VENCE HOJE'::text]) THEN contas_receber.valor ELSE 0::numeric END) AS a_vencer,
         sum(CASE WHEN contas_receber.status_pagamento = 'ATRASADO'::text THEN contas_receber.valor ELSE 0::numeric END) AS em_atraso
  FROM contas_receber
  GROUP BY contas_receber.unidade, (date_trunc('month'::text, contas_receber.data_competencia::timestamp with time zone))
),
base AS (
  SELECT m.unidade, mo.mes
  FROM mrr_unidade m
  CROSS JOIN meses mo
)
SELECT
  b.mes,
  b.unidade,
  m.num_contratos,
  round(m.mrr, 2) AS mrr_contratado,
  round(COALESCE(f.faturado, 0::numeric), 2) AS faturado,
  round(COALESCE(f.recebido, 0::numeric), 2) AS recebido,
  round(COALESCE(f.a_vencer, 0::numeric), 2) AS a_vencer,
  round(COALESCE(f.em_atraso, 0::numeric), 2) AS em_atraso,
  COALESCE(f.num_faturas, 0::bigint) AS num_faturas,
  COALESCE(f.num_recebidos, 0::bigint) AS num_recebidos,
  CASE WHEN m.mrr > 0::numeric THEN round(COALESCE(f.faturado, 0::numeric) / m.mrr * 100::numeric, 1) ELSE NULL::numeric END AS pct_faturado_vs_mrr,
  CASE WHEN COALESCE(f.faturado, 0::numeric) > 0::numeric THEN round(COALESCE(f.recebido, 0::numeric) / f.faturado * 100::numeric, 1) ELSE NULL::numeric END AS pct_recebido_vs_faturado
FROM base b
JOIN mrr_unidade m ON b.unidade = m.unidade
LEFT JOIN fat f ON f.unidade = b.unidade AND f.mes = b.mes
ORDER BY b.mes DESC, b.unidade;

ALTER VIEW public.v_reconciliacao_mensal SET (security_invoker = true);

CREATE OR REPLACE VIEW public.v_royalties_mensais AS
WITH meses AS (
  SELECT DISTINCT date_trunc('month'::text, contas_receber.data_competencia::timestamp with time zone) AS mes
  FROM contas_receber
  UNION
  SELECT date_trunc('month'::text, now())
),
base AS (
  SELECT u.nome_da_praca AS unidade, u.royalties_percentual, u.csc_valor_fixo, mo.mes
  FROM unidades u
  CROSS JOIN meses mo
  WHERE u.tipo = 'regional'::text
),
fat AS (
  SELECT cr.unidade,
         date_trunc('month'::text, cr.data_competencia::timestamp with time zone) AS mes,
         sum(CASE WHEN cr.status_pagamento <> 'CANCELADO'::text THEN cr.valor ELSE 0::numeric END) AS faturado,
         sum(CASE WHEN cr.status_pagamento = 'RECEBIDO'::text THEN cr.valor ELSE 0::numeric END) AS recebido
  FROM contas_receber cr
  GROUP BY cr.unidade, (date_trunc('month'::text, cr.data_competencia::timestamp with time zone))
)
SELECT
  b.unidade,
  b.mes,
  round(COALESCE(f.faturado, 0::numeric), 2) AS faturado,
  round(COALESCE(f.recebido, 0::numeric), 2) AS recebido,
  b.royalties_percentual,
  b.csc_valor_fixo,
  round(COALESCE(f.recebido, 0::numeric) * b.royalties_percentual / 100::numeric, 2) AS royalties_valor,
  COALESCE(b.csc_valor_fixo, 0::numeric) AS csc_valor,
  round(COALESCE(f.recebido, 0::numeric) * b.royalties_percentual / 100::numeric + COALESCE(b.csc_valor_fixo, 0::numeric), 2) AS total_due_matriz
FROM base b
LEFT JOIN fat f ON f.unidade = b.unidade AND f.mes = b.mes
ORDER BY b.mes DESC, b.unidade;

ALTER VIEW public.v_royalties_mensais SET (security_invoker = true);
