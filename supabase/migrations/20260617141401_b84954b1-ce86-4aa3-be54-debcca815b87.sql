CREATE POLICY "Auditors can read empresas"
ON public.empresas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::public.app_role));

CREATE POLICY "Auditors can read contratos"
ON public.contratos
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::public.app_role));

CREATE POLICY "Auditors can read unidades"
ON public.unidades
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::public.app_role));

CREATE POLICY "Auditors can read nps_pesquisas"
ON public.nps_pesquisas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::public.app_role));

CREATE POLICY "Auditors can read central_tratativas"
ON public.central_tratativas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::public.app_role));

CREATE POLICY "Auditors can read contas_receber"
ON public.contas_receber
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::public.app_role));