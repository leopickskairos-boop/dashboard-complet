import { useState, useEffect } from 'react';
import { Bell, BellOff, Send, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import usePushNotifications from '@/hooks/usePushNotifications';
import { apiRequest } from '@/lib/queryClient';

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
      </CardContent>
    </Card>
  );
}

export default NotificationSettings;
