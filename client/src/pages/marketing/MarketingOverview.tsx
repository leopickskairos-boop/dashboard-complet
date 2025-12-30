/**
 * MarketingOverview - Page Vue d'ensemble Marketing (REFONTE COMPLÈTE)
 * 
 * Architecture en 3 zones :
 * 1. Zone A — Pilotage rapide (4-5 KPIs)
 * 2. Zone B — Performance & activité (avec empty state si pas de données)
 * 3. Zone C — Actions & leviers (3 cards cliquables)
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Users,
  Mail,
  MousePointerClick,
  Send,
  Megaphone,
  TrendingUp,
  Plus,
  Sparkles,
  Zap,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { getDemoUrl } from "@/lib/demo-mode";

interface MarketingStats {
  totalContacts: number;
  newContactsPeriod: number;
  totalCampaigns: number;
  campaignsSentPeriod: number;
  totalEmailsSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  totalRevenue?: number;
  costPerConversion?: number;
}

interface ChartDataItem {
  date: string;
  sent?: number;
  emailsSent?: number;
  opened: number;
  clicked: number;
  conversions?: number;
}

export default function MarketingOverview() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<MarketingStats>({
    queryKey: [getDemoUrl(`/api/marketing/analytics/overview?period=${period}`)],
  });

  const { data: chartDataResponse, isLoading: chartLoading } = useQuery<{ datasets: ChartDataItem[] } | ChartDataItem[]>({
    queryKey: [getDemoUrl(`/api/marketing/analytics/performance?period=${period}`)],
  });
  
  const chartData = Array.isArray(chartDataResponse) 
    ? chartDataResponse 
    : (chartDataResponse?.datasets || []);

  const formatTrendDate = (date: string) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const hasData = stats && (stats.totalEmailsSent > 0 || stats.totalCampaigns > 0);

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-lg font-semibold text-foreground">Marketing</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gérez vos campagnes</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-full md:w-[160px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">7 derniers jours</SelectItem>
            <SelectItem value="month">30 derniers jours</SelectItem>
            <SelectItem value="year">12 derniers mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ZONE A — PILOTAGE RAPIDE */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-5">
        {statsLoading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {/* Contacts - Card dominante */}
            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] md:col-span-2">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-[#4CEFAD]/10">
                    <Users className="h-6 w-6 text-[#4CEFAD]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-3xl font-bold">{stats?.totalContacts?.toLocaleString() || "0"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Contacts exploitables</p>
                    {stats?.newContactsPeriod && stats.newContactsPeriod > 0 && (
                      <p className="text-[10px] text-[#4CEFAD] mt-1">
                        +{stats.newContactsPeriod} cette période
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campagnes */}
            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#C8B88A]/10">
                    <Megaphone className="h-5 w-5 text-[#C8B88A]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalCampaigns || 0}</p>
                    <p className="text-xs text-muted-foreground">Campagnes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emails envoyés */}
            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalEmailsSent?.toLocaleString() || "0"}</p>
                    <p className="text-xs text-muted-foreground">Emails envoyés</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTR */}
            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10">
                    <MousePointerClick className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-2xl font-bold">
                        {stats?.avgClickRate !== undefined && stats.avgClickRate > 0
                          ? `${stats.avgClickRate.toFixed(1)}%`
                          : "—"}
                      </p>
                      {(!stats?.avgClickRate || stats.avgClickRate === 0) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Taux de clic disponible après l'envoi de campagnes</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Taux de clic (CTR)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ZONE B — PERFORMANCE & ACTIVITÉ */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Performance & activité</CardTitle>
          <CardDescription className="text-xs">Évolution de vos campagnes dans le temps</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {chartLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : !hasData || !chartData || chartData.length === 0 ? (
            /* EMPTY STATE - CAS 1 */
            <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-6">
              <div className="p-4 rounded-full bg-[#C8B88A]/10 mb-6">
                <Megaphone className="h-12 w-12 text-[#C8B88A]/50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Votre marketing n'est pas encore actif
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                Les statistiques apparaîtront après l'envoi de votre première campagne.
              </p>
              <div className="space-y-3 w-full max-w-sm">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/40">
                  <div className="p-1.5 rounded bg-[#4CEFAD]/10">
                    <Users className="h-4 w-4 text-[#4CEFAD]" />
                  </div>
                  <p className="text-sm text-foreground/90 flex-1">Ajouter des contacts</p>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/40">
                  <div className="p-1.5 rounded bg-[#C8B88A]/10">
                    <Mail className="h-4 w-4 text-[#C8B88A]" />
                  </div>
                  <p className="text-sm text-foreground/90 flex-1">Créer un template</p>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/40">
                  <div className="p-1.5 rounded bg-blue-500/10">
                    <Send className="h-4 w-4 text-blue-400" />
                  </div>
                  <p className="text-sm text-foreground/90 flex-1">Lancer une campagne</p>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </div>
            </div>
          ) : (
            /* CAS 2 — Données partielles */
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666" 
                  fontSize={10}
                  tickFormatter={formatTrendDate}
                />
                <YAxis stroke="#666" fontSize={10} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#0E1015",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={formatTrendDate}
                />
                <Line
                  type="monotone"
                  dataKey="emailsSent"
                  name="Envoyés"
                  stroke="#C8B88A"
                  strokeWidth={2.5}
                  dot={false}
                />
                {chartData.some(d => d.opened > 0) && (
                  <Line
                    type="monotone"
                    dataKey="opened"
                    name="Ouverts"
                    stroke="#4CEFAD"
                    strokeWidth={2.5}
                    dot={false}
                  />
                )}
                {chartData.some(d => d.clicked > 0) && (
                  <Line
                    type="monotone"
                    dataKey="clicked"
                    name="Clics"
                    stroke="#60a5fa"
                    strokeWidth={2.5}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ZONE C — ACTIONS & LEVIERS */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Créer une campagne */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-[#C8B88A]/30 transition-all cursor-pointer group"
          onClick={() => setLocation("/marketing/campaigns")}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Send className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                    Créer une campagne
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Envoyez votre premier message en quelques minutes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Générer un template par IA */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-[#C8B88A]/30 transition-all cursor-pointer group"
          onClick={() => setLocation("/marketing/templates")}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#C8B88A]/10 group-hover:bg-[#C8B88A]/20 transition-colors">
                  <Sparkles className="h-6 w-6 text-[#C8B88A]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-[#C8B88A] transition-colors">
                    Générer un template par IA
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-[#C8B88A] group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Laissez l'IA créer un message personnalisé pour vous
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Créer une automation */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-[#4CEFAD]/30 transition-all cursor-pointer group"
          onClick={() => setLocation("/marketing/automations")}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#4CEFAD]/10 group-hover:bg-[#4CEFAD]/20 transition-colors">
                  <Zap className="h-6 w-6 text-[#4CEFAD]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-[#4CEFAD] transition-colors">
                    Créer une automation
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-[#4CEFAD] group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Automatisez vos envois et gagnez du temps
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
