import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function VerifyEmailSent() {
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  async function handleResend() {
    setIsResending(true);
    try {
      const response = await apiRequest("POST", "/api/auth/resend-verification", {});
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de l'envoi");
      }

      toast({
        title: "Email renvoyé",
        description: "Un nouvel email de vérification a été envoyé.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de renvoyer l'email",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-10 h-10 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Vérifiez votre email</CardTitle>
            <CardDescription className="mt-2">
              Nous avons envoyé un lien de vérification à votre adresse email
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="mb-2">Pour continuer, veuillez :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ouvrir votre boîte email</li>
              <li>Cliquer sur le lien de vérification</li>
              <li>Revenir ici pour vous connecter</li>
            </ol>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas reçu l'email ?
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={isResending}
              data-testid="button-resend"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                "Renvoyer l'email de vérification"
              )}
            </Button>
          </div>

          <div className="text-center pt-4 border-t">
            <Link href="/login">
              <a className="text-sm text-primary font-medium hover:underline" data-testid="link-login">
                Retour à la connexion
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
