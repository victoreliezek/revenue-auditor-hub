import { createFileRoute, Navigate } from "@tanstack/react-router";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/")({
  component: RootRedirect,
});

function RootRedirect() {
  const { primaryRole, loading } = usePermissions();
  if (loading) return null;
  if (primaryRole === "socio_franqueado") {
    return <Navigate to="/painel-unidade" replace />;
  }
  return <Navigate to="/rede-overview" replace />;
}
