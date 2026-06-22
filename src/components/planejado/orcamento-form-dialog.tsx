import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORIA_DESPESA_OPTS,
  CATEGORIA_RECEITA_OPTS,
  DEPARTAMENTO_OPTS,
  MES_OPTS,
  TIPO_CUSTO_OPTS,
  UNIDADE_OPTS,
  type OrcRow,
} from "./constants";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<OrcRow>;
  editingId?: number | null;
  onSaved: () => void;
};

export function OrcamentoFormDialog({ open, onOpenChange, initial, editingId, onSaved }: Props) {
  const [tipo, setTipo] = useState<"DESPESA" | "RECEITA">("DESPESA");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [departamento, setDepartamento] = useState("Todos");
  const [unidade, setUnidade] = useState("Planning");
  const [tipoCusto, setTipoCusto] = useState("Fixo");
  const [valor, setValor] = useState<string>("");
  const [multi, setMulti] = useState(false);
  const [mes, setMes] = useState(MES_OPTS[4].value);
  const [mesIni, setMesIni] = useState(MES_OPTS[4].value);
  const [mesFim, setMesFim] = useState(MES_OPTS[6].value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo((initial?.tipo as "DESPESA" | "RECEITA") ?? "DESPESA");
    setDescricao(initial?.descricao ?? "");
    setCategoria(initial?.categoria ?? "");
    setDepartamento(initial?.departamento ?? "Todos");
    setUnidade(initial?.unidade ?? "Planning");
    setTipoCusto(initial?.tipo_custo ?? "Fixo");
    setValor(initial?.valor != null ? String(initial.valor) : "");
    if (initial?.mes) {
      const ym = initial.mes.slice(0, 7);
      setMes(ym);
      setMesIni(ym);
      setMesFim(ym);
    }
    setMulti(false);
  }, [open, initial]);

  const catOpts = tipo === "DESPESA" ? CATEGORIA_DESPESA_OPTS : CATEGORIA_RECEITA_OPTS;

  const handleSave = async () => {
    const v = Number(String(valor).replace(",", "."));
    if (!descricao.trim()) return toast.error("Descrição obrigatória");
    if (!categoria) return toast.error("Categoria obrigatória");
    if (!Number.isFinite(v) || v <= 0) return toast.error("Valor deve ser > 0");
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("partners_orcamento")
          .update({
            tipo,
            descricao: descricao.trim(),
            categoria,
            departamento,
            unidade,
            tipo_custo: tipoCusto,
            valor: v,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Item atualizado");
      } else {
        const months = multi ? expandMonths(mesIni, mesFim) : [mes];
        const rows = months.map((m) => ({
          tipo,
          mes: `${m}-01`,
          descricao: descricao.trim(),
          categoria,
          departamento,
          unidade,
          tipo_custo: tipoCusto,
          valor: v,
          origem: "manual",
        }));
        const { error } = await supabase.from("partners_orcamento").insert(rows);
        if (error) throw error;
        toast.success(`${rows.length} item(ns) adicionado(s) ao planejamento`);
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar item" : "Novo item de planejamento"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => { setTipo(v as "DESPESA" | "RECEITA"); setCategoria(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DESPESA">DESPESA</SelectItem>
                <SelectItem value="RECEITA">RECEITA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {catOpts.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Descrição *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: RD Station" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Departamento</Label>
            <Select value={departamento} onValueChange={setDepartamento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTAMENTO_OPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unidade</Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIDADE_OPTS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tipo de custo</Label>
            <Select value={tipoCusto} onValueChange={setTipoCusto}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPO_CUSTO_OPTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor Mensal *</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>

          {!editingId && (
            <>
              <div className="col-span-2 flex items-center justify-between rounded border p-2">
                <Label className="text-xs">Repetir por múltiplos meses</Label>
                <Switch checked={multi} onCheckedChange={setMulti} />
              </div>
              {multi ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Mês Início *</Label>
                    <Select value={mesIni} onValueChange={setMesIni}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MES_OPTS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mês Fim *</Label>
                    <Select value={mesFim} onValueChange={setMesFim}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MES_OPTS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Mês *</Label>
                  <Select value={mes} onValueChange={setMes}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MES_OPTS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function expandMonths(ini: string, fim: string): string[] {
  const out: string[] = [];
  const [yi, mi] = ini.split("-").map(Number);
  const [yf, mf] = fim.split("-").map(Number);
  const start = yi * 12 + (mi - 1);
  const end = yf * 12 + (mf - 1);
  for (let k = start; k <= end; k++) {
    const y = Math.floor(k / 12);
    const m = (k % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}
