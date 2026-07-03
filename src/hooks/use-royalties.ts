import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addItemManual,
  deleteItem,
  fecharApuracao,
  gerarItensApuracao,
  getApuracao,
  getOrCreateApuracao,
  listRoyaltiesUnidades,
  marcarChurn,
  reabrirApuracao,
  updateApuracao,
  updateItem,
} from "@/lib/royalties.functions";

// Default error handler — garante que falhas silenciosas sempre virem toast.
const defaultOnError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : "Erro inesperado";
  toast.error(msg);
};

export function useRoyaltiesUnidades(mes: string) {
  const fn = useServerFn(listRoyaltiesUnidades);
  return useQuery({
    queryKey: ["royalties", "unidades", mes],
    queryFn: () => fn({ data: { mes } }),
    staleTime: 30_000,
  });
}

export function useApuracao(apuracaoId: number | null) {
  const fn = useServerFn(getApuracao);
  return useQuery({
    queryKey: ["royalties", "apuracao", apuracaoId],
    queryFn: () => fn({ data: { apuracao_id: apuracaoId! } }),
    enabled: !!apuracaoId,
    staleTime: 10_000,
  });
}

export function useGetOrCreate() {
  const fn = useServerFn(getOrCreateApuracao);
  return useMutation({
    mutationFn: (vars: { unidade_id: number; mes: string }) => fn({ data: vars }),
    onError: defaultOnError,
  });
}

export function useGerarItens() {
  const fn = useServerFn(gerarItensApuracao);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { apuracao_id: number; force?: boolean }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["royalties", "apuracao", vars.apuracao_id] });
      qc.invalidateQueries({ queryKey: ["royalties", "unidades"] });
    },
    onError: defaultOnError,
  });
}


export function useUpdateItem(apuracaoId: number) {
  const fn = useServerFn(updateItem);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof updateItem>[0]["data"]) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["royalties", "apuracao", apuracaoId] }),
    onError: defaultOnError,
  });
}

export function useMarcarChurn(apuracaoId: number) {
  const fn = useServerFn(marcarChurn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof marcarChurn>[0]["data"]) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["royalties", "apuracao", apuracaoId] }),
    onError: defaultOnError,
  });
}

export function useAddItem(apuracaoId: number) {
  const fn = useServerFn(addItemManual);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof addItemManual>[0]["data"]) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["royalties", "apuracao", apuracaoId] }),
    onError: defaultOnError,
  });
}

export function useDeleteItem(apuracaoId: number) {
  const fn = useServerFn(deleteItem);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["royalties", "apuracao", apuracaoId] }),
    onError: defaultOnError,
  });
}

export function useUpdateApuracao(apuracaoId: number) {
  const fn = useServerFn(updateApuracao);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof updateApuracao>[0]["data"]) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["royalties", "apuracao", apuracaoId] }),
    onError: defaultOnError,
  });
}

export function useFecharApuracao(apuracaoId: number) {
  const fn = useServerFn(fecharApuracao);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn({ data: { id: apuracaoId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["royalties"] });
    },
    onError: defaultOnError,
  });
}

export function useReabrirApuracao(apuracaoId: number) {
  const fn = useServerFn(reabrirApuracao);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn({ data: { id: apuracaoId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["royalties"] });
    },
    onError: defaultOnError,
  });
}
