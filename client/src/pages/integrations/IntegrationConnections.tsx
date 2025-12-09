import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Cog,
  ArrowLeft,
  ArrowRight,
  Shield,
  Loader2
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

interface TestResult {
  success: boolean;
  message: string;
  accountInfo?: {
    name?: string;
    id?: string;
    plan?: string;
  };
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

type WizardStep = 1 | 2 | 3;

export default function IntegrationConnections() {
  const { toast } = useToast();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  
  const [connectionName, setConnectionName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const { data: providers, isLoading: loadingProviders } = useQuery<Provider[]>({
    queryKey: ["/api/integrations/providers"],
  });

  const { data: connections, isLoading: loadingConnections } = useQuery<Connection[]>({
    queryKey: ["/api/integrations/connections"],
  });

  const createAndConnectMutation = useMutation({
    mutationFn: async (data: { 
      provider: string; 
      name: string; 
      authType: string;
      apiKey?: string;
      apiSecret?: string;
    }) => {
      const response = await apiRequest("POST", "/api/integrations/connections/create-and-connect", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({ 
        title: "Connexion créée avec succès!", 
        description: `${selectedProvider?.displayName} est maintenant connecté à SpeedAI.`
      });
      resetWizard();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
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
    onSuccess: (data) => {
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

  const resetWizard = () => {
    setIsAddDialogOpen(false);
    setWizardStep(1);
    setSelectedProvider(null);
    setConnectionName("");
    setApiKey("");
    setApiSecret("");
    setTestResult(null);
    setIsTesting(false);
  };

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    setConnectionName(`Mon ${provider.displayName}`);
    setApiKey("");
    setApiSecret("");
    setTestResult(null);
    setIsTesting(false);
    setWizardStep(2);
  };

  const handleTestConnection = async () => {
    if (!selectedProvider || !apiKey) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await apiRequest("POST", "/api/integrations/test-credentials", {
        provider: selectedProvider.provider,
        apiKey,
        apiSecret: apiSecret || undefined
      });
      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        setWizardStep(3);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Erreur de connexion"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleOAuthConnect = async () => {
    if (!selectedProvider) return;
    
    const oauthUrl = `/api/integrations/oauth/${selectedProvider.provider}/start`;
    window.location.href = oauthUrl;
  };

  const handleCreateConnection = () => {
    if (!selectedProvider || !connectionName) return;
    
    createAndConnectMutation.mutate({
      provider: selectedProvider.provider,
      name: connectionName,
      authType: selectedProvider.authType,
      apiKey: apiKey || undefined,
      apiSecret: apiSecret || undefined
    });
  };

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

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === wizardStep 
                ? "bg-primary text-primary-foreground" 
                : step < wizardStep 
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step < wizardStep ? <CheckCircle className="h-4 w-4" /> : step}
          </div>
          {step < 3 && (
            <div className={`w-12 h-0.5 mx-1 ${step < wizardStep ? "bg-green-500" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="font-semibold">Étape 1 : Sélectionnez une intégration</h3>
        <p className="text-sm text-muted-foreground">Choisissez le CRM ou la base de données à connecter</p>
      </div>
      
      {loadingProviders ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Chargement...</span>
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
                  onClick={() => handleProviderSelect(provider)}
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
  );

  const renderStep2 = () => {
    if (!selectedProvider) return null;

    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <h3 className="font-semibold">Étape 2 : Configurez la connexion</h3>
          <p className="text-sm text-muted-foreground">Entrez vos identifiants {selectedProvider.displayName}</p>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
          <ProviderLogo provider={selectedProvider.provider} color={selectedProvider.color} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{selectedProvider.displayName}</h3>
            <p className="text-sm text-muted-foreground">{selectedProvider.description}</p>
          </div>
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

          {/* API Key input - show for api_key auth OR for providers that support both */}
          <>
            <div className="space-y-2">
              <Label htmlFor="api-key" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Clé API {selectedProvider.authType === "oauth2" && "(optionnel)"}
              </Label>
              <Input
                id="api-key"
                type="password"
                placeholder={`Entrez votre clé API ${selectedProvider.displayName}`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                data-testid="input-api-key"
              />
              <p className="text-xs text-muted-foreground">
                {selectedProvider.provider === "hubspot" 
                  ? "Trouvez votre clé API dans HubSpot → Paramètres → Intégrations → Clé API privée"
                  : `Trouvez votre clé API dans les paramètres de votre compte ${selectedProvider.displayName}`
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-secret">Secret API (optionnel)</Label>
              <Input
                id="api-secret"
                type="password"
                placeholder="Entrez votre secret API si requis"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                data-testid="input-api-secret"
              />
            </div>

            {testResult && !testResult.success && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{testResult.message}</span>
              </div>
            )}

            {/* OAuth option for providers that support it */}
            {selectedProvider.authType === "oauth2" && (
              <div className="p-4 rounded-lg border border-dashed space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Ou connectez-vous via OAuth (recommandé)</span>
                </div>
                <Button onClick={handleOAuthConnect} variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Autoriser {selectedProvider.displayName}
                </Button>
              </div>
            )}
          </>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => {
            setApiKey("");
            setApiSecret("");
            setTestResult(null);
            setWizardStep(1);
          }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <Button 
            onClick={handleTestConnection}
            disabled={!apiKey || isTesting}
            data-testid="button-test-connection"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Tester la connexion
              </>
            )}
          </Button>
        </DialogFooter>
      </div>
    );
  };

  const renderStep3 = () => {
    if (!selectedProvider || !testResult?.success) return null;

    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <h3 className="font-semibold">Étape 3 : Confirmez la connexion</h3>
          <p className="text-sm text-muted-foreground">Vérifiez les détails et finalisez</p>
        </div>

        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="font-medium text-green-700 dark:text-green-400">Connexion réussie!</span>
          </div>
          {testResult.accountInfo && (
            <div className="text-sm space-y-1 text-muted-foreground">
              {testResult.accountInfo.name && (
                <p>Compte: <span className="text-foreground font-medium">{testResult.accountInfo.name}</span></p>
              )}
              {testResult.accountInfo.id && (
                <p>ID: <span className="text-foreground">{testResult.accountInfo.id}</span></p>
              )}
              {testResult.accountInfo.plan && (
                <p>Plan: <span className="text-foreground">{testResult.accountInfo.plan}</span></p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 rounded-lg border space-y-4">
          <div className="flex items-center gap-3">
            <ProviderLogo provider={selectedProvider.provider} color={selectedProvider.color} size="md" />
            <div>
              <h4 className="font-medium">{connectionName}</h4>
              <p className="text-sm text-muted-foreground">{selectedProvider.displayName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="text-sm font-medium">Données synchronisées:</h5>
            <div className="flex flex-wrap gap-1">
              {selectedProvider.supportedEntities.map(entity => (
                <Badge key={entity} variant="outline" className="text-xs capitalize">{entity}</Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="p-2 rounded bg-muted">
              <div className={selectedProvider.supportsWebhooks ? "text-green-500" : "text-muted-foreground"}>
                {selectedProvider.supportsWebhooks ? "✓" : "✗"}
              </div>
              <div className="text-xs text-muted-foreground">Webhooks</div>
            </div>
            <div className="p-2 rounded bg-muted">
              <div className={selectedProvider.supportsRealtime ? "text-green-500" : "text-muted-foreground"}>
                {selectedProvider.supportsRealtime ? "✓" : "✗"}
              </div>
              <div className="text-xs text-muted-foreground">Temps réel</div>
            </div>
            <div className="p-2 rounded bg-muted">
              <div className={selectedProvider.supportsBidirectional ? "text-green-500" : "text-muted-foreground"}>
                {selectedProvider.supportsBidirectional ? "✓" : "✗"}
              </div>
              <div className="text-xs text-muted-foreground">Bidirectionnel</div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setWizardStep(2)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <Button 
            onClick={handleCreateConnection}
            disabled={createAndConnectMutation.isPending}
            data-testid="button-confirm-connection"
          >
            {createAndConnectMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Créer la connexion
              </>
            )}
          </Button>
        </DialogFooter>
      </div>
    );
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
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          if (!open) resetWizard();
          else setIsAddDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-connection">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une connexion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle intégration</DialogTitle>
              <DialogDescription>
                Connectez votre CRM ou base de données en quelques étapes
              </DialogDescription>
            </DialogHeader>

            <StepIndicator />

            {wizardStep === 1 && renderStep1()}
            {wizardStep === 2 && renderStep2()}
            {wizardStep === 3 && renderStep3()}
          </DialogContent>
        </Dialog>
      </div>

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

                  {connection.status === "pending" && (
                    <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground text-center">
                      <Clock className="h-4 w-4 inline mr-2" />
                      Configuration en attente
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
                      <RefreshCw className={`h-4 w-4 mr-1 ${triggerSyncMutation.isPending ? 'animate-spin' : ''}`} />
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
