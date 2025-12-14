// Admin Routes - User management, logs, and client data
import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { storage, requireAuth, toPublicUser, requireAdmin } from "./middleware";

const router = Router();

// Get all users with stats (with optional email search)
router.get("/users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const searchQuery =
      typeof search === "string" ? search.toLowerCase().trim() : "";

    const users = await storage.getAllUsers();

    // Filter by email if search query provided
    const filteredUsers = searchQuery
      ? users.filter((user) => user.email.toLowerCase().includes(searchQuery))
      : users;

    // Get stats for each user
    const usersWithStats = await Promise.all(
      filteredUsers.map(async (user) => {
        const stats = await storage.getUserStats(user.id);
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus || "none",
          accountStatus: (user as any).accountStatus || "active",
          plan: (user as any).plan || null,
          countdownEnd: (user as any).countdownEnd || null,
          createdAt: user.createdAt,
          ...stats,
        };
      }),
    );

    res.json(usersWithStats);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des utilisateurs" });
  }
});

// Suspend user account
router.post(
  "/users/:id/suspend",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await storage.suspendUser(id);

      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      res.json({ message: "Compte suspendu", user: toPublicUser(user) });
    } catch (error: any) {
      console.error("Error suspending user:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de la suspension du compte" });
    }
  },
);

// Activate user account
router.post(
  "/users/:id/activate",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await storage.activateUser(id);

      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      res.json({ message: "Compte activé", user: toPublicUser(user) });
    } catch (error: any) {
      console.error("Error activating user:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de l'activation du compte" });
    }
  },
);

// Assign plan to user (admin only)
router.post(
  "/users/:id/assign-plan",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { plan } = req.body;

      // Validate plan value
      const validPlans = [null, "basic", "standard", "premium"];
      if (!validPlans.includes(plan)) {
        return res.status(400).json({ message: "Plan invalide" });
      }

      const user = await storage.assignPlan(id, plan);

      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      res.json({
        message: "Plan assigné avec succès",
        user: toPublicUser(user),
      });
    } catch (error: any) {
      console.error("Error assigning plan:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de l'assignation du plan" });
    }
  },
);

// Delete user account (admin only)
router.delete(
  "/users/:id",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const currentUser = (req as any).user;

      // Prevent admin from deleting themselves
      if (id === currentUser.id) {
        return res.status(400).json({
          message: "Vous ne pouvez pas supprimer votre propre compte",
        });
      }

      await storage.deleteUser(id);
      res.json({ message: "Compte supprimé avec succès" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de la suppression du compte" });
    }
  },
);

// Get N8N logs for all clients (admin only)
router.get("/logs", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, event, startDate, limit = "100" } = req.query;

    const baseDir = path.join(process.cwd(), "reports", "logs");

    // Check if logs directory exists
    if (!fs.existsSync(baseDir)) {
      return res.json({ logs: [], total: 0, hasMore: false });
    }

    const allLogs: any[] = [];

    // If userId filter is provided, only read that user's logs
    if (userId && typeof userId === "string") {
      const userDir = path.join(baseDir, userId);

      if (fs.existsSync(userDir)) {
        const files = fs.readdirSync(userDir);

        for (const file of files) {
          if (file.endsWith(".json")) {
            try {
              const filePath = path.join(userDir, file);
              const content = fs.readFileSync(filePath, "utf-8");
              const logData = JSON.parse(content);

              // Apply event filter
              if (
                event &&
                typeof event === "string" &&
                logData.event !== event
              ) {
                continue;
              }

              // Apply date filter
              if (startDate && typeof startDate === "string") {
                const logDate = new Date(logData.timestamp);
                const filterDate = new Date(startDate);
                if (logDate < filterDate) {
                  continue;
                }
              }

              allLogs.push({
                ...logData,
                fileName: file,
                userId: userId,
              });
            } catch (err) {
              console.error(`Error reading log file ${file}:`, err);
            }
          }
        }
      }
    } else {
      // Read logs from all clients
      const clientDirs = fs.readdirSync(baseDir);

      for (const clientId of clientDirs) {
        const clientPath = path.join(baseDir, clientId);

        if (fs.statSync(clientPath).isDirectory()) {
          const files = fs.readdirSync(clientPath);

          for (const file of files) {
            if (file.endsWith(".json")) {
              try {
                const filePath = path.join(clientPath, file);
                const content = fs.readFileSync(filePath, "utf-8");
                const logData = JSON.parse(content);

                // Apply event filter
                if (
                  event &&
                  typeof event === "string" &&
                  logData.event !== event
                ) {
                  continue;
                }

                // Apply date filter
                if (startDate && typeof startDate === "string") {
                  const logDate = new Date(logData.timestamp);
                  const filterDate = new Date(startDate);
                  if (logDate < filterDate) {
                    continue;
                  }
                }

                allLogs.push({
                  ...logData,
                  fileName: file,
                  userId: clientId,
                });
              } catch (err) {
                console.error(`Error reading log file ${file}:`, err);
              }
            }
          }
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    allLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Apply pagination
    const limitNum = parseInt(limit as string) || 100;
    const paginatedLogs = allLogs.slice(0, limitNum);

    res.json({
      logs: paginatedLogs,
      total: allLogs.length,
      hasMore: allLogs.length > limitNum,
    });
  } catch (error: any) {
    console.error("Error fetching N8N logs:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des logs" });
  }
});

// Get all clients data (admin only) - Comprehensive overview for N8N integration
router.get(
  "/clients-data",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const { client_id } = req.query;

      // Security logging
      console.log(
        `[ADMIN ACCESS] Client Data viewed by: ${currentUser.email} at ${new Date().toISOString()}`,
      );

      // Get all users from database
      let users = await storage.getAllUsers();

      // Filter by client_id if provided
      if (client_id && typeof client_id === "string") {
        users = users.filter((u) => u.id === client_id);
      }

      // Sort by createdAt descending (most recent first)
      users.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Build comprehensive client data
      const baseLogsDir = path.join(process.cwd(), "reports", "logs");
      const frontendUrl =
        process.env.FRONTEND_URL ||
        process.env.REPLIT_DEV_DOMAIN ||
        "http://localhost:5000";

      const clientsData = users.map((user) => {
        let latestLog = null;
        let latestLogDate = null;

        // Safely check if user has log directory and read latest log
        try {
          const clientLogDir = path.join(baseLogsDir, user.id);

          if (fs.existsSync(clientLogDir)) {
            const files = fs.readdirSync(clientLogDir);
            const logFiles = files.filter((f) => f.endsWith(".json"));

            if (logFiles.length > 0) {
              // Find the most recent log file by modification time
              let mostRecentFile = null;
              let mostRecentTime = 0;

              for (const file of logFiles) {
                try {
                  const filePath = path.join(clientLogDir, file);
                  const stats = fs.statSync(filePath);
                  if (stats.mtimeMs > mostRecentTime) {
                    mostRecentTime = stats.mtimeMs;
                    mostRecentFile = file;
                  }
                } catch (fileErr) {
                  // Skip unreadable files, continue with others
                  console.error(
                    `Error reading log file ${file} for client ${user.id}:`,
                    fileErr,
                  );
                }
              }

              if (mostRecentFile) {
                latestLog = mostRecentFile;
                latestLogDate = new Date(mostRecentTime).toISOString();
              }
            }
          }
        } catch (err) {
          // Log error but continue processing other clients
          console.error(`Error processing logs for client ${user.id}:`, err);
        }

        return {
          client_id: user.id,
          email: user.email,
          router_url: `${frontendUrl}/api/logs/router/${user.id}`,
          api_key_hash: user.apiKeyHash || null,
          latest_log: latestLog,
          latest_log_date: latestLogDate,
          accountStatus: user.accountStatus,
          subscriptionStatus: user.subscriptionStatus || null,
          createdAt: user.createdAt,
        };
      });

      res.json(clientsData);
    } catch (error: any) {
      console.error("Error fetching clients data:", error);
      res.status(500).json({
        message: "Erreur lors de la récupération des données clients",
      });
    }
  },
);

export default router;
