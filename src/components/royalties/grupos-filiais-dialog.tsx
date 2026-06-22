import { useState } from "react";
import { Link2, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/components/audit/format";
import {
  useAddFiliais,
  useFiliaisDisponiveis,
  useGruposByContrato,
  useRegerarMatch,
  useRemoveFilial,
} from "@/hooks/use-grupos-filiais";
import { useGerarItens } from "@/hooks/use-royalties";
import { useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

function formatCnpj(s: string): string {
  const d = (s ?? "").replace(/\D+/g, "");
  if (d.length !== 14) return s;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export interface GruposFiliaisDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  apuracaoId: number;
  contratoId: number;
  razaoSocial: string;
  cnpjPrincipal: string | null;
  unidade: string;
}

export function GruposFiliaisDialog({
  open,
  onOpenChange,
  apuracaoId,
  contratoId,
  razaoSocial,
  cnpjPrincipal,
  unidade,
}: GruposFiliaisDialogProps) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, { razao: string }>>({});

  const grupos = useGruposByContrato(apuracaoId, contratoId, open);
  const disp = useFiliaisDisponiveis(apuracaoId, q, open);
  const add = useAddFiliais();
  const remove = useRemoveFilial();
  const regerar = useRegerarMatch();
  const gerar = useGerarItens();
  const qc = useQueryClient();

  const refazerMatch = async () => {
    await regerar.mutateAsync({ apuracao_id: apuracaoId });
    await gerar.mutateAsync({ apuracao_id: apuracaoId, force: true });
    qc.invalidateQueries({ queryKey: ["royalties", "apuracao", apuracaoId] });
  };


  const filiais = grupos.data?.filiais ?? [];
  const disponiveis = disp.data?.disponiveis ?? [];

  const handleSalvar = async () => {
    const list = Object.entries(selected).map(([cpf_cnpj, v]) => ({
      cpf_cnpj,
      razao_social: v.razao,
    }));
    if (list.length === 0) {
      onOpenChange(false);
      return;
    }
    try {
      await add.mutateAsync({ contrato_id: contratoId, unidade, filiais: list });
      await refazerMatch();
      toast.success(`${list.length} filial(is) vinculada(s).`);
      setSelected({});
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao vincular");
    }
  };

  const handleRemover = async (id: number) => {
    try {
      await remove.mutateAsync({ id });
      await refazerMatch();
      toast.success("Filial removida");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover");
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Grupo / Filiais — {razaoSocial}
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            CNPJ principal (Pipedrive): <span className="font-mono">{formatCnpj(cnpjPrincipal ?? "")}</span>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {/* Seção A */}
          <section>
            <div className="text-sm font-medium mb-2">Filiais vinculadas ({filiais.length})</div>
            {grupos.isLoading ? (
              <div className="text-xs text-muted-foreground">Carregando…</div>
            ) : filiais.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                Nenhuma filial vinculada ainda.
              </div>
            ) : (
              <div className="rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Razão social (Omie)</th>
                      <th className="px-3 py-2 text-left">CNPJ</th>
                      <th className="px-3 py-2 text-right">Recebido no mês</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filiais.map((f) => (
                      <tr key={f.id} className="border-t">
                        <td className="px-3 py-2">{f.razao_social ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{formatCnpj(f.cpf_cnpj)}</td>
                        <td className="px-3 py-2 text-right">{brl(f.valor_recebido_mes)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleRemover(f.id)}
                            disabled={remove.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Seção B */}
          <section>
            <div className="text-sm font-medium mb-2">Adicionar filiais disponíveis</div>
            <Input
              placeholder="Buscar por razão social ou CNPJ…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-72 overflow-auto rounded border">
              {disp.isLoading ? (
                <div className="p-3 text-xs text-muted-foreground">Carregando…</div>
              ) : disponiveis.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground italic">
                  Nenhuma filial disponível no mês.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left">Razão social</th>
                      <th className="px-3 py-2 text-left">CNPJ</th>
                      <th className="px-3 py-2 text-right">Recebido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disponiveis.map((d) => {
                      const checked = !!selected[d.cpf_cnpj];
                      return (
                        <tr key={d.cpf_cnpj} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                setSelected((s) => {
                                  const ns = { ...s };
                                  if (c) ns[d.cpf_cnpj] = { razao: d.razao_social };
                                  else delete ns[d.cpf_cnpj];
                                  return ns;
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">{d.razao_social}</td>
                          <td className="px-3 py-2 font-mono text-xs">{formatCnpj(d.cpf_cnpj)}</td>
                          <td className="px-3 py-2 text-right">{brl(d.valor_recebido)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {Object.keys(selected).length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Badge variant="secondary">{Object.keys(selected).length} selecionada(s)</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setSelected({})}
                >
                  <X className="h-3 w-3 mr-1" /> limpar
                </Button>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={add.isPending || regerar.isPending || Object.keys(selected).length === 0}
          >
            Salvar vínculos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
