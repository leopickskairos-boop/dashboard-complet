import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Settings, Clock, MessageSquare, Loader2, Save, AlertCircle, Gift, Plus, Trash2, Star, Percent, Coffee, Tag, 
  Zap, Mail, Phone, Power, Sparkles, CheckCircle2, Calendar, Info, Send, Bot, Link2, ExternalLink, RefreshCw, Unlink, Globe
} from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor } from "react-icons/si";
import type { ReviewConfig, ReviewIncentive, ReviewSource } from "@shared/schema";

const TRIGGER_TYPES = [
  { value: "post_visit", label: "Après visite", description: "Après une visite confirmée" },
  { value: "post_reservation", label: "Après réservation", description: "Après une réservation terminée" },
  { value: "post_interaction", label: "Après interaction", description: "Après toute interaction client" },
];

const TIMING_MODES = [
  { value: "smart", label: "Intelligent (IA)", description: "L'IA détermine le meilleur moment" },
  { value: "fixed_delay", label: "Délai fixe", description: "X heures/jours après l'interaction" },
  { value: "fixed_time", label: "Heure fixe", description: "Toujours à la même heure" },
];

const SEND_METHODS = [
  { value: "sms", label: "SMS uniquement", icon: Phone, recommended: true },
  { value: "email", label: "Email uniquement", icon: Mail, recommended: false },
  { value: "both", label: "SMS + Email", icon: MessageSquare, recommended: false },
];

const INCENTIVE_TYPES = [
  { value: "percentage", label: "Réduction (%)", icon: Percent },
  { value: "amount", label: "Réduction (€)", icon: Tag },
  { value: "free_item", label: "Offert gratuit", icon: Coffee },
  { value: "loyalty_points", label: "Points fidélité", icon: Star },
  { value: "other", label: "Autre", icon: Gift },
];

const AI_RESPONSE_TONES = [
  { value: "professional", label: "Professionnel", description: "Courtois et business" },
  { value: "friendly", label: "Amical", description: "Chaleureux et personnel" },
  { value: "formal", label: "Formel", description: "Respectueux et soutenu" },
  { value: "casual", label: "Décontracté", description: "Accessible et naturel" },
];

const AI_RESPONSE_LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
  { value: "de", label: "Allemand" },
  { value: "it", label: "Italien" },
];

export default function ReviewsSettings() {
  const { toast } = useToast();
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showNewIncentiveDialog, setShowNewIncentiveDialog] = useState(false);
  
  // Local state for form fields
  const [localConfig, setLocalConfig] = useState({
    enabled: false,
    triggerType: "post_visit",
    timingMode: "fixed_delay",
    fixedDelayHours: 24,
    fixedTime: "10:00",
    sendWindowStart: "09:00",
    sendWindowEnd: "20:00",
    avoidWeekends: true,
    sendMethod: "sms",
    smsMessage: "",
    emailSubject: "",
    emailMessage: "",
    selectedIncentiveId: "",
    // AI Response settings
    aiResponseEnabled: false,
    aiResponseTone: "professional",
    aiResponseLanguage: "fr",
    aiMaxLength: 300,
    aiAutoGenerate: true,
    aiIncludeCompanyName: true,
    // Thank You message settings
    thankYouEnabled: true,
    thankYouSendMethod: "both",
    thankYouSmsMessage: "",
    thankYouEmailSubject: "",
    thankYouEmailMessage: "",
  });

  const [newIncentive, setNewIncentive] = useState({
    type: "percentage",
    percentageValue: 10,
    fixedAmountValue: 500,
    freeItemName: "",
    loyaltyPointsValue: 100,
    customDescription: "",
    displayMessage: "",
    isActive: true,
  });

  const { data: config, isLoading } = useQuery<ReviewConfig>({
    queryKey: ["/api/reviews/config"],
  });

  const { data: incentives = [], isLoading: loadingIncentives } = useQuery<ReviewIncentive[]>({
    queryKey: ["/api/reviews/incentives"],
  });

  const { data: reviewSources = [], isLoading: loadingSources } = useQuery<ReviewSource[]>({
    queryKey: ["/api/reviews/sources"],
  });

  const [tripadvisorUrl, setTripadvisorUrl] = useState("");
  const [tripadvisorName, setTripadvisorName] = useState("");
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);

  const connectTripAdvisorMutation = useMutation({
    mutationFn: async (data: { tripadvisorUrl: string; displayName: string }) => {
      return await apiRequest("POST", "/api/reviews/sources/tripadvisor/connect", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/sources"] });
      setTripadvisorUrl("");
      setTripadvisorName("");
      setConnectingPlatform(null);
      toast({
        title: "TripAdvisor connecté",
        description: "Vos avis TripAdvisor seront synchronisés automatiquement.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Impossible de connecter TripAdvisor",
        variant: "destructive",
      });
    },
  });

  const disconnectSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return await apiRequest("DELETE", `/api/reviews/sources/${sourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/sources"] });
      toast({
        title: "Plateforme déconnectée",
        description: "La source d'avis a été supprimée.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de déconnecter la plateforme",
        variant: "destructive",
      });
    },
  });

  const syncSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      setSyncingSourceId(sourceId);
      return await apiRequest("POST", `/api/reviews/sources/${sourceId}/sync`);
    },
    onSuccess: () => {
      setSyncingSourceId(null);
      toast({
        title: "Synchronisation lancée",
        description: "Les avis sont en cours de récupération.",
      });
    },
    onError: () => {
      setSyncingSourceId(null);
      toast({
        title: "Erreur",
        description: "Impossible de lancer la synchronisation",
        variant: "destructive",
      });
    },
  });

  const handleConnectGoogle = () => {
    window.location.href = "/api/reviews/oauth/google/connect";
  };

  const handleConnectFacebook = () => {
    window.location.href = "/api/reviews/oauth/facebook/connect";
  };

  const getSourceByPlatform = (platform: string) => {
    return reviewSources.find(s => s.platform === platform);
  };

  // Initialize local config from fetched config
  useEffect(() => {
    if (config) {
      setLocalConfig(prev => ({
        ...prev,
        enabled: config.enabled || false,
        triggerType: config.triggerType || "post_visit",
        timingMode: config.timingMode || "fixed_delay",
        fixedDelayHours: config.fixedDelayHours || 24,
        fixedTime: config.fixedTime || "10:00",
        sendWindowStart: config.sendWindowStart || "09:00",
        sendWindowEnd: config.sendWindowEnd || "20:00",
        avoidWeekends: config.avoidWeekends ?? true,
        sendMethod: config.sendMethod || "sms",
        smsMessage: config.smsMessage || "",
        emailSubject: config.emailSubject || "",
        emailMessage: config.emailMessage || "",
        selectedIncentiveId: config.defaultIncentiveId || "",
        // AI Response settings
        aiResponseEnabled: config.aiResponseEnabled || false,
        aiResponseTone: config.aiResponseTone || "professional",
        aiResponseLanguage: config.aiResponseLanguage || "fr",
        aiMaxLength: config.aiMaxLength || 300,
        aiAutoGenerate: config.aiAutoGenerate ?? true,
        aiIncludeCompanyName: config.aiIncludeCompanyName ?? true,
        // Thank You message settings
        thankYouEnabled: config.thankYouEnabled ?? true,
        thankYouSendMethod: config.thankYouSendMethod || "both",
        thankYouSmsMessage: config.thankYouSmsMessage || "",
        thankYouEmailSubject: config.thankYouEmailSubject || "",
        thankYouEmailMessage: config.thankYouEmailMessage || "",
      }));
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ReviewConfig>) => {
      return await apiRequest("PUT", "/api/reviews/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/config"] });
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

  const createIncentiveMutation = useMutation({
    mutationFn: async (data: typeof newIncentive) => {
      return await apiRequest("POST", "/api/reviews/incentives", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/incentives"] });
      toast({
        title: "Offre créée",
        description: "Votre nouvelle offre a été ajoutée.",
      });
      setShowNewIncentiveDialog(false);
      resetNewIncentive();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'offre.",
        variant: "destructive",
      });
    },
  });

  const deleteIncentiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/reviews/incentives/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/incentives"] });
      toast({ title: "Offre supprimée" });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'offre.",
        variant: "destructive",
      });
    },
  });

  const handleSaveField = (field: string, value: any) => {
    updateMutation.mutate({ [field]: value });
  };

  const handleSaveAll = () => {
    updateMutation.mutate({
      enabled: localConfig.enabled,
      triggerType: localConfig.triggerType,
      timingMode: localConfig.timingMode,
      fixedDelayHours: localConfig.fixedDelayHours,
      fixedTime: localConfig.fixedTime,
      sendWindowStart: localConfig.sendWindowStart,
      sendWindowEnd: localConfig.sendWindowEnd,
      avoidWeekends: localConfig.avoidWeekends,
      sendMethod: localConfig.sendMethod,
      smsMessage: localConfig.smsMessage,
      emailSubject: localConfig.emailSubject,
      emailMessage: localConfig.emailMessage,
      defaultIncentiveId: localConfig.selectedIncentiveId || null,
      aiResponseEnabled: localConfig.aiResponseEnabled,
      aiResponseTone: localConfig.aiResponseTone,
      aiResponseLanguage: localConfig.aiResponseLanguage,
      aiMaxLength: localConfig.aiMaxLength,
      aiAutoGenerate: localConfig.aiAutoGenerate,
      aiIncludeCompanyName: localConfig.aiIncludeCompanyName,
      thankYouEnabled: localConfig.thankYouEnabled,
      thankYouSendMethod: localConfig.thankYouSendMethod,
      thankYouSmsMessage: localConfig.thankYouSmsMessage,
      thankYouEmailSubject: localConfig.thankYouEmailSubject,
      thankYouEmailMessage: localConfig.thankYouEmailMessage,
    });
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await apiRequest("POST", "/api/ai/generate-review-message", {
        sendMethod: localConfig.sendMethod,
        incentiveId: localConfig.selectedIncentiveId,
      });
      const data = await response.json();
      
      if (data.smsMessage) {
        setLocalConfig(prev => ({ ...prev, smsMessage: data.smsMessage }));
      }
      if (data.emailSubject) {
        setLocalConfig(prev => ({ ...prev, emailSubject: data.emailSubject }));
      }
      if (data.emailBody) {
        setLocalConfig(prev => ({ ...prev, emailMessage: data.emailBody }));
      }
      
      toast({
        title: "Message généré",
        description: "Le contenu a été généré par l'IA.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le message.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const resetNewIncentive = () => {
    setNewIncentive({
      type: "percentage",
      percentageValue: 10,
      fixedAmountValue: 500,
      freeItemName: "",
      loyaltyPointsValue: 100,
      customDescription: "",
      displayMessage: "",
      isActive: true,
    });
  };

  const handleCreateIncentive = () => {
    if (!newIncentive.displayMessage.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir le message d'affichage.",
        variant: "destructive",
      });
      return;
    }
    createIncentiveMutation.mutate(newIncentive);
  };

  const getIncentiveIcon = (type: string) => {
    const found = INCENTIVE_TYPES.find(t => t.value === type);
    return found ? found.icon : Gift;
  };

  const getIncentiveLabel = (incentive: ReviewIncentive) => {
    switch (incentive.type) {
      case 'percentage':
        return `${incentive.percentageValue || 0}% de réduction`;
      case 'amount':
        return `${((incentive.fixedAmountValue || 0) / 100).toFixed(2)}€ de réduction`;
      case 'free_item':
        return incentive.freeItemName || 'Article offert';
      case 'loyalty_points':
        return `${incentive.loyaltyPointsValue || 0} points fidélité`;
      default:
        return incentive.customDescription || 'Offre personnalisée';
    }
  };

  const selectedIncentive = incentives.find(i => i.id === localConfig.selectedIncentiveId);

  // Build summary text
  const getSummaryText = () => {
    const trigger = TRIGGER_TYPES.find(t => t.value === localConfig.triggerType);
    const timing = TIMING_MODES.find(t => t.value === localConfig.timingMode);
    const method = SEND_METHODS.find(m => m.value === localConfig.sendMethod);
    
    let timingText = "";
    if (localConfig.timingMode === "fixed_delay") {
      timingText = `${localConfig.fixedDelayHours}h après`;
    } else if (localConfig.timingMode === "fixed_time") {
      timingText = `à ${localConfig.fixedTime}`;
    } else {
      timingText = "moment optimal (IA)";
    }

    return {
      trigger: trigger?.label || "Après visite",
      timing: timingText,
      method: method?.label || "SMS",
      incentive: selectedIncentive ? getIncentiveLabel(selectedIncentive) : "Aucune",
      window: `${localConfig.sendWindowStart} - ${localConfig.sendWindowEnd}`,
      weekends: localConfig.avoidWeekends ? "Oui" : "Non",
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  const summary = getSummaryText();

  return (
    <div className="space-y-5 pb-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="pl-1">
        <h1 className="text-lg font-semibold text-foreground">Configuration des envois automatiques</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Paramétrez l'envoi automatique des demandes d'avis après une interaction client</p>
      </div>

      {/* UX Copy Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#C8B88A]/10 border border-[#C8B88A]/20">
        <Info className="h-5 w-5 text-[#C8B88A] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Cette configuration s'applique uniquement aux envois automatiques</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pour les envois ponctuels ou de masse, utilisez la section <span className="font-medium text-foreground">Campagnes</span>.
          </p>
        </div>
      </div>

      {/* Main Configuration Card - Single Linear Block */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
              <Zap className="h-4 w-4 text-[#C8B88A]" />
            </div>
            Envoi automatique des demandes d'avis
          </CardTitle>
          <CardDescription className="text-xs">
            Active l'envoi automatique des demandes d'avis après une interaction client
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Section 1: Activation globale */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#4CEFAD]/10">
                <Power className="h-5 w-5 text-[#4CEFAD]" />
              </div>
              <div>
                <p className="text-sm font-medium">Activation globale</p>
                <p className="text-xs text-muted-foreground">Active l'envoi automatique des demandes d'avis</p>
              </div>
            </div>
            <Switch
              checked={localConfig.enabled}
              onCheckedChange={(value) => {
                setLocalConfig(prev => ({ ...prev, enabled: value }));
                handleSaveField("enabled", value);
              }}
              data-testid="switch-auto-enabled"
            />
          </div>

          {localConfig.enabled && (
            <>
              <Separator className="bg-border/30" />

              {/* Section 2: Déclenchement */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Calendar className="h-4 w-4 text-blue-400" />
                  </div>
                  <Label className="text-sm font-medium">Déclenchement</Label>
                </div>
                <Select
                  value={localConfig.triggerType}
                  onValueChange={(value) => setLocalConfig(prev => ({ ...prev, triggerType: value }))}
                >
                  <SelectTrigger data-testid="select-trigger-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        <div>
                          <span>{trigger.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">- {trigger.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Définit le moment où la demande d'avis sera envoyée
                </p>
              </div>

              <Separator className="bg-border/30" />

              {/* Section 3: Timing d'envoi */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/10">
                    <Clock className="h-4 w-4 text-purple-400" />
                  </div>
                  <Label className="text-sm font-medium">Timing d'envoi</Label>
                </div>

                <Select
                  value={localConfig.timingMode}
                  onValueChange={(value) => setLocalConfig(prev => ({ ...prev, timingMode: value }))}
                >
                  <SelectTrigger data-testid="select-timing-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMING_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        <div>
                          <span>{mode.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">- {mode.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {localConfig.timingMode === "fixed_delay" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Délai (heures)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={localConfig.fixedDelayHours}
                        onChange={(e) => setLocalConfig(prev => ({ ...prev, fixedDelayHours: parseInt(e.target.value) || 24 }))}
                        data-testid="input-delay-hours"
                      />
                    </div>
                  </div>
                )}

                {localConfig.timingMode === "fixed_time" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Heure d'envoi</Label>
                    <Input
                      type="time"
                      value={localConfig.fixedTime}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, fixedTime: e.target.value }))}
                      data-testid="input-fixed-time"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Fenêtre début</Label>
                    <Input
                      type="time"
                      value={localConfig.sendWindowStart}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, sendWindowStart: e.target.value }))}
                      data-testid="input-window-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Fenêtre fin</Label>
                    <Input
                      type="time"
                      value={localConfig.sendWindowEnd}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, sendWindowEnd: e.target.value }))}
                      data-testid="input-window-end"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/10">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">Éviter les week-ends</p>
                      <p className="text-xs text-muted-foreground">Ne pas envoyer samedi et dimanche</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.avoidWeekends}
                    onCheckedChange={(value) => setLocalConfig(prev => ({ ...prev, avoidWeekends: value }))}
                    data-testid="switch-avoid-weekends"
                  />
                </div>
              </div>

              <Separator className="bg-border/30" />

              {/* Section 4: Méthode d'envoi */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-green-500/10">
                    <Send className="h-4 w-4 text-green-400" />
                  </div>
                  <Label className="text-sm font-medium">Méthode d'envoi</Label>
                </div>

                <div className="grid gap-2">
                  {SEND_METHODS.map((method) => (
                    <div
                      key={method.value}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        localConfig.sendMethod === method.value
                          ? "border-[#C8B88A]/50 bg-[#C8B88A]/5"
                          : "border-border/40 bg-muted/10 hover:bg-muted/20"
                      }`}
                      onClick={() => setLocalConfig(prev => ({ ...prev, sendMethod: method.value }))}
                      data-testid={`option-method-${method.value}`}
                    >
                      <div className="flex items-center gap-3">
                        <method.icon className={`h-4 w-4 ${localConfig.sendMethod === method.value ? "text-[#C8B88A]" : "text-muted-foreground"}`} />
                        <span className="text-sm">{method.label}</span>
                        {method.recommended && (
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
                            Recommandé
                          </Badge>
                        )}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        localConfig.sendMethod === method.value
                          ? "border-[#C8B88A] bg-[#C8B88A]"
                          : "border-muted-foreground"
                      }`}>
                        {localConfig.sendMethod === method.value && (
                          <CheckCircle2 className="w-full h-full text-black" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Le SMS est recommandé pour les restaurants (taux d'ouverture 98%)
                </p>
              </div>

              <Separator className="bg-border/30" />

              {/* Section 5: Contenu du message */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                      <MessageSquare className="h-4 w-4 text-[#C8B88A]" />
                    </div>
                    <Label className="text-sm font-medium">Contenu du message</Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI}
                    data-testid="button-generate-ai"
                  >
                    {isGeneratingAI ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Générer avec l'IA
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  Ce message sera utilisé pour tous les envois automatiques. Utilisez {"{prenom}"} pour personnaliser.
                </p>

                {(localConfig.sendMethod === "sms" || localConfig.sendMethod === "both") && (
                  <div className="space-y-2">
                    <Label className="text-xs">Message SMS (160 caractères max)</Label>
                    <Textarea
                      value={localConfig.smsMessage}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, smsMessage: e.target.value }))}
                      placeholder="Bonjour {prenom}, merci pour votre visite ! Partagez votre avis..."
                      maxLength={160}
                      className="resize-none"
                      rows={3}
                      data-testid="textarea-sms-message"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {localConfig.smsMessage.length}/160
                    </p>
                  </div>
                )}

                {(localConfig.sendMethod === "email" || localConfig.sendMethod === "both") && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Objet de l'email</Label>
                      <Input
                        value={localConfig.emailSubject}
                        onChange={(e) => setLocalConfig(prev => ({ ...prev, emailSubject: e.target.value }))}
                        placeholder="Votre avis compte pour nous !"
                        data-testid="input-email-subject"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Corps de l'email</Label>
                      <Textarea
                        value={localConfig.emailMessage}
                        onChange={(e) => setLocalConfig(prev => ({ ...prev, emailMessage: e.target.value }))}
                        placeholder="Bonjour {prenom},&#10;&#10;Merci pour votre visite ! Votre avis nous aide à nous améliorer..."
                        className="resize-none min-h-[120px]"
                        data-testid="textarea-email-body"
                      />
                    </div>
                  </>
                )}
              </div>

              <Separator className="bg-border/30" />

              {/* Section 6: Offres incitatives */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                      <Gift className="h-4 w-4 text-amber-500" />
                    </div>
                    <Label className="text-sm font-medium">Offre incitative (optionnel)</Label>
                  </div>
                  <Dialog open={showNewIncentiveDialog} onOpenChange={setShowNewIncentiveDialog}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid="button-new-incentive">
                        <Plus className="h-4 w-4 mr-1" />
                        Créer une offre
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Créer une offre incitative</DialogTitle>
                        <DialogDescription>
                          Cette offre sera affichée dans les messages de demande d'avis
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Type d'offre</Label>
                          <Select
                            value={newIncentive.type}
                            onValueChange={(value) => setNewIncentive({ ...newIncentive, type: value })}
                          >
                            <SelectTrigger data-testid="select-incentive-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INCENTIVE_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <span className="flex items-center gap-2">
                                    <type.icon className="h-4 w-4" />
                                    {type.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {newIncentive.type === "percentage" && (
                          <div className="space-y-2">
                            <Label>Pourcentage de réduction</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={newIncentive.percentageValue}
                                onChange={(e) => setNewIncentive({ ...newIncentive, percentageValue: parseInt(e.target.value) || 0 })}
                                data-testid="input-percentage-value"
                              />
                              <span className="text-muted-foreground">%</span>
                            </div>
                          </div>
                        )}

                        {newIncentive.type === "amount" && (
                          <div className="space-y-2">
                            <Label>Montant de la réduction</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                step={0.5}
                                value={(newIncentive.fixedAmountValue / 100).toFixed(2)}
                                onChange={(e) => setNewIncentive({ ...newIncentive, fixedAmountValue: Math.round(parseFloat(e.target.value || "0") * 100) })}
                                data-testid="input-amount-value"
                              />
                              <span className="text-muted-foreground">€</span>
                            </div>
                          </div>
                        )}

                        {newIncentive.type === "free_item" && (
                          <div className="space-y-2">
                            <Label>Article offert</Label>
                            <Input
                              placeholder="ex: Café, Dessert, Entrée..."
                              value={newIncentive.freeItemName}
                              onChange={(e) => setNewIncentive({ ...newIncentive, freeItemName: e.target.value })}
                              data-testid="input-free-item"
                            />
                          </div>
                        )}

                        {newIncentive.type === "loyalty_points" && (
                          <div className="space-y-2">
                            <Label>Points fidélité</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newIncentive.loyaltyPointsValue}
                              onChange={(e) => setNewIncentive({ ...newIncentive, loyaltyPointsValue: parseInt(e.target.value) || 0 })}
                              data-testid="input-loyalty-points"
                            />
                          </div>
                        )}

                        {newIncentive.type === "other" && (
                          <div className="space-y-2">
                            <Label>Description de l'offre</Label>
                            <Input
                              placeholder="ex: Cadeau surprise"
                              value={newIncentive.customDescription}
                              onChange={(e) => setNewIncentive({ ...newIncentive, customDescription: e.target.value })}
                              data-testid="input-custom-description"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Message affiché aux clients *</Label>
                          <Textarea
                            placeholder="ex: Obtenez 10% de réduction sur votre prochaine visite !"
                            value={newIncentive.displayMessage}
                            onChange={(e) => setNewIncentive({ ...newIncentive, displayMessage: e.target.value })}
                            className="resize-none"
                            data-testid="textarea-incentive-message"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewIncentiveDialog(false)}>
                          Annuler
                        </Button>
                        <Button 
                          onClick={handleCreateIncentive} 
                          disabled={createIncentiveMutation.isPending}
                          data-testid="button-create-incentive"
                        >
                          {createIncentiveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Créer"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <Select
                  value={localConfig.selectedIncentiveId || "_none"}
                  onValueChange={(value) => setLocalConfig(prev => ({ ...prev, selectedIncentiveId: value === "_none" ? "" : value }))}
                >
                  <SelectTrigger data-testid="select-incentive">
                    <SelectValue placeholder="Aucune offre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucune offre</SelectItem>
                    {incentives.filter(i => i.isActive).map((incentive) => (
                      <SelectItem key={incentive.id} value={incentive.id}>
                        <span className="flex items-center gap-2">
                          {(() => {
                            const Icon = getIncentiveIcon(incentive.type);
                            return <Icon className="h-4 w-4" />;
                          })()}
                          {getIncentiveLabel(incentive)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedIncentive && (
                  <div className="p-3 rounded-xl border border-[#C8B88A]/30 bg-[#C8B88A]/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = getIncentiveIcon(selectedIncentive.type);
                          return <Icon className="h-4 w-4 text-[#C8B88A]" />;
                        })()}
                        <span className="text-sm font-medium">{getIncentiveLabel(selectedIncentive)}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteIncentiveMutation.mutate(selectedIncentive.id)}
                        data-testid="button-delete-incentive"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{selectedIncentive.displayMessage}</p>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Conformément au RGPD, les offres doivent être clairement identifiées comme telles.
                </p>
              </div>

              <Separator className="bg-border/30" />

              {/* Section 7: Message de remerciement */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-pink-500/10">
                      <Gift className="h-5 w-5 text-pink-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Message de remerciement</p>
                      <p className="text-xs text-muted-foreground">Envoi automatique après confirmation d'avis avec code promo</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.thankYouEnabled}
                    onCheckedChange={(value) => setLocalConfig(prev => ({ ...prev, thankYouEnabled: value }))}
                    data-testid="switch-thank-you-enabled"
                  />
                </div>

                {localConfig.thankYouEnabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-pink-500/30 ml-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Méthode d'envoi du remerciement</Label>
                      <Select
                        value={localConfig.thankYouSendMethod}
                        onValueChange={(value) => setLocalConfig(prev => ({ ...prev, thankYouSendMethod: value }))}
                      >
                        <SelectTrigger data-testid="select-thank-you-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEND_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              <div className="flex items-center gap-2">
                                <method.icon className="h-4 w-4" />
                                <span>{method.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {(localConfig.thankYouSendMethod === "sms" || localConfig.thankYouSendMethod === "both") && (
                      <div className="space-y-2">
                        <Label className="text-xs">Message SMS de remerciement</Label>
                        <Textarea
                          value={localConfig.thankYouSmsMessage}
                          onChange={(e) => setLocalConfig(prev => ({ ...prev, thankYouSmsMessage: e.target.value }))}
                          placeholder="Ex: Merci {prenom} pour votre avis ! Votre code promo: {code_promo}. L'équipe {entreprise}"
                          rows={3}
                          data-testid="textarea-thank-you-sms"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Variables: {"{prenom}"}, {"{nom}"}, {"{code_promo}"}, {"{entreprise}"}. Laissez vide pour le message par défaut.
                        </p>
                      </div>
                    )}

                    {(localConfig.thankYouSendMethod === "email" || localConfig.thankYouSendMethod === "both") && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs">Objet de l'email</Label>
                          <Input
                            value={localConfig.thankYouEmailSubject}
                            onChange={(e) => setLocalConfig(prev => ({ ...prev, thankYouEmailSubject: e.target.value }))}
                            placeholder="Ex: Merci pour votre avis - {entreprise}"
                            data-testid="input-thank-you-email-subject"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Contenu de l'email (HTML)</Label>
                          <Textarea
                            value={localConfig.thankYouEmailMessage}
                            onChange={(e) => setLocalConfig(prev => ({ ...prev, thankYouEmailMessage: e.target.value }))}
                            placeholder="Laissez vide pour utiliser le template par défaut avec design professionnel"
                            rows={4}
                            data-testid="textarea-thank-you-email"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Variables: {"{prenom}"}, {"{nom}"}, {"{code_promo}"}, {"{entreprise}"}. Laissez vide pour le template par défaut.
                          </p>
                        </div>
                      </>
                    )}

                    <div className="p-3 rounded-lg bg-pink-500/5 border border-pink-500/20">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-pink-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Ce message est envoyé automatiquement lorsqu'un client confirme avoir laissé un avis. 
                          Le code promo généré est inclus dans le message.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="bg-border/30" />

              {/* Section 8: Réponses IA aux avis */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <Bot className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Réponses IA aux avis</p>
                      <p className="text-xs text-muted-foreground">Génération automatique de réponses personnalisées</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.aiResponseEnabled}
                    onCheckedChange={(value) => setLocalConfig(prev => ({ ...prev, aiResponseEnabled: value }))}
                    data-testid="switch-ai-response-enabled"
                  />
                </div>

                {localConfig.aiResponseEnabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-violet-500/30 ml-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Ton des réponses</Label>
                        <Select
                          value={localConfig.aiResponseTone}
                          onValueChange={(value) => setLocalConfig(prev => ({ ...prev, aiResponseTone: value }))}
                        >
                          <SelectTrigger data-testid="select-ai-tone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AI_RESPONSE_TONES.map((tone) => (
                              <SelectItem key={tone.value} value={tone.value}>
                                <div>
                                  <span>{tone.label}</span>
                                  <span className="text-xs text-muted-foreground ml-2">- {tone.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Langue des réponses</Label>
                        <Select
                          value={localConfig.aiResponseLanguage}
                          onValueChange={(value) => setLocalConfig(prev => ({ ...prev, aiResponseLanguage: value }))}
                        >
                          <SelectTrigger data-testid="select-ai-language">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AI_RESPONSE_LANGUAGES.map((lang) => (
                              <SelectItem key={lang.value} value={lang.value}>
                                {lang.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Longueur maximale des réponses (caractères)</Label>
                      <Input
                        type="number"
                        min={50}
                        max={500}
                        value={localConfig.aiMaxLength}
                        onChange={(e) => setLocalConfig(prev => ({ ...prev, aiMaxLength: parseInt(e.target.value) || 300 }))}
                        data-testid="input-ai-max-length"
                      />
                      <p className="text-xs text-muted-foreground">Entre 50 et 500 caractères</p>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/10">
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-4 w-4 text-violet-400" />
                        <div>
                          <p className="text-sm">Génération automatique</p>
                          <p className="text-xs text-muted-foreground">Générer automatiquement les réponses pour les nouveaux avis</p>
                        </div>
                      </div>
                      <Switch
                        checked={localConfig.aiAutoGenerate}
                        onCheckedChange={(value) => setLocalConfig(prev => ({ ...prev, aiAutoGenerate: value }))}
                        data-testid="switch-ai-auto-generate"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/10">
                      <div className="flex items-center gap-3">
                        <Tag className="h-4 w-4 text-violet-400" />
                        <div>
                          <p className="text-sm">Inclure le nom de l'entreprise</p>
                          <p className="text-xs text-muted-foreground">Mentionner le nom de votre entreprise dans les réponses</p>
                        </div>
                      </div>
                      <Switch
                        checked={localConfig.aiIncludeCompanyName}
                        onCheckedChange={(value) => setLocalConfig(prev => ({ ...prev, aiIncludeCompanyName: value }))}
                        data-testid="switch-ai-include-company"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator className="bg-border/30" />

              {/* Section 10: Synchronisation des avis existants */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Globe className="h-4 w-4 text-blue-500" />
                  </div>
                  <Label className="text-sm font-medium">Synchronisation des avis existants</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connectez vos profils professionnels pour récupérer vos avis existants et y répondre depuis SpeedAI. Ces connexions ne sont pas utilisées pour envoyer des liens aux clients.
                </p>

                <div className="grid gap-4">
                  {/* Google Business Profile */}
                  {(() => {
                    const googleSource = getSourceByPlatform("google");
                    return (
                      <div className="p-4 rounded-xl border border-border/40 bg-muted/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/10">
                              <SiGoogle className="h-5 w-5 text-[#4285F4]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Google Business Profile</p>
                              {googleSource ? (
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                                    Connecté
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {googleSource.displayName}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Non connecté</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {googleSource ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => syncSourceMutation.mutate(googleSource.id)}
                                  disabled={syncingSourceId === googleSource.id}
                                  data-testid="button-sync-google"
                                >
                                  {syncingSourceId === googleSource.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => disconnectSourceMutation.mutate(googleSource.id)}
                                  className="text-destructive hover:text-destructive"
                                  data-testid="button-disconnect-google"
                                >
                                  <Unlink className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConnectGoogle}
                                disabled={connectingPlatform === "google"}
                                data-testid="button-connect-google"
                              >
                                {connectingPlatform === "google" ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Link2 className="h-4 w-4 mr-2" />
                                )}
                                Connecter
                              </Button>
                            )}
                          </div>
                        </div>
                        {googleSource && googleSource.lastSyncAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Dernière sync: {new Date(googleSource.lastSyncAt).toLocaleString("fr-FR")}
                            {googleSource.totalReviewsCount !== null && ` • ${googleSource.totalReviewsCount} avis`}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Facebook */}
                  {(() => {
                    const facebookSource = getSourceByPlatform("facebook");
                    return (
                      <div className="p-4 rounded-xl border border-border/40 bg-muted/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/10">
                              <SiFacebook className="h-5 w-5 text-[#1877F2]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Facebook</p>
                              {facebookSource ? (
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                                    Connecté
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {facebookSource.displayName}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Non connecté</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {facebookSource ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => syncSourceMutation.mutate(facebookSource.id)}
                                  disabled={syncingSourceId === facebookSource.id}
                                  data-testid="button-sync-facebook"
                                >
                                  {syncingSourceId === facebookSource.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => disconnectSourceMutation.mutate(facebookSource.id)}
                                  className="text-destructive hover:text-destructive"
                                  data-testid="button-disconnect-facebook"
                                >
                                  <Unlink className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConnectFacebook}
                                disabled={connectingPlatform === "facebook"}
                                data-testid="button-connect-facebook"
                              >
                                {connectingPlatform === "facebook" ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Link2 className="h-4 w-4 mr-2" />
                                )}
                                Connecter
                              </Button>
                            )}
                          </div>
                        </div>
                        {facebookSource && facebookSource.lastSyncAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Dernière sync: {new Date(facebookSource.lastSyncAt).toLocaleString("fr-FR")}
                            {facebookSource.totalReviewsCount !== null && ` • ${facebookSource.totalReviewsCount} avis`}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* TripAdvisor */}
                  {(() => {
                    const tripadvisorSource = getSourceByPlatform("tripadvisor");
                    return (
                      <div className="p-4 rounded-xl border border-border/40 bg-muted/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/10">
                              <SiTripadvisor className="h-5 w-5 text-[#00AF87]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">TripAdvisor</p>
                              {tripadvisorSource ? (
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                                    Connecté
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {tripadvisorSource.displayName}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Non connecté</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {tripadvisorSource ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => syncSourceMutation.mutate(tripadvisorSource.id)}
                                  disabled={syncingSourceId === tripadvisorSource.id}
                                  data-testid="button-sync-tripadvisor"
                                >
                                  {syncingSourceId === tripadvisorSource.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => disconnectSourceMutation.mutate(tripadvisorSource.id)}
                                  className="text-destructive hover:text-destructive"
                                  data-testid="button-disconnect-tripadvisor"
                                >
                                  <Unlink className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="URL TripAdvisor"
                                  value={tripadvisorUrl}
                                  onChange={(e) => setTripadvisorUrl(e.target.value)}
                                  className="w-48 h-8 text-xs"
                                  data-testid="input-tripadvisor-url"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (tripadvisorUrl.trim()) {
                                      connectTripAdvisorMutation.mutate({
                                        tripadvisorUrl: tripadvisorUrl.trim(),
                                        displayName: tripadvisorName.trim() || "TripAdvisor",
                                      });
                                    }
                                  }}
                                  disabled={!tripadvisorUrl.trim() || connectTripAdvisorMutation.isPending}
                                  data-testid="button-connect-tripadvisor"
                                >
                                  {connectTripAdvisorMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Link2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        {tripadvisorSource && tripadvisorSource.lastSyncAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Dernière sync: {new Date(tripadvisorSource.lastSyncAt).toLocaleString("fr-FR")}
                            {tripadvisorSource.totalReviewsCount !== null && ` • ${tripadvisorSource.totalReviewsCount} avis`}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <Separator className="bg-border/30" />

              {/* Section 9: Résumé visuel */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#4CEFAD]/10">
                    <CheckCircle2 className="h-4 w-4 text-[#4CEFAD]" />
                  </div>
                  <Label className="text-sm font-medium">Résumé de la configuration</Label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Déclencheur</p>
                    <p className="text-sm font-medium mt-0.5">{summary.trigger}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Timing</p>
                    <p className="text-sm font-medium mt-0.5">{summary.timing}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Canal</p>
                    <p className="text-sm font-medium mt-0.5">{summary.method}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Offre</p>
                    <p className="text-sm font-medium mt-0.5">{summary.incentive}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fenêtre horaire</p>
                    <p className="text-sm font-medium mt-0.5">{summary.window}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Évite week-ends</p>
                    <p className="text-sm font-medium mt-0.5">{summary.weekends}</p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveAll}
                  disabled={updateMutation.isPending}
                  data-testid="button-save-config"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Sauvegarder la configuration
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
