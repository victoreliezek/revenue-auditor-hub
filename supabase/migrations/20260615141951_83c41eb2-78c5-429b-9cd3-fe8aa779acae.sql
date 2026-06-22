GRANT SELECT ON public.partners_orcamento TO authenticated;
GRANT ALL ON public.partners_orcamento TO service_role;
ALTER TABLE public.partners_orcamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read partners_orcamento"
ON public.partners_orcamento
FOR SELECT
TO authenticated
USING (true);