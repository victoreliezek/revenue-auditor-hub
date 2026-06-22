## Objetivo

Trazer **Royalties** e **CSC variável (base antiga)** automaticamente para a DRE Projetada, calculados a partir da carteira (MRR) de cada unidade — sem precisar cadastrar item a item nem digitar valor mensal.

Hoje a DRE já tem CSC fixo e Verba de Mídia (cadastrados em `receitas_cm_fornecedores`). Falta o que depende da carteira:

- **Royalties** = `MRR da unidade × royalties_percentual` (já existe na função `billing_esperado(mes)`).
- **CSC variável** = `MRR × csc_percentual_base_antiga` quando a unidade é "base antiga" (Curitiba e Patos de Minas, hoje). A função atual não devolve esse valor — preciso adicionar.

## Como vai funcionar

1. **Função SQL nova `billing_esperado_ano(ano int)`** — devolve, para cada unidade e cada mês do ano, o MRR de clientes ativos naquele mês, royalties esperado e CSC variável esperado. É a `billing_esperado` atual ampliada para o ano inteiro e com o campo `csc_variavel_esp = MRR × csc_percentual_base_antiga`.

2. **No frontend (DRE Projetada, visões "Base — Total" e "Base — Partners")**: além dos itens em `receitas_cm_fornecedores` e dos avulsos, injeto itens sintéticos (prefixo `bil:`) — um por unidade e por tipo:
   - "Royalties — {Unidade}" (categoria `Royalties`, grupo `entrada`)
   - "CSC variável — {Unidade}" (categoria `CSC variável`, grupo `entrada`), só para unidades com `csc_percentual_base_antiga > 0`
   - Os 12 valores mensais vêm da função SQL.

3. **Categorias** — crio em `dre_sim_categorias` (se não existirem) `Royalties` e `CSC variável`, ambas natureza `receita`, `grupo_dre = entrada`, para entrarem no bloco RECEITAS BRUTAS automaticamente.

4. **Comportamento na UI**:
   - Esses itens são **read-only** (igual aos avulsos hoje): aparecem no resumo e na aba "Receitas" sem botão de editar/excluir.
   - Atualizam sozinhos quando a carteira muda (novos contratos ganhos, churn, etc.).
   - Só aparecem nas visões base (cenários alternativos continuam puros).

## Arquivos afetados

- Migration: nova função `billing_esperado_ano(ano)` + inserts em `dre_sim_categorias` para `Royalties` e `CSC variável`.
- `src/components/financeiro-partners/dre-projetada/data.ts`: nova função `listBillingEsperadoAno(ano)` que chama a SQL e devolve `{ itens, valores }` no mesmo formato de `listAvulsosAno`.
- `src/components/financeiro-partners/dre-projetada/index.tsx`: no `reloadItens`, quando `cenarioId === null`, concatenar o resultado de `listBillingEsperadoAno(ano)` junto com os avulsos.

## Fora do escopo

- Botão "materializar" (gravar como overrides editáveis) — fica para depois se você quiser sobrescrever mês a mês.
- Alterar o cálculo da `billing_esperado` original (mantenho ela como está; a nova é por ano).
- Trazer Verba de Mídia automática (continua cadastrada manualmente; valor é fixo por unidade, não depende de carteira).
