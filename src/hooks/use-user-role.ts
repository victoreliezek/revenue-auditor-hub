import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "diretor" | "socio";

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        const roles = (data ?? []).map((r) => r.role as AppRole);
        const r: AppRole = roles.includes("admin")
          ? "admin"
          : roles.includes("diretor")
            ? "diretor"
            : roles.includes("socio")
              ? "socio"
              : "diretor";
        setRole(r);
        setLoading(false);
      });
  }, [userId]);

  return { role, isAdmin: role === "admin", isSocio: role === "socio", loading };
}
