import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info } from "lucide-react";

type MetricType = 'volume' | 'conversion' | 'timeslots' | 'duration';
type TimeFilter = 'hour' | 'today' | 'two_days' | 'week' | undefined;
type Severity = 'success' | 'warning' | 'info' | 'critical';

interface DeepInsight {
  title: string;
  summary: string;
  details: string[];
  recommendation: string;
  severity: Severity;
  metrics: Array<{ label: string; value: string }>;
}

interface AnalyticsDialogProps {
  metric: MetricType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeFilter?: TimeFilter;
}

const metricTitles: Record<MetricType, string> = {
  volume: "Volume d'appels",
  conversion: "Taux de conversion",
  timeslots: "Plages horaires",
  duration: "Durée moyenne"
};

const severityConfig: Record<Severity, { icon: typeof TrendingUp; variant: 'default' | 'destructive' | 'outline' | 'secondary' }> = {
  success: { 
    icon: CheckCircle, 
    variant: 'default'
  },
  warning: { 
    icon: AlertTriangle, 
    variant: 'outline'
  },
  info: { 
    icon: Info, 
    variant: 'secondary'
  },
  critical: { 
    icon: TrendingDown, 
    variant: 'destructive'
  }
};

export function AnalyticsDialog({ metric, open, onOpenChange, timeFilter }: AnalyticsDialogProps) {
  const { data: insight, isLoading } = useQuery<DeepInsight>({
    queryKey: ['/api/analytics', metric, timeFilter],
    queryFn: async () => {
      if (!metric) throw new Error('Metric is required');
      const params = new URLSearchParams();
      if (timeFilter) params.set('timeFilter', timeFilter);
      const url = `/api/analytics/${metric}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    enabled: open && !!metric,
  });

  const SeverityIcon = insight ? severityConfig[insight.severity].icon : Info;
  const badgeVariant = insight ? severityConfig[insight.severity].variant : 'secondary';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid={`dialog-analytics-${metric}`}>
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {metric && metricTitles[metric]}
          </DialogTitle>
          <DialogDescription>
            Analyse approfondie générée par l'IA
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : insight ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Résumé</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base text-foreground">{insight.summary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Métriques Clés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {insight.metrics.map((m, idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-sm text-muted-foreground">{m.label}</p>
                      <p className="text-2xl font-semibold" data-testid={`metric-${idx}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {insight.details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Analyse Détaillée</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {insight.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-sm text-foreground">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Recommandation</CardTitle>
                  <Badge variant={badgeVariant} className="flex items-center gap-1">
                    <SeverityIcon className="h-3 w-3" />
                    {insight.severity === 'success' ? 'Optimal' : 
                     insight.severity === 'warning' ? 'Attention' : 
                     insight.severity === 'critical' ? 'Critique' : 'Info'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-base text-foreground">{insight.recommendation}</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Aucune donnée disponible</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
