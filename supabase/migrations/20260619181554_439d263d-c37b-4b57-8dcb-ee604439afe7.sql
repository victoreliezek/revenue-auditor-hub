-- 1) Add 'capex' to grupo_dre enum
ALTER TYPE grupo_dre ADD VALUE IF NOT EXISTS 'capex';
