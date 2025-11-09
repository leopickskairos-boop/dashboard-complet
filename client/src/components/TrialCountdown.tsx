import { Card, CardContent } from "@/components/ui/card";
import { Clock, Sparkles } from "lucide-react";
import type { PublicUser } from "@shared/schema";

interface TrialCountdownProps {
  user: PublicUser;
}

export function TrialCountdown({ user }: TrialCountdownProps) {
  // Only show for users in trial period
  if (user.accountStatus !== 'trial' || !user.countdownEnd) {
    return null;
  }

  const now = new Date();
  const endDate = new Date(user.countdownEnd);
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Don't show if trial has expired
  if (daysLeft <= 0) {
    return null;
  }

  // Determine urgency level
  const isUrgent = daysLeft <= 7;
  const isWarning = daysLeft <= 14;

  return (
    <Card 
      className={`border-2 ${
        isUrgent 
          ? 'border-destructive/50 bg-destructive/5' 
          : isWarning 
          ? 'border-orange-500/50 bg-orange-500/5'
          : 'border-primary/50 bg-primary/5'
      }`}
      data-testid="card-trial-countdown"
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`rounded-full p-2.5 ${
            isUrgent 
              ? 'bg-destructive/10' 
              : isWarning 
              ? 'bg-orange-500/10'
              : 'bg-primary/10'
          }`}>
            {isUrgent || isWarning ? (
              <Clock className={`h-5 w-5 ${
                isUrgent ? 'text-destructive' : 'text-orange-500'
              }`} data-testid="icon-clock" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary" data-testid="icon-sparkles" />
            )}
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-0.5">
              {isUrgent 
                ? '⚠️ Période d\'essai bientôt terminée' 
                : isWarning
                ? 'Période d\'essai en cours'
                : '🎉 Essai gratuit activé'}
            </h3>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium" data-testid="text-days-left">
                {daysLeft} jour{daysLeft > 1 ? 's' : ''}
              </span>
              {' '}restant{daysLeft > 1 ? 's' : ''} • Expire le{' '}
              <span className="font-medium">
                {endDate.toLocaleDateString('fr-FR', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </span>
            </p>
          </div>
        </div>

        {user.plan && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Plan assigné :</span>{' '}
              {user.plan === 'basic' && 'Basic (400€/mois)'}
              {user.plan === 'standard' && 'Standard (800€/mois)'}
              {user.plan === 'premium' && 'Premium (1000€/mois)'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
