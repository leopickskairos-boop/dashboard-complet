import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { 
  resolveTenant, 
  requireTenant, 
  requireTenantAdmin, 
  requireSuperAdmin 
} from "../middleware/tenant-resolver";
import { createTenantSchema, updateTenantSchema } from "@shared/schema";

const router = Router();

// ===== SUPER ADMIN ROUTES =====

router.post("/", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Données invalides", errors: parsed.error.errors });
    }

    const existingSlug = await storage.getTenantBySlug(parsed.data.slug);
    if (existingSlug) {
      return res.status(409).json({ message: "Ce slug est déjà utilisé" });
    }

    const tenant = await storage.createTenant(parsed.data);
    await storage.upsertTenantSettings(tenant.id, {});
    
    res.status(201).json(tenant);
  } catch (error) {
    console.error("Error creating tenant:", error);
    res.status(500).json({ message: "Erreur lors de la création du tenant" });
  }
});

router.get("/", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const tenants = await storage.getAllTenants();
    res.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des tenants" });
  }
});

router.get("/:id", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === "admin";
    
    if (!isSuperAdmin && req.tenantContext?.tenant.id !== id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const tenant = await storage.getTenant(id);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant non trouvé" });
    }

    res.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ message: "Erreur lors de la récupération du tenant" });
  }
});

router.patch("/:id", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === "admin";
    const isTenantAdmin = req.tenantContext?.tenant.id === id && req.tenantContext?.userRole.role === "tenant_admin";

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Données invalides", errors: parsed.error.errors });
    }

    if (parsed.data.slug) {
      const existingSlug = await storage.getTenantBySlug(parsed.data.slug);
      if (existingSlug && existingSlug.id !== id) {
        return res.status(409).json({ message: "Ce slug est déjà utilisé" });
      }
    }

    const tenant = await storage.updateTenant(id, parsed.data);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant non trouvé" });
    }

    res.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour du tenant" });
  }
});

// ===== TENANT SETTINGS =====

router.get("/:id/settings", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === "admin";
    
    if (!isSuperAdmin && req.tenantContext?.tenant.id !== id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const settings = await storage.getTenantSettings(id);
    res.json(settings || {});
  } catch (error) {
    console.error("Error fetching tenant settings:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des paramètres" });
  }
});

router.patch("/:id/settings", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === "admin";
    const isTenantAdmin = req.tenantContext?.tenant.id === id && req.tenantContext?.userRole.role === "tenant_admin";

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const settings = await storage.upsertTenantSettings(id, req.body);
    res.json(settings);
  } catch (error) {
    console.error("Error updating tenant settings:", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour des paramètres" });
  }
});

// ===== TENANT FEATURES =====

router.get("/:id/features", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === "admin";
    
    if (!isSuperAdmin && req.tenantContext?.tenant.id !== id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const features = await storage.getTenantFeatures(id);
    res.json(features);
  } catch (error) {
    console.error("Error fetching tenant features:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des features" });
  }
});

router.post("/:id/features", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { featureKey, enabled, config } = req.body;

    if (!featureKey || typeof enabled !== "boolean") {
      return res.status(400).json({ message: "featureKey et enabled requis" });
    }

    const feature = await storage.setTenantFeature(id, featureKey, enabled, config);
    res.json(feature);
  } catch (error) {
    console.error("Error setting tenant feature:", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour de la feature" });
  }
});

// ===== TENANT USERS =====

router.get("/:id/users", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === "admin";
    const isTenantAdmin = req.tenantContext?.tenant.id === id && req.tenantContext?.userRole.role === "tenant_admin";

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const userRoles = await storage.getTenantUsers(id);
    res.json(userRoles);
  } catch (error) {
    console.error("Error fetching tenant users:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs" });
  }
});

router.post("/:id/users", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, role = "staff" } = req.body;
    const isSuperAdmin = req.user?.role === "admin";
    const isTenantAdmin = req.tenantContext?.tenant.id === id && req.tenantContext?.userRole.role === "tenant_admin";

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    if (!userId) {
      return res.status(400).json({ message: "userId requis" });
    }

    const existing = await storage.getTenantUserRole(id, userId);
    if (existing) {
      return res.status(409).json({ message: "L'utilisateur est déjà membre de ce tenant" });
    }

    const userRole = await storage.addUserToTenant({ tenantId: id, userId, role });
    res.status(201).json(userRole);
  } catch (error) {
    console.error("Error adding user to tenant:", error);
    res.status(500).json({ message: "Erreur lors de l'ajout de l'utilisateur" });
  }
});

router.patch("/:id/users/:userId", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    const isSuperAdmin = req.user?.role === "admin";
    const isTenantAdmin = req.tenantContext?.tenant.id === id && req.tenantContext?.userRole.role === "tenant_admin";

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    if (!["tenant_admin", "staff", "viewer"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide" });
    }

    const userRole = await storage.updateTenantUserRole(id, userId, role);
    if (!userRole) {
      return res.status(404).json({ message: "Utilisateur non trouvé dans ce tenant" });
    }

    res.json(userRole);
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour du rôle" });
  }
});

router.delete("/:id/users/:userId", requireAuth, resolveTenant, async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;
    const isSuperAdmin = req.user?.role === "admin";
    const isTenantAdmin = req.tenantContext?.tenant.id === id && req.tenantContext?.userRole.role === "tenant_admin";

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    await storage.removeUserFromTenant(id, userId);
    res.status(204).send();
  } catch (error) {
    console.error("Error removing user from tenant:", error);
    res.status(500).json({ message: "Erreur lors de la suppression de l'utilisateur" });
  }
});

// ===== USER TENANT CONTEXT =====

router.get("/me/tenants", requireAuth, async (req: Request, res: Response) => {
  try {
    const userRoles = await storage.getUserTenantRoles(req.user!.id);
    
    const tenantsWithRoles = await Promise.all(
      userRoles.map(async (role) => {
        const tenant = await storage.getTenant(role.tenantId);
        return { tenant, role: role.role, isDefault: role.isDefault };
      })
    );

    res.json(tenantsWithRoles.filter(t => t.tenant));
  } catch (error) {
    console.error("Error fetching user tenants:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des tenants" });
  }
});

router.post("/me/tenants/:id/switch", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const userRole = await storage.getTenantUserRole(id, req.user!.id);
    if (!userRole) {
      return res.status(403).json({ message: "Vous n'êtes pas membre de ce tenant" });
    }

    await storage.setDefaultTenant(req.user!.id, id);
    
    const tenant = await storage.getTenant(id);
    res.json({ tenant, role: userRole.role });
  } catch (error) {
    console.error("Error switching tenant:", error);
    res.status(500).json({ message: "Erreur lors du changement de tenant" });
  }
});

export default router;
