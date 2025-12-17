import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SubscriptionExpirationBanner } from "@/components/SubscriptionExpirationBanner";
import { PushNotificationPopup, usePushNotificationPrompt } from "@/components/PushNotificationPopup";
import { MobileBottomNav } from "@/components/MobileNavigation";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type UserData = {
  companyName?: string | null;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { showPopup, closePopup } = usePushNotificationPrompt();
  const isMobile = useIsMobile();

  const { data: user } = useQuery<UserData>({
    queryKey: ['/api/auth/me'],
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.removeQueries({ queryKey: ['/api/auth/me'] });
      setLocation("/login");
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de se déconnecter",
        variant: "destructive",
      });
    }
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-background">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur-lg" data-testid="header-mobile">
          <Link href="/dashboard" data-testid="link-logo-mobile">
            <Logo />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            data-testid="button-logout-mobile"
            title="Déconnexion"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </header>
        
        <SubscriptionExpirationBanner />
        
        {/* Main Content with padding for bottom nav */}
        <main className="flex-1 overflow-auto pb-20">
          {children}
        </main>
        
        {/* Bottom Navigation */}
        <MobileBottomNav />
        
        <PushNotificationPopup show={showPopup} onClose={closePopup} />
      </div>
    );
  }

  // Desktop Layout
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-background">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Link href="/dashboard" data-testid="link-logo">
                <div className="cursor-pointer hover-elevate rounded-lg transition-colors flex items-center gap-2">
                  <Logo />
                  {user?.companyName && (
                    <span className="text-sm font-medium text-muted-foreground hidden lg:inline" data-testid="text-company-name">
                      × {user.companyName}
                    </span>
                  )}
                </div>
              </Link>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
              title="Déconnexion"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </header>
          <SubscriptionExpirationBanner />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <PushNotificationPopup show={showPopup} onClose={closePopup} />
    </SidebarProvider>
  );
}
