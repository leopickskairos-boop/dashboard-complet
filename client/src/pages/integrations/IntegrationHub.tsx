import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Database, 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Plug, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
  Activity
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface IntegrationStats {
  totalConnections: number;
  activeConnections: number;
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  lastSyncAt: string | null;
  syncErrorsLast24h: number;
  customersBySource: Record<string, number>;
  revenueBySource: Record<string, number>;
}

export default function IntegrationHub() {
  const { data: stats, isLoading } = useQuery<IntegrationStats>({
    queryKey: ["/api/integrations/stats"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Jamais";
    return new Date(dateStr).toLocaleString('fr-FR');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hub d'Intégrations</h1>
          <p className="text-muted-foreground mt-1">
            Connectez vos CRM, bases de données et systèmes métier
          </p>
        </div>
        <Link href="/integrations/connections">
          <Button data-testid="button-add-connection">
            <Plug className="h-4 w-4 mr-2" />
            Ajouter une connexion
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Connexions Actives</CardTitle>
                <Plug className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-connections">
                  {stats?.activeConnections || 0} / {stats?.totalConnections || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.syncErrorsLast24h ? (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {stats.syncErrorsLast24h} erreur(s) 24h
                    </span>
                  ) : (
                    <span className="text-green-500 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Tout fonctionne
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Clients Synchronisés</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-customers">
                  {stats?.totalCustomers?.toLocaleString('fr-FR') || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Depuis {Object.keys(stats?.customersBySource || {}).length} source(s)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-orders">
                  {stats?.totalOrders?.toLocaleString('fr-FR') || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Toutes sources confondues
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#C8B88A]" data-testid="text-total-revenue">
                  {formatCurrency(stats?.totalRevenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cumulé depuis les intégrations
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Last Sync Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Dernière synchronisation</CardTitle>
                  <CardDescription>{formatDate(stats?.lastSyncAt || null)}</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid="button-sync-all">
                <RefreshCw className="h-4 w-4 mr-2" />
                Synchroniser tout
              </Button>
            </CardHeader>
          </Card>

          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/integrations/connections">
              <Card className="hover-elevate cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Connexions</CardTitle>
                      <CardDescription>Gérer vos CRM et bases de données</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {Object.keys(stats?.customersBySource || {}).slice(0, 3).map(source => (
                      <Badge key={source} variant="secondary">{source}</Badge>
                    ))}
                    {(stats?.totalConnections || 0) === 0 && (
                      <Badge variant="outline">Aucune connexion</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/integrations/customers">
              <Card className="hover-elevate cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#4CEFAD]/10">
                      <Users className="h-6 w-6 text-[#4CEFAD]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Clients</CardTitle>
                      <CardDescription>Vue unifiée de vos clients</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.totalCustomers?.toLocaleString('fr-FR') || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">clients synchronisés</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/integrations/orders">
              <Card className="hover-elevate cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#C8B88A]/10">
                      <ShoppingCart className="h-6 w-6 text-[#C8B88A]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Commandes</CardTitle>
                      <CardDescription>Historique des transactions</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats?.totalRevenue || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">de chiffre d'affaires</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Revenue by Source */}
          {stats?.revenueBySource && Object.keys(stats.revenueBySource).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Répartition du CA par source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stats.revenueBySource).map(([source, revenue]) => {
                    const percentage = stats.totalRevenue > 0 
                      ? (revenue / stats.totalRevenue) * 100 
                      : 0;
                    return (
                      <div key={source} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">{source}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {stats.customersBySource?.[source] || 0} clients
                            </span>
                          </div>
                          <span className="font-semibold">{formatCurrency(revenue)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full bg-[#C8B88A] rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {(stats?.totalConnections || 0) === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Aucune intégration configurée</h3>
                <p className="text-muted-foreground text-center mb-4 max-w-md">
                  Connectez vos CRM, systèmes de réservation ou bases de données pour centraliser 
                  toutes vos données clients et transactions dans SpeedAI.
                </p>
                <Link href="/integrations/connections">
                  <Button data-testid="button-setup-first-integration">
                    <Plug className="h-4 w-4 mr-2" />
                    Configurer ma première intégration
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
