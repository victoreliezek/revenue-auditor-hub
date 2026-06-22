
-- RLS, grants and indexes for contrato_omie_grupos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_omie_grupos TO authenticated;
GRANT ALL ON public.contrato_omie_grupos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.contrato_omie_grupos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.contrato_omie_grupos_id_seq TO service_role;

ALTER TABLE public.contrato_omie_grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin select grupos" ON public.contrato_omie_grupos;
DROP POLICY IF EXISTS "admin insert grupos" ON public.contrato_omie_grupos;
DROP POLICY IF EXISTS "admin update grupos" ON public.contrato_omie_grupos;
DROP POLICY IF EXISTS "admin delete grupos" ON public.contrato_omie_grupos;

CREATE POLICY "admin select grupos" ON public.contrato_omie_grupos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert grupos" ON public.contrato_omie_grupos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update grupos" ON public.contrato_omie_grupos
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete grupos" ON public.contrato_omie_grupos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS contrato_omie_grupos_contrato_id_idx ON public.contrato_omie_grupos(contrato_id);
CREATE INDEX IF NOT EXISTS contrato_omie_grupos_cpf_cnpj_idx ON public.contrato_omie_grupos(cpf_cnpj);
CREATE UNIQUE INDEX IF NOT EXISTS contrato_omie_grupos_contrato_cnpj_uq ON public.contrato_omie_grupos(contrato_id, cpf_cnpj);
