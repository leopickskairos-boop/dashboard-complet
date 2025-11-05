import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import type { User, PublicUser } from "@shared/schema";

const SESSION_SECRET = process.env.SESSION_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRY = "7d";
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

// Generate JWT token
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, SESSION_SECRET, { expiresIn: JWT_EXPIRY });
}

// Verify JWT token
export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, SESSION_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Compare password
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate verification token
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

// Get verification token expiry date
export function getVerificationTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS);
  return expiry;
}

// Convert User to PublicUser (remove sensitive data)
export function toPublicUser(user: User): PublicUser {
  const { password, verificationToken, verificationTokenExpiry, ...publicUser } = user;
  return publicUser;
}

// Authentication middleware
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Token invalide" });
  }

  const user = await storage.getUser(payload.userId);
  if (!user) {
    return res.status(401).json({ message: "Utilisateur non trouvé" });
  }

  // Attach user to request
  (req as any).user = user;
  next();
}

// Require verified email middleware
export async function requireVerified(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User;
  
  if (!user.isVerified) {
    return res.status(403).json({ message: "Email non vérifié" });
  }

  next();
}

// Require active subscription middleware
export async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User;
  
  if (!user.subscriptionStatus || user.subscriptionStatus !== 'active') {
    return res.status(403).json({ message: "Abonnement requis" });
  }

  // Check if subscription is still valid
  if (user.subscriptionCurrentPeriodEnd) {
    const now = new Date();
    const expiry = new Date(user.subscriptionCurrentPeriodEnd);
    if (now > expiry) {
      return res.status(403).json({ message: "Abonnement expiré" });
    }
  }

  next();
}
