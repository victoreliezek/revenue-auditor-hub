import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import {
  listCategorias, criarCategoria, excluirCategoria, atualizarCategoriaGrupo,
  listDepartamentos, criarDepartamento, excluirDepartamento,
  listTiposRateio, criarTipoRateio, excluirTipoRateio,
} from "./data";
import { CategoriaRow, Cadastro, Natureza, GrupoDRE, GRUPO_DRE_LABEL } from "./types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

const GRUPOS_DESPESA: GrupoDRE[] = ["imposto_direto", "custo_variavel", "custo_fixo"];
const GRUPOS_RECEITA: GrupoDRE[] = ["entrada", "aporte"];
const NO_GROUP = "__none__";

export function CadastrosDialog({ open, onOpenChange, onChanged }: Props) {
  const [catReceita, setCatReceita] = useState<CategoriaRow[]>([]);
  const [catDespesa, setCatDespesa] = useState<CategoriaRow[]>([]);
  const [deps, setDeps] = useState<Cadastro[]>([]);
  const [tipos, setTipos] = useState<Cadastro[]>([]);
  const [novoCatR, setNovoCatR] = useState("");
  const [novoCatRGrupo, setNovoCatRGrupo] = useState<string>(NO_GROUP);
  const [novoCatD, setNovoCatD] = useState("");
  const [novoCatDGrupo, setNovoCatDGrupo] = useState<string>(NO_GROUP);
  const [novoDep, setNovoDep] = useState("");
  const [novoTipo, setNovoTipo] = useState("");

  async function reload() {
    const [r, d, dep, t] = await Promise.all([
      listCategorias("receita"), listCategorias("despesa"), listDepartamentos(), listTiposRateio(),
    ]);
    setCatReceita(r); setCatDespesa(d); setDeps(dep); setTipos(t);
  }
  useEffect(() => { if (open) reload(); }, [open]);

  async function addCat(nome: string, natureza: Natureza, grupo: string, clear: () => void) {
    if (!nome.trim()) return;
    try {
      await criarCategoria(nome.trim(), natureza, grupo === NO_GROUP ? null : grupo);
      clear();
      await reload();
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  }
  async function delCat(id: string) {
    if (!confirm("Excluir esta categoria?")) return;
    await excluirCategoria(id); await reload(); onChanged();
  }
  async function setGrupo(id: string, grupo: string) {
    try {
      await atualizarCategoriaGrupo(id, grupo === NO_GROUP ? null : grupo);
      await reload();
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  }
  async function addDep() {
    if (!novoDep.trim()) return;
    try { await criarDepartamento(novoDep.trim()); setNovoDep(""); await reload(); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function delDep(id: string) {
    if (!confirm("Excluir este departamento?")) return;
    await excluirDepartamento(id); await reload(); onChanged();
  }
  async function addTipo() {
    if (!novoTipo.trim()) return;
    try { await criarTipoRateio(novoTipo.trim()); setNovoTipo(""); await reload(); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function delTipo(id: string) {
    if (!confirm("Excluir este tipo de rateio?")) return;
    await excluirTipoRateio(id); await reload(); onChanged();
  }

  function ListaCategorias({ items, grupos }: { items: CategoriaRow[]; grupos: GrupoDRE[] }) {
    if (items.length === 0) return <div className="text-xs text-muted-foreground p-2">Nenhum cadastro.</div>;
    return (
      <ul className="divide-y rounded-md border">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
            <span className="flex-1 truncate">{c.nome}</span>
            <Select value={c.grupo_dre ?? NO_GROUP} onValueChange={(v) => setGrupo(c.id, v)}>
              <SelectTrigger className="h-7 w-[200px] text-xs">
                <SelectValue placeholder="Grupo DRE" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP}>Sem grupo</SelectItem>
                {grupos.map((g) => (
                  <SelectItem key={g} value={g}>{GRUPO_DRE_LABEL[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => delCat(c.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  function ListaSimples({ items, onDel }: { items: Cadastro[]; onDel: (id: string) => void }) {
    if (items.length === 0) return <div className="text-xs text-muted-foreground p-2">Nenhum cadastro.</div>;
    return (
      <ul className="divide-y rounded-md border">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
            <span>{c.nome}</span>
            <Button size="icon" variant="ghost" onClick={() => onDel(c.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Cadastros da simulação</DialogTitle></DialogHeader>
        <Tabs defaultValue="cat-d">
          <TabsList>
            <TabsTrigger value="cat-d">Categorias (despesa)</TabsTrigger>
            <TabsTrigger value="cat-r">Categorias (receita)</TabsTrigger>
            <TabsTrigger value="dep">Departamentos</TabsTrigger>
            <TabsTrigger value="tr">Tipos de rateio</TabsTrigger>
          </TabsList>

          <TabsContent value="cat-d" className="space-y-2">
            <div className="flex gap-2">
              <Input value={novoCatD} onChange={(e) => setNovoCatD(e.target.value)} placeholder="Nova categoria de despesa" />
              <Select value={novoCatDGrupo} onValueChange={setNovoCatDGrupo}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Grupo DRE" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP}>Sem grupo</SelectItem>
                  {GRUPOS_DESPESA.map((g) => <SelectItem key={g} value={g}>{GRUPO_DRE_LABEL[g]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => addCat(novoCatD, "despesa", novoCatDGrupo, () => { setNovoCatD(""); setNovoCatDGrupo(NO_GROUP); })}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ListaCategorias items={catDespesa} grupos={GRUPOS_DESPESA} />
          </TabsContent>

          <TabsContent value="cat-r" className="space-y-2">
            <div className="flex gap-2">
              <Input value={novoCatR} onChange={(e) => setNovoCatR(e.target.value)} placeholder="Nova categoria de receita" />
              <Select value={novoCatRGrupo} onValueChange={setNovoCatRGrupo}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Grupo DRE" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP}>Sem grupo</SelectItem>
                  {GRUPOS_RECEITA.map((g) => <SelectItem key={g} value={g}>{GRUPO_DRE_LABEL[g]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => addCat(novoCatR, "receita", novoCatRGrupo, () => { setNovoCatR(""); setNovoCatRGrupo(NO_GROUP); })}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ListaCategorias items={catReceita} grupos={GRUPOS_RECEITA} />
          </TabsContent>

          <TabsContent value="dep" className="space-y-2">
            <div className="flex gap-2">
              <Input value={novoDep} onChange={(e) => setNovoDep(e.target.value)} placeholder="Novo departamento" />
              <Button onClick={addDep}><Plus className="h-4 w-4" /></Button>
            </div>
            <ListaSimples items={deps} onDel={delDep} />
          </TabsContent>
          <TabsContent value="tr" className="space-y-2">
            <div className="flex gap-2">
              <Input value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} placeholder="Novo tipo de rateio" />
              <Button onClick={addTipo}><Plus className="h-4 w-4" /></Button>
            </div>
            <ListaSimples items={tipos} onDel={delTipo} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
