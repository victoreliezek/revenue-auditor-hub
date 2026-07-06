-- Soft-delete escopado ao mês: permite remover um cliente da apuração deste
-- mês (ex: não recebeu) com justificativa, sem afetar meses anteriores/futuros
-- nem os dados de origem (Pipedrive/Omie), já que royalties_itens é por mês.
alter table public.royalties_itens
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por text,
  add column if not exists motivo_exclusao text;
