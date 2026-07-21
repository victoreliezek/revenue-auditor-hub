import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dre-partners")({
  beforeLoad: () => {
    throw redirect({ to: "/financeiro-partners", search: { tab: "fcx" } });
  },
  component: () => null,
});
