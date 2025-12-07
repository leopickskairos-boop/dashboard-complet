import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings, Clock, MessageSquare, Globe, Loader2, Save, ExternalLink, AlertCircle, Gift, Plus, Trash2, Star, Percent, Coffee, Tag } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";
import type { ReviewConfig, ReviewIncentive } from "@shared/schema";

const INCENTIVE_TYPES = [
  { value: "percentage", label: "Réduction (%)", icon: Percent },
  { value: "amount", label: "Réduction (€)", icon: Tag },
  { value: "free_item", label: "Offert gratuit", icon: Coffee },
  { value: "loyalty_points", label: "Points fidélité", icon: Star },
  { value: "other", label: "Autre", icon: Gift },
];

export default function ReviewsSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showNewIncentiveDialog, setShowNewIncentiveDialog] = useState(false);
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
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-card/50 border border-border/50">
          <span className="text-sm text-muted-foreground">Système activé</span>
          <Switch
            checked={config?.enabled || false}
            onCheckedChange={handleToggleEnabled}
            data-testid="switch-reviews-enabled"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
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

        <Card className="border-border/50 bg-card/50">
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
                value={config?.smsMessage || ""}
                onChange={(e) => handleSaveSettings("smsMessage", e.target.value)}
                placeholder="Merci de votre visite ! Partagez votre expérience avec nous..."
                maxLength={160}
                className="resize-none"
                data-testid="textarea-sms-message"
              />
              <p className="text-xs text-muted-foreground">
                {(config?.smsMessage?.length || 0)}/160 caractères
              </p>
            </div>

            <div className="space-y-2">
              <Label>Objet de l'email</Label>
              <Input
                value={config?.emailSubject || ""}
                onChange={(e) => handleSaveSettings("emailSubject", e.target.value)}
                placeholder="Partagez votre expérience avec nous !"
                data-testid="input-email-subject"
              />
            </div>

            <div className="space-y-2">
              <Label>Corps de l'email (HTML)</Label>
              <Textarea
                value={config?.emailMessage || ""}
                onChange={(e) => handleSaveSettings("emailMessage", e.target.value)}
                placeholder="<p>Bonjour {nom},</p><p>Merci de votre visite...</p>"
                className="min-h-[100px] resize-none font-mono text-sm"
                data-testid="textarea-email-message"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-border/50 bg-card/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                <Gift className="h-4 w-4 text-[#C8B88A]" />
              </div>
              Offres incitatives
            </CardTitle>
            <CardDescription className="text-xs">
              Encouragez vos clients à laisser un avis avec des récompenses attractives
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
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

            <div className="mt-3 p-3 bg-muted/30 rounded-xl border border-border/30">
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

        <Card className="md:col-span-2 border-border/50 bg-card/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                <Globe className="h-4 w-4 text-[#C8B88A]" />
              </div>
              Liens vers les plateformes
            </CardTitle>
            <CardDescription className="text-xs">
              Redirigez vos clients vers vos profils d'avis en ligne
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
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
            </div>

            <div className="mt-4 p-3 bg-muted/30 rounded-xl border border-border/30">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground/80">Connexions API (bientôt)</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Synchronisation automatique avec Google Business Profile et Facebook pour récupérer vos avis en temps réel.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
