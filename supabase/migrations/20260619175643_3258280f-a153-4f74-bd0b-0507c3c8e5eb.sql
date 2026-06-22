ALTER TABLE public.receitas_cm_overrides
  ADD COLUMN IF NOT EXISTS apuracao_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS motivo_contestacao text,
  ADD COLUMN IF NOT EXISTS origem_apuracao text,
  ADD COLUMN IF NOT EXISTS importacao_lote text,
  ADD COLUMN IF NOT EXISTS importado_em timestamptz,
  ADD COLUMN IF NOT EXISTS importado_por uuid,
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisado_por uuid;

ALTER TABLE public.receitas_cm_overrides
  DROP CONSTRAINT IF EXISTS receitas_cm_overrides_apuracao_status_check;
ALTER TABLE public.receitas_cm_overrides
  ADD CONSTRAINT receitas_cm_overrides_apuracao_status_check
  CHECK (apuracao_status IN ('pendente','aprovado','contestado'));