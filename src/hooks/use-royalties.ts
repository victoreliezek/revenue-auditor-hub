import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  addItemManual,
  atualizarCnpjContrato,
  deleteItem,
  excluirItemMes,
  fecharApuracao,
  garantirApuracoesAno,
  gerarItensApuracao,
  getApuracao,
  getOrCreateApuracao,
  listRoyaltiesUnidades,
  marcarChurn,
  reabrirApuracao,
  reincluirItemMes,
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

export function useAtualizarCnpjContrato(apuracaoId: number) {
  const fn = useServerFn(atualizarCnpjContrato);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Parameters<typeof atualizarCnpjContrato>[0]["data"]) => fn({ data: vars }),
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

export function useExcluirItem(apuracaoId: number) {
  const fn = useServerFn(excluirItemMes);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { item_id: number; motivo: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["royalties", "apuracao", apuracaoId] }),
    onError: defaultOnError,
  });
}

export function useReincluirItem(apuracaoId: number) {
  const fn = useServerFn(reincluirItemMes);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { item_id: number }) => fn({ data: vars }),
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

// ============ useRoyaltiesPorUnidade ============
// Valor de royalties por unidade/mês vindo direto da apuração — fonte única
// pra Royalties na aba Receitas/DRE Partners (substitui entrada manual).
// Chave do Map: "NomeUnidade|MM" (mês com 2 dígitos). realizado = apuração
// fechada (confirmado/faturado); do contrário é projeção (rascunho/em_revisao).
export type RoyaltiesPorUnidadeInfo = { valor: number; status: string; realizado: boolean };

export function useRoyaltiesPorUnidade(ano: number) {
  return useQuery({
    queryKey: ["royalties", "por-unidade", ano],
    queryFn: async () => {
      const [uRes, apRes] = await Promise.all([
        supabase.from("unidades").select("id,nome_da_praca").eq("tipo", "regional"),
        supabase
          .from("royalties_apuracao")
          .select("unidade_id,mes_referencia,royalties_valor,status")
          .gte("mes_referencia", `${ano}-01-01`)
          .lte("mes_referencia", `${ano}-12-31`),
      ]);
      if (uRes.error) throw uRes.error;
      if (apRes.error) throw apRes.error;

      const nomePorUnidadeId = new Map<number, string>();
      (uRes.data ?? []).forEach((u: any) => nomePorUnidadeId.set(u.id, u.nome_da_praca));

      const map = new Map<string, RoyaltiesPorUnidadeInfo>();
      for (const a of apRes.data ?? []) {
        const nome = nomePorUnidadeId.get(a.unidade_id);
        if (!nome) continue;
        const mes = String(a.mes_referencia).slice(5, 7);
        const realizado = a.status === "confirmado" || a.status === "faturado";
        map.set(`${nome}|${mes}`, {
          valor: Number(a.royalties_valor ?? 0),
          status: a.status,
          realizado,
        });
      }
      return map;
    },
    staleTime: 30_000,
  });
}

export function useGarantirApuracoesAno() {
  const fn = useServerFn(garantirApuracoesAno);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ano: number }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["royalties", "por-unidade"] });
    },
    onError: defaultOnError,
  });
}
