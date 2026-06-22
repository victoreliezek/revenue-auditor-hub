import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Cadastro = { id: string; nome: string };

async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function useDepartamentosDespesa() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cadastros-departamentos-despesa"],
    queryFn: async (): Promise<Cadastro[]> => {
      const { data, error } = await supabase
        .from("dre_sim_departamentos")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const criar = useMutation({
    mutationFn: async (nome: string) => {
      const uid = await getUid();
      if (!uid) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("dre_sim_departamentos")
        .insert({ nome: nome.trim(), user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadastros-departamentos-despesa"] }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dre_sim_departamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadastros-departamentos-despesa"] }),
  });

  return { items: q.data ?? [], loading: q.isLoading, criar, excluir };
}

export function useCategoriasDespesa() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cadastros-categorias-despesa"],
    queryFn: async (): Promise<Cadastro[]> => {
      const { data, error } = await supabase
        .from("dre_sim_categorias")
        .select("id, nome")
        .eq("natureza", "despesa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const criar = useMutation({
    mutationFn: async (nome: string) => {
      const uid = await getUid();
      if (!uid) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("dre_sim_categorias")
        .insert({ nome: nome.trim(), natureza: "despesa", user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadastros-categorias-despesa"] }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dre_sim_categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadastros-categorias-despesa"] }),
  });

  return { items: q.data ?? [], loading: q.isLoading, criar, excluir };
}
