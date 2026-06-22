import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNps } from "@/lib/nps.functions";

export function useNps() {
  const fn = useServerFn(listNps);
  return useQuery({
    queryKey: ["nps"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
