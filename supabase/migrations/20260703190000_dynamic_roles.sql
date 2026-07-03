-- Perfis de usuário dinâmicos: substitui o enum fixo app_role por uma tabela
-- editável pela UI, sem quebrar nenhuma das políticas RLS existentes que já
-- chamam has_role(uuid, app_role) com os 6 papéis atuais.
-- Ver DECISIONS.md (2026-07-03 "Perfis de usuário dinâmicos") para o contexto completo.

-- 1. Tabela de perfis
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roles"
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage roles"
  ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed dos 6 papéis atuais como perfis de sistema (protegidos: não editáveis/excluíveis pela UI nova)
INSERT INTO public.roles (key, label, description, is_system) VALUES
  ('admin', 'Admin', 'Acesso total ao painel.', true),
  ('diretor', 'Diretor', 'Acesso amplo de leitura à rede.', true),
  ('socio', 'Sócio', 'Sócio de unidade — vê só sua unidade + benchmarks.', true),
  ('head', 'Head', 'Head (mkt/vendas) — Início, Rede e Negócio.', true),
  ('auditor', 'Auditor', 'Auditor — Início e Rede.', true),
  ('socio_franqueado', 'Sócio Franqueado', 'Sócio Franqueado — gerencia uma unidade, só vê dados dessa unidade.', true);

-- 2. user_roles.role e role_permissions.role passam de enum para text,
-- com FK para roles.key. app_role (o tipo enum) fica intocado — a assinatura
-- de has_role(uuid, app_role) não muda, então nenhuma das ~25 políticas RLS
-- que já chamam has_role(...) precisa ser tocada.
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'diretor';
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_fkey FOREIGN KEY (role) REFERENCES public.roles(key) ON DELETE RESTRICT;

ALTER TABLE public.role_permissions ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_fkey FOREIGN KEY (role) REFERENCES public.roles(key) ON DELETE CASCADE;

-- 3. has_role mantém a MESMA assinatura (uuid, app_role) para não invalidar
-- nenhuma política existente; só o corpo muda pra comparar como texto, já
-- que user_roles.role agora é text.
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
      AND role = _role::text
  )
$$;

-- 4. Perfis customizados (is_system = false) ganham leitura de rede em
-- Clientes (empresas, contratos) e Unidades automaticamente. Nenhum outro
-- acesso é concedido por aqui — páginas adicionais são liberadas manualmente
-- na tela de Permissões (já é genérica por chave, não depende do enum).
CREATE OR REPLACE FUNCTION public.is_custom_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.key = ur.role
    WHERE ur.user_id = _user_id
      AND r.is_system = false
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_custom_role(uuid) TO authenticated;

CREATE POLICY "Custom roles can read empresas"
  ON public.empresas FOR SELECT TO authenticated
  USING (public.is_custom_role(auth.uid()));

CREATE POLICY "Custom roles can read contratos"
  ON public.contratos FOR SELECT TO authenticated
  USING (public.is_custom_role(auth.uid()));

CREATE POLICY "Custom roles can read unidades"
  ON public.unidades FOR SELECT TO authenticated
  USING (public.is_custom_role(auth.uid()));

-- 5. Nova permissão de página (tela "Perfis de usuário"), concedida ao admin
-- no mesmo passo (regra registrada em DECISIONS.md 2026-07-03).
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin', 'view.admin.profiles', true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = true;
