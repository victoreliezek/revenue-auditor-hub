-- Monitoramento de integrações (syncs Pipedrive/Pipefy/Omie -> Supabase).
-- Contexto: migração das automações de LaunchAgent local para Supabase Edge
-- Functions + pg_cron/webhook. sync_log já existia (fonte, executado_em,
-- status, detalhes), mas não tinha noção de "frequência esperada" nem de
-- "está atrasada/travada" — só um log cru. Esta migration adiciona a
-- configuração por integração e uma view que calcula o status atual.

create table if not exists integracoes_config (
  fonte text primary key,                    -- casa com sync_log.fonte
  nome_exibicao text not null,
  tipo text not null check (tipo in ('cron', 'webhook')),
  intervalo_esperado_minutos int,            -- null = webhook (sem intervalo fixo esperado)
  ativo boolean not null default true,
  observacao text,
  created_at timestamptz not null default now()
);

comment on table integracoes_config is 'Config de monitoramento por integração — usado pela view v_integracoes_status e pelo alerta de falha (integracoes-monitor).';

insert into integracoes_config (fonte, nome_exibicao, tipo, intervalo_esperado_minutos, observacao) values
  ('pipefy_tratativas', 'Pipefy → Central de Tratativas (churn)', 'cron', 15, 'Edge Function pipefy-tratativas-sync, pg_cron a cada 15min'),
  ('pipedrive_contratos', 'Pipedrive → Empresas/Contratos', 'cron', 1440, 'Ainda local (~/sync_pipedrive_contratos.py), LaunchAgent diário 07:00 — migração pendente'),
  ('omie', 'Omie → Contas a Receber (Matriz)', 'cron', 1440, 'Ainda local (~/sync_omie_supabase.py), LaunchAgent diário 06:00 — migração pendente'),
  ('omie_matriz', 'Omie → Contas a Receber (Matriz, variante)', 'cron', 1440, 'Ver nota acima — duas fontes de log parecidas, checar qual está ativa de fato'),
  ('omie_clientes', 'Omie → Clientes', 'cron', 1440, 'Ainda local (~/sync_omie_clientes.py), LaunchAgent diário 06:30 — migração pendente'),
  ('financeiro_fxc', 'Financeiro FXC', 'cron', 1440, 'Ainda local (~/sync_financeiro_fxc.py), LaunchAgent diário 06:45 — migração pendente'),
  ('pipedrive_onboarding', 'Pipedrive → Pipefy (Onboarding Cliente)', 'webhook', null, 'Edge Function pipedrive-onboarding-webhook, dispara em Ganho (pipeline 2) e Contrato Assinado (pipeline 28 stage 170)')
on conflict (fonte) do nothing;

create or replace view v_integracoes_status as
select
  c.fonte,
  c.nome_exibicao,
  c.tipo,
  c.intervalo_esperado_minutos,
  c.ativo,
  c.observacao,
  s.executado_em as ultima_execucao,
  s.status as ultimo_status,
  s.detalhes as ultimo_detalhes,
  s.total_registros as ultimo_total_registros,
  case
    when s.executado_em is null then true
    when c.tipo = 'cron' and c.intervalo_esperado_minutos is not null
      then now() - s.executado_em > (c.intervalo_esperado_minutos || ' minutes')::interval * 2
    else false
  end as atrasada,
  case
    when s.executado_em is null then null
    else extract(epoch from (now() - s.executado_em)) / 60
  end as minutos_desde_ultima_execucao
from integracoes_config c
left join lateral (
  select executado_em, status, detalhes, total_registros
  from sync_log
  where sync_log.fonte = c.fonte
  order by executado_em desc
  limit 1
) s on true
where c.ativo
order by c.nome_exibicao;

comment on view v_integracoes_status is 'Status calculado por integração: última execução, se está atrasada (2x o intervalo esperado, só para tipo cron) e detalhes do último log. Base para /admin/integracoes e para o alerta de falha (integracoes-monitor).';
