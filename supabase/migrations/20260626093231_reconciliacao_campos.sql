-- Campos de reconciliação em contratos
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS status_reconciliacao TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS na_planilha_ana      BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS obs_reconciliacao    TEXT DEFAULT NULL;

-- Índice para filtrar por status
CREATE INDEX IF NOT EXISTS idx_contratos_status_reconciliacao ON contratos (status_reconciliacao);
