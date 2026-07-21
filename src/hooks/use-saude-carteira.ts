import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSaudeCarteira } from "@/lib/saude-carteira.functions";

export function useSaudeCarteira() {
  const fn = useServerFn(listSaudeCarteira);
  return useQuery({
    queryKey: ["saude-carteira"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
