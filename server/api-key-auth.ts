import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { isValidApiKeyFormat, verifyApiKey } from "./api-key";

// N8N Master API Key - allows N8N to create sessions for any client by specifying client_id
// Format: speedai_n8n_xxxxxxxx (different prefix to distinguish from user keys)
const N8N_MASTER_KEY = process.env.N8N_MASTER_API_KEY;

/**
 * Check if an API key is the N8N master key
 */
function isN8nMasterKey(apiKey: string): boolean {
  if (!N8N_MASTER_KEY) return false;
  return apiKey === N8N_MASTER_KEY;
}

/**
 * Middleware to authenticate requests using API key from Authorization header
 * Expected format: Authorization: Bearer speedai_live_xxxxx
 * 
 * Also supports N8N Master Key for multi-client workflows:
 * - Use N8N_MASTER_API_KEY to authenticate
 * - Specify client_id or client_email in body to act on behalf of that client
 * 
 * Security: API keys are hashed with bcrypt before storage.
 * This middleware compares the provided key against all stored hashes.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let apiKey: string | null = null;

    // Try to get API key from Authorization header first
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        apiKey = parts[1];
      }
    }
    
    // Fallback: Try to get API key from request body (N8N sends it as dashboard_api_key)
    if (!apiKey && req.body && req.body.dashboard_api_key) {
      apiKey = req.body.dashboard_api_key;
      console.log("🔑 API Key from body (dashboard_api_key)");
    }

    if (!apiKey) {
      return res.status(401).json({ 
        error: "Missing API key",
        message: "Veuillez fournir une clé API via Authorization: Bearer YOUR_API_KEY ou dashboard_api_key dans le body" 
      });
    }

    // ===== N8N MASTER KEY AUTHENTICATION =====
    // Allows N8N to create sessions for any client by specifying client_id or client_email
    if (isN8nMasterKey(apiKey)) {
      console.log("🔑 N8N Master Key detected");
      
      const clientId = req.body?.client_id;
      const clientEmail = req.body?.client_email;
      
      if (!clientId && !clientEmail) {
        return res.status(400).json({
          error: "Missing client identifier",
          message: "Avec la clé master N8N, vous devez spécifier client_id ou client_email dans le body",
          example: {
            client_id: "user-uuid-here",
            client_email: "client@example.com"
          }
        });
      }
      
      // Find the target client
      let targetUser = null;
      if (clientId) {
        targetUser = await storage.getUser(clientId);
      } else if (clientEmail) {
        targetUser = await storage.getUserByEmail(clientEmail);
      }
      
      if (!targetUser) {
        console.log("❌ N8N Master: Client not found:", clientId || clientEmail);
        return res.status(404).json({
          error: "Client not found",
          message: `Client introuvable: ${clientId || clientEmail}`
        });
      }
      
      console.log("✅ N8N Master Key: Acting on behalf of:", targetUser.email);
      
      // Attach user to request (skip subscription/verification checks for master key)
      (req as any).user = targetUser;
      (req as any).isN8nMasterAuth = true;
      next();
      return;
    }

    // ===== STANDARD USER API KEY AUTHENTICATION =====
    
    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      return res.status(401).json({ 
        error: "Invalid API key format",
        message: "La clé API doit commencer par 'speedai_live_' et avoir 64 caractères hexadécimaux" 
      });
    }

    // Get all users with API keys and compare hashes
    const usersWithApiKeys = await storage.getAllUsersWithApiKey();

    // DEBUG LOG
    console.log("🔑 API Key Auth Debug:");
    console.log("  - Clé reçue:", apiKey.substring(0, 30) + "...");
    console.log("  - Nombre d'utilisateurs avec API key:", usersWithApiKeys.length);
    for (const user of usersWithApiKeys) {
      console.log("  - User:", user.email, "| Hash exists:", !!user.apiKeyHash, "| Hash preview:", user.apiKeyHash?.substring(0, 20) + "...");
    }

    let matchedUser = null;
    for (const user of usersWithApiKeys) {
      if (user.apiKeyHash) {
        const isMatch = await verifyApiKey(apiKey, user.apiKeyHash);
        console.log("  - Comparing with", user.email, "| Match:", isMatch);
        if (isMatch) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      console.log("❌ No matching user found for API key");
      return res.status(401).json({ 
        error: "Invalid API key",
        message: "Clé API invalide ou révoquée" 
      });
    }

    console.log("✅ API Key matched user:", matchedUser.email);

    // Check if user is verified
    if (!matchedUser.isVerified) {
      console.log("❌ User not verified:", matchedUser.email);
      return res.status(403).json({ 
        error: "Email not verified",
        message: "Veuillez vérifier votre email avant d'utiliser l'API" 
      });
    }

    // Check if user has active subscription OR is in trial period
    const accountStatus = (matchedUser as any).accountStatus || 'expired';
    const isTrialUser = accountStatus === 'trial';
    const isActiveSubscriber = matchedUser.subscriptionStatus === 'active';
    
    if (!isTrialUser && !isActiveSubscriber) {
      console.log("❌ User subscription not active:", matchedUser.email, "subscriptionStatus:", matchedUser.subscriptionStatus, "accountStatus:", accountStatus);
      return res.status(403).json({ 
        error: "No active subscription",
        message: "Un abonnement actif ou période d'essai est requis pour utiliser l'API" 
      });
    }
    
    console.log("✅ User access granted:", matchedUser.email, "| Trial:", isTrialUser, "| Active:", isActiveSubscriber);

    // Attach user to request
    (req as any).user = matchedUser;
    console.log("✅ API Key auth successful for:", matchedUser.email);
    next();
  } catch (error) {
    console.error("API key authentication error:", error);
    res.status(500).json({ 
      error: "Authentication error",
      message: "Erreur lors de l'authentification" 
    });
  }
}