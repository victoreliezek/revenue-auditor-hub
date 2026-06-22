
-- 1) Restrict criterios_rateio_cm to admin/diretor
DROP POLICY IF EXISTS "authenticated read criterios_rateio_cm" ON public.criterios_rateio_cm;
DROP POLICY IF EXISTS "authenticated write criterios_rateio_cm" ON public.criterios_rateio_cm;
DROP POLICY IF EXISTS "authenticated update criterios_rateio_cm" ON public.criterios_rateio_cm;
CREATE POLICY "admins read criterios_rateio_cm" ON public.criterios_rateio_cm
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins insert criterios_rateio_cm" ON public.criterios_rateio_cm
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins update criterios_rateio_cm" ON public.criterios_rateio_cm
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins delete criterios_rateio_cm" ON public.criterios_rateio_cm
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- 2) Restrict despesas_cm to admin/diretor
DROP POLICY IF EXISTS "authenticated read despesas_cm" ON public.despesas_cm;
DROP POLICY IF EXISTS "authenticated write despesas_cm" ON public.despesas_cm;
DROP POLICY IF EXISTS "authenticated update despesas_cm" ON public.despesas_cm;
DROP POLICY IF EXISTS "authenticated delete despesas_cm" ON public.despesas_cm;
CREATE POLICY "admins read despesas_cm" ON public.despesas_cm
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins insert despesas_cm" ON public.despesas_cm
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins update despesas_cm" ON public.despesas_cm
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins delete despesas_cm" ON public.despesas_cm
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- 3) despesas_cm_avulsos
DROP POLICY IF EXISTS "auth read avulsos" ON public.despesas_cm_avulsos;
DROP POLICY IF EXISTS "auth write avulsos" ON public.despesas_cm_avulsos;
CREATE POLICY "admins read avulsos" ON public.despesas_cm_avulsos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins all avulsos" ON public.despesas_cm_avulsos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- 4) despesas_cm_fornecedores
DROP POLICY IF EXISTS "auth read fornecedores" ON public.despesas_cm_fornecedores;
DROP POLICY IF EXISTS "auth write fornecedores" ON public.despesas_cm_fornecedores;
CREATE POLICY "admins read fornecedores" ON public.despesas_cm_fornecedores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins all fornecedores" ON public.despesas_cm_fornecedores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- 5) despesas_cm_overrides
DROP POLICY IF EXISTS "auth read overrides" ON public.despesas_cm_overrides;
DROP POLICY IF EXISTS "auth write overrides" ON public.despesas_cm_overrides;
CREATE POLICY "admins read overrides" ON public.despesas_cm_overrides
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "admins all overrides" ON public.despesas_cm_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- 6) sqls_por_bu — restrict reads to admin/diretor
DROP POLICY IF EXISTS "authenticated read sqls_por_bu" ON public.sqls_por_bu;
CREATE POLICY "admins read sqls_por_bu" ON public.sqls_por_bu
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- 7) sync_log — restrict to admin/diretor
DROP POLICY IF EXISTS "Authenticated can read sync_log" ON public.sync_log;
CREATE POLICY "admins read sync_log" ON public.sync_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- 8) Force views to use security_invoker (fixes SECURITY DEFINER view warning)
ALTER VIEW public.v_confronto_cm SET (security_invoker = on);
ALTER VIEW public.v_despesas_cm_mes SET (security_invoker = on);
ALTER VIEW public.v_rateio_cm_mensal SET (security_invoker = on);

-- 9) Set immutable search_path on remaining function
ALTER FUNCTION public.clonar_despesas_cm(date, date) SET search_path = public;

-- 10) Revoke public/anon EXECUTE on SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.inicializar_mes_cm(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inicializar_mes_cm(date) TO authenticated;
