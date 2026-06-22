export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const num = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR");

export const date = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
};

export const pct = (n: number, total: number) =>
  total === 0 ? "0%" : `${((n / total) * 100).toFixed(1)}%`;
