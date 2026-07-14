import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Plus, Trash2, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listCenarios, criarCenario, renomearCenario, excluirCenario,
  listCategorias, listDepartamentos, listTiposRateio,
  listItens, listValoresAnoParaItens, listRateioPartners, listAvulsosAno,
} from "./data";
import { Cadastro, CategoriaRow, Cenario, CenarioSel, Granularidade, Item, MESES_LABEL, Valor } from "./types";
import { ItensView } from "./itens-view";
import { ResumoView } from "./resumo-view";
import { CadastrosDialog } from "./cadastros-dialog";
import { toast } from "sonner";
import { useRoyaltiesPorUnidade } from "@/hooks/use-royalties";

const ANOS = [2024, 2025, 2026, 2027, 2028];

export function DreProjetadaView() {
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [cenarios, setCenarios] = useState<Cenario[]>([]);
  const [cenarioSel, setCenarioSel] = useState<CenarioSel>("base-total");
  const [loadingCen, setLoadingCen] = useState(true);

  const [catReceita, setCatReceita] = useState<CategoriaRow[]>([]);
  const [catDespesa, setCatDespesa] = useState<CategoriaRow[]>([]);
  const [deps, setDeps] = useState<Cadastro[]>([]);
  const [tipos, setTipos] = useState<Cadastro[]>([]);
  const [rateio, setRateio] = useState<import("./types").RateioPartners | undefined>(undefined);

  const [itens, setItens] = useState<Item[]>([]);
  const [valores, setValores] = useState<Valor[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [openCadastros, setOpenCadastros] = useState(false);
  const [granularidade, setGranularidade] = useState<Granularidade>("mensal");
  // 0 = todos os meses; 1..12 = mostra apenas a coluna daquele mês
  const [mesSel, setMesSel] = useState<number>(0);
  const mesFiltro = mesSel === 0 ? null : mesSel;

  // Derivado: cenário real (UUID) ou null para os dois "Base".
  const isBuiltin = cenarioSel === "base-total" || cenarioSel === "base-partners";
  const cenarioId: string | null = isBuiltin ? null : cenarioSel;
  const modoPartners = cenarioSel === "base-partners";

  const reloadCenarios = useCallback(async () => {
    setLoadingCen(true);
    try {
      const list = await listCenarios(ano);
      setCenarios(list);
      // Se o cenário selecionado é UUID e não existe mais, volta pra Base — Total
      if (!isBuiltin && !list.find((c) => c.id === cenarioSel)) {
        setCenarioSel("base-total");
      }
    } finally { setLoadingCen(false); }
  }, [ano, cenarioSel, isBuiltin]);

  const reloadCadastros = useCallback(async () => {
    const [r, d, dep, t, rm] = await Promise.all([
      listCategorias("receita"), listCategorias("despesa"), listDepartamentos(), listTiposRateio(),
      listRateioPartners(ano),
    ]);
    setCatReceita(r); setCatDespesa(d); setDeps(dep); setTipos(t); setRateio(rm);
  }, [ano]);

  const reloadItens = useCallback(async () => {
    setLoadingItens(true);
    try {
      const [itR, itD] = await Promise.all([
        listItens(cenarioId, "receita"),
        listItens(cenarioId, "despesa"),
      ]);
      const all = [...itR, ...itD];
      const vals = await listValoresAnoParaItens(all, ano);
      // Inclui despesas avulsas (compartilhadas com aba Despesas) apenas nas visões base
      if (cenarioId === null) {
        const av = await listAvulsosAno(ano);
        all.push(...av.itens);
        vals.push(...av.valores);
      }
      setItens(all);
      setValores(vals);
    } finally { setLoadingItens(false); }
  }, [cenarioId, ano]);

  useEffect(() => { reloadCenarios(); }, [ano]); // eslint-disable-line
  useEffect(() => { reloadCadastros(); }, [reloadCadastros]);
  useEffect(() => { reloadItens(); }, [reloadItens]);

  async function handleNovoCenario() {
    const nome = prompt("Nome do cenário:", "Base");
    if (!nome) return;
    try {
      const c = await criarCenario(nome.trim(), ano);
      setCenarioSel(c.id);
      await reloadCenarios();
    } catch (e: any) { toast.error(e.message); }
  }
  async function handleRenomear() {
    if (!cenarioId) return;
    const cur = cenarios.find((c) => c.id === cenarioId);
    const nome = prompt("Renomear cenário:", cur?.nome ?? "");
    if (!nome) return;
    try { await renomearCenario(cenarioId, nome.trim()); await reloadCenarios(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function handleExcluir() {
    if (!cenarioId) return;
    if (!confirm("Excluir este cenário e todos os seus itens?")) return;
    try { await excluirCenario(cenarioId); setCenarioSel("base-total"); await reloadCenarios(); }
    catch (e: any) { toast.error(e.message); }
  }

  const receitas = useMemo(() => itens.filter((i) => i.natureza === "receita"), [itens]);
  const despesas = useMemo(() => itens.filter((i) => i.natureza === "despesa"), [itens]);

  // Royalties (categoria "Royalties", só nas visões Base) vem direto da apuração
  // em vez de valor_base/overrides — fonte única com a apuração de royalties.
  const royaltiesQuery = useRoyaltiesPorUnidade(ano);
  const royaltiesMap = cenarioId === null ? royaltiesQuery.data : undefined;

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ano</span>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Cenário</span>
          {loadingCen ? <Skeleton className="h-8 w-[200px]" /> : (
            <Select value={cenarioSel} onValueChange={(v) => setCenarioSel(v as CenarioSel)}>
              <SelectTrigger className="w-[280px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="base-total">Base — Total (sem rateio)</SelectItem>
                <SelectItem value="base-partners">Base — Partners (fatia do rateio)</SelectItem>
                {cenarios.length > 0 && (
                  <div className="my-1 border-t" />
                )}
                {cenarios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={handleNovoCenario}><Plus className="h-4 w-4 mr-1" />Novo</Button>
          {cenarioId && <Button size="icon" variant="ghost" onClick={handleRenomear}><Pencil className="h-4 w-4" /></Button>}
          {cenarioId && <Button size="icon" variant="ghost" onClick={handleExcluir}><Trash2 className="h-4 w-4" /></Button>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={String(mesSel)}
            onValueChange={(v) => {
              const m = Number(v);
              setMesSel(m);
              if (m !== 0) setGranularidade("mensal");
            }}
          >
            <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todos os meses</SelectItem>
              {MESES_LABEL.map((label, i) => (
                <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className={"inline-flex rounded-md border bg-background overflow-hidden " + (mesSel !== 0 ? "opacity-50 pointer-events-none" : "")}>
            {(["mensal", "trimestral", "semestral"] as Granularidade[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularidade(g)}
                className={
                  "px-2.5 h-8 text-xs capitalize transition " +
                  (granularidade === g ? "bg-primary text-primary-foreground" : "hover:bg-muted")
                }
                title={
                  g === "mensal" ? "12 colunas (Jan–Dez)"
                  : g === "trimestral" ? "4 colunas (T1–T4)"
                  : "2 colunas (S1, S2)"
                }
              >
                {g === "mensal" ? "Mensal" : g === "trimestral" ? "Trimestral" : "Semestral"}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpenCadastros(true)}>
            <Settings2 className="h-4 w-4 mr-1" /> Cadastros
          </Button>
        </div>
      </div>

      {loadingItens ? (
        <Skeleton className="h-[400px] w-full" />
      ) : (
        <>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {cenarioId ? (
              <>Editando o cenário <strong className="text-foreground">{cenarios.find((c) => c.id === cenarioId)?.nome}</strong>. Itens sem cenário (base) também aparecem aqui — eles são compartilhados com a aba Despesas.</>
            ) : modoPartners ? (
              <>Visualizando a <strong className="text-foreground">base real com despesas rateadas para o BU Partners</strong>. Receitas seguem 100%. Itens sem critério de rateio cadastrado entram integralmente em Partners. Edição de despesas está desabilitada nesta visão — alterne para <em>Base — Total</em> para editar.</>
            ) : (
              <>Visualizando a <strong className="text-foreground">base real (valores totais, sem rateio)</strong> — mesma fonte da aba Despesas. Alterne para <em>Base — Partners</em> para ver a fatia rateada ao BU Partners.</>
            )}
          </div>
          <Tabs defaultValue="resumo">
            <TabsList>
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="despesas">Despesas ({despesas.length})</TabsTrigger>
              <TabsTrigger value="receitas">Receitas ({receitas.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="resumo" className="mt-3">
              <ResumoView itens={itens} valores={valores} categorias={[...catReceita, ...catDespesa]} departamentos={deps}
                modoPartners={modoPartners} rateio={rateio} granularidade={granularidade} mesFiltro={mesFiltro} royaltiesMap={royaltiesMap} />
            </TabsContent>
            <TabsContent value="despesas" className="mt-3">
              <ItensView natureza="despesa" cenarioId={cenarioId} ano={ano} itens={despesas} valores={valores}
                categorias={catDespesa} departamentos={deps} tiposRateio={tipos} onChanged={reloadItens}
                modoPartners={modoPartners} rateio={rateio} granularidade={granularidade} mesFiltro={mesFiltro} />
            </TabsContent>
            <TabsContent value="receitas" className="mt-3">
              <ItensView natureza="receita" cenarioId={cenarioId} ano={ano} itens={receitas} valores={valores}
                categorias={catReceita} departamentos={deps} tiposRateio={tipos} onChanged={reloadItens}
                modoPartners={false} rateio={rateio} granularidade={granularidade} mesFiltro={mesFiltro} royaltiesMap={royaltiesMap} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <CadastrosDialog open={openCadastros} onOpenChange={setOpenCadastros} onChanged={reloadCadastros} />
    </div>
  );
}
