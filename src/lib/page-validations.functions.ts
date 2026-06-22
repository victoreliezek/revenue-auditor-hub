import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAGE_DEFS, ensureAdmin } from "./page-validations.server";

export { PAGE_DEFS };

export const listPageValidations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("page_validations")
      .select("page_key, validated, notes, updated_at");
    if (error) throw new Error("Erro ao carregar validações.");
    return { rows: data ?? [], pages: PAGE_DEFS };
  });

export const setPageValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { page_key: string; validated: boolean; notes?: string | null }) => {
    if (!input.page_key) throw new Error("page_key obrigatório.");
    return {
      page_key: input.page_key,
      validated: !!input.validated,
      notes: input.notes ?? null,
    };
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("page_validations")
      .upsert({
        page_key: data.page_key,
        validated: data.validated,
        notes: data.notes,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error("Erro ao salvar validação.");
    return { ok: true };
  });
