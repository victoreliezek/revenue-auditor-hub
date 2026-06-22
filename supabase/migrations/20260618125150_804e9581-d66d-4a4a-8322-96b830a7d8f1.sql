
DROP POLICY IF EXISTS "admin select grupos" ON public.contrato_omie_grupos;
CREATE POLICY "authenticated select grupos" ON public.contrato_omie_grupos
  FOR SELECT TO authenticated USING (true);
