import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/server-utils";

export interface IntegracaoStatus {
  fonte: string;
  nome_exibicao: string;
  tipo: "cron" | "webhook";
  intervalo_esperado_minutos: number | null;
  observacao: string | null;
  ultima_execucao: string | null;
  ultimo_status: string | null;
  ultimo_detalhes: Record<string, unknown> | null;
  ultimo_total_registros: number | null;
  atrasada: boolean;
  minutos_desde_ultima_execucao: number | null;
}

// v_integracoes_status é uma view (migration 20260717160000) ainda não
// incluída nos types gerados do Supabase — cast explícito, mesmo padrão de
// gap de tipos já aceito em outras partes do repo (ver DECISIONS.md).
export const listIntegracoesStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("v_integracoes_status")
      .select("*")
      .order("fonte");
    if (error) {
      console.error("[listIntegracoesStatus] query failed:", error);
      throw new Error("Erro ao listar status de integrações.");
    }
    return (data ?? []) as IntegracaoStatus[];
  });
