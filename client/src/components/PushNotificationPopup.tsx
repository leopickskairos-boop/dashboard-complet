import { useState, useEffect } from 'react';
import { Bell, X, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import usePushNotifications from '@/hooks/usePushNotifications';

interface PushNotificationPopupProps {
  onClose: () => void;
  show: boolean;
}

export function PushNotificationPopup({ onClose, show }: PushNotificationPopupProps) {
  const { toast } = useToast();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
  } = usePushNotifications();

  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsAnimating(true);
    }
  }, [show]);

  if (!show || !isSupported || isSubscribed || permission === 'denied') {
    return null;
  }

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      toast({
        title: "Notifications activées !",
        description: "Vous recevrez maintenant les alertes SpeedAI en temps réel.",
      });
      onClose();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('speedai_push_dismissed', Date.now().toString());
    onClose();
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      data-testid="popup-push-notification"
    >
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleDismiss}
      />
      
      <div 
        className={`relative w-full max-w-md transform transition-all duration-500 ${
          isAnimating ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0F1114] to-[#090A0D] border border-white/10 shadow-2xl">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
            data-testid="button-close-push-popup"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#C8B88A]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-gradient-to-br from-[#C8B88A] to-[#A69866] shadow-lg shadow-[#C8B88A]/20">
              <Bell className="h-8 w-8 text-[#0A0B0E]" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">
              Restez informé en temps réel
            </h2>
            
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              Activez les notifications push pour ne jamais manquer une opportunité business.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left">
                <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-[#4CEFAD]/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-[#4CEFAD]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Bilans quotidiens</p>
                  <p className="text-xs text-gray-500">Résumé de vos performances chaque jour</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left">
                <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-[#C8B88A]/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-[#C8B88A]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Alertes intelligentes</p>
                  <p className="text-xs text-gray-500">Soyez averti des opportunités à saisir</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left">
                <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Mode silencieux</p>
                  <p className="text-xs text-gray-500">Aucune notification de 22h à 8h</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleEnable}
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-[#C8B88A] to-[#A69866] hover:from-[#D4C69A] hover:to-[#B5A673] text-[#0A0B0E] font-semibold rounded-xl shadow-lg shadow-[#C8B88A]/20"
                data-testid="button-enable-push"
              >
                {isLoading ? 'Activation...' : 'Activer les notifications'}
              </Button>
              
              <button
                onClick={handleDismiss}
                className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
                data-testid="button-later-push"
              >
                Peut-être plus tard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function usePushNotificationPrompt() {
  const [showPopup, setShowPopup] = useState(false);
  const { isSupported, isSubscribed, permission } = usePushNotifications();
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID from the session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setUserId(data.id);
        }
      } catch (e) {
        // Ignore errors
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    // Don't show if not supported, already subscribed, or permission denied
    if (!isSupported || isSubscribed || permission === 'denied' || !userId) {
      return;
    }

    // Use user-specific dismissal key
    const dismissalKey = `speedai_push_dismissed_${userId}`;
    const dismissed = localStorage.getItem(dismissalKey);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      // Don't show again for 7 days after dismissal
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Delay showing the popup by 5 seconds
    const timer = setTimeout(() => {
      // Re-check subscription state before showing
      if (!isSubscribed && permission !== 'denied') {
        setShowPopup(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, permission, userId]);

  // Close popup and save dismissal with user ID
  const closePopup = () => {
    setShowPopup(false);
    if (userId) {
      localStorage.setItem(`speedai_push_dismissed_${userId}`, Date.now().toString());
    }
  };

  return {
    showPopup,
    closePopup,
  };
}

export default PushNotificationPopup;
