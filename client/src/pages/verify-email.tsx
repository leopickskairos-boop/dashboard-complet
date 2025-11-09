import { useEffect, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Lien de vérification invalide');
      return;
    }

    // Prevent multiple calls (React StrictMode or double-click)
    if (hasRequestedRef.current) {
      return;
    }
    hasRequestedRef.current = true;

    verifyEmail(token);
  }, [search]);

  async function verifyEmail(token: string) {
    try {
      const response = await apiRequest("POST", "/api/auth/verify-email", { token });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la vérification");
      }

      setStatus('success');
      setMessage('Votre email a été vérifié avec succès !');
      
      // Redirect to login page after 2 seconds so user can authenticate
      setTimeout(() => {
        setLocation('/login');
      }, 2000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'La vérification a échoué');
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
            {status === 'loading' && (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
            )}
            {status === 'error' && (
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {status === 'loading' && 'Vérification en cours...'}
              {status === 'success' && 'Email vérifié !'}
              {status === 'error' && 'Erreur de vérification'}
            </CardTitle>
            <CardDescription className="mt-2">
              {message}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {status === 'success' && (
            <div className="text-center text-sm text-muted-foreground">
              Redirection vers la page de connexion...
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <Button
                className="w-full"
                onClick={() => setLocation('/signup')}
                data-testid="button-back-signup"
              >
                Retour à l'inscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
