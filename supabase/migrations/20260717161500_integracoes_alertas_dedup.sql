-- Dedup de alertas de integrações — evita reenviar e-mail a cada execução do
-- monitor (15-30min) enquanto o mesmo problema persiste. Um alerta só é
-- reenviado depois de ALERTA_COOLDOWN_HORAS (4h, fixo no código do monitor).

create table if not exists integracoes_alertas (
  fonte text primary key references integracoes_config(fonte) on delete cascade,
  enviado_em timestamptz not null default now(),
  detalhes jsonb
);

comment on table integracoes_alertas is 'Última vez que um alerta de falha/atraso foi enviado por integração — usado pela Edge Function integracoes-monitor para não reenviar e-mail a cada execução enquanto o problema persiste.';
