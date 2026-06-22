import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "diretor" | "socio" | "head" | "auditor" | "socio_franqueado";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.error("[ensureAdmin] user_roles query failed:", error);
    throw new Error("Erro de autorização. Tente novamente.");
  }
  if (!data) throw new Error("Acesso negado: somente administradores.");
}

function pickPrimaryRole(roles: Role[]): Role {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("head")) return "head";
  if (roles.includes("auditor")) return "auditor";
  if (roles.includes("socio_franqueado")) return "socio_franqueado";
  if (roles.includes("socio")) return "socio";
  return "diretor";
}


export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, nome, email, created_at")
      .order("created_at", { ascending: false });
    if (pErr) {
      console.error("[adminListUsers] profiles query failed:", pErr);
      throw new Error("Erro ao listar usuários. Tente novamente.");
    }
    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) {
      console.error("[adminListUsers] roles query failed:", rErr);
      throw new Error("Erro ao listar usuários. Tente novamente.");
    }
    const rolesByUser = new Map<string, Role[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      rolesByUser.set(r.user_id, arr);
    }

    // For sócios, look up their unidade from socios table by email.
    const { data: socios } = await supabaseAdmin
      .from("socios")
      .select("email, unidade");
    const emailToUnidade = new Map<string, string>();
    for (const s of socios ?? []) {
      if (s.email && s.unidade) emailToUnidade.set(s.email.trim().toLowerCase(), s.unidade);
    }

    return (profiles ?? []).map((p) => {
      const userRoles = rolesByUser.get(p.user_id) ?? [];
      const role = pickPrimaryRole(userRoles);
      const isSocio = role === "socio" || role === "socio_franqueado";
      const unidade = isSocio ? emailToUnidade.get((p.email ?? "").trim().toLowerCase()) ?? null : null;
      return {
        user_id: p.user_id,
        nome: p.nome,
        email: p.email,
        created_at: p.created_at,
        role,
        unidade,
      };
    });

  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string; email: string; role: Role; password: string }) => {
    const nome = (input?.nome ?? "").trim();
    const email = (input?.email ?? "").trim().toLowerCase();
    const role = input?.role;
    const password = input?.password ?? "";
    if (!nome) throw new Error("Nome é obrigatório.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido.");
    if (role !== "admin" && role !== "diretor" && role !== "socio" && role !== "head" && role !== "auditor" && role !== "socio_franqueado") throw new Error("Papel inválido.");
    if (password.length < 8) throw new Error("Senha deve ter pelo menos 8 caracteres.");
    return { nome, email, role, password };
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createErr || !created.user) {
      console.error("[adminCreateUser] createUser failed:", createErr);
      throw new Error("Falha ao criar usuário. Tente novamente.");
    }
    const userId = created.user.id;

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ user_id: userId, nome: data.nome, email: data.email }, { onConflict: "user_id" });
    if (profileErr) console.error("[adminCreateUser] profile upsert failed:", profileErr);

    // Trigger insere 'diretor'. Ajustar conforme papel pedido:
    if (data.role !== "diretor") {
      // Remover 'diretor' default e inserir o papel correto
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "diretor");
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
      if (roleErr) console.error("[adminCreateUser] role upsert failed:", roleErr);
    }

    // Para sócio (qualquer tipo), busca a unidade pelo email
    let unidade: string | null = null;
    if (data.role === "socio" || data.role === "socio_franqueado") {
      const { data: socio } = await supabaseAdmin
        .from("socios")
        .select("unidade")
        .ilike("email", data.email)
        .maybeSingle();
      unidade = socio?.unidade ?? null;
    }


    return { user_id: userId, email: data.email, unidade };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; password: string }) => {
    if (!input?.user_id) throw new Error("user_id obrigatório.");
    if (!UUID_RE.test(input.user_id)) throw new Error("user_id inválido.");
    const password = input?.password ?? "";
    if (password.length < 8) throw new Error("Senha deve ter pelo menos 8 caracteres.");
    return { user_id: input.user_id, password };
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error || !updated.user) {
      console.error("[adminResetPassword] updateUserById failed:", error);
      throw new Error("Falha ao redefinir senha. Tente novamente.");
    }
    return { user_id: data.user_id, email: updated.user.email ?? "" };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => {
    if (!input?.user_id) throw new Error("user_id obrigatório.");
    if (!UUID_RE.test(input.user_id)) throw new Error("user_id inválido.");
    return { user_id: input.user_id };
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir sua própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) {
      console.error("[adminDeleteUser] deleteUser failed:", error);
      throw new Error("Falha ao excluir usuário. Tente novamente.");
    }
    return { ok: true };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; nome: string }) => {
    if (!input?.user_id || !UUID_RE.test(input.user_id)) throw new Error("user_id inválido.");
    const nome = (input?.nome ?? "").trim();
    if (!nome) throw new Error("Nome é obrigatório.");
    return { user_id: input.user_id, nome };
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome })
      .eq("user_id", data.user_id);
    if (pErr) {
      console.error("[adminUpdateUser] profile update failed:", pErr);
      throw new Error("Falha ao atualizar nome.");
    }
    const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      user_metadata: { nome: data.nome },
    });
    if (aErr) console.error("[adminUpdateUser] auth metadata update failed:", aErr);
    return { ok: true };
  });
