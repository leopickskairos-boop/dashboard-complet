import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { Tenant, TenantUserRole, TenantSettings } from "@shared/schema";

export interface TenantContext {
  tenant: Tenant;
  userRole: TenantUserRole;
  settings?: TenantSettings;
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next();
  }

  const tenantId = req.headers["x-tenant-id"] as string | undefined;

  if (!tenantId) {
    const defaultRole = await storage.getDefaultTenantRoleForUser(req.user.id);
    if (defaultRole) {
      const tenant = await storage.getTenant(defaultRole.tenantId);
      if (tenant && tenant.status === "active") {
        req.tenantContext = {
          tenant,
          userRole: defaultRole,
        };
      }
    }
    return next();
  }

  const userRole = await storage.getTenantUserRole(tenantId, req.user.id);
  if (!userRole) {
    return res.status(403).json({ message: "Accès refusé à ce tenant" });
  }

  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return res.status(404).json({ message: "Tenant non trouvé" });
  }

  if (tenant.status === "suspended") {
    return res.status(403).json({ message: "Ce compte est suspendu" });
  }

  req.tenantContext = {
    tenant,
    userRole,
  };

  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantContext) {
    return res.status(400).json({ message: "Tenant requis" });
  }
  next();
}

export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantContext) {
    return res.status(400).json({ message: "Tenant requis" });
  }

  if (req.tenantContext.userRole.role !== "tenant_admin") {
    return res.status(403).json({ message: "Droits admin tenant requis" });
  }

  next();
}

export function requireTenantRole(roles: Array<"tenant_admin" | "staff" | "viewer">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenantContext) {
      return res.status(400).json({ message: "Tenant requis" });
    }

    if (!roles.includes(req.tenantContext.userRole.role)) {
      return res.status(403).json({ message: "Permissions insuffisantes" });
    }

    next();
  };
}

export async function isSuperAdmin(req: Request): Promise<boolean> {
  return req.user?.role === "admin";
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Super admin requis" });
  }
  next();
}
