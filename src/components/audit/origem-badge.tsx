import type { OrigemBase } from "./data-context";

export function OrigemBadge({ value }: { value: OrigemBase }) {
  if (value === "Base Antiga") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
        Base Antiga
      </span>
    );
  }
  if (value === "Base Nova") {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
        Base Nova
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      Sem cadastro
    </span>
  );
}

export type OrigemFilter = "" | "Base Nova" | "Base Antiga" | "sem";

export function groupByOrigem<T extends { cnpj: string | null }>(
  rows: T[],
  origemFor: (r: T) => OrigemBase,
): { nova: T[]; antiga: T[]; semCadastro: T[] } {
  const nova: T[] = [];
  const antiga: T[] = [];
  const semCadastro: T[] = [];
  for (const r of rows) {
    const o = origemFor(r);
    if (o === "Base Nova") nova.push(r);
    else if (o === "Base Antiga") antiga.push(r);
    else semCadastro.push(r);
  }
  return { nova, antiga, semCadastro };
}
