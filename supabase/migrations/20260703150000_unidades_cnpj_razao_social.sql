alter table public.unidades
  add column if not exists cnpj text,
  add column if not exists razao_social text;

update public.unidades set cnpj = '55.909.495/0001-68', razao_social = 'PLANNING AUDITORES E CONTADORES RJ S/S LTDA' where nome_da_praca = 'Rio de Janeiro';
update public.unidades set cnpj = '29.617.399/0001-36', razao_social = 'PLANNING OUTSOURCING CONTABIL e TRIBUTARIO LTDA' where nome_da_praca = 'Patos de Minas';
update public.unidades set cnpj = '36.878.291/0001-62', razao_social = 'PLANNING CWB 03 CONTABILIDADE S/S' where nome_da_praca = 'Curitiba';
update public.unidades set cnpj = '60.455.832/0001-24', razao_social = 'PLANNING CONSULTORIA CONTABIL LTDA' where nome_da_praca = 'Belém';
update public.unidades set cnpj = '62.792.675/0001-78', razao_social = 'Planning Campo Novo Ltda' where nome_da_praca = 'Campo Novo';
update public.unidades set cnpj = '58.565.726/0001-51', razao_social = 'PLANNING PARTNERS BRASIL LTDA' where nome_da_praca = 'Matriz';
