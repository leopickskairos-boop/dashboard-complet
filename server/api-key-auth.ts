import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { isValidApiKeyFormat } from "./api-key";

/**
 * Middleware to authenticate requests using API key from Authorization header
 * Expected format: Authorization: Bearer speedai_live_xxxxx
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

    // Find user by API key
    const user = await storage.getUserByApiKey(apiKey);
    
    if (!user) {
      return res.status(401).json({ 
        error: "Invalid API key",
        message: "Clé API invalide ou révoquée" 
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        error: "Email not verified",
        message: "Veuillez vérifier votre email avant d'utiliser l'API" 
      });
    }

    // Check if user has active subscription
    if (user.subscriptionStatus !== 'active') {
      return res.status(403).json({ 
        error: "No active subscription",
        message: "Un abonnement actif est requis pour utiliser l'API" 
      });
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("API key authentication error:", error);
    res.status(500).json({ 
      error: "Authentication error",
      message: "Erreur lors de l'authentification" 
    });
  }
}
