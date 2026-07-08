import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BiVendasDataProvider } from "@/components/bi-vendas/data-context";
import { ByBuTab } from "@/components/bi-vendas/by-bu-tab";

export const Route = createFileRoute("/_authenticated/bi-vendas")({
  component: BiVendasPage,
});

function BiVendasPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">BI de Vendas</h1>
      </div>

      <BiVendasDataProvider>
        <Tabs defaultValue="por-bu">
          <TabsList>
            <TabsTrigger value="por-bu">Visão por BU</TabsTrigger>
          </TabsList>
          <TabsContent value="por-bu">
            <ByBuTab />
          </TabsContent>
        </Tabs>
      </BiVendasDataProvider>
    </div>
  );
}
