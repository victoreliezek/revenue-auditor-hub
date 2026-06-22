import { cn } from "@/lib/utils";

const pagamentoMap: Record<string, string> = {
  adimplente: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  inadimplente: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  recente: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  sem_dados: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const matchMap: Record<string, string> = {
  matched: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  deal_sem_planning: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  planning_sem_deal: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
};

const tipoMap: Record<string, string> = {
  Recorrente: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  "Avulso (On-Time)": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
};

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

export const PagamentoBadge = ({ value }: { value: string }) => (
  <Pill className={pagamentoMap[value] ?? "bg-slate-100 text-slate-700"}>{value}</Pill>
);
const matchLabels: Record<string, string> = {
  matched: "Vinculado",
  deal_sem_planning: "Venda sem recebimento",
  planning_sem_deal: "Recebimento sem venda",
};
export const MatchBadge = ({ value }: { value: string }) => (
  <Pill className={matchMap[value] ?? "bg-slate-100 text-slate-700"}>{matchLabels[value] ?? value.replaceAll("_", " ")}</Pill>
);
export const TipoBadge = ({ value }: { value: string | null }) => (
  <Pill className={tipoMap[value ?? ""] ?? "bg-slate-100 text-slate-700"}>{value ?? "—"}</Pill>
);
