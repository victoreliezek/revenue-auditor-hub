import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/server-utils";

// ============ syncTratativas ============
// Versão server-side de ~/sync_pipefy_tratativas.py (que roda a cada 15min via
// LaunchAgent) — permite forçar uma atualização imediata pelo botão da tela
// Tratativas em vez de esperar o próximo ciclo do cron local. Mesma lógica de
// mapeamento de campos; manter as duas em sincronia se os field_id do pipe
// mudarem (ver PHASE_STATUS/FIELD_* abaixo).
const PIPE_ID = "307196408";

const PHASE_STATUS: Record<string, "won" | "lost"> = {
  "343394577": "won", // Recuperado
  "343394578": "lost", // Perdido
  "343394579": "lost", // Arquivado
};

const FIELD_UNIDADE = "unidade_de_neg_cio";
const FIELD_MRR = "mrr_r";
const FIELD_MOTIVO = "categoria_do_churn";
const FIELD_OBSERVACAO = "motivo_do_churn";
const FIELD_DATA_CHURN = "data_do_churn";
const FIELD_PIPEDRIVE_DEAL_ID = "id_deal_pipedrive";

const CARDS_QUERY = `
  query($pipeId: ID!, $after: String) {
    allCards(pipeId: $pipeId, first: 50, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          current_phase { id name }
          updated_at
          fields { field { id } value }
        }
      }
    }
  }
`;

function parseMrr(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function parseDealId(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

async function pipefyGraphql(token: string, query: string, variables: Record<string, unknown>) {
  const resp = await fetch("https://api.pipefy.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await resp.json();
  if (body.errors) throw new Error(`Pipefy: ${body.errors[0]?.message ?? "erro desconhecido"}`);
  return body.data;
}

async function fetchAllCards(token: string) {
  const cards: any[] = [];
  let after: string | null = null;
  while (true) {
    const data = await pipefyGraphql(token, CARDS_QUERY, { pipeId: PIPE_ID, after });
    const conn = data.allCards;
    cards.push(...conn.edges.map((e: any) => e.node));
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return cards;
}

function mapCard(card: any) {
  const fieldMap = new Map<string, string>(card.fields.map((f: any) => [f.field.id, f.value]));
  const phaseId = card.current_phase.id as string;
  const status = PHASE_STATUS[phaseId] ?? "open";
  return {
    pipefy_card_id: String(card.id),
    titulo: card.title,
    estagio: card.current_phase.name,
    status,
    unidade: fieldMap.get(FIELD_UNIDADE) ?? null,
    mrr: parseMrr(fieldMap.get(FIELD_MRR)),
    motivo: fieldMap.get(FIELD_MOTIVO) ?? null,
    observacao: fieldMap.get(FIELD_OBSERVACAO) ?? null,
    data_churn: fieldMap.get(FIELD_DATA_CHURN) || null,
    pipedrive_deal_id: parseDealId(fieldMap.get(FIELD_PIPEDRIVE_DEAL_ID)),
    update_time: card.updated_at ?? null,
    // allCards não expõe histórico de fases — updated_at como aproximação.
    stage_change_time: card.updated_at ?? null,
  };
}

export const syncTratativas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ total: number; removidos: number }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const pipefyToken = process.env.PIPEFY_TOKEN;
    if (!pipefyToken) throw new Error("PIPEFY_TOKEN não configurado no servidor.");

    const start = Date.now();
    const cards = await fetchAllCards(pipefyToken);
    const rows = cards.map(mapCard);

    const { error: upsertErr } = await supabase
      .from("central_tratativas")
      .upsert(rows, { onConflict: "pipefy_card_id" });
    if (upsertErr) throw new Error(upsertErr.message);

    const currentIds = new Set(rows.map((r) => r.pipefy_card_id));
    const { data: existing, error: exErr } = await supabase
      .from("central_tratativas")
      .select("pipefy_card_id");
    if (exErr) throw new Error(exErr.message);
    const staleIds = (existing ?? [])
      .map((e: any) => String(e.pipefy_card_id))
      .filter((id: string) => !currentIds.has(id));

    if (staleIds.length > 0) {
      const { error: delErr } = await supabase
        .from("central_tratativas")
        .delete()
        .in("pipefy_card_id", staleIds);
      if (delErr) throw new Error(delErr.message);
    }

    const duracao = Math.round((Date.now() - start) / 1000);
    await supabase.from("sync_log").insert({
      fonte: "pipefy_tratativas",
      executado_em: new Date().toISOString(),
      duracao_segundos: duracao,
      total_registros: rows.length,
      detalhes: { pipe_id: PIPE_ID, cards: rows.length, removidos: staleIds.length, trigger: "manual" },
      status: "sucesso",
    });

    return { total: rows.length, removidos: staleIds.length };
  });
