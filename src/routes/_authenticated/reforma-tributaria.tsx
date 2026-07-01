import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Printer,
  Maximize2,
  RefreshCw,
  FileBarChart2,
  X,
} from 'lucide-react';
import { DEFAULT_DATA, parseReformaTributariaXlsx, type ReformaTributariaData } from '@/components/reforma-tributaria/xlsx-parser';
import { generatePresentationHTML } from '@/components/reforma-tributaria/html-generator';

export const Route = createFileRoute('/_authenticated/reforma-tributaria')({
  component: ReformaTributariaPage,
});

const ESTADOS = [
  'Acre (AC)', 'Alagoas (AL)', 'Amapá (AP)', 'Amazonas (AM)', 'Bahia (BA)',
  'Ceará (CE)', 'Distrito Federal (DF)', 'Espírito Santo (ES)', 'Goiás (GO)',
  'Maranhão (MA)', 'Mato Grosso (MT)', 'Mato Grosso do Sul (MS)',
  'Minas Gerais (MG)', 'Pará (PA)', 'Paraíba (PB)', 'Paraná (PR)',
  'Pernambuco (PE)', 'Piauí (PI)', 'Rio de Janeiro (RJ)',
  'Rio Grande do Norte (RN)', 'Rio Grande do Sul (RS)', 'Rondônia (RO)',
  'Roraima (RR)', 'Santa Catarina (SC)', 'São Paulo (SP)',
  'Sergipe (SE)', 'Tocantins (TO)',
];

function pct(v: number) {
  return (v * 100).toFixed(2);
}

function ReformaTributariaPage() {
  const [data, setData] = useState<ReformaTributariaData>({ ...DEFAULT_DATA });
  const [fileName, setFileName] = useState('');
  const [parsing, setIsParsing] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [previewUpdating, setPreviewUpdating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const updatePreview = useCallback((d: ReformaTributariaData) => {
    setPreviewUpdating(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const html = generatePresentationHTML(d);
      setHtmlContent(html);
      setPreviewUpdating(false);
    }, 400);
  }, []);

  useEffect(() => {
    updatePreview(data);
  }, [data, updatePreview]);

  const processFile = async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      toast.error('Formato inválido. Use o arquivo .xlsx do Mapa da Reforma.');
      return;
    }
    setIsParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseReformaTributariaXlsx(file);
      setData((prev) => ({ ...prev, ...parsed }));
      toast.success('Arquivo carregado. Revise e ajuste os dados antes de gerar.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar o arquivo.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const setField = <K extends keyof ReformaTributariaData>(k: K, v: ReformaTributariaData[K]) =>
    setData((prev) => ({ ...prev, [k]: v }));

  const setYearField = (idx: number, field: 'desembolso' | 'carga', value: number) =>
    setData((prev) => {
      const years = prev.years.map((y, i) => (i === idx ? { ...y, [field]: value } : y));
      return { ...prev, years };
    });

  const handleDownload = () => {
    const html = generatePresentationHTML(data);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = data.empresa ? data.empresa.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : 'cliente';
    a.download = `mapa-reforma-tributaria-${slug}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Apresentação baixada.');
  };

  const handlePrint = () => {
    const html = generatePresentationHTML(data);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const handleFullscreen = () => {
    iframeRef.current?.requestFullscreen?.();
  };

  const clearFile = () => {
    setFileName('');
    setData({ ...DEFAULT_DATA });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── LEFT COLUMN — FORM ── */}
      <div className="w-[420px] shrink-0 flex flex-col border-r border-border overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <FileBarChart2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold">Reforma Tributária</h1>
                <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-500">Confidencial</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Gere apresentações a partir do arquivo de simulação</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* ── UPLOAD ── */}
          <section>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              1 · Arquivo Excel
            </Label>
            {!fileName ? (
              <label
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:border-emerald-500/50 hover:bg-accent/30'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} />
                {parsing ? (
                  <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium">{parsing ? 'Processando...' : 'Arraste ou clique para carregar'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Mapa da Reforma Tributária (.xlsx)</p>
                </div>
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{fileName}</p>
                  <p className="text-[11px] text-emerald-400">Dados importados</p>
                </div>
                <button onClick={clearFile} className="p-1 rounded hover:bg-accent">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
          </section>

          {/* ── EMPRESA ── */}
          <section>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              2 · Dados da empresa
            </Label>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Razão Social</Label>
                <Input
                  placeholder="Ex: Primo Rolamentos Ltda"
                  value={data.empresa}
                  onChange={(e) => setField('empresa', e.target.value)}
                  className="text-sm h-8"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Estado</Label>
                <Select value={data.estado} onValueChange={(v) => setField('estado', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => (
                      <SelectItem key={e} value={e} className="text-sm">{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Atividade / CNAE</Label>
                <Input
                  placeholder="Ex: Comércio atacadista industrial"
                  value={data.atividade}
                  onChange={(e) => setField('atividade', e.target.value)}
                  className="text-sm h-8"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Referência</Label>
                <Input
                  placeholder="Ex: Junho de 2026"
                  value={data.referencia}
                  onChange={(e) => setField('referencia', e.target.value)}
                  className="text-sm h-8"
                />
              </div>
            </div>
          </section>

          {/* ── BASE ── */}
          <section>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              3 · Base da simulação
            </Label>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Faturamento anual (R$)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={data.faturamento || ''}
                  onChange={(e) => setField('faturamento', parseFloat(e.target.value) || 0)}
                  className="text-sm h-8 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Aquisições anuais (R$)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={data.aquisicoes || ''}
                  onChange={(e) => setField('aquisicoes', parseFloat(e.target.value) || 0)}
                  className="text-sm h-8 font-mono"
                />
              </div>
            </div>
          </section>

          {/* ── ANOS ── */}
          <section>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              4 · Progressão ano a ano
            </Label>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-2 text-muted-foreground font-medium">Ano</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Carga (%)</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Desembolso (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.years.map((y, i) => (
                      <tr
                        key={y.ano}
                        className={`border-b border-border last:border-0 ${i === data.years.length - 1 ? 'bg-emerald-500/5' : ''}`}
                      >
                        <td className="p-2 font-medium">{y.ano}</td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            max="1"
                            value={y.carga || ''}
                            onChange={(e) => setYearField(i, 'carga', parseFloat(e.target.value) || 0)}
                            className="w-full text-right bg-transparent font-mono text-xs outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1 py-0.5"
                            title={`${pct(y.carga)}%`}
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={y.desembolso || ''}
                            onChange={(e) => setYearField(i, 'desembolso', parseFloat(e.target.value) || 0)}
                            className="w-full text-right bg-transparent font-mono text-xs outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1 py-0.5"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="text-[11px] text-muted-foreground mt-1">Carga em decimal (ex: 0.0759 = 7,59%)</p>
          </section>

          {/* ── ALÍQUOTAS ── */}
          <section>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              5 · Alíquotas
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['CBS', 'cbs'],
                  ['IBS Estadual', 'ibsEstadual'],
                  ['IBS Municipal', 'ibsMunicipal'],
                  ['IPI', 'ipi'],
                ] as const
              ).map(([label, key]) => (
                <div key={key}>
                  <Label className="text-xs mb-1 block">{label}</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    value={data.aliquotas[key] || ''}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        aliquotas: { ...prev.aliquotas, [key]: parseFloat(e.target.value) || 0 },
                      }))
                    }
                    className="text-sm h-8 font-mono"
                    title={`${pct(data.aliquotas[key])}%`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── OBSERVAÇÕES ── */}
          <section>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              6 · Observações da auditora
            </Label>
            <Textarea
              placeholder="Adicione notas técnicas, contextos relevantes ou recomendações para o cliente..."
              value={data.observacoes}
              onChange={(e) => setField('observacoes', e.target.value)}
              className="text-sm resize-none"
              rows={4}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Aparece como "Nota da Auditora" na apresentação</p>
          </section>
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div className="p-4 border-t border-border shrink-0 space-y-2">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm h-9"
            onClick={() => updatePreview(data)}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Atualizar preview
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="text-sm h-9" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Baixar HTML
            </Button>
            <Button variant="outline" className="text-sm h-9" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-2" />
              Imprimir / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN — PREVIEW ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${previewUpdating ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-xs text-muted-foreground">
              {previewUpdating ? 'Atualizando preview...' : 'Preview da apresentação'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {data.empresa && (
              <Badge variant="outline" className="text-[10px]">{data.empresa}</Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFullscreen}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            className="w-full h-full border-0 bg-[#080808]"
            title="Preview da apresentação"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}
