ALTER TABLE public.sqls_por_bu
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.sqls_por_bu SET updated_at = now() WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS sqls_por_bu_set_updated_at ON public.sqls_por_bu;
CREATE TRIGGER sqls_por_bu_set_updated_at
BEFORE UPDATE ON public.sqls_por_bu
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();