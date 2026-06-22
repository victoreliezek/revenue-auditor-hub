
-- 1. socios.user_id (FK to auth.users) + backfill via email
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS socios_user_id_unique ON public.socios(user_id) WHERE user_id IS NOT NULL;

UPDATE public.socios s
SET user_id = u.id
FROM auth.users u
WHERE s.user_id IS NULL
  AND s.email IS NOT NULL
  AND lower(btrim(s.email)) = lower(btrim(u.email));

-- 2. Rewrite current_user_unidade to use user_id directly
CREATE OR REPLACE FUNCTION public.current_user_unidade()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.unidade
  FROM public.socios s
  WHERE s.user_id = auth.uid()
  LIMIT 1
$$;

-- 3. handle_new_user_role: also link socio by email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'diretor') ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles (user_id, email, nome)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.socios
     SET user_id = NEW.id
   WHERE user_id IS NULL
     AND email IS NOT NULL
     AND lower(btrim(email)) = lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

-- 4. Diretor read access on royalties tables
CREATE POLICY "Diretores can read royalties_apuracao"
  ON public.royalties_apuracao FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Diretores can read royalties_itens"
  ON public.royalties_itens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'::app_role));

-- 5. user_roles: explicit admin-only write policies (defense in depth)
CREATE POLICY "Admins manage user_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. categorias_omie: reference data, allow authenticated read
CREATE POLICY "Authenticated read categorias_omie"
  ON public.categorias_omie FOR SELECT TO authenticated
  USING (true);

-- 7. v_rateio_cm_mensal: switch to security invoker
ALTER VIEW public.v_rateio_cm_mensal SET (security_invoker = on);
