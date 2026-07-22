-- Bug recorrente reportado pelo usuário: liberar uma página em
-- /admin/permissoes (role_permissions) não bastava para os dados
-- aparecerem — muitas tabelas tinham RLS de leitura hardcoded pra
-- has_role(admin)/has_role(diretor)/has_role(auditor)/is_custom_role(),
-- ignorando role_permissions. Qualquer role "de sistema" além de
-- admin/diretor/auditor (ex: head, socio, socio_franqueado, cs) que
-- ganhasse acesso a uma página continuava vendo tela vazia.
--
-- Já existe a função public.can(_key) (SECURITY DEFINER, consulta
-- role_permissions pelo usuário logado) — usada até hoje só em
-- repasses_unidade. Este migration adiciona políticas de leitura
-- baseadas em can() nas tabelas que alimentam as páginas afetadas,
-- SEM remover nenhuma política existente (Postgres RLS é permissivo por
-- padrão: uma linha é visível se QUALQUER policy passar) — mudança
-- estritamente aditiva, não pode regredir acesso de ninguém.
--
-- Caso relatado: mateus.nunes@planning.com.br (role "head") via
-- /clientes vazio mesmo com view.clientes=true.

CREATE POLICY "Permission-based read" ON public.empresas
  FOR SELECT TO authenticated
  USING (public.can('view.clientes') OR public.can('view.painel_cs'));

CREATE POLICY "Permission-based read" ON public.contratos
  FOR SELECT TO authenticated
  USING (
    public.can('view.clientes') OR public.can('view.painel_cs')
    OR public.can('view.reconciliacao') OR public.can('view.rede_ltv')
  );

CREATE POLICY "Permission-based read" ON public.central_tratativas
  FOR SELECT TO authenticated
  USING (public.can('view.clientes') OR public.can('view.painel_cs'));

CREATE POLICY "Permission-based read" ON public.unidades
  FOR SELECT TO authenticated
  USING (public.can('view.clientes'));

CREATE POLICY "Permission-based read" ON public.contas_receber
  FOR SELECT TO authenticated
  USING (public.can('view.contas_receber') OR public.can('view.reconciliacao') OR public.can('view.painel_cs'));

CREATE POLICY "Permission-based read" ON public.nps_pesquisas
  FOR SELECT TO authenticated
  USING (public.can('view.painel_cs') OR public.can('view.rede_realizado'));

CREATE POLICY "Permission-based read" ON public.roas_mensal
  FOR SELECT TO authenticated
  USING (public.can('view.rede_ltv'));

CREATE POLICY "Permission-based read" ON public.roas_por_unidade
  FOR SELECT TO authenticated
  USING (public.can('view.rede_realizado'));

CREATE POLICY "Permission-based read" ON public.partners_financeiro
  FOR SELECT TO authenticated
  USING (public.can('view.funil_receita'));

-- cs_onboarding_cards é tabela nova desta mesma sessão (22/07/2026) — já
-- nasceu com o mesmo bug (role_based_read admin/diretor only). Aqui dá
-- pra corrigir na fonte em vez de só adicionar por cima.
DROP POLICY IF EXISTS "role_based_read" ON public.cs_onboarding_cards;
DROP POLICY IF EXISTS "Custom roles can read cs_onboarding_cards" ON public.cs_onboarding_cards;
CREATE POLICY "Permission-based read" ON public.cs_onboarding_cards
  FOR SELECT TO authenticated
  USING (public.can('view.painel_cs'));
