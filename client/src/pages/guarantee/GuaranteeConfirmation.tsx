import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Check, Calendar, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function GuaranteeConfirmation() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get('session_id');
    
    if (sessionId) {
      fetch('/api/guarantee/webhook/checkout-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkout_session_id: sessionId }),
      }).catch(console.error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b0e] to-[#0d0f12] flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-[#0D0F12] border-white/10">
        <CardContent className="p-8 text-center">
          <div className="h-20 w-20 rounded-full bg-[#4CEFAD]/20 flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-[#4CEFAD]" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">
            Réservation confirmée
          </h1>
          
          <p className="text-gray-400 mb-6">
            Votre garantie carte bancaire a été validée avec succès. 
            Nous avons hâte de vous accueillir !
          </p>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
            <div className="flex items-center gap-3 text-gray-300">
              <Calendar className="h-5 w-5 text-[#C8B88A]" />
              <span className="text-sm">
                Un SMS de confirmation vous a été envoyé
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Vous pouvez fermer cette page en toute sécurité.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
