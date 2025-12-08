import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  MessageSquare,
  MousePointer,
  Eye,
  UserMinus,
  AlertTriangle,
  Download,
  Calendar,
  Target,
  Users,
  Send,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart 
} from "recharts";

export default function MarketingAnalytics() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  const { data: overviewStats, isLoading: overviewLoading } = useQuery<{
    totalContacts: number;
    contactsGrowth: number;
    totalCampaigns: number;
    totalEmailsSent: number;
    totalSmsSent: number;
    globalOpenRate: number;
    globalClickRate: number;
    globalBounceRate: number;
    globalUnsubRate: number;
  }>({
    queryKey: [`/api/marketing/analytics/overview?period=${period}`],
  });

  const { data: performanceData, isLoading: performanceLoading } = useQuery<{
    datasets: { date: string; sent: number; opened: number; clicked: number }[];
  }>({
    queryKey: [`/api/marketing/analytics/performance?period=${period}`],
  });

  const { data: channelBreakdown } = useQuery<{
    email: { sent: number; opened: number; clicked: number };
    sms: { sent: number; delivered: number };
  }>({
    queryKey: [`/api/marketing/analytics/channels?period=${period}`],
  });

  const { data: topCampaigns } = useQuery<any[]>({
    queryKey: [`/api/marketing/analytics/top-campaigns?period=${period}`],
  });

  const kpiCards = [
    {
      title: "Emails envoyés",
      value: overviewStats?.totalEmailsSent || 0,
      icon: Mail,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Taux d'ouverture",
      value: `${(overviewStats?.globalOpenRate || 0).toFixed(1)}%`,
      icon: Eye,
      color: "text-[#4CEFAD]",
      bgColor: "bg-[#4CEFAD]/10",
      benchmark: "Moyenne: 21.5%",
      isGood: (overviewStats?.globalOpenRate || 0) >= 21.5,
    },
    {
      title: "Taux de clic",
      value: `${(overviewStats?.globalClickRate || 0).toFixed(1)}%`,
      icon: MousePointer,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      benchmark: "Moyenne: 2.5%",
      isGood: (overviewStats?.globalClickRate || 0) >= 2.5,
    },
    {
      title: "Taux de rebond",
      value: `${(overviewStats?.globalBounceRate || 0).toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      benchmark: "Max: 2%",
      isGood: (overviewStats?.globalBounceRate || 0) <= 2,
    },
    {
      title: "Désinscriptions",
      value: `${(overviewStats?.globalUnsubRate || 0).toFixed(2)}%`,
      icon: UserMinus,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      benchmark: "Max: 0.5%",
      isGood: (overviewStats?.globalUnsubRate || 0) <= 0.5,
    },
    {
      title: "Contacts",
      value: overviewStats?.totalContacts || 0,
      icon: Users,
      color: "text-[#C8B88A]",
      bgColor: "bg-[#C8B88A]/10",
      change: overviewStats?.contactsGrowth,
    },
  ];

  const pieData = channelBreakdown ? [
    { name: 'Emails ouverts', value: channelBreakdown.email?.opened || 0, color: '#60a5fa' },
    { name: 'Emails cliqués', value: channelBreakdown.email?.clicked || 0, color: '#4CEFAD' },
    { name: 'Emails non ouverts', value: (channelBreakdown.email?.sent || 0) - (channelBreakdown.email?.opened || 0), color: '#374151' },
  ] : [];

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">Analysez les performances de vos campagnes</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[160px]" data-testid="select-period">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">7 derniers jours</SelectItem>
              <SelectItem value="month">30 derniers jours</SelectItem>
              <SelectItem value="year">12 derniers mois</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {overviewLoading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          kpiCards.map((kpi, i) => (
            <Card key={i} className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{kpi.title}</span>
                  <div className={`p-1.5 rounded ${kpi.bgColor}`}>
                    <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
                {kpi.benchmark && (
                  <div className="flex items-center gap-1 mt-1">
                    {kpi.isGood ? (
                      <ArrowUpRight className="h-3 w-3 text-[#4CEFAD]" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-400" />
                    )}
                    <span className="text-xs text-muted-foreground">{kpi.benchmark}</span>
                  </div>
                )}
                {kpi.change !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    {kpi.change >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-[#4CEFAD]" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-400" />
                    )}
                    <span className={`text-xs ${kpi.change >= 0 ? 'text-[#4CEFAD]' : 'text-red-400'}`}>
                      {Math.abs(kpi.change)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Performance dans le temps</CardTitle>
            <CardDescription>Évolution des envois, ouvertures et clics</CardDescription>
          </CardHeader>
          <CardContent>
            {performanceLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={performanceData?.datasets || []}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C8B88A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#C8B88A" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4CEFAD" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4CEFAD" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorClicked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a2e',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    name="Envoyés"
                    stroke="#C8B88A"
                    fillOpacity={1}
                    fill="url(#colorSent)"
                  />
                  <Area
                    type="monotone"
                    dataKey="opened"
                    name="Ouverts"
                    stroke="#4CEFAD"
                    fillOpacity={1}
                    fill="url(#colorOpened)"
                  />
                  <Area
                    type="monotone"
                    dataKey="clicked"
                    name="Clics"
                    stroke="#60a5fa"
                    fillOpacity={1}
                    fill="url(#colorClicked)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Engagement emails</CardTitle>
            <CardDescription>Répartition des interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Top campagnes</CardTitle>
            <CardDescription>Meilleures performances sur la période</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!topCampaigns || topCampaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune donnée de campagne disponible</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topCampaigns.slice(0, 5).map((campaign: any, index: number) => {
                const openRate = campaign.totalSent > 0 
                  ? ((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1) 
                  : '0';
                const clickRate = campaign.totalOpened > 0 
                  ? ((campaign.totalClicked / campaign.totalOpened) * 100).toFixed(1) 
                  : '0';
                
                return (
                  <div 
                    key={campaign.id} 
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/30"
                    data-testid={`row-campaign-${campaign.id}`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#C8B88A]/20 text-[#C8B88A] font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {campaign.channel === 'email' ? 'Email' : campaign.channel === 'sms' ? 'SMS' : 'Multi-canal'}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{campaign.totalSent?.toLocaleString() || 0}</p>
                        <p className="text-xs text-muted-foreground">Envoyés</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-[#4CEFAD]">{openRate}%</p>
                        <p className="text-xs text-muted-foreground">Ouverture</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-blue-400">{clickRate}%</p>
                        <p className="text-xs text-muted-foreground">Clic</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conseils d'amélioration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overviewStats && overviewStats.globalOpenRate < 20 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10">
                <TrendingDown className="h-5 w-5 text-orange-400 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-400">Taux d'ouverture faible</p>
                  <p className="text-sm text-muted-foreground">
                    Testez des objets plus accrocheurs et personnalisez avec le prénom
                  </p>
                </div>
              </div>
            )}
            {overviewStats && overviewStats.globalClickRate < 2 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10">
                <Target className="h-5 w-5 text-orange-400 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-400">Taux de clic à améliorer</p>
                  <p className="text-sm text-muted-foreground">
                    Ajoutez des CTA plus visibles et des offres plus attractives
                  </p>
                </div>
              </div>
            )}
            {overviewStats && overviewStats.globalBounceRate > 2 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                <div>
                  <p className="font-medium text-red-400">Taux de rebond élevé</p>
                  <p className="text-sm text-muted-foreground">
                    Nettoyez votre base de contacts des adresses invalides
                  </p>
                </div>
              </div>
            )}
            {(!overviewStats || (overviewStats.globalOpenRate >= 20 && overviewStats.globalClickRate >= 2 && overviewStats.globalBounceRate <= 2)) && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#4CEFAD]/10">
                <TrendingUp className="h-5 w-5 text-[#4CEFAD] mt-0.5" />
                <div>
                  <p className="font-medium text-[#4CEFAD]">Excellentes performances !</p>
                  <p className="text-sm text-muted-foreground">
                    Vos métriques sont au-dessus des moyennes du secteur
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Benchmarks industrie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Taux d'ouverture</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">21.5%</span>
                  <Badge variant="secondary">Moyenne</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Taux de clic</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">2.5%</span>
                  <Badge variant="secondary">Moyenne</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Taux de rebond</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">&lt; 2%</span>
                  <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50">Objectif</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Désinscriptions</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">&lt; 0.5%</span>
                  <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50">Objectif</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
