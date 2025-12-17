import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Database, 
  Plug, 
  CheckCircle, 
  AlertTriangle,
  Key,
  Building2,
  Utensils,
  Hotel,
  ShoppingCart,
  HardDrive,
  Cog,
  Shield,
  Loader2,
  Copy,
  Webhook,
  HelpCircle,
  Upload,
  Mail,
  ExternalLink,
  RefreshCw,
  Trash2,
  Clock,
  Info
} from "lucide-react";
import { 
  SiHubspot, 
  SiSalesforce, 
  SiStripe, 
  SiShopify, 
  SiWoocommerce,
  SiMysql,
  SiPostgresql,
  SiAirtable,
  SiNotion,
  SiGooglesheets
} from "react-icons/si";

interface Connection {
  id: string;
  provider: string;
  name: string;
  status: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
}

type IntegrationTier = "standard" | "premium" | "custom";
type AuthMethod = "oauth" | "api_key" | "api_key_secret" | "credentials" | "csv_import" | "webhook";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: IntegrationTier;
  authMethod: AuthMethod;
  color: string;
  fields?: { key: string; label: string; type: string; placeholder?: string; required?: boolean }[];
  oauthCallback?: string;
}

const INTEGRATIONS: Integration[] = [
  // CRM Génériques
  { id: "hubspot", name: "HubSpot", description: "CRM complet avec contacts, deals et pipelines", category: "crm", tier: "standard", authMethod: "api_key", color: "#FF7A59", fields: [
    { key: "apiKey", label: "Private App Access Token", type: "password", placeholder: "pat-...", required: true }
  ] },
  { id: "salesforce", name: "Salesforce", description: "Le leader mondial du CRM enterprise", category: "crm", tier: "premium", authMethod: "api_key_secret", color: "#00A1E0", fields: [
    { key: "instanceUrl", label: "Instance URL", type: "text", placeholder: "https://votre-org.my.salesforce.com", required: true },
    { key: "apiKey", label: "Access Token", type: "password", placeholder: "Votre access token Salesforce", required: true }
  ] },
  { id: "zoho", name: "Zoho CRM", description: "Solution CRM complète et abordable", category: "crm", tier: "standard", authMethod: "api_key", color: "#D32F2F", fields: [
    { key: "apiKey", label: "API Token", type: "password", placeholder: "Votre token API Zoho", required: true },
    { key: "region", label: "Région (eu/com/in)", type: "text", placeholder: "eu", required: true }
  ] },
  { id: "pipedrive", name: "Pipedrive", description: "CRM axé sur les ventes", category: "crm", tier: "standard", authMethod: "api_key", color: "#1A1A1A", fields: [
    { key: "apiKey", label: "API Token", type: "password", placeholder: "Votre token API Pipedrive", required: true }
  ] },
  { id: "monday", name: "Monday.com", description: "Gestion de projets et CRM", category: "crm", tier: "standard", authMethod: "api_key", color: "#FF3D57", fields: [
    { key: "apiKey", label: "API Token", type: "password", placeholder: "Votre token API Monday", required: true },
    { key: "boardId", label: "Board ID", type: "text", placeholder: "ID du board", required: true }
  ] },

  // Restaurant & Hôtellerie
  { id: "zenchef", name: "Zenchef", description: "Gestion de réservations restaurant", category: "restaurant", tier: "premium", authMethod: "api_key", color: "#00B894", fields: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Clé API Zenchef", required: false }
  ] },
  { id: "thefork", name: "TheFork Manager", description: "Réservations TheFork / LaFourchette", category: "restaurant", tier: "premium", authMethod: "csv_import", color: "#00A78E" },
  { id: "opentable", name: "OpenTable", description: "Plateforme de réservation restaurant", category: "restaurant", tier: "premium", authMethod: "api_key_secret", color: "#DA3743", fields: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Clé API", required: true },
    { key: "restaurantId", label: "Restaurant ID", type: "text", placeholder: "ID du restaurant", required: true }
  ] },
  { id: "resy", name: "Resy", description: "Réservations haut de gamme", category: "restaurant", tier: "premium", authMethod: "api_key_secret", color: "#FF5A5F", fields: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Clé API", required: true },
    { key: "venueId", label: "Venue ID", type: "text", placeholder: "ID du lieu", required: true }
  ] },
  { id: "lightspeed", name: "Lightspeed Restaurant", description: "Caisse et gestion restaurant", category: "restaurant", tier: "premium", authMethod: "api_key", color: "#E61C3D", fields: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Clé API", required: true },
    { key: "locationId", label: "Account / Location ID", type: "text", placeholder: "ID du compte", required: true }
  ] },

  // Hôtels
  { id: "mews", name: "Mews", description: "PMS hôtelier moderne", category: "hotel", tier: "premium", authMethod: "api_key_secret", color: "#00A9E0", fields: [
    { key: "clientToken", label: "Client Token", type: "password", required: true },
    { key: "accessToken", label: "Access Token", type: "password", required: true },
    { key: "hotelId", label: "Hotel ID", type: "text", required: true }
  ] },
  { id: "cloudbeds", name: "Cloudbeds", description: "Gestion hôtelière cloud", category: "hotel", tier: "premium", authMethod: "api_key", color: "#2A73CC", fields: [
    { key: "apiKey", label: "API Key", type: "password", placeholder: "Votre clé API Cloudbeds", required: true },
    { key: "propertyId", label: "Property ID", type: "text", placeholder: "ID de la propriété", required: true }
  ] },

  // E-commerce
  { id: "shopify", name: "Shopify", description: "Plateforme e-commerce leader", category: "ecommerce", tier: "standard", authMethod: "api_key", color: "#96BF48", fields: [
    { key: "shopDomain", label: "Domaine boutique", type: "text", placeholder: "xxx.myshopify.com", required: true },
    { key: "apiKey", label: "Admin API Access Token", type: "password", placeholder: "shpat_...", required: true }
  ] },
  { id: "woocommerce", name: "WooCommerce", description: "E-commerce WordPress", category: "ecommerce", tier: "standard", authMethod: "api_key_secret", color: "#96588A", fields: [
    { key: "siteUrl", label: "URL du site", type: "text", placeholder: "https://votre-site.com", required: true },
    { key: "consumerKey", label: "Consumer Key", type: "password", required: true },
    { key: "consumerSecret", label: "Consumer Secret", type: "password", required: true }
  ] },
  { id: "prestashop", name: "PrestaShop", description: "Solution e-commerce française", category: "ecommerce", tier: "standard", authMethod: "api_key", color: "#DF0067", fields: [
    { key: "siteUrl", label: "URL du site", type: "text", placeholder: "https://votre-site.com", required: true },
    { key: "apiKey", label: "API Key", type: "password", required: true }
  ] },
  { id: "stripe", name: "Stripe", description: "Paiements et abonnements", category: "ecommerce", tier: "standard", authMethod: "api_key_secret", color: "#635BFF", fields: [
    { key: "secretKey", label: "Secret Key", type: "password", placeholder: "sk_live_...", required: true },
    { key: "webhookSecret", label: "Webhook Secret", type: "password", placeholder: "whsec_...", required: false }
  ] },

  // Bases de données
  { id: "airtable", name: "Airtable", description: "Base de données collaborative", category: "database", tier: "standard", authMethod: "api_key", color: "#18BFFF", fields: [
    { key: "apiKey", label: "API Token", type: "password", required: true },
    { key: "baseId", label: "Base ID", type: "text", required: true },
    { key: "tableId", label: "Table ID", type: "text", required: true }
  ] },
  { id: "notion", name: "Notion", description: "Workspace tout-en-un", category: "database", tier: "standard", authMethod: "api_key", color: "#000000", fields: [
    { key: "apiKey", label: "Integration Token", type: "password", placeholder: "secret_...", required: true },
    { key: "databaseId", label: "Database ID", type: "text", placeholder: "ID de la base Notion", required: true }
  ] },
  { id: "googlesheets", name: "Google Sheets", description: "Feuilles de calcul Google", category: "database", tier: "standard", authMethod: "api_key", color: "#34A853", fields: [
    { key: "apiKey", label: "Service Account JSON", type: "password", placeholder: "Clé JSON du compte de service", required: true },
    { key: "spreadsheetId", label: "Spreadsheet ID", type: "text", placeholder: "ID de la feuille", required: true }
  ] },
  { id: "postgresql", name: "PostgreSQL", description: "Base de données relationnelle", category: "database", tier: "premium", authMethod: "credentials", color: "#336791", fields: [
    { key: "host", label: "Host", type: "text", required: true },
    { key: "port", label: "Port", type: "text", placeholder: "5432", required: true },
    { key: "database", label: "Database", type: "text", required: true },
    { key: "user", label: "User", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
    { key: "ssl", label: "SSL", type: "toggle", required: false }
  ] },
  { id: "mysql", name: "MySQL", description: "Base de données relationnelle", category: "database", tier: "premium", authMethod: "credentials", color: "#4479A1", fields: [
    { key: "host", label: "Host", type: "text", required: true },
    { key: "port", label: "Port", type: "text", placeholder: "3306", required: true },
    { key: "database", label: "Database", type: "text", required: true },
    { key: "user", label: "User", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true }
  ] },

  // Personnalisé
  { id: "custom_api", name: "API personnalisée", description: "Connectez n'importe quelle API", category: "custom", tier: "custom", authMethod: "api_key_secret", color: "#6B7280", fields: [
    { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://api.example.com", required: true },
    { key: "authType", label: "Type d'auth", type: "select", required: true },
    { key: "apiKey", label: "Clé / Token", type: "password", required: false },
    { key: "apiSecret", label: "Secret", type: "password", required: false }
  ] },
  { id: "webhook", name: "Webhook", description: "Recevez des données en temps réel", category: "custom", tier: "standard", authMethod: "webhook", color: "#C8B88A" }
];

const CATEGORIES = [
  { id: "crm", label: "CRM Génériques", icon: Building2 },
  { id: "restaurant", label: "Restaurant & Hôtellerie", icon: Utensils },
  { id: "hotel", label: "Hôtels", icon: Hotel },
  { id: "ecommerce", label: "E-commerce", icon: ShoppingCart },
  { id: "database", label: "Bases de données", icon: HardDrive },
  { id: "custom", label: "Personnalisé", icon: Cog }
];

const ProviderLogo = ({ provider, color, size = "md" }: { provider: string; color: string; size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12" };
  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };
  
  const getIcon = () => {
    switch (provider.toLowerCase()) {
      case "hubspot": return <SiHubspot className={iconSizes[size]} />;
      case "salesforce": return <SiSalesforce className={iconSizes[size]} />;
      case "stripe": return <SiStripe className={iconSizes[size]} />;
      case "shopify": return <SiShopify className={iconSizes[size]} />;
      case "woocommerce": return <SiWoocommerce className={iconSizes[size]} />;
      case "mysql": return <SiMysql className={iconSizes[size]} />;
      case "postgresql": return <SiPostgresql className={iconSizes[size]} />;
      case "airtable": return <SiAirtable className={iconSizes[size]} />;
      case "notion": return <SiNotion className={iconSizes[size]} />;
      case "googlesheets": return <SiGooglesheets className={iconSizes[size]} />;
      case "pipedrive": return <span className="font-bold text-sm">P</span>;
      case "monday": return <span className="font-bold text-sm">M</span>;
      case "zoho": return <span className="font-bold text-sm">Z</span>;
      case "zenchef": return <span className="font-bold text-sm">ZC</span>;
      case "thefork": return <span className="font-bold text-sm">TF</span>;
      case "resy": return <span className="font-bold text-sm">R</span>;
      case "opentable": return <span className="font-bold text-sm">OT</span>;
      case "lightspeed": return <span className="font-bold text-sm">LS</span>;
      case "mews": return <span className="font-bold text-sm">MW</span>;
      case "cloudbeds": return <span className="font-bold text-sm">CB</span>;
      case "prestashop": return <span className="font-bold text-sm">PS</span>;
      case "webhook": return <Webhook className={iconSizes[size]} />;
      case "custom_api": return <Cog className={iconSizes[size]} />;
      default: return <Database className={iconSizes[size]} />;
    }
  };

  return (
    <div className={`${sizeClasses[size]} rounded-lg flex items-center justify-center text-white shrink-0`} style={{ backgroundColor: color }}>
      {getIcon()}
    </div>
  );
};

const TierBadge = ({ tier }: { tier: IntegrationTier }) => {
  switch (tier) {
    case "premium":
      return <Badge className="bg-[#C8B88A]/20 text-[#C8B88A] border-[#C8B88A]/30">Premium</Badge>;
    case "custom":
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Sur mesure</Badge>;
    default:
      return <Badge variant="secondary">Standard</Badge>;
  }
};

export default function IntegrationHub() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isWhyConnectOpen, setIsWhyConnectOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  const { data: connections, isLoading: loadingConnections } = useQuery<Connection[]>({
    queryKey: ["/api/integrations/connections"],
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { provider: string; credentials: Record<string, string> }) => {
      const response = await apiRequest("POST", "/api/integrations/connect-apikey", {
        provider: data.provider,
        name: `Mon ${data.provider}`,
        ...data.credentials
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({ title: "Connexion réussie!", description: "L'intégration est maintenant active." });
      closeConnectDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/integrations/connections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({ title: "Connexion supprimée" });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/integrations/connections/${id}/sync`, { fullSync: true });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({ title: data.success ? "Synchronisation réussie!" : "Synchronisation partielle", description: data.message });
    }
  });

  const closeConnectDialog = () => {
    setIsConnectDialogOpen(false);
    setSelectedIntegration(null);
    setFormData({});
    setTestSuccess(null);
  };

  // Liste des providers avec OAuth implémenté côté backend (aucun pour l'instant)
  const OAUTH_IMPLEMENTED: string[] = [];
  
  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setFormData({});
    setTestSuccess(null);
    
    if (integration.authMethod === "oauth" && OAUTH_IMPLEMENTED.includes(integration.id)) {
      // OAuth implémenté - redirection vers le flux OAuth
      window.location.href = `/api/integrations/oauth/${integration.id}/start`;
    } else {
      // Tous les autres: ouvrir le dialog de connexion manuelle
      setIsConnectDialogOpen(true);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedIntegration) return;
    setIsTesting(true);
    setTestSuccess(null);

    try {
      const response = await apiRequest("POST", "/api/integrations/test-credentials", {
        provider: selectedIntegration.id,
        ...formData
      });
      const result = await response.json();
      setTestSuccess(result.success);
      
      if (result.success) {
        toast({ title: "Test réussi!", description: result.message || "Connexion validée." });
      } else {
        toast({ title: "Test échoué", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      setTestSuccess(false);
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Erreur de test", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmitConnection = () => {
    if (!selectedIntegration) return;
    connectMutation.mutate({ provider: selectedIntegration.id, credentials: formData });
  };

  const isConnected = (integrationId: string) => 
    connections?.some(c => c.provider.toLowerCase() === integrationId.toLowerCase() && c.status === "active");

  const getConnection = (integrationId: string) => 
    connections?.find(c => c.provider.toLowerCase() === integrationId.toLowerCase());

  const filteredIntegrations = selectedCategory === "all" 
    ? INTEGRATIONS 
    : INTEGRATIONS.filter(i => i.category === selectedCategory);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Jamais";
    return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4 md:space-y-8 p-4 md:p-0">
      {/* Hero Marketing Block */}
      <Card className="bg-gradient-to-br from-[#0A0A0A] to-[#1A1A1A] border-[#C8B88A]/20">
        <CardContent className="p-4 md:p-8">
          <div className="max-w-3xl">
            <h1 className="text-xl md:text-3xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-white to-[#C8B88A] bg-clip-text text-transparent">
              Connectez vos outils
            </h1>
            <p className="text-sm md:text-lg text-muted-foreground mb-4 md:mb-6 leading-relaxed hidden md:block">
              Relier votre CRM, votre système de réservation ou votre base de données à SpeedAI permet de centraliser les données clients qui ne passent pas par le téléphone : réservations en ligne, emails, commandes web...
            </p>
            <p className="text-sm text-muted-foreground mb-4 md:hidden">
              Centralisez vos données clients avec SpeedAI.
            </p>
            <p className="text-muted-foreground mb-6 hidden md:block">
              Vous gardez vos outils actuels. SpeedAI s'adapte à votre environnement et devient la couche intelligente qui unifie, sécurise et optimise votre activité.
            </p>
            <Dialog open={isWhyConnectOpen} onOpenChange={setIsWhyConnectOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-why-connect">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Pourquoi connecter mon CRM ?
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Pourquoi connecter votre CRM à SpeedAI ?</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#C8B88A]/20 flex items-center justify-center shrink-0">
                      <Database className="h-4 w-4 text-[#C8B88A]" />
                    </div>
                    <div>
                      <h4 className="font-medium">Centralisation</h4>
                      <p className="text-sm text-muted-foreground">Toutes vos données clients unifiées en un seul endroit</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#4CEFAD]/20 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-4 w-4 text-[#4CEFAD]" />
                    </div>
                    <div>
                      <h4 className="font-medium">Visibilité</h4>
                      <p className="text-sm text-muted-foreground">Vue 360° de chaque interaction client</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Plug className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium">Automatisation</h4>
                      <p className="text-sm text-muted-foreground">Synchronisation automatique entre vos outils</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-medium">ROI mesurable</h4>
                      <p className="text-sm text-muted-foreground">Suivez l'impact réel sur votre chiffre d'affaires</p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Active Connections */}
      {connections && connections.length > 0 && (
        <div className="space-y-3 md:space-y-4">
          <h2 className="text-lg md:text-xl font-semibold">Connexions actives</h2>
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => (
              <Card key={conn.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <ProviderLogo provider={conn.provider} color={INTEGRATIONS.find(i => i.id === conn.provider.toLowerCase())?.color || "#6B7280"} />
                      <div>
                        <CardTitle className="text-base">{conn.name}</CardTitle>
                        <CardDescription className="text-xs capitalize">{conn.provider}</CardDescription>
                      </div>
                    </div>
                    {conn.status === "active" ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <CheckCircle className="h-3 w-3 mr-1" />Actif
                      </Badge>
                    ) : conn.status === "error" ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />Erreur
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />{conn.status}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xs text-muted-foreground mb-3">
                    Dernière sync : {formatDate(conn.lastSyncAt)}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => syncMutation.mutate(conn.id)}
                      disabled={syncMutation.isPending}
                      data-testid={`button-sync-${conn.id}`}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                      Sync
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(conn.id)}
                      data-testid={`button-delete-${conn.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 overflow-x-auto">
          <TabsTrigger value="all" className="text-xs md:text-sm data-[state=active]:bg-[#C8B88A] data-[state=active]:text-black">
            Toutes
          </TabsTrigger>
          {CATEGORIES.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="text-xs md:text-sm data-[state=active]:bg-[#C8B88A] data-[state=active]:text-black"
            >
              <cat.icon className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">{cat.label}</span>
              <span className="md:hidden">{cat.label.split(' ')[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4 md:mt-6">
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredIntegrations.map((integration) => {
              const connected = isConnected(integration.id);
              return (
                <Card key={integration.id} className={`relative ${connected ? 'border-green-500/30' : ''}`}>
                  {connected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <ProviderLogo provider={integration.id} color={integration.color} />
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{integration.name}</CardTitle>
                        <TierBadge tier={integration.tier} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{integration.description}</p>
                    <Button 
                      className="w-full" 
                      variant={connected ? "outline" : "default"}
                      onClick={() => handleConnect(integration)}
                      disabled={connected}
                      data-testid={`button-connect-${integration.id}`}
                    >
                      {connected ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Connecté
                        </>
                      ) : (
                        <>
                          <Plug className="h-4 w-4 mr-2" />
                          Connecter
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Connect Dialog */}
      <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
        <DialogContent className="max-w-md">
          {selectedIntegration && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <ProviderLogo provider={selectedIntegration.id} color={selectedIntegration.color} size="lg" />
                  <div>
                    <DialogTitle>Connecter {selectedIntegration.name}</DialogTitle>
                    <DialogDescription>{selectedIntegration.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {selectedIntegration.authMethod === "csv_import" ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Glissez un fichier CSV ou cliquez pour sélectionner
                      </p>
                      <Input type="file" accept=".csv" className="mt-2" data-testid="input-csv-upload" />
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      <p>OU</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4" />
                        <span className="font-medium">Email parsing</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Transférez vos confirmations de réservation à :
                      </p>
                      <code className="text-xs bg-background px-2 py-1 rounded">
                        import@speedai.fr
                      </code>
                    </div>
                  </div>
                ) : selectedIntegration.authMethod === "webhook" ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <Label className="text-sm font-medium mb-2 block">URL du Webhook</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={`${window.location.origin}/api/webhooks/${selectedIntegration.id}/inbound`}
                          readOnly 
                          className="font-mono text-xs"
                        />
                        <Button 
                          size="icon" 
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/${selectedIntegration.id}/inbound`);
                            toast({ title: "Copié!" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button className="w-full" onClick={closeConnectDialog}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      C'est noté
                    </Button>
                  </div>
                ) : (
                  <>
                    {selectedIntegration.fields?.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                        {field.type === "select" ? (
                          <Select 
                            value={formData[field.key] || ""} 
                            onValueChange={(v) => setFormData(prev => ({ ...prev, [field.key]: v }))}
                          >
                            <SelectTrigger data-testid={`select-${field.key}`}>
                              <SelectValue placeholder={field.placeholder || "Sélectionner..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.key === "region" && (
                                <>
                                  <SelectItem value="eu">Europe (EU)</SelectItem>
                                  <SelectItem value="us">États-Unis (US)</SelectItem>
                                </>
                              )}
                              {field.key === "environment" && (
                                <>
                                  <SelectItem value="production">Production</SelectItem>
                                  <SelectItem value="sandbox">Sandbox</SelectItem>
                                </>
                              )}
                              {field.key === "authType" && (
                                <>
                                  <SelectItem value="bearer">Bearer Token</SelectItem>
                                  <SelectItem value="basic">Basic Auth</SelectItem>
                                  <SelectItem value="hmac">HMAC</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        ) : field.type === "toggle" ? (
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={formData[field.key] === "true"}
                              onCheckedChange={(v) => setFormData(prev => ({ ...prev, [field.key]: v ? "true" : "false" }))}
                              data-testid={`switch-${field.key}`}
                            />
                            <span className="text-sm text-muted-foreground">Activer SSL</span>
                          </div>
                        ) : (
                          <Input
                            id={field.key}
                            type={field.type}
                            placeholder={field.placeholder}
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                            data-testid={`input-${field.key}`}
                          />
                        )}
                      </div>
                    ))}

                    <div className="flex gap-2 pt-4">
                      <Button 
                        variant="outline" 
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="flex-1"
                        data-testid="button-test-connection"
                      >
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : testSuccess === true ? (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        ) : testSuccess === false ? (
                          <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                        ) : (
                          <Key className="h-4 w-4 mr-2" />
                        )}
                        Tester
                      </Button>
                      <Button 
                        onClick={handleSubmitConnection}
                        disabled={connectMutation.isPending || !selectedIntegration.fields?.every(f => !f.required || formData[f.key])}
                        className="flex-1"
                        data-testid="button-submit-connection"
                      >
                        {connectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plug className="h-4 w-4 mr-2" />
                        )}
                        Connecter
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer Note */}
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              L'intégration exacte dépend de votre environnement métier et de vos outils existants.
              Notre équipe adapte SpeedAI à votre stack pour garantir performance et fiabilité.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
