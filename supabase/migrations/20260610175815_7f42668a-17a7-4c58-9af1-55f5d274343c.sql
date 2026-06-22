
-- Allow all authenticated users to read empresas (clients directory)
DROP POLICY IF EXISTS role_based_read ON public.empresas;
CREATE POLICY "Authenticated can read empresas"
  ON public.empresas FOR SELECT
  TO authenticated
  USING (true);

-- Seed permission key view.clientes for all roles
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','view.clientes', true),
  ('diretor','view.clientes', true),
  ('socio','view.clientes', true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;
