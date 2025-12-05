import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Shield, 
  CreditCard, 
  Calendar, 
  Users, 
  Clock,
  Check,
  AlertCircle,
  Phone,
  MapPin,
  Loader2,
  Lock,
  Info
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PublicSession {
  id: string;
  status: string;
  customerName: string;
  nbPersons: number;
  reservationDate: string;
  reservationTime: string | null;
  penaltyAmount: number;
  cancellationDelay: number;
  logoUrl: string | null;
  brandColor: string;
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
}

export default function GuaranteePage() {
  const [, params] = useRoute('/g/:sessionId');
  const sessionId = params?.sessionId;

  const { data: session, isLoading, error } = useQuery<PublicSession>({
    queryKey: ['/api/guarantee/public/session', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/guarantee/public/session/${sessionId}`);
      if (!response.ok) throw new Error('Session non trouvée');
      return response.json();
    },
    enabled: !!sessionId,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/guarantee/public/checkout/${sessionId}`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0b0e] to-[#0d0f12] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0b0e] to-[#0d0f12] flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-[#0D0F12] border-white/10">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Session introuvable</h1>
            <p className="text-gray-400">
              Ce lien n'est plus valide ou la réservation a été annulée.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.status !== 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0b0e] to-[#0d0f12] flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-[#0D0F12] border-white/10">
          <CardContent className="p-8 text-center">
            <Check className="h-16 w-16 text-[#4CEFAD] mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Réservation confirmée</h1>
            <p className="text-gray-400">
              Votre garantie carte bancaire a déjà été validée.
            </p>
            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 text-white">
                <Calendar className="h-5 w-5 text-[#C8B88A]" />
                <span>
                  {format(new Date(session.reservationDate), 'EEEE d MMMM yyyy', { locale: fr })}
                </span>
              </div>
              {session.reservationTime && (
                <div className="flex items-center gap-3 text-white mt-2">
                  <Clock className="h-5 w-5 text-[#C8B88A]" />
                  <span>{session.reservationTime}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const brandColor = session.brandColor || '#C8B88A';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b0e] to-[#0d0f12] flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-lg bg-[#0D0F12] border-white/10 overflow-hidden">
        {session.logoUrl && (
          <div className="p-6 pb-0 flex justify-center">
            <img 
              src={session.logoUrl} 
              alt={session.companyName || 'Logo'} 
              className="h-16 object-contain"
            />
          </div>
        )}
        
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">
              {session.companyName || 'Confirmation de réservation'}
            </h1>
            <p className="text-gray-400">
              Confirmez votre réservation en validant votre carte bancaire
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex items-center gap-4">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${brandColor}20` }}
              >
                <Calendar 
                  className="h-6 w-6" 
                  style={{ color: brandColor }}
                />
              </div>
              <div>
                <p className="text-sm text-gray-400">Date</p>
                <p className="text-white font-medium">
                  {format(new Date(session.reservationDate), 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>

            {session.reservationTime && (
              <div className="flex items-center gap-4">
                <div 
                  className="h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}20` }}
                >
                  <Clock 
                    className="h-6 w-6" 
                    style={{ color: brandColor }}
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Heure</p>
                  <p className="text-white font-medium">{session.reservationTime}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${brandColor}20` }}
              >
                <Users 
                  className="h-6 w-6" 
                  style={{ color: brandColor }}
                />
              </div>
              <div>
                <p className="text-sm text-gray-400">Nombre de personnes</p>
                <p className="text-white font-medium">{session.nbPersons} personne{session.nbPersons > 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#C8B88A]/10 border border-[#C8B88A]/20">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-[#C8B88A] flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-[#C8B88A] font-medium mb-1">Garantie carte bancaire</p>
                <p className="text-gray-400">
                  En validant votre carte, vous acceptez les conditions suivantes :
                </p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• Votre carte ne sera pas débitée</li>
                  <li>• Annulation gratuite jusqu'à {session.cancellationDelay}h avant</li>
                  <li>• En cas de no-show : pénalité de {session.penaltyAmount}€/pers.</li>
                  <li>• Montant maximum : {session.penaltyAmount * session.nbPersons}€</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
            className="w-full h-12 text-base font-semibold"
            style={{ 
              backgroundColor: brandColor,
              color: '#000'
            }}
            data-testid="button-confirm-card"
          >
            {checkoutMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-5 w-5 mr-2" />
                Valider ma carte bancaire
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <Lock className="h-3.5 w-3.5" />
            Paiement sécurisé par Stripe
          </div>

          {(session.companyAddress || session.companyPhone) && (
            <div className="pt-4 border-t border-white/5 space-y-2 text-sm text-gray-400">
              {session.companyAddress && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {session.companyAddress}
                </div>
              )}
              {session.companyPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {session.companyPhone}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
