import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Target,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Loader2,
  ChevronRight
} from "lucide-react";

interface Insight {
  id: string;
  type: 'performance' | 'trend' | 'alert' | 'opportunity';
  icon: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: string;
}

export default function RecommendationsPage() {
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const { data: insightsData, isLoading } = useQuery<{ insights: Insight[] }>({
    queryKey: ['/api/ai-insights'],
  });

  const insights = insightsData?.insights || [];

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { label: 'Prioritaire', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'medium':
        return { label: 'Important', color: 'text-[#C8B88A]', bg: 'bg-[#C8B88A]/10', border: 'border-[#C8B88A]/20' };
      default:
        return { label: 'À considérer', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' };
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'performance':
        return { label: 'Performance', icon: TrendingUp, color: '#C8B88A' };
      case 'trend':
        return { label: 'Tendance', icon: TrendingUp, color: '#A78BFA' };
      case 'alert':
        return { label: 'Attention', icon: AlertTriangle, color: '#F59E0B' };
      case 'opportunity':
        return { label: 'Opportunité', icon: Target, color: '#4CEFAD' };
      default:
        return { label: 'Insight', icon: Lightbulb, color: '#C8B88A' };
    }
  };

  const highPriorityInsights = insights.filter(i => i.priority === 'high');
  const otherInsights = insights.filter(i => i.priority !== 'high');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-violet-500/10">
              <Brain className="w-5 h-5 md:w-6 md:h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Recommandations</h1>
              <p className="text-sm text-muted-foreground">
                MEGIN analyse votre activité et vous guide
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400 mx-auto mb-4" />
              <p className="text-muted-foreground">MEGIN analyse vos données...</p>
            </div>
          </div>
        ) : insights.length === 0 ? (
          <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] border-white/[0.06]">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-2xl bg-violet-500/10 mb-4">
                <Sparkles className="w-10 h-10 text-violet-400/50" />
              </div>
              <h3 className="text-lg font-medium mb-2">Pas encore de recommandations</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                MEGIN a besoin de plus de données pour vous fournir des recommandations personnalisées. 
                Continuez à utiliser la plateforme et revenez bientôt.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Priority Actions */}
            {highPriorityInsights.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-500">
                    Actions prioritaires
                  </h2>
                </div>
                <div className="space-y-3">
                  {highPriorityInsights.map((insight) => {
                    const typeConfig = getTypeConfig(insight.type);
                    const TypeIcon = typeConfig.icon;
                    
                    return (
                      <Card 
                        key={insight.id}
                        className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.06)]"
                        data-testid={`insight-priority-${insight.id}`}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 flex-shrink-0">
                              <TypeIcon className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                                  Prioritaire
                                </Badge>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                  {typeConfig.label}
                                </span>
                              </div>
                              <p className="text-[15px] text-foreground leading-relaxed mb-3">
                                {insight.text}
                              </p>
                              {insight.actionable && insight.action && (
                                <Button 
                                  size="sm" 
                                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/30"
                                  data-testid={`button-action-${insight.id}`}
                                >
                                  {insight.action}
                                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Other Insights */}
            {otherInsights.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-4 h-4 text-[#C8B88A]" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Insights & Tendances
                  </h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {otherInsights.map((insight) => {
                    const typeConfig = getTypeConfig(insight.type);
                    const priorityConfig = getPriorityConfig(insight.priority);
                    const TypeIcon = typeConfig.icon;
                    const isExpanded = expandedInsight === insight.id;
                    
                    return (
                      <Card 
                        key={insight.id}
                        className={`bg-[#1A1C1F] border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer ${isExpanded ? priorityConfig.border : ''}`}
                        onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                        data-testid={`insight-${insight.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${priorityConfig.bg} flex-shrink-0`}>
                              <TypeIcon className="w-4 h-4" style={{ color: typeConfig.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider" style={{ color: typeConfig.color }}>
                                  {typeConfig.label}
                                </span>
                                <Badge variant="outline" className={`text-[9px] ${priorityConfig.color} border-current/20`}>
                                  {priorityConfig.label}
                                </Badge>
                              </div>
                              <p className={`text-sm text-foreground/90 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                {insight.text}
                              </p>
                              {isExpanded && insight.actionable && insight.action && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="mt-3 text-[#C8B88A] hover:text-[#D4C89A] hover:bg-[#C8B88A]/10"
                                  data-testid={`button-action-${insight.id}`}
                                >
                                  {insight.action}
                                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Summary Card */}
            <Card className="bg-gradient-to-br from-violet-500/5 to-[#151618] border-violet-500/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-violet-500/10">
                    <Sparkles className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-1">MEGIN veille sur vous</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Ces recommandations sont générées automatiquement en analysant votre activité. 
                      Plus vous utilisez MEGIN, plus les insights seront précis et personnalisés.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
