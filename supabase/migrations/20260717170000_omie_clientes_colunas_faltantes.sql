-- ~/sync_omie_clientes.py grava 18 colunas em omie_clientes, mas a tabela só
-- tinha 9 (codigo_omie, unidade, razao_social, nome_fantasia, cnpj_cpf, email,
-- cidade, estado, updated_at) — todo upsert falhava com PGRST204 ("Could not
-- find the 'bairro' column"), silenciosamente, há pelo menos alguns dias
-- (achado pelo monitoramento de integrações, ver DECISIONS.md 17/07/2026).
-- Puramente aditivo: adiciona as colunas que faltam pro script conseguir
-- escrever o que já calcula corretamente.

ALTER TABLE public.omie_clientes
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS inativo boolean,
  ADD COLUMN IF NOT EXISTS pessoa_fisica boolean,
  ADD COLUMN IF NOT EXISTS is_planning boolean,
  ADD COLUMN IF NOT EXISTS contrato_id integer,
  ADD COLUMN IF NOT EXISTS honorario numeric,
  ADD COLUMN IF NOT EXISTS ultimo_pagamento date,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;
