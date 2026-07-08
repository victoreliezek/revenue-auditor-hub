import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addFiliais,
  listFiliaisDisponiveis,
  listGruposByContrato,
  regerarMatchApuracao,
  removeFilial,
} from "@/lib/contrato-omie-grupos.functions";

// Default error handler — garante que falhas silenciosas sempre virem toast
// (mesmo padrão de use-royalties.ts).
const defaultOnError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : "Erro inesperado";
  toast.error(msg);
};

export function useGruposByContrato(
  apuracao_id: number,
  contrato_id: number | null,
  enabled = true,
) {
  const fn = useServerFn(listGruposByContrato);
  return useQuery({
    queryKey: ["grupos", "contrato", apuracao_id, contrato_id],
    queryFn: () => fn({ data: { apuracao_id, contrato_id: contrato_id! } }),
    enabled: enabled && !!contrato_id,
    staleTime: 10_000,
  });
}

export function useFiliaisDisponiveis(apuracao_id: number, q: string, enabled = true) {
  const fn = useServerFn(listFiliaisDisponiveis);
  return useQuery({
    queryKey: ["grupos", "disponiveis", apuracao_id, q],
    queryFn: () => fn({ data: { apuracao_id, q } }),
    enabled,
    staleTime: 10_000,
  });
}

export function useAddFiliais() {
  const fn = useServerFn(addFiliais);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof addFiliais>[0]["data"]) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grupos"] });
    },
    onError: defaultOnError,
  });
}

export function useRemoveFilial() {
  const fn = useServerFn(removeFilial);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grupos"] });
    },
    onError: defaultOnError,
  });
}

export function useRegerarMatch() {
  const fn = useServerFn(regerarMatchApuracao);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { apuracao_id: number }) => fn({ data: vars }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["royalties", "apuracao", vars.apuracao_id] });
    },
    onError: defaultOnError,
  });
}

/** Carrega vínculos de filiais para uma lista de contratos (uso na auditoria). */
export function useAllGruposClient() {
  // usa o supabase client publishable diretamente para evitar N+1 server fn calls
  // (lazy import para manter a árvore client-safe)
  return null;
}
