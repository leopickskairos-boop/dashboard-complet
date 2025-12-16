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

  const { data: user } = useQuery<UserData>({
    queryKey: ['/api/auth/me'],
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      
      // CRITICAL FIX: Invalidate cached user data to prevent cross-user data leak
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
                    <span className="text-sm font-medium text-muted-foreground" data-testid="text-company-name">
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
