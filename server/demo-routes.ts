/**
 * Routes de démonstration - Données fictives pour présentation
 * Ces routes renvoient des données réalistes pour une démo client
 */

import { Express } from "express";
import {
  demoCalls,
  demoStats,
  demoChartData,
  demoAIInsights,
  demoReviews,
  demoReviewStats,
  demoMarketingStats,
  demoMarketingChartData,
  demoMarketingContacts,
  demoMarketingCampaigns,
  demoGuaranteeSessions,
  demoNoShows,
  demoGuaranteeStats,
  demoIntegrations,
  demoReports,
  demoWaitlistEntries,
  demoRecommendations,
  DEMO_MODE,
} from "./demo-data";

export function registerDemoRoutes(app: Express) {
  if (!DEMO_MODE) {
    console.log("[Demo] Demo mode disabled");
    return;
  }

  console.log("[Demo] Demo mode enabled - registering demo routes");

  // ========== DASHBOARD / CALLS ==========
  
  app.get("/api/demo/calls/stats", (req, res) => {
    const timeFilter = req.query.timeFilter as string;
    
    let multiplier = 1;
    if (timeFilter === "hour") multiplier = 0.1;
    else if (timeFilter === "today") multiplier = 0.3;
    else if (timeFilter === "two_days") multiplier = 0.5;
    else if (timeFilter === "week") multiplier = 1;

    res.json({
      totalCalls: Math.round(demoStats.totalCalls * multiplier),
      callsVariation: demoStats.callsVariation,
      conversionRate: demoStats.conversionRate,
      conversionVariation: demoStats.conversionVariation,
      avgDuration: demoStats.avgDuration,
      durationVariation: demoStats.durationVariation,
      remindersSent: demoStats.reminders,
      reminderVariation: demoStats.remindersVariation,
      convertedClients: Math.round(demoStats.convertedClients * multiplier),
      convertedClientsVariation: demoStats.convertedClientsVariation,
      appointmentsTaken: Math.round(demoStats.appointmentsTaken * multiplier),
      appointmentsVariation: demoStats.appointmentsVariation,
    });
  });

  app.get("/api/demo/calls", (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const paginatedCalls = demoCalls.slice(offset, offset + limit);
    
    res.json({
      calls: paginatedCalls,
      total: demoCalls.length,
      page,
      limit,
      totalPages: Math.ceil(demoCalls.length / limit),
    });
  });

  app.get("/api/demo/calls/chart-data", (req, res) => {
    res.json(demoChartData);
  });

  app.get("/api/demo/calls/ai-insights", (req, res) => {
    res.json({
      insights: demoAIInsights,
      generated: true,
    });
  });

  app.get("/api/demo/calls/:id", (req, res) => {
    const call = demoCalls.find(c => c.id === req.params.id);
    if (!call) {
      return res.status(404).json({ message: "Appel non trouvé" });
    }
    res.json(call);
  });

  // ========== REVIEWS ==========
  
  app.get("/api/demo/reviews", (req, res) => {
    let filtered = [...demoReviews];
    
    const platform = req.query.platform as string;
    const ratingMin = req.query.ratingMin as string;
    const search = req.query.search as string;
    
    if (platform && platform !== "all") {
      filtered = filtered.filter(r => r.platform === platform);
    }
    if (ratingMin) {
      filtered = filtered.filter(r => r.rating >= parseInt(ratingMin));
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.content?.toLowerCase().includes(s) || 
        r.reviewerName?.toLowerCase().includes(s)
      );
    }
    
    res.json(filtered);
  });

  app.get("/api/demo/reviews/stats", (req, res) => {
    res.json(demoReviewStats);
  });

  app.get("/api/demo/reviews/requests", (req, res) => {
    res.json({
      requests: [
        { id: "rr-001", customerName: "Jean Dupont", customerEmail: "jean@example.com", customerPhone: "+33612345678", status: "sent", sentAt: "2024-12-20T10:30:00Z", platform: "google" },
        { id: "rr-002", customerName: "Marie Martin", customerEmail: "marie@example.com", customerPhone: "+33698765432", status: "completed", sentAt: "2024-12-19T14:20:00Z", completedAt: "2024-12-19T16:45:00Z", platform: "tripadvisor" },
        { id: "rr-003", customerName: "Pierre Lefebvre", customerEmail: "pierre@example.com", customerPhone: "+33678901234", status: "pending", scheduledFor: "2024-12-22T09:00:00Z", platform: "google" },
        { id: "rr-004", customerName: "Sophie Bernard", customerEmail: "sophie@example.com", customerPhone: "+33645678901", status: "sent", sentAt: "2024-12-21T11:00:00Z", platform: "facebook" },
        { id: "rr-005", customerName: "Luc Moreau", customerEmail: "luc@example.com", customerPhone: "+33623456789", status: "clicked", sentAt: "2024-12-18T16:30:00Z", clickedAt: "2024-12-18T17:00:00Z", platform: "google" },
      ],
      total: 5,
    });
  });

  app.get("/api/demo/reviews/requests/stats", (req, res) => {
    res.json({
      totalRequests: 45,
      sentThisPeriod: 12,
      reviewsCollected: 28,
      conversionRate: 62.2,
      promosGenerated: 18,
      promosUsed: 12,
      revenueGenerated: 1840,
    });
  });

  app.get("/api/demo/reviews/incentives", (req, res) => {
    res.json([
      { id: "inc-001", name: "10% de réduction", type: "percentage", value: 10, minPurchase: 30, isDefault: true, usageCount: 45, createdAt: "2024-10-01T00:00:00Z" },
      { id: "inc-002", name: "5€ offerts", type: "fixed_amount", value: 5, minPurchase: 25, isDefault: false, usageCount: 23, createdAt: "2024-11-01T00:00:00Z" },
      { id: "inc-003", name: "Dessert offert", type: "free_item", description: "Un dessert au choix offert", isDefault: false, usageCount: 18, createdAt: "2024-11-15T00:00:00Z" },
    ]);
  });

  app.get("/api/demo/reviews/:id", (req, res) => {
    const review = demoReviews.find(r => r.id === req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Avis non trouvé" });
    }
    res.json(review);
  });

  // ========== MARKETING ==========
  
  app.get("/api/demo/marketing/analytics/overview", (req, res) => {
    res.json(demoMarketingStats);
  });

  app.get("/api/demo/marketing/analytics/performance", (req, res) => {
    res.json(demoMarketingChartData);
  });

  app.get("/api/demo/marketing/contacts", (req, res) => {
    res.json({
      contacts: demoMarketingContacts,
      total: demoMarketingContacts.length,
    });
  });

  app.get("/api/demo/marketing/contacts/stats", (req, res) => {
    res.json({
      total: 1847,
      optInEmail: 1623,
      optInSms: 1245,
      newThisMonth: 124,
      sources: {
        reservation: 945,
        website: 523,
        review: 245,
        import: 134,
      },
    });
  });

  app.get("/api/demo/marketing/campaigns", (req, res) => {
    res.json({
      campaigns: demoMarketingCampaigns,
      total: demoMarketingCampaigns.length,
    });
  });

  app.get("/api/demo/marketing/automations", (req, res) => {
    res.json({
      automations: [
        { id: "auto-001", name: "Bienvenue nouveau contact", trigger: "new_contact", action: "send_email", status: "active", executionCount: 124 },
        { id: "auto-002", name: "Anniversaire client", trigger: "birthday", action: "send_both", status: "active", executionCount: 45 },
        { id: "auto-003", name: "Relance inactifs 60j", trigger: "inactive", action: "send_email", status: "active", executionCount: 87 },
      ],
      total: 3,
    });
  });

  app.get("/api/demo/marketing/segments", (req, res) => {
    res.json({
      segments: [
        { id: "seg-001", name: "Clients VIP", contactCount: 156, autoUpdate: true },
        { id: "seg-002", name: "Nouveaux clients", contactCount: 234, autoUpdate: true },
        { id: "seg-003", name: "Inactifs +90j", contactCount: 324, autoUpdate: true },
        { id: "seg-004", name: "Fêtes & anniversaires", contactCount: 89, autoUpdate: false },
      ],
      total: 4,
    });
  });

  app.get("/api/demo/marketing/templates", (req, res) => {
    res.json({
      templates: [
        { id: "tpl-001", name: "Newsletter mensuelle", type: "email", usageCount: 8 },
        { id: "tpl-002", name: "Promo Flash", type: "email", usageCount: 5 },
        { id: "tpl-003", name: "Rappel réservation", type: "sms", usageCount: 156 },
        { id: "tpl-004", name: "Anniversaire", type: "email", usageCount: 45 },
      ],
      total: 4,
    });
  });

  // ========== GUARANTEE / PROTECTION ==========
  
  app.get("/api/demo/guarantee/reservations", (req, res) => {
    const period = req.query.period as string || "week";
    
    const pending = demoGuaranteeSessions.filter(s => s.status === "pending");
    const validated = demoGuaranteeSessions.filter(s => s.status === "validated");
    
    res.json({
      pending,
      validated,
      today: demoGuaranteeSessions.filter(s => {
        const resDate = new Date(s.reservationDate);
        const today = new Date();
        return resDate.toDateString() === today.toDateString();
      }),
      stats: demoGuaranteeStats,
    });
  });

  app.get("/api/demo/guarantee/stats", (req, res) => {
    res.json(demoGuaranteeStats);
  });

  app.get("/api/demo/guarantee/history", (req, res) => {
    res.json({
      noShows: demoNoShows,
      total: demoNoShows.length,
      totalRecovered: 170,
      totalFailed: 175,
    });
  });

  app.get("/api/demo/guarantee/config", (req, res) => {
    res.json({
      config: {
        enabled: true,
        penaltyAmount: 25,
        cancellationDelay: 24,
        applyTo: 'min_persons',
        minPersons: 4,
        logoUrl: null,
        brandColor: "#C8B88A",
        senderEmail: "demo@lepetitbistrot.fr",
        gmailSenderEmail: "contact@lepetitbistrot.fr",
        gmailSenderName: "Le Petit Bistrot",
        gmailAppPassword: "****",
        termsUrl: null,
        companyName: "Le Petit Bistrot",
        companyAddress: "15 Rue de la Gastronomie, 75001 Paris",
        companyPhone: "+33 1 42 36 58 74",
        stripeAccountId: "acct_demo_xxxxx",
        smsEnabled: true,
        autoSendEmailOnCreate: true,
        autoSendSmsOnCreate: true,
        autoSendEmailOnValidation: true,
        autoSendSmsOnValidation: true,
      },
      stripeConnected: true,
      user: {
        email: "demo@lepetitbistrot.fr",
      },
    });
  });

  app.get("/api/demo/guarantee/stripe-status", (req, res) => {
    res.json({
      connected: true,
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    });
  });

  // ========== INTEGRATIONS ==========
  
  app.get("/api/demo/integrations", (req, res) => {
    res.json({
      integrations: demoIntegrations,
      total: demoIntegrations.length,
    });
  });

  app.get("/api/demo/integrations/customers", (req, res) => {
    res.json({
      customers: [
        { id: "cust-001", name: "Marie Dupont", email: "marie.dupont@email.com", source: "hubspot", totalOrders: 12, lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "cust-002", name: "Pierre Martin", email: "p.martin@business.fr", source: "stripe", totalOrders: 5, lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "cust-003", name: "Sophie Bernard", email: "sophie.b@gmail.com", source: "hubspot", totalOrders: 8, lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      ],
      total: 523,
    });
  });

  // ========== REPORTS ==========
  
  app.get("/api/demo/reports", (req, res) => {
    res.json({
      reports: demoReports,
      total: demoReports.length,
    });
  });

  // ========== WAITLIST ==========
  
  app.get("/api/demo/waitlist", (req, res) => {
    res.json({
      entries: demoWaitlistEntries,
      total: demoWaitlistEntries.length,
      stats: {
        waiting: 2,
        notified: 1,
        confirmed: 0,
        expired: 0,
      },
    });
  });

  // ========== RECOMMENDATIONS ==========
  
  app.get("/api/demo/recommendations", (req, res) => {
    res.json({
      recommendations: demoRecommendations,
      total: demoRecommendations.length,
    });
  });

  // ========== USER / ACCOUNT ==========
  
  const demoUser = {
    id: "demo-user-001",
    email: "demo@lepetitbistrot.fr",
    role: "user",
    companyName: "Le Petit Bistrot",
    phone: "+33 1 42 36 58 74",
    accountStatus: "active",
    subscriptionStatus: "active",
    plan: "premium",
    trialEndsAt: null,
    isVerified: true,
    onboardingCompleted: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
  
  app.get("/api/demo/auth/me", (req, res) => {
    res.json(demoUser);
  });
  
  app.get("/api/demo/user", (req, res) => {
    res.json(demoUser);
  });
  
  app.get("/api/demo/user/profile", (req, res) => {
    res.json(demoUser);
  });
  
  app.get("/api/demo/settings", (req, res) => {
    res.json({
      notifications: {
        email: true,
        sms: true,
        push: true,
      },
      language: "fr",
      timezone: "Europe/Paris",
    });
  });

  // ========== NOTIFICATIONS ==========
  
  app.get("/api/demo/notifications", (req, res) => {
    res.json({
      notifications: [
        { id: "notif-001", type: "review", title: "Nouvel avis 5 étoiles", message: "Marie L. a laissé un avis excellent sur Google", isRead: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { id: "notif-002", type: "reservation", title: "Nouvelle réservation", message: "Pierre Martin - 6 personnes ce soir 19h30", isRead: false, createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
        { id: "notif-003", type: "marketing", title: "Campagne envoyée", message: "Newsletter de Noël envoyée à 1245 contacts", isRead: true, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
        { id: "notif-004", type: "guarantee", title: "Carte validée", message: "Sophie Blanc a validé sa garantie CB", isRead: true, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      ],
      unreadCount: 2,
    });
  });

  console.log("[Demo] All demo routes registered successfully");
}
