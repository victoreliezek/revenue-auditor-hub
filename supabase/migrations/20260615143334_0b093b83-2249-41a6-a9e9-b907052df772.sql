
-- Allow authenticated users to manage budget items
GRANT INSERT, UPDATE, DELETE ON public.partners_orcamento TO authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.partners_orcamento_id_seq TO authenticated;

CREATE POLICY "Authenticated can insert partners_orcamento"
ON public.partners_orcamento FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update partners_orcamento"
ON public.partners_orcamento FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete partners_orcamento"
ON public.partners_orcamento FOR DELETE TO authenticated USING (true);
