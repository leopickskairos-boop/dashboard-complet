/**
 * ReviewsStats - Page de statistiques des avis (REFONTE COMPLÈTE)
 * 
 * Architecture en 8 zones :
 * 1. Hero Score (score de réputation)
 * 2. KPI Business (5 KPIs sans graphique)
 * 3. Tendance globale (1 seul graphe - note moyenne)
 * 4. Distribution des notes (barres horizontales)
 * 5. Sentiment global (simplifié)
 * 6. Performance par plateforme
 * 7. Actions prioritaires
 * 8. IA (analyse intelligente)
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, TrendingDown, MessageSquare, Award, Loader2, Clock, Sparkles, ArrowUpRight, ArrowDownRight, Minus, MousePointerClick, HelpCircle, ChevronRight, CheckCircle2, AlertTriangle, Target } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface ReviewStats {
  globalScore: number;
  totalReviews: number;
  newReviewsPeriod: number;
  responseRate: number;
  unansweredReviews?: number;
  clickThroughRate?: number;
  clickThroughRateDataAvailable?: boolean;
  clickThroughRateVariation?: number | null;
  platforms: Record<string, { score: number; count: number }>;
  ratingDistribution: Record<number, number>;
  sentimentDistribution: Record<string, number>;
  trends: Array<{ date: string; count: number; avgRating: number }>;
  avgResponseTimeHours: number | null;
  sentimentTrend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  platformComparison: Array<{ platform: string; score: number; count: number; trend: number }>;
}

interface AIInsights {
  risks?: string | null;
  opportunities?: string | null;
  actions?: string | null;
  raw?: string | null;
  error?: string;
}

export default function ReviewsStats() {
  const [period, setPeriod] = useState<string>("month");
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [showImprovement, setShowImprovement] = useState(false);
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
      return await apiRequest<{ insights: AIInsights }>("POST", "/api/ai/review-insights", { stats, period });
    },
    onSuccess: (data) => {
      setAiInsights(data.insights);
    },
    onError: (error: any) => {
      console.error("[AI] Error:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de générer les insights IA",
        variant: "destructive",
      });
      setAiInsights({
        risks: null,
        opportunities: null,
        actions: null,
        raw: null,
        error: "Erreur lors de la génération",
      });
    },
  });

  // Animation du score au chargement
  useEffect(() => {
    if (stats) {
      const reputationScore = calculateReputationScore();
      if (reputationScore) {
        const target = reputationScore.score;
        const duration = 1000;
        const steps = 30;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            setScoreDisplay(target);
            clearInterval(timer);
          } else {
            setScoreDisplay(Math.round(current));
          }
        }, duration / steps);
        return () => clearInterval(timer);
      }
    }
  }, [stats]);

  // Calculer le score de réputation
  const calculateReputationScore = () => {
    if (!stats) return null;
    
    const noteScore = Math.min(40, (stats.globalScore / 5) * 40);
    const volumeScore = Math.min(20, (stats.totalReviews / 50) * 20);
    const responseRateScore = (stats.responseRate / 100) * 20;
    
    let responseTimeScore = 0;
    if (stats.avgResponseTimeHours !== null) {
      if (stats.avgResponseTimeHours <= 24) responseTimeScore = 10;
      else if (stats.avgResponseTimeHours <= 48) responseTimeScore = 7;
      else if (stats.avgResponseTimeHours <= 72) responseTimeScore = 4;
    }
    
    let sentimentBonus = 0;
    if (stats.sentimentDistribution) {
      const veryPositive = stats.sentimentDistribution.very_positive || 0;
      const positive = stats.sentimentDistribution.positive || 0;
      const neutral = stats.sentimentDistribution.neutral || 0;
      const negative = stats.sentimentDistribution.negative || 0;
      const veryNegative = stats.sentimentDistribution.very_negative || 0;
      const total = veryPositive + positive + neutral + negative + veryNegative;
      
      if (total > 0) {
        const positivePercent = ((veryPositive + positive) / total) * 100;
        const negativePercent = ((negative + veryNegative) / total) * 100;
        
        if (positivePercent >= 70) {
          const baseScore = noteScore + volumeScore + responseRateScore + responseTimeScore;
          if (baseScore < 50) {
            sentimentBonus = Math.min(15, (50 - baseScore) * 0.4);
          } else {
            sentimentBonus = 10;
          }
        } else if (positivePercent >= 50) {
          sentimentBonus = 7;
        } else if (negativePercent >= 30) {
          sentimentBonus = -5;
        } else {
          sentimentBonus = 5;
        }
      }
    }
    
    const baseScore = noteScore + volumeScore + responseRateScore + responseTimeScore;
    const finalScore = Math.max(0, Math.min(100, baseScore + sentimentBonus));
    
    return {
      score: Math.round(finalScore),
      label: finalScore >= 80 ? "Excellente" : finalScore >= 60 ? "Solide" : finalScore >= 40 ? "Moyenne" : "À améliorer",
    };
  };

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
            className={`h-4 w-4 ${star <= rating ? "text-[#C8B88A] fill-[#C8B88A]" : "text-muted-foreground/30"}`}
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

  const formatTrendDate = (date: string) => {
    if (period === "year") {
      const [year, month] = date.split("-");
      const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      return months[parseInt(month) - 1] || date;
    }
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  // Calculer la tendance de la note moyenne
  const getRatingTrend = () => {
    if (!stats?.trends || stats.trends.length < 2) return null;
    const first = stats.trends[0]?.avgRating || 0;
    const last = stats.trends[stats.trends.length - 1]?.avgRating || 0;
    const diff = last - first;
    if (Math.abs(diff) < 0.1) return "Stable";
    if (diff > 0) return "En amélioration";
    return "En baisse";
  };

  // Préparer les données pour la distribution
  const ratingDistributionData = stats?.ratingDistribution
    ? Object.entries(stats.ratingDistribution)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .map(([rating, count]) => ({
          rating: `${rating}★`,
          count,
          fill: parseInt(rating) >= 4 ? "#4CEFAD" : parseInt(rating) >= 3 ? "#C8B88A" : "#EF4444",
        }))
    : [];

  // Calculer le sentiment dominant
  const getDominantSentiment = () => {
    if (!stats?.sentimentDistribution) return null;
    const entries = Object.entries(stats.sentimentDistribution);
    if (entries.length === 0) return null;
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0][0];
    const labels: Record<string, string> = {
      very_positive: "Très positif",
      positive: "Positif",
      neutral: "Mitigé",
      negative: "Négatif",
      very_negative: "Très négatif",
    };
    return labels[dominant] || "Neutre";
  };

  // Calculer la répartition sentiment
  const getSentimentBreakdown = () => {
    if (!stats?.sentimentDistribution) return { positive: 0, neutral: 0, negative: 0 };
    const veryPositive = stats.sentimentDistribution.very_positive || 0;
    const positive = stats.sentimentDistribution.positive || 0;
    const neutral = stats.sentimentDistribution.neutral || 0;
    const negative = stats.sentimentDistribution.negative || 0;
    const veryNegative = stats.sentimentDistribution.very_negative || 0;
    const total = veryPositive + positive + neutral + negative + veryNegative;
    if (total === 0) return { positive: 0, neutral: 0, negative: 0 };
    return {
      positive: Math.round(((veryPositive + positive) / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      negative: Math.round(((negative + veryNegative) / total) * 100),
    };
  };

  // Générer les actions prioritaires
  const getPriorityActions = () => {
    const actions = [];
    
    if (stats?.unansweredReviews && stats.unansweredReviews > 0) {
      const estimatedPoints = Math.min(15, stats.unansweredReviews * 2);
      actions.push({
        action: `Répondre à ${stats.unansweredReviews} avis non traités`,
        points: `+${estimatedPoints} points estimés`,
        impact: "high",
        buttonLabel: "Répondre",
        buttonPath: "/reviews?responseStatus=none",
      });
    }
    
    if (stats?.totalReviews && stats.totalReviews < 20) {
      const needed = 20 - stats.totalReviews;
      const estimatedPoints = Math.min(10, needed * 1.5);
      actions.push({
        action: `Obtenir ${needed} nouveaux avis`,
        points: `+${Math.round(estimatedPoints)} points estimés`,
        impact: "medium",
        buttonLabel: "Créer campagne",
        buttonPath: "/reviews/campaigns",
      });
    }
    
    if (stats?.responseRate && stats.responseRate < 70) {
      const target = 70;
      const estimatedPoints = Math.min(12, (target - stats.responseRate) * 0.3);
      actions.push({
        action: `Améliorer le taux de réponse à ${target}%`,
        points: `+${Math.round(estimatedPoints)} points estimés`,
        impact: "medium",
        buttonLabel: "Voir avis",
        buttonPath: "/reviews?responseStatus=none",
      });
    }
    
    if (stats?.avgResponseTimeHours && stats.avgResponseTimeHours > 48) {
      actions.push({
        action: "Réduire le temps de réponse sous 24h",
        points: "+8 points estimés",
        impact: "low",
        buttonLabel: "Voir avis",
        buttonPath: "/reviews",
      });
    }
    
    return actions.slice(0, 3);
  };

  // Trouver la plateforme la plus faible
  const getWeakestPlatform = () => {
    if (!stats?.platformComparison || stats.platformComparison.length === 0) return null;
    return stats.platformComparison.reduce((weakest, current) => 
      current.score < weakest.score ? current : weakest
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  const reputationScore = calculateReputationScore();
  const priorityActions = getPriorityActions();
  const weakestPlatform = getWeakestPlatform();
  const sentimentBreakdown = getSentimentBreakdown();

  return (
    <div className="space-y-4 md:space-y-6 pb-8 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pl-0 md:pl-1">
        <div>
          <h1 className="text-xl md:text-lg font-semibold text-foreground">Statistiques avis</h1>
          <p className="text-sm md:text-xs text-muted-foreground mt-0.5">Analysez votre réputation</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full md:w-[160px] h-9 text-xs">
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

      {/* ZONE 1 — HERO SCORE */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_20px_rgba(0,0,0,0.4)] border-white/[0.08] overflow-hidden">
        <CardContent className="p-4 md:p-8">
          <div className="text-center space-y-3 md:space-y-4">
            <div className="space-y-1 md:space-y-2">
              <p className={cn(
                "text-5xl md:text-7xl font-bold transition-all duration-1000",
                reputationScore?.score >= 80 ? "text-[#4CEFAD]" :
                reputationScore?.score >= 60 ? "text-[#C8B88A]" :
                reputationScore?.score >= 40 ? "text-orange-400" :
                "text-red-400"
              )}>
                {scoreDisplay}
              </p>
              <p className="text-base md:text-lg text-muted-foreground">/ 100</p>
              <p className={cn(
                "text-xl font-semibold",
                reputationScore?.score >= 80 ? "text-[#4CEFAD]" :
                reputationScore?.score >= 60 ? "text-[#C8B88A]" :
                reputationScore?.score >= 40 ? "text-orange-400" :
                "text-red-400"
              )}>
                Réputation {reputationScore?.label}
              </p>
            </div>
            <Progress 
              value={reputationScore?.score || 0} 
              className="h-2 max-w-md mx-auto"
            />
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Basé sur votre note, le volume d'avis, le taux et le temps de réponse, et le sentiment global.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImprovement(!showImprovement)}
              className="text-xs"
            >
              👉 Comment améliorer mon score
              <ChevronRight className={cn("h-3 w-3 ml-1 transition-transform", showImprovement && "rotate-90")} />
            </Button>
            {showImprovement && priorityActions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/40 space-y-2 max-w-md mx-auto">
                {priorityActions.map((action, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20">
                    <span className="text-xs text-foreground/90">{action.action}</span>
                    <span className="text-xs font-medium text-[#4CEFAD] ml-2">{action.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ZONE 2 — KPI BUSINESS */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#C8B88A]/10">
                <Star className="h-5 w-5 text-[#C8B88A]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.globalScore?.toFixed(1) || "-"}</p>
                <p className="text-xs text-muted-foreground">Note moyenne</p>
              </div>
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
                <p className="text-xs text-muted-foreground">Nombre d'avis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold">{stats?.unansweredReviews || 0}</p>
                <p className="text-xs text-muted-foreground">Avis non répondus</p>
              </div>
              {stats?.unansweredReviews && stats.unansweredReviews > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => setLocation("/reviews?responseStatus=none")}
                >
                  Répondre
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10">
                <MessageSquare className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.responseRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Taux de réponse</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <MousePointerClick className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold">
                    {stats?.clickThroughRateDataAvailable ? `${stats.clickThroughRate || 0}%` : "N/A"}
                  </p>
                  {!stats?.clickThroughRateDataAvailable && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Données insuffisantes pour calculer le CTR</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">CTR</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONE 3 — TENDANCE GLOBALE */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Tendance globale</CardTitle>
              <CardDescription className="text-xs">Évolution de votre note moyenne</CardDescription>
            </div>
            {getRatingTrend() && (
              <span className="text-xs font-medium text-muted-foreground">
                {getRatingTrend()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {stats?.trends && stats.trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.trends}>
                <defs>
                  <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8B88A" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#C8B88A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666" 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={formatTrendDate}
                />
                <YAxis 
                  domain={[1, 5]}
                  stroke="#666" 
                  tick={{ fontSize: 10 }}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "#0E1015", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                  labelFormatter={formatTrendDate}
                  formatter={(value: number) => [value.toFixed(1), "Note moyenne"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="avgRating" 
                  stroke="#C8B88A" 
                  strokeWidth={2.5}
                  fill="url(#ratingGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
              <p className="text-xs text-muted-foreground">Pas encore de données de tendance</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZONE 4 — DISTRIBUTION DES NOTES */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Distribution des notes</CardTitle>
          <CardDescription className="text-xs">Répartition qualitative de vos avis</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {ratingDistributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ratingDistributionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" stroke="#666" tick={{ fontSize: 10 }} />
                <YAxis dataKey="rating" type="category" stroke="#666" width={60} tick={{ fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "#0E1015", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value} avis (${Math.round((value / stats?.totalReviews || 1) * 100)}%)`,
                    ""
                  ]}
                />
                <Bar dataKey="count" fill="#C8B88A" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
              <p className="text-xs text-muted-foreground">Aucune donnée disponible</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZONE 5 — SENTIMENT GLOBAL */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sentiment global</CardTitle>
          <CardDescription className="text-xs">Tonalité générale détectée par IA</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "px-4 py-3 rounded-xl",
              getDominantSentiment()?.includes("positif") ? "bg-[#4CEFAD]/10" :
              getDominantSentiment() === "Mitigé" ? "bg-muted/20" :
              "bg-red-500/10"
            )}>
              <p className={cn(
                "text-lg font-bold",
                getDominantSentiment()?.includes("positif") ? "text-[#4CEFAD]" :
                getDominantSentiment() === "Mitigé" ? "text-muted-foreground" :
                "text-red-400"
              )}>
                {getDominantSentiment() || "Neutre"}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 h-3 bg-muted/30 rounded-full overflow-hidden">
              {sentimentBreakdown.positive > 0 && (
                <div 
                  className="bg-[#4CEFAD] h-full transition-all"
                  style={{ width: `${sentimentBreakdown.positive}%` }}
                />
              )}
              {sentimentBreakdown.neutral > 0 && (
                <div 
                  className="bg-muted-foreground/50 h-full transition-all"
                  style={{ width: `${sentimentBreakdown.neutral}%` }}
                />
              )}
              {sentimentBreakdown.negative > 0 && (
                <div 
                  className="bg-red-400 h-full transition-all"
                  style={{ width: `${sentimentBreakdown.negative}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#4CEFAD]">Positif: {sentimentBreakdown.positive}%</span>
              <span className="text-muted-foreground">Neutre: {sentimentBreakdown.neutral}%</span>
              <span className="text-red-400">Négatif: {sentimentBreakdown.negative}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ZONE 6 — PERFORMANCE PAR PLATEFORME */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Performance par plateforme</CardTitle>
          <CardDescription className="text-xs">Comparez votre réputation sur chaque plateforme</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {stats?.platformComparison && stats.platformComparison.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {stats.platformComparison.map((platform) => {
                const isWeakest = weakestPlatform?.platform === platform.platform;
                return (
                  <div
                    key={platform.platform}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                      isWeakest 
                        ? "border-orange-500/30 bg-orange-500/5" 
                        : "border-border/40 bg-muted/20 hover:bg-muted/30"
                    )}
                  >
                    <div className="p-2 rounded-lg bg-background/50">
                      {getPlatformIcon(platform.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium capitalize">{platform.platform}</p>
                        {isWeakest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">
                            Priorité
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 ml-auto">
                          {platform.trend > 0 ? (
                            <ArrowUpRight className="h-3 w-3 text-[#4CEFAD]" />
                          ) : platform.trend < 0 ? (
                            <ArrowDownRight className="h-3 w-3 text-red-400" />
                          ) : (
                            <Minus className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className={cn(
                            "text-[10px]",
                            platform.trend > 0 ? "text-[#4CEFAD]" :
                            platform.trend < 0 ? "text-red-400" :
                            "text-muted-foreground"
                          )}>
                            {platform.trend > 0 ? "+" : ""}{platform.trend.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {renderStars(Math.round(platform.score))}
                        <span className="text-[10px] text-muted-foreground">({platform.count})</span>
                      </div>
                      <p className="text-lg font-bold mt-0.5">{platform.score.toFixed(1)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-6 rounded-xl border border-dashed border-border/60 bg-muted/20">
              <p className="text-sm font-medium text-foreground/80">Aucune plateforme connectée</p>
              <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
                Configurez vos liens de plateformes dans les paramètres
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZONE 7 — ACTIONS PRIORITAIRES */}
      {priorityActions.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-[#C8B88A]" />
              À faire pour améliorer votre réputation
            </CardTitle>
            <CardDescription className="text-xs">Actions concrètes avec impact estimé</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {priorityActions.map((action, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "p-1.5 rounded",
                      action.impact === "high" ? "bg-[#4CEFAD]/10" :
                      action.impact === "medium" ? "bg-[#C8B88A]/10" :
                      "bg-orange-500/10"
                    )}>
                      <Target className={cn(
                        "h-3.5 w-3.5",
                        action.impact === "high" ? "text-[#4CEFAD]" :
                        action.impact === "medium" ? "text-[#C8B88A]" :
                        "text-orange-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground/90">{action.action}</p>
                      <p className="text-xs text-[#4CEFAD] mt-0.5">{action.points}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLocation(action.buttonPath)}
                    className="text-xs h-8 ml-3"
                  >
                    {action.buttonLabel}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ZONE 8 — IA */}
      <Card className="border-border/50 bg-gradient-to-br from-[#C8B88A]/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#C8B88A]" />
                Analyse intelligente de votre réputation
              </CardTitle>
              <CardDescription className="text-xs">
                Insights IA personnalisés pour votre activité
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateInsightsMutation.mutate()}
              disabled={generateInsightsMutation.isPending || !stats}
              className="text-xs"
            >
              {generateInsightsMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              Analyser ma réputation avec l'IA
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {aiInsights ? (
            aiInsights.error ? (
              <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <p className="text-sm text-muted-foreground">{aiInsights.error}</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {aiInsights.opportunities && (
                  <div className="p-4 rounded-xl bg-[#4CEFAD]/10 border border-[#4CEFAD]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-[#4CEFAD]" />
                      <h4 className="text-sm font-semibold text-[#4CEFAD]">Ce qui va bien</h4>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{aiInsights.opportunities}</p>
                  </div>
                )}
                {aiInsights.risks && (
                  <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                      <h4 className="text-sm font-semibold text-orange-400">Points à surveiller</h4>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{aiInsights.risks}</p>
                  </div>
                )}
                {aiInsights.actions && (
                  <div className="p-4 rounded-xl bg-[#C8B88A]/10 border border-[#C8B88A]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-[#C8B88A]" />
                      <h4 className="text-sm font-semibold text-[#C8B88A]">Actions prioritaires cette semaine</h4>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{aiInsights.actions}</p>
                  </div>
                )}
                {!aiInsights.opportunities && !aiInsights.risks && !aiInsights.actions && aiInsights.raw && (
                  <div className="p-4 rounded-xl bg-[#C8B88A]/10 border border-[#C8B88A]/20 col-span-3">
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{aiInsights.raw}</p>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="p-6 rounded-xl bg-muted/20 border border-border/30 text-center">
              <Sparkles className="h-8 w-8 text-[#C8B88A]/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Cliquez sur le bouton ci-dessus pour générer une analyse IA personnalisée de votre réputation
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
