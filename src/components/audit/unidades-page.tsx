import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeParaMensalTab } from "./de-para-mensal-tab";
import { usePermissions } from "@/hooks/use-permissions";

export function UnidadesPage() {
  const { can } = usePermissions();
  const showRoy = can("view.auditoria.royalties");
  const showCac = can("view.auditoria.cac");
  const defaultTab = showRoy ? "royalties" : "cac";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {showRoy && <TabsTrigger value="royalties">Royalties</TabsTrigger>}
        {showCac && <TabsTrigger value="cac">CAC</TabsTrigger>}
      </TabsList>
      {showRoy && (
        <TabsContent value="royalties" className="space-y-4">
          <DeParaMensalTab tipo="royalties" />
        </TabsContent>
      )}
      {showCac && (
        <TabsContent value="cac" className="space-y-4">
          <DeParaMensalTab tipo="cac" />
        </TabsContent>
      )}
    </Tabs>
  );
}
