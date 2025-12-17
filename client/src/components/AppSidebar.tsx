import { 
  LayoutDashboard, 
  Bell, 
  User, 
  Shield, 
  CreditCard, 
  Calendar, 
  History, 
  Settings, 
  Star, 
  MessageSquare, 
  BarChart3, 
  Send, 
  QrCode, 
  Megaphone, 
  Users, 
  Mail, 
  Workflow, 
  TrendingUp, 
  Database, 
  FileText, 
  Clock,
  Phone,
  PhoneMissed,
  Lightbulb,
  AlertTriangle,
  Target,
  Banknote,
  ChevronDown,
  Plug,
  CalendarClock
} from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

const piloterItems = [
  {
    title: "Aujourd'hui",
    url: "/dashboard",
    icon: LayoutDashboard,
    description: "Vue d'ensemble",
  },
  {
    title: "Activité",
    icon: Phone,
    children: [
      { title: "Appels", url: "/dashboard", icon: Phone },
      { title: "Liste d'attente", url: "/waitlist", icon: Clock },
    ],
  },
  {
    title: "Recommandations",
    url: "/dashboard#insights",
    icon: Lightbulb,
    description: "Insights IA",
  },
  {
    title: "Protection",
    icon: Shield,
    children: [
      { title: "Garantie CB", url: "/settings/guarantee", icon: CreditCard },
      { title: "Réservations", url: "/guarantee/reservations", icon: Calendar },
      { title: "No-shows", url: "/guarantee/history", icon: History },
    ],
  },
  {
    title: "Réputation",
    icon: Star,
    children: [
      { title: "Tous les avis", url: "/reviews", icon: MessageSquare },
      { title: "Campagnes", url: "/reviews/campaigns", icon: Send },
      { title: "Statistiques", url: "/reviews/stats", icon: BarChart3 },
      { title: "Configuration", url: "/reviews/settings", icon: Settings },
      { title: "Widgets", url: "/reviews/widgets", icon: QrCode },
    ],
  },
];

const developperItems = [
  {
    title: "Croissance",
    icon: TrendingUp,
    children: [
      { title: "Vue d'ensemble", url: "/marketing", icon: Megaphone },
      { title: "Audience", url: "/marketing/contacts", icon: Users },
      { title: "Campagnes", url: "/marketing/campaigns", icon: Mail },
      { title: "Automations", url: "/marketing/automations", icon: Workflow },
      { title: "Analytics", url: "/marketing/analytics", icon: TrendingUp },
    ],
  },
  {
    title: "Rapports",
    url: "/reports",
    icon: FileText,
    description: "Rapports mensuels",
  },
];

const systemeItems = [
  {
    title: "Intégrations",
    icon: Plug,
    children: [
      { title: "Vue d'ensemble", url: "/integrations", icon: Database },
      { title: "Clients sync", url: "/integrations/customers", icon: Users },
    ],
  },
  {
    title: "Préférences",
    icon: Settings,
    children: [
      { title: "Mon compte", url: "/account", icon: User },
      { title: "Notifications", url: "/notifications", icon: Bell, showBadge: true },
    ],
  },
];

function NavSection({ 
  title, 
  items, 
  location, 
  unreadCount,
  color = "text-muted-foreground"
}: { 
  title: string; 
  items: any[]; 
  location: string;
  unreadCount?: number;
  color?: string;
}) {
  const isChildActive = (children?: any[]) => {
    if (!children) return false;
    return children.some(child => location === child.url || location.startsWith(child.url + '/'));
  };

  // Initialize with active items open, but allow manual toggle
  const [openItems, setOpenItems] = useState<string[]>(() => {
    return items
      .filter(item => item.children && isChildActive(item.children))
      .map(item => item.title);
  });

  const toggleItem = (itemTitle: string) => {
    setOpenItems(prev => 
      prev.includes(itemTitle) 
        ? prev.filter(t => t !== itemTitle)
        : [...prev, itemTitle]
    );
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className={`text-xs font-semibold uppercase tracking-wider ${color}`}>
        {title}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            if (item.children) {
              const isOpen = openItems.includes(item.title);
              return (
                <Collapsible key={item.title} open={isOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton 
                        onClick={() => toggleItem(item.title)}
                        className={isChildActive(item.children) ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>
                  <CollapsibleContent>
                    <div className="ml-4 border-l border-border/40 pl-2 mt-1 space-y-1">
                      {item.children.map((child: any) => (
                        <SidebarMenuItem key={child.url}>
                          <SidebarMenuButton asChild isActive={location === child.url}>
                            <Link href={child.url} data-testid={`link-${child.title.toLowerCase().replace(/\s+/g, '-')}`}>
                              <child.icon className="h-3.5 w-3.5" />
                              <span className="text-sm">{child.title}</span>
                              {child.showBadge && unreadCount && unreadCount > 0 && (
                                <Badge 
                                  variant="destructive" 
                                  className="ml-auto h-5 min-w-5 px-1 flex items-center justify-center text-xs"
                                >
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={location === item.url}>
                  <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useUser();

  const { data: unreadCount } = useQuery<number>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000,
  });

  return (
    <Sidebar>
      <SidebarContent className="py-2">
        <NavSection 
          title="Piloter" 
          items={piloterItems} 
          location={location}
          unreadCount={unreadCount}
          color="text-[#C8B88A]"
        />
        
        <NavSection 
          title="Développer" 
          items={developperItems} 
          location={location}
          color="text-muted-foreground"
        />
        
        <NavSection 
          title="Système" 
          items={systemeItems} 
          location={location}
          unreadCount={unreadCount}
          color="text-muted-foreground/70"
        />

        {user?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin"}>
                    <Link href="/admin" data-testid="link-administration">
                      <Shield className="h-4 w-4" />
                      <span>Administration</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
