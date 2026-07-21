-- Royalties devem incidir só sobre receita da categoria "Receitas Diretas"
-- (Omie: código pai 1.01), não sobre toda contas_receber — categorias como
-- "Reembolsos" (1.03) não são receita de serviço recorrente e não deveriam
-- entrar na base de royalty. codigo_categoria vem do bulk ListarContasReceber
-- (já incluído na resposta, sem custo extra de API).
ALTER TABLE public.contas_receber
  ADD COLUMN codigo_categoria text;
