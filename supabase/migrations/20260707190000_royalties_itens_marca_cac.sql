-- Permite marcar um item da apuração de royalties como "é CAC": o valor
-- calculado (valor confirmado x %) passa a somar na linha de CAC do resumo
-- em vez da linha de Royalties, sem sair da seção/categoria onde já está.
alter table royalties_itens
  add column is_cac boolean not null default false;

alter table royalties_apuracao
  add column cac_valor numeric;
