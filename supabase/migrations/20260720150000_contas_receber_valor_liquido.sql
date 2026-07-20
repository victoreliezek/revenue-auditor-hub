-- contas_receber.valor guarda o valor_documento bruto do Omie (sem descontar
-- impostos retidos). Pra comparar com relatórios da contadora (que reportam
-- valor líquido, já descontando IRRF/PIS/COFINS/CSLL), precisamos do líquido
-- por título. O bulk ListarContasReceber não traz os valores de retenção —
-- só ConsultarContaReceber (1 chamada por título) traz. Por isso o cálculo é
-- feito de forma incremental pelo sync (~/sync_omie_supabase.py), não em
-- backfill: só títulos RECEBIDO recentes (sem valor_liquido ainda) recebem
-- a chamada extra. Títulos históricos ficam com valor_liquido = NULL.
ALTER TABLE public.contas_receber
  ADD COLUMN valor_liquido numeric;
