import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Database, 
  Plug, 
  RefreshCw, 
  Settings, 
  Trash2, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  ExternalLink,
  Key,
  Link2,
  Building2,
  Utensils,
  Hotel,
  Stethoscope,
  ShoppingCart,
  HardDrive,
  Cog
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  SiHubspot, 
  SiSalesforce, 
  SiZoho, 
  SiStripe, 
  SiShopify, 
  SiWoocommerce,
  SiMongodb,
  SiMysql,
  SiPostgresql,
  SiAirtable
} from "react-icons/si";

interface Provider {
  provider: string;
  displayName: string;
  description: string;
  category: string;
  logoUrl: string;
  color: string;
  authType: string;
  supportedEntities: string[];
  supportsWebhooks: boolean;
  supportsRealtime: boolean;
  supportsBidirectional: boolean;
  isPremium: boolean;
}

interface Connection {
  id: string;
  provider: string;
  name: string;
  description: string | null;
  authType: string;
  status: string;
  syncEnabled: boolean;
  syncFrequency: string;
  enabledEntities: string[];
  lastSyncAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  crm: "CRM Génériques",
  restaurant: "Restaurant & Hôtellerie",
  hotel: "Hôtels",
  medical: "Médical",
  ecommerce: "E-commerce",
  database: "Bases de données",
  custom: "Personnalisé"
};

const CategoryIcon = ({ category }: { category: string }) => {
  const iconClass = "h-4 w-4";
  switch (category) {
    case "crm": return <Building2 className={iconClass} />;
    case "restaurant": return <Utensils className={iconClass} />;
    case "hotel": return <Hotel className={iconClass} />;
    case "medical": return <Stethoscope className={iconClass} />;
    case "ecommerce": return <ShoppingCart className={iconClass} />;
    case "database": return <HardDrive className={iconClass} />;
    default: return <Cog className={iconClass} />;
  }
};

const ProviderLogo = ({ provider, color, size = "md" }: { provider: string; color: string; size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };
  
  const getIcon = () => {
    switch (provider.toLowerCase()) {
      case "hubspot": return <SiHubspot className={iconSizes[size]} />;
      case "salesforce": return <SiSalesforce className={iconSizes[size]} />;
      case "zoho": return <SiZoho className={iconSizes[size]} />;
      case "stripe": return <SiStripe className={iconSizes[size]} />;
      case "shopify": return <SiShopify className={iconSizes[size]} />;
      case "woocommerce": return <SiWoocommerce className={iconSizes[size]} />;
      case "mongodb": return <SiMongodb className={iconSizes[size]} />;
      case "mysql": return <SiMysql className={iconSizes[size]} />;
      case "postgresql": return <SiPostgresql className={iconSizes[size]} />;
      case "airtable": return <SiAirtable className={iconSizes[size]} />;
      case "pipedrive": return <span className="font-bold text-sm">P</span>;
      case "monday": return <span className="font-bold text-sm">M</span>;
      case "zenchef": return <span className="font-bold text-sm">Z</span>;
      case "thefork": return <span className="font-bold text-sm">TF</span>;
      case "resy": return <span className="font-bold text-sm">R</span>;
      case "opentable": return <span className="font-bold text-sm">OT</span>;
      case "sevenrooms": return <span className="font-bold text-sm">7R</span>;
      case "guestline": return <span className="font-bold text-sm">GL</span>;
      case "mews": return <span className="font-bold text-sm">MW</span>;
      case "cloudbeds": return <span className="font-bold text-sm">CB</span>;
      case "opera": return <span className="font-bold text-sm">OP</span>;
      case "stayntouch": return <span className="font-bold text-sm">ST</span>;
      case "doctolib": return <span className="font-bold text-sm">D</span>;
      case "clicrdv": return <span className="font-bold text-sm">CR</span>;
      case "maiia": return <span className="font-bold text-sm">MA</span>;
      case "medicapp": return <span className="font-bold text-sm">MC</span>;
      case "veasy": return <span className="font-bold text-sm">VE</span>;
      case "prestashop": return <span className="font-bold text-sm">PS</span>;
      case "magento": return <span className="font-bold text-sm">MG</span>;
      case "bigcommerce": return <span className="font-bold text-sm">BC</span>;
      default: return <Database className={iconSizes[size]} />;
    }
  };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-lg flex items-center justify-center text-white shrink-0`}
      style={{ backgroundColor: color }}
    >
      {getIcon()}
    </div>
  );
};

export default function IntegrationConnections() {
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiSecretInput, setApiSecretInput] = useState("");

  const { data: providers, isLoading: loadingProviders } = useQuery<Provider[]>({
    queryKey: ["/api/integrations/providers"],
  });

  const { data: connections, isLoading: loadingConnections } = useQuery<Connection[]>({
    queryKey: ["/api/integrations/connections"],
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: { provider: string; name: string; authType: string }) => {
      return apiRequest("POST", "/api/integrations/connections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({ title: "Connexion créée", description: "Vous pouvez maintenant configurer les identifiants." });
      setIsAddDialogOpen(false);
      setSelectedProvider(null);
      setConnectionName("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  const connectApiKeyMutation = useMutation({
    mutationFn: async ({ id, apiKey, apiSecret }: { id: string; apiKey: string; apiSecret?: string }) => {
      const response = await apiRequest("POST", `/api/integrations/connections/${id}/connect-apikey`, { apiKey, apiSecret });
      return response.json();
    },
    onSuccess: (data: { success: boolean; message: string; accountInfo?: { name?: string } }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      if (data.success) {
        toast({ 
          title: "Connexion réussie!", 
          description: data.accountInfo?.name 
            ? `Connecté à ${data.accountInfo.name}. La synchronisation peut maintenant commencer.`
            : data.message
        });
      }
      setApiKeyInput("");
      setApiSecretInput("");
    },
    onError: (error: Error) => {
      toast({ title: "Échec de connexion", description: error.message, variant: "destructive" });
    }
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/integrations/connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({ title: "Connexion supprimée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/integrations/connections/${id}/sync`, { fullSync: true });
      return response.json();
    },
    onSuccess: (data: { success: boolean; message: string; details?: { customersImported: number; ordersImported: number; transactionsImported: number } }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      if (data.success) {
        toast({ 
          title: "Synchronisation réussie!", 
          description: data.message
        });
      } else {
        toast({ 
          title: "Synchronisation partielle", 
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erreur de synchronisation", description: error.message, variant: "destructive" });
    }
  });

  const groupedProviders = providers?.reduce((acc, provider) => {
    if (!acc[provider.category]) {
      acc[provider.category] = [];
    }
    acc[provider.category].push(provider);
    return acc;
  }, {} as Record<string, Provider[]>) || {};

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Actif</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Erreur</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCreateConnection = () => {
    if (!selectedProvider || !connectionName) return;
    createConnectionMutation.mutate({
      provider: selectedProvider.provider,
      name: connectionName,
      authType: selectedProvider.authType,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Connexions</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos intégrations CRM et bases de données
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-connection">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une connexion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter une intégration</DialogTitle>
              <DialogDescription>
                Sélectionnez le service à connecter à SpeedAI
              </DialogDescription>
            </DialogHeader>

            {!selectedProvider ? (
              <div className="space-y-6">
                {loadingProviders ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Chargement des intégrations...</span>
                  </div>
                ) : Object.keys(groupedProviders).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune intégration disponible
                  </div>
                ) : (
                  Object.entries(groupedProviders).map(([category, categoryProviders]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                        <CategoryIcon category={category} />
                        {categoryLabels[category] || category}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categoryProviders.map((provider) => (
                          <button
                            key={provider.provider}
                            onClick={() => setSelectedProvider(provider)}
                            className="p-4 rounded-lg border text-left hover-elevate transition-all"
                            data-testid={`button-provider-${provider.provider}`}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <ProviderLogo provider={provider.provider} color={provider.color} size="md" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{provider.displayName}</div>
                                {provider.isPremium && (
                                  <Badge variant="secondary" className="text-xs">Premium</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {provider.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                  <ProviderLogo provider={selectedProvider.provider} color={selectedProvider.color} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{selectedProvider.displayName}</h3>
                    <p className="text-sm text-muted-foreground">{selectedProvider.description}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-auto"
                    onClick={() => setSelectedProvider(null)}
                  >
                    Changer
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="connection-name">Nom de la connexion</Label>
                    <Input
                      id="connection-name"
                      placeholder={`Mon ${selectedProvider.displayName}`}
                      value={connectionName}
                      onChange={(e) => setConnectionName(e.target.value)}
                      data-testid="input-connection-name"
                    />
                  </div>

                  <div className="p-4 rounded-lg border space-y-3">
                    <h4 className="font-medium">Fonctionnalités</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedProvider.supportsWebhooks ? "default" : "secondary"}>
                          {selectedProvider.supportsWebhooks ? "✓" : "✗"} Webhooks
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedProvider.supportsRealtime ? "default" : "secondary"}>
                          {selectedProvider.supportsRealtime ? "✓" : "✗"} Temps réel
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedProvider.supportsBidirectional ? "default" : "secondary"}>
                          {selectedProvider.supportsBidirectional ? "✓" : "✗"} Bidirectionnel
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedProvider.supportedEntities.map(entity => (
                        <Badge key={entity} variant="outline" className="text-xs capitalize">{entity}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                    Retour
                  </Button>
                  <Button 
                    onClick={handleCreateConnection}
                    disabled={!connectionName || createConnectionMutation.isPending}
                    data-testid="button-create-connection"
                  >
                    {createConnectionMutation.isPending ? "Création..." : "Créer la connexion"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Connections */}
      {loadingConnections ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {connections.map((connection) => {
            const provider = providers?.find(p => p.provider === connection.provider);
            return (
              <Card key={connection.id} data-testid={`card-connection-${connection.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <ProviderLogo provider={connection.provider} color={provider?.color || "#6c757d"} size="md" />
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{connection.name}</CardTitle>
                        <CardDescription className="truncate">{provider?.displayName || connection.provider}</CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(connection.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {connection.status === "pending" && connection.authType === "api_key" && (
                    <div className="p-4 rounded-lg border border-dashed space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Configurer les identifiants
                      </h4>
                      <div className="space-y-2">
                        <Input
                          placeholder="Clé API"
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          data-testid="input-api-key"
                        />
                        <Input
                          placeholder="Secret API (optionnel)"
                          type="password"
                          value={apiSecretInput}
                          onChange={(e) => setApiSecretInput(e.target.value)}
                          data-testid="input-api-secret"
                        />
                        <Button 
                          onClick={() => connectApiKeyMutation.mutate({ 
                            id: connection.id, 
                            apiKey: apiKeyInput, 
                            apiSecret: apiSecretInput || undefined 
                          })}
                          disabled={!apiKeyInput || connectApiKeyMutation.isPending}
                          className="w-full"
                          data-testid="button-connect-api-key"
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          {connectApiKeyMutation.isPending ? "Connexion..." : "Connecter"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {connection.status === "pending" && connection.authType === "oauth2" && (
                    <div className="p-4 rounded-lg border border-dashed text-center">
                      <Button className="w-full">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Autoriser {provider?.displayName}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Vous serez redirigé vers {provider?.displayName} pour autoriser l'accès
                      </p>
                    </div>
                  )}

                  {connection.status === "active" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Dernière sync</span>
                        <span>
                          {connection.lastSyncAt 
                            ? new Date(connection.lastSyncAt).toLocaleString('fr-FR')
                            : "Jamais"
                          }
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Fréquence</span>
                        <Badge variant="outline">{connection.syncFrequency}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sync activée</span>
                        <Switch checked={connection.syncEnabled} />
                      </div>
                    </div>
                  )}

                  {connection.status === "error" && connection.lastError && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      {connection.lastError}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  {connection.status === "active" && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => triggerSyncMutation.mutate(connection.id)}
                      disabled={triggerSyncMutation.isPending}
                      data-testid={`button-sync-${connection.id}`}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Sync
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-1" />
                    Paramètres
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive ml-auto"
                    onClick={() => deleteConnectionMutation.mutate(connection.id)}
                    disabled={deleteConnectionMutation.isPending}
                    data-testid={`button-delete-${connection.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Plug className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Aucune connexion</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Commencez par ajouter votre première intégration pour synchroniser 
              vos données clients et transactions.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-first-connection">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une connexion
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
