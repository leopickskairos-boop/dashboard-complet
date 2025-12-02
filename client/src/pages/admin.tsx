import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Shield, UserX, UserCheck, Trash2, Calendar, Phone, Clock, Activity, Search, FileText, Code, Eye, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { N8NLogWithMetadata } from "@shared/schema";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  subscriptionStatus: string;
  accountStatus: string;
  plan: string | null;
  countdownEnd: string | null;
  createdAt: string;
  totalCalls: number;
  totalMinutes: number;
  lastActivity: string | null;
  healthStatus: 'green' | 'orange' | 'red';
}

export default function AdminPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // N8N Logs states
  const [logsUserFilter, setLogsUserFilter] = useState<string>("all");
  const [logsEventFilter, setLogsEventFilter] = useState<string>("all");
  const [logsDateFilter, setLogsDateFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<N8NLogWithMetadata | null>(null);

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/admin/users/${userId}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Compte suspendu avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de suspendre le compte",
        variant: "destructive",
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/admin/users/${userId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Compte activé avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'activer le compte",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Compte supprimé avec succès" });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le compte",
        variant: "destructive",
      });
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: ({ userId, plan }: { userId: string; plan: string | null }) => 
      apiRequest("POST", `/api/admin/users/${userId}/assign-plan`, { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Plan assigné avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'assigner le plan",
        variant: "destructive",
      });
    },
  });

  // Fetch N8N logs for all clients (admin only)
  const { data: logsData, isLoading: logsLoading } = useQuery<{
    logs: N8NLogWithMetadata[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ['/api/admin/logs', logsUserFilter, logsEventFilter, logsDateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // User filter
      if (logsUserFilter && logsUserFilter !== 'all') {
        params.set('userId', logsUserFilter);
      }
      
      // Event filter
      if (logsEventFilter && logsEventFilter !== 'all') {
        params.set('event', logsEventFilter);
      }
      
      // Date filter
      if (logsDateFilter && logsDateFilter !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;
        
        switch (logsDateFilter) {
          case 'hour':
            startDate = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'two_days':
            startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        }
        
        if (startDate) {
          params.set('startDate', startDate.toISOString());
        }
      }
      
      params.set('limit', '100');
      
      const res = await fetch(`/api/admin/logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json();
    },
  });

  const logs = logsData?.logs || [];

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Accès refusé
            </CardTitle>
            <CardDescription>
              Cette section est réservée aux administrateurs.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const filteredUsers = users?.filter((u) => {
    if (statusFilter !== "all" && u.accountStatus !== statusFilter) return false;
    if (planFilter !== "all" && u.subscriptionStatus !== planFilter) return false;
    if (healthFilter !== "all" && u.healthStatus !== healthFilter) return false;
    return true;
  });

  const getHealthBadge = (status: 'green' | 'orange' | 'red') => {
    const colors = {
      green: "bg-green-500",
      orange: "bg-orange-500",
      red: "bg-red-500",
    };
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
        <span className="text-xs capitalize">{status === 'green' ? 'Optimal' : status === 'orange' ? 'Attention' : 'Critique'}</span>
      </div>
    );
  };

  const getSubscriptionBadge = (status: string) => {
    if (status === "active") {
      return <Badge variant="default" className="bg-green-600">Actif</Badge>;
    } else if (status === "none") {
      return <Badge variant="secondary">Gratuit</Badge>;
    } else {
      return <Badge variant="destructive">Expiré</Badge>;
    }
  };

  const getPlanName = (plan: string | null) => {
    if (!plan) return "Aucun";
    if (plan === "basic") return "Basic (400€)";
    if (plan === "standard") return "Standard (800€)";
    if (plan === "premium") return "Premium (1000€)";
    return plan;
  };

  const getAccountStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge variant="outline" className="border-green-600 text-green-600">Actif</Badge>;
    } else {
      return <Badge variant="destructive">Suspendu</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Panneau d'administration
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez tous les utilisateurs de la plateforme
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utilisateurs ({filteredUsers?.length || 0})</CardTitle>
              <CardDescription>
                Liste complète des utilisateurs avec indicateurs de santé
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Rechercher un email..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-email"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Statut compte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="suspended">Suspendus</SelectItem>
                </SelectContent>
              </Select>

              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-40" data-testid="select-plan-filter">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les plans</SelectItem>
                  <SelectItem value="active">Payant</SelectItem>
                  <SelectItem value="none">Gratuit</SelectItem>
                </SelectContent>
              </Select>

              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger className="w-40" data-testid="select-health-filter">
                  <SelectValue placeholder="Santé" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="green">🟢 Optimal</SelectItem>
                  <SelectItem value="orange">🟠 Attention</SelectItem>
                  <SelectItem value="red">🔴 Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Santé</TableHead>
                    <TableHead className="text-center">Appels</TableHead>
                    <TableHead className="text-center">Minutes</TableHead>
                    <TableHead>Inscription</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((u) => (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {u.role === "admin" && (
                            <Shield className="w-4 h-4 text-primary" />
                          )}
                          {u.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.plan || "none"}
                          onValueChange={(plan) => {
                            const planValue = plan === "none" ? null : plan;
                            assignPlanMutation.mutate({ userId: u.id, plan: planValue });
                          }}
                          disabled={assignPlanMutation.isPending || u.id === user?.id}
                        >
                          <SelectTrigger className="w-40" data-testid={`select-plan-${u.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            <SelectItem value="basic">Basic (400€)</SelectItem>
                            <SelectItem value="standard">Standard (800€)</SelectItem>
                            <SelectItem value="premium">Premium (1000€)</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{getAccountStatusBadge(u.accountStatus)}</TableCell>
                      <TableCell>{getHealthBadge(u.healthStatus)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {u.totalCalls}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {u.totalMinutes}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {format(new Date(u.createdAt), "dd/MM/yyyy", { locale: fr })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.lastActivity ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Activity className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(u.lastActivity), "dd/MM/yyyy HH:mm", { locale: fr })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aucune</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {u.accountStatus === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => suspendMutation.mutate(u.id)}
                              disabled={suspendMutation.isPending || u.id === user?.id}
                              data-testid={`button-suspend-${u.id}`}
                            >
                              <UserX className="w-3 h-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activateMutation.mutate(u.id)}
                              disabled={activateMutation.isPending}
                              data-testid={`button-activate-${u.id}`}
                            >
                              <UserCheck className="w-3 h-3" />
                            </Button>
                          )}
                          {u.id !== user?.id && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedUserId(u.id);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${u.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* N8N Logs Section */}
      <Card className="mb-12">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <CardTitle>Logs N8N</CardTitle>
                <CardDescription>
                  Historique des événements reçus de tous les clients
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={logsUserFilter} onValueChange={setLogsUserFilter}>
                <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-logs-user-filter">
                  <SelectValue placeholder="Tous les clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clients</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={logsDateFilter} onValueChange={setLogsDateFilter}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-logs-date-filter">
                  <SelectValue placeholder="Toutes les périodes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les périodes</SelectItem>
                  <SelectItem value="hour">Il y a 1h</SelectItem>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="two_days">Il y a 2 jours</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logsEventFilter} onValueChange={setLogsEventFilter}>
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-logs-event-filter">
                  <SelectValue placeholder="Tous les événements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les événements</SelectItem>
                  <SelectItem value="test_connection">Test de connexion</SelectItem>
                  <SelectItem value="call_started">Appel démarré</SelectItem>
                  <SelectItem value="call_ended">Appel terminé</SelectItem>
                  <SelectItem value="webhook_received">Webhook reçu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Aucun log disponible</p>
              <p className="text-sm text-muted-foreground">
                Les logs N8N apparaîtront ici automatiquement
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Événement</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log, index) => (
                    <TableRow 
                      key={log.fileName} 
                      className="hover-elevate cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                      data-testid={`log-row-${index}`}
                    >
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(log.timestamp), "dd MMM yyyy", { locale: fr })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.timestamp), "HH:mm:ss", { locale: fr })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono text-muted-foreground text-xs">
                          {(log as any).userId?.slice(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Code className="w-3 h-3" />
                          {log.event}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {log.source || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {log.user || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          data-testid={`button-view-log-${index}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Détails
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {logsData?.hasMore && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {logsData.total} logs au total
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Légende des indicateurs de santé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div>
              <p className="font-medium">🟢 Optimal</p>
              <p className="text-sm text-muted-foreground">Dashboard fonctionnel, activité récente, taux d'échec &lt; 20%</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <div>
              <p className="font-medium">🟠 Attention</p>
              <p className="text-sm text-muted-foreground">Taux d'échec entre 20% et 50% dans les dernières 24h</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div>
              <p className="font-medium">🔴 Critique</p>
              <p className="text-sm text-muted-foreground">Taux d'échec &gt; 50% ou aucune activité depuis 7 jours</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl" data-testid="dialog-log-detail">
          <DialogHeader>
            <DialogTitle>Détail du log N8N</DialogTitle>
            <DialogDescription>
              Informations complètes sur cet événement
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Timestamp
                  </div>
                  <div className="text-sm">
                    {format(new Date(selectedLog.timestamp), "dd MMMM yyyy 'à' HH:mm:ss", { locale: fr })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Événement
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Code className="w-3 h-3" />
                    {selectedLog.event}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Client ID
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">{(selectedLog as any).userId}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Source
                  </div>
                  <div className="text-sm">{selectedLog.source || '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Utilisateur
                </div>
                <div className="text-sm">{selectedLog.user || '-'}</div>
              </div>

              {selectedLog.data && Object.keys(selectedLog.data).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Données
                  </div>
                  <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(selectedLog.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Métadonnées
                  </div>
                  <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[200px]">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Nom du fichier
                </div>
                <div className="text-xs font-mono text-muted-foreground">{selectedLog.fileName}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce compte ? Cette action est irréversible
              et supprimera toutes les données associées (appels, notifications, rapports).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUserId && deleteMutation.mutate(selectedUserId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
