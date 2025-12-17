import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Bell, 
  User, 
  CreditCard,
  Star,
  Megaphone,
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
  Shield
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
    title: "Principal",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Rapports", url: "/reports", icon: FileText },
      { title: "Notifications", url: "/notifications", icon: Bell },
      { title: "Mon compte", url: "/account", icon: User },
    ]
  },
  {
    title: "Garantie CB",
    color: "#C8B88A",
    items: [
      { title: "Configuration", url: "/settings/guarantee", icon: Settings },
      { title: "Réservations", url: "/guarantee/reservations", icon: Calendar },
      { title: "Historique", url: "/guarantee/history", icon: History },
    ]
  },
  {
    title: "Avis & Réputation",
    color: "#C8B88A",
    items: [
      { title: "Configuration", url: "/reviews/settings", icon: Settings },
      { title: "Campagnes", url: "/reviews/campaigns", icon: Send },
      { title: "QR & Widgets", url: "/reviews/widgets", icon: QrCode },
      { title: "Tous les avis", url: "/reviews", icon: MessageSquare },
      { title: "Statistiques", url: "/reviews/stats", icon: BarChart3 },
    ]
  },
  {
    title: "Marketing",
    color: "#C8B88A",
    items: [
      { title: "Vue d'ensemble", url: "/marketing", icon: Megaphone },
      { title: "Audience", url: "/marketing/contacts", icon: Users },
      { title: "Campagnes", url: "/marketing/campaigns", icon: Mail },
      { title: "Templates", url: "/marketing/templates", icon: Send },
      { title: "Automations", url: "/marketing/automations", icon: Workflow },
      { title: "Analytics", url: "/marketing/analytics", icon: TrendingUp },
    ]
  },
  {
    title: "Intégrations",
    color: "#C8B88A",
    items: [
      { title: "Vue d'ensemble", url: "/integrations", icon: Database },
      { title: "Clients", url: "/integrations/customers", icon: Users },
    ]
  },
  {
    title: "Réservations",
    color: "#C8B88A",
    items: [
      { title: "Liste d'attente", url: "/waitlist", icon: Clock },
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
      {/* Bottom Navigation Bar */}
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
                <div className={`flex flex-col items-center justify-center min-w-[60px] py-1 px-2 rounded-lg transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className="relative">
                    <item.icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
                    {item.showBadge && unreadCount && unreadCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${active ? 'text-primary' : ''}`}>
                    {item.title}
                  </span>
                </div>
              </Link>
            );
          })}
          
          {/* Menu Button */}
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
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-80px)]">
                <div className="p-4 space-y-6">
                  {menuSections.map((section, index) => (
                    <div key={section.title}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="mb-3">
                        <span 
                          className="text-xs font-semibold uppercase tracking-wider"
                          style={{ color: section.color || 'inherit' }}
                        >
                          {section.title}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const active = location === item.url;
                          return (
                            <Link 
                              key={item.url} 
                              href={item.url}
                              onClick={() => setMenuOpen(false)}
                            >
                              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                                <item.icon className="w-4 h-4" />
                                <span className="text-sm font-medium">{item.title}</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                  {/* Admin link if applicable */}
                  {user?.role === "admin" && (
                    <>
                      <Separator />
                      <Link 
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                      >
                        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${location === '/admin' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
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
      
      {/* Spacer for bottom nav */}
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
