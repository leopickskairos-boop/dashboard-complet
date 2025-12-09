import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { createConnectionSchema, User } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "./auth";
import { integrationService } from "./integrations/integration-service";
import { isProviderSupported, getSupportedProviders } from "./integrations/adapter-factory";
import { hubspotOAuthRouter, getHubSpotAuthUrl, isHubSpotConfigured } from "./integrations/oauth/hubspot-oauth";

const router = Router();

// Helper to get authenticated user ID from JWT token
const getUserId = (req: Request): string => {
  const user = (req as any).user as User;
  return user.id;
};

// ===== PROVIDER CONFIGS =====

// Get all available integration providers
router.get("/providers", requireAuth, async (req: Request, res: Response) => {
  try {
    const providers = await storage.getProviderConfigs();
    
    // If no providers in DB, return hardcoded list
    if (providers.length === 0) {
      const defaultProviders = getDefaultProviders();
      return res.json(defaultProviders);
    }
    
    res.json(providers);
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des providers" });
  }
});

// Get providers by category
router.get("/providers/category/:category", requireAuth, async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const providers = await storage.getProviderConfigsByCategory(category);
    
    if (providers.length === 0) {
      const defaultProviders = getDefaultProviders().filter(p => p.category === category);
      return res.json(defaultProviders);
    }
    
    res.json(providers);
  } catch (error) {
    console.error("Error fetching providers by category:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des providers" });
  }
});

// ===== TEST CREDENTIALS (without creating connection) =====

// Test credentials before creating connection
router.post("/test-credentials", requireAuth, async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, apiSecret, instanceUrl } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        message: "Provider et clé API requis" 
      });
    }
    
    // Check if provider is supported
    if (!isProviderSupported(provider)) {
      return res.status(400).json({ 
        success: false, 
        message: `Le provider ${provider} n'est pas encore supporté pour les tests de connexion` 
      });
    }
    
    // Test the connection directly with credentials
    const result = await integrationService.testCredentials(provider, {
      apiKey,
      apiSecret,
      instanceUrl
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error testing credentials:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erreur lors du test des identifiants" 
    });
  }
});

// ===== CREATE AND CONNECT (one-step) =====

// Create connection and connect with credentials in one step
router.post("/connections/create-and-connect", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { provider, name, authType, apiKey, apiSecret, instanceUrl } = req.body;
    
    if (!provider || !name) {
      return res.status(400).json({ error: "Provider et nom requis" });
    }
    
    // Check if connection already exists for this provider
    const existing = await storage.getExternalConnectionByProvider(userId, provider);
    if (existing) {
      return res.status(400).json({ error: "Une connexion existe déjà pour ce provider" });
    }
    
    // Create the connection with credentials
    const connection = await storage.createExternalConnection({
      userId,
      provider,
      name,
      authType: authType || "api_key",
      apiKey,
      apiSecret,
      instanceUrl,
      status: "pending"
    });
    
    // If we have API credentials, test and activate
    if (apiKey && isProviderSupported(provider)) {
      const testResult = await integrationService.testConnection(connection.id, userId);
      
      if (testResult.success) {
        await storage.updateExternalConnection(connection.id, userId, {
          status: "active",
          connectedAt: new Date(),
          accountId: testResult.accountInfo?.id,
          lastError: null
        });
        
        return res.status(201).json({
          success: true,
          message: "Connexion créée et activée",
          connection: {
            ...connection,
            status: "active",
            apiKey: "[SECURED]",
            apiSecret: apiSecret ? "[SECURED]" : null
          },
          accountInfo: testResult.accountInfo
        });
      } else {
        await storage.updateExternalConnection(connection.id, userId, {
          status: "error",
          lastError: testResult.message
        });
        
        return res.status(400).json({
          success: false,
          message: testResult.message,
          connection: {
            ...connection,
            status: "error",
            apiKey: "[SECURED]",
            apiSecret: apiSecret ? "[SECURED]" : null
          }
        });
      }
    }
    
    // If no credentials or unsupported provider, just create pending connection
    res.status(201).json({
      success: true,
      message: "Connexion créée (configuration requise)",
      connection: {
        ...connection,
        apiKey: connection.apiKey ? "[SECURED]" : null,
        apiSecret: connection.apiSecret ? "[SECURED]" : null
      }
    });
  } catch (error) {
    console.error("Error creating and connecting:", error);
    res.status(500).json({ error: "Erreur lors de la création de la connexion" });
  }
});

// ===== EXTERNAL CONNECTIONS =====

// Get all connections for user
router.get("/connections", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const connections = await storage.getExternalConnections(userId);
    
    // Mask sensitive data
    const safeConnections = connections.map(conn => ({
      ...conn,
      accessToken: conn.accessToken ? "***" : null,
      refreshToken: conn.refreshToken ? "***" : null,
      apiKey: conn.apiKey ? "***" : null,
      apiSecret: conn.apiSecret ? "***" : null,
      dbPassword: conn.dbPassword ? "***" : null,
      webhookSecret: conn.webhookSecret ? "***" : null
    }));
    
    res.json(safeConnections);
  } catch (error) {
    console.error("Error fetching connections:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des connexions" });
  }
});

// Get single connection
router.get("/connections/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const connection = await storage.getExternalConnectionById(req.params.id, userId);
    
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    // ALWAYS mask sensitive credentials - never expose raw values
    res.json({
      ...connection,
      accessToken: connection.accessToken ? "[REDACTED]" : null,
      refreshToken: connection.refreshToken ? "[REDACTED]" : null,
      apiKey: connection.apiKey ? "[REDACTED]" : null,
      apiSecret: connection.apiSecret ? "[REDACTED]" : null,
      dbPassword: connection.dbPassword ? "[REDACTED]" : null,
      webhookSecret: connection.webhookSecret ? "[REDACTED]" : null
    });
  } catch (error) {
    console.error("Error fetching connection:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la connexion" });
  }
});

// Create new connection
router.post("/connections", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const data = createConnectionSchema.parse(req.body);
    
    // Check if connection already exists for this provider
    const existing = await storage.getExternalConnectionByProvider(userId, data.provider);
    if (existing) {
      return res.status(400).json({ error: "Une connexion existe déjà pour ce provider" });
    }
    
    const connection = await storage.createExternalConnection({
      userId,
      ...data,
      status: "pending"
    });
    
    // SECURITY: Mask all credentials in response
    res.status(201).json({
      ...connection,
      accessToken: connection.accessToken ? "[SECURED]" : null,
      refreshToken: connection.refreshToken ? "[SECURED]" : null,
      apiKey: connection.apiKey ? "[SECURED]" : null,
      apiSecret: connection.apiSecret ? "[SECURED]" : null,
      dbPassword: connection.dbPassword ? "[SECURED]" : null,
      webhookSecret: connection.webhookSecret ? "[SECURED]" : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Données invalides", details: error.errors });
    }
    console.error("Error creating connection:", error);
    res.status(500).json({ error: "Erreur lors de la création de la connexion" });
  }
});

// Update connection
router.patch("/connections/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    
    const connection = await storage.updateExternalConnection(id, userId, req.body);
    
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    res.json(connection);
  } catch (error) {
    console.error("Error updating connection:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la connexion" });
  }
});

// Delete connection
router.delete("/connections/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    
    const connection = await storage.getExternalConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    await storage.deleteExternalConnection(id, userId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting connection:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de la connexion" });
  }
});

// Connect with API Key and TEST the connection
router.post("/connections/:id/connect-apikey", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { apiKey, apiSecret, instanceUrl } = req.body;
    
    const connection = await storage.getExternalConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    // First save the credentials (storage layer handles encryption automatically)
    await storage.updateExternalConnection(id, userId, {
      apiKey,
      apiSecret,
      instanceUrl,
      status: "pending"
    });
    
    // Now TEST the connection with real API call
    const testResult = await integrationService.testConnection(id, userId);
    
    if (testResult.success) {
      // Update status to active
      const updated = await storage.updateExternalConnection(id, userId, {
        status: "active",
        connectedAt: new Date(),
        accountId: testResult.accountInfo?.id,
        lastError: null
      });
      
      res.json({
        success: true,
        message: testResult.message,
        accountInfo: testResult.accountInfo,
        connection: {
          ...updated,
          apiKey: updated?.apiKey ? "[SECURED]" : null,
          apiSecret: updated?.apiSecret ? "[SECURED]" : null,
        }
      });
    } else {
      // Update status to error
      await storage.updateExternalConnection(id, userId, {
        status: "error",
        lastError: testResult.message
      });
      
      res.status(400).json({
        success: false,
        message: testResult.message
      });
    }
  } catch (error) {
    console.error("Error connecting with API key:", error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

// Test an existing connection
router.post("/connections/:id/test", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    
    const connection = await storage.getExternalConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    const result = await integrationService.testConnection(id, userId);
    
    if (result.success) {
      await storage.updateExternalConnection(id, userId, {
        status: "active",
        lastError: null
      });
    } else {
      await storage.updateExternalConnection(id, userId, {
        status: "error",
        lastError: result.message
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error("Error testing connection:", error);
    res.status(500).json({ error: "Erreur lors du test de connexion" });
  }
});

// Get supported providers with real status
router.get("/supported-providers", requireAuth, async (req: Request, res: Response) => {
  try {
    const providers = getSupportedProviders();
    res.json(providers);
  } catch (error) {
    console.error("Error fetching supported providers:", error);
    res.status(500).json({ error: "Erreur" });
  }
});

// ===== SYNC JOBS =====

// Get sync history for a connection
router.get("/connections/:id/sync-history", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const connection = await storage.getExternalConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    const jobs = await storage.getSyncJobsByConnection(id, limit);
    res.json(jobs);
  } catch (error) {
    console.error("Error fetching sync history:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

// Trigger manual sync - REAL synchronization
router.post("/connections/:id/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { fullSync = false } = req.body;
    
    const connection = await storage.getExternalConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    if (connection.status !== "active") {
      return res.status(400).json({ error: "La connexion n'est pas active" });
    }
    
    // Check if provider is supported for real sync
    if (!isProviderSupported(connection.provider)) {
      return res.status(400).json({ 
        error: `Le provider ${connection.provider} n'est pas encore supporté pour la synchronisation automatique`
      });
    }
    
    // Run real synchronization
    const result = await integrationService.syncConnection(id, userId, fullSync);
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Synchronisation réussie: ${result.customersImported} clients, ${result.ordersImported} commandes, ${result.transactionsImported} transactions`
        : `Synchronisation avec erreurs: ${result.errors.join(', ')}`,
      details: {
        customersImported: result.customersImported,
        ordersImported: result.ordersImported,
        transactionsImported: result.transactionsImported,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error("Error triggering sync:", error);
    res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});

// Sync all connections
router.post("/sync-all", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const result = await integrationService.syncAllConnections(userId);
    
    res.json({
      success: result.errors.length === 0,
      synced: result.synced,
      errors: result.errors
    });
  } catch (error) {
    console.error("Error syncing all:", error);
    res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});

// ===== FIELD MAPPINGS =====

// Get field mappings for a connection
router.get("/connections/:id/mappings", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    
    const connection = await storage.getExternalConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    const mappings = await storage.getFieldMappings(id);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching mappings:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des mappings" });
  }
});

// Update field mapping
router.put("/connections/:id/mappings/:entityType", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id, entityType } = req.params;
    const { mappings, customFields } = req.body;
    
    const connection = await storage.getExternalConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    const mapping = await storage.upsertFieldMapping(id, entityType, mappings, customFields);
    res.json(mapping);
  } catch (error) {
    console.error("Error updating mapping:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du mapping" });
  }
});

// ===== EXTERNAL CUSTOMERS =====

// Get external customers
router.get("/customers", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { search, source, segment, minSpent, maxSpent, limit, offset } = req.query;
    
    const customers = await storage.getExternalCustomers(userId, {
      search: search as string,
      source: source as string,
      segment: segment as string,
      minSpent: minSpent ? parseFloat(minSpent as string) : undefined,
      maxSpent: maxSpent ? parseFloat(maxSpent as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });
    
    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des clients" });
  }
});

// Get customer by ID
router.get("/customers/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const customer = await storage.getExternalCustomerById(req.params.id, userId);
    
    if (!customer) {
      return res.status(404).json({ error: "Client non trouvé" });
    }
    
    // Also fetch orders and activities
    const [orders, activities] = await Promise.all([
      storage.getCustomerOrders(customer.id),
      storage.getCustomerActivities(customer.id)
    ]);
    
    res.json({ ...customer, orders, activities });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du client" });
  }
});

// Get top customers
router.get("/customers/top", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const limit = parseInt(req.query.limit as string) || 10;
    
    const customers = await storage.getTopCustomers(userId, limit);
    res.json(customers);
  } catch (error) {
    console.error("Error fetching top customers:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des meilleurs clients" });
  }
});

// ===== EXTERNAL ORDERS =====

// Get external orders
router.get("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { customerId, source, status, dateFrom, dateTo, minAmount, maxAmount, limit, offset } = req.query;
    
    const orders = await storage.getExternalOrders(userId, {
      customerId: customerId as string,
      source: source as string,
      status: status as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });
    
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des commandes" });
  }
});

// Get order by ID
router.get("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const order = await storage.getExternalOrderById(req.params.id, userId);
    
    if (!order) {
      return res.status(404).json({ error: "Commande non trouvée" });
    }
    
    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la commande" });
  }
});

// Get order stats
router.get("/orders/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const period = (req.query.period as 'week' | 'month' | 'year' | 'all') || 'month';
    
    const stats = await storage.getOrderStats(userId, period);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
  }
});

// ===== EXTERNAL PRODUCTS =====

// Get external products
router.get("/products", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { search, category, source, isActive, limit, offset } = req.query;
    
    const products = await storage.getExternalProducts(userId, {
      search: search as string,
      category: category as string,
      source: source as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });
    
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des produits" });
  }
});

// Get top products
router.get("/products/top", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const limit = parseInt(req.query.limit as string) || 10;
    
    const products = await storage.getTopProducts(userId, limit);
    res.json(products);
  } catch (error) {
    console.error("Error fetching top products:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des meilleurs produits" });
  }
});

// ===== INTEGRATION STATS =====

// Get integration overview stats
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const stats = await storage.getIntegrationStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching integration stats:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
  }
});

// ===== HELPER FUNCTIONS =====

function getDefaultProviders() {
  return [
    // Generic CRMs
    {
      provider: "hubspot",
      displayName: "HubSpot",
      description: "CRM complet avec marketing, ventes et service client",
      category: "crm",
      logoUrl: "/integrations/hubspot.svg",
      color: "#ff7a59",
      authType: "oauth2",
      supportedEntities: ["contact", "company", "deal", "activity"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "salesforce",
      displayName: "Salesforce",
      description: "Leader mondial du CRM d'entreprise",
      category: "crm",
      logoUrl: "/integrations/salesforce.svg",
      color: "#00a1e0",
      authType: "oauth2",
      supportedEntities: ["contact", "company", "deal", "order", "activity"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: true,
      isPremium: true
    },
    {
      provider: "zoho",
      displayName: "Zoho CRM",
      description: "Suite CRM complète pour PME",
      category: "crm",
      logoUrl: "/integrations/zoho.svg",
      color: "#c8202b",
      authType: "oauth2",
      supportedEntities: ["contact", "company", "deal", "product", "activity"],
      supportsWebhooks: true,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "pipedrive",
      displayName: "Pipedrive",
      description: "CRM orienté ventes et pipeline",
      category: "crm",
      logoUrl: "/integrations/pipedrive.svg",
      color: "#21a166",
      authType: "api_key",
      supportedEntities: ["contact", "company", "deal", "activity"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "monday",
      displayName: "Monday.com",
      description: "Plateforme de gestion de travail avec CRM",
      category: "crm",
      logoUrl: "/integrations/monday.svg",
      color: "#ff3d57",
      authType: "api_key",
      supportedEntities: ["contact", "company", "deal", "activity"],
      supportsWebhooks: true,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: false
    },
    // Restaurant/Hospitality
    {
      provider: "zenchef",
      displayName: "Zenchef",
      description: "Gestion de réservations restaurants",
      category: "restaurant",
      logoUrl: "/integrations/zenchef.svg",
      color: "#f15a24",
      authType: "api_key",
      supportedEntities: ["contact", "reservation"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: false,
      isPremium: false
    },
    {
      provider: "thefork",
      displayName: "TheFork Manager",
      description: "Plateforme de réservation TheFork/LaFourchette",
      category: "restaurant",
      logoUrl: "/integrations/thefork.svg",
      color: "#00ab8f",
      authType: "api_key",
      supportedEntities: ["contact", "reservation"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: false,
      isPremium: false
    },
    {
      provider: "resy",
      displayName: "Resy",
      description: "Système de réservation premium",
      category: "restaurant",
      logoUrl: "/integrations/resy.svg",
      color: "#dc3545",
      authType: "api_key",
      supportedEntities: ["contact", "reservation"],
      supportsWebhooks: false,
      supportsRealtime: false,
      supportsBidirectional: false,
      isPremium: true
    },
    {
      provider: "opentable",
      displayName: "OpenTable",
      description: "Réservations restaurants internationales",
      category: "restaurant",
      logoUrl: "/integrations/opentable.svg",
      color: "#d32323",
      authType: "oauth2",
      supportedEntities: ["contact", "reservation"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: false,
      isPremium: true
    },
    {
      provider: "lightspeed_restaurant",
      displayName: "Lightspeed Restaurant",
      description: "POS et gestion restaurant",
      category: "restaurant",
      logoUrl: "/integrations/lightspeed.svg",
      color: "#ff6d00",
      authType: "oauth2",
      supportedEntities: ["contact", "order", "product"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: false,
      isPremium: true
    },
    // Hotel/Lodging
    {
      provider: "mews",
      displayName: "Mews",
      description: "PMS hôtelier nouvelle génération",
      category: "hotel",
      logoUrl: "/integrations/mews.svg",
      color: "#00b4d8",
      authType: "api_key",
      supportedEntities: ["contact", "reservation", "order"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: true,
      isPremium: true
    },
    {
      provider: "cloudbeds",
      displayName: "Cloudbeds",
      description: "Gestion hôtelière tout-en-un",
      category: "hotel",
      logoUrl: "/integrations/cloudbeds.svg",
      color: "#1e90ff",
      authType: "oauth2",
      supportedEntities: ["contact", "reservation"],
      supportsWebhooks: true,
      supportsRealtime: false,
      supportsBidirectional: false,
      isPremium: true
    },
    {
      provider: "opera_pms",
      displayName: "Opera PMS",
      description: "PMS Oracle pour grands hôtels",
      category: "hotel",
      logoUrl: "/integrations/opera.svg",
      color: "#f80000",
      authType: "api_key",
      supportedEntities: ["contact", "reservation"],
      supportsWebhooks: false,
      supportsRealtime: false,
      supportsBidirectional: false,
      isPremium: true
    },
    // Medical
    {
      provider: "doctolib",
      displayName: "Doctolib Pro",
      description: "Gestion de cabinet médical",
      category: "medical",
      logoUrl: "/integrations/doctolib.svg",
      color: "#0596de",
      authType: "oauth2",
      supportedEntities: ["contact", "appointment"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: false,
      isPremium: false
    },
    {
      provider: "drchrono",
      displayName: "DrChrono",
      description: "EHR et gestion de pratique",
      category: "medical",
      logoUrl: "/integrations/drchrono.svg",
      color: "#3498db",
      authType: "oauth2",
      supportedEntities: ["contact", "appointment", "invoice"],
      supportsWebhooks: true,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: true
    },
    // E-commerce
    {
      provider: "shopify",
      displayName: "Shopify",
      description: "Plateforme e-commerce leader",
      category: "ecommerce",
      logoUrl: "/integrations/shopify.svg",
      color: "#95bf47",
      authType: "oauth2",
      supportedEntities: ["contact", "order", "product"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "woocommerce",
      displayName: "WooCommerce",
      description: "E-commerce WordPress",
      category: "ecommerce",
      logoUrl: "/integrations/woocommerce.svg",
      color: "#96588a",
      authType: "api_key",
      supportedEntities: ["contact", "order", "product"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "prestashop",
      displayName: "PrestaShop",
      description: "Solution e-commerce open-source",
      category: "ecommerce",
      logoUrl: "/integrations/prestashop.svg",
      color: "#df0067",
      authType: "api_key",
      supportedEntities: ["contact", "order", "product"],
      supportsWebhooks: true,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "stripe",
      displayName: "Stripe",
      description: "Paiements et données clients",
      category: "ecommerce",
      logoUrl: "/integrations/stripe.svg",
      color: "#635bff",
      authType: "api_key",
      supportedEntities: ["contact", "payment", "invoice"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: false,
      isPremium: false
    },
    // Databases
    {
      provider: "airtable",
      displayName: "Airtable",
      description: "Base de données collaborative",
      category: "database",
      logoUrl: "/integrations/airtable.svg",
      color: "#18bfff",
      authType: "api_key",
      supportedEntities: ["contact", "custom"],
      supportsWebhooks: true,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "notion",
      displayName: "Notion",
      description: "Base de données et workspace",
      category: "database",
      logoUrl: "/integrations/notion.svg",
      color: "#000000",
      authType: "oauth2",
      supportedEntities: ["contact", "custom"],
      supportsWebhooks: false,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "google_sheets",
      displayName: "Google Sheets",
      description: "Tableurs Google connectés",
      category: "database",
      logoUrl: "/integrations/google-sheets.svg",
      color: "#0f9d58",
      authType: "oauth2",
      supportedEntities: ["contact", "order", "custom"],
      supportsWebhooks: false,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: false
    },
    {
      provider: "postgresql",
      displayName: "PostgreSQL",
      description: "Connexion directe base PostgreSQL",
      category: "database",
      logoUrl: "/integrations/postgresql.svg",
      color: "#336791",
      authType: "database_credentials",
      supportedEntities: ["contact", "order", "product", "custom"],
      supportsWebhooks: false,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: true
    },
    {
      provider: "mysql",
      displayName: "MySQL",
      description: "Connexion directe base MySQL",
      category: "database",
      logoUrl: "/integrations/mysql.svg",
      color: "#00758f",
      authType: "database_credentials",
      supportedEntities: ["contact", "order", "product", "custom"],
      supportsWebhooks: false,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: true
    },
    // Custom
    {
      provider: "custom_api",
      displayName: "API Personnalisée",
      description: "Connectez votre propre API REST",
      category: "custom",
      logoUrl: "/integrations/api.svg",
      color: "#6c757d",
      authType: "api_key",
      supportedEntities: ["contact", "order", "product", "custom"],
      supportsWebhooks: true,
      supportsRealtime: false,
      supportsBidirectional: true,
      isPremium: true
    },
    {
      provider: "webhook",
      displayName: "Webhook",
      description: "Recevez des données via webhooks",
      category: "custom",
      logoUrl: "/integrations/webhook.svg",
      color: "#6c757d",
      authType: "webhook_secret",
      supportedEntities: ["contact", "order", "custom"],
      supportsWebhooks: true,
      supportsRealtime: true,
      supportsBidirectional: false,
      isPremium: false
    }
  ];
}

// ===== OAUTH ROUTES =====

// Mount OAuth callback routers
router.use("/oauth/hubspot", hubspotOAuthRouter);

// Initiate OAuth flow
router.post("/connections/:id/oauth-start", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    
    const connection = await storage.getExternalConnectionById(id, userId);
    if (!connection) {
      return res.status(404).json({ error: "Connexion non trouvée" });
    }
    
    switch (connection.provider.toLowerCase()) {
      case 'hubspot':
        if (!isHubSpotConfigured()) {
          return res.status(400).json({ 
            error: "OAuth HubSpot non configuré",
            message: "Veuillez configurer HUBSPOT_CLIENT_ID et HUBSPOT_CLIENT_SECRET dans les variables d'environnement"
          });
        }
        const authUrl = getHubSpotAuthUrl(id, userId);
        res.json({ authUrl, provider: 'hubspot' });
        break;
        
      default:
        res.status(400).json({ error: `OAuth non supporté pour ${connection.provider}` });
    }
  } catch (error) {
    console.error("Error initiating OAuth:", error);
    res.status(500).json({ error: "Erreur lors de l'initialisation OAuth" });
  }
});

// Check OAuth configuration status
router.get("/oauth-status", requireAuth, async (req: Request, res: Response) => {
  res.json({
    hubspot: isHubSpotConfigured(),
    salesforce: false,
    zoho: false,
    google: false
  });
});

// ===== WEBHOOK CONNECTIONS =====

// Temporary server-side storage for pending webhook credentials
// Key: pendingToken, Value: { userId, webhookId, webhookSecret, expiresAt }
const pendingWebhookCredentials = new Map<string, {
  userId: string;
  webhookId: string;
  webhookSecret: string;
  expiresAt: Date;
}>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = new Date();
  Array.from(pendingWebhookCredentials.entries()).forEach(([key, value]) => {
    if (value.expiresAt < now) {
      pendingWebhookCredentials.delete(key);
    }
  });
}, 5 * 60 * 1000);

// Generate webhook credentials server-side and store temporarily (secure)
router.post("/connections/generate-webhook-credentials", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    // Generate secure credentials
    const webhookId = `wh_${crypto.randomBytes(16).toString('hex')}`;
    const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
    const pendingToken = crypto.randomBytes(32).toString('hex');
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    
    const webhookUrl = `${baseUrl}/api/integrations/webhooks/incoming/${webhookId}`;
    
    // Store credentials temporarily (expires in 30 minutes)
    pendingWebhookCredentials.set(pendingToken, {
      userId,
      webhookId,
      webhookSecret,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });
    
    res.json({
      pendingToken,  // Client must send this to create-webhook
      webhookUrl,
      webhookSecret  // Show once for user to copy
    });
  } catch (error) {
    console.error("Error generating webhook credentials:", error);
    res.status(500).json({ error: "Erreur lors de la génération des identifiants webhook" });
  }
});

// Create webhook connection using pre-generated credentials from pendingToken
router.post("/connections/create-webhook", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { name, pendingToken } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: "Nom de connexion requis" });
    }
    
    if (!pendingToken) {
      return res.status(400).json({ error: "Token de confirmation requis" });
    }
    
    // Retrieve and validate pre-generated credentials
    const pending = pendingWebhookCredentials.get(pendingToken);
    
    if (!pending) {
      return res.status(400).json({ error: "Token invalide ou expiré. Veuillez regénérer les identifiants." });
    }
    
    if (pending.userId !== userId) {
      return res.status(403).json({ error: "Token non autorisé pour cet utilisateur." });
    }
    
    if (pending.expiresAt < new Date()) {
      pendingWebhookCredentials.delete(pendingToken);
      return res.status(400).json({ error: "Token expiré. Veuillez regénérer les identifiants." });
    }
    
    // Delete the pending token immediately to prevent reuse
    pendingWebhookCredentials.delete(pendingToken);
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    
    const webhookUrl = `${baseUrl}/api/integrations/webhooks/incoming/${pending.webhookId}`;
    
    // Create the connection using stored credentials
    const connection = await storage.createExternalConnection({
      userId,
      provider: "webhook",
      name: name.trim(),
      authType: "webhook_secret",
      webhookSecret: pending.webhookSecret,
      webhookUrl,
      accountId: pending.webhookId,
      status: "active",
      connectedAt: new Date()
    });
    
    res.status(201).json({
      success: true,
      message: "Webhook configuré avec succès",
      connection: {
        ...connection,
        webhookSecret: "[SECURED]"
      },
      webhookEndpoint: webhookUrl,
      webhookId: pending.webhookId
      // Note: webhookSecret not returned here - user should have copied it from generate step
    });
  } catch (error) {
    console.error("Error creating webhook connection:", error);
    res.status(500).json({ error: "Erreur lors de la création du webhook" });
  }
});

// ===== INCOMING WEBHOOK ENDPOINT (NO AUTH - receives external data) =====

// Receive incoming webhook data from external systems
router.post("/webhooks/incoming/:webhookId", async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;
    const signature = req.headers['x-speedai-signature'] as string || req.headers['x-webhook-signature'] as string;
    const payload = req.body;
    
    console.log(`[Webhook] Received data for webhook: ${webhookId}`);
    
    // Find the connection by webhookId (stored in accountId)
    const connections = await storage.getAllActiveConnections();
    const connection = connections.find((c: any) => c.accountId === webhookId && c.provider === "webhook");
    
    if (!connection) {
      console.warn(`[Webhook] Unknown webhook ID: ${webhookId}`);
      return res.status(404).json({ error: "Webhook not found" });
    }
    
    // Verify signature (required if webhook has a secret configured)
    if (connection.webhookSecret) {
      if (!signature) {
        console.warn(`[Webhook] Missing signature for webhook: ${webhookId}`);
        return res.status(401).json({ error: "Missing signature header (X-SpeedAI-Signature)" });
      }
      
      try {
        // Note: HMAC is computed on JSON.stringify(payload) - external systems must sign the same format
        const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const expectedSignature = crypto
          .createHmac('sha256', connection.webhookSecret)
          .update(payloadString)
          .digest('hex');
        
        // Extract signature value (handle "sha256=" prefix)
        const providedSig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
        
        // Validate signature format before comparison
        if (!/^[a-fA-F0-9]{64}$/.test(providedSig)) {
          console.warn(`[Webhook] Malformed signature format for webhook: ${webhookId}`);
          return res.status(401).json({ error: "Invalid signature format" });
        }
        
        // Use timing-safe comparison to prevent timing attacks
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const providedBuffer = Buffer.from(providedSig, 'hex');
        
        if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
          console.warn(`[Webhook] Invalid signature for webhook: ${webhookId}`);
          return res.status(401).json({ error: "Invalid signature" });
        }
      } catch (sigError) {
        console.warn(`[Webhook] Signature verification error for webhook: ${webhookId}`, sigError);
        return res.status(401).json({ error: "Invalid signature" });
      }
    }
    
    // Log the webhook data
    console.log(`[Webhook] Processing data from ${connection.name}:`, {
      type: payload.type || payload.event || 'unknown',
      data: payload.data ? 'present' : 'none'
    });
    
    // Update last sync time
    await storage.updateExternalConnection(connection.id, connection.userId, {
      lastSyncAt: new Date()
    });
    
    // Process the webhook data based on type
    const entityType = payload.type || payload.event || 'custom';
    const records = Array.isArray(payload.data) ? payload.data : [payload.data || payload];
    
    // Log received data for now (can be extended to store in external_orders, external_contacts, etc.)
    console.log(`[Webhook] Processed ${records.length} records of type: ${entityType}`);
    
    res.json({ 
      success: true, 
      message: "Webhook received",
      processed: records.length 
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Error processing webhook" });
  }
});

export default router;
