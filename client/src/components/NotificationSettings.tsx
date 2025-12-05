import { useState, useEffect } from 'react';
import { Bell, BellOff, Send, CheckCircle, AlertTriangle, Loader2, Smartphone, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import usePushNotifications from '@/hooks/usePushNotifications';
import { apiRequest } from '@/lib/queryClient';
import { SiApple, SiAndroid } from 'react-icons/si';

export function NotificationSettings() {
  const { toast } = useToast();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showMobileGuide, setShowMobileGuide] = useState(false);

  const handleTogglePush = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast({
          title: "Notifications désactivées",
          description: "Vous ne recevrez plus de notifications push.",
        });
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast({
          title: "Notifications activées",
          description: "Vous recevrez maintenant les notifications push SpeedAI.",
        });
      } else if (error) {
        toast({
          title: "Erreur",
          description: error,
          variant: "destructive",
        });
      }
    }
  };

  const handleSendTest = async () => {
    if (!isSubscribed) {
      toast({
        title: "Activez les notifications",
        description: "Veuillez d'abord activer les notifications push",
        variant: "destructive",
      });
      return;
    }
    
    setIsSendingTest(true);
    try {
      const response = await apiRequest('POST', '/api/push/test');
      
      if (response.status === 401) {
        toast({
          title: "Session expirée",
          description: "Veuillez vous reconnecter",
          variant: "destructive",
        });
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Notification envoyée",
          description: "Vérifiez vos notifications !",
        });
      } else {
        toast({
          title: "Information",
          description: data.message || "Aucune notification envoyée",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la notification de test",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (!isSupported) {
    return (
      <Card className="bg-gradient-to-b from-[#0D0F12] to-[#090A0D] border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BellOff className="h-5 w-5 text-gray-500" />
            Notifications Push
          </CardTitle>
          <CardDescription className="text-gray-400">
            Votre navigateur ne supporte pas les notifications push.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-b from-[#0D0F12] to-[#090A0D] border-white/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-white">
          <Bell className="h-5 w-5 text-[#C8B88A]" />
          Notifications Push
        </CardTitle>
        <CardDescription className="text-gray-400">
          Recevez des alertes en temps réel sur vos appels et performances.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <div className="h-10 w-10 rounded-full bg-[#4CEFAD]/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-[#4CEFAD]" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-500/10 flex items-center justify-center">
                <BellOff className="h-5 w-5 text-gray-500" />
              </div>
            )}
            <div>
              <Label className="text-white font-medium">
                {isSubscribed ? 'Notifications activées' : 'Notifications désactivées'}
              </Label>
              <p className="text-sm text-gray-400">
                {isSubscribed 
                  ? 'Vous recevez les alertes SpeedAI' 
                  : 'Activez pour recevoir les alertes'}
              </p>
            </div>
          </div>
          <Switch
            checked={isSubscribed}
            onCheckedChange={handleTogglePush}
            disabled={isLoading || permission === 'denied'}
            data-testid="switch-push-notifications"
          />
        </div>

        {permission === 'denied' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">Permission refusée</p>
              <p className="text-xs text-red-400/80 mt-1">
                Les notifications sont bloquées par votre navigateur. 
                Modifiez les paramètres de votre navigateur pour autoriser les notifications.
              </p>
            </div>
          </div>
        )}

        {isSubscribed && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendTest}
              disabled={isSendingTest}
              className="border-[#C8B88A]/30 text-[#C8B88A] hover:bg-[#C8B88A]/10"
              data-testid="button-test-notification"
            >
              {isSendingTest ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer une notification test
                </>
              )}
            </Button>
          </div>
        )}

        <div className="border-t border-white/5 pt-4 space-y-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            Types de notifications
          </p>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="h-2 w-2 rounded-full bg-[#4CEFAD]" />
              Bilans quotidiens (résumé de vos appels)
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="h-2 w-2 rounded-full bg-[#C8B88A]" />
              Alertes importantes (baisse de performance)
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              Victoires (objectifs atteints, records)
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="h-2 w-2 rounded-full bg-purple-400" />
              Programme d'affiliation (rappels, gains)
            </div>
          </div>
        </div>

        {/* Mobile Installation Guide */}
        <div className="border-t border-white/5 pt-4">
          <button
            onClick={() => setShowMobileGuide(!showMobileGuide)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
            data-testid="button-toggle-mobile-guide"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#C8B88A]/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-[#C8B88A]" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Notifications sur mobile</p>
                <p className="text-xs text-gray-400">iPhone et Android</p>
              </div>
            </div>
            {showMobileGuide ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {showMobileGuide && (
            <div className="mt-4 space-y-4">
              {/* iPhone Guide */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <SiApple className="h-5 w-5 text-white" />
                  <h4 className="text-white font-medium">iPhone (iOS 16.4+)</h4>
                </div>
                <ol className="space-y-2 text-sm text-gray-400">
                  <li className="flex gap-2">
                    <span className="text-[#C8B88A] font-semibold">1.</span>
                    <span>Ouvrez <strong className="text-white">Safari</strong> (obligatoire)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#C8B88A] font-semibold">2.</span>
                    <span>Allez sur <strong className="text-white">speedai.fr</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#C8B88A] font-semibold">3.</span>
                    <span>Appuyez sur le bouton <strong className="text-white">Partager</strong> (⬆️)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#C8B88A] font-semibold">4.</span>
                    <span>Sélectionnez <strong className="text-white">"Sur l'écran d'accueil"</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#C8B88A] font-semibold">5.</span>
                    <span>Ouvrez l'app et activez les notifications</span>
                  </li>
                </ol>
                <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Requiert iOS 16.4 ou plus récent
                </p>
              </div>

              {/* Android Guide */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <SiAndroid className="h-5 w-5 text-[#4CEFAD]" />
                  <h4 className="text-white font-medium">Android</h4>
                </div>
                <ol className="space-y-2 text-sm text-gray-400">
                  <li className="flex gap-2">
                    <span className="text-[#4CEFAD] font-semibold">1.</span>
                    <span>Ouvrez <strong className="text-white">Chrome</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#4CEFAD] font-semibold">2.</span>
                    <span>Allez sur <strong className="text-white">speedai.fr</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#4CEFAD] font-semibold">3.</span>
                    <span>Appuyez sur le menu <strong className="text-white">(⋮)</strong> en haut à droite</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#4CEFAD] font-semibold">4.</span>
                    <span>Sélectionnez <strong className="text-white">"Ajouter à l'écran d'accueil"</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#4CEFAD] font-semibold">5.</span>
                    <span>Ouvrez l'app et activez les notifications</span>
                  </li>
                </ol>
              </div>

              {/* Info box */}
              <div className="p-3 rounded-xl bg-[#C8B88A]/10 border border-[#C8B88A]/20">
                <p className="text-sm text-[#C8B88A]">
                  Une fois installée, vous recevrez les notifications même avec le téléphone verrouillé, comme pour WhatsApp ou les SMS.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationSettings;
