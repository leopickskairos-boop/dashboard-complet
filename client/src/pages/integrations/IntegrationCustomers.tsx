import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Search, 
  Filter,
  Mail,
  Phone,
  Building,
  DollarSign,
  ShoppingCart,
  Calendar,
  TrendingUp,
  Star,
  Clock
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ExternalCustomer {
  id: string;
  externalId: string | null;
  externalSource: string | null;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  totalSpent: string;
  totalOrders: number;
  avgOrderValue: string | null;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  lifetimeValue: string;
  customerScore: number | null;
  customerSegment: string | null;
  totalVisits: number;
  createdAt: string;
}

interface ExternalOrder {
  id: string;
  orderNumber: string | null;
  orderType: string | null;
  status: string | null;
  totalAmount: string;
  orderDate: string;
  items: any[] | null;
  channel: string | null;
}

interface ExternalActivity {
  id: string;
  activityType: string;
  subject: string | null;
  description: string | null;
  activityDate: string;
  outcome: string | null;
}

interface CustomerDetail extends ExternalCustomer {
  orders: ExternalOrder[];
  activities: ExternalActivity[];
}

const segmentLabels: Record<string, { label: string; color: string }> = {
  vip: { label: "VIP", color: "bg-[#C8B88A] text-black" },
  regular: { label: "Régulier", color: "bg-blue-500" },
  new: { label: "Nouveau", color: "bg-green-500" },
  at_risk: { label: "À risque", color: "bg-orange-500" },
  lost: { label: "Perdu", color: "bg-red-500" }
};

export default function IntegrationCustomers() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery<ExternalCustomer[]>({
    queryKey: ["/api/integrations/customers", { search, source: sourceFilter !== "all" ? sourceFilter : undefined, segment: segmentFilter !== "all" ? segmentFilter : undefined }],
  });

  const { data: customerDetail, isLoading: loadingDetail } = useQuery<CustomerDetail>({
    queryKey: ["/api/integrations/customers", selectedCustomer],
    enabled: !!selectedCustomer,
  });

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "0 €";
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(amount));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const uniqueSources = [...new Set(customers?.map(c => c.externalSource).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">
            Vue unifiée de vos clients depuis toutes les sources
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email, téléphone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-customers"
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
                  <SelectItem key={source} value={source!} className="capitalize">{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-segment-filter">
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous segments</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="regular">Régulier</SelectItem>
                <SelectItem value="new">Nouveau</SelectItem>
                <SelectItem value="at_risk">À risque</SelectItem>
                <SelectItem value="lost">Perdu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : customers && customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Dépensé</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="text-right">Panier moyen</TableHead>
                  <TableHead>Dernière commande</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow 
                    key={customer.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedCustomer(customer.id)}
                    data-testid={`row-customer-${customer.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {customer.firstName || customer.lastName 
                              ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                              : customer.email || "Client inconnu"
                            }
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            {customer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {customer.externalSource || "Manuel"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {customer.customerSegment && segmentLabels[customer.customerSegment] ? (
                        <Badge className={segmentLabels[customer.customerSegment].color}>
                          {segmentLabels[customer.customerSegment].label}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Non classé</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-[#C8B88A]">
                      {formatCurrency(customer.totalSpent)}
                    </TableCell>
                    <TableCell className="text-right">
                      {customer.totalOrders}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(customer.avgOrderValue)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(customer.lastOrderAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun client</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Les clients apparaîtront ici une fois que vous aurez configuré et synchronisé une intégration.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {loadingDetail ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : customerDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xl">
                      {customerDetail.firstName || customerDetail.lastName 
                        ? `${customerDetail.firstName || ""} ${customerDetail.lastName || ""}`.trim()
                        : "Client"
                      }
                    </div>
                    {customerDetail.customerSegment && segmentLabels[customerDetail.customerSegment] && (
                      <Badge className={segmentLabels[customerDetail.customerSegment].color}>
                        {segmentLabels[customerDetail.customerSegment].label}
                      </Badge>
                    )}
                  </div>
                </DialogTitle>
                <DialogDescription className="flex flex-wrap gap-4 mt-2">
                  {customerDetail.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" /> {customerDetail.email}
                    </span>
                  )}
                  {customerDetail.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {customerDetail.phone}
                    </span>
                  )}
                  {customerDetail.companyName && (
                    <span className="flex items-center gap-1">
                      <Building className="h-4 w-4" /> {customerDetail.companyName}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4 my-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <DollarSign className="h-4 w-4" /> Total dépensé
                    </div>
                    <div className="text-2xl font-bold text-[#C8B88A]">
                      {formatCurrency(customerDetail.totalSpent)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <ShoppingCart className="h-4 w-4" /> Commandes
                    </div>
                    <div className="text-2xl font-bold">
                      {customerDetail.totalOrders}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <TrendingUp className="h-4 w-4" /> Panier moyen
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(customerDetail.avgOrderValue)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Star className="h-4 w-4" /> Score
                    </div>
                    <div className="text-2xl font-bold">
                      {customerDetail.customerScore || "-"}/100
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="orders">
                <TabsList>
                  <TabsTrigger value="orders">
                    Commandes ({customerDetail.orders?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="activities">
                    Activités ({customerDetail.activities?.length || 0})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="orders" className="mt-4">
                  {customerDetail.orders && customerDetail.orders.length > 0 ? (
                    <div className="space-y-3">
                      {customerDetail.orders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <div className="font-medium">
                              {order.orderNumber || `Commande #${order.id.slice(0, 8)}`}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {formatDate(order.orderDate)}
                              {order.channel && (
                                <Badge variant="outline" className="text-xs">{order.channel}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-[#C8B88A]">
                              {formatCurrency(order.totalAmount)}
                            </div>
                            {order.status && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {order.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Aucune commande enregistrée
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="activities" className="mt-4">
                  {customerDetail.activities && customerDetail.activities.length > 0 ? (
                    <div className="space-y-3">
                      {customerDetail.activities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                          <div className="p-2 rounded-lg bg-muted">
                            <Clock className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium capitalize">{activity.activityType}</div>
                            {activity.subject && (
                              <div className="text-sm">{activity.subject}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(activity.activityDate)}
                            </div>
                          </div>
                          {activity.outcome && (
                            <Badge variant="outline">{activity.outcome}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Aucune activité enregistrée
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
