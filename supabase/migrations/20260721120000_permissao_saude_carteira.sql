-- Nova página "/saude-carteira" (pilar financeiro do Customer Health Score).
-- Chave própria desde o início (não pega carona em view.clientes/view.nps),
-- concedida aos mesmos papéis que já veem Clientes/NPS/Tratativas hoje.
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','view.saude_carteira',true),
  ('auditor','view.saude_carteira',true),
  ('diretor','view.saude_carteira',true),
  ('head','view.saude_carteira',true),
  ('socio','view.saude_carteira',true),
  ('socio_franqueado','view.saude_carteira',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;
