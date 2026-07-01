-- Suporte à visão "Projetado x Cobrado x Recebido por unidade" em /rede-financeiro

-- 1. Atribuição explícita de unidade aos itens de receita projetada (hoje só existia
--    implícito no campo `nome`, ex: "CSC - Belém"). Backfill por id (mais seguro que
--    parsear o nome, já que "Fatura Maio - Rio" não segue o padrão "<Categoria> - <Unidade>").
ALTER TABLE public.receitas_cm_fornecedores ADD COLUMN IF NOT EXISTS unidade text;

UPDATE public.receitas_cm_fornecedores SET unidade = 'Belém' WHERE id = 2;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Campo Novo' WHERE id = 4;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Curitiba' WHERE id = 21;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Fortaleza' WHERE id = 6;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Maceió' WHERE id = 8;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Rio de Janeiro' WHERE id = 10;
UPDATE public.receitas_cm_fornecedores SET unidade = 'São Luis' WHERE id = 12;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Belém' WHERE id = 14;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Curitiba' WHERE id = 16;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Patos de Minas' WHERE id = 18;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Rio de Janeiro' WHERE id = 20;
UPDATE public.receitas_cm_fornecedores SET unidade = 'Rio de Janeiro' WHERE id = 22;

-- 2. Linhas de Royalties projetado por unidade regional. Sem valor_base — ficam em
--    branco até alguém preencher um override mensal na página Receitas (mesmo
--    mecanismo já usado para CSC e Verba de Mídia).
INSERT INTO public.receitas_cm_fornecedores (nome, categoria, unidade, tipo, ativo)
VALUES
  ('Royalties - Belém', 'Royalties', 'Belém', 'variavel', true),
  ('Royalties - Campo Novo', 'Royalties', 'Campo Novo', 'variavel', true),
  ('Royalties - Curitiba', 'Royalties', 'Curitiba', 'variavel', true),
  ('Royalties - Fortaleza', 'Royalties', 'Fortaleza', 'variavel', true),
  ('Royalties - Maceió', 'Royalties', 'Maceió', 'variavel', true),
  ('Royalties - Patos de Minas', 'Royalties', 'Patos de Minas', 'variavel', true),
  ('Royalties - Rio de Janeiro', 'Royalties', 'Rio de Janeiro', 'variavel', true),
  ('Royalties - São Luis', 'Royalties', 'São Luis', 'variavel', true);

-- 3. Mapeamento razão social (Omie Partners) -> unidade regional.
--    partners_financeiro.unidade vem sempre "Partners" (constante fixa no script de
--    sync), então a atribuição real de "quem pagou" depende da razão social do
--    lançamento. Confirmado manualmente em conversa com o usuário em 01/07/2026,
--    cruzando valores mensais com a planilha "Planning Patos de Minas".
--    Entidades não incluídas aqui (Lucro Exponecial, BC Comercializadora, R8
--    Comércio, Controle Soluções Contábeis, EFS Serviços de Entrega) ficam de fora
--    do cálculo de Recebido por unidade até serem identificadas.
CREATE TABLE public.partners_financeiro_unidade_map (
  razao_social text PRIMARY KEY,
  unidade text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.partners_financeiro_unidade_map (razao_social, unidade) VALUES
  ('PLANNING AUDITORES E CONTADORES RJ S/S LTDA', 'Rio de Janeiro'),
  ('PLANNING AUDITORES E CONTADORES SUDESTE S/S LTDA', 'Rio de Janeiro'),
  ('PLANNING CWB PLANEJAMENTO TRIBUTARIO LTDA', 'Curitiba'),
  ('PLANNING CWB 01 CONTABILIDADE S/S', 'Curitiba'),
  ('PLANNING CWB APOIO EMPRESARIAL LTDA', 'Curitiba'),
  ('PLANNING CWB 02 CONTABILIDADE S/S', 'Curitiba'),
  ('OFFICER APOIO EMPRESARIAL LTDA', 'Curitiba'),
  ('PLANNING CONTABILIDADE FORTALEZA S/S', 'Fortaleza'),
  ('PLANNING OUTSOURCING CONTABIL & TRIBUTARIO LTDA', 'Patos de Minas'),
  ('AGRIA LUZ CONSULTORIA CONTABIL LTDA', 'Belém'),
  ('Planning Campo Novo LTDA', 'Campo Novo'),
  ('Planning Alagoas LTDA', 'Maceió'),
  ('Planning SLZ Soluções Contábeis S/S', 'São Luis');

ALTER TABLE public.partners_financeiro_unidade_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/diretores can read partners_financeiro_unidade_map"
  ON public.partners_financeiro_unidade_map
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Admins manage partners_financeiro_unidade_map"
  ON public.partners_financeiro_unidade_map
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
