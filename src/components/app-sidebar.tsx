import { Link, useRouterState } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Users, ShieldCheck, Building2, Coins, BadgeCheck, Wallet, Smile, MessageSquareWarning, Filter, Gauge, LineChart, Receipt, Activity, BarChart3, GitMerge, FileBarChart2, KeyRound } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PlanningLogo } from "@/components/planning-logo";
import { usePermissions } from "@/hooks/use-permissions";

type Item = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
};

const DEFAULT_GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Início",
    items: [{ title: "Overview", url: "/rede-overview", icon: Activity, permission: "view.hub" }],
  },
  {
    label: "Operação",
    items: [
      { title: "Clientes", url: "/clientes", icon: Building2, permission: "view.clientes" },
      { title: "NPS", url: "/nps", icon: Smile, permission: "view.clientes" },
      { title: "Tratativas", url: "/tratativas", icon: MessageSquareWarning, permission: "view.clientes" },
    ],
  },
  {
    label: "Performance da Rede",
    items: [
      { title: "LTV Estimado", url: "/rede-ltv", icon: TrendingUp, permission: "view.clientes" },
      { title: "Headcount", url: "/rede-headcount", icon: Users, permission: "view.roas" },
      { title: "Realizado Unidades", url: "/rede-realizado", icon: BarChart3, permission: "view.clientes" },
    ],
  },
  {
    label: "Receita da Rede",
    items: [
      { title: "Funil de Receita", url: "/funil-receita", icon: Filter, permission: "view.roas" },
      { title: "Reconciliação", url: "/reconciliacao", icon: GitMerge, permission: "view.roas" },
      { title: "Contas a Receber", url: "/contas-receber", icon: Wallet, permission: "view.contas_receber" },
      { title: "Unidades", url: "/unidades", icon: Coins, permission: "view.auditoria.cac" },
    ],
  },
  {
    label: "Planning Partners",
    items: [
      { title: "Financeiro Partners", url: "/financeiro-partners", icon: Receipt, permission: "view.roas" },
      { title: "Receita Partners", url: "/receita-partners", icon: LineChart, permission: "view.roas" },
      { title: "Despesas Partners", url: "/despesas-cm", icon: TrendingDown, permission: "view.roas" },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { title: "Reforma Tributária", url: "/reforma-tributaria", icon: FileBarChart2, permission: "view.reforma_tributaria" },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Usuários", url: "/admin/usuarios", icon: Users, permission: "view.admin.users" },
      { title: "Permissões", url: "/admin/permissoes", icon: ShieldCheck, permission: "view.admin.permissions" },
      { title: "Validação de páginas", url: "/admin/validacao", icon: BadgeCheck, permission: "view.admin.permissions" },
      { title: "Integrações", url: "/admin/integracoes", icon: KeyRound, permission: "view.admin.integracoes" },
    ],
  },
];

const SOCIO_FRANQUEADO_GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Minha Unidade",
    items: [
      { title: "Painel", url: "/painel-unidade", icon: Gauge },
      { title: "Clientes", url: "/clientes", icon: Building2 },
      { title: "NPS", url: "/nps", icon: Smile },
      { title: "Tratativas", url: "/tratativas", icon: MessageSquareWarning },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Funil de Receita", url: "/funil-receita", icon: Filter },
      { title: "Contas a Receber", url: "/contas-receber", icon: Wallet },
      { title: "Meus Royalties", url: "/meus-royalties", icon: Coins },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, loading, primaryRole } = usePermissions();

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  const groups = primaryRole === "socio_franqueado" ? SOCIO_FRANQUEADO_GROUPS : DEFAULT_GROUPS;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5">
          <PlanningLogo className="h-7 w-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => {
          const visible = group.items.filter((i) => !i.permission || (!loading && can(i.permission)));
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => (
                    <SidebarMenuItem key={`${group.label}-${item.title}`}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t px-2 py-2 text-[10px] text-muted-foreground">
        Ops Board
      </SidebarFooter>
    </Sidebar>
  );
}
