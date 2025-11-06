import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { PublicUser } from "@shared/schema";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireVerified?: boolean;
  requireSubscription?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireVerified = false, 
  requireSubscription = false 
}: ProtectedRouteProps) {
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useQuery<PublicUser>({
    queryKey: ['/api/auth/me'],
  });

  useEffect(() => {
    if (isLoading) return;

    if (error || !user) {
      setLocation('/login');
      return;
    }

    // Admins bypass all verification and subscription checks
    if (user.role === 'admin') {
      return;
    }

    if (requireVerified && !user.isVerified) {
      setLocation('/verify-email-sent');
      return;
    }

    if (requireSubscription) {
      if (!user.subscriptionStatus || user.subscriptionStatus !== 'active') {
        // Check if subscription expired
        if (user.subscriptionCurrentPeriodEnd) {
          const expiryDate = new Date(user.subscriptionCurrentPeriodEnd);
          const now = new Date();
          if (now > expiryDate) {
            setLocation('/subscription-expired');
            return;
          }
        }
        setLocation('/subscribe');
        return;
      }
    }
  }, [user, isLoading, error, requireVerified, requireSubscription, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return null;
  }

  return <>{children}</>;
}
