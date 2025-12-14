import { LayoutDashboard, Bell, User, Shield, CreditCard, Calendar, History, Settings, Star, MessageSquare, BarChart3, Send, QrCode, Megaphone, Users, Mail, Filter, Workflow, TrendingUp, Database, Plug, ShoppingCart } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
    showBadge: true,
  },
  {
    title: "Mon compte",
    url: "/account",
    icon: User,
  },
];

const guaranteeItems = [
  {
    title: "Configuration",
    url: "/settings/guarantee",
    icon: Settings,
  },
  {
    title: "Réservations",
    url: "/guarantee/reservations",
    icon: Calendar,
  },
  {
    title: "Historique",
    url: "/guarantee/history",
    icon: History,
  },
];

const reviewsItems = [
  {
    title: "Configuration",
    url: "/reviews/settings",
    icon: Settings,
  },
  {
    title: "Campagnes",
    url: "/reviews/campaigns",
    icon: Send,
  },
  {
    title: "QR & Widgets",
    url: "/reviews/widgets",
    icon: QrCode,
  },
  {
    title: "Tous les avis",
    url: "/reviews",
    icon: MessageSquare,
  },
  {
    title: "Statistiques",
    url: "/reviews/stats",
    icon: BarChart3,
  },
];

const marketingItems = [
  {
    title: "Vue d'ensemble",
    url: "/marketing",
    icon: Megaphone,
  },
  {
    title: "Audience",
    url: "/marketing/contacts",
    icon: Users,
  },
  {
    title: "Campagnes",
    url: "/marketing/campaigns",
    icon: Mail,
  },
  {
    title: "Templates",
    url: "/marketing/templates",
    icon: Send,
  },
  {
    title: "Automations",
    url: "/marketing/automations",
    icon: Workflow,
  },
      {
        title: "Analytics",
        url: "/marketing/analytics",
        icon: TrendingUp,
      },
];

const integrationItems = [
  {
    title: "Vue d'ensemble",
    url: "/integrations",
    icon: Database,
  },
  {
    title: "Connexions",
    url: "/integrations/connections",
    icon: Plug,
  },
  {
    title: "Clients",
    url: "/integrations/customers",
    icon: Users,
  },
  {
    title: "Commandes",
    url: "/integrations/orders",
    icon: ShoppingCart,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useUser();

  const { data: unreadCount } = useQuery<number>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000,
  });

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                      {item.showBadge && unreadCount && unreadCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto h-5 min-w-5 px-1 flex items-center justify-center text-xs"
                          data-testid="badge-unread-count"
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {user?.role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin"}>
                    <Link href="/admin" data-testid="link-administration">
                      <Shield />
                      <span>Administration</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-[#C8B88A]">
            <CreditCard className="h-4 w-4" />
            Garantie CB
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {guaranteeItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-guarantee-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-[#C8B88A]">
            <Star className="h-4 w-4" />
            Avis & Réputation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reviewsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url || (item.url === "/reviews" && location.startsWith("/reviews/") && !reviewsItems.some(i => i.url !== "/reviews" && location === i.url))}>
                    <Link href={item.url} data-testid={`link-reviews-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-[#C8B88A]">
            <Megaphone className="h-4 w-4" />
            Marketing
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {marketingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url || (item.url === "/marketing" && location.startsWith("/marketing/") && !marketingItems.some(i => i.url !== "/marketing" && location === i.url))}>
                    <Link href={item.url} data-testid={`link-marketing-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-[#C8B88A]">
            <Database className="h-4 w-4" />
            Intégrations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {integrationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url || (item.url === "/integrations" && location.startsWith("/integrations/") && !integrationItems.some(i => i.url !== "/integrations" && location === i.url))}>
                    <Link href={item.url} data-testid={`link-integration-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
