/**
 * ReputationScoreCard - Score de réputation avec transparence et mode amélioration
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Award, HelpCircle, TrendingUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ReputationScoreCardProps {
  score: number; // 0-100
  breakdown?: {
    note: number;
    volume: number;
    responseRate: number;
    responseTime: number;
    sentiment: number;
  };
  stats?: {
    globalScore: number;
    totalReviews: number;
    responseRate: number;
    avgResponseTimeHours: number | null;
    sentimentDistribution?: Record<string, number>;
    unansweredReviews?: number;
  };
  className?: string;
}

export function ReputationScoreCard({ score, breakdown, stats, className }: ReputationScoreCardProps) {
  const [showImprovement, setShowImprovement] = useState(false);

  const getScoreColor = () => {
    if (score >= 80) return "text-[#4CEFAD]";
    if (score >= 60) return "text-[#C8B88A]";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreLabel = () => {
    if (score >= 80) return "Excellente";
    if (score >= 60) return "Bonne";
    if (score >= 40) return "Moyenne";
    return "À améliorer";
  };

  // Calculer les améliorations possibles
  const getImprovements = () => {
    const improvements = [];
    
    if (stats?.unansweredReviews && stats.unansweredReviews > 0) {
      const estimatedPoints = Math.min(15, stats.unansweredReviews * 2);
      improvements.push({
        action: `Répondre à ${stats.unansweredReviews} avis en attente`,
        points: `+${estimatedPoints} points estimés`,
        impact: "high",
      });
    }
    
    if (stats?.totalReviews && stats.totalReviews < 20) {
      const needed = 20 - stats.totalReviews;
      const estimatedPoints = Math.min(10, needed * 1.5);
      improvements.push({
        action: `Obtenir ${needed} nouveaux avis`,
        points: `+${estimatedPoints} points estimés`,
        impact: "medium",
      });
    }
    
    if (stats?.responseRate && stats.responseRate < 70) {
      const target = 70;
      const estimatedPoints = Math.min(12, (target - stats.responseRate) * 0.3);
      improvements.push({
        action: `Améliorer le taux de réponse à ${target}%`,
        points: `+${Math.round(estimatedPoints)} points estimés`,
        impact: "medium",
      });
    }
    
    if (stats?.avgResponseTimeHours && stats.avgResponseTimeHours > 48) {
      improvements.push({
        action: "Réduire le temps de réponse sous 24h",
        points: "+8 points estimés",
        impact: "low",
      });
    }
    
    return improvements.slice(0, 3); // Max 3 améliorations
  };

  // Générer le message explicatif (amélioré pour cohérence)
  const getExplanation = () => {
    if (!stats) return null;
    
    const parts = [];
    const sentimentPositive = stats.sentimentDistribution && 
      ((stats.sentimentDistribution.very_positive || 0) + (stats.sentimentDistribution.positive || 0)) > 
      ((stats.sentimentDistribution.negative || 0) + (stats.sentimentDistribution.very_negative || 0));
    
    const positivePercent = stats.sentimentDistribution ? 
      (((stats.sentimentDistribution.very_positive || 0) + (stats.sentimentDistribution.positive || 0)) / 
       (Object.values(stats.sentimentDistribution).reduce((a, b) => a + b, 0) || 1)) * 100 : 0;
    
    // Si sentiment très positif mais score moyen, expliquer pourquoi
    if (sentimentPositive && positivePercent >= 70 && score < 70) {
      const reasons = [];
      if (stats.totalReviews < 20) reasons.push("un faible volume d'avis");
      if (stats.responseRate < 70) reasons.push("un taux de réponse perfectible");
      if (stats.avgResponseTimeHours && stats.avgResponseTimeHours > 48) reasons.push("un temps de réponse à améliorer");
      
      if (reasons.length > 0) {
        return `Malgré un sentiment très positif, le score est impacté par ${reasons.join(" et ")}.`;
      }
    }
    
    // Cas général
    if (stats.totalReviews < 20) {
      parts.push("un faible volume d'avis");
    }
    
    if (stats.responseRate < 70) {
      parts.push("un taux de réponse encore perfectible");
    }
    
    if (stats.avgResponseTimeHours && stats.avgResponseTimeHours > 48) {
      parts.push("un temps de réponse à améliorer");
    }
    
    if (parts.length === 0) {
      return "Votre score reflète une bonne performance globale.";
    }
    
    return `Le score est ${parts.length > 1 ? "impacté par" : "limité par"} ${parts.join(" et ")}.`;
  };

  const improvements = getImprovements();
  const explanation = getExplanation();

  return (
    <Card className={cn(
      "bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[#C8B88A]" />
            <CardTitle className="text-base font-semibold">Score de réputation</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs mb-1 font-medium">Score basé sur :</p>
                  <ul className="text-[10px] space-y-0.5 text-muted-foreground">
                    <li>• Note moyenne</li>
                    <li>• Volume d'avis</li>
                    <li>• Taux de réponse</li>
                    <li>• Temps de réponse</li>
                    <li>• Sentiment global</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {improvements.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowImprovement(!showImprovement)}
              className="text-xs h-7"
            >
              {showImprovement ? "Masquer" : "Comment améliorer"}
              <ChevronRight className={cn("h-3 w-3 ml-1 transition-transform", showImprovement && "rotate-90")} />
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">Indicateur global de votre réputation en ligne</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="text-center">
          <p className={cn("text-5xl font-bold mb-1", getScoreColor())}>
            {Math.round(score)}
          </p>
          <p className="text-sm text-muted-foreground">/ 100</p>
          <p className={cn("text-xs font-medium mt-2", getScoreColor())}>
            Réputation {getScoreLabel()}
          </p>
        </div>
        <Progress value={score} className="h-2" />
        
        {explanation && (
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            {explanation}
          </p>
        )}
        
        {breakdown && (
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40">
            <div>
              <span className="text-muted-foreground">Note :</span>
              <span className="ml-2 font-medium">{Math.round(breakdown.note)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Volume :</span>
              <span className="ml-2 font-medium">{Math.round(breakdown.volume)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Réponse :</span>
              <span className="ml-2 font-medium">{Math.round(breakdown.responseRate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Délai :</span>
              <span className="ml-2 font-medium">{Math.round(breakdown.responseTime)}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Sentiment :</span>
              <span className="ml-2 font-medium">{Math.round(breakdown.sentiment)}</span>
            </div>
          </div>
        )}
        
        {showImprovement && improvements.length > 0 && (
          <div className="pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs font-medium text-foreground/90 mb-2">Actions pour améliorer votre score :</p>
            {improvements.map((improvement, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TrendingUp className={cn(
                    "h-3.5 w-3.5 flex-shrink-0",
                    improvement.impact === "high" ? "text-[#4CEFAD]" :
                    improvement.impact === "medium" ? "text-[#C8B88A]" :
                    "text-orange-400"
                  )} />
                  <p className="text-xs text-foreground/90 flex-1">{improvement.action}</p>
                </div>
                <span className="text-xs font-medium text-[#4CEFAD] ml-2">{improvement.points}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
