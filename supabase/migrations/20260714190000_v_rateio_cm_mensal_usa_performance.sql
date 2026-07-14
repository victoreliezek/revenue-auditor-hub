-- Conecta o card "Base de performance" (despesas_cm_rateio_performance) ao
-- cálculo real do rateio. Antes, essa tabela só era gravada pelo formulário
-- em despesas-cm.tsx e nunca era lida por nenhuma view — a "Rateio por BU"
-- sempre usava sqls_por_bu (ou split igual entre as 4 BUs, se o mês não
-- tivesse SQLs), ignorando qualquer % de performance salva manualmente.
--
-- Regra: quando existir uma linha em despesas_cm_rateio_performance para o
-- mês, ela passa a ter prioridade sobre sqls_por_bu para os itens com
-- rateio_regra = 'padrao' (usa as 4 % salvas diretamente). Sem linha
-- cadastrada, mantém o comportamento anterior (SQLs, ou 25% cada se não
-- houver SQLs no mês).

CREATE OR REPLACE VIEW public.v_rateio_cm_mensal AS
WITH base AS (
  SELECT COALESCE(v.override_id, 0::bigint) AS despesa_id,
         v.origem, v.mes, v.fornecedor,
         v.tipo AS tipo_despesa,
         v.departamento AS dpto,
         COALESCE(v.valor_total, 0::numeric) AS valor_total,
         v.status, v.rateio_regra, v.rateio_bu_direto, v.rateio_custom
  FROM public.v_despesas_cm_mes v
  WHERE v.valor_total IS NOT NULL AND v.valor_total > 0
),
sqls_total AS (
  SELECT mes, SUM(valor) AS total FROM public.sqls_por_bu GROUP BY mes
),
sqls_pct AS (
  SELECT s.mes, s.bu, (s.valor / NULLIF(t.total, 0)) AS pct
  FROM public.sqls_por_bu s JOIN sqls_total t USING (mes)
),
bus_padrao AS (
  SELECT v.bu FROM (VALUES ('Matriz'),('Partners'),('Construção Civil'),('Consultoria')) v(bu)
),
mes_tem_sqls AS (
  SELECT DISTINCT mes FROM public.sqls_por_bu WHERE valor > 0
),
mes_tem_perf AS (
  SELECT DISTINCT mes FROM public.despesas_cm_rateio_performance
),
padrao_com_perf AS (
  SELECT b.despesa_id, b.origem, b.mes, b.fornecedor, b.tipo_despesa, b.dpto,
         b.valor_total, b.status, b.rateio_regra, b.rateio_bu_direto, b.rateio_custom,
         perf_bu.bu,
         round(b.valor_total * perf_bu.pct / 100.0, 2) AS valor_alocado
  FROM base b
  JOIN public.despesas_cm_rateio_performance p ON p.mes = b.mes
  CROSS JOIN LATERAL (VALUES
    ('Matriz', p.pct_matriz),
    ('Partners', p.pct_partners),
    ('Construção Civil', p.pct_construcao_civil),
    ('Consultoria', p.pct_consultoria)
  ) AS perf_bu(bu, pct)
  WHERE b.rateio_regra = 'padrao'
),
padrao_com_sqls AS (
  SELECT b.despesa_id, b.origem, b.mes, b.fornecedor, b.tipo_despesa, b.dpto,
         b.valor_total, b.status, b.rateio_regra, b.rateio_bu_direto, b.rateio_custom,
         bp.bu,
         round(b.valor_total * 0.5 / 4.0
               + b.valor_total * 0.5 * COALESCE(sp.pct, 0), 2) AS valor_alocado
  FROM base b
  CROSS JOIN bus_padrao bp
  LEFT JOIN sqls_pct sp ON sp.mes = b.mes AND sp.bu = bp.bu
  WHERE b.rateio_regra = 'padrao'
    AND NOT EXISTS (SELECT 1 FROM mes_tem_perf m WHERE m.mes = b.mes)
    AND EXISTS (SELECT 1 FROM mes_tem_sqls m WHERE m.mes = b.mes)
),
padrao_sem_sqls AS (
  SELECT b.despesa_id, b.origem, b.mes, b.fornecedor, b.tipo_despesa, b.dpto,
         b.valor_total, b.status, b.rateio_regra, b.rateio_bu_direto, b.rateio_custom,
         bp.bu,
         round(b.valor_total / 4.0, 2) AS valor_alocado
  FROM base b
  CROSS JOIN bus_padrao bp
  WHERE b.rateio_regra = 'padrao'
    AND NOT EXISTS (SELECT 1 FROM mes_tem_perf m WHERE m.mes = b.mes)
    AND NOT EXISTS (SELECT 1 FROM mes_tem_sqls m WHERE m.mes = b.mes)
),
direto AS (
  SELECT b.despesa_id, b.origem, b.mes, b.fornecedor, b.tipo_despesa, b.dpto,
         b.valor_total, b.status, b.rateio_regra, b.rateio_bu_direto, b.rateio_custom,
         b.rateio_bu_direto AS bu, b.valor_total AS valor_alocado
  FROM base b
  WHERE b.rateio_regra = 'direto' AND b.rateio_bu_direto IS NOT NULL
),
custom AS (
  SELECT b.despesa_id, b.origem, b.mes, b.fornecedor, b.tipo_despesa, b.dpto,
         b.valor_total, b.status, b.rateio_regra, b.rateio_bu_direto, b.rateio_custom,
         kv.key AS bu,
         round(b.valor_total * (kv.value)::numeric, 2) AS valor_alocado
  FROM base b
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(b.rateio_custom, '{}'::jsonb)) kv(key, value)
  WHERE b.rateio_regra = 'custom'
)
SELECT despesa_id, mes, bu, fornecedor, tipo_despesa, dpto, valor_total, valor_alocado, status FROM padrao_com_perf
UNION ALL
SELECT despesa_id, mes, bu, fornecedor, tipo_despesa, dpto, valor_total, valor_alocado, status FROM padrao_com_sqls
UNION ALL
SELECT despesa_id, mes, bu, fornecedor, tipo_despesa, dpto, valor_total, valor_alocado, status FROM padrao_sem_sqls
UNION ALL
SELECT despesa_id, mes, bu, fornecedor, tipo_despesa, dpto, valor_total, valor_alocado, status FROM direto
UNION ALL
SELECT despesa_id, mes, bu, fornecedor, tipo_despesa, dpto, valor_total, valor_alocado, status FROM custom;

ALTER VIEW public.v_rateio_cm_mensal SET (security_invoker = on);
GRANT SELECT ON public.v_rateio_cm_mensal TO anon, authenticated, service_role;
