
-- role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_key)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- current_user_unidade: resolve unidade do sócio via email
CREATE OR REPLACE FUNCTION public.current_user_unidade()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.unidade
  FROM auth.users u
  JOIN public.socios s
    ON lower(btrim(s.email)) = lower(btrim(u.email))
  WHERE u.id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_user_unidade() TO authenticated;

-- get_socio_unidade_by_email: util para preview no cadastro
CREATE OR REPLACE FUNCTION public.get_socio_unidade_by_email(_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unidade
  FROM public.socios
  WHERE lower(btrim(email)) = lower(btrim(_email))
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_socio_unidade_by_email(text) TO authenticated;

-- can(): qualquer papel do usuário que tenha a permissão libera
CREATE OR REPLACE FUNCTION public.can(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(bool_or(rp.allowed), false)
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  WHERE ur.user_id = auth.uid()
    AND rp.permission_key = _key
$$;

GRANT EXECUTE ON FUNCTION public.can(text) TO authenticated;

-- Seed defaults
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','view.hub',true),
  ('admin','view.auditoria',true),
  ('admin','view.auditoria.cac',true),
  ('admin','view.auditoria.royalties',true),
  ('admin','view.auditoria.unmapped',true),
  ('admin','view.roas',true),
  ('admin','view.network.benchmarks',true),
  ('admin','view.admin.users',true),
  ('admin','view.admin.permissions',true),
  ('admin','data.scope.own_unit_only',false),

  ('diretor','view.hub',true),
  ('diretor','view.auditoria',true),
  ('diretor','view.auditoria.cac',false),
  ('diretor','view.auditoria.royalties',false),
  ('diretor','view.auditoria.unmapped',true),
  ('diretor','view.roas',true),
  ('diretor','view.network.benchmarks',true),
  ('diretor','view.admin.users',false),
  ('diretor','view.admin.permissions',false),
  ('diretor','data.scope.own_unit_only',false),

  ('socio','view.hub',true),
  ('socio','view.auditoria',true),
  ('socio','view.auditoria.cac',false),
  ('socio','view.auditoria.royalties',false),
  ('socio','view.auditoria.unmapped',false),
  ('socio','view.roas',true),
  ('socio','view.network.benchmarks',true),
  ('socio','view.admin.users',false),
  ('socio','view.admin.permissions',false),
  ('socio','data.scope.own_unit_only',true)
ON CONFLICT (role, permission_key) DO NOTHING;
