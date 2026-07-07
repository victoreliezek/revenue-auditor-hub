import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Ban, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useAddItemCac,
  useApuracaoCacUnidade,
  useAtualizarCnpjContratoCac,
  useDeleteItemCac,
  useExcluirItemCac,
  useFecharApuracaoCac,
  useForcarAtualizacaoCacUnidade,
  useReabrirApuracaoCac,
  useReincluirItemCac,
  useUpdateItemCac,
} from "@/hooks/use-cac";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cac/$unidadeId")({
  component: ApuracaoCacPage,
});

type ApuracaoCacItemComMes = {
  id: number;
  apuracao_id: number;
  cnpj: string | null;
  razao_social: string;
  contrato_id: number | null;
  valor_cac_total: number;
  valor_parcela_1: number;
  valor_parcela_2: number;
  data_assinatura_contrato: string | null;
  prazo_parcela_1: string | null;
  data_pagamento_parcela_1: string | null;
  status_parcela_1: string;
  data_recebimento_cliente: string | null;
  prazo_parcela_2: string | null;
  data_pagamento_parcela_2: string | null;
  status_parcela_2: string;
  fonte: string;
  status_match: string | null;
  observacao: string | null;
  excluido_em: string | null;
  excluido_por: string | null;
  motivo_exclusao: string | null;
  mes_referencia: string;
  apuracao_status: string;
};

type ApuracaoResumo = {
  id: number;
  status: string;
  mes_referencia: string;
  total_parcela_1: number | null;
  total_parcela_2: number | null;
  total_cac: number | null;
  confirmado_em: string | null;
};

function formatMesLabel(mes: string) {
  const [y, m] = mes.slice(0, 7).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function fmtData(d: string | null): string {
  return d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : "—";
}

function mesAtualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  em_revisao: { label: "Em revisão", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" },
  confirmado: { label: "Confirmado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" },
};

const PARCELA_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  atrasado: { label: "Atrasado", cls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
  pago: { label: "Pago", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" },
  aguardando_cliente: {
    label: "Aguardando cliente",
    cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
};

function ApuracaoCacPage() {
  const { unidadeId } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin, loading } = usePermissions();

  const unidadeIdNum = Number(unidadeId);
  const validUnidade = Number.isInteger(unidadeIdNum) && unidadeIdNum > 0;

  const { data, isLoading } = useApuracaoCacUnidade(validUnidade ? unidadeIdNum : null);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <div className="p-6 text-sm text-muted-foreground">Acesso restrito a admin.</div>;
  if (!validUnidade)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        URL inválida. Volte para <Link to="/unidades" className="underline">Unidades</Link>.
      </div>
    );
  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Carregando apuração…</div>;

  return (
    <ApuracaoLoaded
      unidadeId={unidadeIdNum}
      apuracoes={data.apuracoes}
      itens={data.itens}
      onBack={() => navigate({ to: "/unidades" })}
    />
  );
}

function ApuracaoLoaded({
  unidadeId,
  apuracoes,
  itens,
  onBack,
}: {
  unidadeId: number;
  apuracoes: ApuracaoResumo[];
  itens: ApuracaoCacItemComMes[];
  onBack: () => void;
}) {
  const updateItem = useUpdateItemCac(unidadeId);
  const addItem = useAddItemCac(unidadeId);
  const deleteItem = useDeleteItemCac(unidadeId);
  const excluirItem = useExcluirItemCac(unidadeId);
  const reincluirItem = useReincluirItemCac(unidadeId);
  const atualizarCnpj = useAtualizarCnpjContratoCac(unidadeId);
  const fechar = useFecharApuracaoCac(unidadeId);
  const reabrir = useReabrirApuracaoCac(unidadeId);
  const forcar = useForcarAtualizacaoCacUnidade(unidadeId);

  const handleExcluir = (it: ApuracaoCacItemComMes, motivo: string) => {
    excluirItem.mutate(
      { item_id: it.id, motivo },
      { onSuccess: () => toast.success(`${it.razao_social} excluído da apuração.`) },
    );
  };

  const handleReincluir = (it: ApuracaoCacItemComMes) => {
    reincluirItem.mutate(
      { item_id: it.id },
      { onSuccess: () => toast.success(`${it.razao_social} reincluído na apuração.`) },
    );
  };

  const forcarAtualizacao = async () => {
    try {
      const res = await forcar.mutateAsync();
      toast.success(`Apuração atualizada: ${res.itens.length} item(ns) no total.`);
    } catch {
      // erro já tratado pelo onError padrão dos hooks
    }
  };

  const handleSalvarCnpj = async (it: ApuracaoCacItemComMes, cnpj: string) => {
    if (!it.contrato_id) return;
    try {
      await atualizarCnpj.mutateAsync({ contrato_id: it.contrato_id, cnpj });
      await forcar.mutateAsync();
      toast.success(`CNPJ salvo para ${it.razao_social} — apuração atualizada.`);
    } catch {
      // erro já tratado pelo onError padrão dos hooks
    }
  };

  const ativos = itens.filter((i) => !i.excluido_em);
  const excluidos = itens.filter((i) => !!i.excluido_em);
  const matched = ativos.filter((i) => i.status_match === "matched");
  const semCnpj = ativos.filter((i) => i.status_match === "sem_cnpj");
  const manual = ativos.filter((i) => i.status_match === "manual");

  let totalParcela1 = 0;
  let totalParcela2 = 0;
  for (const it of ativos) {
    if (it.data_pagamento_parcela_1) totalParcela1 += Number(it.valor_parcela_1 ?? 0);
    if (it.data_pagamento_parcela_2) totalParcela2 += Number(it.valor_parcela_2 ?? 0);
  }
  const totalCac = totalParcela1 + totalParcela2;

  const apuracaoAtual = apuracoes.find((a) => a.mes_referencia.slice(0, 7) === mesAtualStr());
  const readOnlyAtual = apuracaoAtual?.status === "confirmado";

  const readOnlyPorApuracao = new Map(apuracoes.map((a) => [a.id, a.status === "confirmado"]));
  const isReadOnly = (it: ApuracaoCacItemComMes) => readOnlyPorApuracao.get(it.apuracao_id) ?? false;

  return (
    <div className="flex flex-col">
      <div className="sticky top-[57px] z-10 border-b bg-card/95 backdrop-blur px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> CAC
            </Button>
            <div className="text-base font-semibold flex items-center gap-2">
              Apuração de CAC
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5"
                disabled={forcar.isPending}
                onClick={forcarAtualizacao}
                title="Reprocessa contratos ganhos em todos os meses ainda abertos e recebimentos do Omie, mantendo pagamentos já marcados."
              >
                <RefreshCw className={cn("h-3.5 w-3.5", forcar.isPending && "animate-spin")} />
                Forçar atualização
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <Metric label="Parcela 1 paga" value={brl(totalParcela1)} />
            <Metric label="Parcela 2 paga" value={brl(totalParcela2)} />
            <Metric label="Total CAC" value={brl(totalCac)} highlight />
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6 min-w-0">
          <SecaoGrupo
            title="✅ Com CNPJ"
            description="Clientes com contrato ganho, cruzados com recebimentos do Omie."
            itens={matched}
            isReadOnly={isReadOnly}
            updateItem={updateItem}
            onDelete={(it) => deleteItem.mutate({ id: it.id })}
            onExcluir={handleExcluir}
            excluirPending={excluirItem.isPending}
          />
          <SecaoGrupo
            title="⚠️ Sem CNPJ"
            description="Contrato ganho sem CNPJ cadastrado — não é possível checar o recebimento do cliente até corrigir."
            itens={semCnpj}
            isReadOnly={isReadOnly}
            updateItem={updateItem}
            onDelete={(it) => deleteItem.mutate({ id: it.id })}
            onEditarCnpj={handleSalvarCnpj}
            editarCnpjPending={atualizarCnpj.isPending || forcar.isPending}
            onExcluir={handleExcluir}
            excluirPending={excluirItem.isPending}
          />
          <SecaoGrupo
            title="➕ Adicionados manualmente"
            description="Itens criados pelo usuário."
            itens={manual}
            isReadOnly={isReadOnly}
            updateItem={updateItem}
            onDelete={(it) => deleteItem.mutate({ id: it.id })}
            extraHeader={
              !readOnlyAtual &&
              apuracaoAtual && (
                <AddItemDialog
                  onAdd={(payload) => addItem.mutate({ apuracao_id: apuracaoAtual.id, ...payload })}
                />
              )
            }
          />
          <ExcluidosSection
            itens={excluidos}
            isReadOnly={isReadOnly}
            onReincluir={handleReincluir}
            pending={reincluirItem.isPending}
          />
        </div>

        <MesesSidebar
          apuracoes={apuracoes}
          itens={ativos}
          onFechar={(id) => {
            if (confirm("Fechar apuração deste mês? Após isso, edições ficam bloqueadas.")) {
              fechar.mutate(
                { id },
                {
                  onSuccess: () => toast.success("Apuração confirmada"),
                  onError: (e: any) => toast.error(e.message),
                },
              );
            }
          }}
          onReabrir={(id) => {
            if (confirm("Reabrir apuração deste mês?")) {
              reabrir.mutate(
                { id },
                {
                  onSuccess: () => toast.success("Apuração reaberta"),
                  onError: (e: any) => toast.error(e.message),
                },
              );
            }
          }}
          fecharPending={fechar.isPending}
          reabrirPending={reabrir.isPending}
        />
      </div>
    </div>
  );
}

function MesesSidebar({
  apuracoes,
  itens,
  onFechar,
  onReabrir,
  fecharPending,
  reabrirPending,
}: {
  apuracoes: ApuracaoResumo[];
  itens: ApuracaoCacItemComMes[];
  onFechar: (id: number) => void;
  onReabrir: (id: number) => void;
  fecharPending: boolean;
  reabrirPending: boolean;
}) {
  const [showFechados, setShowFechados] = useState(false);
  const abertos = apuracoes.filter((a) => a.status !== "confirmado");
  const fechados = apuracoes.filter((a) => a.status === "confirmado");

  const totalDoMes = (apuracaoId: number) => {
    let p1 = 0;
    let p2 = 0;
    let algum = false;
    for (const it of itens) {
      if (it.apuracao_id !== apuracaoId) continue;
      if (it.data_pagamento_parcela_1) {
        p1 += Number(it.valor_parcela_1 ?? 0);
        algum = true;
      }
      if (it.data_pagamento_parcela_2) {
        p2 += Number(it.valor_parcela_2 ?? 0);
        algum = true;
      }
    }
    return { p1, p2, algum };
  };

  return (
    <div className="space-y-4 h-fit sticky top-[140px]">
      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Meses em aberto</div>
        {abertos.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhum mês em aberto.</div>
        ) : (
          abertos
            .slice()
            .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1))
            .map((ap) => {
              const { p1, p2, algum } = totalDoMes(ap.id);
              const badge = STATUS_BADGE[ap.status] ?? { label: ap.status, cls: "" };
              return (
                <div key={ap.id} className="rounded-md border p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium capitalize">{formatMesLabel(ap.mes_referencia)}</span>
                    <Badge className={cn("text-[10px] px-1.5 py-0", badge.cls)}>{badge.label}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">Total CAC pago: {brl(p1 + p2)}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-full text-xs"
                    disabled={!algum || fecharPending}
                    onClick={() => onFechar(ap.id)}
                  >
                    Fechar mês
                  </Button>
                </div>
              );
            })
        )}
      </Card>

      {fechados.length > 0 && (
        <Card className="overflow-hidden border-dashed">
          <Collapsible open={showFechados} onOpenChange={setShowFechados}>
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
              <div className="text-sm font-medium">
                Histórico de meses fechados <span className="text-xs text-muted-foreground">({fechados.length})</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 px-4 pb-4">
              {fechados
                .slice()
                .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1))
                .map((ap) => (
                  <div key={ap.id} className="rounded-md border p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium capitalize">{formatMesLabel(ap.mes_referencia)}</span>
                      <Badge className={cn("text-[10px] px-1.5 py-0", STATUS_BADGE.confirmado.cls)}>Confirmado</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Total CAC: {brl(ap.total_cac ?? 0)}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-full text-xs"
                      disabled={reabrirPending}
                      onClick={() => onReabrir(ap.id)}
                    >
                      Reabrir mês
                    </Button>
                  </div>
                ))}
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={highlight ? "text-base font-bold" : "text-sm font-semibold"}>{value}</div>
    </div>
  );
}

function ParcelaCell({
  valor,
  prazo,
  status,
  dataPagamento,
  readOnly,
  disabledMarcar,
  onMarcarPago,
  onDesmarcar,
}: {
  valor: number;
  prazo: string | null;
  status: string;
  dataPagamento: string | null;
  readOnly: boolean;
  disabledMarcar?: boolean;
  onMarcarPago: (data: string) => void;
  onDesmarcar: () => void;
}) {
  const badge = PARCELA_BADGE[status] ?? { label: status, cls: "" };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1.5">
        <span className="font-medium">{brl(valor)}</span>
        <Badge className={cn("text-[10px] px-1.5 py-0", badge.cls)}>{badge.label}</Badge>
      </div>
      <div className="text-right text-[10px] text-muted-foreground">
        {dataPagamento ? `Pago em ${fmtData(dataPagamento)}` : prazo ? `Prazo: ${fmtData(prazo)}` : "—"}
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          {dataPagamento ? (
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-muted-foreground" onClick={onDesmarcar}>
              <X className="h-3 w-3" /> Desfazer
            </Button>
          ) : (
            <MarcarPagoButton disabled={!!disabledMarcar} onConfirm={onMarcarPago} />
          )}
        </div>
      )}
    </div>
  );
}

function MarcarPagoButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: (data: string) => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-1.5 text-xs" disabled={disabled}>
          Marcar como pago
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar parcela como paga</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Data do repasse</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onConfirm(data);
              setOpen(false);
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirItemButton({
  it,
  onConfirm,
  pending,
}: {
  it: ApuracaoCacItemComMes;
  onConfirm: (motivo: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  const submit = () => {
    if (!motivo.trim()) {
      toast.error("Informe o motivo da exclusão.");
      return;
    }
    onConfirm(motivo.trim());
    setOpen(false);
    setMotivo("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-amber-600 hover:text-amber-700 dark:text-amber-400"
          title="Excluir da apuração"
        >
          <Ban className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir da apuração — {it.razao_social}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Excluindo…" : "Excluir"}
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
  it: ApuracaoCacItemComMes;
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
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Pencil className="h-3 w-3" /> —
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar CNPJ — {it.razao_social}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label>CNPJ</Label>
          <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" autoFocus />
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

interface GrupoProps {
  title: string;
  description: string;
  itens: ApuracaoCacItemComMes[];
  isReadOnly: (it: ApuracaoCacItemComMes) => boolean;
  updateItem: ReturnType<typeof useUpdateItemCac>;
  onDelete: (it: ApuracaoCacItemComMes) => void;
  extraHeader?: React.ReactNode;
  onEditarCnpj?: (it: ApuracaoCacItemComMes, cnpj: string) => void;
  editarCnpjPending?: boolean;
  onExcluir?: (it: ApuracaoCacItemComMes, motivo: string) => void;
  excluirPending?: boolean;
}

function SecaoGrupo({
  title,
  description,
  itens,
  isReadOnly,
  updateItem,
  onDelete,
  extraHeader,
  onEditarCnpj,
  editarCnpjPending,
  onExcluir,
  excluirPending,
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
                    <th className="px-3 py-2 text-left">CNPJ</th>
                    <th className="px-3 py-2 text-left">Assinatura</th>
                    <th className="px-3 py-2 text-left">Mês</th>
                    <th className="px-3 py-2 text-right">Valor total</th>
                    <th className="px-3 py-2 text-right">Parcela 1 (7d pós assinatura)</th>
                    <th className="px-3 py-2 text-right">Parcela 2 (pós recebimento)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it) => {
                    const readOnly = isReadOnly(it);
                    return (
                      <tr key={it.id} className="border-t align-top">
                        <td className="px-3 py-2">{it.razao_social}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {it.cnpj ? (
                            it.cnpj
                          ) : !readOnly && it.contrato_id != null && onEditarCnpj ? (
                            <EditarCnpjButton it={it} pending={!!editarCnpjPending} onSave={(cnpj) => onEditarCnpj(it, cnpj)} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtData(it.data_assinatura_contrato)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="capitalize">{formatMesLabel(it.mes_referencia)}</span>
                            <Badge className={cn("text-[9px] px-1 py-0", STATUS_BADGE[it.apuracao_status]?.cls)}>
                              {STATUS_BADGE[it.apuracao_status]?.label ?? it.apuracao_status}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{brl(it.valor_cac_total)}</td>
                        <td className="px-3 py-2 min-w-[160px]">
                          <ParcelaCell
                            valor={it.valor_parcela_1}
                            prazo={it.prazo_parcela_1}
                            status={it.status_parcela_1}
                            dataPagamento={it.data_pagamento_parcela_1}
                            readOnly={readOnly}
                            onMarcarPago={(data) => updateItem.mutate({ id: it.id, data_pagamento_parcela_1: data })}
                            onDesmarcar={() => updateItem.mutate({ id: it.id, data_pagamento_parcela_1: null })}
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[160px]">
                          <ParcelaCell
                            valor={it.valor_parcela_2}
                            prazo={it.prazo_parcela_2}
                            status={it.status_parcela_2}
                            dataPagamento={it.data_pagamento_parcela_2}
                            readOnly={readOnly}
                            disabledMarcar={!it.data_recebimento_cliente}
                            onMarcarPago={(data) => updateItem.mutate({ id: it.id, data_pagamento_parcela_2: data })}
                            onDesmarcar={() => updateItem.mutate({ id: it.id, data_pagamento_parcela_2: null })}
                          />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {!readOnly && it.fonte === "manual" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(it)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!readOnly && it.fonte !== "manual" && onExcluir && (
                            <ExcluirItemButton it={it} pending={!!excluirPending} onConfirm={(motivo) => onExcluir(it, motivo)} />
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

function ExcluidosSection({
  itens,
  isReadOnly,
  onReincluir,
  pending,
}: {
  itens: ApuracaoCacItemComMes[];
  isReadOnly: (it: ApuracaoCacItemComMes) => boolean;
  onReincluir: (it: ApuracaoCacItemComMes) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (itens.length === 0) return null;
  return (
    <Card className="overflow-hidden border-dashed">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between border-b px-4 py-3 text-left">
          <div>
            <div className="font-medium">
              🚫 Excluídos <span className="text-xs text-muted-foreground">({itens.length})</span>
            </div>
            <div className="text-xs text-muted-foreground">Não entram no total de CAC.</div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">CNPJ</th>
                  <th className="px-3 py-2 text-left">Mês</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                  <th className="px-3 py-2 text-left">Excluído em</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <tr key={it.id} className="border-t text-muted-foreground">
                    <td className="px-3 py-2">{it.razao_social}</td>
                    <td className="px-3 py-2 text-xs">{it.cnpj ?? "—"}</td>
                    <td className="px-3 py-2 text-xs capitalize whitespace-nowrap">{formatMesLabel(it.mes_referencia)}</td>
                    <td className="px-3 py-2 text-xs">{it.motivo_exclusao ?? "—"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {it.excluido_em ? new Date(it.excluido_em).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {!isReadOnly(it) && (
                        <Button size="sm" variant="outline" className="h-7" onClick={() => onReincluir(it)} disabled={pending}>
                          Reincluir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function AddItemDialog({
  onAdd,
}: {
  onAdd: (payload: { razao_social: string; cnpj?: string; valor_cac_total: number; observacao?: string }) => void;
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
            <Label>Valor total do CAC *</Label>
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
            disabled={!razao.trim() || !valor}
            onClick={() => {
              onAdd({
                razao_social: razao.trim(),
                cnpj: cnpj.trim() || undefined,
                valor_cac_total: Number(valor),
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
