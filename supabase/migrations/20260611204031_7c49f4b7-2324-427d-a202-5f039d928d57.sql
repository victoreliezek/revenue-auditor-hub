
DROP POLICY IF EXISTS "Authenticated can read empresas" ON public.empresas;
CREATE POLICY "role_based_read" ON public.empresas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

DROP POLICY IF EXISTS "Authenticated can read contas_receber" ON public.contas_receber;
CREATE POLICY "role_based_read" ON public.contas_receber
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'diretor'::app_role)
    OR (has_role(auth.uid(),'socio'::app_role) AND unidade = current_user_unidade())
  );

DROP POLICY IF EXISTS "allow_public_read" ON public.roas_por_unidade;
CREATE POLICY "role_based_read" ON public.roas_por_unidade
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

DROP POLICY IF EXISTS "allow_public_read" ON public.roas_metricas_mensais;
CREATE POLICY "role_based_read" ON public.roas_metricas_mensais
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

DROP POLICY IF EXISTS "allow_public_read_expansao" ON public.roas_expansao_mensal;
CREATE POLICY "role_based_read" ON public.roas_expansao_mensal
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

CREATE POLICY "role_based_read" ON public.audit_arquitetura
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

CREATE POLICY "role_based_read" ON public.central_tratativas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

CREATE POLICY "role_based_read" ON public.grupos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

CREATE POLICY "role_based_read" ON public.nps_pesquisas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

CREATE POLICY "admins_write_socios" ON public.socios
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

ALTER VIEW public.vw_grupos_completo SET (security_invoker = true);
ALTER VIEW public.v_payback_simulacao SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.fill_contrato_cnpj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cnpj IS NULL OR NEW.cnpj = '' THEN
    SELECT e.cnpj INTO NEW.cnpj FROM empresas e
    WHERE e.pipedrive_id = NEW.pipedrive_deal_id
      AND e.cnpj IS NOT NULL AND e.cnpj != '' LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_empresa_to_pipefy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pipefy_token TEXT := 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3ODA2OTAwMjEsImp0aSI6Ijg3Y2FiYmM4LTY4Y2YtNGJkYS05N2FmLTk1OGFjNTNjN2Y5MSIsInN1YiI6MzA3ODcyMjkxLCJ1c2VyIjp7ImlkIjozMDc4NzIyOTEsImVtYWlsIjoidmljdG9yLmVsaWV6ZWtAcGxhbm5pbmcuY29tLmJyIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.dxH7eOeLKGJWBWx-x7BHlHYkvFC2JLgwY48t_En53A6_UNNWepZkr4rIGr_XWdk2aHPk8-opSVAULHk9-z4YLg';
  payload TEXT;
  field_id TEXT;
  field_val TEXT;
  changed BOOLEAN := FALSE;
BEGIN
  IF NEW.pipefy_record_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.cnpj IS DISTINCT FROM OLD.cnpj THEN
    field_id := 'cnpj'; field_val := NEW.cnpj; changed := TRUE;
  ELSIF NEW.segmento IS DISTINCT FROM OLD.segmento THEN
    field_id := 'segmento'; field_val := NEW.segmento; changed := TRUE;
  ELSIF NEW.erp IS DISTINCT FROM OLD.erp THEN
    field_id := 'erp'; field_val := NEW.erp; changed := TRUE;
  ELSIF NEW.regime_tributario IS DISTINCT FROM OLD.regime_tributario THEN
    field_id := 'regime_tribut_rio'; field_val := NEW.regime_tributario; changed := TRUE;
  ELSIF NEW.email_fiscal IS DISTINCT FROM OLD.email_fiscal THEN
    field_id := 'e_mail_fiscal'; field_val := NEW.email_fiscal; changed := TRUE;
  ELSIF NEW.telefone IS DISTINCT FROM OLD.telefone THEN
    field_id := 'telefone_corporativo'; field_val := NEW.telefone; changed := TRUE;
  ELSIF NEW.origem_venda IS DISTINCT FROM OLD.origem_venda THEN
    field_id := 'origem'; field_val := NEW.origem_venda; changed := TRUE;
  END IF;
  IF NOT changed THEN RETURN NEW; END IF;
  payload := json_build_object(
    'query','mutation($recordId: ID!, $fieldId: ID!, $value: UndefinedInput) { setTableRecordFieldValue(input: { table_record_id: $recordId, field_id: $fieldId, value: $value }) { table_record { id } } }',
    'variables', json_build_object('recordId',NEW.pipefy_record_id,'fieldId',field_id,'value',field_val)
  )::TEXT;
  PERFORM net.http_post(
    url := 'https://api.pipefy.com/graphql',
    body := payload::JSONB,
    headers := json_build_object('Content-Type','application/json','Authorization','Bearer '||pipefy_token)::JSONB
  );
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_user_unidade() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_socio_unidade_by_email(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_unidade() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_socio_unidade_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can(text) TO authenticated;
