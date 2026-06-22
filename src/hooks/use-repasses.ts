import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  excluirRepasse,
  importarRepasses,
  lancarRepasseManual,
  listarRepasses,
  type RepasseRow,
  type TipoRepasse,
} from "@/lib/repasses.functions";

export function useRepasses(tipo: TipoRepasse) {
  const qc = useQueryClient();
  const fnList = useServerFn(listarRepasses);
  const fnLanc = useServerFn(lancarRepasseManual);
  const fnImp = useServerFn(importarRepasses);
  const fnDel = useServerFn(excluirRepasse);

  const list = useQuery({
    queryKey: ["repasses", tipo],
    queryFn: () => fnList({ data: { tipo } }),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["repasses", tipo] });

  const lancar = useMutation({
    mutationFn: (input: { unidade: string; competencia: string; valor: number; observacao?: string }) =>
      fnLanc({ data: { ...input, tipo } }),
    onSuccess: invalidate,
  });

  const importar = useMutation({
    mutationFn: (input: {
      competencia: string;
      arquivo_nome?: string;
      linhas: { unidade: string; valor: number }[];
    }) => fnImp({ data: { ...input, tipo } }),
    onSuccess: invalidate,
  });

  const excluir = useMutation({
    mutationFn: (id: string) => fnDel({ data: { id } }),
    onSuccess: invalidate,
  });

  return {
    rows: (list.data?.rows ?? []) as RepasseRow[],
    loading: list.isLoading,
    error: list.error,
    refetch: list.refetch,
    lancar,
    importar,
    excluir,
  };
}
