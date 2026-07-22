-- Unificação de páginas: /painel-cs, /saude-carteira, /tratativas e /nps viram
-- abas de uma única página "/painel-cs" (pedido do usuário 22/07/2026). As 3
-- rotas antigas somem; a permissão única que controla a página inteira passa
-- a ser view.painel_cs.

-- cs_onboarding_cards ganha unidade (extraída do campo "Unidade" do Start
-- Form do pipe, canonicalizado no sync) — necessário pra aba Onboarding
-- respeitar o mesmo escopo por unidade (data.scope.own_unit_only) que as
-- outras 3 abas já aplicam.
ALTER TABLE public.cs_onboarding_cards ADD COLUMN unidade text;

-- Migra acesso: quem já tinha qualquer uma das 3 permissões antigas
-- (view.saude_carteira, view.nps, view.tratativas) ganha view.painel_cs, pra
-- ninguém perder acesso a dado que já enxergava.
INSERT INTO public.role_permissions (role, permission_key, allowed)
SELECT DISTINCT role, 'view.painel_cs', true
FROM public.role_permissions
WHERE permission_key IN ('view.saude_carteira', 'view.nps', 'view.tratativas')
  AND allowed = true
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = true;

-- Remove as 3 chaves antigas (a tela e a rota deixam de existir).
DELETE FROM public.role_permissions
WHERE permission_key IN ('view.saude_carteira', 'view.nps', 'view.tratativas');

-- Limpa flags de validação de página das rotas descontinuadas.
DELETE FROM public.page_validations WHERE page_key IN ('/tratativas', '/nps');
