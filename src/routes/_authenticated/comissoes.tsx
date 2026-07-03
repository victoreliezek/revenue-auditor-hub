import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ComissoesContent } from "@/components/page-content/comissoes-content";

export const Route = createFileRoute("/_authenticated/comissoes")({
  head: () => ({
    meta: [{ title: "Comissões – Planning" }],
  }),
  component: ComissoesPage,
});

function ComissoesPage() {
  useAuth();
  return (
    <AppShell title="Apuração de Comissões" subtitle="Vendas × 1º pagamento, por Closer e SDR">
      <ComissoesContent />
    </AppShell>
  );
}
