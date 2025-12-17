import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Bell, 
  User, 
  CreditCard,
  Star,
  Menu,
  X,
  Settings,
  Calendar,
  History,
  Send,
  QrCode,
  MessageSquare,
  BarChart3,
  Users,
  Mail,
  Workflow,
  TrendingUp,
  Database,
  Clock,
  FileText,
  Shield,
  Phone,
  Lightbulb,
  Plug,
  Megaphone,
  ChevronRight
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";

const bottomNavItems = [
  { title: "Accueil", url: "/dashboard", icon: LayoutDashboard },
  { title: "Notifs", url: "/notifications", icon: Bell, showBadge: true },
  { title: "Avis", url: "/reviews", icon: Star },
  { title: "Garantie", url: "/guarantee/reservations", icon: CreditCard },
];

const menuSections = [
  {
    title: "Piloter",
    color: "#C8B88A",
    items: [
      { title: "Aujourd'hui", url: "/dashboard", icon: LayoutDashboard, description: "Vue d'ensemble" },
      { title: "Liste d'attente", url: "/waitlist", icon: Clock },
      { title: "Recommandations", url: "/dashboard", icon: Lightbulb },
    ]
  },
  {
    title: "Protection",
    color: "#C8B88A",
    items: [
      { title: "Configuration", url: "/settings/guarantee", icon: Settings },
      { title: "Réservations", url: "/guarantee/reservations", icon: Calendar },
      { title: "No-shows", url: "/guarantee/history", icon: History },
    ]
  },
  {
    title: "Réputation",
    color: "#C8B88A",
    items: [
      { title: "Tous les avis", url: "/reviews", icon: MessageSquare },
      { title: "Campagnes", url: "/reviews/campaigns", icon: Send },
      { title: "Statistiques", url: "/reviews/stats", icon: BarChart3 },
      { title: "Configuration", url: "/reviews/settings", icon: Settings },
      { title: "Widgets", url: "/reviews/widgets", icon: QrCode },
    ]
  },
  {
    title: "Développer",
    items: [
      { title: "Croissance", url: "/marketing", icon: Megaphone },
      { title: "Audience", url: "/marketing/contacts", icon: Users },
      { title: "Campagnes", url: "/marketing/campaigns", icon: Mail },
      { title: "Automations", url: "/marketing/automations", icon: Workflow },
      { title: "Analytics", url: "/marketing/analytics", icon: TrendingUp },
      { title: "Rapports", url: "/reports", icon: FileText },
    ]
  },
  {
    title: "Système",
    items: [
      { title: "Intégrations", url: "/integrations", icon: Plug },
      { title: "Clients sync", url: "/integrations/customers", icon: Database },
      { title: "Mon compte", url: "/account", icon: User },
      { title: "Notifications", url: "/notifications", icon: Bell },
    ]
  },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useUser();

  const { data: unreadCount } = useQuery<number>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000,
  });

  const isActive = (url: string) => {
    if (url === "/reviews") {
      return location.startsWith("/reviews");
    }
    if (url === "/marketing") {
      return location.startsWith("/marketing");
    }
    return location === url;
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border safe-area-pb" data-testid="nav-mobile-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavItems.map((item) => {
            const active = isActive(item.url);
            return (
              <Link 
                key={item.url} 
                href={item.url}
                data-testid={`nav-${item.title.toLowerCase()}`}
              >
                <div className={`flex flex-col items-center justify-center min-w-[60px] py-1 px-2 rounded-lg transition-colors ${active ? 'text-[#C8B88A]' : 'text-muted-foreground'}`}>
                  <div className="relative">
                    <item.icon className={`w-5 h-5 ${active ? 'text-[#C8B88A]' : ''}`} />
                    {item.showBadge && unreadCount && unreadCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${active ? 'text-[#C8B88A]' : ''}`}>
                    {item.title}
                  </span>
                </div>
              </Link>
            );
          })}
          
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button 
                className="flex flex-col items-center justify-center min-w-[60px] py-1 px-2 rounded-lg text-muted-foreground"
                data-testid="button-mobile-menu"
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] mt-1 font-medium">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="text-left flex items-center gap-2">
                  <span className="text-[#C8B88A] font-bold">MEGIN</span>
                  <span className="text-xs text-muted-foreground">Copilote Business</span>
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-80px)]">
                <div className="p-4 space-y-5">
                  {menuSections.map((section, index) => (
                    <div key={section.title}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="mb-2">
                        <span 
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: section.color || 'var(--muted-foreground)' }}
                        >
                          {section.title}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {section.items.map((item) => {
                          const active = location === item.url;
                          return (
                            <Link 
                              key={item.url + item.title} 
                              href={item.url}
                              onClick={() => setMenuOpen(false)}
                            >
                              <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${active ? 'bg-[#C8B88A]/10 text-[#C8B88A]' : 'text-foreground hover:bg-muted/50'}`}>
                                <item.icon className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm">{item.title}</span>
                                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#C8B88A]/50" />}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                  {user?.role === "admin" && (
                    <>
                      <Separator />
                      <Link 
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                      >
                        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${location === '/admin' ? 'bg-[#C8B88A]/10 text-[#C8B88A]' : 'text-foreground hover:bg-muted/50'}`}>
                          <Shield className="w-4 h-4" />
                          <span className="text-sm font-medium">Administration</span>
                        </div>
                      </Link>
                    </>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      
      <div className="h-16" />
    </>
  );
}

export function MobileHeader({ title, showBackButton, onBack }: { 
  title?: string; 
  showBackButton?: boolean;
  onBack?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b px-4 py-3 flex items-center gap-3" data-testid="header-mobile">
      {showBackButton && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onBack}
          className="h-9 w-9"
        >
          <X className="w-5 h-5" />
        </Button>
      )}
      {title && (
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      )}
    </header>
  );
}
