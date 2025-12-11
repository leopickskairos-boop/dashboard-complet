import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  Shield, 
  CreditCard, 
  Clock, 
  Users, 
  Palette, 
  Mail, 
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  ExternalLink,
  Building2,
  Phone,
  MapPin,
  Eye,
  AlertTriangle,
  MessageSquare,
  Bell,
  Key
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface GuaranteeConfig {
  enabled: boolean;
  penaltyAmount: number;
  cancellationDelay: number;
  applyTo: 'all' | 'min_persons' | 'weekend';
  minPersons: number;
  logoUrl: string | null;
  brandColor: string;
  senderEmail: string | null;
  gmailSenderEmail: string | null;
  gmailSenderName: string | null;
  gmailAppPassword: string | null;
  termsUrl: string | null;
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  stripeAccountId?: string | null;
  smsEnabled: boolean;
  autoSendEmailOnCreate: boolean;
  autoSendSmsOnCreate: boolean;
  autoSendEmailOnValidation: boolean;
  autoSendSmsOnValidation: boolean;
}

interface ConfigResponse {
  config: GuaranteeConfig;
  stripeConnected: boolean;
  user: {
    email: string;
  };
}

interface StripeStatus {
  connected: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

type SectionKey = 'stripe' | 'penalty' | 'delay' | 'conditions' | 'branding' | 'company' | 'email' | 'sms' | 'notifications' | null;

export default function GuaranteeSettings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [expandedSection, setExpandedSection] = useState<SectionKey>(null);
  const [localConfig, setLocalConfig] = useState<GuaranteeConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);

  // Handle OAuth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stripeConnected = urlParams.get('stripe_connected');
    const stripeError = urlParams.get('stripe_error');
    const stripeRefresh = urlParams.get('stripe_refresh');
    
    if (stripeConnected === 'true') {
      toast({
        title: "Stripe connecté !",
        description: "Votre compte Stripe a été connecté avec succès.",
      });
      // Clean URL
      window.history.replaceState({}, '', '/settings/guarantee');
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/guarantee/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantee/stripe-status'] });
    } else if (stripeError) {
      toast({
        title: "Erreur Stripe",
        description: decodeURIComponent(stripeError),
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/settings/guarantee');
    } else if (stripeRefresh === 'true') {
      toast({
        title: "Session expirée",
        description: "Veuillez reconnecter votre compte Stripe.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/settings/guarantee');
      setExpandedSection('stripe');
    }
  }, [toast]);

  const { data, isLoading, refetch } = useQuery<ConfigResponse>({
    queryKey: ['/api/guarantee/config'],
  });

  const { data: stripeStatus } = useQuery<StripeStatus>({
    queryKey: ['/api/guarantee/stripe-status'],
    enabled: !!data?.stripeConnected,
  });

  useEffect(() => {
    if (data?.config) {
      setLocalConfig(data.config);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<GuaranteeConfig>) => {
      const response = await apiRequest('PUT', '/api/guarantee/config', updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantee/config'] });
      setHasChanges(false);
      toast({
        title: "Configuration sauvegardée",
        description: "Vos paramètres ont été mis à jour.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration.",
        variant: "destructive",
      });
    },
  });

  const connectStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/guarantee/connect-stripe');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Erreur de connexion');
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.already_connected) {
        toast({
          title: "Déjà connecté",
          description: "Votre compte Stripe est déjà connecté.",
        });
        refetch();
      } else if (data.url) {
        // Open Stripe onboarding in a new tab (required due to Stripe frame restrictions)
        toast({
          title: "Redirection vers Stripe",
          description: "Une nouvelle fenêtre va s'ouvrir. Complétez le formulaire puis revenez ici.",
        });
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    },
    onError: (error: any) => {
      const message = error?.message || "Impossible de connecter Stripe.";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    },
  });

  const disconnectStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/guarantee/disconnect-stripe');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantee/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guarantee/stripe-status'] });
      toast({
        title: "Stripe déconnecté",
        description: "Votre compte Stripe a été déconnecté.",
      });
    },
  });

  const handleToggleEnabled = () => {
    if (!localConfig) return;
    
    if (!data?.stripeConnected && !localConfig.enabled) {
      toast({
        title: "Stripe requis",
        description: "Connectez d'abord votre compte Stripe pour activer la garantie CB.",
        variant: "destructive",
      });
      setExpandedSection('stripe');
      return;
    }
    
    const newEnabled = !localConfig.enabled;
    setLocalConfig({ ...localConfig, enabled: newEnabled });
    updateMutation.mutate({ enabled: newEnabled });
  };

  const handleConfigChange = (key: keyof GuaranteeConfig, value: any) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, [key]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!localConfig) return;
    updateMutation.mutate(localConfig);
  };

  const toggleSection = (section: SectionKey) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (isLoading || !localConfig) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  const sections = [
    {
      key: 'stripe' as SectionKey,
      icon: CreditCard,
      iconColor: 'text-blue-400',
      title: 'Compte Stripe',
      description: data?.stripeConnected 
        ? (stripeStatus?.chargesEnabled ? 'Connecté et opérationnel' : 'En cours de configuration')
        : 'Non connecté',
      content: (
        <div className="space-y-4">
          {data?.stripeConnected ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#4CEFAD]/10 border border-[#4CEFAD]/20">
                <Check className="h-5 w-5 text-[#4CEFAD]" />
                <div>
                  <p className="text-sm font-medium text-white">Compte connecté</p>
                  <p className="text-xs text-gray-400">
                    {stripeStatus?.chargesEnabled 
                      ? 'Les paiements sont activés'
                      : 'Complétez la configuration Stripe'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => connectStripeMutation.mutate()}
                  disabled={connectStripeMutation.isPending}
                  className="border-[#C8B88A]/30 text-[#C8B88A]"
                  data-testid="button-stripe-dashboard"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Dashboard Stripe
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectStripeMutation.mutate()}
                  disabled={disconnectStripeMutation.isPending}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  data-testid="button-disconnect-stripe"
                >
                  Déconnecter
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400">
                Connectez votre compte Stripe pour recevoir les pénalités no-show directement sur votre compte.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => connectStripeMutation.mutate()}
                  disabled={connectStripeMutation.isPending}
                  className="bg-[#C8B88A] text-black hover:bg-[#D4C999]"
                  data-testid="button-connect-stripe"
                >
                  {connectStripeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Connecter Stripe
                </Button>
                <p className="text-xs text-gray-500">
                  Le formulaire s'ouvrira dans un nouvel onglet. Une fois terminé, revenez ici et cliquez sur "Vérifier la connexion".
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetch();
                    queryClient.invalidateQueries({ queryKey: ['/api/guarantee/stripe-status'] });
                    toast({
                      title: "Vérification en cours...",
                      description: "Actualisation du statut Stripe.",
                    });
                  }}
                  className="border-white/20 text-gray-300"
                  data-testid="button-refresh-stripe-status"
                >
                  <Loader2 className="h-4 w-4 mr-2" />
                  Vérifier la connexion
                </Button>
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'penalty' as SectionKey,
      icon: Shield,
      iconColor: 'text-[#C8B88A]',
      title: 'Montant pénalité',
      description: `${localConfig.penaltyAmount}€ par personne`,
      content: (
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">Montant par personne (€)</Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                type="number"
                min={1}
                max={200}
                value={localConfig.penaltyAmount}
                onChange={(e) => handleConfigChange('penaltyAmount', parseInt(e.target.value) || 30)}
                className="w-24 bg-white/5 border-white/10"
                data-testid="input-penalty-amount"
              />
              <span className="text-gray-400 text-sm">€ / personne</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Exemple : Une réservation de 4 personnes = {localConfig.penaltyAmount * 4}€ de pénalité en cas de no-show.
          </p>
        </div>
      ),
    },
    {
      key: 'delay' as SectionKey,
      icon: Clock,
      iconColor: 'text-purple-400',
      title: 'Délai annulation',
      description: `${localConfig.cancellationDelay}h avant la réservation`,
      content: (
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">Délai minimum avant réservation (heures)</Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                type="number"
                min={1}
                max={72}
                value={localConfig.cancellationDelay}
                onChange={(e) => handleConfigChange('cancellationDelay', parseInt(e.target.value) || 24)}
                className="w-24 bg-white/5 border-white/10"
                data-testid="input-cancellation-delay"
              />
              <span className="text-gray-400 text-sm">heures</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Le client peut annuler gratuitement jusqu'à {localConfig.cancellationDelay}h avant la réservation.
          </p>
        </div>
      ),
    },
    {
      key: 'conditions' as SectionKey,
      icon: Users,
      iconColor: 'text-cyan-400',
      title: 'Conditions d\'application',
      description: localConfig.applyTo === 'all' 
        ? 'Toutes les réservations'
        : localConfig.applyTo === 'min_persons'
        ? `Minimum ${localConfig.minPersons} personnes`
        : 'Week-end uniquement',
      content: (
        <div className="space-y-4">
          <RadioGroup
            value={localConfig.applyTo}
            onValueChange={(value) => handleConfigChange('applyTo', value)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="all" id="all" data-testid="radio-apply-all" />
              <Label htmlFor="all" className="text-gray-300 cursor-pointer">
                Toutes les réservations
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="min_persons" id="min_persons" data-testid="radio-apply-min" />
              <Label htmlFor="min_persons" className="text-gray-300 cursor-pointer">
                Minimum de personnes
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="weekend" id="weekend" data-testid="radio-apply-weekend" />
              <Label htmlFor="weekend" className="text-gray-300 cursor-pointer">
                Week-end uniquement
              </Label>
            </div>
          </RadioGroup>
          
          {localConfig.applyTo === 'min_persons' && (
            <div className="mt-4 pl-6">
              <Label className="text-gray-300">Nombre minimum de personnes</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={localConfig.minPersons}
                onChange={(e) => handleConfigChange('minPersons', parseInt(e.target.value) || 1)}
                className="w-24 mt-2 bg-white/5 border-white/10"
                data-testid="input-min-persons"
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'company' as SectionKey,
      icon: Building2,
      iconColor: 'text-amber-400',
      title: 'Informations entreprise',
      description: localConfig.companyName || 'Non configuré',
      content: (
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">Nom de l'établissement</Label>
            <Input
              value={localConfig.companyName || ''}
              onChange={(e) => handleConfigChange('companyName', e.target.value)}
              placeholder="Restaurant Le Gourmet"
              className="mt-2 bg-white/5 border-white/10"
              data-testid="input-company-name"
            />
          </div>
          <div>
            <Label className="text-gray-300">Adresse</Label>
            <Input
              value={localConfig.companyAddress || ''}
              onChange={(e) => handleConfigChange('companyAddress', e.target.value)}
              placeholder="123 Rue de la Paix, 75001 Paris"
              className="mt-2 bg-white/5 border-white/10"
              data-testid="input-company-address"
            />
          </div>
          <div>
            <Label className="text-gray-300">Téléphone</Label>
            <Input
              value={localConfig.companyPhone || ''}
              onChange={(e) => handleConfigChange('companyPhone', e.target.value)}
              placeholder="01 23 45 67 89"
              className="mt-2 bg-white/5 border-white/10"
              data-testid="input-company-phone"
            />
          </div>
        </div>
      ),
    },
    {
      key: 'branding' as SectionKey,
      icon: Palette,
      iconColor: 'text-pink-400',
      title: 'Personnalisation',
      description: 'Logo et couleurs',
      content: (
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">URL du logo</Label>
            <Input
              value={localConfig.logoUrl || ''}
              onChange={(e) => handleConfigChange('logoUrl', e.target.value || null)}
              placeholder="https://exemple.com/logo.png"
              className="mt-2 bg-white/5 border-white/10"
              data-testid="input-logo-url"
            />
          </div>
          <div>
            <Label className="text-gray-300">Couleur principale</Label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="color"
                value={localConfig.brandColor}
                onChange={(e) => handleConfigChange('brandColor', e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
                data-testid="input-brand-color"
              />
              <Input
                value={localConfig.brandColor}
                onChange={(e) => handleConfigChange('brandColor', e.target.value)}
                placeholder="#C8B88A"
                className="w-32 bg-white/5 border-white/10"
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'email' as SectionKey,
      icon: Mail,
      iconColor: 'text-green-400',
      title: 'Configuration Email',
      description: localConfig.senderEmail || localConfig.gmailSenderName || 'Géré par SpeedAI',
      content: (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
            <h4 className="text-green-300 font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email géré par SpeedAI
            </h4>
            <p className="text-sm text-gray-400 mt-1">
              Les emails sont envoyés via l'infrastructure SpeedAI. Vous pouvez personnaliser le nom d'expéditeur qui apparaîtra dans les emails.
            </p>
          </div>
          <div>
            <Label className="text-gray-300">Nom affiché dans les emails</Label>
            <Input
              value={localConfig.gmailSenderName || ''}
              onChange={(e) => handleConfigChange('gmailSenderName', e.target.value || null)}
              placeholder="Restaurant Le Gourmet"
              className="mt-2 bg-white/5 border-white/10"
              data-testid="input-sender-name"
            />
            <p className="text-xs text-gray-500 mt-1">Ce nom apparaîtra comme expéditeur des emails</p>
          </div>
          <div>
            <Label className="text-gray-300">URL des CGV (optionnel)</Label>
            <Input
              value={localConfig.termsUrl || ''}
              onChange={(e) => handleConfigChange('termsUrl', e.target.value || null)}
              placeholder="https://monsite.fr/cgv"
              className="mt-2 bg-white/5 border-white/10"
              data-testid="input-terms-url"
            />
          </div>
          <div className="pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const response = await apiRequest("POST", "/api/guarantee/test-email", {});
                  const result = await response.json();
                  toast({
                    title: result.success ? "Email envoyé !" : "Erreur",
                    description: result.message,
                    variant: result.success ? "default" : "destructive",
                  });
                } catch (error: any) {
                  toast({
                    title: "Erreur",
                    description: "Impossible d'envoyer l'email de test",
                    variant: "destructive",
                  });
                }
              }}
              className="w-full"
              data-testid="button-test-email"
            >
              <Mail className="h-4 w-4 mr-2" />
              Envoyer un email de test
            </Button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Un email de test sera envoyé à votre adresse email
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'sms' as SectionKey,
      icon: MessageSquare,
      iconColor: 'text-purple-400',
      title: 'Notifications SMS',
      description: localConfig.smsEnabled ? 'Activé' : 'Désactivé',
      content: (
        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <h4 className="text-purple-300 font-medium">SMS géré par SpeedAI</h4>
            <p className="text-sm text-gray-400 mt-1">
              Les SMS sont envoyés via le compte Twilio de SpeedAI. Aucune configuration nécessaire de votre côté.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Activer les SMS</Label>
              <p className="text-xs text-gray-500 mt-1">Envoyer des SMS automatiques aux clients</p>
            </div>
            <Switch
              checked={localConfig.smsEnabled}
              onCheckedChange={(checked) => handleConfigChange('smsEnabled', checked)}
              data-testid="switch-sms-enabled"
            />
          </div>
          
          <hr className="border-white/10" />
          
          <div className="space-y-3">
            <Label className="text-gray-300">Tester les SMS</Label>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="06 12 34 56 78"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                className="flex-1 bg-[#111315] border-white/10"
                data-testid="input-test-phone"
              />
              <Button
                variant="outline"
                disabled={!testPhoneNumber || isSendingTestSms || !localConfig.smsEnabled}
                onClick={async () => {
                  setIsSendingTestSms(true);
                  try {
                    const response = await apiRequest("POST", "/api/guarantee/test-sms", {
                      phoneNumber: testPhoneNumber
                    });
                    const result = await response.json();
                    toast({
                      title: result.success ? "SMS envoyé !" : "Erreur",
                      description: result.message,
                      variant: result.success ? "default" : "destructive",
                    });
                  } catch (error: any) {
                    toast({
                      title: "Erreur",
                      description: "Impossible d'envoyer le SMS de test",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSendingTestSms(false);
                  }
                }}
                data-testid="button-test-sms"
              >
                {isSendingTestSms ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Tester
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {localConfig.smsEnabled 
                ? "Entrez votre numéro pour recevoir un SMS de test"
                : "Activez les SMS pour pouvoir envoyer un test"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'notifications' as SectionKey,
      icon: Bell,
      iconColor: 'text-orange-400',
      title: 'Notifications automatiques',
      description: 'Emails et SMS automatiques',
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-[#C8B88A]/20 to-transparent border border-[#C8B88A]/30 rounded-lg p-4">
            <h4 className="text-[#C8B88A] font-medium">Flux automatisé</h4>
            <p className="text-sm text-gray-400 mt-1">
              SpeedAI envoie automatiquement les notifications aux clients à chaque étape.
            </p>
          </div>
          
          <div className="space-y-4">
            <h5 className="text-white font-medium">Demande de carte bancaire</h5>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Email automatique</Label>
                <p className="text-xs text-gray-500">Envoyer un email avec le lien de validation CB</p>
              </div>
              <Switch
                checked={localConfig.autoSendEmailOnCreate}
                onCheckedChange={(checked) => handleConfigChange('autoSendEmailOnCreate', checked)}
                data-testid="switch-auto-email-create"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">SMS automatique</Label>
                <p className="text-xs text-gray-500">Envoyer un SMS avec le lien de validation CB</p>
              </div>
              <Switch
                checked={localConfig.autoSendSmsOnCreate}
                onCheckedChange={(checked) => handleConfigChange('autoSendSmsOnCreate', checked)}
                disabled={!localConfig.smsEnabled}
                data-testid="switch-auto-sms-create"
              />
            </div>
          </div>
          
          <hr className="border-white/10" />
          
          <div className="space-y-4">
            <h5 className="text-white font-medium">Confirmation de réservation</h5>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Email de confirmation</Label>
                <p className="text-xs text-gray-500">Après validation de la carte bancaire</p>
              </div>
              <Switch
                checked={localConfig.autoSendEmailOnValidation}
                onCheckedChange={(checked) => handleConfigChange('autoSendEmailOnValidation', checked)}
                data-testid="switch-auto-email-validation"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">SMS de confirmation</Label>
                <p className="text-xs text-gray-500">Après validation de la carte bancaire</p>
              </div>
              <Switch
                checked={localConfig.autoSendSmsOnValidation}
                onCheckedChange={(checked) => handleConfigChange('autoSendSmsOnValidation', checked)}
                disabled={!localConfig.smsEnabled}
                data-testid="switch-auto-sms-validation"
              />
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="h-7 w-7 text-[#C8B88A]" />
            Garantie CB Anti No-Show
          </h1>
          <p className="text-gray-400 mt-1">
            Configurez la protection par carte bancaire pour vos réservations
          </p>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
                localConfig.enabled 
                  ? 'bg-[#4CEFAD]/10' 
                  : 'bg-gray-500/10'
              }`}>
                <Shield className={`h-7 w-7 ${
                  localConfig.enabled ? 'text-[#4CEFAD]' : 'text-gray-500'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {localConfig.enabled ? 'Garantie CB activée' : 'Garantie CB désactivée'}
                </h3>
                <p className="text-sm text-gray-400">
                  {localConfig.enabled 
                    ? 'Les clients doivent enregistrer leur CB pour confirmer'
                    : 'Activez pour protéger vos réservations'}
                </p>
              </div>
            </div>
            <Switch
              checked={localConfig.enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={updateMutation.isPending}
              data-testid="switch-guarantee-enabled"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sections.map((section) => (
          <Card 
            key={section.key}
            className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              data-testid={`section-${section.key}`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-white/5`}>
                  <section.icon className={`h-5 w-5 ${section.iconColor}`} />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-white">{section.title}</h3>
                  <p className="text-sm text-gray-400">{section.description}</p>
                </div>
              </div>
              {expandedSection === section.key ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            
            {expandedSection === section.key && (
              <CardContent className="pt-0 pb-4 px-4">
                <div className="pt-2 border-t border-white/5">
                  {section.content}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {hasChanges && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 p-4 rounded-xl bg-[#0D0F12] border border-white/10 shadow-2xl">
          <span className="text-sm text-gray-400">Modifications non sauvegardées</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (data?.config) {
                setLocalConfig(data.config);
                setHasChanges(false);
              }
            }}
            data-testid="button-cancel-changes"
          >
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-[#C8B88A] text-black hover:bg-[#D4C999]"
            data-testid="button-save-changes"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Sauvegarder'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
