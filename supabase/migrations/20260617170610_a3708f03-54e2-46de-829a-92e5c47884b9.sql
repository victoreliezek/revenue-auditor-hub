-- Grants for royalties_apuracao
GRANT SELECT, INSERT, UPDATE, DELETE ON public.royalties_apuracao TO authenticated;
GRANT ALL ON public.royalties_apuracao TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.royalties_itens TO authenticated;
GRANT ALL ON public.royalties_itens TO service_role;

-- Sequence grants (id columns)
GRANT USAGE, SELECT ON SEQUENCE public.royalties_apuracao_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.royalties_itens_id_seq TO authenticated;

-- Admin-only RLS policies on royalties_apuracao
CREATE POLICY "Admins manage royalties_apuracao"
ON public.royalties_apuracao
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin-only RLS policies on royalties_itens
CREATE POLICY "Admins manage royalties_itens"
ON public.royalties_itens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger for apuracao
DROP TRIGGER IF EXISTS trg_royalties_apuracao_updated_at ON public.royalties_apuracao;
CREATE TRIGGER trg_royalties_apuracao_updated_at
BEFORE UPDATE ON public.royalties_apuracao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();