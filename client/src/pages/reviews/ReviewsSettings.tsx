import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings, Clock, MessageSquare, Globe, Loader2, Save, ExternalLink, AlertCircle, Gift, Plus, Trash2, Star, Percent, Coffee, Tag, RefreshCw, Link2, Unlink, CheckCircle2, XCircle, Wifi, ChevronDown, Zap, Mail, Phone, Edit2, Power } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";
import type { ReviewConfig, ReviewIncentive, ReviewSource, ReviewSyncLog, ReviewAutomation } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

function PlatformConnectionsSection() {
  const { toast } = useToast();
  const [tripadvisorUrl, setTripadvisorUrl] = useState("");
  const [showTripAdvisorDialog, setShowTripAdvisorDialog] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { data: sources = [], isLoading: loadingSources } = useQuery<ReviewSource[]>({
    queryKey: ["/api/reviews/sources"],
  });

  const { data: syncLogs = [], isLoading: loadingLogs } = useQuery<ReviewSyncLog[]>({
    queryKey: ["/api/reviews/sync-logs"],
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/reviews/oauth/google/connect");
      const data = await response.json();
      window.location.href = data.authUrl;
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de se connecter à Google Business Profile",
        variant: "destructive",
      });
    },
  });

  const connectFacebookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/reviews/oauth/facebook/connect");
      const data = await response.json();
      window.location.href = data.authUrl;
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de se connecter à Facebook",
        variant: "destructive",
      });
    },
  });

  const connectTripAdvisorMutation = useMutation({
    mutationFn: async (tripadvisorUrl: string) => {
      return await apiRequest("POST", "/api/reviews/sources/tripadvisor/connect", { tripadvisorUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/sources"] });
      toast({
        title: "TripAdvisor connecté",
        description: "Votre établissement a été ajouté.",
      });
      setShowTripAdvisorDialog(false);
      setTripadvisorUrl("");
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de connecter TripAdvisor",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return await apiRequest("DELETE", `/api/reviews/sources/${sourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/sources"] });
      toast({
        title: "Plateforme déconnectée",
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

  const syncMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return await apiRequest("POST", `/api/reviews/sources/${sourceId}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/sync-logs"] });
      toast({
        title: "Synchronisation lancée",
        description: "Les avis sont en cours de récupération.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de synchroniser les avis",
        variant: "destructive",
      });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/reviews/sources/sync-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/sync-logs"] });
      toast({
        title: "Synchronisation globale lancée",
        description: "Tous vos avis sont en cours de récupération.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de synchroniser les avis",
        variant: "destructive",
      });
    },
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "google":
        return <SiGoogle className="h-4 w-4 text-red-500" />;
      case "facebook":
        return <SiFacebook className="h-4 w-4 text-blue-600" />;
      case "tripadvisor":
        return <SiTripadvisor className="h-4 w-4 text-green-600" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "google":
        return "Google Business Profile";
      case "facebook":
        return "Facebook";
      case "tripadvisor":
        return "TripAdvisor";
      default:
        return platform;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-[#4CEFAD]/10 text-[#4CEFAD] border-[#4CEFAD]/20 text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connecté
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="h-3 w-3 mr-1" />
            Erreur
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="text-[10px]">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            En attente
          </Badge>
        );
      default:
        return null;
    }
  };

  const connectedSources = sources.filter(s => s.connectionStatus === "active");
  const lastSync = syncLogs.length > 0 ? syncLogs[0] : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] md:col-span-2">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-4 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <div className="p-1.5 rounded-lg bg-[#4CEFAD]/10">
                      <Wifi className="h-4 w-4 text-[#4CEFAD]" />
                    </div>
                    Agrégation des Avis
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Connectez vos plateformes pour centraliser tous vos avis
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connectedSources.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {connectedSources.length} plateforme{connectedSources.length > 1 ? "s" : ""}
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-5 pt-0">
            {connectedSources.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    syncAllMutation.mutate();
                  }}
                  disabled={syncAllMutation.isPending}
                  data-testid="button-sync-all"
                >
                  {syncAllMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Synchroniser tout
                </Button>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <PlatformCard
                name="Google Business Profile"
                icon={<SiGoogle className="h-5 w-5 text-red-500" />}
                description="Récupérez vos avis Google"
                source={sources.find(s => s.platform === "google")}
                onConnect={() => connectGoogleMutation.mutate()}
                onDisconnect={(id) => disconnectMutation.mutate(id)}
                onSync={(id) => syncMutation.mutate(id)}
                isConnecting={connectGoogleMutation.isPending}
                isSyncing={syncMutation.isPending}
              />

              <PlatformCard
                name="Facebook"
                icon={<SiFacebook className="h-5 w-5 text-blue-600" />}
                description="Récupérez vos avis Facebook"
                source={sources.find(s => s.platform === "facebook")}
                onConnect={() => connectFacebookMutation.mutate()}
                onDisconnect={(id) => disconnectMutation.mutate(id)}
                onSync={(id) => syncMutation.mutate(id)}
                isConnecting={connectFacebookMutation.isPending}
                isSyncing={syncMutation.isPending}
              />

              <div className="p-4 rounded-xl border border-border/40 bg-muted/10 hover:bg-muted/15 transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <SiTripadvisor className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium">TripAdvisor</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Récupérez vos avis TripAdvisor
                    </p>
                  </div>
                </div>

                {sources.find(s => s.platform === "tripadvisor") ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      {getStatusBadge(sources.find(s => s.platform === "tripadvisor")?.connectionStatus || "")}
                      <span className="text-[10px] text-muted-foreground">
                        {sources.find(s => s.platform === "tripadvisor")?.totalReviewsCount || 0} avis
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => {
                          const source = sources.find(s => s.platform === "tripadvisor");
                          if (source) syncMutation.mutate(source.id);
                        }}
                        disabled={syncMutation.isPending}
                        data-testid="button-sync-tripadvisor"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sync
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          const source = sources.find(s => s.platform === "tripadvisor");
                          if (source) disconnectMutation.mutate(source.id);
                        }}
                        data-testid="button-disconnect-tripadvisor"
                      >
                        <Unlink className="h-3 w-3 mr-1" />
                        Déconnecter
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Dialog open={showTripAdvisorDialog} onOpenChange={setShowTripAdvisorDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full h-8" data-testid="button-connect-tripadvisor">
                        <Link2 className="h-3.5 w-3.5 mr-1.5" />
                        Connecter
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <SiTripadvisor className="h-5 w-5 text-green-600" />
                          Connecter TripAdvisor
                        </DialogTitle>
                        <DialogDescription>
                          Entrez l'URL de votre page TripAdvisor pour récupérer vos avis.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>URL TripAdvisor</Label>
                          <Input
                            value={tripadvisorUrl}
                            onChange={(e) => setTripadvisorUrl(e.target.value)}
                            placeholder="https://www.tripadvisor.fr/Restaurant_Review-g187147-d..."
                            data-testid="input-tripadvisor-url-dialog"
                          />
                          <p className="text-xs text-muted-foreground">
                            Copiez l'URL de votre page TripAdvisor depuis votre navigateur
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => connectTripAdvisorMutation.mutate(tripadvisorUrl)}
                          disabled={!tripadvisorUrl || connectTripAdvisorMutation.isPending}
                        >
                          {connectTripAdvisorMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Connecter
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            {lastSync && (
              <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Dernière synchronisation</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs">
                      {formatDistanceToNow(new Date(lastSync.startedAt), { addSuffix: true, locale: fr })}
                    </span>
                    {lastSync.status === "success" ? (
                      <Badge className="bg-[#4CEFAD]/10 text-[#4CEFAD] border-[#4CEFAD]/20 text-[10px]">
                        {lastSync.fetchedCount || 0} avis récupérés
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        Échec
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {connectedSources.length === 0 && (
              <div className="p-4 bg-muted/30 rounded-lg border border-border/30 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Connectez au moins une plateforme pour commencer à centraliser vos avis
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface PlatformCardProps {
  name: string;
  icon: React.ReactNode;
  description: string;
  source?: ReviewSource;
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  onSync: (id: string) => void;
  isConnecting: boolean;
  isSyncing: boolean;
}

function PlatformCard({
  name,
  icon,
  description,
  source,
  onConnect,
  onDisconnect,
  onSync,
  isConnecting,
  isSyncing,
}: PlatformCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-[#4CEFAD]/10 text-[#4CEFAD] border-[#4CEFAD]/20 text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connecté
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="h-3 w-3 mr-1" />
            Erreur
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="text-[10px]">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            En attente
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 rounded-xl border border-border/40 bg-muted/10 hover:bg-muted/15 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-muted/30">{icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        </div>
      </div>

      {source ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {getStatusBadge(source.connectionStatus)}
            <span className="text-[10px] text-muted-foreground">
              {source.totalReviewsCount || 0} avis
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => onSync(source.id)}
              disabled={isSyncing}
              data-testid={`button-sync-${name.toLowerCase().replace(/ /g, "-")}`}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => onDisconnect(source.id)}
              data-testid={`button-disconnect-${name.toLowerCase().replace(/ /g, "-")}`}
            >
              <Unlink className="h-3 w-3 mr-1" />
              Déconnecter
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8"
          onClick={onConnect}
          disabled={isConnecting}
          data-testid={`button-connect-${name.toLowerCase().replace(/ /g, "-")}`}
        >
          {isConnecting ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
          )}
          Connecter
        </Button>
      )}
    </div>
  );
}

const INCENTIVE_TYPES = [
  { value: "percentage", label: "Réduction (%)", icon: Percent },
  { value: "amount", label: "Réduction (€)", icon: Tag },
  { value: "free_item", label: "Offert gratuit", icon: Coffee },
  { value: "loyalty_points", label: "Points fidélité", icon: Star },
  { value: "other", label: "Autre", icon: Gift },
];

const TRIGGER_TYPES = [
  { value: "new_client", label: "Nouveau client", description: "Envoi automatique à chaque nouveau client" },
  { value: "post_visit", label: "Après visite", description: "Envoi X jours après la visite" },
  { value: "post_reservation", label: "Après réservation", description: "Envoi X jours après la réservation" },
  { value: "days_after_visit", label: "Délai personnalisé", description: "Définir un délai précis" },
  { value: "manual", label: "Manuel", description: "Déclenché manuellement" },
];

const SEND_METHODS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: Phone },
  { value: "both", label: "Email + SMS", icon: MessageSquare },
];

function AutomationsSection() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<ReviewAutomation | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    triggerType: "post_visit",
    daysAfter: 3,
    sendTime: "10:00",
    sendMethod: "both",
    incentiveId: "_none",
    isActive: false,
  });

  const { data: automations = [], isLoading } = useQuery<ReviewAutomation[]>({
    queryKey: ["/api/reviews/automations"],
  });

  const { data: incentives = [] } = useQuery<ReviewIncentive[]>({
    queryKey: ["/api/reviews/incentives"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/reviews/automations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/automations"] });
      toast({ title: "Automation créée", description: "L'automation a été créée avec succès." });
      resetForm();
      setShowDialog(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer l'automation", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PUT", `/api/reviews/automations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/automations"] });
      toast({ title: "Automation mise à jour", description: "L'automation a été modifiée." });
      resetForm();
      setShowDialog(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour l'automation", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/reviews/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/automations"] });
      toast({ title: "Automation supprimée" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer l'automation", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/reviews/automations/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/automations"] });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le statut", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      triggerType: "post_visit",
      daysAfter: 3,
      sendTime: "10:00",
      sendMethod: "both",
      incentiveId: "_none",
      isActive: false,
    });
    setEditingAutomation(null);
  };

  const openEditDialog = (automation: ReviewAutomation) => {
    const triggerConfig = automation.triggerConfig as { daysAfter?: number; sendTime?: string } | null;
    setEditingAutomation(automation);
    setFormData({
      name: automation.name,
      description: automation.description || "",
      triggerType: automation.triggerType,
      daysAfter: triggerConfig?.daysAfter || 3,
      sendTime: triggerConfig?.sendTime || "10:00",
      sendMethod: automation.sendMethod,
      incentiveId: automation.incentiveId || "_none",
      isActive: automation.isActive,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    const needsTimingConfig = ["post_visit", "post_reservation", "days_after_visit"].includes(formData.triggerType);
    const payload = {
      name: formData.name,
      description: formData.description || null,
      triggerType: formData.triggerType,
      triggerConfig: needsTimingConfig ? {
        daysAfter: formData.daysAfter,
        sendTime: formData.sendTime,
      } : null,
      sendMethod: formData.sendMethod,
      incentiveId: formData.incentiveId && formData.incentiveId !== "_none" ? formData.incentiveId : null,
      isActive: formData.isActive,
    };

    if (editingAutomation) {
      updateMutation.mutate({ id: editingAutomation.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const activeCount = automations.filter(a => a.isActive).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] md:col-span-2">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-4 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    Automations d'Avis
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Configurez des envois automatiques de demandes d'avis
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeCount > 0 && (
                  <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
                    {activeCount} active{activeCount > 1 ? "s" : ""}
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowDialog(true);
                }}
                data-testid="button-new-automation"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nouvelle automation
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : automations.length === 0 ? (
              <div className="p-6 bg-muted/30 rounded-lg border border-border/30 text-center">
                <Zap className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune automation configurée
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Créez votre première automation pour envoyer automatiquement des demandes d'avis
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {automations.map((automation) => {
                  const triggerInfo = TRIGGER_TYPES.find(t => t.value === automation.triggerType);
                  const methodInfo = SEND_METHODS.find(m => m.value === automation.sendMethod);
                  const triggerConfig = automation.triggerConfig as { daysAfter?: number; sendTime?: string } | null;
                  
                  return (
                    <div
                      key={automation.id}
                      className="p-4 rounded-xl border border-border/40 bg-muted/10 hover:bg-muted/15 transition-colors"
                      data-testid={`automation-item-${automation.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium truncate">{automation.name}</h4>
                            <Badge variant={automation.isActive ? "default" : "secondary"} className="text-[10px]">
                              {automation.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          {automation.description && (
                            <p className="text-xs text-muted-foreground mb-2 truncate">{automation.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {triggerInfo?.label || automation.triggerType}
                              {triggerConfig?.daysAfter && ` (${triggerConfig.daysAfter}j)`}
                            </span>
                            <span className="flex items-center gap-1">
                              {methodInfo?.icon && <methodInfo.icon className="h-3 w-3" />}
                              {methodInfo?.label || automation.sendMethod}
                            </span>
                            {automation.totalSent !== null && automation.totalSent !== undefined && automation.totalSent > 0 && (
                              <span className="text-[10px]">
                                {automation.totalSent} envoyés
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleMutation.mutate(automation.id)}
                            disabled={toggleMutation.isPending}
                            data-testid={`button-toggle-automation-${automation.id}`}
                          >
                            <Power className={`h-4 w-4 ${automation.isActive ? "text-[#4CEFAD]" : "text-muted-foreground"}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(automation)}
                            data-testid={`button-edit-automation-${automation.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(automation.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-automation-${automation.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    {editingAutomation ? "Modifier l'automation" : "Nouvelle automation"}
                  </DialogTitle>
                  <DialogDescription>
                    Configurez les paramètres d'envoi automatique
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nom de l'automation</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Demande après visite"
                      data-testid="input-automation-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description (optionnel)</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Description de l'automation..."
                      className="resize-none"
                      rows={2}
                      data-testid="input-automation-description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Déclencheur</Label>
                    <Select
                      value={formData.triggerType}
                      onValueChange={(value) => setFormData({ ...formData, triggerType: value })}
                    >
                      <SelectTrigger data-testid="select-automation-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPES.map((trigger) => (
                          <SelectItem key={trigger.value} value={trigger.value}>
                            {trigger.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.triggerType === "post_visit" || formData.triggerType === "post_reservation" || formData.triggerType === "days_after_visit") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Délai (jours)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={formData.daysAfter}
                          onChange={(e) => setFormData({ ...formData, daysAfter: parseInt(e.target.value) || 1 })}
                          data-testid="input-automation-days"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Heure d'envoi</Label>
                        <Input
                          type="time"
                          value={formData.sendTime}
                          onChange={(e) => setFormData({ ...formData, sendTime: e.target.value })}
                          data-testid="input-automation-time"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Méthode d'envoi</Label>
                    <Select
                      value={formData.sendMethod}
                      onValueChange={(value) => setFormData({ ...formData, sendMethod: value })}
                    >
                      <SelectTrigger data-testid="select-automation-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEND_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            <span className="flex items-center gap-2">
                              <method.icon className="h-4 w-4" />
                              {method.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Incitation (optionnel)</Label>
                    <Select
                      value={formData.incentiveId}
                      onValueChange={(value) => setFormData({ ...formData, incentiveId: value })}
                    >
                      <SelectTrigger data-testid="select-automation-incentive">
                        <SelectValue placeholder="Aucune incitation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Aucune</SelectItem>
                        {incentives.filter(i => i.isActive).map((incentive) => (
                          <SelectItem key={incentive.id} value={incentive.id}>
                            {incentive.displayMessage || incentive.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Power className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Activer l'automation</p>
                        <p className="text-xs text-muted-foreground">L'automation démarrera dès l'activation</p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(value) => setFormData({ ...formData, isActive: value })}
                      data-testid="switch-automation-active"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-automation"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingAutomation ? "Mettre à jour" : "Créer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function ReviewsSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showNewIncentiveDialog, setShowNewIncentiveDialog] = useState(false);
  const [platformLinksOpen, setPlatformLinksOpen] = useState(false);
  const [aiResponseOpen, setAiResponseOpen] = useState(false);
  const [localSmsMessage, setLocalSmsMessage] = useState("");
  const [localEmailSubject, setLocalEmailSubject] = useState("");
  const [localEmailMessage, setLocalEmailMessage] = useState("");
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

  useEffect(() => {
    if (config) {
      setLocalSmsMessage(config.smsMessage || "");
      setLocalEmailSubject(config.emailSubject || "");
      setLocalEmailMessage(config.emailMessage || "");
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
      setIsSaving(false);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration.",
        variant: "destructive",
      });
      setIsSaving(false);
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
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'offre.",
        variant: "destructive",
      });
    },
  });

  const updateIncentiveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ReviewIncentive> }) => {
      return await apiRequest("PUT", `/api/reviews/incentives/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/incentives"] });
      toast({
        title: "Offre mise à jour",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'offre.",
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
      toast({
        title: "Offre supprimée",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'offre.",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/reviews/incentives/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/incentives"] });
      toast({
        title: "Offre par défaut définie",
        description: "Cette offre sera utilisée pour les nouvelles demandes d'avis.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de définir l'offre par défaut.",
        variant: "destructive",
      });
    },
  });

  const handleToggleEnabled = (enabled: boolean) => {
    updateMutation.mutate({ enabled });
  };

  const handleSaveSettings = (field: string, value: any) => {
    setIsSaving(true);
    updateMutation.mutate({ [field]: value });
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

  const getIncentiveIcon = (type: string) => {
    const found = INCENTIVE_TYPES.find(t => t.value === type);
    return found ? found.icon : Gift;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pl-1">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Configuration des Avis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Paramétrez votre collecte d'avis</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-br from-[#1A1C1F] to-[#151618] border border-white/[0.06]">
          <span className="text-sm text-muted-foreground">Système activé</span>
          <Switch
            checked={config?.enabled || false}
            onCheckedChange={handleToggleEnabled}
            data-testid="switch-reviews-enabled"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                <Clock className="h-4 w-4 text-[#C8B88A]" />
              </div>
              Timing d'envoi
            </CardTitle>
            <CardDescription className="text-xs">
              Définissez le meilleur moment pour solliciter vos clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label>Mode de timing</Label>
              <Select
                value={config?.timingMode || "smart"}
                onValueChange={(value) => handleSaveSettings("timingMode", value)}
                data-testid="select-timing-mode"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart">Intelligent (IA)</SelectItem>
                  <SelectItem value="fixed_delay">Délai fixe après RDV</SelectItem>
                  <SelectItem value="fixed_time">Heure fixe quotidienne</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config?.timingMode === "fixed_delay" && (
              <div className="space-y-2">
                <Label>Délai après RDV (heures)</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={config?.fixedDelayHours || 24}
                  onChange={(e) => handleSaveSettings("fixedDelayHours", parseInt(e.target.value))}
                  data-testid="input-fixed-delay"
                />
              </div>
            )}

            {config?.timingMode === "fixed_time" && (
              <div className="space-y-2">
                <Label>Heure d'envoi</Label>
                <Input
                  type="time"
                  value={config?.fixedTime || "18:00"}
                  onChange={(e) => handleSaveSettings("fixedTime", e.target.value)}
                  data-testid="input-fixed-time"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fenêtre début</Label>
                <Input
                  type="time"
                  value={config?.sendWindowStart || "10:00"}
                  onChange={(e) => handleSaveSettings("sendWindowStart", e.target.value)}
                  data-testid="input-window-start"
                />
              </div>
              <div className="space-y-2">
                <Label>Fenêtre fin</Label>
                <Input
                  type="time"
                  value={config?.sendWindowEnd || "20:00"}
                  onChange={(e) => handleSaveSettings("sendWindowEnd", e.target.value)}
                  data-testid="input-window-end"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Éviter les week-ends</Label>
              <Switch
                checked={config?.avoidWeekends || false}
                onCheckedChange={(value) => handleSaveSettings("avoidWeekends", value)}
                data-testid="switch-avoid-weekends"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                <MessageSquare className="h-4 w-4 text-[#C8B88A]" />
              </div>
              Messages personnalisés
            </CardTitle>
            <CardDescription className="text-xs">
              Personnalisez le ton et le contenu de vos invitations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label>Message SMS (160 car. max)</Label>
              <Textarea
                value={localSmsMessage}
                onChange={(e) => setLocalSmsMessage(e.target.value)}
                onBlur={() => {
                  if (localSmsMessage !== (config?.smsMessage || "")) {
                    handleSaveSettings("smsMessage", localSmsMessage);
                  }
                }}
                placeholder="Merci de votre visite ! Partagez votre expérience avec nous..."
                maxLength={160}
                className="resize-none"
                data-testid="textarea-sms-message"
              />
              <p className="text-xs text-muted-foreground">
                {localSmsMessage.length}/160 caractères
              </p>
            </div>

            <div className="space-y-2">
              <Label>Objet de l'email</Label>
              <Input
                value={localEmailSubject}
                onChange={(e) => setLocalEmailSubject(e.target.value)}
                onBlur={() => {
                  if (localEmailSubject !== (config?.emailSubject || "")) {
                    handleSaveSettings("emailSubject", localEmailSubject);
                  }
                }}
                placeholder="Partagez votre expérience avec nous !"
                data-testid="input-email-subject"
              />
            </div>

            <div className="space-y-2">
              <Label>Corps de l'email</Label>
              <Textarea
                value={localEmailMessage}
                onChange={(e) => setLocalEmailMessage(e.target.value)}
                onBlur={() => {
                  if (localEmailMessage !== (config?.emailMessage || "")) {
                    handleSaveSettings("emailMessage", localEmailMessage);
                  }
                }}
                placeholder="<p>Bonjour {nom},</p><p>Merci de votre visite...</p>"
                className="min-h-[80px] resize-none font-mono text-xs"
                data-testid="textarea-email-message"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incentives Section */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                <Gift className="h-4 w-4 text-[#C8B88A]" />
              </div>
              Offres incitatives
            </CardTitle>
            <div className="flex justify-end">
              <Dialog open={showNewIncentiveDialog} onOpenChange={setShowNewIncentiveDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-incentive">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle offre
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
                        data-testid="select-incentive-type"
                      >
                        <SelectTrigger>
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
                      <p className="text-xs text-muted-foreground">
                        Ce message apparaîtra dans le SMS et l'email envoyés au client
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowNewIncentiveDialog(false)} data-testid="button-cancel-incentive">
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {loadingIncentives ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[#C8B88A]" />
            </div>
          ) : incentives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 rounded-xl border border-dashed border-border/60 bg-muted/20">
              <div className="p-3 rounded-full bg-[#C8B88A]/10 mb-4">
                <Gift className="h-6 w-6 text-[#C8B88A]/60" />
              </div>
              <p className="text-sm font-medium text-foreground/80">Aucune offre configurée</p>
              <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
                Créez votre première offre incitative pour booster le taux de réponse de vos clients
              </p>
            </div>
          ) : (
            <div className="space-y-2">
                {incentives.map((incentive) => {
                  const IconComponent = getIncentiveIcon(incentive.type);
                  const getIncentiveLabel = () => {
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
                  return (
                    <div
                      key={incentive.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        incentive.isDefault 
                          ? "border-[#C8B88A]/40 bg-[#C8B88A]/5" 
                          : "border-border/50 bg-muted/20 hover:bg-muted/30"
                      }`}
                      data-testid={`incentive-card-${incentive.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${incentive.isActive ? "bg-[#C8B88A]/15" : "bg-muted/50"}`}>
                          <IconComponent className={`h-4 w-4 ${incentive.isActive ? "text-[#C8B88A]" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{getIncentiveLabel()}</span>
                            {incentive.isDefault && (
                              <Badge variant="secondary" className="bg-[#C8B88A]/15 text-[#C8B88A] border-0 text-[10px] px-1.5 py-0">
                                Défaut
                              </Badge>
                            )}
                            {!incentive.isActive && (
                              <Badge variant="outline" className="text-muted-foreground border-border/50 text-[10px] px-1.5 py-0">
                                Inactif
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{incentive.displayMessage}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={incentive.isActive}
                          onCheckedChange={(checked) => 
                            updateIncentiveMutation.mutate({ id: incentive.id, updates: { isActive: checked } })
                          }
                          data-testid={`switch-incentive-active-${incentive.id}`}
                        />
                        {!incentive.isDefault && incentive.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDefaultMutation.mutate(incentive.id)}
                            disabled={setDefaultMutation.isPending}
                            className="h-8 w-8 text-muted-foreground hover:text-[#C8B88A]"
                            data-testid={`button-set-default-${incentive.id}`}
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteIncentiveMutation.mutate(incentive.id)}
                          disabled={deleteIncentiveMutation.isPending}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          data-testid={`button-delete-incentive-${incentive.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border/30">
              <div className="flex items-start gap-2.5">
                <Gift className="h-4 w-4 text-[#C8B88A]/70 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground/80">Comment ça fonctionne ?</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    L'offre par défaut sera automatiquement incluse dans les SMS et emails avec un encadré visible.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Platforms Section */}
      <Collapsible open={platformLinksOpen} onOpenChange={setPlatformLinksOpen}>
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                      <Globe className="h-4 w-4 text-[#C8B88A]" />
                    </div>
                    Liens plateformes
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Configurez vos liens d'avis pour chaque plateforme
                  </CardDescription>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${platformLinksOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
          <div className="grid gap-4 md:grid-cols-2">
              <div className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors">
                <Label className="flex items-center gap-2 text-xs font-medium mb-2">
                  <SiGoogle className="h-3.5 w-3.5 text-red-500" />
                  Google Business
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.googleReviewUrl || ""}
                    onChange={(e) => handleSaveSettings("googleReviewUrl", e.target.value)}
                    placeholder="https://g.page/r/..."
                    className="text-xs h-8"
                    data-testid="input-google-url"
                  />
                  {config?.googleReviewUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={config.googleReviewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors">
                <Label className="flex items-center gap-2 text-xs font-medium mb-2">
                  <SiTripadvisor className="h-3.5 w-3.5 text-green-600" />
                  TripAdvisor
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.tripadvisorUrl || ""}
                    onChange={(e) => handleSaveSettings("tripadvisorUrl", e.target.value)}
                    placeholder="https://tripadvisor.com/..."
                    className="text-xs h-8"
                    data-testid="input-tripadvisor-url"
                  />
                  {config?.tripadvisorUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={config.tripadvisorUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors">
                <Label className="flex items-center gap-2 text-xs font-medium mb-2">
                  <SiFacebook className="h-3.5 w-3.5 text-blue-600" />
                  Facebook
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.facebookPageUrl || ""}
                    onChange={(e) => handleSaveSettings("facebookPageUrl", e.target.value)}
                    placeholder="https://facebook.com/..."
                    className="text-xs h-8"
                    data-testid="input-facebook-url"
                  />
                  {config?.facebookPageUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={config.facebookPageUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors">
                <Label className="flex items-center gap-2 text-xs font-medium mb-2">
                  <SiYelp className="h-3.5 w-3.5 text-red-600" />
                  Yelp
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.yelpUrl || ""}
                    onChange={(e) => handleSaveSettings("yelpUrl", e.target.value)}
                    placeholder="https://yelp.com/biz/..."
                    className="text-xs h-8"
                    data-testid="input-yelp-url"
                  />
                  {config?.yelpUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={config.yelpUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors">
                <Label className="flex items-center gap-2 text-xs font-medium mb-2">
                  <Globe className="h-3.5 w-3.5 text-yellow-600" />
                  Pages Jaunes
                </Label>
                <Input
                  value={config?.pagesJaunesUrl || ""}
                  onChange={(e) => handleSaveSettings("pagesJaunesUrl", e.target.value)}
                  placeholder="https://pagesjaunes.fr/..."
                  className="text-xs h-8"
                  data-testid="input-pagesjaunes-url"
                />
              </div>

              <div className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors">
                <Label className="flex items-center gap-2 text-xs font-medium mb-2">
                  <Globe className="h-3.5 w-3.5 text-blue-400" />
                  Doctolib
                </Label>
                <Input
                  value={config?.doctolibUrl || ""}
                  onChange={(e) => handleSaveSettings("doctolibUrl", e.target.value)}
                  placeholder="https://doctolib.fr/..."
                  className="text-xs h-8"
                  data-testid="input-doctolib-url"
                />
              </div>

              <div className="p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors">
                <Label className="flex items-center gap-2 text-xs font-medium mb-2">
                  <Globe className="h-3.5 w-3.5 text-[#00665C]" />
                  TheFork
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.theForkUrl || ""}
                    onChange={(e) => handleSaveSettings("theForkUrl", e.target.value)}
                    placeholder="https://thefork.fr/..."
                    className="text-xs h-8"
                    data-testid="input-thefork-url"
                  />
                  {config?.theForkUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={config.theForkUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/40 bg-muted/20">
              <Label className="flex items-center gap-2 text-xs font-medium mb-3">
                <Settings className="h-3.5 w-3.5 text-[#C8B88A]" />
                Valeur moyenne d'un client (€)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={Math.round((config?.averageClientValue || 0) / 100)}
                  onBlur={(e) => {
                    const euros = parseInt(e.target.value || "0", 10);
                    const centimes = euros * 100;
                    if (centimes !== (config?.averageClientValue || 0)) {
                      handleSaveSettings("averageClientValue", centimes);
                    }
                  }}
                  placeholder="50"
                  className="text-sm h-9 max-w-[120px]"
                  data-testid="input-average-client-value"
                />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Utilisé pour estimer le revenu généré par vos avis
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

      {/* AI Response Settings */}
      <Collapsible open={aiResponseOpen} onOpenChange={setAiResponseOpen}>
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                      <Settings className="h-4 w-4 text-[#C8B88A]" />
                    </div>
                    Réponses IA automatiques
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Générez automatiquement des suggestions de réponses aux avis
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {config?.aiResponseEnabled && (
                    <Badge className="bg-[#4CEFAD]/10 text-[#4CEFAD] border-[#4CEFAD]/20 text-[10px]">
                      Activé
                    </Badge>
                  )}
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${aiResponseOpen ? "rotate-180" : ""}`} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#C8B88A]/10">
                <Settings className="h-4 w-4 text-[#C8B88A]" />
              </div>
              <div>
                <p className="text-sm font-medium">Activer les réponses IA</p>
                <p className="text-xs text-muted-foreground">Génère des suggestions de réponse pour chaque avis</p>
              </div>
            </div>
            <Switch
              checked={config?.aiResponseEnabled || false}
              onCheckedChange={(value) => handleSaveSettings("aiResponseEnabled", value)}
              data-testid="switch-ai-response-enabled"
            />
          </div>

          {config?.aiResponseEnabled && (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Settings className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Génération automatique</p>
                    <p className="text-xs text-muted-foreground">Génère les réponses lors de la synchronisation</p>
                  </div>
                </div>
                <Switch
                  checked={config?.aiAutoGenerate || false}
                  onCheckedChange={(value) => handleSaveSettings("aiAutoGenerate", value)}
                  data-testid="switch-ai-auto-generate"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ton des réponses</Label>
                  <Select
                    value={config?.aiResponseTone || "professional"}
                    onValueChange={(value) => handleSaveSettings("aiResponseTone", value)}
                    data-testid="select-ai-tone"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professionnel</SelectItem>
                      <SelectItem value="friendly">Amical</SelectItem>
                      <SelectItem value="formal">Formel</SelectItem>
                      <SelectItem value="casual">Décontracté</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Langue</Label>
                  <Select
                    value={config?.aiResponseLanguage || "fr"}
                    onValueChange={(value) => handleSaveSettings("aiResponseLanguage", value)}
                    data-testid="select-ai-language"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">Anglais</SelectItem>
                      <SelectItem value="es">Espagnol</SelectItem>
                      <SelectItem value="de">Allemand</SelectItem>
                      <SelectItem value="it">Italien</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Longueur max des réponses</Label>
                <Select
                  value={String(config?.aiMaxLength || 300)}
                  onValueChange={(value) => handleSaveSettings("aiMaxLength", parseInt(value))}
                  data-testid="select-ai-max-length"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="150">Court (150 car.)</SelectItem>
                    <SelectItem value="300">Moyen (300 car.)</SelectItem>
                    <SelectItem value="500">Long (500 car.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#4CEFAD]/10">
                    <MessageSquare className="h-4 w-4 text-[#4CEFAD]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Inclure le nom de l'entreprise</p>
                    <p className="text-xs text-muted-foreground">Personnalise les réponses avec votre marque</p>
                  </div>
                </div>
                <Switch
                  checked={config?.aiIncludeCompanyName || false}
                  onCheckedChange={(value) => handleSaveSettings("aiIncludeCompanyName", value)}
                  data-testid="switch-ai-include-company"
                />
              </div>
            </>
          )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <PlatformConnectionsSection />
      <AutomationsSection />
    </div>
  );
}
