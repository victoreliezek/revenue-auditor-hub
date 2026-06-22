// Shared helpers for server functions. No secrets, no client.server imports —
// safe to import from any *.functions.ts or *.server.ts file.

export function digits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

export function monthRange(mes: string): { start: string; end: string; firstDay: string } {
  // mes: 'YYYY-MM'
  const [y, m] = mes.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startStr = fmt(start);
  return { start: startStr, end: fmt(end), firstDay: startStr };
}

/** Verifica perfil admin via RPC `has_role`. Lança Error em caso de negação. */
export async function assertAdmin(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: necessário perfil admin.");
}
