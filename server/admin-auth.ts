import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User;
  
  if (!user) {
    return res.status(401).json({ 
      message: "Authentification requise" 
    });
  }

  if (user.role !== "admin") {
    return res.status(403).json({ 
      message: "Accès refusé : droits administrateur requis" 
    });
  }

  next();
}
