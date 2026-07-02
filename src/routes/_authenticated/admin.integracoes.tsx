import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteOmieCredential,
  listOmieCredentials,
  setOmieCredentialAtivo,
  upsertOmieCredential,
} from "@/lib/omie-credentials.functions";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Integrações – Ops Board Planning Expansão" }] }),
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = usePermissions();
  const qc = useQueryClient();

  const listFn = useServerFn(listOmieCredentials);
  const upsertFn = useServerFn(upsertOmieCredential);
  const toggleFn = useServerFn(setOmieCredentialAtivo);
  const deleteFn = useServerFn(deleteOmieCredential);

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate({ to: "/" });
  }, [roleLoading, isAdmin, navigate]);

  const credsQuery = useQuery({
    queryKey: ["omie-credentials"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const [showForm, setShowForm] = useState(false);
  const [unidade, setUnidade] = useState("");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setUnidade("");
    setAppKey("");
    setAppSecret("");
    setShowForm(false);
    setError(null);
  }

  const upsertMut = useMutation({
    mutationFn: (input: { unidade: string; app_key: string; app_secret: string; ativo: boolean }) => upsertFn({ data: input }),
    onSuccess: () => {
      resetForm();
      qc.invalidateQueries({ queryKey: ["omie-credentials"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Erro ao salvar credencial"),
  });

  const toggleMut = useMutation({
    mutationFn: (input: { id: string; ativo: boolean }) => toggleFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["omie-credentials"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["omie-credentials"] }),
  });

  if (roleLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (!isAdmin) return null;

  return (
    <AppShell title="Integrações" subtitle="Credenciais de APIs externas por unidade (ex: Omie)">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">

        <div className="rounded-lg border border-border bg-accent/30 px-4 py-2 text-xs text-muted-foreground">
          As credenciais ficam no Supabase e nunca são expostas ao navegador — apenas os scripts de sync no servidor têm acesso a elas.
          O APP_SECRET não é reexibido depois de salvo; para trocar, cadastre a unidade novamente.
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Credenciais Omie ({credsQuery.data?.length ?? 0})</h2>
          <button
            onClick={() => { setShowForm((s) => !s); setError(null); }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {showForm ? "Cancelar" : "Nova unidade"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              upsertMut.mutate({ unidade, app_key: appKey, app_secret: appSecret, ativo: true });
            }}
            className="rounded-xl border bg-card p-4 grid gap-3 sm:grid-cols-4"
          >
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-foreground">Unidade</label>
              <input required value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex: Curitiba" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-foreground">APP_KEY</label>
              <input required value={appKey} onChange={(e) => setAppKey(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-foreground">APP_SECRET</label>
              <input required type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono" />
            </div>
            <div className="sm:col-span-4 flex justify-end">
              <button type="submit" disabled={upsertMut.isPending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {upsertMut.isPending ? "Salvando..." : "Salvar credencial"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-accent/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Unidade</th>
                <th className="px-4 py-2">APP_KEY</th>
                <th className="px-4 py-2">APP_SECRET</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Atualizado em</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {credsQuery.isLoading && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {credsQuery.data?.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 font-medium text-foreground">{c.unidade}</td>
                  <td className="px-4 py-2 font-mono text-xs text-foreground">{c.app_key}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{c.app_secret_masked}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleMut.mutate({ id: c.id, ativo: !c.ativo })}
                      disabled={toggleMut.isPending}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        c.ativo
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.ativo ? "Ativa" : "Inativa"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {c.updated_at ? new Date(c.updated_at).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => { if (confirm(`Excluir credencial de ${c.unidade}?`)) deleteMut.mutate(c.id); }}
                      disabled={deleteMut.isPending}
                      className="rounded-full border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {credsQuery.data && credsQuery.data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhuma credencial cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
