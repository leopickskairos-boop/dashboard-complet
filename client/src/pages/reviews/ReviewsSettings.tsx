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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings, Clock, MessageSquare, Globe, Loader2, Save, ExternalLink, AlertCircle } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";
import type { ReviewConfig } from "@shared/schema";

export default function ReviewsSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const { data: config, isLoading } = useQuery<ReviewConfig>({
    queryKey: ["/api/reviews/config"],
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

  const handleToggleEnabled = (enabled: boolean) => {
    updateMutation.mutate({ enabled });
  };

  const handleSaveSettings = (field: string, value: any) => {
    setIsSaving(true);
    updateMutation.mutate({ [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuration des Avis</h1>
          <p className="text-muted-foreground">Gérez vos paramètres de collecte d'avis</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Système activé</span>
          <Switch
            checked={config?.enabled || false}
            onCheckedChange={handleToggleEnabled}
            data-testid="switch-reviews-enabled"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#C8B88A]" />
              Timing d'envoi
            </CardTitle>
            <CardDescription>
              Configurez quand envoyer les demandes d'avis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#C8B88A]" />
              Messages personnalisés
            </CardTitle>
            <CardDescription>
              Personnalisez vos messages d'invitation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#C8B88A]" />
              Liens vers les plateformes
            </CardTitle>
            <CardDescription>
              Configurez les liens directs vers vos pages d'avis sur chaque plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <SiGoogle className="h-4 w-4 text-red-500" />
                  Google Business
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.googleReviewUrl || ""}
                    onChange={(e) => handleSaveSettings("googleReviewUrl", e.target.value)}
                    placeholder="https://g.page/r/votre-etablissement/review"
                    data-testid="input-google-url"
                  />
                  {config?.googleReviewUrl && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={config.googleReviewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <SiTripadvisor className="h-4 w-4 text-green-600" />
                  TripAdvisor
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.tripadvisorUrl || ""}
                    onChange={(e) => handleSaveSettings("tripadvisorUrl", e.target.value)}
                    placeholder="https://www.tripadvisor.com/..."
                    data-testid="input-tripadvisor-url"
                  />
                  {config?.tripadvisorUrl && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={config.tripadvisorUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <SiFacebook className="h-4 w-4 text-blue-600" />
                  Facebook
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.facebookPageUrl || ""}
                    onChange={(e) => handleSaveSettings("facebookPageUrl", e.target.value)}
                    placeholder="https://www.facebook.com/votre-page/reviews"
                    data-testid="input-facebook-url"
                  />
                  {config?.facebookPageUrl && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={config.facebookPageUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <SiYelp className="h-4 w-4 text-red-600" />
                  Yelp
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={config?.yelpUrl || ""}
                    onChange={(e) => handleSaveSettings("yelpUrl", e.target.value)}
                    placeholder="https://www.yelp.com/biz/..."
                    data-testid="input-yelp-url"
                  />
                  {config?.yelpUrl && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={config.yelpUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-yellow-600" />
                  Pages Jaunes
                </Label>
                <Input
                  value={config?.pagesJaunesUrl || ""}
                  onChange={(e) => handleSaveSettings("pagesJaunesUrl", e.target.value)}
                  placeholder="https://www.pagesjaunes.fr/..."
                  data-testid="input-pagesjaunes-url"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-400" />
                  Doctolib
                </Label>
                <Input
                  value={config?.doctolibUrl || ""}
                  onChange={(e) => handleSaveSettings("doctolibUrl", e.target.value)}
                  placeholder="https://www.doctolib.fr/..."
                  data-testid="input-doctolib-url"
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Connexions API (bientôt disponible)</p>
                  <p className="text-sm text-muted-foreground">
                    La synchronisation automatique avec Google Business Profile et Facebook sera disponible prochainement 
                    pour récupérer vos avis en temps réel.
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
