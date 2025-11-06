import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { AlertTriangle } from "lucide-react";

export default function SubscriptionExpired() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Abonnement expiré</CardTitle>
            <CardDescription className="mt-2">
              Votre abonnement a expiré ou a été annulé
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="mb-4">
              Pour continuer à utiliser SpeedAI et accéder à votre dashboard, 
              vous devez renouveler votre abonnement.
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Vos données sont conservées en sécurité</li>
              <li>• Réactivez votre compte à tout moment</li>
              <li>• Aucune perte d'historique</li>
            </ul>
          </div>

          <div className="space-y-4">
            <Link href="/subscribe">
              <Button className="w-full h-12" data-testid="button-renew">
                Renouveler mon abonnement
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = 'mailto:support@speedai.com'}
              data-testid="button-contact"
            >
              Contacter le support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
