import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCategoriasReceita } from "@/hooks/use-cadastros-receitas";
import { useDepartamentosDespesa } from "@/hooks/use-cadastros-despesas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CadastrosReceitasDialog({ open, onOpenChange }: Props) {
  const cats = useCategoriasReceita();
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

  function Lista({
    items,
    onDel,
  }: {
    items: { id: string; nome: string }[];
    onDel: (id: string) => void;
  }) {
    if (items.length === 0)
      return (
        <div className="text-xs text-muted-foreground p-2">
          Nenhum cadastro.
        </div>
      );
    return (
      <ul className="divide-y border rounded">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span>{it.nome}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDel(it.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  async function delCat(id: string) {
    if (!confirm("Excluir esta categoria?")) return;
    try {
      await cats.excluir.mutateAsync(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function delDep(id: string) {
    if (!confirm("Excluir este departamento?")) return;
    try {
      await deps.excluir.mutateAsync(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastros — Receitas</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="cat">
          <TabsList>
            <TabsTrigger value="cat">Categorias</TabsTrigger>
            <TabsTrigger value="dep">Departamentos</TabsTrigger>
          </TabsList>
          <TabsContent value="cat" className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={novaCat}
                onChange={(e) => setNovaCat(e.target.value)}
                placeholder="Nova categoria"
              />
              <Button onClick={addCat} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Lista items={cats.items} onDel={delCat} />
          </TabsContent>
          <TabsContent value="dep" className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={novoDep}
                onChange={(e) => setNovoDep(e.target.value)}
                placeholder="Novo departamento"
              />
              <Button onClick={addDep} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Lista items={deps.items} onDel={delDep} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
