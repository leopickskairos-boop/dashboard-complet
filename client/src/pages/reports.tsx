import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Calendar, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const date = parseISO(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDate(dateStr: string | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return "Date inconnue";
  return format(date, "dd/MM/yyyy à HH:mm", { locale: fr });
}

interface MonthlyReportRow {
  id: number;
  user_id: number;
  report_month: string;
  status: "pending" | "generating" | "pdf_generated" | "sent" | "failed";
  pdf_path: string | null;
  sent_at: string | null;
  created_at: string;
  metrics_json: unknown;
}

function getStatusBadge(status: MonthlyReportRow["status"]) {
  switch (status) {
    case "sent":
      return (
        <Badge variant="default" className="bg-green-600 text-white" data-testid="badge-status-sent">
          <CheckCircle className="h-3 w-3 mr-1" />
          Envoyé
        </Badge>
      );
    case "pdf_generated":
      return (
        <Badge variant="default" className="bg-yellow-600 text-white" data-testid="badge-status-pdf">
          <FileText className="h-3 w-3 mr-1" />
          PDF prêt
        </Badge>
      );
    case "generating":
      return (
        <Badge variant="secondary" data-testid="badge-status-generating">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          En cours
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" data-testid="badge-status-pending">
          <Clock className="h-3 w-3 mr-1" />
          En attente
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" data-testid="badge-status-failed">
          <AlertCircle className="h-3 w-3 mr-1" />
          Échec
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatReportMonth(reportMonth: string | null | undefined) {
  if (!reportMonth) return "Période inconnue";
  let year: string, month: string;
  if (reportMonth.includes("-")) {
    [year, month] = reportMonth.split("-");
  } else if (reportMonth.length === 6) {
    year = reportMonth.substring(0, 4);
    month = reportMonth.substring(4, 6);
  } else {
    return "Période inconnue";
  }
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  if (isNaN(date.getTime())) return "Période inconnue";
  return format(date, "MMMM yyyy", { locale: fr });
}

export default function ReportsPage() {
  const { data: reports, isLoading, error } = useQuery<MonthlyReportRow[]>({
    queryKey: ["/api/reports"],
  });

  const handleDownload = async (reportId: number) => {
    window.open(`/api/reports/${reportId}/download`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-[#C8B88A]" />
          <h1 className="text-2xl font-bold" data-testid="text-reports-title">Rapports Mensuels</h1>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-[#C8B88A]" />
          <h1 className="text-2xl font-bold" data-testid="text-reports-title">Rapports Mensuels</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8 text-muted-foreground" data-testid="text-error-message">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Impossible de charger les rapports</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-[#C8B88A]" />
        <h1 className="text-2xl font-bold" data-testid="text-reports-title">Rapports Mensuels</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historique des rapports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-reports">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">Aucun rapport disponible</p>
              <p className="text-sm">Les rapports mensuels seront générés automatiquement à la fin de chaque mois.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate transition-colors"
                  data-testid={`row-report-${report.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-[#C8B88A]/10">
                      <FileText className="h-6 w-6 text-[#C8B88A]" />
                    </div>
                    <div>
                      <p className="font-medium capitalize" data-testid={`text-report-period-${report.id}`}>
                        {formatReportMonth(report.report_month)}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid={`text-report-date-${report.id}`}>
                        Créé le {formatDate(report.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {getStatusBadge(report.status)}
                    
                    {(report.status === "pdf_generated" || report.status === "sent") && report.pdf_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(report.id)}
                        data-testid={`button-download-${report.id}`}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
