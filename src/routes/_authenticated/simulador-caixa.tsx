import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, Calendar, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/simulador-caixa")({
  head: () => ({
    meta: [
      { title: "Simulador de Fluxo de Caixa – Planning" },
      { name: "description", content: "Simulação do vale de caixa entre mídia e royalties." },
    ],
  }),
  component: SimuladorPage,
});

const FALLBACK = { investimento: 185687, roas: 1.1, royalties: 9.0 };

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function SimuladorPage() {
  const [loading, setLoading] = useState(true);
  const [investimento, setInvestimento] = useState<number>(FALLBACK.investimento);
  const [roas, setRoas] = useState<number>(FALLBACK.roas);
  const [royalties, setRoyalties] = useState<number>(FALLBACK.royalties);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          supabase
            .from("roas_mensal")
            .select("investimento_real, roas_direto, mes")
            .gte("mes", "2025-12-01")
            .lte("mes", "2026-05-31")
            .gt("investimento_real", 0),
          (supabase as unknown as {
            from: (t: string) => {
              select: (s: string) => { gte: (c: string, v: string) => Promise<{ data: unknown; error: unknown }> };
            };
          })
            .from("v_royalties_mensais")
            .select("faturado, royalties_percentual, mes")
            .gte("mes", "2026-06-01"),
        ]);
        if (cancel) return;
        if (a.error) throw a.error;
        if (b.error) throw b.error;
        const rowsA = (a.data ?? []) as { investimento_real: number | null; roas_direto: number | null }[];
        if (rowsA.length > 0) {
          const inv = rowsA.reduce((s, r) => s + Number(r.investimento_real ?? 0), 0) / rowsA.length;
          const rs = rowsA.filter((r) => r.roas_direto != null);
          const ro = rs.length ? rs.reduce((s, r) => s + Number(r.roas_direto ?? 0), 0) / rs.length : FALLBACK.roas;
          setInvestimento(Math.round(inv));
          setRoas(Math.round(ro * 100) / 100);
        }
        const rowsB = ((b.data ?? []) as { faturado: number | null; royalties_percentual: number | null }[]).filter(
          (r) => Number(r.faturado ?? 0) > 0 && r.royalties_percentual != null,
        );
        if (rowsB.length > 0) {
          const num = rowsB.reduce((s, r) => s + Number(r.faturado) * Number(r.royalties_percentual) / 100, 0);
          const den = rowsB.reduce((s, r) => s + Number(r.faturado), 0);
          if (den > 0) setRoyalties(Math.round((num / den) * 1000) / 100);
        }
      } catch (e) {
        console.error("simulador defaults:", e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const { data, drawdown, breakeven, payback } = useMemo(() => {
    const arr: { mes: number; entradaRoas: number; entradaRoyalties: number; saida: number; fluxo: number; acumulado: number }[] = [];
    let acc = 0;
    let dd = 0;
    let be: number | null = null;
    let pb: number | null = null;
    for (let m = 0; m <= 35; m++) {
      const saida = investimento;
      const entradaRoas = m >= 3 ? investimento * roas : 0;
      const entradaRoyalties = m >= 4 ? investimento * roas * (royalties / 100) * (m - 3) : 0;
      const fluxo = entradaRoas + entradaRoyalties - saida;
      acc += fluxo;
      if (acc < dd) dd = acc;
      if (be === null && fluxo >= 0) be = m;
      if (pb === null && acc >= 0) pb = m;
      arr.push({
        mes: m,
        entradaRoas,
        entradaRoyalties,
        saida,
        fluxo,
        acumulado: Math.round(acc),
      });
    }
    return { data: arr, drawdown: dd, breakeven: be, payback: pb };
  }, [investimento, roas, royalties]);

  return (
    <AppShell title="Simulador de Fluxo de Caixa" subtitle="Vale do caixa: mídia mensal × royalties fracionados">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 border-l-4 border-l-destructive">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Aporte Máximo Necessário</div>
                <div className="mt-2 text-3xl font-bold text-destructive">{fmtBRL(drawdown)}</div>
                <div className="text-xs text-muted-foreground mt-1">Fundo do Vale de Caixa</div>
              </div>
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Break-even Operacional</div>
                <div className="mt-2 text-3xl font-bold">{breakeven !== null ? `Mês ${breakeven}` : "Fora do período"}</div>
                <div className="text-xs text-muted-foreground mt-1">1º fluxo mensal ≥ 0</div>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-5 border-l-4 border-l-emerald-500">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Payback Total (ROI+)</div>
                <div className="mt-2 text-3xl font-bold text-emerald-600">{payback !== null ? `Mês ${payback}` : "Fora do período"}</div>
                <div className="text-xs text-muted-foreground mt-1">Caixa acumulado ≥ 0</div>
              </div>
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controles */}
          <Card className="lg:col-span-1 p-5 space-y-6 h-fit">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parâmetros</h3>

            <ControlSlider
              label="Investimento Mensal em Mídia"
              loading={loading}
              value={investimento}
              min={10000}
              max={500000}
              step={1000}
              onChange={setInvestimento}
              display={fmtBRL(investimento)}
              hint="Média real dos últimos 6 meses"
            />

            <ControlSlider
              label="ROAS Médio do Mês 3"
              loading={loading}
              value={roas}
              min={0.1}
              max={2.0}
              step={0.05}
              onChange={setRoas}
              display={roas.toFixed(2) + "x"}
              hint="Média real dos últimos 6 meses"
            />

            <ControlSlider
              label="Taxa de Royalties"
              loading={loading}
              value={royalties}
              min={4}
              max={20}
              step={0.5}
              onChange={setRoyalties}
              display={royalties.toFixed(1) + "%"}
              hint="Média ponderada das unidades"
            />
          </Card>

          {/* Gráfico */}
          <Card className="lg:col-span-3 p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Caixa Acumulado — 36 meses</h3>
              <p className="text-xs text-muted-foreground">Área vermelha = passivo (vale do caixa). Área verde = lucro pós-payback.</p>
            </div>
            <div className="h-[460px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="negFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                    </linearGradient>
                    <linearGradient id="posFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" tickFormatter={(v) => `M${v}`} tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} label={{ value: "Break-even", position: "insideTopRight", fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const p = payload[0].payload as (typeof data)[number];
                      return (
                        <div className="rounded-md border bg-background p-3 text-xs shadow-md">
                          <div className="font-semibold mb-1">Mês {p.mes}</div>
                          <div>Entrada Mensalidade: <strong>{fmtBRL(p.entradaRoas)}</strong></div>
                          <div>Entrada Royalties: <strong>{fmtBRL(p.entradaRoyalties)}</strong></div>
                          <div>Saída Mídia: <strong className="text-destructive">−{fmtBRL(p.saida)}</strong></div>
                          <div className="mt-1 border-t pt-1">Fluxo Líquido: <strong className={p.fluxo >= 0 ? "text-emerald-600" : "text-destructive"}>{fmtBRL(p.fluxo)}</strong></div>
                          <div>Caixa Acumulado: <strong className={p.acumulado >= 0 ? "text-emerald-600" : "text-destructive"}>{fmtBRL(p.acumulado)}</strong></div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={(d: (typeof data)[number]) => (d.acumulado < 0 ? d.acumulado : 0)}
                    stroke="hsl(var(--destructive))"
                    strokeWidth={0}
                    fill="url(#negFill)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey={(d: (typeof data)[number]) => (d.acumulado > 0 ? d.acumulado : 0)}
                    stroke="#10b981"
                    strokeWidth={0}
                    fill="url(#posFill)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="acumulado"
                    stroke="hsl(var(--foreground))"
                    strokeWidth={2}
                    fill="transparent"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function ControlSlider({
  label,
  loading,
  value,
  min,
  max,
  step,
  onChange,
  display,
  hint,
}: {
  label: string;
  loading: boolean;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">{label}</label>
        <span className="text-sm font-bold tabular-nums">{display}</span>
      </div>
      {loading ? (
        <Skeleton className="h-4 w-full" />
      ) : (
        <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
      )}
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{hint}</div>
    </div>
  );
}
