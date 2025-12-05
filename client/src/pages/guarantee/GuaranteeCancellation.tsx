import { X, ArrowLeft, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function GuaranteeCancellation() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b0e] to-[#0d0f12] flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-[#0D0F12] border-white/10">
        <CardContent className="p-8 text-center">
          <div className="h-20 w-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <X className="h-10 w-10 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">
            Validation annulée
          </h1>
          
          <p className="text-gray-400 mb-6">
            Vous avez annulé la validation de votre carte bancaire. 
            Sans cette garantie, votre réservation ne pourra pas être confirmée.
          </p>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
            <div className="flex items-center gap-3 text-gray-300">
              <Phone className="h-5 w-5 text-[#C8B88A]" />
              <span className="text-sm">
                Contactez l'établissement si vous avez des questions
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="border-white/20 text-white"
            data-testid="button-go-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Revenir à la page précédente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
