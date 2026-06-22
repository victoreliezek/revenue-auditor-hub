
-- Enum de tipo de repasse
DO $$ BEGIN
  CREATE TYPE public.tipo_repasse AS ENUM ('royalties', 'cac');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de repasses
CREATE TABLE public.repasses_unidade (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade text NOT NULL,
  competencia date NOT NULL,
  tipo public.tipo_repasse NOT NULL,
  valor_recebido numeric(14,2) NOT NULL DEFAULT 0,
  observacao text,
  origem text NOT NULL DEFAULT 'manual',
  arquivo_nome text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repasses_unidade_unique UNIQUE (unidade, competencia, tipo)
);

CREATE INDEX repasses_unidade_tipo_comp_idx ON public.repasses_unidade (tipo, competencia);
CREATE INDEX repasses_unidade_unidade_idx ON public.repasses_unidade (unidade);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repasses_unidade TO authenticated;
GRANT ALL ON public.repasses_unidade TO service_role;

ALTER TABLE public.repasses_unidade ENABLE ROW LEVEL SECURITY;

-- Leitura: quem pode ver royalties ou cac
CREATE POLICY "repasses_read"
ON public.repasses_unidade
FOR SELECT
TO authenticated
USING (
  public.can('view.auditoria.royalties') OR public.can('view.auditoria.cac')
);

-- Escrita: quem tem manage.repasses
CREATE POLICY "repasses_insert"
ON public.repasses_unidade
FOR INSERT
TO authenticated
WITH CHECK (public.can('manage.repasses'));

CREATE POLICY "repasses_update"
ON public.repasses_unidade
FOR UPDATE
TO authenticated
USING (public.can('manage.repasses'))
WITH CHECK (public.can('manage.repasses'));

CREATE POLICY "repasses_delete"
ON public.repasses_unidade
FOR DELETE
TO authenticated
USING (public.can('manage.repasses'));

-- Trigger updated_at
CREATE TRIGGER repasses_unidade_updated_at
BEFORE UPDATE ON public.repasses_unidade
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Permissão manage.repasses para diretor (admin já passa via has_role em outras checagens, mas aqui usamos can())
INSERT INTO public.role_permissions (role, permission_key, allowed)
VALUES
  ('diretor', 'manage.repasses', true),
  ('admin',   'manage.repasses', true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;
