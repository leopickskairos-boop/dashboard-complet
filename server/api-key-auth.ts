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
    // ===== DEBUG: Log ALL headers for troubleshooting =====
    console.log("\n" + "=".repeat(60));
    console.log("🔍 [API KEY DEBUG] Incoming request to:", req.method, req.path);
    console.log("📋 [API KEY DEBUG] ALL Headers received:");
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'authorization') {
        // Mask part of the API key for security
        const maskedValue = typeof value === 'string' && value.length > 30 
          ? value.substring(0, 30) + "..." + value.substring(value.length - 10)
          : value;
        console.log(`   ${key}: ${maskedValue}`);
        console.log(`   [FULL LENGTH]: ${typeof value === 'string' ? value.length : 'N/A'} chars`);
        // Check for hidden characters
        if (typeof value === 'string') {
          const charCodes = value.slice(0, 10).split('').map(c => c.charCodeAt(0));
          console.log(`   [FIRST 10 CHAR CODES]: ${charCodes.join(', ')}`);
        }
      } else {
        console.log(`   ${key}: ${value}`);
      }
    }
    console.log("=".repeat(60));
    
    const authHeader = req.headers.authorization;
    const xApiKeyHeader = req.headers['x-api-key'] as string | undefined;
    const queryApiKey = req.query.api_key as string | undefined;
    let apiKey: string | null = null;

    // Try X-API-Key header first (most common for N8N)
    if (xApiKeyHeader) {
      apiKey = xApiKeyHeader.trim();
      console.log("🔑 [DEBUG] API key from X-API-Key header, length:", apiKey.length);
    }
    // Then try query parameter (useful for N8N when headers don't persist)
    else if (queryApiKey) {
      apiKey = queryApiKey.trim();
      console.log("🔑 [DEBUG] API key from query parameter, length:", apiKey.length);
    }
    // Then try Authorization header
    else if (authHeader) {
      console.log("🔑 [DEBUG] Raw authHeader length:", authHeader.length);
      console.log("🔑 [DEBUG] Raw authHeader:", JSON.stringify(authHeader));
      
      const parts = authHeader.split(" ");
      console.log("🔑 [DEBUG] Parts after split:", parts.length, "| Part[0]:", JSON.stringify(parts[0]), "| Part[1] length:", parts[1]?.length);
      
      if (parts.length === 2 && parts[0] === "Bearer") {
        // Standard format: Bearer xxx
        apiKey = parts[1];
        console.log("🔑 [DEBUG] Extracted API key from Bearer format");
      } else if (parts.length === 1 && parts[0].startsWith('speedai_')) {
        // Direct format: speedai_live_xxx (without Bearer prefix)
        apiKey = parts[0];
        console.log("🔑 [DEBUG] Extracted API key directly (no Bearer prefix)");
      }
      
      if (apiKey) {
        console.log("🔑 [DEBUG] Extracted API key length:", apiKey.length);
        console.log("🔑 [DEBUG] API key first 30 chars:", apiKey.substring(0, 30));
        console.log("🔑 [DEBUG] API key last 10 chars:", apiKey.substring(apiKey.length - 10));
        
        // ===== DETAILED CHARACTER ANALYSIS =====
        console.log("\n🔬 [CHAR ANALYSIS] Full API key character analysis:");
        console.log("   Expected length: 77 | Actual length:", apiKey.length);
        console.log("   First 5 chars:", JSON.stringify(apiKey.substring(0, 5)));
        console.log("   Last 5 chars:", JSON.stringify(apiKey.substring(apiKey.length - 5)));
        
        // Show char codes for first 15 chars
        const first15Codes = [...apiKey.slice(0, 15)].map((c, i) => `${i}:${c}(${c.charCodeAt(0)})`);
        console.log("   First 15 char codes:", first15Codes.join(' '));
        
        // Show char codes for last 15 chars
        const last15 = apiKey.slice(-15);
        const last15Codes = [...last15].map((c, i) => `${apiKey.length - 15 + i}:${c}(${c.charCodeAt(0)})`);
        console.log("   Last 15 char codes:", last15Codes.join(' '));
        
        // Check for any non-hex characters after prefix
        const keyPart = apiKey.replace('speedai_live_', '');
        const nonHexMatch = keyPart.match(/[^0-9a-f]/g);
        if (nonHexMatch) {
          console.log("   ⚠️ NON-HEX CHARS FOUND:", nonHexMatch.map(c => `'${c}'(${c.charCodeAt(0)})`).join(', '));
        } else {
          console.log("   ✅ All hex chars valid after prefix");
        }
        
        // Check for whitespace
        if (apiKey.includes(' ') || apiKey.includes('\n') || apiKey.includes('\r') || apiKey.includes('\t')) {
          console.log("   ⚠️ WHITESPACE DETECTED IN KEY!");
        }
        
        // Trim test
        const trimmedKey = apiKey.trim();
        if (trimmedKey !== apiKey) {
          console.log("   ⚠️ KEY HAS TRAILING/LEADING WHITESPACE!");
          console.log("   Original length:", apiKey.length, "| Trimmed length:", trimmedKey.length);
          apiKey = trimmedKey; // Auto-fix!
          console.log("   ✅ Auto-fixed by trimming");
        }
        console.log("");
        
      } else {
        console.log("❌ [DEBUG] Header format issue - parts:", parts.length, "| parts[0]:", JSON.stringify(parts[0]));
      }
    } else {
      console.log("❌ [DEBUG] No Authorization header found");
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