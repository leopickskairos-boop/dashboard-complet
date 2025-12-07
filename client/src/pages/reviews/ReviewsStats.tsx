import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Statistiques des avis</h1>
          <p className="text-muted-foreground">Analysez votre réputation en ligne</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]" data-testid="select-period">
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-[#C8B88A]/10">
                <Star className="h-6 w-6 text-[#C8B88A]" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats?.globalScore?.toFixed(1) || "-"}</p>
                <p className="text-sm text-muted-foreground">Note globale</p>
              </div>
            </div>
            <div className="mt-3">
              {renderStars(Math.round(stats?.globalScore || 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-[#4CEFAD]/10">
                <MessageSquare className="h-6 w-6 text-[#4CEFAD]" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats?.totalReviews || 0}</p>
                <p className="text-sm text-muted-foreground">Avis total</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              +{stats?.newReviewsPeriod || 0} nouveaux sur la période
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats?.responseRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Taux de réponse</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Award className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {stats?.ratingDistribution?.[5] || 0}
                </p>
                <p className="text-sm text-muted-foreground">Avis 5 étoiles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribution des notes</CardTitle>
            <CardDescription>Répartition des avis par note</CardDescription>
          </CardHeader>
          <CardContent>
            {ratingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ratingChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#666" />
                  <YAxis dataKey="rating" type="category" stroke="#666" width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="count" fill="#C8B88A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analyse des sentiments</CardTitle>
            <CardDescription>Tonalité générale des avis (IA)</CardDescription>
          </CardHeader>
          <CardContent>
            {sentimentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sentimentChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {sentimentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance par plateforme</CardTitle>
          <CardDescription>Comparaison des notes entre plateformes</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.platforms && Object.keys(stats.platforms).length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(stats.platforms).map(([platform, data]) => (
                <div
                  key={platform}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
                >
                  {getPlatformIcon(platform)}
                  <div className="flex-1">
                    <p className="font-medium capitalize">{platform}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(Math.round(data.score))}
                      <span className="text-sm text-muted-foreground">
                        ({data.count} avis)
                      </span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{data.score.toFixed(1)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune plateforme connectée</p>
              <p className="text-sm mt-1">
                Configurez vos liens de plateformes dans les paramètres
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
