-- Credenciais Omie por unidade — acesso restrito a service_role (server functions)
CREATE TABLE public.omie_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade text NOT NULL UNIQUE,
  app_key text NOT NULL,
  app_secret text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.omie_credentials ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy criada de propósito: anon e authenticated não enxergam nada.
-- Somente supabaseAdmin (service_role, usado nos server functions do ops board) lê/escreve.
REVOKE ALL ON public.omie_credentials FROM anon, authenticated;

CREATE TRIGGER omie_credentials_updated_at
  BEFORE UPDATE ON public.omie_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Concede a permissão da página ao papel admin por padrão
INSERT INTO role_permissions (role, permission_key, allowed, updated_at)
VALUES ('admin', 'view.admin.integracoes', true, now())
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = true, updated_at = now();
