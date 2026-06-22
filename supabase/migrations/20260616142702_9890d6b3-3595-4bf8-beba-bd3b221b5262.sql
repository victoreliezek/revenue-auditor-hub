
DROP POLICY IF EXISTS "Authenticated can read partners_financeiro" ON public.partners_financeiro;
CREATE POLICY "Admins/diretores can read partners_financeiro"
  ON public.partners_financeiro FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "Authenticated can read partners_orcamento" ON public.partners_orcamento;
DROP POLICY IF EXISTS "Authenticated can insert partners_orcamento" ON public.partners_orcamento;
DROP POLICY IF EXISTS "Authenticated can update partners_orcamento" ON public.partners_orcamento;
DROP POLICY IF EXISTS "Authenticated can delete partners_orcamento" ON public.partners_orcamento;

CREATE POLICY "Admins/diretores can read partners_orcamento"
  ON public.partners_orcamento FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));
CREATE POLICY "Admins/diretores can insert partners_orcamento"
  ON public.partners_orcamento FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));
CREATE POLICY "Admins/diretores can update partners_orcamento"
  ON public.partners_orcamento FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));
CREATE POLICY "Admins/diretores can delete partners_orcamento"
  ON public.partners_orcamento FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "Authenticated read roas_mensal" ON public.roas_mensal;
CREATE POLICY "Admins/diretores can read roas_mensal"
  ON public.roas_mensal FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));

ALTER VIEW public.v_reconciliacao_mensal SET (security_invoker = true);
ALTER VIEW public.v_funil_mensal SET (security_invoker = true);
ALTER VIEW public.v_royalties_mensais SET (security_invoker = true);
ALTER VIEW public.v_mrr_por_unidade SET (security_invoker = true);
ALTER VIEW public.v_nps_regional SET (security_invoker = true);

ALTER FUNCTION public.billing_esperado(date) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_unidade() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_empresa_to_pipefy() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_socio_unidade_by_email(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
