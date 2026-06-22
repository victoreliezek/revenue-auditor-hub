import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Mapping = {
  fornecedor: string;
  categoria: string;
  departamento: string;
  valor: string;
};

const FIELDS: { key: keyof Mapping; label: string; required: boolean; aliases: string[] }[] = [
  { key: "fornecedor", label: "Fornecedor / Descrição", required: true, aliases: ["fornecedor", "descricao", "descrição", "despesa", "historico", "histórico"] },
  { key: "categoria", label: "Categoria / Tipo de despesa", required: false, aliases: ["categoria", "tipo de despesa", "tipo despesa", "tipo"] },
  { key: "departamento", label: "Departamento", required: true, aliases: ["departamento", "depto", "dpto", "setor"] },
  { key: "valor", label: "Valor total", required: true, aliases: ["valor", "valor total", "total", "r$", "montante"] },
];

const LS_KEY = "despesas-import-mapping-v1";

function parseValor(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  s = s.replace(/R\$\s?/gi, "").replace(/\s/g, "");
  // formato brasileiro: 1.234,56 → 1234.56
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function autoMap(headers: string[]): Mapping {
  const norm = (s: string) => s.toLowerCase().trim();
  const m: Mapping = { fornecedor: "", categoria: "", departamento: "", valor: "" };
  for (const f of FIELDS) {
    const found = headers.find((h) => f.aliases.some((a) => norm(h).includes(a)));
    if (found) m[f.key] = found;
  }
  return m;
}

function toMesISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function ImportarPlanilhaDialog({
  open,
  onOpenChange,
  mesPadrao,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mesPadrao: string;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ fornecedor: "", categoria: "", departamento: "", valor: "" });
  const [mes, setMes] = useState(mesPadrao.slice(0, 7));
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({ fornecedor: "", categoria: "", departamento: "", valor: "" });
  };

  const handleFile = async (f: File) => {
    setFile(f);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    if (json.length === 0) {
      toast.error("Planilha vazia.");
      return;
    }
    const hdrs = Object.keys(json[0]);
    setHeaders(hdrs);
    setRows(json);
    // mapping: salvo > automático
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? "null") as Mapping | null;
      } catch {
        return null;
      }
    })();
    const auto = autoMap(hdrs);
    const merged: Mapping = {
      fornecedor: saved?.fornecedor && hdrs.includes(saved.fornecedor) ? saved.fornecedor : auto.fornecedor,
      categoria: saved?.categoria && hdrs.includes(saved.categoria) ? saved.categoria : auto.categoria,
      departamento: saved?.departamento && hdrs.includes(saved.departamento) ? saved.departamento : auto.departamento,
      valor: saved?.valor && hdrs.includes(saved.valor) ? saved.valor : auto.valor,
    };
    setMapping(merged);
  };

  const preview = useMemo(() => {
    if (!mapping.fornecedor || !mapping.valor || !mapping.departamento) return [];
    return rows.slice(0, 20).map((r) => ({
      fornecedor: String(r[mapping.fornecedor] ?? "").trim(),
      categoria: mapping.categoria ? String(r[mapping.categoria] ?? "").trim() : "",
      departamento: String(r[mapping.departamento] ?? "").trim(),
      valor: parseValor(r[mapping.valor]),
    }));
  }, [rows, mapping]);

  const validRowsAll = useMemo(() => {
    if (!mapping.fornecedor || !mapping.valor || !mapping.departamento) return [];
    return rows
      .map((r) => ({
        fornecedor: String(r[mapping.fornecedor] ?? "").trim(),
        categoria: mapping.categoria ? String(r[mapping.categoria] ?? "").trim() : "",
        departamento: String(r[mapping.departamento] ?? "").trim(),
        valor: parseValor(r[mapping.valor]),
      }))
      .filter((r) => r.fornecedor && r.departamento && r.valor != null && r.valor > 0);
  }, [rows, mapping]);

  const confirmar = async () => {
    if (validRowsAll.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }
    setBusy(true);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(mapping));
      const mesISO = `${mes}-01`;
      const lote = `import-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      const payload = validRowsAll.map((r) => ({
        mes: mesISO,
        fornecedor: r.fornecedor,
        categoria: r.categoria || null,
        departamento: r.departamento,
        valor_total: r.valor as number,
        rateio_regra: "padrao",
        status: "pendente",
        apuracao_status: "pendente",
        origem_apuracao: "financeiro-mensal",
        importacao_lote: lote,
        importado_em: new Date().toISOString(),
        importado_por: uid,
      }));
      const { error } = await supabase.from("despesas_cm_avulsos").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} despesa(s) importadas como pendentes.`);
      onImported();
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error("Erro ao importar: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [yStr, mStr] = mes.split("-");
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar planilha do financeiro
          </DialogTitle>
        </DialogHeader>

        {!file ? (
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-10 text-center hover:bg-muted/40"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">Clique para selecionar XLSX ou CSV</div>
            <div className="text-xs text-muted-foreground">Até 5MB</div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 5 * 1024 * 1024) {
                    toast.error("Arquivo maior que 5MB.");
                    return;
                  }
                  handleFile(f);
                }
              }}
            />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">· {rows.length} linha(s)</span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Mês de destino</Label>
                <div className="flex gap-1">
                  <Select value={String(Number(mStr))} onValueChange={(v) => setMes(`${yStr}-${String(Number(v)).padStart(2, "0")}`)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {meses.map((nome, i) => <SelectItem key={i + 1} value={String(i + 1)}>{nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={yStr} onValueChange={(v) => setMes(`${v}-${mStr}`)}>
                    <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select
                    value={mapping[f.key] || "__none__"}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="rounded-md border">
              <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium">
                Preview (até 20 linhas) — {validRowsAll.length} de {rows.length} linha(s) válidas
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Fornecedor</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2">Depto</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => {
                      const ok = r.fornecedor && r.departamento && r.valor != null && r.valor > 0;
                      return (
                        <tr key={i} className={`border-b last:border-0 ${ok ? "" : "bg-red-50 dark:bg-red-950/20"}`}>
                          <td className="px-3 py-1.5">{r.fornecedor || <span className="text-destructive">faltando</span>}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.categoria || "—"}</td>
                          <td className="px-3 py-1.5">{r.departamento || <span className="text-destructive">faltando</span>}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {r.valor != null ? r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : <span className="text-destructive">inválido</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={confirmar} disabled={busy || validRowsAll.length === 0}>
            {busy ? "Importando..." : `Importar ${validRowsAll.length} item(ns) como pendentes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
