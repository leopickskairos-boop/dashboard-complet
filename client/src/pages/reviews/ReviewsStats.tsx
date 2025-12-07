import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, TrendingUp, MessageSquare, Award, Loader2 } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export default function ReviewsStats() {
  const [period, setPeriod] = useState<string>("month");

  const { data: stats, isLoading } = useQuery<{
    globalScore: number;
    totalReviews: number;
    newReviewsPeriod: number;
    responseRate: number;
    platforms: Record<string, { score: number; count: number }>;
    ratingDistribution: Record<number, number>;
    sentimentDistribution: Record<string, number>;
  }>({
    queryKey: ["/api/reviews/stats", { period }],
    queryFn: async () => {
      const response = await fetch(`/api/reviews/stats?period=${period}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
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

      {/* KPI Grid */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
          <div className="flex items-center gap-2.5">
            <Star className="h-4 w-4 text-[#C8B88A]/70" />
            <div>
              <p className="text-xl font-semibold">{stats?.globalScore?.toFixed(1) || "-"}</p>
              <p className="text-[10px] text-muted-foreground">Note globale</p>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className={`h-3 w-3 ${star <= Math.round(stats?.globalScore || 0) ? "text-[#C8B88A] fill-[#C8B88A]" : "text-muted-foreground/30"}`} />
            ))}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="h-4 w-4 text-[#4CEFAD]/70" />
            <div>
              <p className="text-xl font-semibold">{stats?.totalReviews || 0}</p>
              <p className="text-[10px] text-muted-foreground">Avis total</p>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground/60">+{stats?.newReviewsPeriod || 0} nouveaux</p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-4 w-4 text-blue-400/70" />
            <div>
              <p className="text-xl font-semibold">{stats?.responseRate || 0}%</p>
              <p className="text-[10px] text-muted-foreground">Taux de réponse</p>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
          <div className="flex items-center gap-2.5">
            <Award className="h-4 w-4 text-purple-400/70" />
            <div>
              <p className="text-xl font-semibold">{stats?.ratingDistribution?.[5] || 0}</p>
              <p className="text-[10px] text-muted-foreground">Avis 5 étoiles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2 pl-1">
            <Star className="h-3.5 w-3.5 text-muted-foreground/50" />
            <h2 className="text-sm font-medium text-foreground/90">Distribution des notes</h2>
          </div>
          <div className="p-4 rounded-xl border border-border/30 bg-muted/5">
            {ratingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ratingChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis type="number" stroke="#444" tick={{ fontSize: 9 }} />
                  <YAxis dataKey="rating" type="category" stroke="#444" width={65} tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0E1015", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }} labelStyle={{ color: "#fff" }} />
                  <Bar dataKey="count" fill="#C8B88A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex flex-col items-center justify-center">
                <Star className="h-4 w-4 text-muted-foreground/30 mb-2" />
                <p className="text-[11px] text-muted-foreground">Aucune donnée</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 pl-1">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50" />
            <h2 className="text-sm font-medium text-foreground/90">Analyse des sentiments</h2>
          </div>
          <div className="p-4 rounded-xl border border-border/30 bg-muted/5">
            {sentimentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={sentimentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {sentimentChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0E1015", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }} />
                  <Legend wrapperStyle={{ fontSize: "9px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex flex-col items-center justify-center">
                <MessageSquare className="h-4 w-4 text-muted-foreground/30 mb-2" />
                <p className="text-[11px] text-muted-foreground">Aucune analyse</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-border/30" />

      {/* Platform Performance */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pl-1">
          <SiGoogle className="h-3.5 w-3.5 text-muted-foreground/50" />
          <h2 className="text-sm font-medium text-foreground/90">Performance par plateforme</h2>
        </div>
        {stats?.platforms && Object.keys(stats.platforms).length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(stats.platforms).map(([platform, data]) => (
              <div key={platform} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors">
                {getPlatformIcon(platform)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium capitalize">{platform}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`h-2.5 w-2.5 ${star <= Math.round(data.score) ? "text-[#C8B88A] fill-[#C8B88A]" : "text-muted-foreground/30"}`} />
                    ))}
                    <span className="text-[9px] text-muted-foreground ml-0.5">({data.count})</span>
                  </div>
                  <p className="text-base font-semibold mt-0.5">{data.score.toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-border/30 bg-muted/10">
            <MessageSquare className="h-4 w-4 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Aucune plateforme configurée</p>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="h-px bg-border/30" />

      {/* Insights Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pl-1">
          <TrendingUp className="h-3.5 w-3.5 text-[#C8B88A]/60" />
          <h2 className="text-sm font-medium text-foreground/90">Insights</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="p-3 rounded-xl bg-muted/10 border border-border/30">
            <div className="flex items-center gap-2 mb-1.5">
              <MessageSquare className="h-3 w-3 text-[#4CEFAD]/70" />
              <span className="text-[11px] font-medium">Réactivité</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Répondez aux avis dans les 24h pour montrer votre engagement.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/10 border border-border/30">
            <div className="flex items-center gap-2 mb-1.5">
              <Star className="h-3 w-3 text-[#C8B88A]/70" />
              <span className="text-[11px] font-medium">Qualité</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Encouragez les clients satisfaits à laisser un avis.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/10 border border-border/30">
            <div className="flex items-center gap-2 mb-1.5">
              <Award className="h-3 w-3 text-blue-400/70" />
              <span className="text-[11px] font-medium">Visibilité</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Diversifiez vos plateformes d'avis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
