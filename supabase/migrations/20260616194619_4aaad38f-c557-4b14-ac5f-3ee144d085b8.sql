
-- RLS policies for C&M expense tables (diretoria-only internal tool; gated by app permissions)
CREATE POLICY "authenticated read despesas_cm" ON public.despesas_cm FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write despesas_cm" ON public.despesas_cm FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update despesas_cm" ON public.despesas_cm FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete despesas_cm" ON public.despesas_cm FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated read criterios_rateio_cm" ON public.criterios_rateio_cm FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write criterios_rateio_cm" ON public.criterios_rateio_cm FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update criterios_rateio_cm" ON public.criterios_rateio_cm FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read sqls_por_bu" ON public.sqls_por_bu FOR SELECT TO authenticated USING (true);
