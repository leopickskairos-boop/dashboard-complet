import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";
import { Link } from "wouter";
import { differenceInDays } from "date-fns";

type User = {
  id: string;
  email: string;
  subscriptionStatus?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
};

export function SubscriptionExpirationBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  // Load dismissed state from sessionStorage
  useEffect(() => {
    if (user?.id) {
      const key = `subscription-banner-dismissed-${user.id}`;
      const isDismissed = sessionStorage.getItem(key) === 'true';
      setDismissed(isDismissed);
    }
  }, [user?.id]);

  // Handle dismiss with persistence
  const handleDismiss = () => {
    if (user?.id) {
      const key = `subscription-banner-dismissed-${user.id}`;
      sessionStorage.setItem(key, 'true');
      setDismissed(true);
    }
  };

  // Don't show if no user or no subscription data
  if (!user || !user.subscriptionCurrentPeriodEnd || !user.subscriptionStatus) {
    return null;
  }

  // Don't show if subscription is not active or past_due
  if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'past_due') {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  // Calculate days remaining
  const endDate = new Date(user.subscriptionCurrentPeriodEnd);
  const daysRemaining = differenceInDays(endDate, new Date());

  // Don't show if expired (handled by subscription-expired flow) or more than 5 days remaining
  if (daysRemaining <= 0 || daysRemaining > 5) {
    return null;
  }

  // Determine alert variant and message
  const isUrgent = daysRemaining <= 2;
  const variant = isUrgent ? "destructive" : "default";
  
  let message = "";
  if (daysRemaining === 1) {
    message = "Votre abonnement expire demain. Assurez-vous que votre méthode de paiement est à jour.";
  } else if (daysRemaining <= 2) {
    message = `Votre abonnement expire dans ${daysRemaining} jours. Assurez-vous que votre méthode de paiement est à jour.`;
  } else {
    message = `Votre abonnement expire dans ${daysRemaining} jours. Vérifiez votre méthode de paiement dans Mon compte.`;
  }

  return (
    <Alert 
      variant={variant} 
      className="rounded-none border-x-0 border-t-0"
      data-testid="banner-subscription-expiration"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between w-full">
        <span data-testid="text-expiration-message">{message}</span>
        <div className="flex items-center gap-2 ml-4">
          <Link href="/account">
            <Button 
              size="sm" 
              variant={isUrgent ? "outline" : "default"}
              data-testid="button-manage-subscription"
            >
              Gérer mon abonnement
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            data-testid="button-dismiss-banner"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
