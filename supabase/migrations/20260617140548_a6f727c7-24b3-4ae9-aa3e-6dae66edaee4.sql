
CREATE POLICY "auditor read criterios_rateio_cm"
  ON public.criterios_rateio_cm FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "auditor read despesas_cm_fornecedores"
  ON public.despesas_cm_fornecedores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "auditor read despesas_cm_overrides"
  ON public.despesas_cm_overrides FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "auditor read despesas_cm_avulsos"
  ON public.despesas_cm_avulsos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "auditor read receitas_cm_fornecedores"
  ON public.receitas_cm_fornecedores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "auditor read receitas_cm_overrides"
  ON public.receitas_cm_overrides FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "auditor read partners_orcamento"
  ON public.partners_orcamento FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "auditor read sqls_por_bu"
  ON public.sqls_por_bu FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'));
