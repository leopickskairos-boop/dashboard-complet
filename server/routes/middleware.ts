// Shared middleware and utilities for route modules
import type { Request, Response, NextFunction } from "express";
import Stripe from "stripe";

// Re-export auth middleware
export {
  requireAuth,
  requireVerified,
  requireSubscription,
  hashPassword,
  comparePassword,
  generateToken,
  generateVerificationToken,
  getVerificationTokenExpiry,
  toPublicUser,
} from "../auth";

// Re-export API key auth
export { requireApiKey } from "../api-key-auth";

// Re-export storage
export { storage } from "../storage";

// Re-export notification utilities
export {
  notifySubscriptionAlert,
  notifyPasswordChanged,
} from "../notifications";

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        isVerified: boolean;
        accountStatus: string;
      };
      logout?: (callback: (err: any) => void) => void;
    }
  }
}

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Helper function to get frontend URL
export function getFrontendUrl(): string {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  // In production, REPLIT_DOMAINS contains the production URL(s)
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    const productionDomain = domains.find(d => d.includes('.replit.app')) || domains[0];
    return `https://${productionDomain}`;
  }
  // In development
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
}

// Helper to require admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Accès refusé - Admin requis" });
  }
  next();
}
