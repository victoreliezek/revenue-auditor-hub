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
