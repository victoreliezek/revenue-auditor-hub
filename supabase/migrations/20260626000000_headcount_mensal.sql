-- Tabela de headcount mensal por unidade
-- Usada pela tela "Headcount - Gestão da Rede"
CREATE TABLE IF NOT EXISTS headcount_mensal (
  id SERIAL PRIMARY KEY,
  unidade TEXT NOT NULL,
  mes DATE NOT NULL,
  headcount INTEGER NOT NULL DEFAULT 0,
  admissoes INTEGER NOT NULL DEFAULT 0,
  demissoes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT headcount_mensal_unidade_mes_key UNIQUE (unidade, mes)
);

CREATE INDEX IF NOT EXISTS idx_headcount_mensal_mes ON headcount_mensal (mes);
CREATE INDEX IF NOT EXISTS idx_headcount_mensal_unidade ON headcount_mensal (unidade);

ALTER TABLE headcount_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "headcount_mensal_select_authenticated"
  ON headcount_mensal FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "headcount_mensal_insert_authenticated"
  ON headcount_mensal FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "headcount_mensal_update_authenticated"
  ON headcount_mensal FOR UPDATE
  TO authenticated
  USING (true);
