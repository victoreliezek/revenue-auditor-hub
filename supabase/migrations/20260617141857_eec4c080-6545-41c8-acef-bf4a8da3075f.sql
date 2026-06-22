GRANT SELECT ON public.omie_clientes TO authenticated;
GRANT ALL ON public.omie_clientes TO service_role;

CREATE POLICY "role_based_read"
ON public.omie_clientes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
  OR (
    (public.has_role(auth.uid(), 'socio'::public.app_role)
     OR public.has_role(auth.uid(), 'socio_franqueado'::public.app_role))
    AND unidade = public.current_user_unidade()
  )
);