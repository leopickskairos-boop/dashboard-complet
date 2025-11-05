import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Paiement réussi !</CardTitle>
            <CardDescription className="mt-2">
              Votre abonnement est maintenant actif
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="text-center text-muted-foreground">
              Bienvenue dans VoiceAI ! Vous avez maintenant accès à toutes les fonctionnalités.
            </p>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Redirection vers votre dashboard dans {countdown}s...
            </p>
            <Button
              className="w-full"
              onClick={() => setLocation('/dashboard')}
              data-testid="button-dashboard"
            >
              Accéder au dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
