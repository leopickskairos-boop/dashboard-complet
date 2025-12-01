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
  Eye,
  Calendar,
  Timer,
  Euro,
  Lightbulb,
  BarChart3,
  Brain
} from "lucide-react";
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, BarChart } from "recharts";
import type { Call, PublicUser } from "@shared/schema";
import { TrialCountdown } from "@/components/TrialCountdown";
import { AnalyticsDialog } from "@/components/AnalyticsDialog";

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

// Icon mapping for AI insights
const iconMap: { [key: string]: any } = {
  'lightbulb': Lightbulb,
  'chart': BarChart3,
  'calendar': Calendar,
  'clock': Clock,
  'moon': Activity,
  'trending-up': TrendingUp,
  'target': TrendingUp,
  'brain': Brain,
};

export default function Dashboard() {
  const [globalTimeFilter, setGlobalTimeFilter] = useState<string>("all");
  const [callsTimeFilter, setCallsTimeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [appointmentsOnly, setAppointmentsOnly] = useState<boolean>(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [chartDialog, setChartDialog] = useState<'total' | 'conversion' | 'duration' | null>(null);
  const [analyticsMetric, setAnalyticsMetric] = useState<'volume' | 'conversion' | 'timeslots' | 'duration' | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Fetch current user for trial countdown
  const { data: user } = useQuery<PublicUser>({
    queryKey: ['/api/auth/me'],
  });

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-refresh interval (30 seconds)
  const REFRESH_INTERVAL = 30000;

  // Fetch stats with global time filter - auto-refreshes every 30 seconds
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalCalls: number;
    activeCalls: number;
    conversionRate: number;
    averageDuration: number;
    hoursSaved: number;
    estimatedRevenue: number;
  }>({
    queryKey: ['/api/calls/stats', globalTimeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (globalTimeFilter && globalTimeFilter !== 'all') params.set('timeFilter', globalTimeFilter);
      const res = await fetch(`/api/calls/stats?${params}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // Fetch calls with filters - auto-refreshes every 30 seconds
  const { data: calls = [], isLoading: callsLoading } = useQuery<Call[]>({
    queryKey: ['/api/calls', callsTimeFilter, statusFilter, appointmentsOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (callsTimeFilter && callsTimeFilter !== 'all') params.set('timeFilter', callsTimeFilter);
      if (statusFilter && statusFilter !== 'all') params.set('statusFilter', statusFilter);
      if (appointmentsOnly) params.set('appointmentsOnly', 'true');
      const res = await fetch(`/api/calls?${params}`);
      if (!res.ok) throw new Error('Failed to fetch calls');
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // Fetch chart data with global time filter - auto-refreshes every 30 seconds
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
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // Fetch AI-powered insights based on real call data - auto-refreshes every 60 seconds (less frequent for insights)
  const { data: aiInsights = [], isLoading: insightsLoading } = useQuery<{
    icon: string;
    type: 'performance' | 'business';
    text: string;
    level?: 'good' | 'average' | 'warning';
  }[]>({
    queryKey: ['/api/calls/ai-insights', globalTimeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (globalTimeFilter && globalTimeFilter !== 'all') params.set('timeFilter', globalTimeFilter);
      const res = await fetch(`/api/calls/ai-insights?${params}`);
      if (!res.ok) throw new Error('Failed to fetch AI insights');
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL * 2, // 60 seconds for insights
    refetchIntervalInBackground: false,
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

  // Format hours saved to HHhMM format
  const formatHours = (hours: number | null | undefined) => {
    if (!hours) return "0h00";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return "0 €";
    return `${amount.toLocaleString('fr-FR')} €`;
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

        {/* Trial Countdown Banner */}
        {user && <div className="mb-6"><TrialCountdown user={user} /></div>}

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnalyticsMetric('volume');
                      }}
                      data-testid="button-analyze-volume"
                      className="h-7 px-2 gap-1"
                    >
                      <Brain className="w-3 h-3" />
                      <span className="text-xs">Analyser</span>
                    </Button>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
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
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnalyticsMetric('conversion');
                      }}
                      data-testid="button-analyze-conversion"
                      className="h-7 px-2 gap-1"
                    >
                      <Brain className="w-3 h-3" />
                      <span className="text-xs">Analyser</span>
                    </Button>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  </div>
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
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnalyticsMetric('duration');
                      }}
                      data-testid="button-analyze-duration"
                      className="h-7 px-2 gap-1"
                    >
                      <Brain className="w-3 h-3" />
                      <span className="text-xs">Analyser</span>
                    </Button>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
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

            {/* Hours Saved - Not Clickable */}
            <Card data-testid="card-hours-saved">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                    <Timer className="w-6 h-6 text-white neon-green" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Heures économisées
                </div>
                <div className="text-3xl font-bold mb-1" data-testid="stat-hours-saved">
                  {formatHours(stats?.hoursSaved)}
                </div>
                <p className="text-xs text-green-400">Gagnées ce mois-ci grâce à l'IA</p>
              </CardContent>
            </Card>

            {/* Estimated Revenue - Not Clickable */}
            <Card data-testid="card-estimated-revenue">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                    <Euro className="w-6 h-6 text-white neon-gold" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Revenus estimés
                </div>
                <div className="text-3xl font-bold mb-1" data-testid="stat-estimated-revenue">
                  {formatCurrency(stats?.estimatedRevenue)}
                </div>
                <p className="text-xs text-green-400">Estimés à partir des rendez-vous IA</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Insights & Trends Section */}
        <Card className="mb-12 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border-blue-500/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Insights IA & Tendances</CardTitle>
                <CardDescription>
                  Recommandations intelligentes basées sur vos données réelles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : aiInsights.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune donnée disponible pour générer des insights</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {aiInsights.map((insight, index) => {
                    const Icon = iconMap[insight.icon] || Brain;
                    const levelConfig = {
                      good: { indicator: '🟢', borderClass: 'border-green-500/30', bgClass: 'bg-green-500/5' },
                      average: { indicator: '🟠', borderClass: 'border-orange-500/30', bgClass: 'bg-orange-500/5' },
                      warning: { indicator: '🔴', borderClass: 'border-red-500/30', bgClass: 'bg-red-500/5' },
                    };
                    const config = insight.level ? levelConfig[insight.level as keyof typeof levelConfig] : { indicator: '', borderClass: 'border-border/50', bgClass: 'bg-background/50' };
                    
                    return (
                      <div 
                        key={index}
                        className={`flex gap-4 p-4 rounded-lg ${config.bgClass} border ${config.borderClass} hover-elevate transition-all`}
                        data-testid={`recommendation-${index}`}
                      >
                        <div className="shrink-0">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium mb-1 flex items-center gap-2">
                            {config.indicator && <span>{config.indicator}</span>}
                            <span>{insight.type === 'performance' ? 'Performance' : 'Business'}</span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {insight.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
                <Button
                  variant={appointmentsOnly ? "default" : "outline"}
                  onClick={() => setAppointmentsOnly(!appointmentsOnly)}
                  className="w-full sm:w-auto"
                  data-testid="button-appointments-only"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {appointmentsOnly ? "Tous les appels" : "RDV uniquement"}
                </Button>
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden md:table-cell">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Durée
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Statut
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">
                        Détails RDV
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
                          <td className="py-4 px-4 hidden md:table-cell">
                            {call.eventType ? (
                              <Badge variant="outline" className="text-xs capitalize">
                                {call.eventType === 'reservation' ? 'Réservation' : 
                                 call.eventType === 'information' ? 'Info' :
                                 call.eventType === 'complaint' ? 'Réclamation' :
                                 call.eventType === 'other' ? 'Autre' : call.eventType}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
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
                          <td className="py-4 px-4 hidden lg:table-cell">
                            {(call.status === 'completed' || call.conversionResult === 'converted') && call.appointmentDate ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium">
                                  {format(new Date(call.appointmentDate), 'dd/MM HH:mm', { locale: fr })}
                                </div>
                                <div className="flex items-center gap-1">
                                  {call.nbPersonnes && (
                                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                      {call.nbPersonnes} pers.
                                    </Badge>
                                  )}
                                  {call.serviceType && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">
                                      {call.serviceType}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
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

        {/* Call Detail Dialog - Enriched with N8N data */}
        <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-call-detail">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Détail de l'appel
                {selectedCall?.eventType && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {selectedCall.eventType}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Informations complètes sur cet appel
              </DialogDescription>
            </DialogHeader>
            {selectedCall && (
              <div className="space-y-6">
                {/* Basic Info Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Durée
                    </div>
                    <div className="text-sm">{formatDuration(selectedCall.duration)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Conversion
                    </div>
                    <Badge variant={selectedCall.conversionResult === 'converted' ? 'default' : 'secondary'}>
                      {selectedCall.conversionResult === 'converted' ? 'Converti' : selectedCall.conversionResult || 'N/A'}
                    </Badge>
                  </div>
                </div>

                {/* Client Info - if available */}
                {(selectedCall.clientName || selectedCall.clientEmail || selectedCall.agencyName) && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Activity className="w-3 h-3" />
                      Informations client
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedCall.clientName && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Nom</div>
                          <div className="text-sm font-medium">{selectedCall.clientName}</div>
                        </div>
                      )}
                      {selectedCall.clientEmail && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Email</div>
                          <div className="text-sm font-mono text-xs">{selectedCall.clientEmail}</div>
                        </div>
                      )}
                      {selectedCall.clientMood && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Humeur</div>
                          <Badge variant={selectedCall.clientMood === 'positif' ? 'default' : selectedCall.clientMood === 'négatif' ? 'destructive' : 'secondary'}>
                            {selectedCall.clientMood}
                          </Badge>
                        </div>
                      )}
                      {selectedCall.agencyName && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Établissement</div>
                          <div className="text-sm">{selectedCall.agencyName}</div>
                        </div>
                      )}
                      {selectedCall.nbPersonnes && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Nb personnes</div>
                          <div className="text-sm font-medium">{selectedCall.nbPersonnes}</div>
                        </div>
                      )}
                      {selectedCall.serviceType && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Type de service</div>
                          <Badge variant="outline">{selectedCall.serviceType}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timing Info */}
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

                {/* Tags */}
                {selectedCall.tags && selectedCall.tags.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCall.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {selectedCall.summary && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Résumé IA de l'appel
                    </div>
                    <div className="text-sm bg-muted p-4 rounded-lg">
                      {selectedCall.summary}
                    </div>
                  </div>
                )}

                {/* Transcript */}
                {selectedCall.transcript && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Transcription complète
                    </div>
                    <div className="text-xs bg-muted/50 p-4 rounded-lg max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">
                      {selectedCall.transcript}
                    </div>
                  </div>
                )}

                {/* Appointment Info */}
                {selectedCall.status === 'completed' && selectedCall.appointmentDate && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                          Date du rendez-vous
                        </div>
                        <div className="text-base font-semibold">
                          {format(new Date(selectedCall.appointmentDate), "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {selectedCall.bookingDelayDays !== null && selectedCall.bookingDelayDays !== undefined && (
                            <span>Réservé {selectedCall.bookingDelayDays}j à l'avance</span>
                          )}
                          {selectedCall.isLastMinute && (
                            <Badge variant="secondary" className="text-xs">Last minute</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Call Quality Metrics */}
                {(selectedCall.bookingConfidence || selectedCall.callQuality || selectedCall.disconnectionReason) && (
                  <div className="grid grid-cols-3 gap-4">
                    {selectedCall.bookingConfidence !== null && selectedCall.bookingConfidence !== undefined && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Confiance
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${selectedCall.bookingConfidence}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{selectedCall.bookingConfidence}%</span>
                        </div>
                      </div>
                    )}
                    {selectedCall.callQuality && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Qualité
                        </div>
                        <Badge variant={selectedCall.callQuality === 'fluide' ? 'default' : 'secondary'}>
                          {selectedCall.callQuality}
                        </Badge>
                      </div>
                    )}
                    {selectedCall.disconnectionReason && (
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Fin d'appel
                        </div>
                        <div className="text-xs text-muted-foreground">{selectedCall.disconnectionReason}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Keywords */}
                {selectedCall.keywords && selectedCall.keywords.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Mots-clés détectés
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedCall.keywords.map((kw, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reference IDs */}
                <div className="flex items-center gap-6 pt-4 border-t text-xs text-muted-foreground">
                  <div>
                    <span className="opacity-60">ID:</span> <span className="font-mono">{selectedCall.id.slice(0, 8)}...</span>
                  </div>
                  {selectedCall.callId && (
                    <div>
                      <span className="opacity-60">Call ID:</span> <span className="font-mono">{selectedCall.callId}</span>
                    </div>
                  )}
                  {selectedCall.agentId && (
                    <div>
                      <span className="opacity-60">Agent:</span> <span className="font-mono">{selectedCall.agentId.slice(0, 12)}...</span>
                    </div>
                  )}
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

        {/* Analytics Dialog */}
        <AnalyticsDialog
          metric={analyticsMetric}
          open={!!analyticsMetric}
          onOpenChange={(open) => {
            if (!open) {
              setAnalyticsMetric(null);
            }
          }}
          timeFilter={globalTimeFilter !== 'all' ? globalTimeFilter as 'hour' | 'today' | 'two_days' | 'week' : undefined}
        />
      </div>
    </div>
  );
}
