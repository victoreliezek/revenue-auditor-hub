-- Dupla validação manual dos títulos de partners_financeiro.
--
-- O status_titulo sincronizado do Omie não está batendo com o extrato bancário
-- real (usuário reportou divergência em 17/07/2026). Em vez de confiar cegamente
-- no status do Omie pro resumo de Recebido/Pendente, criamos um campo de
-- validação manual independente: o Omie continua sendo mostrado como
-- referência, mas o número "oficial" de Recebido/Pendente na tela de Pagamentos
-- passa a vir só do que foi conferido à mão contra o banco.
--
-- Colunas novas, não tocadas pelo sync (tools/sync_partners_financeiro.py só
-- envia as colunas que ele conhece no upsert merge-duplicates, então estas
-- ficam preservadas entre syncs).

ALTER TABLE public.partners_financeiro
  ADD COLUMN IF NOT EXISTS status_validado text NOT NULL DEFAULT 'pendente'
    CHECK (status_validado IN ('pendente', 'confirmado_pago', 'confirmado_pendente')),
  ADD COLUMN IF NOT EXISTS validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS validado_por text,
  ADD COLUMN IF NOT EXISTS observacao_validacao text;

-- Só havia policy de leitura; a tela de Pagamentos precisa gravar a validação manual.
CREATE POLICY "Admins/diretores can update partners_financeiro"
  ON public.partners_financeiro FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));
