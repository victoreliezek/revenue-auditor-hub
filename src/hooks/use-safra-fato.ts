import { useCallback, useEffect, useState } from "react";

export type SafraFatoMode = "safra" | "fato";

export type SafraFatoState = {
  mode: SafraFatoMode;
  mes: string; // YYYY-MM
};

const KEY = "safra-fato";

function defaultMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readUrl(): Partial<SafraFatoState> {
  if (typeof window === "undefined") return {};
  const u = new URL(window.location.href);
  const mode = u.searchParams.get("modo") as SafraFatoMode | null;
  const mes = u.searchParams.get("mes");
  return {
    mode: mode === "safra" || mode === "fato" ? mode : undefined,
    mes: mes && /^\d{4}-\d{2}$/.test(mes) ? mes : undefined,
  };
}

function writeUrl(s: SafraFatoState) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.set("modo", s.mode);
  u.searchParams.set("mes", s.mes);
  window.history.replaceState({}, "", u.toString());
}

/**
 * Hook compartilhado de filtro Safra ⇄ Fato.
 * - Safra: data de origem do dado (ex.: ganho_em do contrato, data_competencia da fatura)
 * - Fato: data de realização (ex.: data_pagamento, data_vencimento, contrato ativo no mês)
 *
 * O estado é persistido em URL (?modo=safra|fato&mes=YYYY-MM) para deep-link.
 */
export function useSafraFato(initial?: Partial<SafraFatoState>): {
  mode: SafraFatoMode;
  mes: string;
  setMode: (m: SafraFatoMode) => void;
  setMes: (m: string) => void;
  range: { start: Date; end: Date };
} {
  const fromUrl = readUrl();
  const [state, setState] = useState<SafraFatoState>({
    mode: fromUrl.mode ?? initial?.mode ?? "fato",
    mes: fromUrl.mes ?? initial?.mes ?? defaultMes(),
  });

  useEffect(() => {
    writeUrl(state);
  }, [state]);

  const setMode = useCallback(
    (m: SafraFatoMode) => setState((s) => ({ ...s, mode: m })),
    [],
  );
  const setMes = useCallback((m: string) => setState((s) => ({ ...s, mes: m })), []);

  const [y, m] = state.mes.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  return { mode: state.mode, mes: state.mes, setMode, setMes, range: { start, end } };
}

export function mesLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildMesOptions(months = 18): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: v, label: mesLabel(v) });
  }
  return out;
}
