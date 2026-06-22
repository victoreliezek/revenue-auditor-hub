CREATE POLICY "Authenticated can read partners_financeiro"
ON public.partners_financeiro
FOR SELECT
TO authenticated
USING (true);