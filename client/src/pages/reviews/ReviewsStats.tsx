import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, TrendingDown, MessageSquare, Award, Loader2, Clock, Sparkles, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, ComposedChart } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReviewStats {
  globalScore: number;
  totalReviews: number;
  newReviewsPeriod: number;
  responseRate: number;
  platforms: Record<string, { score: number; count: number }>;
  ratingDistribution: Record<number, number>;
  sentimentDistribution: Record<string, number>;
  trends: Array<{ date: string; count: number; avgRating: number }>;
  avgResponseTimeHours: number | null;
  sentimentTrend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  platformComparison: Array<{ platform: string; score: number; count: number; trend: number }>;
}

export default function ReviewsStats() {
  const [period, setPeriod] = useState<string>("month");
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: stats, isLoading } = useQuery<ReviewStats>({
    queryKey: ["/api/reviews/stats", { period }],
    queryFn: async () => {
      const response = await fetch(`/api/reviews/stats?period=${period}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai/review-insights", { stats, period });
    },
    onSuccess: (data: any) => {
      setAiInsights(data.insights);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de générer les insights IA",
        variant: "destructive",
      });
    },
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "google":
        return <SiGoogle className="h-5 w-5 text-red-500" />;
      case "facebook":
        return <SiFacebook className="h-5 w-5 text-blue-600" />;
      case "tripadvisor":
        return <SiTripadvisor className="h-5 w-5 text-green-600" />;
      case "yelp":
        return <SiYelp className="h-5 w-5 text-red-600" />;
      default:
        return <MessageSquare className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${star <= rating ? "text-[#C8B88A] fill-[#C8B88A]" : "text-muted-foreground"}`}
          />
        ))}
      </div>
    );
  };

  const formatResponseTime = (hours: number | null) => {
    if (hours === null) return "-";
    if (hours < 1) return "< 1h";
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}j`;
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <ArrowUpRight className="h-3 w-3 text-[#4CEFAD]" />;
    if (trend < 0) return <ArrowDownRight className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const ratingChartData = stats?.ratingDistribution
    ? Object.entries(stats.ratingDistribution).map(([rating, count]) => ({
        rating: `${rating} étoile${parseInt(rating) > 1 ? "s" : ""}`,
        count,
        fill: parseInt(rating) >= 4 ? "#4CEFAD" : parseInt(rating) >= 3 ? "#C8B88A" : "#EF4444",
      }))
    : [];

  const sentimentChartData = stats?.sentimentDistribution
    ? Object.entries(stats.sentimentDistribution)
        .filter(([_, count]) => count > 0)
        .map(([sentiment, count]) => {
          const labels: Record<string, string> = {
            very_positive: "Très positif",
            positive: "Positif",
            neutral: "Neutre",
            negative: "Négatif",
            very_negative: "Très négatif",
          };
          const colors: Record<string, string> = {
            very_positive: "#4CEFAD",
            positive: "#22C55E",
            neutral: "#6B7280",
            negative: "#F97316",
            very_negative: "#EF4444",
          };
          return {
            name: labels[sentiment] || sentiment,
            value: count,
            fill: colors[sentiment] || "#6B7280",
          };
        })
    : [];

  const formatTrendDate = (date: string) => {
    if (period === "year") {
      const [year, month] = date.split("-");
      const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      return months[parseInt(month) - 1] || date;
    }
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
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
          <h1 className="text-lg font-semibold text-foreground">Statistiques des avis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Analysez votre réputation en ligne</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] h-9 text-xs" data-testid="select-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="year">Cette année</SelectItem>
            <SelectItem value="all">Tout le temps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards - Extended with response time */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#C8B88A]/10">
                <Star className="h-5 w-5 text-[#C8B88A]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.globalScore?.toFixed(1) || "-"}</p>
                <p className="text-xs text-muted-foreground">Note globale</p>
              </div>
            </div>
            <div className="mt-2">
              {renderStars(Math.round(stats?.globalScore || 0))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#4CEFAD]/10">
                <MessageSquare className="h-5 w-5 text-[#4CEFAD]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalReviews || 0}</p>
                <p className="text-xs text-muted-foreground">Avis total</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/70">
              +{stats?.newReviewsPeriod || 0} nouveaux sur la période
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.responseRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Taux de réponse</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/70">
              Réponses aux avis clients
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatResponseTime(stats?.avgResponseTimeHours ?? null)}</p>
                <p className="text-xs text-muted-foreground">Temps de réponse</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/70">
              Délai moyen de réponse
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10">
                <Award className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.ratingDistribution?.[5] || 0}
                </p>
                <p className="text-xs text-muted-foreground">Avis 5 étoiles</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/70">
              Excellence reconnue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trends Chart - NEW */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#4CEFAD]" />
            Évolution des avis
          </CardTitle>
          <CardDescription className="text-xs">Volume et note moyenne au fil du temps</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {stats?.trends && stats.trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={stats.trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666" 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={formatTrendDate}
                />
                <YAxis yAxisId="left" stroke="#666" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} stroke="#666" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0E1015", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                  labelFormatter={formatTrendDate}
                  formatter={(value: number, name: string) => [
                    name === "count" ? `${value} avis` : value.toFixed(1),
                    name === "count" ? "Nombre d'avis" : "Note moyenne"
                  ]}
                />
                <Bar yAxisId="left" dataKey="count" fill="#4CEFAD" opacity={0.6} radius={[4, 4, 0, 0]} name="count" />
                <Line yAxisId="right" type="monotone" dataKey="avgRating" stroke="#C8B88A" strokeWidth={2} dot={{ fill: "#C8B88A", r: 3 }} name="avgRating" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
              <div className="p-2.5 rounded-full bg-[#4CEFAD]/10 mb-3">
                <TrendingUp className="h-5 w-5 text-[#4CEFAD]/50" />
              </div>
              <p className="text-xs text-muted-foreground">Pas encore de données de tendance</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Original Charts Row */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Distribution des notes</CardTitle>
            <CardDescription className="text-xs">Répartition des avis par note attribuée</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {ratingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ratingChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" stroke="#666" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="rating" type="category" stroke="#666" width={70} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0E1015", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="count" fill="#C8B88A" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
                <div className="p-2.5 rounded-full bg-[#C8B88A]/10 mb-3">
                  <Star className="h-5 w-5 text-[#C8B88A]/50" />
                </div>
                <p className="text-xs text-muted-foreground">Aucune donnée disponible</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Analyse des sentiments</CardTitle>
            <CardDescription className="text-xs">Tonalité générale détectée par IA</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {sentimentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={sentimentChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {sentimentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0E1015", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
                <div className="p-2.5 rounded-full bg-[#4CEFAD]/10 mb-3">
                  <MessageSquare className="h-5 w-5 text-[#4CEFAD]/50" />
                </div>
                <p className="text-xs text-muted-foreground">Aucune analyse disponible</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Trend Chart - NEW */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Évolution du sentiment</CardTitle>
          <CardDescription className="text-xs">Tendance des avis positifs, neutres et négatifs</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {stats?.sentimentTrend && stats.sentimentTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.sentimentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666" 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={formatTrendDate}
                />
                <YAxis stroke="#666" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0E1015", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                  labelFormatter={formatTrendDate}
                />
                <Area type="monotone" dataKey="positive" stackId="1" stroke="#4CEFAD" fill="#4CEFAD" fillOpacity={0.6} name="Positifs" />
                <Area type="monotone" dataKey="neutral" stackId="1" stroke="#6B7280" fill="#6B7280" fillOpacity={0.6} name="Neutres" />
                <Area type="monotone" dataKey="negative" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} name="Négatifs" />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
              <div className="p-2.5 rounded-full bg-muted/30 mb-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground">Pas de données de sentiment</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Comparison with Trends - ENHANCED */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Performance par plateforme</CardTitle>
          <CardDescription className="text-xs">Comparez votre réputation sur chaque plateforme avec les tendances</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {stats?.platformComparison && stats.platformComparison.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {stats.platformComparison.map((platform) => (
                <div
                  key={platform.platform}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors"
                  data-testid={`platform-card-${platform.platform}`}
                >
                  <div className="p-2 rounded-lg bg-background/50">
                    {getPlatformIcon(platform.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium capitalize">{platform.platform}</p>
                      <div className="flex items-center gap-0.5">
                        {getTrendIcon(platform.trend)}
                        <span className={`text-[10px] ${platform.trend > 0 ? "text-[#4CEFAD]" : platform.trend < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {platform.trend > 0 ? "+" : ""}{platform.trend.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${star <= Math.round(platform.score) ? "text-[#C8B88A] fill-[#C8B88A]" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        ({platform.count})
                      </span>
                    </div>
                    <p className="text-lg font-bold mt-0.5">{platform.score.toFixed(1)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-6 rounded-xl border border-dashed border-border/60 bg-muted/20">
              <div className="p-3 rounded-full bg-muted/30 mb-4">
                <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground/80">Aucune plateforme connectée</p>
              <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
                Configurez vos liens de plateformes dans les paramètres pour voir vos performances
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights Section - ENHANCED */}
      <Card className="border-border/50 bg-gradient-to-br from-[#C8B88A]/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#C8B88A]" />
                Insights IA & Recommandations
              </CardTitle>
              <CardDescription className="text-xs">
                Analyse intelligente de votre réputation
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateInsightsMutation.mutate()}
              disabled={generateInsightsMutation.isPending || !stats}
              className="text-xs"
              data-testid="button-generate-insights"
            >
              {generateInsightsMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              Générer analyse IA
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {aiInsights ? (
            <div className="p-4 rounded-xl bg-[#C8B88A]/10 border border-[#C8B88A]/20">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{aiInsights}</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-[#4CEFAD]/10">
                    <Clock className="h-3.5 w-3.5 text-[#4CEFAD]" />
                  </div>
                  <span className="text-xs font-medium">Réactivité</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {stats?.avgResponseTimeHours !== null && stats?.avgResponseTimeHours !== undefined
                    ? stats.avgResponseTimeHours <= 24
                      ? "Excellent ! Vous répondez en moins de 24h."
                      : stats.avgResponseTimeHours <= 48
                      ? "Bon délai. Essayez de répondre sous 24h."
                      : "Améliorez votre délai de réponse pour montrer votre engagement."
                    : "Répondez à tous les avis dans les 24h pour montrer votre engagement."}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                    <Star className="h-3.5 w-3.5 text-[#C8B88A]" />
                  </div>
                  <span className="text-xs font-medium">Qualité</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {stats?.globalScore
                    ? stats.globalScore >= 4.5
                      ? "Excellente réputation ! Maintenez ce niveau d'excellence."
                      : stats.globalScore >= 4
                      ? "Bonne note moyenne. Quelques améliorations possibles."
                      : "Identifiez les points d'insatisfaction pour progresser."
                    : "Encouragez les clients satisfaits à laisser un avis."}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Award className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium">Engagement</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {stats?.responseRate
                    ? stats.responseRate >= 90
                      ? "Parfait ! Vous répondez à presque tous les avis."
                      : stats.responseRate >= 70
                      ? "Bon taux de réponse. Visez 90% pour l'excellence."
                      : "Augmentez votre taux de réponse pour fidéliser vos clients."
                    : "Diversifiez vos plateformes d'avis pour plus de visibilité."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
