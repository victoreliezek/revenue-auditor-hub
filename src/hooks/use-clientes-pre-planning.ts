import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClientesPrePlanning } from "@/lib/clientes-pre-planning.functions";

export function useClientesPrePlanning() {
  const fn = useServerFn(listClientesPrePlanning);
  return useQuery({
    queryKey: ["clientes-pre-planning"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
}
