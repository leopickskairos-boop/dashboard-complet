// N8N Integration Routes - Multi-client logs and report data extraction
import { Router, Request, Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { storage, requireAuth } from "./middleware";
import { n8nLogSchema, n8nLogFiltersSchema } from "@shared/schema";

const router = Router();

// Helper function to authenticate by API key
async function authenticateByApiKey(apiKey: string): Promise<any> {
  try {
    const bcrypt = await import("bcryptjs");
    const usersWithKeys = await storage.getAllUsersWithApiKey();
    
    for (const user of usersWithKeys) {
      if (user.apiKeyHash) {
        const isMatch = await bcrypt.compare(apiKey, user.apiKeyHash);
        if (isMatch) {
          return user;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error authenticating by API key:", error);
    return null;
  }
}

// ===== N8N REPORT DATA EXTRACTION API =====
// This endpoint is used by N8N to extract all client data for PDF report generation
// Queries by agent_id (SpeedAI client identifier)
router.get(
  "/client-report-data/:agentId",
  async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers.authorization?.replace("Bearer ", "");
      const { agentId } = req.params;
      const { month, year } = req.query;
      
      // Validate API key
      if (!apiKey) {
        return res.status(401).json({ error: "API key required" });
      }
      
      // Get user by API key (must be admin for this endpoint)
      const authenticatedUser = await authenticateByApiKey(apiKey);
      if (!authenticatedUser) {
        return res.status(401).json({ error: "Invalid API key" });
      }
      
      // Only admins can access client report data
      const isAdmin = authenticatedUser.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      // Get the SpeedAI client by agent_id
      const speedaiClient = await storage.getSpeedaiClientByAgentId(agentId);
      if (!speedaiClient) {
        return res.status(404).json({ error: "SpeedAI client not found", agent_id: agentId });
      }
      
      // Determine the period (default: last month)
      const now = new Date();
      const reportMonth = month ? parseInt(month as string) : now.getMonth(); // 0-indexed, so current month - 1 for last month
      const reportYear = year ? parseInt(year as string) : now.getFullYear();
      
      // Get start and end dates for the period
      const startDate = new Date(reportYear, reportMonth - 1, 1);
      const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);
      
      // Get all calls for this agent_id in the period
      const periodCalls = await storage.getCallsByAgentId(agentId, {
        month: reportMonth,
        year: reportYear,
      });
      
      // Calculate comprehensive metrics
      const totalCalls = periodCalls.length;
      const answeredCalls = periodCalls.filter((c) => c.status === "completed").length;
      const missedCalls = periodCalls.filter((c) => c.status === "missed").length;
      
      // Duration metrics
      const callsWithDuration = periodCalls.filter((c) => c.duration && c.duration > 0);
      const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0);
      const avgDuration = callsWithDuration.length > 0 ? totalDuration / callsWithDuration.length : 0;
      
      // Conversion metrics
      const conversionCounts: Record<string, number> = {};
      periodCalls.forEach((call: any) => {
        const result = call.conversionResult || 'unknown';
        conversionCounts[result] = (conversionCounts[result] || 0) + 1;
      });
      
      // Client mood distribution
      const moodCounts: Record<string, number> = {};
      periodCalls.forEach((call: any) => {
        if (call.clientMood) {
          moodCounts[call.clientMood] = (moodCounts[call.clientMood] || 0) + 1;
        }
      });
      
      // Service types
      const serviceCounts: Record<string, number> = {};
      periodCalls.forEach((call: any) => {
        if (call.serviceType) {
          serviceCounts[call.serviceType] = (serviceCounts[call.serviceType] || 0) + 1;
        }
      });
      
      // Top keywords
      const keywordCounts: Record<string, number> = {};
      periodCalls.forEach((call: any) => {
        const keywords = call.keywords || [];
        keywords.forEach((kw: string) => {
          const normalized = kw.toLowerCase().trim();
          if (normalized.length > 2) {
            keywordCounts[normalized] = (keywordCounts[normalized] || 0) + 1;
          }
        });
      });
      const topKeywords = Object.entries(keywordCounts)
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
      
      // Appointments by day of week
      const appointmentsByDay: Record<string, number> = {};
      periodCalls.forEach((call: any) => {
        if (call.appointmentDayOfWeek) {
          appointmentsByDay[call.appointmentDayOfWeek] = (appointmentsByDay[call.appointmentDayOfWeek] || 0) + 1;
        }
      });
      
      // Hourly distribution
      const hourlyDistribution: Record<string, number> = {};
      periodCalls.forEach((call) => {
        const hour = new Date(call.startTime).getHours();
        const hourKey = `${hour}:00`;
        hourlyDistribution[hourKey] = (hourlyDistribution[hourKey] || 0) + 1;
      });
      
      // Quality metrics
      const callsWithConfidence = periodCalls.filter((c: any) => c.bookingConfidence !== null);
      const avgBookingConfidence = callsWithConfidence.length > 0
        ? callsWithConfidence.reduce((sum: number, c: any) => sum + (c.bookingConfidence || 0), 0) / callsWithConfidence.length
        : 0;
      
      const returningClients = periodCalls.filter((c: any) => c.isReturningClient === true).length;
      const lastMinuteBookings = periodCalls.filter((c: any) => c.isLastMinute === true).length;
      const upsellAccepted = periodCalls.filter((c: any) => c.upsellAccepted === true).length;
      
      // Build complete report data
      const reportData = {
        client: {
          agentId: speedaiClient.agentId,
          businessName: speedaiClient.businessName,
          businessType: speedaiClient.businessType,
          contactEmail: speedaiClient.contactEmail,
          plan: speedaiClient.plan,
          isActive: speedaiClient.isActive,
        },
        period: {
          month: reportMonth,
          year: reportYear,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary: {
          totalCalls,
          answeredCalls,
          missedCalls,
          answerRate: totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0,
          totalDurationMinutes: Math.round(totalDuration / 60),
          averageDurationSeconds: Math.round(avgDuration),
        },
        conversions: {
          breakdown: conversionCounts,
          total: Object.values(conversionCounts).reduce((a, b) => a + b, 0),
        },
        clientInsights: {
          moodDistribution: moodCounts,
          returningClients,
          returningClientRate: totalCalls > 0 ? (returningClients / totalCalls) * 100 : 0,
        },
        services: {
          distribution: serviceCounts,
        },
        bookings: {
          byDayOfWeek: appointmentsByDay,
          avgConfidence: Math.round(avgBookingConfidence),
          lastMinuteCount: lastMinuteBookings,
          upsellAccepted,
          upsellRate: totalCalls > 0 ? (upsellAccepted / totalCalls) * 100 : 0,
        },
        activity: {
          hourlyDistribution,
          topKeywords,
        },
        calls: periodCalls.map((call: any) => ({
          id: call.id,
          callId: call.callId,
          phoneNumber: call.phoneNumber,
          status: call.status,
          duration: call.duration,
          startTime: call.startTime,
          summary: call.summary,
          transcript: call.transcript,
          tags: call.tags,
          conversionResult: call.conversionResult,
          clientMood: call.clientMood,
          serviceType: call.serviceType,
          bookingConfidence: call.bookingConfidence,
        })),
        generatedAt: new Date().toISOString(),
      };
      
      console.log(`[N8N Report Data] Exported data for agent ${agentId} - Period: ${reportMonth}/${reportYear} - ${totalCalls} calls`);
      
      res.json(reportData);
    } catch (error) {
      console.error("Error generating N8N report data:", error);
      res.status(500).json({ error: "Failed to generate report data" });
    }
  },
);

// Get all SpeedAI clients (for N8N to know which clients to generate reports for)
router.get(
  "/clients",
  async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers.authorization?.replace("Bearer ", "");
      
      if (!apiKey) {
        return res.status(401).json({ error: "API key required" });
      }
      
      const authenticatedUser = await authenticateByApiKey(apiKey);
      if (!authenticatedUser) {
        return res.status(401).json({ error: "Invalid API key" });
      }
      
      // Only admins can list all clients
      if (authenticatedUser.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const clients = await storage.getAllSpeedaiClients();
      
      res.json({
        total: clients.length,
        clients: clients.map(c => ({
          agentId: c.agentId,
          businessName: c.businessName,
          businessType: c.businessType,
          contactEmail: c.contactEmail,
          plan: c.plan,
          isActive: c.isActive,
          firstCallAt: c.firstCallAt,
          lastCallAt: c.lastCallAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching SpeedAI clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  },
);

// ===== N8N LOGS ROUTER - MULTI-CLIENT INFRASTRUCTURE =====

/**
 * Route dynamique pour recevoir les logs de chaque client via N8N
 *
 * Bénéfices :
 * - Multi-clients : Chaque client a son propre "canal" de réception
 * - Traçabilité : Chaque appel est horodaté et stocké
 * - Scalabilité : Infrastructure prête pour CRM, API tierces
 * - Automatisation : N8N envoie automatiquement vers le bon espace
 * - Sécurité future : Token unique par client (TODO: implémenter auth)
 *
 * Exemple d'appel N8N :
 * POST https://vocaledash.com/api/logs/router/speedai_001
 * Body JSON = { timestamp, event, data, ... }
 */
router.post("/logs/router/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const data = req.body;

    // Validation basique
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID manquant dans l'URL.",
      });
    }

    console.log(
      `🧾 Log N8N reçu pour le client ${clientId}:`,
      JSON.stringify(data).substring(0, 200) + "...",
    );

    // Création de l'arborescence : /reports/logs/{clientId}/
    const baseDir = path.join(process.cwd(), "reports", "logs");
    const clientDir = path.join(baseDir, clientId);

    // Crée les dossiers s'ils n'existent pas
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
      console.log(`[N8N Logs] Dossier base créé: ${baseDir}`);
    }
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
      console.log(`[N8N Logs] Dossier client créé: ${clientDir}`);
    }

    // Sauvegarde du log sous forme de fichier JSON horodaté
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(clientDir, `log-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    console.log(`✅ Log N8N enregistré: ${filePath}`);

    res.status(200).json({
      success: true,
      message: `Log enregistré avec succès pour le client ${clientId}`,
      file: filePath,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ Erreur réception logs N8N:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Route pour lire les logs N8N d'un client
 *
 * GET /api/logs/client/:id
 * Query params: startDate, endDate, event, limit, offset
 *
 * Sécurité :
 * - Authentifié (requireAuth)
 * - Utilisateur peut seulement lire ses propres logs (req.user.id === :id)
 * - Admin peut lire les logs de n'importe quel client
 *
 * Réponse : { logs: N8NLogWithMetadata[], total: number, hasMore: boolean }
 */
router.get("/logs/client/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    // Validation de sécurité : utilisateur peut uniquement lire ses propres logs
    // sauf s'il est admin
    if (currentUser.id !== id && currentUser.role !== "admin") {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à accéder à ces logs",
      });
    }

    // Validation des filtres avec Zod
    const filtersResult = n8nLogFiltersSchema.safeParse({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      event: req.query.event as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    });

    if (!filtersResult.success) {
      return res.status(400).json({
        message: "Paramètres de filtrage invalides",
        errors: filtersResult.error.flatten(),
      });
    }

    const filters = filtersResult.data;

    // Chemin du dossier des logs du client
    const clientDir = path.join(process.cwd(), "reports", "logs", id);

    // Vérifier si le dossier existe
    if (!fs.existsSync(clientDir)) {
      return res.json({
        logs: [],
        total: 0,
        hasMore: false,
      });
    }

    // Lire tous les fichiers du dossier
    const files = await fs.promises.readdir(clientDir);

    // Filtrer uniquement les fichiers JSON avec pattern log-*.json
    const logFiles = files
      .filter((file) => file.startsWith("log-") && file.endsWith(".json"))
      .sort()
      .reverse(); // Tri inversé pour avoir les plus récents en premier

    // Parser les logs avec gestion d'erreurs
    const parsedLogs: Array<{
      log: z.infer<typeof n8nLogSchema>;
      fileName: string;
      fileTimestamp: string;
    }> = [];

    for (const fileName of logFiles) {
      try {
        const filePath = path.join(clientDir, fileName);
        const fileContent = await fs.promises.readFile(filePath, "utf-8");
        const rawLog = JSON.parse(fileContent);

        // Valider avec Zod
        const validationResult = n8nLogSchema.safeParse(rawLog);

        if (validationResult.success) {
          // Extraire le timestamp du nom de fichier (log-2025-11-11T22-36-32-613Z.json)
          const fileTimestamp = fileName
            .replace("log-", "")
            .replace(".json", "")
            .replace(/-/g, ":");

          parsedLogs.push({
            log: validationResult.data,
            fileName,
            fileTimestamp: fileTimestamp.replace(/:/g, "-"),
          });
        } else {
          console.warn(
            `⚠️ Log invalide ignoré: ${fileName}`,
            validationResult.error,
          );
        }
      } catch (error) {
        console.error(`❌ Erreur lecture log ${fileName}:`, error);
        // Continue avec les autres fichiers
      }
    }

    // Appliquer les filtres
    let filteredLogs = parsedLogs;

    // Filtre par date de début
    if (filters.startDate) {
      filteredLogs = filteredLogs.filter(
        ({ log }) => new Date(log.timestamp) >= new Date(filters.startDate!),
      );
    }

    // Filtre par date de fin
    if (filters.endDate) {
      filteredLogs = filteredLogs.filter(
        ({ log }) => new Date(log.timestamp) <= new Date(filters.endDate!),
      );
    }

    // Filtre par type d'événement
    if (filters.event) {
      filteredLogs = filteredLogs.filter(
        ({ log }) => log.event === filters.event,
      );
    }

    const total = filteredLogs.length;

    // Pagination
    const paginatedLogs = filteredLogs.slice(
      filters.offset,
      filters.offset + filters.limit,
    );

    // Transformer en format de réponse
    const logsWithMetadata = paginatedLogs.map(
      ({ log, fileName, fileTimestamp }) => ({
        ...log,
        fileName,
        fileTimestamp,
      }),
    );

    res.json({
      logs: logsWithMetadata,
      total,
      hasMore: filters.offset + filters.limit < total,
    });
  } catch (error: any) {
    console.error("❌ Erreur lecture logs N8N:", error);
    res.status(500).json({
      message: "Erreur lors de la lecture des logs",
      error: error.message,
    });
  }
});

// Export the router and helper for use in other modules
export { authenticateByApiKey };
export default router;
