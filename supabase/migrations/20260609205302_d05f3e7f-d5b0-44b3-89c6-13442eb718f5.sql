
-- 1. Remove public read on sensitive tables; restrict to authenticated users
DROP POLICY IF EXISTS allow_public_read ON public.auditoria_registros;
DROP POLICY IF EXISTS allow_public_read ON public.auditoria_stats;
DROP POLICY IF EXISTS allow_public_read ON public.contratos;
DROP POLICY IF EXISTS allow_public_read ON public.empresas;

CREATE POLICY "authenticated_read" ON public.auditoria_registros
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.auditoria_stats
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.contratos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.empresas
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.auditoria_registros FROM anon;
REVOKE SELECT ON public.auditoria_stats FROM anon;
REVOKE SELECT ON public.contratos FROM anon;
REVOKE SELECT ON public.empresas FROM anon;

GRANT SELECT ON public.auditoria_registros TO authenticated;
GRANT SELECT ON public.auditoria_stats TO authenticated;
GRANT SELECT ON public.contratos TO authenticated;
GRANT SELECT ON public.empresas TO authenticated;

-- 2. Profiles: users see only their own profile; admins can view all
DROP POLICY IF EXISTS "Profiles are viewable by authenticated" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. socios & unidades: RLS enabled with no policy; add authenticated read,
-- and ensure GRANTs are aligned (deny anon)
CREATE POLICY "authenticated_read" ON public.socios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON public.unidades
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.socios FROM anon;
REVOKE SELECT ON public.unidades FROM anon;
GRANT SELECT ON public.socios TO authenticated;
GRANT SELECT ON public.unidades TO authenticated;

-- 4. SECURITY DEFINER hardening: revoke EXECUTE from anon/public on has_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 5. Fix function search_path (update_updated_at was missing SET search_path)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
