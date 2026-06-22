import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContasReceber } from "@/lib/contas-receber.functions";

export function useContasReceber() {
  const fn = useServerFn(listContasReceber);
  return useQuery({
    queryKey: ["contas-receber"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
