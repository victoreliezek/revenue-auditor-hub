-- Closer/SDR responsáveis pelo deal, usados na página de Apuração de Comissões.
-- Preenchidos pelo sync diário Pipedrive → Supabase (sync_pipedrive_contratos.py),
-- a partir dos campos customizados "Closer Responsável" e "SDR responsável".
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS closer TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS sdr TEXT;
