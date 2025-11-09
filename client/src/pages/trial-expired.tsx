import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Mail, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { PublicUser } from "@shared/schema";
import { Logo } from "@/components/Logo";
import { useLocation } from "wouter";

export default function TrialExpired() {
  const [, setLocation] = useLocation();
  
  const { data: user } = useQuery<PublicUser>({
    queryKey: ['/api/auth/me'],
  });

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setLocation('/login');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <Logo className="justify-center mb-2" />
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-8 w-8 text-destructive" data-testid="icon-alert" />
            </div>
          </div>
          <CardTitle className="text-2xl">Période d'essai expirée</CardTitle>
          <CardDescription className="text-base">
            Votre période d'essai gratuite de 30 jours est terminée.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1 flex-1">
                <h3 className="font-semibold text-sm">Vérifiez vos emails</h3>
                <p className="text-sm text-muted-foreground">
                  Vous avez reçu un lien de paiement à l'adresse <span className="font-medium text-foreground">{user?.email}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Une fois votre abonnement activé, vous retrouverez l'accès complet à votre dashboard.
            </p>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.reload()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Vérifier mon statut
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                Se déconnecter
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Vous n'avez pas reçu le lien ? Contactez notre support à{" "}
              <a 
                href="mailto:speedaivoiceai@gmail.com" 
                className="text-primary hover:underline"
                data-testid="link-support"
              >
                speedaivoiceai@gmail.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
