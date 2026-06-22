import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useCategoriasDespesa,
  useDepartamentosDespesa,
} from "@/hooks/use-cadastros-despesas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CadastrosDespesasDialog({ open, onOpenChange }: Props) {
  const cats = useCategoriasDespesa();
  const deps = useDepartamentosDespesa();
  const [novaCat, setNovaCat] = useState("");
  const [novoDep, setNovoDep] = useState("");

  async function addCat() {
    const nome = novaCat.trim();
    if (!nome) return;
    if (cats.items.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error("Categoria já existe");
      return;
    }
    try {
      await cats.criar.mutateAsync(nome);
      setNovaCat("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addDep() {
    const nome = novoDep.trim();
    if (!nome) return;
    if (deps.items.some((d) => d.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error("Departamento já existe");
      return;
    }
    try {
      await deps.criar.mutateAsync(nome);
      setNovoDep("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function delCat(id: string) {
    if (!confirm("Excluir esta categoria? Despesas já lançadas não são afetadas.")) return;
    try {
      await cats.excluir.mutateAsync(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function delDep(id: string) {
    if (!confirm("Excluir este departamento? Despesas já lançadas não são afetadas.")) return;
    try {
      await deps.excluir.mutateAsync(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function Lista({
    items,
    onDel,
  }: {
    items: { id: string; nome: string }[];
    onDel: (id: string) => void;
  }) {
    if (items.length === 0)
      return <div className="text-xs text-muted-foreground p-2">Nenhum cadastro.</div>;
    return (
      <ul className="divide-y rounded-md border max-h-72 overflow-auto">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between px-3 py-1.5 text-sm"
          >
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar cadastros</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="dep">
          <TabsList>
            <TabsTrigger value="dep">Departamentos</TabsTrigger>
            <TabsTrigger value="cat">Categorias</TabsTrigger>
          </TabsList>

          <TabsContent value="dep" className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={novoDep}
                onChange={(e) => setNovoDep(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDep()}
                placeholder="Novo departamento"
              />
              <Button onClick={addDep} disabled={deps.criar.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Lista items={deps.items} onDel={delDep} />
          </TabsContent>

          <TabsContent value="cat" className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={novaCat}
                onChange={(e) => setNovaCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCat()}
                placeholder="Nova categoria de despesa"
              />
              <Button onClick={addCat} disabled={cats.criar.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Lista items={cats.items} onDel={delCat} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
