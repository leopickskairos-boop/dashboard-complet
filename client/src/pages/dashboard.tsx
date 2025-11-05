import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Clock, TrendingUp, Users } from "lucide-react";

export default function Dashboard() {
  // In the future, this will fetch real call data
  const { data: stats } = useQuery({
    queryKey: ['/api/stats'],
    enabled: false, // Disabled for now - will be enabled when backend is ready
  });

  // Empty state - will be replaced with real data later
  const isEmpty = true;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de votre activité
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Appels total
              </div>
              <div className="text-3xl font-bold" data-testid="stat-total-calls">
                0
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Durée moyenne
              </div>
              <div className="text-3xl font-bold" data-testid="stat-avg-duration">
                0m
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Taux de réponse
              </div>
              <div className="text-3xl font-bold" data-testid="stat-response-rate">
                0%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Appelants uniques
              </div>
              <div className="text-3xl font-bold" data-testid="stat-unique-callers">
                0
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call History Section */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des appels</CardTitle>
            <CardDescription>
              Tous vos appels avec résumés IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEmpty ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Aucun appel pour le moment</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Vos appels apparaîtront ici une fois que votre système IA sera configuré et actif.
                </p>
                <Button data-testid="button-setup">
                  Configurer mon système
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Table will go here when we have data */}
                <p className="text-muted-foreground">Chargement des données...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
