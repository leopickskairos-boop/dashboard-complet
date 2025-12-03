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
  Brain,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  Sparkles,
  Target,
  MessageSquare
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
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [showConvertedClientsModal, setShowConvertedClientsModal] = useState<boolean>(false);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<number | null>(null);

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
        {/* Header - Premium Design */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight mb-1.5">Dashboard</h1>
          <p className="text-[15px] text-muted-foreground">
            Vue d'ensemble de votre activité
          </p>
        </div>

        {/* Trial Countdown Banner */}
        {user && <div className="mb-8"><TrialCountdown user={user} /></div>}

        {/* Global Time Filter */}
        <div className="mb-8 flex items-center gap-3">
          <span className="text-[13px] font-medium text-muted-foreground">Période :</span>
          <Select value={globalTimeFilter} onValueChange={setGlobalTimeFilter}>
            <SelectTrigger className="w-[180px] h-9 text-[13px]" data-testid="select-global-time-filter">
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

        {/* KPI Cards Grid - Premium Design */}
        {statsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {/* Total Calls - Clickable */}
            <Card 
              className="group relative overflow-hidden cursor-pointer bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] transition-all duration-200 ease-out hover:translate-y-[-2px] hover:shadow-[0_0_16px_rgba(200,184,138,0.15)]" 
              onClick={() => setChartDialog('total')}
              data-testid="card-total-calls"
            >
              <CardContent className="relative p-7">
                <div className="flex items-start justify-between mb-5">
                  <div className="p-2 rounded-xl bg-white/5 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-[#C8B88A] transition-opacity duration-150 hover:opacity-80" />
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
                      className="h-7 px-2 gap-1 opacity-60 hover:opacity-100 transition-all duration-150 active:scale-95"
                    >
                      <Brain className="w-3 h-3" />
                      <span className="text-xs">Analyser</span>
                    </Button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                  Total des appels
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[28px] font-semibold tracking-tight" data-testid="stat-total-calls">
                    {stats?.totalCalls || 0}
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                    <TrendingUp className="w-3.5 h-3.5 transition-opacity duration-150 hover:opacity-80" />
                    <span>+12%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Calls - Not Clickable */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] transition-all duration-200 ease-out hover:translate-y-[-2px] hover:shadow-[0_0_16px_rgba(200,184,138,0.15)]" data-testid="card-active-calls">
              <CardContent className="relative p-7">
                <div className="flex items-start justify-between mb-5">
                  <div className="p-2 rounded-xl bg-white/5 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-[#C8B88A] transition-opacity duration-150 hover:opacity-80" />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                  Appels actifs
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[28px] font-semibold tracking-tight" data-testid="stat-active-calls">
                    {stats?.activeCalls || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">En cours</div>
                </div>
              </CardContent>
            </Card>

            {/* Conversion Rate - Clickable */}
            <Card 
              className="group relative overflow-hidden cursor-pointer bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] transition-all duration-200 ease-out hover:translate-y-[-2px] hover:shadow-[0_0_16px_rgba(200,184,138,0.15)]" 
              onClick={() => setChartDialog('conversion')}
              data-testid="card-conversion-rate"
            >
              <CardContent className="relative p-7">
                <div className="flex items-start justify-between mb-5">
                  <div className="p-2 rounded-xl bg-white/5 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#C8B88A] transition-opacity duration-150 hover:opacity-80" />
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
                      className="h-7 px-2 gap-1 opacity-60 hover:opacity-100 transition-all duration-150 active:scale-95"
                    >
                      <Brain className="w-3 h-3" />
                      <span className="text-xs">Analyser</span>
                    </Button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                  Taux de conversion
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[28px] font-semibold tracking-tight" data-testid="stat-conversion-rate">
                    {stats?.conversionRate || 0}%
                  </div>
                  <div className="flex items-center gap-1 text-rose-400 text-xs font-medium">
                    <TrendingDown className="w-3.5 h-3.5 transition-opacity duration-150 hover:opacity-80" />
                    <span>-3%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average Duration - Clickable */}
            <Card 
              className="group relative overflow-hidden cursor-pointer bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] transition-all duration-200 ease-out hover:translate-y-[-2px] hover:shadow-[0_0_16px_rgba(200,184,138,0.15)]" 
              onClick={() => setChartDialog('duration')}
              data-testid="card-average-duration"
            >
              <CardContent className="relative p-7">
                <div className="flex items-start justify-between mb-5">
                  <div className="p-2 rounded-xl bg-white/5 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#C8B88A] transition-opacity duration-150 hover:opacity-80" />
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
                      className="h-7 px-2 gap-1 opacity-60 hover:opacity-100 transition-all duration-150 active:scale-95"
                    >
                      <Brain className="w-3 h-3" />
                      <span className="text-xs">Analyser</span>
                    </Button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                  Durée moyenne
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[28px] font-semibold tracking-tight" data-testid="stat-average-duration">
                    {formatDuration(stats?.averageDuration)}
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                    <TrendingUp className="w-3.5 h-3.5 transition-opacity duration-150 hover:opacity-80" />
                    <span>+8%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hours Saved - Not Clickable */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] transition-all duration-200 ease-out hover:translate-y-[-2px] hover:shadow-[0_0_16px_rgba(200,184,138,0.15)]" data-testid="card-hours-saved">
              <CardContent className="relative p-7">
                <div className="flex items-start justify-between mb-5">
                  <div className="p-2 rounded-xl bg-white/5 flex items-center justify-center">
                    <Timer className="w-5 h-5 text-[#C8B88A] transition-opacity duration-150 hover:opacity-80" />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                  Heures économisées
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[28px] font-semibold tracking-tight" data-testid="stat-hours-saved">
                    {formatHours(stats?.hoursSaved)}
                  </div>
                  <div className="text-xs text-muted-foreground">Ce mois</div>
                </div>
              </CardContent>
            </Card>

            {/* Estimated Revenue - Not Clickable */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] transition-all duration-200 ease-out hover:translate-y-[-2px] hover:shadow-[0_0_16px_rgba(200,184,138,0.15)]" data-testid="card-estimated-revenue">
              <CardContent className="relative p-7">
                <div className="flex items-start justify-between mb-5">
                  <div className="p-2 rounded-xl bg-white/5 flex items-center justify-center">
                    <Euro className="w-5 h-5 text-[#C8B88A] transition-opacity duration-150 hover:opacity-80" />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                  Revenus estimés
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[28px] font-semibold tracking-tight" data-testid="stat-estimated-revenue">
                    {formatCurrency(stats?.estimatedRevenue)}
                  </div>
                  <div className="flex items-center gap-1 text-[#C8B88A] text-xs font-medium">
                    <TrendingUp className="w-3.5 h-3.5 transition-opacity duration-150 hover:opacity-80" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Insights & Trends Section - Premium Consulting Style */}
        <div className="mb-12 mt-6 relative rounded-[14px] bg-gradient-to-b from-[#111111] to-[#151515] border border-white/[0.06] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.35)]" data-testid="section-insights">
          
          {/* Premium Header - No "Voir plus" */}
          <div className="flex items-center pb-4 mb-5 border-b border-white/[0.04]">
            <div className="flex items-center gap-4">
              <div className="w-[44px] h-[44px] rounded-xl flex items-center justify-center relative" style={{ background: 'radial-gradient(circle, rgba(140,120,255,0.15) 0%, transparent 70%)' }}>
                <Brain className="w-6 h-6 text-violet-400" />
                <div className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 20px rgba(140,120,255,0.2)' }} />
              </div>
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight text-[#EDEDED]">
                  Insights IA & Tendances
                </h2>
                <p className="text-[13px] text-[#A0A0A0] mt-0.5">
                  Recommandations basées sur vos données en temps réel
                </p>
              </div>
            </div>
          </div>

          {/* Insights Content */}
          {insightsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            </div>
          ) : aiInsights.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'radial-gradient(circle, rgba(140,120,255,0.12) 0%, transparent 70%)' }}>
                <Brain className="w-8 h-8 text-[#606060]" />
              </div>
              <p className="text-[#808080] text-[14px]">Aucune donnée disponible pour générer des insights</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* ZONE A: Hero Insight (First insight, dominant) - ONLY this card gets glow */}
              {aiInsights[0] && (() => {
                const heroInsight = aiInsights[0];
                const HeroIcon = iconMap[heroInsight.icon] || Brain;
                const categoryConfig = {
                  performance: { label: 'Performance', color: '#C8B88A', bgGlow: 'rgba(200,184,138,0.12)' },
                  business: { label: 'Business', color: '#34D399', bgGlow: 'rgba(52,211,153,0.12)' },
                };
                const heroConfig = categoryConfig[heroInsight.type as keyof typeof categoryConfig] || categoryConfig.business;
                
                return (
                  <div 
                    className="relative w-full p-6 rounded-xl bg-gradient-to-br from-[#1A1A1E] to-[#141418] border border-white/[0.07]"
                    style={{ 
                      boxShadow: '0 0 24px rgba(140,120,255,0.12), inset 0 0 0 1px rgba(255,215,150,0.10), 0 4px 12px rgba(0,0,0,0.25)'
                    }}
                    data-testid="hero-insight"
                  >
                    <div className="flex items-start gap-5">
                      <div className="shrink-0 w-[44px] h-[44px] rounded-xl flex items-center justify-center" style={{ background: `radial-gradient(circle, ${heroConfig.bgGlow} 0%, transparent 70%)` }}>
                        <HeroIcon className="w-6 h-6" style={{ color: heroConfig.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <span 
                            className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full"
                            style={{ 
                              backgroundColor: heroInsight.type === 'performance' ? 'rgba(200,184,138,0.12)' : 'rgba(52,211,153,0.12)',
                              color: heroConfig.color,
                              border: `1px solid ${heroConfig.color}20`
                            }}
                          >
                            {heroConfig.label}
                          </span>
                        </div>
                        <p className="text-[15px] text-[#EDEDED] leading-relaxed font-medium">
                          {heroInsight.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ZONE B: Secondary Insights (3 columns: 2 insights + 1 chart card) */}
              <div 
                className="grid gap-4" 
                style={{ 
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridAutoRows: '1fr'
                }}
              >
                {/* First 2 insight cards */}
                {aiInsights.slice(1, 3).map((insight, index) => {
                  const Icon = iconMap[insight.icon] || Brain;
                  
                  const getCategoryConfig = (type: string, cardIndex: number) => {
                    if (type === 'performance') {
                      return { label: 'Performance', color: '#C8B88A', dotColor: 'bg-[#C8B88A]' };
                    }
                    if (cardIndex === 1) {
                      return { label: 'Tendance', color: '#A78BFA', dotColor: 'bg-violet-400' };
                    }
                    return { label: 'Business', color: '#34D399', dotColor: 'bg-emerald-400' };
                  };
                  
                  const config = getCategoryConfig(insight.type, index);
                  
                  return (
                    <div 
                      key={index + 1}
                      className="group relative p-5 rounded-xl bg-[#111216] border border-white/[0.05] transition-all duration-200 hover:translate-y-[-2px] hover:border-white/[0.08]"
                      style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)' }}
                      data-testid={`recommendation-${index + 1}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 w-[36px] h-[36px] rounded-lg flex items-center justify-center bg-white/[0.04]">
                          <Icon className="w-[18px] h-[18px]" style={{ color: config.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-[6px] h-[6px] rounded-full ${config.dotColor}`} />
                            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: config.color }}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-[13px] text-[#EDEDED]/80 leading-relaxed">
                            {insight.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* ENHANCED: Clients convertis chart card with dual-line, interaction & modal */}
                {(() => {
                  // Data for 7 days
                  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
                  const currentWeek = [2, 3, 4, 3, 5, 6, 4];
                  const previousWeek = [1, 2, 2, 3, 3, 4, 3];
                  
                  // Calculations
                  const totalCurrent = currentWeek.reduce((a, b) => a + b, 0);
                  const totalPrevious = previousWeek.reduce((a, b) => a + b, 0);
                  const evolution = totalPrevious > 0 ? Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100) : 100;
                  const isPositive = evolution >= 0;
                  
                  // Find best/worst days
                  const maxValue = Math.max(...currentWeek);
                  const minValue = Math.min(...currentWeek);
                  const bestDayIndex = currentWeek.indexOf(maxValue);
                  const worstDayIndex = currentWeek.indexOf(minValue);
                  const weeklyMean = totalCurrent / 7;
                  const hasAnomaly = currentWeek.some(v => v > weeklyMean * 1.4);
                  const anomalyDay = hasAnomaly ? days[currentWeek.findIndex(v => v > weeklyMean * 1.4)] : null;
                  
                  // Trend analysis
                  const trend = evolution > 10 ? 'haussière' : evolution < -10 ? 'baissière' : 'stable';
                  
                  // SVG path generation for smooth bezier curves
                  const generatePath = (data: number[], maxVal: number, height: number = 50, width: number = 200) => {
                    const points = data.map((val, i) => ({
                      x: (i / (data.length - 1)) * width,
                      y: height - (val / maxVal) * (height - 10)
                    }));
                    
                    let path = `M ${points[0].x},${points[0].y}`;
                    for (let i = 1; i < points.length; i++) {
                      const prev = points[i - 1];
                      const curr = points[i];
                      const cpx1 = prev.x + (curr.x - prev.x) / 3;
                      const cpx2 = prev.x + 2 * (curr.x - prev.x) / 3;
                      path += ` C ${cpx1},${prev.y} ${cpx2},${curr.y} ${curr.x},${curr.y}`;
                    }
                    return path;
                  };
                  
                  const maxVal = Math.max(...currentWeek, ...previousWeek) + 1;
                  const currentPath = generatePath(currentWeek, maxVal);
                  const previousPath = generatePath(previousWeek, maxVal);
                  const currentAreaPath = currentPath + ` L 200,50 L 0,50 Z`;
                  
                  const getPointY = (val: number, maxV: number = maxVal, h: number = 50) => h - (val / maxV) * (h - 10);
                  
                  return (
                    <>
                      <div 
                        className="group relative p-5 rounded-xl bg-[#111216] border border-white/[0.05] flex flex-col cursor-pointer transition-all duration-200 hover:border-white/[0.10]"
                        style={{ 
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 4px 20px rgba(0,255,178,0.12)'
                        }}
                        onClick={() => setShowConvertedClientsModal(true)}
                        onMouseLeave={() => setHoveredDataPoint(null)}
                        data-testid="card-clients-convertis"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-[13px] font-medium text-[#EDEDED] tracking-tight">
                              Clients convertis automatiquement
                            </h3>
                            <p className="text-[11px] text-[#A0A0A0] mt-0.5">
                              Impact IA hebdomadaire
                            </p>
                          </div>
                          <div className="text-[10px] text-[#606060] opacity-0 group-hover:opacity-100 transition-opacity">
                            Cliquer pour agrandir
                          </div>
                        </div>

                        {/* Mini Dual Line Chart - Trade Republic Style */}
                        <div className="flex-1 min-h-[60px] relative">
                          <svg 
                            viewBox="0 0 200 60" 
                            className="w-full h-full"
                            preserveAspectRatio="none"
                          >
                            <defs>
                              <linearGradient id="chartGradientMini" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#00FFB2" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="#00FFB2" stopOpacity="0.02" />
                              </linearGradient>
                              <filter id="glowFilterMini" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge>
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                              </filter>
                            </defs>
                            
                            {/* Gradient fill under current week curve */}
                            <path d={currentAreaPath} fill="url(#chartGradientMini)" />
                            
                            {/* Previous week line (baseline) */}
                            <path 
                              d={previousPath}
                              fill="none"
                              stroke="rgba(107,107,255,0.35)"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            
                            {/* Current week line */}
                            <path 
                              d={currentPath}
                              fill="none"
                              stroke="#00FFB2"
                              strokeWidth="2"
                              strokeLinecap="round"
                              opacity="0.9"
                            />
                            
                            {/* Hover tracking line */}
                            {hoveredDataPoint !== null && (
                              <line 
                                x1={(hoveredDataPoint / 6) * 200} 
                                y1="0" 
                                x2={(hoveredDataPoint / 6) * 200} 
                                y2="60" 
                                stroke="rgba(0,255,178,0.25)" 
                                strokeWidth="1" 
                                strokeDasharray="3,3"
                              />
                            )}
                            
                            {/* Interactive hover zones */}
                            {days.map((_, i) => (
                              <rect 
                                key={i}
                                x={(i / 6) * 200 - 14}
                                y="0"
                                width="28"
                                height="60"
                                fill="transparent"
                                onMouseEnter={() => setHoveredDataPoint(i)}
                              />
                            ))}
                            
                            {/* Glow points on peaks */}
                            {currentWeek.map((val, i) => (
                              val === maxValue && (
                                <circle 
                                  key={`peak-${i}`}
                                  cx={(i / 6) * 200} 
                                  cy={getPointY(val, maxVal, 50)} 
                                  r="3" 
                                  fill="#00FFB2" 
                                  filter="url(#glowFilterMini)" 
                                  opacity="0.7"
                                />
                              )
                            ))}
                            
                            {/* Hover points */}
                            {hoveredDataPoint !== null && (
                              <>
                                <circle 
                                  cx={(hoveredDataPoint / 6) * 200} 
                                  cy={getPointY(currentWeek[hoveredDataPoint], maxVal, 50)} 
                                  r="4" 
                                  fill="#00FFB2" 
                                  filter="url(#glowFilterMini)"
                                />
                                <circle 
                                  cx={(hoveredDataPoint / 6) * 200} 
                                  cy={getPointY(previousWeek[hoveredDataPoint], maxVal, 50)} 
                                  r="3" 
                                  fill="rgba(107,107,255,0.6)"
                                />
                              </>
                            )}
                          </svg>
                          
                          {/* Tooltip */}
                          {hoveredDataPoint !== null && (
                            <div 
                              className="absolute z-20 px-3 py-2 rounded-[10px] text-[11px] pointer-events-none"
                              style={{
                                left: `${Math.min(Math.max((hoveredDataPoint / 6) * 100, 15), 85)}%`,
                                top: '-65px',
                                transform: 'translateX(-50%)',
                                background: '#181A1F',
                                boxShadow: '0 4px 12px rgba(0,255,178,0.20)',
                                border: '1px solid rgba(255,255,255,0.08)'
                              }}
                            >
                              <div className="font-medium text-white mb-1">{days[hoveredDataPoint]}</div>
                              <div className="text-[#00FFB2]">Actuelle : {currentWeek[hoveredDataPoint]} clients</div>
                              <div className="text-[#6B6BFF]">Précédente : {previousWeek[hoveredDataPoint]} clients</div>
                              <div className={`mt-1 ${currentWeek[hoveredDataPoint] >= previousWeek[hoveredDataPoint] ? 'text-[#00FFB2]' : 'text-[#FF6B6B]'}`}>
                                {currentWeek[hoveredDataPoint] >= previousWeek[hoveredDataPoint] ? '+' : ''}{Math.round(((currentWeek[hoveredDataPoint] - previousWeek[hoveredDataPoint]) / (previousWeek[hoveredDataPoint] || 1)) * 100)}%
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Summary text */}
                        <p className="text-[12px] text-[#A0A0A0] mt-3 leading-relaxed">
                          Cette semaine, vos conversions IA ont évolué de{' '}
                          <span className={`font-semibold ${isPositive ? 'text-[#00FFB2]' : 'text-[#FF6B6B]'}`}>
                            {isPositive ? '+' : ''}{evolution}%
                          </span>{' '}
                          par rapport à la semaine précédente.
                        </p>
                      </div>

                      {/* MODAL: Expanded Chart View */}
                      {showConvertedClientsModal && (
                        <div 
                          className="fixed inset-0 z-50 flex items-center justify-center"
                          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
                          onClick={() => setShowConvertedClientsModal(false)}
                        >
                          <div 
                            className="relative w-[80%] max-w-4xl h-[70%] max-h-[600px] rounded-2xl p-8 overflow-hidden"
                            style={{ 
                              background: '#0F1013',
                              boxShadow: '0 8px 32px rgba(0,255,178,0.12), 0 0 0 1px rgba(255,255,255,0.05)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Close button */}
                            <button 
                              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#A0A0A0] hover:text-white hover:bg-white/10 transition-colors"
                              onClick={() => setShowConvertedClientsModal(false)}
                              data-testid="button-close-modal"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>

                            {/* Modal Header */}
                            <div className="mb-6">
                              <h2 className="text-[20px] font-semibold text-[#EDEDED] tracking-tight">
                                Clients convertis automatiquement
                              </h2>
                              <p className="text-[13px] text-[#A0A0A0] mt-1">
                                Comparaison semaine actuelle vs semaine précédente
                              </p>
                            </div>

                            {/* Metrics Row */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                                <div className="text-[11px] text-[#808080] uppercase tracking-wider mb-1">Total actuel</div>
                                <div className="text-[22px] font-semibold text-[#00FFB2]">{totalCurrent}</div>
                              </div>
                              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                                <div className="text-[11px] text-[#808080] uppercase tracking-wider mb-1">Total précédent</div>
                                <div className="text-[22px] font-semibold text-[#6B6BFF]">{totalPrevious}</div>
                              </div>
                              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                                <div className="text-[11px] text-[#808080] uppercase tracking-wider mb-1">Évolution</div>
                                <div className={`text-[22px] font-semibold ${isPositive ? 'text-[#00FFB2]' : 'text-[#FF6B6B]'}`}>
                                  {isPositive ? '+' : ''}{evolution}%
                                </div>
                              </div>
                              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                                <div className="text-[11px] text-[#808080] uppercase tracking-wider mb-1">Meilleur jour</div>
                                <div className="text-[22px] font-semibold text-[#EDEDED]">{days[bestDayIndex]}</div>
                              </div>
                            </div>

                            {/* Large Chart */}
                            <div className="h-[200px] relative mb-6">
                              <svg 
                                viewBox="0 0 600 180" 
                                className="w-full h-full"
                                preserveAspectRatio="xMidYMid meet"
                                onMouseLeave={() => setHoveredDataPoint(null)}
                              >
                                <defs>
                                  <linearGradient id="chartGradientLarge" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#00FFB2" stopOpacity="0.2" />
                                    <stop offset="100%" stopColor="#00FFB2" stopOpacity="0.02" />
                                  </linearGradient>
                                  <filter id="glowFilterLarge" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                    <feMerge>
                                      <feMergeNode in="coloredBlur"/>
                                      <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                  </filter>
                                </defs>
                                
                                {/* Y-axis labels */}
                                {[0, Math.ceil(maxVal/2), maxVal].map((val, i) => (
                                  <text 
                                    key={`y-${i}`}
                                    x="30" 
                                    y={150 - (i * 60)} 
                                    fill="#6E6E6E" 
                                    fontSize="11" 
                                    textAnchor="end"
                                  >
                                    {val}
                                  </text>
                                ))}
                                
                                {/* X-axis labels */}
                                {days.map((day, i) => (
                                  <text 
                                    key={`x-${i}`}
                                    x={60 + (i * 80)} 
                                    y="170" 
                                    fill="#8A8A8A" 
                                    fontSize="11" 
                                    textAnchor="middle"
                                  >
                                    {day}
                                  </text>
                                ))}
                                
                                {/* Chart area */}
                                <g transform="translate(40, 10)">
                                  {/* Gradient fill under current curve */}
                                  <path 
                                    d={(() => {
                                      const pts = currentWeek.map((v, i) => ({
                                        x: 20 + (i * 80),
                                        y: 130 - (v / maxVal) * 120
                                      }));
                                      let p = `M ${pts[0].x},${pts[0].y}`;
                                      for (let i = 1; i < pts.length; i++) {
                                        const prev = pts[i-1];
                                        const curr = pts[i];
                                        p += ` C ${prev.x + 26},${prev.y} ${curr.x - 26},${curr.y} ${curr.x},${curr.y}`;
                                      }
                                      return p + ` L ${pts[pts.length-1].x},130 L ${pts[0].x},130 Z`;
                                    })()}
                                    fill="url(#chartGradientLarge)"
                                  />
                                  
                                  {/* Previous week line */}
                                  <path 
                                    d={(() => {
                                      const pts = previousWeek.map((v, i) => ({
                                        x: 20 + (i * 80),
                                        y: 130 - (v / maxVal) * 120
                                      }));
                                      let p = `M ${pts[0].x},${pts[0].y}`;
                                      for (let i = 1; i < pts.length; i++) {
                                        const prev = pts[i-1];
                                        const curr = pts[i];
                                        p += ` C ${prev.x + 26},${prev.y} ${curr.x - 26},${curr.y} ${curr.x},${curr.y}`;
                                      }
                                      return p;
                                    })()}
                                    fill="none"
                                    stroke="rgba(107,107,255,0.35)"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                  />
                                  
                                  {/* Current week line */}
                                  <path 
                                    d={(() => {
                                      const pts = currentWeek.map((v, i) => ({
                                        x: 20 + (i * 80),
                                        y: 130 - (v / maxVal) * 120
                                      }));
                                      let p = `M ${pts[0].x},${pts[0].y}`;
                                      for (let i = 1; i < pts.length; i++) {
                                        const prev = pts[i-1];
                                        const curr = pts[i];
                                        p += ` C ${prev.x + 26},${prev.y} ${curr.x - 26},${curr.y} ${curr.x},${curr.y}`;
                                      }
                                      return p;
                                    })()}
                                    fill="none"
                                    stroke="#00FFB2"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                  />
                                  
                                  {/* Hover zones and points */}
                                  {days.map((_, i) => {
                                    const x = 20 + (i * 80);
                                    const yCurrent = 130 - (currentWeek[i] / maxVal) * 120;
                                    const yPrevious = 130 - (previousWeek[i] / maxVal) * 120;
                                    
                                    return (
                                      <g key={`point-${i}`}>
                                        <rect 
                                          x={x - 40}
                                          y="0"
                                          width="80"
                                          height="140"
                                          fill="transparent"
                                          onMouseEnter={() => setHoveredDataPoint(i)}
                                          style={{ cursor: 'crosshair' }}
                                        />
                                        
                                        {hoveredDataPoint === i && (
                                          <>
                                            <line x1={x} y1="0" x2={x} y2="130" stroke="rgba(0,255,178,0.25)" strokeWidth="1" strokeDasharray="4,4"/>
                                            <circle cx={x} cy={yCurrent} r="6" fill="#00FFB2" filter="url(#glowFilterLarge)"/>
                                            <circle cx={x} cy={yPrevious} r="5" fill="rgba(107,107,255,0.7)"/>
                                          </>
                                        )}
                                        
                                        {currentWeek[i] === maxValue && hoveredDataPoint !== i && (
                                          <circle cx={x} cy={yCurrent} r="5" fill="#00FFB2" filter="url(#glowFilterLarge)" opacity="0.7"/>
                                        )}
                                      </g>
                                    );
                                  })}
                                </g>
                              </svg>
                              
                              {/* Large chart tooltip */}
                              {hoveredDataPoint !== null && (
                                <div 
                                  className="absolute z-20 px-4 py-3 rounded-[10px] text-[12px] pointer-events-none"
                                  style={{
                                    left: `${10 + (hoveredDataPoint / 6) * 80}%`,
                                    top: '20px',
                                    transform: 'translateX(-50%)',
                                    background: '#181A1F',
                                    boxShadow: '0 4px 16px rgba(0,255,178,0.25)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}
                                >
                                  <div className="font-semibold text-white mb-2 text-[13px]">{days[hoveredDataPoint]}</div>
                                  <div className="text-[#00FFB2] mb-1">Semaine actuelle : {currentWeek[hoveredDataPoint]} clients</div>
                                  <div className="text-[#6B6BFF] mb-1">Semaine précédente : {previousWeek[hoveredDataPoint]} clients</div>
                                  <div className={`font-medium ${currentWeek[hoveredDataPoint] >= previousWeek[hoveredDataPoint] ? 'text-[#00FFB2]' : 'text-[#FF6B6B]'}`}>
                                    Différence : {currentWeek[hoveredDataPoint] >= previousWeek[hoveredDataPoint] ? '+' : ''}{Math.round(((currentWeek[hoveredDataPoint] - previousWeek[hoveredDataPoint]) / (previousWeek[hoveredDataPoint] || 1)) * 100)}%
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Legend */}
                            <div className="flex gap-6 mb-6">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-0.5 bg-[#00FFB2] rounded-full"></div>
                                <span className="text-[12px] text-[#A0A0A0]">Semaine actuelle</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-0.5 bg-[#6B6BFF] rounded-full opacity-50"></div>
                                <span className="text-[12px] text-[#A0A0A0]">Semaine précédente</span>
                              </div>
                            </div>

                            {/* IA Analysis Block */}
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                              <div className="flex items-center gap-2 mb-3">
                                <Brain className="w-4 h-4 text-violet-400" />
                                <span className="text-[12px] font-medium text-violet-400 uppercase tracking-wider">Analyse IA</span>
                              </div>
                              <p className="text-[13px] text-[#B4B4B4] leading-[1.5]">
                                Votre meilleure journée est le <span className="text-[#EDEDED] font-medium">{days[bestDayIndex]}</span> avec <span className="text-[#00FFB2] font-medium">{maxValue}</span> conversions. 
                                La tendance globale est <span className={`font-medium ${trend === 'haussière' ? 'text-[#00FFB2]' : trend === 'baissière' ? 'text-[#FF6B6B]' : 'text-[#C8B88A]'}`}>{trend}</span>. 
                                L'activité la plus faible a eu lieu le <span className="text-[#EDEDED] font-medium">{days[worstDayIndex]}</span> avec seulement {minValue} conversion{minValue > 1 ? 's' : ''}.
                                {hasAnomaly && anomalyDay && (
                                  <> L'IA détecte une <span className="text-[#00FFB2] font-medium">activité exceptionnelle</span> le {anomalyDay}.</>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Calls List Section - Premium Design */}
        <Card className="border-white/[0.06]">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">Liste des appels</CardTitle>
                <CardDescription className="text-[13px]">
                  Historique de tous vos appels enregistrés
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={callsTimeFilter} onValueChange={setCallsTimeFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-[13px]" data-testid="select-calls-time-filter">
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
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-[13px]" data-testid="select-status-filter">
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
                  className="w-full sm:w-auto h-9 text-[13px]"
                  data-testid="button-appointments-only"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  {appointmentsOnly ? "Tous les appels" : "RDV uniquement"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {callsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : calls.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun appel trouvé pour ces filtres</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-3 px-6 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Date & Heure
                      </th>
                      <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Téléphone
                      </th>
                      <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Durée
                      </th>
                      <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="text-left py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                        Détails RDV
                      </th>
                      <th className="text-right py-3 px-6 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call, index) => {
                      const config = statusConfig[call.status as keyof typeof statusConfig];
                      const StatusIcon = config?.icon || Phone;
                      
                      const handleRowClick = (e: React.MouseEvent) => {
                        if (isMobile && !(e.target as HTMLElement).closest('button')) {
                          setSelectedCall(call);
                        }
                      };
                      
                      const statusColors: Record<string, string> = {
                        completed: 'bg-[#C8B88A]/10 text-[#C8B88A] border-[#C8B88A]/20',
                        failed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                        canceled: 'bg-muted text-muted-foreground border-white/[0.08]',
                        no_answer: 'bg-muted text-muted-foreground border-white/[0.08]',
                        active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      };
                      
                      return (
                        <tr 
                          key={call.id} 
                          className={`border-b border-white/[0.04] transition-colors duration-150 hover:bg-[#1A1C20] ${index % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]'} ${isMobile ? 'cursor-pointer' : ''}`}
                          onClick={handleRowClick}
                          data-testid={`call-row-${call.id}`}
                        >
                          <td className="py-5 px-6">
                            <div className="text-[13px] font-medium">
                              {format(new Date(call.startTime), 'dd MMM yyyy', { locale: fr })}
                            </div>
                            <div className="text-[12px] text-muted-foreground">
                              {format(new Date(call.startTime), 'HH:mm', { locale: fr })}
                            </div>
                          </td>
                          <td className="py-5 px-4">
                            <div className="text-[13px] font-mono text-foreground/80">{call.phoneNumber}</div>
                          </td>
                          <td className="py-5 px-4 hidden md:table-cell">
                            {call.eventType ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.06] text-foreground/70 border border-white/[0.08]">
                                {call.eventType === 'reservation' ? 'Réservation' : 
                                 call.eventType === 'information' ? 'Info' :
                                 call.eventType === 'complaint' ? 'Réclamation' :
                                 call.eventType === 'other' ? 'Autre' : call.eventType}
                              </span>
                            ) : (
                              <span className="text-[12px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-5 px-4">
                            <div className="text-[13px] text-foreground/80">{formatDuration(call.duration)}</div>
                          </td>
                          <td className="py-5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusColors[call.status] || 'bg-muted text-muted-foreground border-white/[0.08]'}`}>
                              <StatusIcon className="w-3 h-3" />
                              {config?.label || call.status}
                            </span>
                          </td>
                          <td className="py-5 px-4 hidden lg:table-cell">
                            {(call.status === 'completed' || call.conversionResult === 'converted') && call.appointmentDate ? (
                              <div className="space-y-1.5">
                                <div className="text-[12px] font-medium text-foreground/80">
                                  {format(new Date(call.appointmentDate), 'dd/MM HH:mm', { locale: fr })}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {call.nbPersonnes && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-foreground/60">
                                      {call.nbPersonnes} pers.
                                    </span>
                                  )}
                                  {call.serviceType && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.04] text-foreground/50 capitalize">
                                      {call.serviceType}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-5 px-6 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCall(call);
                              }}
                              className={`${isMobile ? 'hidden' : ''} h-8 px-3 text-[12px] text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95`}
                              data-testid={`button-view-call-${call.id}`}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
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

        {/* Call Detail Dialog - Premium Consulting Style */}
        <Dialog open={!!selectedCall} onOpenChange={() => { setSelectedCall(null); setShowTranscript(false); }}>
          <DialogContent 
            className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-[#C8B88A]/10 bg-gradient-to-b from-[#0E0E0F] to-[#121214] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_1px_rgba(200,184,138,0.1)]" 
            data-testid="dialog-call-detail"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-[#E8E8E8]/90">
                  <div className="w-8 h-8 rounded-lg bg-[#C8B88A]/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-[#C8B88A]" />
                  </div>
                  Détail de l'appel
                  {selectedCall?.eventType && (
                    <Badge className="text-xs font-normal bg-[#C8B88A]/10 text-[#C8B88A] border-[#C8B88A]/20 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
                      {selectedCall.eventType}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-[#9A9A9A] text-[13px]">
                  Informations complètes sur cet appel
                </DialogDescription>
              </DialogHeader>
            </div>

            {selectedCall && (
              <div className="px-6 py-5 space-y-5">
                
                {/* Section 1: Informations principales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-5 border-b border-white/[0.04]">
                  <div>
                    <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-1.5 font-medium">
                      Téléphone
                    </div>
                    <div className="text-[14px] font-mono text-[#F5F5F5]">{selectedCall.phoneNumber}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-1.5 font-medium">
                      Statut
                    </div>
                    {(() => {
                      const config = statusConfig[selectedCall.status as keyof typeof statusConfig];
                      const StatusIcon = config?.icon || Phone;
                      return (
                        <Badge className="gap-1.5 bg-[#C8B88A]/10 text-[#C8B88A] border-[#C8B88A]/20 shadow-[0_2px_4px_rgba(0,0,0,0.15)] rounded-full px-2.5 py-0.5">
                          <StatusIcon className="w-3 h-3" />
                          {config?.label || selectedCall.status}
                        </Badge>
                      );
                    })()}
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-1.5 font-medium">
                      Durée
                    </div>
                    <div className="text-[14px] text-[#F5F5F5] font-medium">{formatDuration(selectedCall.duration)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-1.5 font-medium">
                      Conversion
                    </div>
                    <Badge className={`rounded-full px-2.5 py-0.5 shadow-[0_2px_4px_rgba(0,0,0,0.15)] ${
                      selectedCall.conversionResult === 'converted' 
                        ? 'bg-[#C8B88A]/10 text-[#C8B88A] border-[#C8B88A]/20' 
                        : 'bg-white/5 text-[#9A9A9A] border-white/10'
                    }`}>
                      {selectedCall.conversionResult === 'converted' ? 'Converti' : selectedCall.conversionResult || 'N/A'}
                    </Badge>
                  </div>
                </div>

                {/* Section 2: Informations client */}
                {(selectedCall.clientName || selectedCall.clientEmail || selectedCall.agencyName || selectedCall.clientMood || selectedCall.nbPersonnes || selectedCall.serviceType) && (
                  <div className="bg-[#C8B88A]/[0.03] border border-[#C8B88A]/10 rounded-xl p-5">
                    <div className="text-[11px] text-[#E8E8E8]/90 uppercase tracking-wider mb-4 font-medium flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#C8B88A]" />
                      Informations client
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                      {selectedCall.clientName && (
                        <div>
                          <div className="text-[10px] text-[#9A9A9A] mb-1">Nom</div>
                          <div className="text-[14px] font-medium text-[#F5F5F5]">{selectedCall.clientName}</div>
                        </div>
                      )}
                      {selectedCall.clientMood && (
                        <div>
                          <div className="text-[10px] text-[#9A9A9A] mb-1">Humeur</div>
                          <Badge className={`rounded-full px-2.5 py-0.5 shadow-[0_2px_4px_rgba(0,0,0,0.15)] ${
                            selectedCall.clientMood === 'positif' 
                              ? 'bg-[#C8B88A]/10 text-[#C8B88A] border-[#C8B88A]/20'
                              : selectedCall.clientMood === 'négatif' 
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-white/5 text-[#9A9A9A] border-white/10'
                          }`}>
                            {selectedCall.clientMood}
                          </Badge>
                        </div>
                      )}
                      {selectedCall.agencyName && (
                        <div>
                          <div className="text-[10px] text-[#9A9A9A] mb-1">Établissement</div>
                          <div className="text-[14px] text-[#F5F5F5]">{selectedCall.agencyName}</div>
                        </div>
                      )}
                      {selectedCall.nbPersonnes && (
                        <div>
                          <div className="text-[10px] text-[#9A9A9A] mb-1">Nb personnes</div>
                          <div className="text-[14px] font-medium text-[#F5F5F5]">{selectedCall.nbPersonnes}</div>
                        </div>
                      )}
                      {selectedCall.serviceType && (
                        <div>
                          <div className="text-[10px] text-[#9A9A9A] mb-1">Type de service</div>
                          <Badge className="rounded-full px-2.5 py-0.5 bg-white/5 text-[#F5F5F5] border-white/10 shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                            {selectedCall.serviceType}
                          </Badge>
                        </div>
                      )}
                      {selectedCall.clientEmail && (
                        <div>
                          <div className="text-[10px] text-[#9A9A9A] mb-1">Email</div>
                          <div className="text-[12px] font-mono text-[#9A9A9A]">{selectedCall.clientEmail}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timing Info - Compact */}
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/[0.04]">
                  <div>
                    <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-1 font-medium">
                      Début d'appel
                    </div>
                    <div className="text-[13px] text-[#F5F5F5]">
                      {format(new Date(selectedCall.startTime), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-1 font-medium">
                      Fin d'appel
                    </div>
                    <div className="text-[13px] text-[#F5F5F5]">
                      {selectedCall.endTime 
                        ? format(new Date(selectedCall.endTime), "dd MMMM yyyy 'à' HH:mm", { locale: fr })
                        : "En cours"}
                    </div>
                  </div>
                </div>

                {/* Section 3: Résumé IA */}
                {selectedCall.summary && (
                  <div className="bg-[#1A1C1F] border border-white/[0.06] rounded-xl p-5 shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                    <div className="text-[11px] text-[#E8E8E8]/90 uppercase tracking-wider mb-3 font-medium flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#C8B88A]" />
                      Résumé IA de l'appel
                    </div>
                    <p className="text-[14px] text-[#F5F5F5]/90 leading-relaxed">
                      {selectedCall.summary}
                    </p>
                  </div>
                )}

                {/* Section 4: Date du rendez-vous - Highlighted */}
                {selectedCall.status === 'completed' && selectedCall.appointmentDate && (
                  <div className="bg-gradient-to-r from-[#C8B88A]/[0.08] to-[#C8B88A]/[0.03] border border-[#C8B88A]/20 rounded-xl p-5 shadow-[0_4px_16px_rgba(200,184,138,0.08)]">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#C8B88A]/15 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(200,184,138,0.15)]">
                        <Calendar className="w-6 h-6 text-[#C8B88A]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-[#C8B88A]/80 uppercase tracking-wider mb-1.5 font-medium">
                          Date du rendez-vous
                        </div>
                        <div className="text-[17px] font-semibold text-[#F5F5F5] capitalize">
                          {format(new Date(selectedCall.appointmentDate), "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          {selectedCall.bookingDelayDays !== null && selectedCall.bookingDelayDays !== undefined && (
                            <span className="text-[12px] text-[#9A9A9A]">Réservé {selectedCall.bookingDelayDays}j à l'avance</span>
                          )}
                          {selectedCall.isLastMinute && (
                            <Badge className="text-[10px] rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-400 border-amber-500/20">Last minute</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 5: Indicateurs IA */}
                {(selectedCall.bookingConfidence !== null || selectedCall.callQuality || selectedCall.disconnectionReason) && (
                  <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/[0.04]">
                    {selectedCall.bookingConfidence !== null && selectedCall.bookingConfidence !== undefined && (
                      <div>
                        <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
                          <Target className="w-3 h-3 text-[#C8B88A]" />
                          Confiance
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#1A1C1F] rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all bg-gradient-to-r from-[#C8B88A] to-[#A89D78]"
                              style={{ width: `${selectedCall.bookingConfidence}%` }}
                            />
                          </div>
                          <span className="text-[12px] font-medium text-[#F5F5F5]">{selectedCall.bookingConfidence}%</span>
                        </div>
                      </div>
                    )}
                    {selectedCall.callQuality && (
                      <div>
                        <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-2 font-medium">
                          Qualité
                        </div>
                        <Badge className={`rounded-full px-2.5 py-0.5 shadow-[0_2px_4px_rgba(0,0,0,0.15)] ${
                          selectedCall.callQuality === 'fluide' 
                            ? 'bg-[#C8B88A]/10 text-[#C8B88A] border-[#C8B88A]/20'
                            : 'bg-white/5 text-[#9A9A9A] border-white/10'
                        }`}>
                          {selectedCall.callQuality}
                        </Badge>
                      </div>
                    )}
                    {selectedCall.disconnectionReason && (
                      <div>
                        <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mb-2 font-medium">
                          Fin d'appel
                        </div>
                        <div className="text-[12px] text-[#9A9A9A]">{selectedCall.disconnectionReason}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Section 6: Transcription (Collapsible) */}
                {selectedCall.transcript && (
                  <div className="border-t border-white/[0.04] pt-4">
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="w-full flex items-center justify-between py-2 text-[12px] text-[#9A9A9A] hover:text-[#F5F5F5] transition-colors"
                      data-testid="button-toggle-transcript"
                    >
                      <span className="flex items-center gap-2 uppercase tracking-wider font-medium">
                        <FileText className="w-3.5 h-3.5" />
                        {showTranscript ? 'Masquer la transcription' : 'Afficher la transcription complète'}
                      </span>
                      {showTranscript ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {showTranscript && (
                      <div className="mt-3 text-[13px] text-[#9A9A9A] p-4 rounded-lg border border-white/[0.04] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {selectedCall.transcript}
                      </div>
                    )}
                  </div>
                )}

                {/* Reference IDs - Footer */}
                <div className="flex items-center gap-6 pt-4 border-t border-white/[0.04] text-[11px] text-[#9A9A9A]/60">
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
