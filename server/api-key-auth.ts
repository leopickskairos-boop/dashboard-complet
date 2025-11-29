import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { isValidApiKeyFormat, verifyApiKey } from "./api-key";

/**
 * Middleware to authenticate requests using API key from Authorization header
 * Expected format: Authorization: Bearer speedai_live_xxxxx
 * 
 * Security: API keys are hashed with bcrypt before storage.
 * This middleware compares the provided key against all stored hashes.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ 
        error: "Missing Authorization header",
        message: "Veuillez fournir une clé API dans le header Authorization: Bearer YOUR_API_KEY" 
      });
    }

    // Extract Bearer token
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ 
        error: "Invalid Authorization format",
        message: "Format attendu: Authorization: Bearer YOUR_API_KEY" 
      });
    }

    const apiKey = parts[1];

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

    // Check if user has active subscription
    if (matchedUser.subscriptionStatus !== 'active') {
      console.log("❌ User subscription not active:", matchedUser.email, matchedUser.subscriptionStatus);
      return res.status(403).json({ 
        error: "No active subscription",
        message: "Un abonnement actif est requis pour utiliser l'API" 
      });
    }

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