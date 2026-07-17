import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "@/lib/notificacoes.functions";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";

const QUERY_KEY = ["notificacoes"];

export function useNotificacoes() {
  const { isAdmin } = usePermissions();
  const fn = useServerFn(listNotificacoes);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fn(),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("notificacoes-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes" }, () =>
        qc.invalidateQueries({ queryKey: QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  return query;
}

export function useMarcarNotificacaoLida() {
  const fn = useServerFn(marcarNotificacaoLida);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useMarcarTodasNotificacoesLidas() {
  const fn = useServerFn(marcarTodasNotificacoesLidas);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
