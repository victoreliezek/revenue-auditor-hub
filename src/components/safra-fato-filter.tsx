import { Calendar, History } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  buildMesOptions,
  type SafraFatoMode,
} from "@/hooks/use-safra-fato";

type Props = {
  mode: SafraFatoMode;
  mes: string;
  onModeChange: (m: SafraFatoMode) => void;
  onMesChange: (m: string) => void;
  className?: string;
  /** mostra/oculta o seletor de mês (alguns relatórios usam só o toggle) */
  showMes?: boolean;
};

export function SafraFatoFilter({
  mode,
  mes,
  onModeChange,
  onMesChange,
  className,
  showMes = true,
}: Props) {
  const meses = buildMesOptions(18);
  return (
    <TooltipProvider>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <div className="flex items-center gap-1 rounded-md border p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onModeChange("safra")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === "safra"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <History className="h-3.5 w-3.5" />
                Safra
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <strong>Safra</strong> — data em que o dado foi originado
              (ex.: cliente ganho no mês, fatura emitida no mês de competência).
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onModeChange("fato")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === "fato"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Fato
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <strong>Fato</strong> — resultado realizado no período
              (ex.: contratos ativos no mês, pagamentos efetivamente recebidos),
              independente da data de origem.
            </TooltipContent>
          </Tooltip>
        </div>
        {showMes && (
          <Select value={mes} onValueChange={onMesChange}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </TooltipProvider>
  );
}
