CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

DROP POLICY IF EXISTS "authenticated_read" ON public.auditoria_registros;
CREATE POLICY "role_based_read" ON public.auditoria_registros
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  );

DROP POLICY IF EXISTS "authenticated_read" ON public.auditoria_stats;
CREATE POLICY "role_based_read" ON public.auditoria_stats
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  );

DROP POLICY IF EXISTS "authenticated_read" ON public.contratos;
CREATE POLICY "role_based_read" ON public.contratos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  );

DROP POLICY IF EXISTS "authenticated_read" ON public.empresas;
CREATE POLICY "role_based_read" ON public.empresas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  );

DROP POLICY IF EXISTS "authenticated_read" ON public.socios;
CREATE POLICY "role_based_read" ON public.socios
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  );

DROP POLICY IF EXISTS "authenticated_read" ON public.unidades;
CREATE POLICY "role_based_read" ON public.unidades
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  );