-- Add new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';