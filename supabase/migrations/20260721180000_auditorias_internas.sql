-- Nova página executiva "/auditoria-interna" (tela pro CEO acompanhar o pipe
-- Pipefy "Auditoria Interna", id 307181077 — auditorias fiscais internas
-- feitas nos grupos de clientes: ICMS, PIS/COFINS, Reforma Tributária).
-- Sincronizada via Edge Function pipefy-auditoria-interna-sync (pg_cron
-- 15min) + botão de forçar atualização na tela, mesmo padrão já usado em
-- central_tratativas.
CREATE TABLE public.auditorias_internas (
  pipefy_card_id text PRIMARY KEY,
  empresa_auditada text,
  unidade text,
  fase_atual text,
  status_solicitacao text,
  complexidade_fiscal text,
  tipo_empresa text,
  setor_atuacao text,
  equipe_designada text,
  data_inicio_contrato date,
  prazo_atual timestamptz,
  data_conclusao date,
  auditoria_finalizada boolean,
  classificacao_apontamentos text,
  oportunidades_texto text,
  contingencias_texto text,
  oportunidades_valor numeric,
  contingencias_valor numeric,
  update_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auditorias_internas ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.auditorias_internas TO authenticated;
GRANT ALL ON public.auditorias_internas TO service_role;

-- Dado sensível (valores de risco/oportunidade fiscal por cliente) — mesma
-- restrição de leitura já usada em central_tratativas: admin/diretor via
-- has_role, + perfis customizados via is_custom_role (liberado/bloqueado
-- de fato pela chave view.auditoria_interna na tela de Permissões).
CREATE POLICY "role_based_read" ON public.auditorias_internas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Custom roles can read auditorias_internas"
  ON public.auditorias_internas FOR SELECT TO authenticated
  USING (public.is_custom_role(auth.uid()));

-- Chave própria desde o início (tela exclusiva pro CEO acompanhar) —
-- concedida por padrão a admin e diretor; demais papéis ficam de fora até
-- um admin liberar manualmente em /admin/permissoes.
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','view.auditoria_interna',true),
  ('diretor','view.auditoria_interna',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;
