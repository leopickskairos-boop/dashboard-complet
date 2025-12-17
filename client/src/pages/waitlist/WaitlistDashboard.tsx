import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Calendar,
  Phone,
  Mail,
  Trash2,
  RefreshCw,
  TrendingUp,
  ListOrdered,
  Timer,
  Settings,
  Link2,
  Link2Off,
  ExternalLink
} from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CalendarConfig {
  id: string;
  googleCalendarId?: string;
  googleCalendarName?: string;
  isConnected: boolean;
  lastSyncAt?: string;
}

interface WaitlistSlot {
  id: string;
  slotStart: string;
  slotEnd?: string;
  status: 'pending' | 'monitoring' | 'available' | 'filled' | 'expired' | 'cancelled';
  businessName?: string;
  checkIntervalMinutes?: number;
  lastCheckAt?: string;
  nextCheckAt?: string;
  createdAt: string;
}

interface WaitlistEntry {
  id: string;
  slotId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  requestedSlot: string;
  alternativeSlots?: string[];
  nbPersons: number;
  status: 'pending' | 'notified' | 'confirmed' | 'declined' | 'expired' | 'cancelled';
  priority: number;
  notifiedAt?: string;
  confirmedAt?: string;
  source: string;
  createdAt: string;
  slot?: WaitlistSlot;
}

interface WaitlistStats {
  totalEntries: number;
  pendingEntries: number;
  confirmedEntries: number;
  activeSlots: number;
  conversionRate: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  notified: 'Notifié',
  confirmed: 'Confirmé',
  declined: 'Décliné',
  expired: 'Expiré',
  cancelled: 'Annulé',
  monitoring: 'Surveillance',
  available: 'Disponible',
  filled: 'Rempli'
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  notified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  declined: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  monitoring: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  filled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
};

export default function WaitlistDashboard() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const { data: statsData } = useQuery<{ success: boolean; stats: WaitlistStats }>({
    queryKey: ['/api/waitlist/stats'],
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery<{ success: boolean; entries: WaitlistEntry[] }>({
    queryKey: ['/api/waitlist/entries'],
  });

  const { data: slotsData, isLoading: slotsLoading } = useQuery<{ success: boolean; slots: WaitlistSlot[] }>({
    queryKey: ['/api/waitlist/slots'],
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery<{ success: boolean; config: CalendarConfig | null }>({
    queryKey: ['/api/waitlist/calendar/config'],
  });

  const disconnectCalendarMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/waitlist/calendar/disconnect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist/calendar'] });
      toast({ title: 'Google Calendar déconnecté' });
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de déconnecter le calendrier', variant: 'destructive' });
    }
  });

  const handleConnectCalendar = async () => {
    try {
      const response = await fetch('/api/waitlist/calendar/oauth/google/start', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.oauthUrl) {
        window.location.href = data.oauthUrl;
      } else {
        toast({ title: 'Erreur', description: 'Impossible de démarrer la connexion', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur de connexion', variant: 'destructive' });
    }
  };

  const cancelMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await apiRequest('POST', `/api/waitlist/entries/${entryId}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist'] });
      toast({ title: 'Entrée annulée' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await apiRequest('DELETE', `/api/waitlist/entries/${entryId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist'] });
      toast({ title: 'Entrée supprimée' });
    },
  });

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const stats = statsData?.stats;
  const entries = entriesData?.entries || [];
  const slots = slotsData?.slots || [];

  const filteredEntries = entries.filter(entry => {
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
    if (dateFilter === 'today') {
      const today = new Date();
      const slotDate = new Date(entry.requestedSlot);
      if (slotDate.toDateString() !== today.toDateString()) return false;
    } else if (dateFilter === 'week') {
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const slotDate = new Date(entry.requestedSlot);
      if (slotDate > weekFromNow) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Liste d'attente</h1>
          <p className="text-muted-foreground">Gérez les demandes de créneaux en attente</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/waitlist'] })}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-total">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalEntries || 0}</p>
                <p className="text-sm text-muted-foreground">Total demandes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-pending">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pendingEntries || 0}</p>
                <p className="text-sm text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-confirmed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.confirmedEntries || 0}</p>
                <p className="text-sm text-muted-foreground">Confirmées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-conversion">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.conversionRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Taux conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries" data-testid="tab-entries">
            <ListOrdered className="h-4 w-4 mr-2" />
            Demandes ({entries.length})
          </TabsTrigger>
          <TabsTrigger value="slots" data-testid="tab-slots">
            <Timer className="h-4 w-4 mr-2" />
            Créneaux surveillés ({slots.filter(s => s.status === 'monitoring').length})
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-2" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="filter-status">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="notified">Notifié</SelectItem>
                <SelectItem value="confirmed">Confirmé</SelectItem>
                <SelectItem value="declined">Décliné</SelectItem>
                <SelectItem value="expired">Expiré</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px]" data-testid="filter-date">
                <SelectValue placeholder="Filtrer par date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les dates</SelectItem>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {entriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune demande de liste d'attente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <Card key={entry.id} data-testid={`entry-${entry.id}`}>
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold">
                          #{entry.priority}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{entry.firstName} {entry.lastName}</p>
                            <Badge className={STATUS_COLORS[entry.status]}>
                              {STATUS_LABELS[entry.status]}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {entry.phone}
                            </span>
                            {entry.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {entry.email}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>{formatDate(entry.requestedSlot)}</span>
                            <span className="text-muted-foreground">•</span>
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span>{entry.nbPersons} pers.</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-14 md:ml-0">
                        {entry.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelMutation.mutate(entry.id)}
                            disabled={cancelMutation.isPending}
                            data-testid={`cancel-entry-${entry.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Annuler
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(entry.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`delete-entry-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="slots" className="space-y-4">
          {slotsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Timer className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun créneau surveillé</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => (
                <Card key={slot.id} data-testid={`slot-${slot.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {formatDate(slot.slotStart)}
                      </CardTitle>
                      <Badge className={STATUS_COLORS[slot.status]}>
                        {STATUS_LABELS[slot.status]}
                      </Badge>
                    </div>
                    {slot.businessName && (
                      <CardDescription>{slot.businessName}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {slot.status === 'monitoring' && (
                      <>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Vérification toutes les {slot.checkIntervalMinutes} min
                        </div>
                        {slot.nextCheckAt && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Timer className="h-3 w-3" />
                            Prochaine: {formatDateTime(slot.nextCheckAt)}
                          </div>
                        )}
                      </>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Créé le {formatDateTime(slot.createdAt)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SiGoogle className="h-5 w-5" />
                Connexion Google Calendar
              </CardTitle>
              <CardDescription>
                Connectez votre Google Calendar pour détecter automatiquement les créneaux libérés
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {calendarLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : calendarData?.config?.isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900">
                    <Link2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <p className="font-medium text-green-800 dark:text-green-300">Calendrier connecté</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {calendarData.config.googleCalendarName || 'Calendrier principal'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectCalendarMutation.mutate()}
                      disabled={disconnectCalendarMutation.isPending}
                      data-testid="button-disconnect-calendar"
                    >
                      <Link2Off className="h-4 w-4 mr-2" />
                      Déconnecter
                    </Button>
                  </div>
                  {calendarData.config.lastSyncAt && (
                    <p className="text-sm text-muted-foreground">
                      Dernière vérification : {formatDateTime(calendarData.config.lastSyncAt)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                    <Link2Off className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Aucun calendrier connecté</p>
                      <p className="text-sm text-muted-foreground">
                        Connectez Google Calendar pour la surveillance automatique des créneaux
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleConnectCalendar}
                    className="gap-2"
                    data-testid="button-connect-calendar"
                  >
                    <SiGoogle className="h-4 w-4" />
                    Connecter Google Calendar
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fonctionnement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                    Demande client
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    Le client demande un créneau indisponible via l'agent vocal
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
                    SMS d'inscription
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    Le client reçoit un SMS avec un lien pour s'inscrire sur liste d'attente
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                    Surveillance automatique
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    SpeedAI surveille votre Google Calendar pour détecter les annulations
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">4</span>
                    Notification instantanée
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    Dès qu'une place se libère, le client reçoit un SMS pour confirmer
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
