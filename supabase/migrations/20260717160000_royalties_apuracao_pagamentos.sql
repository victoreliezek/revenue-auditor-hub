-- Redesenho da tela de Pagamentos: a fonte da verdade passa a ser a apuração de
-- royalties (royalties_apuracao com status confirmado/faturado), não o Omie.
-- O Omie (partners_financeiro) vira só uma referência cruzada de "já pagou",
-- casada por unidade + categoria + mês (comprovado empiricamente: a fatura de um
-- mês de competência M sai no Omie em M+1 — ex. apuração de junho/2026 do RJ
-- confirmada com royalties_valor=71481,98/csc_valor_fixo=25000/csc_trafego_pago=
-- 20000/outras_receitas=2316,54 bate exatamente com os títulos emitidos em
-- 10/07/2026 nas categorias Royalties/CSC Expansão/(-) CSC - Trafego pago CAC/
-- Outras receitas - Expansão).
--
-- As colunas de validação manual criadas na migration anterior
-- (20260717150000) ficaram no lugar errado — partners_financeiro é 1 linha por
-- título do Omie, mas o que o usuário precisa validar é 1 linha por categoria
-- da apuração (que pode não ter nenhum título correspondente ainda, ou somar
-- mais de um). Removendo e substituindo por uma tabela nova ligada à apuração.

ALTER TABLE public.partners_financeiro
  DROP COLUMN IF EXISTS status_validado,
  DROP COLUMN IF EXISTS validado_em,
  DROP COLUMN IF EXISTS validado_por,
  DROP COLUMN IF EXISTS observacao_validacao;

DROP POLICY IF EXISTS "Admins/diretores can update partners_financeiro" ON public.partners_financeiro;

CREATE TABLE public.royalties_apuracao_pagamentos (
  id serial PRIMARY KEY,
  apuracao_id integer NOT NULL REFERENCES public.royalties_apuracao(id) ON DELETE CASCADE,
  categoria text NOT NULL CHECK (categoria IN ('royalties', 'csc_fixo', 'csc_base_antiga', 'cac_trafego', 'outras')),
  status_validado text NOT NULL DEFAULT 'pendente'
    CHECK (status_validado IN ('pendente', 'confirmado_pago', 'confirmado_pendente')),
  validado_em timestamptz,
  validado_por text,
  observacao_validacao text,
  UNIQUE (apuracao_id, categoria)
);

ALTER TABLE public.royalties_apuracao_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/diretores can read royalties_apuracao_pagamentos"
  ON public.royalties_apuracao_pagamentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins/diretores can insert royalties_apuracao_pagamentos"
  ON public.royalties_apuracao_pagamentos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Admins/diretores can update royalties_apuracao_pagamentos"
  ON public.royalties_apuracao_pagamentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));
