-- auditoria_interna (pipe Pipefy 307181077) — registra no monitoramento de
-- integrações (mesmo padrão de sqls_por_bu/pipefy_tratativas).

insert into integracoes_config (fonte, nome_exibicao, tipo, intervalo_esperado_minutos, observacao) values
  ('pipefy_auditoria_interna', 'Pipefy → Auditoria Interna', 'cron', 15, 'Edge Function pipefy-auditoria-interna-sync, pg_cron a cada 15min — alimenta a tela executiva /auditoria-interna')
on conflict (fonte) do update set
  nome_exibicao = excluded.nome_exibicao,
  tipo = excluded.tipo,
  intervalo_esperado_minutos = excluded.intervalo_esperado_minutos,
  observacao = excluded.observacao;
