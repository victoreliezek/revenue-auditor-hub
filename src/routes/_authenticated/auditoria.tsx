import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/auditoria")({
  beforeLoad: () => {
    throw redirect({ to: "/funil-receita" });
  },
  component: () => null,
});
