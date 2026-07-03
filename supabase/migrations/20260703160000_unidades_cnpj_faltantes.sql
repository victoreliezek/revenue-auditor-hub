update public.unidades set
  razao_social = 'PLANNING CWB 01 CONTABILIDADE S/S' || chr(10) || 'PLANNING CWB APOIO EMPRESARIAL LTDA' || chr(10) || 'PLANNING CWB 02 CONTABILIDADE S/S' || chr(10) || 'PLANNING CWB 03 CONTABILIDADE S/S',
  cnpj = '36.729.702/0001-58' || chr(10) || '17.721.729/0001-50' || chr(10) || '37.382.313/0001-61' || chr(10) || '36.878.291/0001-62'
where nome_da_praca = 'Curitiba';

update public.unidades set cnpj = '65.737.247/0001-30', razao_social = 'Planning Contabilidade Fortaleza S/S' where nome_da_praca = 'Fortaleza';
update public.unidades set cnpj = '66.438.610/0001-80', razao_social = 'Planning Alagoas LTDA' where nome_da_praca = 'Maceió';
update public.unidades set cnpj = '65.810.734/0001-81', razao_social = 'Planning SLZ Soluções Contábeis S/S' where nome_da_praca = 'São Luis';
