-- 1. Perfis customizados ganham leitura de rede (somente leitura) também em
-- NPS e Tratativas, além de Clientes/Unidades (migration 20260703190000).
-- Mesmo padrão: política aditiva nova, não toca nas políticas existentes.
CREATE POLICY "Custom roles can read nps_pesquisas"
  ON public.nps_pesquisas FOR SELECT TO authenticated
  USING (public.is_custom_role(auth.uid()));

CREATE POLICY "Custom roles can read central_tratativas"
  ON public.central_tratativas FOR SELECT TO authenticated
  USING (public.is_custom_role(auth.uid()));

-- 2. Várias páginas do sidebar não tinham chave de permissão própria — elas
-- "pegavam carona" em chaves de outras páginas (view.clientes, view.roas,
-- view.auditoria.cac), então a tela "Permissões" não conseguia
-- liberar/bloquear cada página individualmente. Chaves novas abaixo, com
-- seed preservando exatamente o acesso que os 6 papéis de sistema já tinham
-- hoje (perfis customizados como "cs" não são alterados — ficam a critério
-- do admin na tela de Permissões daqui pra frente).

-- LTV Estimado e Realizado Unidades pegavam carona em view.clientes, que
-- hoje é true pra todos os 6 papéis de sistema.
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','view.rede_ltv',true), ('auditor','view.rede_ltv',true), ('diretor','view.rede_ltv',true),
  ('head','view.rede_ltv',true), ('socio','view.rede_ltv',true), ('socio_franqueado','view.rede_ltv',true),
  ('admin','view.rede_realizado',true), ('auditor','view.rede_realizado',true), ('diretor','view.rede_realizado',true),
  ('head','view.rede_realizado',true), ('socio','view.rede_realizado',true), ('socio_franqueado','view.rede_realizado',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Headcount e Reconciliação pegavam carona em view.roas, que hoje é true
-- pra admin/diretor/head/socio (auditor e socio_franqueado não tinham).
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','view.rede_headcount',true), ('diretor','view.rede_headcount',true),
  ('head','view.rede_headcount',true), ('socio','view.rede_headcount',true),
  ('admin','view.reconciliacao',true), ('diretor','view.reconciliacao',true),
  ('head','view.reconciliacao',true), ('socio','view.reconciliacao',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Página "Unidades" (grupo Receita da Rede) pegava carona em
-- view.auditoria.cac, que hoje só é true pro admin.
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','view.unidades_rede',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- NPS, Tratativas e Funil de Receita já tinham chave própria em
-- KNOWN_PERMISSIONS (view.nps / view.tratativas / view.funil_receita), mas
-- o sidebar nunca usava essas chaves (usava view.clientes / view.roas).
-- Seed pra igualar o que view.clientes/view.roas já concediam, antes de
-- trocar o wiring no código.
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('diretor','view.nps',true), ('head','view.nps',true), ('socio','view.nps',true),
  ('diretor','view.tratativas',true), ('head','view.tratativas',true), ('socio','view.tratativas',true),
  ('diretor','view.funil_receita',true), ('head','view.funil_receita',true), ('socio','view.funil_receita',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;
