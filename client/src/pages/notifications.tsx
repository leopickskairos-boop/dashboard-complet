import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Check, Trash2, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

type NotificationType = 
  | 'daily_summary'
  | 'failed_calls'
  | 'active_call'
  | 'password_changed'
  | 'payment_updated'
  | 'subscription_renewed'
  | 'subscription_created'
  | 'subscription_expired'
  | 'subscription_expiring_soon'
  | 'monthly_report_ready'
  | 'review_received'
  | 'review_negative'
  | 'campaign_sent'
  | 'automation_triggered'
  | 'guarantee_noshow_charged'
  | 'guarantee_card_validated'
  | 'integration_sync_complete'
  | 'integration_error';

type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata: string | null;
  createdAt: Date;
};

const notificationTypeLabels: Record<NotificationType, string> = {
  daily_summary: "Résumé quotidien",
  failed_calls: "Appel échoué",
  active_call: "Appel en cours",
  password_changed: "Mot de passe modifié",
  payment_updated: "Paiement mis à jour",
  subscription_renewed: "Abonnement renouvelé",
  subscription_created: "Abonnement créé",
  subscription_expired: "Abonnement expiré",
  subscription_expiring_soon: "Abonnement bientôt expiré",
  monthly_report_ready: "Rapport mensuel",
  review_received: "Nouvel avis",
  review_negative: "Avis négatif",
  campaign_sent: "Campagne envoyée",
  automation_triggered: "Automatisation déclenchée",
  guarantee_noshow_charged: "No-show facturé",
  guarantee_card_validated: "Carte validée",
  integration_sync_complete: "Synchronisation terminée",
  integration_error: "Erreur d'intégration",
};

const notificationTypeVariants: Record<NotificationType, "default" | "secondary" | "destructive"> = {
  daily_summary: "default",
  failed_calls: "destructive",
  active_call: "default",
  password_changed: "secondary",
  payment_updated: "secondary",
  subscription_renewed: "default",
  subscription_created: "default",
  subscription_expired: "destructive",
  subscription_expiring_soon: "destructive",
  monthly_report_ready: "default",
  review_received: "default",
  review_negative: "destructive",
  campaign_sent: "default",
  automation_triggered: "secondary",
  guarantee_noshow_charged: "destructive",
  guarantee_card_validated: "default",
  integration_sync_complete: "default",
  integration_error: "destructive",
};

export default function Notifications() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<string>("week");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");

  // Build query string based on filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (timeFilter !== 'all') params.append('timeFilter', timeFilter);
    if (typeFilter !== 'all') params.append('typeFilter', typeFilter);
    if (readFilter !== 'all') params.append('isRead', readFilter);
    return params.toString();
  };

  const queryString = buildQueryString();
  const queryKey = queryString 
    ? `/api/notifications?${queryString}` 
    : '/api/notifications';

  const { data: notificationsData, isLoading } = useQuery<{ notifications: Notification[] } | Notification[]>({
    queryKey: [queryKey],
  });
  const notifications = Array.isArray(notificationsData) ? notificationsData : (notificationsData?.notifications || []);

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/notifications/${id}/read`, 'PATCH', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/notifications');
        }
      });
      toast({ description: "Notification marquée comme lue" });
    },
    onError: () => {
      toast({ 
        variant: "destructive", 
        description: "Erreur lors de la mise à jour" 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/notifications/${id}`, 'DELETE', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/notifications');
        }
      });
      toast({ description: "Notification supprimée" });
    },
    onError: () => {
      toast({ 
        variant: "destructive", 
        description: "Erreur lors de la suppression" 
      });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/notifications/mark-all-read', 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/notifications');
        }
      });
      toast({ description: "Toutes les notifications ont été marquées comme lues" });
    },
    onError: () => {
      toast({ 
        variant: "destructive", 
        description: "Erreur lors de la mise à jour" 
      });
    }
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold" data-testid="text-page-title">Notifications</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-0.5 md:mt-1">
            Gérez vos notifications
          </p>
        </div>
        {notifications.some(n => !n.isRead) && (
          <Button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            data-testid="button-mark-all-read"
            size="sm"
            className="w-full md:w-auto"
          >
            <Check className="h-4 w-4 mr-2" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      <Card>
        <Collapsible open={isMobile ? filtersOpen : true} onOpenChange={setFiltersOpen}>
          <CardHeader className="p-4 md:p-6">
            {isMobile ? (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <CardTitle className="text-base">Filtres</CardTitle>
                  </div>
                  {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            ) : (
              <>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Filter className="h-5 w-5" />
                  Filtres
                </CardTitle>
                <CardDescription className="text-sm">
                  Affinez vos notifications selon vos critères
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Période</label>
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger data-testid="select-time-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Aujourd'hui</SelectItem>
                      <SelectItem value="two_days">2 derniers jours</SelectItem>
                      <SelectItem value="three_days">3 derniers jours</SelectItem>
                      <SelectItem value="week">7 derniers jours</SelectItem>
                      <SelectItem value="month">30 derniers jours</SelectItem>
                      <SelectItem value="all">Toutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger data-testid="select-type-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous types</SelectItem>
                      <SelectItem value="daily_summary">Résumés quotidiens</SelectItem>
                      <SelectItem value="failed_calls">Appels échoués</SelectItem>
                      <SelectItem value="active_call">Appels actifs</SelectItem>
                      <SelectItem value="password_changed">Changements mot de passe</SelectItem>
                      <SelectItem value="payment_updated">Mises à jour paiement</SelectItem>
                      <SelectItem value="subscription_renewed">Renouvellements</SelectItem>
                      <SelectItem value="subscription_created">Nouveaux abonnements</SelectItem>
                      <SelectItem value="subscription_expired">Abonnements expirés</SelectItem>
                      <SelectItem value="subscription_expiring_soon">Expirations proches</SelectItem>
                      <SelectItem value="monthly_report_ready">Rapports mensuels</SelectItem>
                      <SelectItem value="review_received">Avis reçus</SelectItem>
                      <SelectItem value="review_negative">Avis négatifs</SelectItem>
                      <SelectItem value="campaign_sent">Campagnes envoyées</SelectItem>
                      <SelectItem value="automation_triggered">Automatisations</SelectItem>
                      <SelectItem value="guarantee_noshow_charged">No-shows facturés</SelectItem>
                      <SelectItem value="guarantee_card_validated">Cartes validées</SelectItem>
                      <SelectItem value="integration_sync_complete">Synchros terminées</SelectItem>
                      <SelectItem value="integration_error">Erreurs intégration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Statut</label>
                  <Select value={readFilter} onValueChange={setReadFilter}>
                    <SelectTrigger data-testid="select-read-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      <SelectItem value="false">Non lues uniquement</SelectItem>
                      <SelectItem value="true">Lues uniquement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Chargement des notifications...
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-notifications">
              Aucune notification trouvée
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 md:space-y-3">
          {notifications.map((notification) => (
            <Card 
              key={notification.id}
              className={notification.isRead ? "opacity-60" : ""}
              data-testid={`notification-${notification.id}`}
            >
              <CardContent className="p-3 md:p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant={notificationTypeVariants[notification.type]}
                            data-testid={`badge-type-${notification.type}`}
                          >
                            {notificationTypeLabels[notification.type]}
                          </Badge>
                          {!notification.isRead && (
                            <Badge variant="default" data-testid="badge-unread">
                              Non lu
                            </Badge>
                          )}
                        </div>
                        <h3 
                          className="font-semibold text-lg" 
                          data-testid={`text-title-${notification.id}`}
                        >
                          {notification.title}
                        </h3>
                        <p 
                          className="text-muted-foreground mt-1" 
                          data-testid={`text-message-${notification.id}`}
                        >
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.createdAt).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!notification.isRead && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            disabled={markAsReadMutation.isPending}
                            data-testid={`button-mark-read-${notification.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(notification.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${notification.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
