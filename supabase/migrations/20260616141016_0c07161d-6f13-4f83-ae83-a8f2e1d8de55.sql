INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('socio_franqueado','view.painel_unidade',true),
  ('socio_franqueado','view.clientes',true),
  ('socio_franqueado','view.nps',true),
  ('socio_franqueado','view.tratativas',true),
  ('socio_franqueado','view.funil_receita',true),
  ('socio_franqueado','view.contas_receber',true),
  ('socio_franqueado','view.meus_royalties',true),
  ('socio_franqueado','data.scope.own_unit_only',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;