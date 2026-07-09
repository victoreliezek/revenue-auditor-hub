-- Rastreio de "boleto enviado" como etapa intermediária entre pendente e pago,
-- separada de data_pagamento_parcela_X (data real do recebimento/repasse).
-- Permite à unidade saber o que já cobrou vs. o que já recebeu.
ALTER TABLE public.cac_apuracao_itens
  ADD COLUMN data_envio_parcela_1 date,
  ADD COLUMN data_envio_parcela_2 date;
