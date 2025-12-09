import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ShoppingCart, 
  Search, 
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  CreditCard,
  Store
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ExternalOrder {
  id: string;
  externalId: string;
  externalSource: string;
  orderNumber: string | null;
  orderType: string | null;
  status: string | null;
  subtotal: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  totalAmount: string;
  currency: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  itemsCount: number | null;
  items: any[] | null;
  channel: string | null;
  customerName: string | null;
  customerEmail: string | null;
  orderDate: string;
  createdAt: string;
}

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByChannel: Record<string, number>;
  revenueBySource: Record<string, number>;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "secondary" },
  confirmed: { label: "Confirmée", variant: "default" },
  completed: { label: "Terminée", variant: "default" },
  cancelled: { label: "Annulée", variant: "destructive" },
  refunded: { label: "Remboursée", variant: "outline" }
};

export default function IntegrationOrders() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState<"week" | "month" | "year" | "all">("month");

  const { data: orders, isLoading } = useQuery<ExternalOrder[]>({
    queryKey: ["/api/integrations/orders", { 
      source: sourceFilter !== "all" ? sourceFilter : undefined, 
      status: statusFilter !== "all" ? statusFilter : undefined 
    }],
  });

  const { data: stats } = useQuery<OrderStats>({
    queryKey: ["/api/integrations/orders/stats", { period }],
  });

  const formatCurrency = (amount: string | number | null) => {
    if (!amount) return "0 €";
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(numAmount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const uniqueSources = [...new Set(orders?.map(o => o.externalSource).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Commandes</h1>
          <p className="text-muted-foreground mt-1">
            Historique des transactions depuis toutes vos sources
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-[150px]" data-testid="select-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">7 jours</SelectItem>
            <SelectItem value="month">30 jours</SelectItem>
            <SelectItem value="year">12 mois</SelectItem>
            <SelectItem value="all">Tout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
              sur la période
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
              total encaissé
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Panier Moyen</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-order">
              {formatCurrency(stats?.avgOrderValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              par commande
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-sources-count">
              {Object.keys(stats?.revenueBySource || {}).length}
            </div>
            <p className="text-xs text-muted-foreground">
              connectées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Source */}
      {stats?.revenueBySource && Object.keys(stats.revenueBySource).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.revenueBySource).map(([source, revenue]) => (
                <div key={source} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Badge variant="outline" className="capitalize">{source}</Badge>
                  <span className="font-semibold text-[#C8B88A]">{formatCurrency(revenue)}</span>
                  <span className="text-sm text-muted-foreground">
                    ({stats.ordersByChannel?.[source] || 0} cmd)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro, client..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-orders"
                />
              </div>
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-source-filter">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sources</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source} className="capitalize">{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="confirmed">Confirmée</SelectItem>
                <SelectItem value="completed">Terminée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
                <SelectItem value="refunded">Remboursée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : orders && orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                    <TableCell>
                      <div className="font-medium">
                        {order.orderNumber || `#${order.externalId.slice(0, 8)}`}
                      </div>
                      {order.itemsCount && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {order.itemsCount} article(s)
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.customerName || order.customerEmail || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {order.externalSource}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.channel && (
                        <Badge variant="secondary" className="capitalize">
                          {order.channel}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.status && statusLabels[order.status] ? (
                        <Badge variant={statusLabels[order.status].variant}>
                          {statusLabels[order.status].label}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{order.status || "-"}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.paymentStatus && (
                        <div className="flex items-center gap-1 text-sm">
                          <CreditCard className="h-3 w-3" />
                          <span className="capitalize">{order.paymentStatus}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-[#C8B88A]">
                      {formatCurrency(order.totalAmount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(order.orderDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune commande</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Les commandes apparaîtront ici une fois que vous aurez synchronisé vos intégrations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
