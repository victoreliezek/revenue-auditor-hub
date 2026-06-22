
-- Seed das categorias de despesa e departamentos atuais para todos os usuários existentes
INSERT INTO public.dre_sim_categorias (user_id, nome, natureza)
SELECT u.id, c.nome, 'despesa'
FROM auth.users u
CROSS JOIN (VALUES
  ('Softwares'),
  ('Serviço de Terceiros PJ'),
  ('Salários'),
  ('Mídias'),
  ('Agência de Marketing'),
  ('Serviço de Consultoria'),
  ('Cursos e Treinamentos'),
  ('Ajuda de Custo'),
  ('FGTS'),
  ('INSS'),
  ('Passagem Aérea'),
  ('Outros')
) AS c(nome)
ON CONFLICT DO NOTHING;

INSERT INTO public.dre_sim_departamentos (user_id, nome)
SELECT u.id, d.nome
FROM auth.users u
CROSS JOIN (VALUES ('Marketing'), ('Comercial')) AS d(nome)
ON CONFLICT DO NOTHING;
