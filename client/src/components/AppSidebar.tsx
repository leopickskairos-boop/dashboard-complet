import { LayoutDashboard, Bell, User, Shield, CreditCard, Calendar, History, Settings } from "lucide-react";
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
      </SidebarContent>
    </Sidebar>
  );
}
