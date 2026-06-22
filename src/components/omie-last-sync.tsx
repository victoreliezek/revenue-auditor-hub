import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function formatBrasilia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

export function OmieLastSync({ className }: { className?: string }) {
  const [when, setWhen] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("sync_log")
        .select("executado_em")
        .eq("fonte", "omie")
        .order("executado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mounted) return;
      if (data?.executado_em) setWhen(formatBrasilia(data.executado_em));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!when) return null;
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      Última atualização Omie: {when}
    </span>
  );
}
