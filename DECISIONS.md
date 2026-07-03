# Log de Decisões — Planning Dashboard

Log append-only de decisões de produto/arquitetura/negócio tomadas em conversas com o Claude Code (ou qualquer outra ferramenta). Cada sessão nova deve ler este arquivo inteiro antes de propor mudanças em áreas que já têm decisão registrada aqui, e deve adicionar uma entrada nova sempre que uma decisão não-óbvia for tomada — mesmo que a implementação ainda não tenha sido feita.

Nunca editar ou apagar entradas antigas. Se uma decisão for revertida, adicionar uma entrada nova referenciando a antiga.

Formato de cada entrada:

```
## [YYYY-MM-DD] Título curto da decisão

**Contexto:** por que isso surgiu / qual problema resolve.
**Decisão:** o que foi decidido, especificamente.
**Status:** não implementado | parcialmente implementado | implementado (commit/arquivo).
**Próximos passos:** se houver.
```

---

## [2026-07-03] Perfis de usuário dinâmicos (tela "Perfis")

**Contexto:** usuário pediu uma tela para criar novos perfis de usuário (ex: "Financeiro"), não só novos usuários. Os papéis existentes (Admin, Diretor, Sócio, Head, Auditor, Sócio Franqueado) eram um enum fixo do Postgres (`app_role`) amarrado a ~25 políticas RLS em ~20 tabelas, separado da tela "Permissões" (que já era genérica por chave de permissão). Criar só uma tabela de perfis sem tocar nisso resultaria em perfis que aparecem no menu mas não leem nenhuma tabela de dados.
**Decisão:** nova tabela `public.roles` (key/label/description/is_system) substitui o enum como fonte de verdade dos perfis; `user_roles.role` e `role_permissions.role` viraram `text` com FK pra `roles.key`. `has_role(uuid, app_role)` manteve a mesma assinatura (só o corpo mudou pra comparar como texto) para não invalidar nenhuma política RLS existente dos 6 papéis de sistema — zero mudança de comportamento pra eles. Perfis customizados (`is_system=false`) ganham automaticamente leitura de rede (somente leitura) em **Clientes** (`empresas`, `contratos`) e **Unidades** (`unidades`) via 3 políticas RLS aditivas novas e a função `is_custom_role()` — escolha deliberada do usuário, mais restrita que dar acesso tipo Auditor a todas as ~14 tabelas que ele lê. Nenhum perfil customizado tem escrita em tabelas sensíveis (repasses, royalties, sócios) — isso continua exclusivo do Admin. Perfis de sistema são protegidos: não editáveis/excluíveis pela UI nova. Visibilidade de outras páginas continua manual, via tela "Permissões" (agora alimentada por `roles` em vez do array fixo `ALL_ROLES`).
**Status:** implementado. Migration `supabase/migrations/20260703190000_dynamic_roles.sql` aplicada em produção via Supabase Management API (verificado: `has_role` retorna `true` pra todos os usuários existentes após a migration — sem regressão). Arquivos: `src/lib/roles.functions.ts` (novo), `src/lib/permissions.functions.ts`, `src/lib/admin-users.functions.ts`, `src/hooks/use-permissions.ts`, `src/routes/_authenticated/admin.perfis.tsx` (novo), `src/routes/_authenticated/admin.usuarios.tsx`, `src/routes/_authenticated/admin.permissoes.tsx`, `src/components/app-sidebar.tsx`, `src/integrations/supabase/types.ts`.
**Próximos passos:** nenhum pendente. Se no futuro um perfil customizado precisar ler outras tabelas de dados hoje gated por `has_role(...)` direto (NPS, tratativas, contas a receber, CM/rateio, financeiro partners etc.), será preciso ampliar `is_custom_role()`/novas políticas RLS por tabela — não é automático via tela "Permissões" (que só controla visibilidade de página, não RLS).

## [2026-07-03] Restaurado acesso de admin/diretor a Financeiro Partners / Receita Partners / Despesas Partners

**Contexto:** usuário percebeu que o grupo "Planning Partners" (Financeiro Partners, Receita Partners, Despesas Partners) sumiu do sidebar. Investigação mostrou que `role_permissions` tinha **zero linhas** para `view.financeiro_partners`, `view.receita_partners`, `view.despesas_partners` — nenhum papel, nem admin, tinha essas permissões concedidas no banco (o item do sidebar só aparece se o papel do usuário tiver a permissão marcada `allowed=true`). Não foi causado pela página de Comissões (diff de `app-sidebar.tsx` e `permissions.functions.ts` não tocou esse grupo) — o gap já existia no banco antes.
**Decisão:** conceder `view.financeiro_partners`, `view.receita_partners`, `view.despesas_partners` para os papéis `admin` e `diretor` via upsert direto em `role_permissions` (Supabase REST, service_role). Além disso, usuário pediu explicitamente: **admin deve sempre ter todas as páginas/permissões `view.*` ativas** — regra geral daqui pra frente, não só para essas 3.
**Status:** implementado (upsert rodado 2026-07-03T17:53). Na mesma conversa, usuário confirmou a regra geral e uma varredura completa de `admin` vs `KNOWN_PERMISSIONS` foi feita: além das 3 acima, faltavam `view.comissoes`, `view.funil_receita`, `view.meus_royalties`, `view.nps`, `view.painel_unidade`, `view.reforma_tributaria`, `view.tratativas` — todas concedidas a `admin`. Resultado: admin tem hoje 23/23 permissões de `KNOWN_PERMISSIONS`, exceto `data.scope.own_unit_only` (não é uma página, é uma flag de restrição — dar essa ao admin restringiria, não liberaria, então foi deixada de fora de propósito).
**Próximos passos:** ao adicionar qualquer nova permissão `view.*` em `KNOWN_PERMISSIONS` (`src/lib/permissions.functions.ts`), conceder também para `admin` em `role_permissions` no mesmo passo — não deixar como tarefa manual separada em `/admin/permissoes`.

## [2026-07-03] Página de Apuração de Comissões (Closer/SDR) + closer/sdr sincronizados em `contratos`

**Contexto:** era preciso conferir, venda a venda, se ela foi realizada e paga antes de calcular comissão de Closer/SDR. O módulo de Auditoria já cobria quase tudo (razão social, CNPJ, data de fechamento, status/valor/data do 1º pagamento), mas Closer e SDR não existiam em nenhuma tabela do Supabase — só como campos customizados do deal no Pipedrive (`Closer Responsável` = chave `82f35432010d0c95fceeaa0b5bce5f8e7542a795`, `SDR responsável` = chave `216740813ecdc3d64c03e5e1d5685050048a01d1`, ambos `enum`).
**Decisão:** trazer Closer/SDR pelo sync diário existente (`/Users/victoreliezek/sync_pipedrive_contratos.py`, roda às 07:00 via LaunchAgent `com.victoreliezek.pipedrive-sync`), não ao vivo do Pipedrive nem em branco — consistente com a arquitetura de fonte única já estabelecida. Duas colunas novas (`closer`, `sdr`, nullable) em `contratos`. Página nova (não uma aba dentro de Auditoria) em `/comissoes`, com permissão própria `view.comissoes`, seguindo o padrão de página de conteúdo sem `beforeLoad` (visibilidade só via sidebar, igual `funil-receita`/`contas-receber`). Coluna "Nome" da tabela usa `deal_titulo` (nome do negócio no Pipedrive); "Valor/Data do Pagamento" usa o **primeiro** pagamento RECEBIDO em `contas_receber` (novo campo `valor_primeiro_pag` em `AuditRegistro`, análogo ao `data_primeiro_pag` já existente), não o total acumulado.
**Status:** implementado. Migration `supabase/migrations/20260703173326_contratos_closer_sdr.sql` já aplicada em produção via Supabase Management API; sync rodado manualmente uma vez para backfill (119/310 contratos com closer/sdr preenchidos — o resto reflete deals do Pipedrive sem esses campos preenchidos, não é bug). Arquivos: `src/lib/audit-types.ts`, `src/components/audit/data-context.tsx`, `src/lib/permissions.functions.ts`, `src/components/app-sidebar.tsx`, `src/components/page-content/comissoes-content.tsx`, `src/routes/_authenticated/comissoes.tsx`.
**Próximos passos:** nenhum pendente. Se no futuro quiserem apurar comissão sobre parcelas além da primeira, o dado (`pagamentos_mensais`) já existe em `AuditRegistro` e só falta expor na UI.

## [2026-07-03] Correção: contrato sem CNPJ desaparecia da apuração de royalties

**Contexto:** clientes com `mrr_mensal > 0` e recebimento no Omie não apareciam na apuração de royalties. Causa raiz: `gerarItensApuracao` (`src/lib/royalties.functions.ts`) filtrava `.not("cnpj", "is", null)` e também pulava contratos com CNPJ vazio na montagem do `contratoMap` — o contrato sumia da apuração inteira em vez de aparecer como pendência.
**Decisão:** contrato sem CNPJ agora gera um item `categoria: "royalties"`, `status_match: "so_pipedrive"`, `cnpj: null`, com `observacao` sinalizando "Contrato sem CNPJ cadastrado — não foi possível conciliar com o Omie."
**Status:** implementado (commit `ce33c0f`, `src/lib/royalties.functions.ts:219-243`). Vale rodar "Forçar atualização" nas apurações já existentes de todas as unidades pra aplicar a correção retroativamente.

## [2026-07-03] Botão "Forçar atualização" na apuração de royalties

**Contexto:** `gerarItensApuracao` só roda uma vez por apuração (skip se já existem itens) — pagamentos/contratos que entram no Omie/Pipedrive depois da apuração já gerada nunca aparecem, mesmo com CNPJ batendo dos dois lados. Não havia forma manual de reprocessar pela UI.
**Decisão:** botão "Forçar atualização" no cabeçalho da tela de apuração (`src/routes/_authenticated/royalties.$unidadeId.$mes.tsx`), visível só quando a apuração não está fechada. Ao clicar: chama `regerarMatchApuracao` (apaga itens automáticos não confirmados) e depois `gerarItensApuracao({force: true})`. Itens confirmados ou manuais nunca são apagados.
**Status:** implementado (commit `7379874`).

## [2026-07-03] Domínio de produção consolidado em planning.opsboard.com.br

**Contexto:** existiam dois projetos Vercel deployando a mesma aplicação — `planning-dashboard` (URL antiga `planning-dashboard-mu.vercel.app`) e `revenue-auditor-hub` (URL correta, domínio custom `planning.opsboard.com.br`). Isso gerava confusão sobre qual link é o oficial.
**Decisão:** projeto Vercel `planning-dashboard` foi excluído. Único projeto válido daqui pra frente: `revenue-auditor-hub` (team `planning-ops`), domínio oficial `planning.opsboard.com.br`. Remote git local também foi simplificado — `origin` aponta direto pro `revenue-auditor-hub` (não existe mais remote `prod` separado).
**Status:** implementado (projeto Vercel excluído, remotes confirmados). Pendente: configurar redirect 308 de `revenue-auditor-hub.vercel.app` → `planning.opsboard.com.br` no painel da Vercel (Settings → Domains → Edit no domínio `.vercel.app` → "Redirect to another domain").

## [2026-07-02] Feature de "marcar churn" na apuração de royalties — decisão perdida

**Contexto:** existem duas colunas na tabela `royalties_itens` (`churn_reportado_em`, `churn_pipefy_card_id`) que sugerem uma feature planejada de marcar um cliente como churn direto na tela de apuração de royalties. Essas colunas foram criadas direto no Supabase Studio (não há migration correspondente em `supabase/migrations/`), e nada no código (`royalties.functions.ts`, `royalties.$unidadeId.$mes.tsx`) as utiliza.
**Decisão:** **NENHUMA AINDA REGISTRADA.** Uma conversa em 2026-07-02 aparentemente definiu como essa feature deveria funcionar, mas não deixou rastro em código, migration ou memória — o contexto foi perdido. Se você (humano) lembrar o que foi decidido, descreva aqui antes de qualquer implementação.
**Status:** não implementado. Colunas existem no banco, órfãs.
**Próximos passos:** decidir (a) o que "marcar churn" deve fazer ao item da apuração (zerar+confirmar / remover / só registrar), (b) se deve refletir em `central_tratativas` (fonte oficial de churn usada em `clientes.tsx`/`rede-overview.tsx`) ou ficar restrito à apuração de royalties, (c) qual é a integração com Pipefy esperada por `churn_pipefy_card_id`.

## [2026-07-03] Feature de "marcar churn" — resolvida e implementada

**Contexto:** retoma a entrada de 2026-07-02 acima (contexto perdido). Usuário re-explicou o requisito: na apuração de royalties, precisa de forma simples de notificar churn de um cliente (data + motivo); essa ação precisa impactar o pipe "Tratativas" no Pipefy, e o pipe (via sync já existente) atualiza `central_tratativas` no Supabase. Descobri em paralelo que `sync_pipefy_tratativas.py` (script em `~/`, LaunchAgent `com.victoreliezek.pipefy-tratativas-sync`, roda a cada 15min) já existe desde 2026-07-02 17:27 e seu próprio docstring já previa este botão: "cards são criados manualmente pelo time ou via botão 'Marcar churn' na tela de royalties do Ops Board (chama a API do Pipefy direto, sem passar por este script)" — ou seja, parte da decisão perdida sobreviveu no código desse script, só a metade "criar o card" nunca foi escrita.
**Decisão:**
- Botão "Marcar churn" (ícone `UserX`) aparece só em itens da apuração com `contrato_id` preenchido (categorias Matched e Só no Pipedrive) e sem `churn_pipefy_card_id` ainda. Abre diálogo com campo de data (default hoje, editável) e motivo (obrigatório).
- Ao confirmar, chama `marcarChurn` (`src/lib/royalties.functions.ts`) que cria um card **direto na fase "Perdido"** (id `343394578`) do pipe Pipefy "Tratativas" (id `307196408`, "[PTRS-CLI-02] Central de Tratativas") — não passa pelo início do funil, decisão explícita do usuário de que a ação na apuração já é uma confirmação de churn, não uma suspeita a validar.
- Campos preenchidos no card: `unidade_de_neg_cio` (nome da praça), `mrr_r` (mrr_contratado do item), `motivo_do_churn` (texto livre), e um campo **novo** `data_do_churn` (date) — criado via API do Pipefy (`createPhaseField` na fase Perdido) porque o pipe não tinha campo de data editável (só teria a aproximação `updated_at`, insuficiente pois o cliente pode ter parado de pagar antes de o time saber).
- `royalties_itens.churn_pipefy_card_id` e `churn_reportado_em` são preenchidos no mesmo request, direto pelo backend (não espera o sync de 15min).
- Fluxo de volta (Pipefy → `central_tratativas`) usa o sync já existente — só precisou adicionar leitura do campo novo (`FIELD_DATA_CHURN = "data_do_churn"` → coluna `central_tratativas.data_churn`).
- O item da apuração de royalties **não é zerado nem confirmado automaticamente** ao marcar churn — continua com seu `valor_confirmado`/`confirmado` normais, só ganha o badge "churn" e para de mostrar o botão. Churn parcial no meio do mês ainda pode ter recebimento real a conciliar.
**Status:** implementado, mas **PENDENTE DE DEPLOY** — falta o usuário adicionar a env var `PIPEFY_TOKEN` no Vercel (Settings → Environment Variables do projeto `revenue-auditor-hub`) porque os dois tokens de API da Vercel que eu tinha (memória e CLI local) expiraram em 2026-07-02. Sem essa env var, `marcarChurn` falha em produção com "PIPEFY_TOKEN não configurado no servidor.". Arquivos: `src/lib/royalties.functions.ts` (função `marcarChurn`), `src/hooks/use-royalties.ts` (`useMarcarChurn`), `src/routes/_authenticated/royalties.$unidadeId.$mes.tsx` (`MarcarChurnButton`, botão nas seções Matched/Só no Pipedrive), `~/sync_pipefy_tratativas.py` (campo `data_do_churn`), `supabase/migrations/20260703180000_central_tratativas_data_churn.sql`. Testado manualmente via API do Pipefy (card de teste criado na fase Perdido com todos os campos e depois apagado) antes de escrever o código de produção.
**Próximos passos:** confirmar que `PIPEFY_TOKEN` foi adicionado no Vercel e rodar um teste real em produção (marcar churn de um cliente de teste, verificar que o card aparece no Pipefy e que `central_tratativas` reflete em até 15min).
