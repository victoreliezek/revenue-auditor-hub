UPDATE dre_sim_categorias SET grupo_dre='capex' WHERE nome='Capex';

UPDATE dre_sim_categorias SET grupo_dre='custo_fixo'
WHERE grupo_dre='custo_variavel'
  AND nome IN ('Passagem Aérea','Agência de Marketing','Serviço de Terceiros PJ');

INSERT INTO dre_sim_categorias (user_id, nome, natureza, grupo_dre)
SELECT DISTINCT user_id, 'Comissões de vendas', 'despesa', 'custo_variavel'::grupo_dre
FROM dre_sim_categorias
WHERE NOT EXISTS (
  SELECT 1 FROM dre_sim_categorias c2
  WHERE c2.user_id = dre_sim_categorias.user_id AND c2.nome='Comissões de vendas'
);