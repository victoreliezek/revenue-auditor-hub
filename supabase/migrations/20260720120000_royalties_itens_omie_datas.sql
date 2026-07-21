-- A apuração de royalties já filtra o Omie por data_pagamento (recebimento) no
-- mês da apuração (ver gerarItensApuracaoCore) — isso está correto e não muda.
-- O que faltava era expor, por item, QUAIS datas de pagamento e de competência
-- (contas_receber.data_competencia) geraram aquele valor agregado, pra dar pra
-- conferir na tela de apuração quando a competência do título diverge do mês em
-- que ele foi efetivamente recebido (fatura paga com atraso, por exemplo).
-- Array porque um item pode agregar mais de um título do Omie no mesmo mês
-- (2ª fatura, ou filiais vinculadas a um mesmo contrato).
ALTER TABLE public.royalties_itens
  ADD COLUMN data_pagamento_omie date[],
  ADD COLUMN data_competencia_omie date[];
