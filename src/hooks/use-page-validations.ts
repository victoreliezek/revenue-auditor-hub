import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { listPageValidations } from "@/lib/page-validations.functions";

export function usePageValidations() {
  const { user } = useAuth();
  const fn = useServerFn(listPageValidations);
  return useQuery({
    queryKey: ["page-validations"],
    queryFn: () => fn(),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useIsPageValidated(pageKey: string): boolean | null {
  const q = usePageValidations();
  if (!q.data) return null;
  const row = q.data.rows.find((r) => r.page_key === pageKey);
  return row?.validated ?? false;
}
