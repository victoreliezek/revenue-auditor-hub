import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Info, Link2, Pencil, Plus, RefreshCw, Trash2, UserX } from "lucide-react";
import { GruposFiliaisDialog } from "@/components/royalties/grupos-filiais-dialog";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { brl } from "@/components/audit/format";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useAddItem,
  useApuracao,
  useAtualizarCnpjContrato,
  useDeleteItem,
  useFecharApuracao,
  useGerarItens,
  useGetOrCreate,
  useMarcarChurn,
  useReabrirApuracao,
  useUpdateApuracao,
  useUpdateItem,
} from "@/hooks/use-royalties";
import { useRegerarMatch } from "@/hooks/use-grupos-filiais";
import { cn } from "@/lib/utils";
import type { ApuracaoItem } from "@/lib/royalties.functions";

export const Route = createFileRoute("/_authenticated/royalties/$unidadeId/$mes")({
  component: ApuracaoPage,
});

function formatMesLabel(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-800" },
  em_revisao: { label: "Em revisão", cls: "bg-amber-100 text-amber-800" },
  confirmado: { label: "Confirmado", cls: "bg-emerald-100 text-emerald-800" },
  faturado: { label: "Faturado", cls: "bg-indigo-100 text-indigo-800" },
};

function ApuracaoPage() {
  const { unidadeId, mes } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin, loading } = usePermissions();
  const [apuracaoId, setApuracaoId] = useState<number | null>(null);
  const getOrCreate = useGetOrCreate();
  const gerar = useGerarItens();

  const unidadeIdNum = Number(unidadeId);
  const validUnidade = Number.isInteger(unidadeIdNum) && unidadeIdNum > 0;
  const validMes = /^\d{4}-\d{2}$/.test(mes);

  useEffect(() => {
    if (!isAdmin) return;
    if (!validUnidade || !validMes) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getOrCreate.mutateAsync({
          unidade_id: unidadeIdNum,
          mes,
        });
        if (cancelled) return;
        setApuracaoId(res.apuracao_id);
        await gerar.mutateAsync({ apuracao_id: res.apuracao_id });
      } catch (e: any) {
        if (!cancelled) toast.error(e.message ?? "Erro ao carregar apuração");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeIdNum, mes, isAdmin, validUnidade, validMes]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito a admin.</div>;
  if (!validUnidade || !validMes)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        URL inválida. Volte para <Link to="/royalties" className="underline">Royalties</Link>.
      </div>
    );


  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito a admin.</div>;
  if (!apuracaoId)
    return <div className="p-6 text-sm text-muted-foreground">Preparando apuração…</div>;

  return <ApuracaoLoaded apuracaoId={apuracaoId} mes={mes} onBack={() => navigate({ to: "/royalties" })} />;
}

function ApuracaoLoaded({
  apuracaoId,
  mes,
  onBack,
}: {
  apuracaoId: number;
  mes: string;
  onBack: () => void;
}) {
  const { data, isLoading } = useApuracao(apuracaoId);
  const updateItem = useUpdateItem(apuracaoId);
  const updateAp = useUpdateApuracao(apuracaoId);
  const fechar = useFecharApuracao(apuracaoId);
  const reabrir = useReabrirApuracao(apuracaoId);
  const addItem = useAddItem(apuracaoId);
  const deleteItem = useDeleteItem(apuracaoId);
  const gerar = useGerarItens();
  const regerar = useRegerarMatch();
  const marcarChurn = useMarcarChurn(apuracaoId);
  const atualizarCnpj = useAtualizarCnpjContrato(apuracaoId);

  const handleMarcarChurn = (it: ApuracaoItem, motivo: string, dataChurn: string) => {
    marcarChurn.mutate(
      { item_id: it.id, motivo, data_churn: dataChurn },
      {
        onSuccess: () => toast.success(`Churn registrado para ${it.razao_social}.`),
      },
    );
  };

  const forcarAtualizacao = async () => {
    try {
      // Remove primeiro os itens automáticos não confirmados (fonte pipedrive/omie);
      // sem isso o insert do gerarItensApuracao duplicaria os itens já existentes.
      await regerar.mutateAsync({ apuracao_id: apuracaoId });
      const res = await gerar.mutateAsync({ apuracao_id: apuracaoId, force: true });
      toast.success(`Apuração atualizada: ${res.created} item(ns) recalculado(s).`);
    } catch {
      // erro já tratado pelo onError padrão dos hooks
    }
  };

  const handleSalvarCnpj = async (it: ApuracaoItem, cnpj: string) => {
    if (!it.contrato_id) return;
    try {
      await atualizarCnpj.mutateAsync({ contrato_id: it.contrato_id, cnpj });
      // Mesmo fluxo do "Forçar atualização": regera o match com o CNPJ novo já salvo.
      await regerar.mutateAsync({ apuracao_id: apuracaoId });
      await gerar.mutateAsync({ apuracao_id: apuracaoId, force: true });
      toast.success(`CNPJ salvo para ${it.razao_social} — apuração atualizada.`);
    } catch {
      // erro já tratado pelo onError padrão dos hooks
    }
  };

  // optimistic local edits (debounced flush)
  const [localValor, setLocalValor] = useState<Record<number, string>>({});

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const { apuracao, itens } = data;
  const u = apuracao.unidade;
  const readOnly = apuracao.status === "confirmado" || apuracao.status === "faturado";
  const isCscVariavel = u.csc_percentual_base_antiga != null;
  const pctPadrao = Number(u.royalties_percentual ?? 0);

  const planning = itens.filter((i) => i.categoria === "royalties");
  const baseAntiga = itens.filter((i) => i.categoria === "csc_base_antiga");

  const matched = planning.filter((i) => i.status_match === "matched" || i.status_match === "divergente");
  const soPipe = planning.filter((i) => i.status_match === "so_pipedrive");
  const soOmie = planning.filter((i) => i.status_match === "so_omie");
  const manual = planning.filter((i) => i.status_match === "manual");

  const valorEfetivo = (it: ApuracaoItem): number => {
    const raw = localValor[it.id];
    if (raw !== undefined) {
      const n = Number(raw.replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }
    return Number(it.valor_confirmado ?? 0);
  };

  // totals (live)
  let receitaBase = 0;
  let royaltiesValor = 0;
  let receitaBaseAntiga = 0;
  let confirmadosCount = 0;
  for (const it of itens) {
    if (!it.confirmado) continue;
    confirmadosCount += 1;
    const v = valorEfetivo(it);
    if (it.categoria === "royalties") {
      receitaBase += v;
      const pct = it.royalties_percentual_override != null ? Number(it.royalties_percentual_override) : pctPadrao;
      royaltiesValor += (v * pct) / 100;
    } else if (it.categoria === "csc_base_antiga") {
      receitaBaseAntiga += v;
    }
  }
  const cscPctBaseAntiga = Number(u.csc_percentual_base_antiga ?? 0);
  const cscBaseAntigaValor = (receitaBaseAntiga * cscPctBaseAntiga) / 100;
  const cscFixo = u.csc_valor_fixo != null ? Number(u.csc_valor_fixo) : null;
  const cscEfetivo = cscFixo ?? (isCscVariavel ? cscBaseAntigaValor : 0);
  const outras = Number(apuracao.outras_receitas ?? 0);
  const totalFatura = cscEfetivo + royaltiesValor + outras;
  const badge = STATUS_BADGE[apuracao.status] ?? { label: apuracao.status, cls: "" };

  const flushValor = (it: ApuracaoItem) => {
    const raw = localValor[it.id];
    if (raw === undefined) return;
    const n = raw === "" ? null : Number(raw.replace(",", "."));
    if (n !== null && !Number.isFinite(n)) return;
    if (n === Number(it.valor_confirmado ?? 0)) return;
    updateItem.mutate({ id: it.id, valor_confirmado: n });
  };

  const toggleConfirm = (it: ApuracaoItem, checked: boolean) => {
    updateItem.mutate({ id: it.id, confirmado: checked });
  };

  return (
    <div className="flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-[57px] z-10 border-b bg-card/95 backdrop-blur px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Royalties
            </Button>
            <div>
              <div className="text-base font-semibold flex items-center gap-2">
                {u.nome_da_praca} — <span className="capitalize">{formatMesLabel(mes)}</span>
                <Badge className={badge.cls}>{badge.label}</Badge>
                {!readOnly && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5"
                          disabled={regerar.isPending || gerar.isPending}
                          onClick={forcarAtualizacao}
                        >
                          <RefreshCw
                            className={cn("h-3.5 w-3.5", (regerar.isPending || gerar.isPending) && "animate-spin")}
                          />
                          Forçar atualização
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Reprocessa contratos e recebimentos do Omie do zero, mantendo itens já confirmados ou
                        adicionados manualmente. Use quando um pagamento/contrato recente não aparecer na lista.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {u.observacoes_financeiras && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="text-xs whitespace-pre-wrap">{u.observacoes_financeiras}</div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <Metric label="Confirmados" value={`${confirmadosCount} / ${itens.length}`} />
            <Metric label="Base Planning" value={brl(receitaBase)} />
            <Metric label={`Royalties (${pctPadrao}%)`} value={brl(royaltiesValor)} />
            <Metric
              label="CSC"
              value={brl(cscFixo ?? cscBaseAntigaValor)}
              sub={cscFixo != null ? "fixo" : `${cscPctBaseAntiga}% base antiga`}
            />
            <Metric label="Total fatura" value={brl(totalFatura)} highlight />
          </div>
        </div>
      </div>

      {!u.tem_omie && (
        <div className="mx-6 mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Esta unidade ainda não está integrada ao Omie. Preencha os valores recebidos manualmente.
        </div>
      )}

      {readOnly && (
        <div className="mx-6 mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Apuração de {formatMesLabel(mes)} confirmada em{" "}
          {apuracao.confirmado_em
            ? new Date(apuracao.confirmado_em).toLocaleString("pt-BR")
            : "—"}
          {apuracao.confirmado_por ? ` por ${apuracao.confirmado_por}` : ""}.
        </div>
      )}

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        {/* Coluna esquerda: seções */}
        <div className="space-y-6 min-w-0">
          <SecaoGrupo
            title="✅ Matched"
            description="CNPJ existe no Pipedrive e no Omie."
            itens={matched}
            readOnly={readOnly}
            showMrr
            showRoyalties
            pctPadrao={pctPadrao}
            apuracaoId={apuracaoId}
            unidadeNome={u.nome_da_praca}
            temOmie={u.tem_omie}
            localValor={localValor}
            setLocalValor={setLocalValor}
            flushValor={flushValor}
            toggleConfirm={toggleConfirm}
            onDelete={(it) => deleteItem.mutate({ id: it.id })}
            onMarcarChurn={handleMarcarChurn}
            churnPending={marcarChurn.isPending}
          />
          <SecaoGrupo
            title="⚠️ Só no Pipedrive"
            description="Contrato ativo sem recebimento no Omie. Informe o valor recebido ou marque como inadimplente."
            itens={soPipe}
            readOnly={readOnly}
            showMrr
            showRoyalties
            pctPadrao={pctPadrao}
            apuracaoId={apuracaoId}
            unidadeNome={u.nome_da_praca}
            temOmie={u.tem_omie}
            localValor={localValor}
            setLocalValor={setLocalValor}
            flushValor={flushValor}
            toggleConfirm={toggleConfirm}
            onDelete={(it) => deleteItem.mutate({ id: it.id })}
            onMarcarChurn={handleMarcarChurn}
            churnPending={marcarChurn.isPending}
            onEditarCnpj={handleSalvarCnpj}
            editarCnpjPending={atualizarCnpj.isPending || regerar.isPending || gerar.isPending}
          />
          {!isCscVariavel && (
            <SecaoGrupo
              title="🔍 Só no Omie"
              description="Recebimento sem contrato no Pipedrive. Pode ser venda direta — confirme se entra na base de royalties."
              itens={soOmie}
              readOnly={readOnly}
              showMrr={false}
              showRoyalties
              pctPadrao={pctPadrao}
              apuracaoId={apuracaoId}
              unidadeNome={u.nome_da_praca}
              temOmie={u.tem_omie}
              localValor={localValor}
              setLocalValor={setLocalValor}
              flushValor={flushValor}
              toggleConfirm={toggleConfirm}
              onDelete={(it) => deleteItem.mutate({ id: it.id })}
            />
          )}
          <SecaoGrupo
            title="➕ Adicionados manualmente"
            description="Itens criados pelo usuário."
            itens={manual}
            readOnly={readOnly}
            showMrr={false}
            showRoyalties
            pctPadrao={pctPadrao}
            apuracaoId={apuracaoId}
            unidadeNome={u.nome_da_praca}
            temOmie={u.tem_omie}
            localValor={localValor}
            setLocalValor={setLocalValor}
            flushValor={flushValor}
            toggleConfirm={toggleConfirm}
            onDelete={(it) => deleteItem.mutate({ id: it.id })}
            extraHeader={
              !readOnly && (
                <AddItemDialog
                  onAdd={(payload) =>
                    addItem.mutate({ apuracao_id: apuracaoId, ...payload })
                  }
                />
              )
            }
          />

          {isCscVariavel && (
            <Card className="overflow-hidden">
              <div className="border-b px-4 py-3">
                <div className="font-medium">Base Antiga — CSC Variável ({cscPctBaseAntiga}%)</div>
                <div className="text-xs text-muted-foreground">
                  Clientes pré-Planning. Recebimentos geram CSC, não royalties.
                </div>
              </div>
              <BaseAntigaTable
                itens={baseAntiga}
                readOnly={readOnly}
                apuracaoId={apuracaoId}
                unidadeNome={u.nome_da_praca}
                temOmie={u.tem_omie}
                localValor={localValor}
                setLocalValor={setLocalValor}
                flushValor={flushValor}
                toggleConfirm={toggleConfirm}
                onDelete={(it) => deleteItem.mutate({ id: it.id })}
              />
            </Card>
          )}
        </div>


        {/* Sidebar de totais */}
        <Card className="p-4 space-y-4 h-fit sticky top-[140px]">
          <div className="text-sm font-semibold">Resumo da apuração</div>
          <ResumoLinha label="Clientes confirmados" value={`${confirmadosCount} / ${itens.length}`} />
          <ResumoLinha label="Base Planning" value={brl(receitaBase)} />
          <ResumoLinha label={`Royalties (${pctPadrao}%)`} value={brl(royaltiesValor)} bold />
          <div className="border-t pt-3 space-y-2">
            {cscFixo != null ? (
              <ResumoLinha label="CSC fixo" value={brl(cscFixo)} bold />
            ) : (
              <>
                <ResumoLinha label="Base Antiga" value={brl(receitaBaseAntiga)} />
                <ResumoLinha
                  label={`CSC variável (${cscPctBaseAntiga}%)`}
                  value={brl(cscBaseAntigaValor)}
                  bold
                />
              </>
            )}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="text-xs">
              <Label className="text-xs text-muted-foreground">Tráfego pago (informativo)</Label>
              <Input
                type="number"
                step="0.01"
                disabled={readOnly}
                defaultValue={apuracao.csc_trafego_pago ?? ""}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v !== Number(apuracao.csc_trafego_pago ?? 0)) {
                    updateAp.mutate({ id: apuracaoId, csc_trafego_pago: v });
                  }
                }}
              />
            </div>
            <div className="text-xs">
              <Label className="text-xs text-muted-foreground">Outras receitas</Label>
              <Input
                type="number"
                step="0.01"
                disabled={readOnly}
                defaultValue={apuracao.outras_receitas ?? ""}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v !== Number(apuracao.outras_receitas ?? 0)) {
                    updateAp.mutate({ id: apuracaoId, outras_receitas: v });
                  }
                }}
              />
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Total fatura</span>
              <span className="text-lg font-bold">{brl(totalFatura)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              CSC + Royalties + Outras (tráfego não entra)
            </div>
          </div>

          {!readOnly ? (
            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={confirmadosCount === 0 || fechar.isPending}
                onClick={() => {
                  if (confirm("Fechar apuração? Após isso, edições ficam bloqueadas.")) {
                    fechar.mutate(undefined, {
                      onSuccess: () => toast.success("Apuração confirmada"),
                      onError: (e: any) => toast.error(e.message),
                    });
                  }
                }}
              >
                Fechar apuração
              </Button>
              <div className="text-[10px] text-center text-muted-foreground">
                Salvamento automático — não há rascunho manual.
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              disabled={reabrir.isPending}
              onClick={() => {
                if (confirm("Reabrir apuração?")) {
                  reabrir.mutate(undefined, {
                    onSuccess: () => toast.success("Apuração reaberta"),
                    onError: (e: any) => toast.error(e.message),
                  });
                }
              }}
            >
              Reabrir apuração
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={highlight ? "text-base font-bold" : "text-sm font-semibold"}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ResumoLinha({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

interface GrupoProps {
  title: string;
  description: string;
  itens: ApuracaoItem[];
  readOnly: boolean;
  showMrr: boolean;
  showRoyalties: boolean;
  pctPadrao: number;
  apuracaoId: number;
  unidadeNome: string;
  temOmie: boolean;
  localValor: Record<number, string>;
  setLocalValor: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  flushValor: (it: ApuracaoItem) => void;
  toggleConfirm: (it: ApuracaoItem, c: boolean) => void;
  onDelete: (it: ApuracaoItem) => void;
  extraHeader?: React.ReactNode;
  onMarcarChurn?: (it: ApuracaoItem, motivo: string, dataChurn: string) => void;
  churnPending?: boolean;
  onEditarCnpj?: (it: ApuracaoItem, cnpj: string) => void;
  editarCnpjPending?: boolean;
}

function MarcarChurnButton({
  it,
  onConfirm,
  pending,
}: {
  it: ApuracaoItem;
  onConfirm: (motivo: string, dataChurn: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [dataChurn, setDataChurn] = useState(() => new Date().toISOString().slice(0, 10));

  const submit = () => {
    if (!motivo.trim()) {
      toast.error("Informe o motivo do churn.");
      return;
    }
    onConfirm(motivo.trim(), dataChurn);
    setOpen(false);
    setMotivo("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-600 hover:text-red-700 dark:text-red-400"
          title="Marcar churn"
        >
          <UserX className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar churn — {it.razao_social}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Data do churn</Label>
            <Input type="date" value={dataChurn} onChange={(e) => setDataChurn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por que o cliente saiu?"
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Isso cria um card no pipe Tratativas do Pipefy já na fase "Perdido". Não é possível desfazer por aqui.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Enviando…" : "Confirmar churn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarCnpjButton({
  it,
  onSave,
  pending,
}: {
  it: ApuracaoItem;
  onSave: (cnpj: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cnpj, setCnpj] = useState("");

  const digitsOnly = cnpj.replace(/\D/g, "");
  const valido = digitsOnly.length === 14;

  const submit = () => {
    if (!valido) {
      toast.error("CNPJ precisa ter 14 dígitos.");
      return;
    }
    onSave(digitsOnly);
    setOpen(false);
    setCnpj("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Adicionar CNPJ"
        >
          <Pencil className="h-3 w-3" /> —
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar CNPJ — {it.razao_social}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>CNPJ</Label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Ao salvar, a apuração é recalculada automaticamente — se o Omie já tiver um recebimento com esse CNPJ, o
            item sai de "Só no Pipedrive" e vira "Matched" na hora.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !valido}>
            {pending ? "Salvando…" : "Salvar e atualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FiliaisCell({
  it,
  apuracaoId,
  unidadeNome,
  temOmie,
  readOnly,
}: {
  it: ApuracaoItem;
  apuracaoId: number;
  unidadeNome: string;
  temOmie: boolean;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Não exibir em itens manuais, sem contrato, sem omie na unidade, ou em apuração fechada
  if (!temOmie || readOnly || it.fonte === "manual" || it.contrato_id == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const count = it.filiais_count ?? 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs"
        title={count > 0 ? `${count} filial(is) vinculada(s)` : "Vincular filiais Omie"}
      >
        {count > 0 ? (
          <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-900 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-200">
            <Link2 className="h-3 w-3" />
            {count} filial{count > 1 ? "is" : ""}
          </span>
        ) : (
          <Link2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        )}
      </button>
      {open && (
        <GruposFiliaisDialog
          open={open}
          onOpenChange={setOpen}
          apuracaoId={apuracaoId}
          contratoId={it.contrato_id}
          razaoSocial={it.razao_social}
          cnpjPrincipal={it.cnpj}
          unidade={unidadeNome}
        />
      )}
    </>
  );
}

function SecaoGrupo({
  title,
  description,
  itens,
  readOnly,
  showMrr,
  pctPadrao,
  apuracaoId,
  unidadeNome,
  temOmie,
  localValor,
  setLocalValor,
  flushValor,
  toggleConfirm,
  onDelete,
  extraHeader,
  onMarcarChurn,
  churnPending,
  onEditarCnpj,
  editarCnpjPending,
}: GrupoProps) {
  const [open, setOpen] = useState(true);
  if (itens.length === 0 && !extraHeader) return null;
  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <CollapsibleTrigger className="flex-1 text-left">
            <div className="font-medium">
              {title} <span className="text-xs text-muted-foreground">({itens.length})</span>
            </div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </CollapsibleTrigger>
          {extraHeader}
        </div>
        <CollapsibleContent>
          {itens.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum item.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-center">Filiais</th>
                    <th className="px-3 py-2 text-left">CNPJ</th>
                    {showMrr && <th className="px-3 py-2 text-right">MRR</th>}
                    <th className="px-3 py-2 text-right">Omie</th>
                    <th className="px-3 py-2 text-right">Confirmado</th>
                    <th className="px-3 py-2 text-right">Royalties</th>
                    <th className="px-3 py-2 text-center">✓</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it) => {
                    const localV = localValor[it.id];
                    const valor =
                      localV !== undefined
                        ? Number((localV || "0").replace(",", "."))
                        : Number(it.valor_confirmado ?? 0);
                    const pct =
                      it.royalties_percentual_override != null
                        ? Number(it.royalties_percentual_override)
                        : pctPadrao;
                    const royal = (valor * pct) / 100;
                    return (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2">
                          {it.razao_social}
                          {it.churn_pipefy_card_id && (
                            <Badge className="ml-2 bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 text-[10px] px-1.5 py-0 align-middle">
                              churn
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <FiliaisCell
                            it={it}
                            apuracaoId={apuracaoId}
                            unidadeNome={unidadeNome}
                            temOmie={temOmie}
                            readOnly={readOnly}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {it.cnpj ? (
                            it.cnpj
                          ) : !readOnly && it.contrato_id != null && onEditarCnpj ? (
                            <EditarCnpjButton
                              it={it}
                              pending={!!editarCnpjPending}
                              onSave={(cnpj) => onEditarCnpj(it, cnpj)}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        {showMrr && (
                          <td className="px-3 py-2 text-right">
                            {it.mrr_contratado != null ? brl(it.mrr_contratado) : "—"}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">
                          {it.valor_omie != null ? brl(it.valor_omie) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="text"
                            inputMode="decimal"
                            disabled={readOnly}
                            value={localV ?? (it.valor_confirmado ?? "")}
                            onChange={(e) =>
                              setLocalValor((s) => ({ ...s, [it.id]: e.target.value }))
                            }
                            onBlur={() => flushValor(it)}
                            className="h-8 w-28 text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-indigo-700 dark:text-indigo-300">
                          {brl(royal)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Checkbox
                            checked={!!it.confirmado}
                            disabled={readOnly}
                            onCheckedChange={(c) => toggleConfirm(it, Boolean(c))}
                          />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {!readOnly && !it.churn_pipefy_card_id && it.contrato_id != null && onMarcarChurn && (
                            <MarcarChurnButton
                              it={it}
                              pending={!!churnPending}
                              onConfirm={(motivo, dataChurn) => onMarcarChurn(it, motivo, dataChurn)}
                            />
                          )}
                          {!readOnly && it.fonte === "manual" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => onDelete(it)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}


function BaseAntigaTable({
  itens,
  readOnly,
  apuracaoId,
  unidadeNome,
  temOmie,
  localValor,
  setLocalValor,
  flushValor,
  toggleConfirm,
  onDelete,
}: {
  itens: ApuracaoItem[];
  readOnly: boolean;
  apuracaoId: number;
  unidadeNome: string;
  temOmie: boolean;
  localValor: Record<number, string>;
  setLocalValor: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  flushValor: (it: ApuracaoItem) => void;
  toggleConfirm: (it: ApuracaoItem, c: boolean) => void;
  onDelete: (it: ApuracaoItem) => void;
}) {
  if (itens.length === 0)
    return <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum item.</div>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Cliente</th>
            <th className="px-3 py-2 text-center">Filiais</th>
            <th className="px-3 py-2 text-left">CNPJ</th>
            <th className="px-3 py-2 text-right">Omie</th>
            <th className="px-3 py-2 text-right">Confirmado</th>
            <th className="px-3 py-2 text-center">✓</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((it) => (
            <tr key={it.id} className="border-t">
              <td className="px-3 py-2">{it.razao_social}</td>
              <td className="px-3 py-2 text-center">
                <FiliaisCell
                  it={it}
                  apuracaoId={apuracaoId}
                  unidadeNome={unidadeNome}
                  temOmie={temOmie}
                  readOnly={readOnly}
                />
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{it.cnpj ?? "—"}</td>

              <td className="px-3 py-2 text-right">
                {it.valor_omie != null ? brl(it.valor_omie) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <Input
                  type="text"
                  inputMode="decimal"
                  disabled={readOnly}
                  value={localValor[it.id] ?? (it.valor_confirmado ?? "")}
                  onChange={(e) =>
                    setLocalValor((s) => ({ ...s, [it.id]: e.target.value }))
                  }
                  onBlur={() => flushValor(it)}
                  className="h-8 w-28 text-right"
                />
              </td>
              <td className="px-3 py-2 text-center">
                <Checkbox
                  checked={!!it.confirmado}
                  disabled={readOnly}
                  onCheckedChange={(c) => toggleConfirm(it, Boolean(c))}
                />
              </td>
              <td className="px-3 py-2 text-right">
                {!readOnly && it.fonte === "manual" && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(it)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddItemDialog({
  onAdd,
}: {
  onAdd: (payload: { razao_social: string; cnpj?: string; valor_confirmado?: number; observacao?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar cliente manualmente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Razão social *</Label>
            <Input value={razao} onChange={(e) => setRazao(e.target.value)} />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div>
            <Label>Valor confirmado</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!razao.trim()}
            onClick={() => {
              onAdd({
                razao_social: razao.trim(),
                cnpj: cnpj.trim() || undefined,
                valor_confirmado: valor ? Number(valor) : undefined,
                observacao: obs.trim() || undefined,
              });
              setRazao("");
              setCnpj("");
              setValor("");
              setObs("");
              setOpen(false);
            }}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
