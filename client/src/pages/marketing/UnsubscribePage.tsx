import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { Mail, MessageSquare, CheckCircle, AlertTriangle, Shield } from "lucide-react";

export default function UnsubscribePage() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [unsubEmail, setUnsubEmail] = useState(true);
  const [unsubSms, setUnsubSms] = useState(true);

  const { data, isLoading, error } = useQuery<{
    email: string | null;
    phone: string | null;
    optInEmail: boolean;
    optInSms: boolean;
    channel: string;
  }>({
    queryKey: ['/api/marketing/unsubscribe', trackingId],
    enabled: !!trackingId,
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      let channel = 'both';
      if (unsubEmail && !unsubSms) channel = 'email';
      if (!unsubEmail && unsubSms) channel = 'sms';

      return apiRequest('POST', `/api/marketing/unsubscribe/${trackingId}`, { channel });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <Skeleton className="h-8 w-3/4 mx-auto mb-4" />
            <Skeleton className="h-4 w-1/2 mx-auto mb-6" />
            <Skeleton className="h-12 w-full mb-3" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-orange-400" />
            <h1 className="text-xl font-bold mb-2">Lien invalide</h1>
            <p className="text-muted-foreground">
              Ce lien de désinscription est invalide ou a expiré.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (unsubscribeMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-[#4CEFAD]" />
            <h1 className="text-xl font-bold mb-2">Désinscription confirmée</h1>
            <p className="text-muted-foreground mb-6">
              Vous avez été désinscrit avec succès. Vous ne recevrez plus de communications marketing.
            </p>
            <div className="p-4 bg-muted/50 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-[#C8B88A]">
                <Shield className="h-4 w-4" />
                <span>Conformité RGPD</span>
              </div>
              <p className="text-muted-foreground mt-2 text-left">
                Votre demande a été enregistrée conformément au Règlement Général sur la Protection des Données.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#C8B88A]/10 flex items-center justify-center">
            <Mail className="h-8 w-8 text-[#C8B88A]" />
          </div>
          <CardTitle>Gérer vos préférences</CardTitle>
          <CardDescription>
            Choisissez les types de communication que vous souhaitez ne plus recevoir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.email && (
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <Checkbox
                id="unsub-email"
                checked={unsubEmail}
                onCheckedChange={(checked) => setUnsubEmail(checked as boolean)}
                data-testid="checkbox-unsub-email"
              />
              <div className="flex-1">
                <Label htmlFor="unsub-email" className="cursor-pointer font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-400" />
                  Se désinscrire des emails
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Adresse : {data.email}
                </p>
              </div>
            </div>
          )}

          {data.phone && (
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <Checkbox
                id="unsub-sms"
                checked={unsubSms}
                onCheckedChange={(checked) => setUnsubSms(checked as boolean)}
                data-testid="checkbox-unsub-sms"
              />
              <div className="flex-1">
                <Label htmlFor="unsub-sms" className="cursor-pointer font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-400" />
                  Se désinscrire des SMS
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Téléphone : {data.phone}
                </p>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => unsubscribeMutation.mutate()}
            disabled={unsubscribeMutation.isPending || (!unsubEmail && !unsubSms)}
            data-testid="button-confirm-unsub"
          >
            {unsubscribeMutation.isPending ? 'Traitement...' : 'Confirmer la désinscription'}
          </Button>

          {unsubscribeMutation.isError && (
            <div className="p-3 bg-red-500/10 text-red-400 rounded-lg text-sm text-center">
              Une erreur est survenue. Veuillez réessayer.
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 mt-0.5 text-[#C8B88A]" />
              <p>
                Conformément au RGPD, vous pouvez exercer votre droit de retrait de consentement à tout moment. 
                Votre demande sera traitée sous 24h maximum.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
