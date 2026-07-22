-- Nova página executiva "/painel-cs" (painel pra acompanhar o pipe Pipefy
-- "[PTRS-CLI-01] Onboarding Cliente", id 307173656 — funil de onboarding
-- pós-venda: Nova venda → Contrato assinado → Handoff [comercial+cs] →
-- Sessão raio-x → Pré Kickoff → Kickoff → Setup técnico → Check-out →
-- Concluído). Sincronizada via Edge Function pipefy-cs-onboarding-sync
-- (pg_cron 15min) + botão de forçar atualização na tela, mesmo padrão já
-- usado em auditorias_internas/central_tratativas.
CREATE TABLE public.cs_onboarding_cards (
  pipefy_card_id text PRIMARY KEY,
  titulo text,
  fase_atual text,
  fase_atual_ordem smallint,
  entrou_fase_atual_em timestamptz,
  criado_em timestamptz,
  concluido boolean NOT NULL DEFAULT false,
  fases_history jsonb,
  update_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cs_onboarding_cards ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.cs_onboarding_cards TO authenticated;
GRANT ALL ON public.cs_onboarding_cards TO service_role;

CREATE POLICY "role_based_read" ON public.cs_onboarding_cards
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Custom roles can read cs_onboarding_cards"
  ON public.cs_onboarding_cards FOR SELECT TO authenticated
  USING (public.is_custom_role(auth.uid()));

-- Chave própria desde o início — concedida por padrão a admin e diretor;
-- demais papéis ficam de fora até um admin liberar manualmente em
-- /admin/permissoes.
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','view.painel_cs',true),
  ('diretor','view.painel_cs',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;
