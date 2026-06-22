
-- 1. Add 'socio' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'socio';
