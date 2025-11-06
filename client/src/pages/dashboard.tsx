import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  Clock, 
  TrendingUp, 
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  PhoneOff,
  TrendingDown,
  Loader2,
  Eye
} from "lucide-react";
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, BarChart } from "recharts";
import type { Call } from "@shared/schema";

// Status badge variants with icons
const statusConfig = {
  completed: { label: "Rendez-vous pris", icon: CheckCircle2, variant: "default" as const },
  failed: { label: "Appel échoué", icon: XCircle, variant: "destructive" as const },
  canceled: { label: "Annulé", icon: Ban, variant: "secondary" as const },
  no_answer: { label: "Aucun aboutissement", icon: PhoneOff, variant: "outline" as const },
  active: { label: "Appel actif", icon: Activity, variant: "default" as const },
};

// Time filter options
const timeFilterOptions = [
  { value: "hour", label: "Il y a 1h" },
  { value: "today", label: "Aujourd'hui" },
  { value: "two_days", label: "Il y a 2 jours" },
  { value: "week", label: "Cette semaine" },
];

// Status filter options
const statusFilterOptions = [
  { value: "all", label: "Tous les statuts" },
  { value: "completed", label: "Rendez-vous pris" },
  { value: "canceled", label: "Annulé" },
  { value: "no_answer", label: "Aucun aboutissement" },
  { value: "failed", label: "Appel échoué" },
  { value: "active", label: "Appel actif" },
];

export default function Dashboard() {
  const [globalTimeFilter, setGlobalTimeFilter] = useState<string>("all");
  const [callsTimeFilter, setCallsTimeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [chartDialog, setChartDialog] = useState<'total' | 'conversion' | 'duration' | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch stats with global time filter
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalCalls: number;
    activeCalls: number;
    conversionRate: number;
    averageDuration: number;
  }>({
    queryKey: ['/api/calls/stats', globalTimeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (globalTimeFilter && globalTimeFilter !== 'all') params.set('timeFilter', globalTimeFilter);
      const res = await fetch(`/api/calls/stats?${params}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  // Fetch calls with filters
  const { data: calls = [], isLoading: callsLoading } = useQuery<Call[]>({
    queryKey: ['/api/calls', callsTimeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (callsTimeFilter && callsTimeFilter !== 'all') params.set('timeFilter', callsTimeFilter);
      if (statusFilter && statusFilter !== 'all') params.set('statusFilter', statusFilter);
      const res = await fetch(`/api/calls?${params}`);
      if (!res.ok) throw new Error('Failed to fetch calls');
      return res.json();
    },
  });

  // Fetch chart data with global time filter
  const { data: chartData = [], isLoading: chartLoading } = useQuery<{
    date: string;
    totalCalls: number;
    completedCalls: number;
    averageDuration: number;
  }[]>({
    queryKey: ['/api/calls/chart-data', globalTimeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (globalTimeFilter && globalTimeFilter !== 'all') params.set('timeFilter', globalTimeFilter);
      const res = await fetch(`/api/calls/chart-data?${params}`);
      if (!res.ok) throw new Error('Failed to fetch chart data');
      return res.json();
    },
  });

  // Format duration from seconds to readable format
  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Prepare chart data for different metrics
  const totalCallsChartData = chartData.map(d => ({
    name: format(new Date(d.date), 'dd MMM', { locale: fr }),
    value: d.totalCalls,
  }));

  const conversionRateChartData = chartData.map(d => ({
    name: format(new Date(d.date), 'dd MMM', { locale: fr }),
    value: d.totalCalls > 0 ? Math.round((d.completedCalls / d.totalCalls) * 100) : 0,
  }));

  const averageDurationChartData = chartData.map(d => ({
    name: format(new Date(d.date), 'dd MMM', { locale: fr }),
    value: d.averageDuration,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de votre activité
          </p>
        </div>

        {/* Global Time Filter */}
        <div className="mb-6 flex items-center gap-4">
          <span className="text-sm font-medium">Période :</span>
          <Select value={globalTimeFilter} onValueChange={setGlobalTimeFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-global-time-filter">
              <SelectValue placeholder="Toutes les périodes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les périodes</SelectItem>
              {timeFilterOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards Grid */}
        {statsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Total Calls - Clickable */}
            <Card 
              className="hover-elevate cursor-pointer transition-all" 
              onClick={() => setChartDialog('total')}
              data-testid="card-total-calls"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white neon-cyan" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Total des appels
                </div>
                <div className="text-3xl font-bold mb-1" data-testid="stat-total-calls">
                  {stats?.totalCalls || 0}
                </div>
                <p className="text-xs text-green-400">+12% vs période précédente</p>
              </CardContent>
            </Card>

            {/* Active Calls - Not Clickable */}
            <Card data-testid="card-active-calls">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white neon-violet" />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Appels actifs
                </div>
                <div className="text-3xl font-bold" data-testid="stat-active-calls">
                  {stats?.activeCalls || 0}
                </div>
                <p className="text-xs text-muted-foreground">En cours maintenant</p>
              </CardContent>
            </Card>

            {/* Conversion Rate - Clickable */}
            <Card 
              className="hover-elevate cursor-pointer transition-all" 
              onClick={() => setChartDialog('conversion')}
              data-testid="card-conversion-rate"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white neon-green" />
                  </div>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Taux de conversion
                </div>
                <div className="text-3xl font-bold mb-1" data-testid="stat-conversion-rate">
                  {stats?.conversionRate || 0}%
                </div>
                <p className="text-xs text-red-400">-3% vs période précédente</p>
              </CardContent>
            </Card>

            {/* Average Duration - Clickable */}
            <Card 
              className="hover-elevate cursor-pointer transition-all" 
              onClick={() => setChartDialog('duration')}
              data-testid="card-average-duration"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white neon-turquoise" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Durée moyenne
                </div>
                <div className="text-3xl font-bold mb-1" data-testid="stat-average-duration">
                  {formatDuration(stats?.averageDuration)}
                </div>
                <p className="text-xs text-green-400">+8% vs période précédente</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Calls List Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Liste des appels</CardTitle>
                <CardDescription>
                  Historique de tous vos appels enregistrés
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={callsTimeFilter} onValueChange={setCallsTimeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-calls-time-filter">
                    <SelectValue placeholder="Toutes les périodes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les périodes</SelectItem>
                    {timeFilterOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusFilterOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {callsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : calls.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun appel trouvé pour ces filtres</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Date & Heure
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Téléphone
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Durée
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Statut
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => {
                      const config = statusConfig[call.status as keyof typeof statusConfig];
                      const StatusIcon = config?.icon || Phone;
                      
                      const handleRowClick = (e: React.MouseEvent) => {
                        // Only handle row click on mobile and not when clicking the button
                        if (isMobile && !(e.target as HTMLElement).closest('button')) {
                          setSelectedCall(call);
                        }
                      };
                      
                      return (
                        <tr 
                          key={call.id} 
                          className={`border-b hover-elevate active-elevate-2 transition-all ${isMobile ? 'cursor-pointer' : ''}`}
                          onClick={handleRowClick}
                          data-testid={`call-row-${call.id}`}
                        >
                          <td className="py-4 px-4">
                            <div className="text-sm font-medium">
                              {format(new Date(call.startTime), 'dd MMM yyyy', { locale: fr })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(call.startTime), 'HH:mm', { locale: fr })}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm font-mono">{call.phoneNumber}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">{formatDuration(call.duration)}</div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant={config?.variant || "outline"} className="gap-1">
                              <StatusIcon className="w-3 h-3" />
                              {config?.label || call.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCall(call);
                              }}
                              className={isMobile ? 'hidden' : ''}
                              data-testid={`button-view-call-${call.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Détail
                            </Button>
                            {isMobile && (
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Detail Dialog */}
        <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
          <DialogContent className="max-w-2xl" data-testid="dialog-call-detail">
            <DialogHeader>
              <DialogTitle>Détail de l'appel</DialogTitle>
              <DialogDescription>
                Informations complètes sur cet appel
              </DialogDescription>
            </DialogHeader>
            {selectedCall && (console.log('Selected Call Data:', selectedCall),
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Téléphone
                    </div>
                    <div className="text-sm font-mono">{selectedCall.phoneNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Statut
                    </div>
                    {(() => {
                      const config = statusConfig[selectedCall.status as keyof typeof statusConfig];
                      const StatusIcon = config?.icon || Phone;
                      return (
                        <Badge variant={config?.variant || "outline"} className="gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {config?.label || selectedCall.status}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Début d'appel
                    </div>
                    <div className="text-sm">
                      {format(new Date(selectedCall.startTime), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Fin d'appel
                    </div>
                    <div className="text-sm">
                      {selectedCall.endTime 
                        ? format(new Date(selectedCall.endTime), "dd MMMM yyyy 'à' HH:mm", { locale: fr })
                        : "En cours"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Durée
                  </div>
                  <div className="text-sm">{formatDuration(selectedCall.duration)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Email de confirmation envoyé
                  </div>
                  <div className="text-sm">
                    {selectedCall.emailSent ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Oui
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="w-3 h-3" />
                        Non
                      </Badge>
                    )}
                  </div>
                </div>

                {selectedCall.summary && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Résumé de l'appel
                    </div>
                    <div className="text-sm bg-muted p-4 rounded-lg">
                      {selectedCall.summary}
                    </div>
                  </div>
                )}

                {/* Date du rendez-vous - Uniquement pour les appels avec statut "completed" */}
                {selectedCall.status === 'completed' && selectedCall.appointmentDate && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                          📅 Date du rendez-vous
                        </div>
                        <div className="text-base font-semibold">
                          {format(new Date(selectedCall.appointmentDate), "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Rendez-vous confirmé
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    ID de référence
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">{selectedCall.id}</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Chart Dialogs */}
        <Dialog open={chartDialog === 'total'} onOpenChange={() => setChartDialog(null)}>
          <DialogContent className="max-w-3xl" data-testid="dialog-chart-total">
            <DialogHeader>
              <DialogTitle>Total des appels</DialogTitle>
              <DialogDescription>
                Évolution du nombre d'appels au fil du temps
              </DialogDescription>
            </DialogHeader>
            {chartLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="h-[300px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={totalCallsChartData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={chartDialog === 'conversion'} onOpenChange={() => setChartDialog(null)}>
          <DialogContent className="max-w-3xl" data-testid="dialog-chart-conversion">
            <DialogHeader>
              <DialogTitle>Taux de conversion</DialogTitle>
              <DialogDescription>
                Évolution du taux de conversion au fil du temps (%)
              </DialogDescription>
            </DialogHeader>
            {chartLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="h-[300px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionRateChartData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={chartDialog === 'duration'} onOpenChange={() => setChartDialog(null)}>
          <DialogContent className="max-w-3xl" data-testid="dialog-chart-duration">
            <DialogHeader>
              <DialogTitle>Durée moyenne des appels</DialogTitle>
              <DialogDescription>
                Évolution de la durée moyenne au fil du temps (en secondes)
              </DialogDescription>
            </DialogHeader>
            {chartLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="h-[300px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={averageDurationChartData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
