import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Check, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscribeForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/payment-success',
      },
    });

    if (error) {
      toast({
        title: "Paiement échoué",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <Logo className="justify-center mb-6" />
          <h1 className="text-3xl font-bold mb-2">Activez votre abonnement</h1>
          <p className="text-muted-foreground">
            Dernière étape avant d'accéder à votre dashboard
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Pricing Card */}
          <Card className="rounded-2xl border-2 border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Plan Professionnel</CardTitle>
              <div className="flex items-baseline justify-center gap-2 mt-4">
                <span className="text-5xl font-bold">800€</span>
                <span className="text-lg text-muted-foreground">/mois</span>
              </div>
              <CardDescription className="mt-2">
                Annulable à tout moment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {[
                  "Appels illimités 24/7",
                  "Dashboard complet avec analytics",
                  "Résumés IA de tous les appels",
                  "Support technique prioritaire",
                  "Intégrations téléphoniques",
                  "Données sécurisées RGPD"
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de paiement</CardTitle>
              <CardDescription>
                Paiement sécurisé par Stripe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <PaymentElement />
                <Button
                  type="submit"
                  className="w-full h-12"
                  disabled={!stripe || isProcessing}
                  data-testid="button-subscribe"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    "S'abonner maintenant"
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  En vous abonnant, vous acceptez nos conditions d'utilisation et notre politique de remboursement.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSubscription() {
      try {
        const response = await apiRequest("POST", "/api/subscription/create", {});
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Erreur lors de la création de l'abonnement");
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de charger le formulaire de paiement",
          variant: "destructive",
        });
      }
    }

    fetchSubscription();
  }, [toast]);

  if (!clientSecret) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <SubscribeForm />
    </Elements>
  );
}
