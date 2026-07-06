-- Adiciona data do ganho (Pipedrive) aos itens de apuração de royalties, para exibição na tela.
alter table public.royalties_itens
  add column if not exists data_ganho date;

update public.royalties_itens ri
set data_ganho = c.ganho_em
from public.contratos c
where ri.contrato_id = c.id
  and ri.data_ganho is null;
