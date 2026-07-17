-- sqls_por_bu migrado de LaunchAgent local para Edge Function + pg_cron
-- (ver DECISIONS.md 17/07/2026). Registra no monitoramento de integrações.

insert into integracoes_config (fonte, nome_exibicao, tipo, intervalo_esperado_minutos, observacao) values
  ('sqls_por_bu', 'Pipedrive → SQLs por BU', 'cron', 1440, 'Edge Function sqls-por-bu-sync, pg_cron diário 08:00 — migrado de ~/sync_sqls_por_bu.py em 17/07/2026')
on conflict (fonte) do update set
  nome_exibicao = excluded.nome_exibicao,
  tipo = excluded.tipo,
  intervalo_esperado_minutos = excluded.intervalo_esperado_minutos,
  observacao = excluded.observacao;
