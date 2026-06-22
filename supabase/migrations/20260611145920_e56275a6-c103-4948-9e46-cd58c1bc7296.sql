GRANT SELECT ON public.contas_receber TO authenticated;
GRANT ALL ON public.contas_receber TO service_role;

CREATE POLICY "Authenticated can read contas_receber"
  ON public.contas_receber FOR SELECT
  TO authenticated
  USING (
    NOT public.has_role(auth.uid(), 'socio')
    OR unidade = public.current_user_unidade()
  );

INSERT INTO public.role_permissions (role, permission_key, allowed)
SELECT r::app_role, 'view.contas_receber', true
FROM (VALUES ('admin'),('diretor'),('head'),('auditor'),('socio')) AS t(r)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;