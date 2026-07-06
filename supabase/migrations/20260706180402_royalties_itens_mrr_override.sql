-- Override de MRR escopado ao item/mês (ex: valor do contrato no Pipedrive está
-- desatualizado). Não afeta contratos.mrr_mensal nem o cálculo de royalties
-- (que usa valor_confirmado) — é só o valor de referência exibido na tela.
alter table public.royalties_itens
  add column if not exists mrr_override numeric;
