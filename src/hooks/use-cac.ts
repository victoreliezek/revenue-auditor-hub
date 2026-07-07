import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addItemManualCac,
  deleteItemCac,
  excluirItemMesCac,
  fecharApuracaoCac,
  gerarItensApuracaoCac,
  getApuracaoCac,
  getOrCreateApuracaoCac,
  listApuracaoCacItensUnidade,
  listCacUnidades,
  reabrirApuracaoCac,
  reincluirItemMesCac,
  updateItemCac,
} from "@/lib/cac.functions";
// Reaproveitado de royalties — atualizarCnpjContrato só atualiza contratos.cnpj,
// não tem nada específico de royalties, não faz sentido duplicar.
import { atualizarCnpjContrato } from "@/lib/royalties.functions";

const defaultOnError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : "Erro inesperado";
  toast.error(msg);
};

export function useCacUnidades(mes: string) {
  const fn = useServerFn(listCacUnidades);
  return useQuery({
    queryKey: ["cac", "unidades", mes],
    queryFn: () => fn({ data: { mes } }),
    staleTime: 30_000,
  });
}

export function useApuracaoCac(apuracaoId: number | null) {
  const fn = useServerFn(getApuracaoCac);
  return useQuery({
    queryKey: ["cac", "apuracao", apuracaoId],
    queryFn: () => fn({ data: { apuracao_id: apuracaoId! } }),
    enabled: !!apuracaoId,
    staleTime: 10_000,
  });
}

export function useGetOrCreateCac() {
  const fn = useServerFn(getOrCreateApuracaoCac);
  return useMutation({
    mutationFn: (vars: { unidade_id: number; mes: string }) => fn({ data: vars }),
    onError: defaultOnError,
  });
}

export function useGerarItensCac() {
  const fn = useServerFn(gerarItensApuracaoCac);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { apuracao_id: number; force?: boolean }) => fn({ data: vars }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["cac", "apuracao", vars.apuracao_id] });
      qc.invalidateQueries({ queryKey: ["cac", "unidades"] });
    },
    onError: defaultOnError,
  });
}

// ============ Tela única por unidade (todos os meses numa lista só) ============

export function useApuracaoCacUnidade(unidadeId: number | null) {
  const fn = useServerFn(listApuracaoCacItensUnidade);
  return useQuery({
    queryKey: ["cac", "unidade", unidadeId],
    queryFn: () => fn({ data: { unidade_id: unidadeId! } }),
    enabled: !!unidadeId,
    staleTime: 10_000,
  });
}

export function useForcarAtualizacaoCacUnidade(unidadeId: number) {
  const fn = useServerFn(listApuracaoCacItensUnidade);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn({ data: { unidade_id: unidadeId, force: true } }),
    onSuccess: (res) => {
      qc.setQueryData(["cac", "unidade", unidadeId], res);
      qc.invalidateQueries({ queryKey: ["cac", "unidades"] });
    },
    onError: defaultOnError,
  });
}

export function useUpdateItemCac(unidadeId: number) {
  const fn = useServerFn(updateItemCac);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof updateItemCac>[0]["data"]) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cac", "unidade", unidadeId] }),
    onError: defaultOnError,
  });
}

export function useAddItemCac(unidadeId: number) {
  const fn = useServerFn(addItemManualCac);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof addItemManualCac>[0]["data"]) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cac", "unidade", unidadeId] }),
    onError: defaultOnError,
  });
}

export function useDeleteItemCac(unidadeId: number) {
  const fn = useServerFn(deleteItemCac);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cac", "unidade", unidadeId] }),
    onError: defaultOnError,
  });
}

export function useExcluirItemCac(unidadeId: number) {
  const fn = useServerFn(excluirItemMesCac);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { item_id: number; motivo: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cac", "unidade", unidadeId] }),
    onError: defaultOnError,
  });
}

export function useReincluirItemCac(unidadeId: number) {
  const fn = useServerFn(reincluirItemMesCac);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { item_id: number }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cac", "unidade", unidadeId] }),
    onError: defaultOnError,
  });
}

export function useFecharApuracaoCac(unidadeId: number) {
  const fn = useServerFn(fecharApuracaoCac);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cac", "unidade", unidadeId] });
      qc.invalidateQueries({ queryKey: ["cac", "unidades"] });
    },
    onError: defaultOnError,
  });
}

export function useAtualizarCnpjContratoCac(unidadeId: number) {
  const fn = useServerFn(atualizarCnpjContrato);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof atualizarCnpjContrato>[0]["data"]) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cac", "unidade", unidadeId] }),
    onError: defaultOnError,
  });
}

export function useReabrirApuracaoCac(unidadeId: number) {
  const fn = useServerFn(reabrirApuracaoCac);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cac", "unidade", unidadeId] });
      qc.invalidateQueries({ queryKey: ["cac", "unidades"] });
    },
    onError: defaultOnError,
  });
}
