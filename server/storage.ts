// Reference: javascript_database blueprint - DatabaseStorage implementation
import { encryptCredentials, decryptCredentials } from "./utils/credential-encryption";
import { 
  users, 
  calls, 
  notifications,
  notificationPreferences,
  monthlyReports,
  speedaiClients,
  pushSubscriptions,
  clientGuaranteeConfig,
  guaranteeSessions,
  noshowCharges,
  reviewConfig,
  reviewIncentives,
  reviewRequests,
  reviews,
  reviewAlerts,
  reviewSources,
  reviewSyncLogs,
  reviewAutomations,
  marketingContacts,
  marketingConsentHistory,
  marketingSegments,
  marketingTemplates,
  marketingCampaigns,
  marketingSends,
  marketingAutomations,
  marketingAutomationLogs,
  marketingClickEvents,
  externalConnections,
  externalSyncJobs,
  externalFieldMappings,
  externalCustomers,
  externalOrders,
  externalTransactions,
  externalProducts,
  externalActivities,
  integrationWebhooks,
  integrationProviderConfigs,
  userOAuthConfig,
  type User, 
  type InsertUser, 
  type Call, 
  type InsertCall,
  type Notification,
  type InsertNotification,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type MonthlyReport,
  type InsertMonthlyReport,
  type SpeedaiClient,
  type InsertSpeedaiClient,
  type PushSubscription,
  type InsertPushSubscription,
  type ClientGuaranteeConfig,
  type InsertClientGuaranteeConfig,
  type GuaranteeSession,
  type InsertGuaranteeSession,
  type NoshowCharge,
  type InsertNoshowCharge,
  type ReviewConfig,
  type InsertReviewConfig,
  type ReviewIncentive,
  type InsertReviewIncentive,
  type ReviewRequest,
  type InsertReviewRequest,
  type Review,
  type InsertReview,
  type ReviewAlert,
  type InsertReviewAlert,
  type ReviewSource,
  type InsertReviewSource,
  type ReviewSyncLog,
  type InsertReviewSyncLog,
  type ReviewAutomation,
  type InsertReviewAutomation,
  type MarketingContact,
  type InsertMarketingContact,
  type MarketingConsentHistory,
  type MarketingSegment,
  type InsertMarketingSegment,
  type MarketingTemplate,
  type InsertMarketingTemplate,
  type MarketingCampaign,
  type InsertMarketingCampaign,
  type MarketingSend,
  type MarketingAutomation,
  type InsertMarketingAutomation,
  type MarketingAutomationLog,
  type MarketingClickEvent,
  type SegmentFilters,
  type ExternalConnection,
  type InsertExternalConnection,
  type ExternalSyncJob,
  type ExternalFieldMapping,
  type ExternalCustomer,
  type ExternalOrder,
  type ExternalTransaction,
  type InsertExternalTransaction,
  type ExternalProduct,
  type ExternalActivity,
  type IntegrationWebhook,
  type IntegrationProviderConfig,
  type UserOAuthConfig,
  type InsertUserOAuthConfig
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, count, isNotNull, or, asc, like, ilike, isNull, inArray, ne, lt, gt } from "drizzle-orm";
import { generateApiKey } from "./api-key";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  getUserByStripeSubscriptionId(subscriptionId: string): Promise<User | undefined>;
  getUserByAgentId(agentId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserEmail(userId: string, email: string): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  assignPlan(userId: string, plan: string | null): Promise<User | undefined>;
  
  // Email verification
  setVerificationToken(userId: string, token: string, expiry: Date): Promise<void>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  verifyEmail(userId: string): Promise<void>;
  
  // Password reset
  setResetPasswordToken(userId: string, token: string, expiry: Date): Promise<void>;
  getUserByResetPasswordToken(token: string): Promise<User | undefined>;
  resetPassword(userId: string, hashedPassword: string): Promise<void>;
  
  // Stripe integration
  updateStripeInfo(userId: string, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionCurrentPeriodEnd?: Date;
  }): Promise<User | undefined>;
  
  // API Key management
  getAllUsersWithApiKey(): Promise<User[]>;
  regenerateApiKey(userId: string): Promise<{ apiKey: string; apiKeyHash: string }>;
  
  // Admin functions
  getAllUsers(): Promise<User[]>;
  suspendUser(userId: string): Promise<User | undefined>;
  activateUser(userId: string): Promise<User | undefined>;
  getUserStats(userId: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    lastActivity: Date | null;
    healthStatus: 'green' | 'orange' | 'red';
  }>;
  
  // Calls management
  getCalls(userId: string, filters?: {
    timeFilter?: 'hour' | 'today' | 'two_days' | 'week';
    statusFilter?: string;
    appointmentsOnly?: boolean;
    hidePastAppointments?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ calls: Call[]; total: number; page: number; totalPages: number }>;
  getCallById(id: string, userId: string): Promise<Call | undefined>;
  createCall(call: InsertCall): Promise<Call>;
  getStats(userId: string, timeFilter?: 'hour' | 'today' | 'two_days' | 'week'): Promise<{
    totalCalls: number;
    activeCalls: number;
    conversionRate: number;
    averageDuration: number;
  }>;
  getChartData(userId: string, timeFilter?: 'hour' | 'today' | 'two_days' | 'week'): Promise<{
    date: string;
    totalCalls: number;
    completedCalls: number;
    averageDuration: number;
  }[]>;

  // Notifications management
  getNotifications(userId: string, filters?: {
    timeFilter?: 'day' | 'two_days' | 'three_days' | 'week' | 'month';
    typeFilter?: 'daily_summary' | 'failed_calls' | 'active_call' | 'password_changed' | 'payment_updated' | 'subscription_renewed' | 'subscription_created' | 'subscription_expired' | 'subscription_expiring_soon';
    isRead?: boolean;
  }): Promise<Notification[]>;
  getNotificationById(id: string, userId: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string, userId: string): Promise<void>;
  getUnreadNotificationsCount(userId: string): Promise<number>;
  
  // Notification preferences
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  upsertNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;
  
  // Monthly reports
  getMonthlyReports(userId: string): Promise<MonthlyReport[]>;
  getMonthlyReportById(id: string, userId: string): Promise<MonthlyReport | undefined>;
  getMonthlyReportByPeriod(userId: string, periodStart: Date, periodEnd: Date): Promise<MonthlyReport | undefined>;
  createMonthlyReport(report: InsertMonthlyReport): Promise<MonthlyReport>;
  getUsersForMonthlyReportGeneration(): Promise<User[]>;
  getUsersWithExpiringTrials(): Promise<User[]>;
  
  // SpeedAI Clients management (by agent_id)
  getSpeedaiClientByAgentId(agentId: string): Promise<SpeedaiClient | undefined>;
  getAllSpeedaiClients(): Promise<SpeedaiClient[]>;
  createOrUpdateSpeedaiClient(agentId: string, data?: Partial<InsertSpeedaiClient>): Promise<SpeedaiClient>;
  getCallsByAgentId(agentId: string, filters?: {
    month?: number;
    year?: number;
  }): Promise<Call[]>;
  
  // Push subscriptions management
  getPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(endpoint: string): Promise<void>;
  deletePushSubscriptionsByUserId(userId: string): Promise<void>;
  getAllActivePushSubscriptions(): Promise<PushSubscription[]>;
  
  // CB Guarantee management
  getGuaranteeConfig(userId: string): Promise<ClientGuaranteeConfig | undefined>;
  upsertGuaranteeConfig(userId: string, config: Partial<InsertClientGuaranteeConfig>): Promise<ClientGuaranteeConfig>;
  
  // Guarantee sessions
  getGuaranteeSessions(userId: string, filters?: {
    status?: string;
    period?: 'today' | 'week' | 'month';
  }): Promise<GuaranteeSession[]>;
  getGuaranteeSessionById(id: string): Promise<GuaranteeSession | undefined>;
  getGuaranteeSessionByReservationId(reservationId: string): Promise<GuaranteeSession | undefined>;
  getGuaranteeSessionByCheckoutSessionId(checkoutSessionId: string): Promise<GuaranteeSession | undefined>;
  getGuaranteeSessionByShortCode(shortCode: string): Promise<GuaranteeSession | undefined>;
  createGuaranteeSession(session: InsertGuaranteeSession): Promise<GuaranteeSession>;
  updateGuaranteeSession(id: string, updates: Partial<GuaranteeSession>): Promise<GuaranteeSession | undefined>;
  
  // No-show charges
  getNoshowCharges(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<NoshowCharge[]>;
  createNoshowCharge(charge: InsertNoshowCharge): Promise<NoshowCharge>;
  getGuaranteeStats(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    noshowCount: number;
    totalRecovered: number;
    failedCharges: number;
    totalAvoided: number;
  }>;
  
  // Appointment reminders
  getSessionsForAppointmentReminder(): Promise<Array<GuaranteeSession & { config: ClientGuaranteeConfig }>>;
  markAppointmentReminderSent(sessionId: string): Promise<void>;
  
  // Appointment reminders for calls and external orders
  getCallsForAppointmentReminder(): Promise<Array<Call & { guaranteeConfig: ClientGuaranteeConfig | null }>>;
  getOrdersForAppointmentReminder(): Promise<Array<ExternalOrder & { guaranteeConfig: ClientGuaranteeConfig | null }>>;
  markCallReminderSent(callId: string): Promise<void>;
  markOrderReminderSent(orderId: string): Promise<void>;
  getRemindersSentCount(userId: string): Promise<number>;
  
  // ===== REVIEW & REPUTATION SYSTEM =====
  
  // Review config
  getReviewConfig(userId: string): Promise<ReviewConfig | undefined>;
  upsertReviewConfig(userId: string, config: Partial<InsertReviewConfig>): Promise<ReviewConfig>;
  
  // Review incentives
  getReviewIncentives(userId: string): Promise<ReviewIncentive[]>;
  getReviewIncentiveById(id: string, userId: string): Promise<ReviewIncentive | undefined>;
  getDefaultIncentive(userId: string): Promise<ReviewIncentive | undefined>;
  createReviewIncentive(incentive: InsertReviewIncentive): Promise<ReviewIncentive>;
  updateReviewIncentive(id: string, userId: string, updates: Partial<ReviewIncentive>): Promise<ReviewIncentive | undefined>;
  deleteReviewIncentive(id: string, userId: string): Promise<void>;
  setDefaultIncentive(id: string, userId: string): Promise<void>;
  
  // Review requests
  getReviewRequests(userId: string, filters?: {
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ReviewRequest[]>;
  getReviewRequestById(id: string, userId: string): Promise<ReviewRequest | undefined>;
  getReviewRequestByIdAdmin(id: string): Promise<ReviewRequest | undefined>;
  getReviewRequestByToken(token: string): Promise<ReviewRequest | undefined>;
  getReviewRequestByShortCode(shortCode: string): Promise<ReviewRequest | undefined>;
  getPendingReviewRequests(maxAge: Date): Promise<ReviewRequest[]>;
  createReviewRequest(request: InsertReviewRequest): Promise<ReviewRequest>;
  updateReviewRequest(id: string, updates: Partial<ReviewRequest>): Promise<ReviewRequest | undefined>;
  getReviewRequestStats(userId: string): Promise<{
    requestsSent: number;
    linkClicks: number;
    clickRate: number;
    reviewsConfirmed: number;
    conversionRate: number;
    promosGenerated: number;
    promosUsed: number;
    revenueGenerated: number;
    estimatedRevenue: number;
  }>;
  usePromoCode(promoCode: string, orderAmount: number): Promise<ReviewRequest | null>;
  
  // Reviews
  getReviews(userId: string, filters?: {
    platform?: string;
    ratingMin?: number;
    ratingMax?: number;
    sentiment?: string;
    isRead?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Review[]>;
  getReviewById(id: string, userId: string): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, userId: string, updates: Partial<Review>): Promise<Review | undefined>;
  getReviewStats(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    globalScore: number;
    totalReviews: number;
    newReviewsPeriod: number;
    responseRate: number;
    platforms: Record<string, { score: number; count: number }>;
    ratingDistribution: Record<number, number>;
    sentimentDistribution: Record<string, number>;
    trends: Array<{ date: string; count: number; avgRating: number }>;
    avgResponseTimeHours: number | null;
    sentimentTrend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
    platformComparison: Array<{ platform: string; score: number; count: number; trend: number }>;
  }>;
  
  // Review alerts
  getReviewAlerts(userId: string): Promise<ReviewAlert[]>;
  upsertReviewAlerts(userId: string, alerts: Partial<InsertReviewAlert>[]): Promise<void>;
  
  // Review sources (platform connections)
  getReviewSources(userId: string): Promise<ReviewSource[]>;
  getReviewSourceById(id: string, userId: string): Promise<ReviewSource | undefined>;
  getReviewSourceByPlatform(userId: string, platform: string): Promise<ReviewSource | undefined>;
  getAllConnectedSources(): Promise<ReviewSource[]>;
  createReviewSource(source: InsertReviewSource): Promise<ReviewSource>;
  updateReviewSource(id: string, userId: string, updates: Partial<ReviewSource>): Promise<ReviewSource | undefined>;
  deleteReviewSource(id: string, userId: string): Promise<void>;
  
  // Review sync logs
  createSyncLog(log: InsertReviewSyncLog): Promise<ReviewSyncLog>;
  updateSyncLog(id: string, updates: Partial<ReviewSyncLog>): Promise<ReviewSyncLog | undefined>;
  getSyncLogs(sourceId: string, limit?: number): Promise<ReviewSyncLog[]>;
  
  // Reviews with source
  getReviewByPlatformId(platformReviewId: string, platform: string): Promise<Review | undefined>;
  upsertReviewFromPlatform(review: InsertReview): Promise<Review>;
  
  // Review automations
  getReviewAutomations(userId: string): Promise<ReviewAutomation[]>;
  getReviewAutomationById(id: string, userId: string): Promise<ReviewAutomation | undefined>;
  createReviewAutomation(automation: InsertReviewAutomation): Promise<ReviewAutomation>;
  updateReviewAutomation(id: string, userId: string, updates: Partial<InsertReviewAutomation>): Promise<ReviewAutomation | undefined>;
  deleteReviewAutomation(id: string, userId: string): Promise<void>;
  toggleReviewAutomation(id: string, userId: string): Promise<ReviewAutomation | undefined>;
  
  // ===== MARKETING MODULE =====
  
  // Marketing Contacts
  getMarketingContacts(userId: string, filters?: {
    search?: string;
    source?: string;
    hasEmail?: boolean;
    hasPhone?: boolean;
    optInEmail?: boolean;
    optInSms?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<MarketingContact[]>;
  getMarketingContactById(id: string, userId: string): Promise<MarketingContact | undefined>;
  getMarketingContactByEmail(userId: string, email: string): Promise<MarketingContact | undefined>;
  getMarketingContactByPhone(userId: string, phone: string): Promise<MarketingContact | undefined>;
  createMarketingContact(contact: InsertMarketingContact): Promise<MarketingContact>;
  updateMarketingContact(id: string, userId: string, updates: Partial<MarketingContact>): Promise<MarketingContact | undefined>;
  deleteMarketingContact(id: string, userId: string): Promise<void>;
  bulkCreateMarketingContacts(contacts: InsertMarketingContact[]): Promise<{ created: number; updated: number; errors: number }>;
  getMarketingContactsCount(userId: string): Promise<number>;
  getMarketingContactsBySegmentFilters(userId: string, filters: SegmentFilters): Promise<MarketingContact[]>;
  incrementContactEmailStats(contactId: string, stat: 'sent' | 'opened' | 'clicked'): Promise<void>;
  incrementContactSmsStats(contactId: string): Promise<void>;
  
  // Marketing Consent History
  createConsentHistory(contactId: string, action: string, channel: string, source: string, ipAddress?: string, userAgent?: string): Promise<MarketingConsentHistory>;
  getConsentHistory(contactId: string): Promise<MarketingConsentHistory[]>;
  
  // Marketing Segments
  getMarketingSegments(userId: string): Promise<MarketingSegment[]>;
  getMarketingSegmentById(id: string, userId: string): Promise<MarketingSegment | undefined>;
  createMarketingSegment(segment: InsertMarketingSegment): Promise<MarketingSegment>;
  updateMarketingSegment(id: string, userId: string, updates: Partial<MarketingSegment>): Promise<MarketingSegment | undefined>;
  deleteMarketingSegment(id: string, userId: string): Promise<void>;
  updateSegmentContactCount(id: string, count: number): Promise<void>;
  
  // Marketing Templates
  getMarketingTemplates(userId: string, filters?: {
    category?: string;
    channel?: string;
    businessType?: string;
    includeSystem?: boolean;
  }): Promise<MarketingTemplate[]>;
  getMarketingTemplateById(id: string, userId: string): Promise<MarketingTemplate | undefined>;
  createMarketingTemplate(template: InsertMarketingTemplate): Promise<MarketingTemplate>;
  updateMarketingTemplate(id: string, userId: string, updates: Partial<MarketingTemplate>): Promise<MarketingTemplate | undefined>;
  deleteMarketingTemplate(id: string, userId: string): Promise<void>;
  incrementTemplateUsage(id: string): Promise<void>;
  getSystemTemplates(filters?: { category?: string; channel?: string; businessType?: string }): Promise<MarketingTemplate[]>;
  
  // Marketing Campaigns
  getMarketingCampaigns(userId: string, filters?: {
    status?: string;
    type?: string;
    channel?: string;
    limit?: number;
    offset?: number;
  }): Promise<MarketingCampaign[]>;
  getMarketingCampaignById(id: string, userId: string): Promise<MarketingCampaign | undefined>;
  createMarketingCampaign(campaign: InsertMarketingCampaign): Promise<MarketingCampaign>;
  updateMarketingCampaign(id: string, userId: string, updates: Partial<MarketingCampaign>): Promise<MarketingCampaign | undefined>;
  deleteMarketingCampaign(id: string, userId: string): Promise<void>;
  getScheduledCampaigns(): Promise<MarketingCampaign[]>;
  updateCampaignStats(id: string, stats: Partial<{
    totalRecipients: number;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalConverted: number;
    totalUnsubscribed: number;
    totalBounced: number;
    totalFailed: number;
    totalRevenue: string;
    emailCost: string;
    smsCost: string;
  }>): Promise<void>;
  
  // Marketing Sends
  createMarketingSend(send: Partial<MarketingSend> & { campaignId: string; contactId: string; channel: string }): Promise<MarketingSend>;
  getMarketingSendByTrackingId(trackingId: string): Promise<MarketingSend | undefined>;
  updateMarketingSend(id: string, updates: Partial<MarketingSend>): Promise<MarketingSend | undefined>;
  getMarketingSendsByCampaign(campaignId: string): Promise<MarketingSend[]>;
  getCampaignSendStats(campaignId: string): Promise<{
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
    unsubscribed: number;
  }>;
  
  // Marketing Click Events
  createClickEvent(sendId: string, url: string, ipAddress?: string, userAgent?: string, device?: string, browser?: string, os?: string): Promise<MarketingClickEvent>;
  getClickEventsBySend(sendId: string): Promise<MarketingClickEvent[]>;
  
  // Marketing Automations
  getMarketingAutomations(userId: string): Promise<MarketingAutomation[]>;
  getMarketingAutomationById(id: string, userId: string): Promise<MarketingAutomation | undefined>;
  createMarketingAutomation(automation: InsertMarketingAutomation): Promise<MarketingAutomation>;
  updateMarketingAutomation(id: string, userId: string, updates: Partial<MarketingAutomation>): Promise<MarketingAutomation | undefined>;
  deleteMarketingAutomation(id: string, userId: string): Promise<void>;
  getActiveAutomationsByTrigger(triggerType: string): Promise<MarketingAutomation[]>;
  incrementAutomationStats(id: string, stat: 'triggered' | 'completed' | 'failed'): Promise<void>;
  
  // Marketing Automation Logs
  createAutomationLog(log: Partial<MarketingAutomationLog> & { automationId: string; contactId: string; status: string }): Promise<MarketingAutomationLog>;
  updateAutomationLog(id: string, updates: Partial<MarketingAutomationLog>): Promise<MarketingAutomationLog | undefined>;
  getPendingAutomationLogs(): Promise<MarketingAutomationLog[]>;
  getAutomationLogsByContact(contactId: string): Promise<MarketingAutomationLog[]>;
  
  // Marketing Analytics
  getMarketingOverviewStats(userId: string, period?: 'week' | 'month' | 'year'): Promise<{
    totalContacts: number;
    newContactsPeriod: number;
    totalCampaigns: number;
    campaignsSentPeriod: number;
    totalEmailsSent: number;
    avgOpenRate: number;
    avgClickRate: number;
    totalRevenue: number;
    costPerConversion: number;
  }>;
  getCampaignPerformanceChart(userId: string, period?: 'week' | 'month' | 'year'): Promise<Array<{
    date: string;
    emailsSent: number;
    opened: number;
    clicked: number;
    conversions: number;
  }>>;
  
  // ===== EXTERNAL INTEGRATIONS SYSTEM =====
  
  // External Connections
  getExternalConnections(userId: string): Promise<ExternalConnection[]>;
  getExternalConnectionById(id: string, userId: string): Promise<ExternalConnection | undefined>;
  getExternalConnectionByProvider(userId: string, provider: string): Promise<ExternalConnection | undefined>;
  getExternalConnectionWithCredentials(id: string, userId: string): Promise<ExternalConnection | undefined>;
  createExternalConnection(connection: Partial<ExternalConnection> & { userId: string; provider: string; name: string; authType: string }): Promise<ExternalConnection>;
  updateExternalConnection(id: string, userId: string, updates: Partial<ExternalConnection>): Promise<ExternalConnection | undefined>;
  deleteExternalConnection(id: string, userId: string): Promise<void>;
  getActiveConnections(userId: string): Promise<ExternalConnection[]>;
  getAllActiveConnections(): Promise<ExternalConnection[]>;
  
  // External Sync Jobs
  createSyncJob(job: Partial<ExternalSyncJob> & { connectionId: string; userId: string; jobType: string }): Promise<ExternalSyncJob>;
  updateSyncJob(id: string, updates: Partial<ExternalSyncJob>): Promise<ExternalSyncJob | undefined>;
  getSyncJobsByConnection(connectionId: string, limit?: number): Promise<ExternalSyncJob[]>;
  getLatestSyncJob(connectionId: string): Promise<ExternalSyncJob | undefined>;
  getPendingSyncJobs(): Promise<ExternalSyncJob[]>;
  
  // External Field Mappings
  getFieldMappings(connectionId: string): Promise<ExternalFieldMapping[]>;
  getFieldMappingByEntity(connectionId: string, entityType: string): Promise<ExternalFieldMapping | undefined>;
  upsertFieldMapping(connectionId: string, entityType: string, mappings: object, customFields?: object): Promise<ExternalFieldMapping>;
  deleteFieldMapping(id: string): Promise<void>;
  
  // External Customers
  getExternalCustomers(userId: string, filters?: {
    search?: string;
    source?: string;
    segment?: string;
    minSpent?: number;
    maxSpent?: number;
    limit?: number;
    offset?: number;
  }): Promise<ExternalCustomer[]>;
  getExternalCustomerById(id: string, userId: string): Promise<ExternalCustomer | undefined>;
  getExternalCustomerByExternalId(userId: string, externalId: string, source: string): Promise<ExternalCustomer | undefined>;
  createExternalCustomer(customer: Partial<ExternalCustomer> & { userId: string }): Promise<ExternalCustomer>;
  updateExternalCustomer(id: string, userId: string, updates: Partial<ExternalCustomer>): Promise<ExternalCustomer | undefined>;
  upsertExternalCustomer(userId: string, externalId: string, source: string, data: Partial<ExternalCustomer>): Promise<ExternalCustomer>;
  deleteExternalCustomer(id: string, userId: string): Promise<void>;
  getExternalCustomersCount(userId: string): Promise<number>;
  recalculateCustomerStats(customerId: string): Promise<void>;
  getTopCustomers(userId: string, limit?: number): Promise<ExternalCustomer[]>;
  findEmailByPhone(phone: string, userId?: string): Promise<{ email: string; source: string; name?: string } | null>;
  
  // External Orders
  getExternalOrders(userId: string, filters?: {
    customerId?: string;
    source?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }): Promise<ExternalOrder[]>;
  getExternalOrderById(id: string, userId: string): Promise<ExternalOrder | undefined>;
  getExternalOrderByExternalId(userId: string, externalId: string, source: string): Promise<ExternalOrder | undefined>;
  createExternalOrder(order: Partial<ExternalOrder> & { userId: string; externalId: string; externalSource: string; totalAmount: string; orderDate: Date }): Promise<ExternalOrder>;
  updateExternalOrder(id: string, userId: string, updates: Partial<ExternalOrder>): Promise<ExternalOrder | undefined>;
  upsertExternalOrder(userId: string, externalId: string, source: string, data: Partial<ExternalOrder>): Promise<ExternalOrder>;
  
  // External Transactions
  getExternalTransactions(userId: string, filters?: {
    customerId?: string;
    orderId?: string;
    source?: string;
    transactionType?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ExternalTransaction[]>;
  getExternalTransactionById(id: string, userId: string): Promise<ExternalTransaction | undefined>;
  createExternalTransaction(transaction: InsertExternalTransaction): Promise<ExternalTransaction>;
  updateExternalTransaction(id: string, userId: string, updates: Partial<ExternalTransaction>): Promise<ExternalTransaction | undefined>;
  getTransactionStats(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    totalTransactions: number;
    totalAmount: number;
    totalFees: number;
    netAmount: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byPaymentMethod: Record<string, number>;
  }>;
  deleteExternalOrder(id: string, userId: string): Promise<void>;
  getOrderStats(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    ordersByStatus: Record<string, number>;
    ordersByChannel: Record<string, number>;
    revenueBySource: Record<string, number>;
  }>;
  getCustomerOrders(customerId: string): Promise<ExternalOrder[]>;
  
  // External Products
  getExternalProducts(userId: string, filters?: {
    search?: string;
    category?: string;
    source?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ExternalProduct[]>;
  getExternalProductById(id: string, userId: string): Promise<ExternalProduct | undefined>;
  getExternalProductByExternalId(userId: string, externalId: string, source: string): Promise<ExternalProduct | undefined>;
  createExternalProduct(product: Partial<ExternalProduct> & { userId: string; externalId: string; externalSource: string; name: string }): Promise<ExternalProduct>;
  upsertExternalProduct(userId: string, externalId: string, source: string, data: Partial<ExternalProduct>): Promise<ExternalProduct>;
  deleteExternalProduct(id: string, userId: string): Promise<void>;
  getTopProducts(userId: string, limit?: number): Promise<ExternalProduct[]>;
  
  // External Activities
  getExternalActivities(userId: string, filters?: {
    customerId?: string;
    activityType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ExternalActivity[]>;
  createExternalActivity(activity: Partial<ExternalActivity> & { userId: string; externalSource: string; activityType: string; activityDate: Date }): Promise<ExternalActivity>;
  getCustomerActivities(customerId: string): Promise<ExternalActivity[]>;
  
  // Integration Webhooks
  getIntegrationWebhooks(connectionId: string): Promise<IntegrationWebhook[]>;
  createIntegrationWebhook(webhook: Partial<IntegrationWebhook> & { connectionId: string; userId: string; event: string }): Promise<IntegrationWebhook>;
  updateIntegrationWebhook(id: string, updates: Partial<IntegrationWebhook>): Promise<IntegrationWebhook | undefined>;
  deleteIntegrationWebhook(id: string): Promise<void>;
  
  // Integration Provider Configs
  getProviderConfigs(): Promise<IntegrationProviderConfig[]>;
  getProviderConfigByProvider(provider: string): Promise<IntegrationProviderConfig | undefined>;
  getProviderConfigsByCategory(category: string): Promise<IntegrationProviderConfig[]>;
  
  // Integration Analytics
  getIntegrationStats(userId: string): Promise<{
    totalConnections: number;
    activeConnections: number;
    totalCustomers: number;
    totalOrders: number;
    totalRevenue: number;
    lastSyncAt: Date | null;
    syncErrorsLast24h: number;
    customersBySource: Record<string, number>;
    revenueBySource: Record<string, number>;
  }>;

  // User OAuth Config
  getUserOAuthConfig(userId: string, provider: string): Promise<UserOAuthConfig | undefined>;
  upsertUserOAuthConfig(userId: string, provider: string, clientId: string, encryptedSecret: string, label?: string): Promise<UserOAuthConfig>;
  deleteUserOAuthConfig(userId: string, provider: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user || undefined;
  }

  async getUserByStripeSubscriptionId(subscriptionId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId));
    return user || undefined;
  }

  async getUserByAgentId(agentId: string): Promise<User | undefined> {
    // Find user via calls table which stores agentId
    const [call] = await db
      .select({ userId: calls.userId })
      .from(calls)
      .where(eq(calls.agentId, agentId))
      .limit(1);
    
    if (!call) {
      return undefined;
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, call.userId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async setVerificationToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({
        verificationToken: token,
        verificationTokenExpiry: expiry,
      })
      .where(eq(users.id, userId));
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token));
    return user || undefined;
  }

  async verifyEmail(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      })
      .where(eq(users.id, userId));
  }

  async setResetPasswordToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({
        resetPasswordToken: token,
        resetPasswordTokenExpiry: expiry,
      })
      .where(eq(users.id, userId));
  }

  async getUserByResetPasswordToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetPasswordToken, token));
    return user || undefined;
  }

  async resetPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
      })
      .where(eq(users.id, userId));
  }

  async updateStripeInfo(userId: string, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionCurrentPeriodEnd?: Date;
  }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getAllUsersWithApiKey(): Promise<User[]> {
    // Return all users that have an API key hash
    // This is needed because bcrypt requires comparing each hash individually
    console.log("[getAllUsersWithApiKey] Fetching users with API keys...");
    
    const result = await db
      .select()
      .from(users)
      .where(isNotNull(users.apiKeyHash));
    
    console.log("[getAllUsersWithApiKey] Found", result.length, "users with API keys");
    if (result.length > 0) {
      result.forEach(u => {
        console.log("[getAllUsersWithApiKey] - User:", u.email, 
          "| Hash:", u.apiKeyHash?.substring(0, 20) + "...",
          "| accountStatus:", u.accountStatus,
          "| subscriptionStatus:", u.subscriptionStatus);
      });
    } else {
      // Debug: check all users to see if apiKeyHash exists
      const allUsers = await db.select().from(users);
      console.log("[getAllUsersWithApiKey] DEBUG - Total users in DB:", allUsers.length);
      allUsers.forEach(u => {
        console.log("[getAllUsersWithApiKey] DEBUG - User:", u.email, "| apiKeyHash:", u.apiKeyHash ? "EXISTS" : "NULL");
      });
    }
    
    return result;
  }

  async regenerateApiKey(userId: string): Promise<{ apiKey: string; apiKeyHash: string }> {
    console.log("[regenerateApiKey] Starting for userId:", userId);
    
    const { apiKey, apiKeyHash } = await generateApiKey();
    console.log("[regenerateApiKey] Generated new hash:", apiKeyHash.substring(0, 20) + "...");
    
    const [updatedUser] = await db
      .update(users)
      .set({ apiKeyHash })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      console.error("[regenerateApiKey] ERROR: No user updated for userId:", userId);
      throw new Error("Failed to update API key - user not found");
    }
    
    console.log("[regenerateApiKey] SUCCESS - User updated:", updatedUser.email);
    console.log("[regenerateApiKey] Stored hash:", updatedUser.apiKeyHash?.substring(0, 20) + "...");
    
    return { apiKey, apiKeyHash };
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async updateUserEmail(userId: string, email: string): Promise<void> {
    await db
      .update(users)
      .set({ email })
      .where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async deleteUser(userId: string): Promise<void> {
    // First delete all user's calls
    await db.delete(calls).where(eq(calls.userId, userId));
    // Then delete the user
    await db.delete(users).where(eq(users.id, userId));
  }

  // ===== CALLS MANAGEMENT =====

  private getTimeFilterDate(filter?: 'hour' | 'today' | 'two_days' | 'week'): Date | undefined {
    if (!filter) return undefined;
    
    const now = new Date();
    switch (filter) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'today':
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        return startOfDay;
      case 'two_days':
        return new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default:
        return undefined;
    }
  }

  async getCalls(userId: string, filters?: {
    timeFilter?: 'hour' | 'today' | 'two_days' | 'week';
    statusFilter?: string;
    appointmentsOnly?: boolean;
    hidePastAppointments?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ calls: Call[]; total: number; page: number; totalPages: number }> {
    const conditions = [eq(calls.userId, userId)];
    
    if (filters?.timeFilter) {
      const timeDate = this.getTimeFilterDate(filters.timeFilter);
      if (timeDate) {
        conditions.push(gte(calls.startTime, timeDate));
      }
    }
    
    if (filters?.statusFilter) {
      conditions.push(eq(calls.status, filters.statusFilter));
    }
    
    // Filter for calls with appointment dates only
    if (filters?.appointmentsOnly) {
      conditions.push(isNotNull(calls.appointmentDate));
    }
    
    // Hide calls with past appointment dates (completed RDVs)
    if (filters?.hidePastAppointments) {
      const now = new Date();
      conditions.push(
        or(
          isNull(calls.appointmentDate),
          gte(calls.appointmentDate, now)
        )!
      );
    }
    
    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(calls)
      .where(and(...conditions));
    
    const total = countResult?.count || 0;
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    
    const result = await db
      .select()
      .from(calls)
      .where(and(...conditions))
      .orderBy(desc(calls.startTime))
      .limit(limit)
      .offset(offset);
    
    return { calls: result, total, page, totalPages };
  }

  async getCallById(id: string, userId: string): Promise<Call | undefined> {
    const [call] = await db
      .select()
      .from(calls)
      .where(and(eq(calls.id, id), eq(calls.userId, userId)));
    return call || undefined;
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    const [call] = await db
      .insert(calls)
      .values(insertCall)
      .returning();
    return call;
  }

  async getStats(userId: string, timeFilter?: 'hour' | 'today' | 'two_days' | 'week'): Promise<{
    totalCalls: number;
    activeCalls: number;
    conversionRate: number;
    averageDuration: number;
    hoursSaved: number;
    estimatedRevenue: number;
  }> {
    const conditions = [eq(calls.userId, userId)];
    
    if (timeFilter) {
      const timeDate = this.getTimeFilterDate(timeFilter);
      if (timeDate) {
        conditions.push(gte(calls.startTime, timeDate));
      }
    }

    // Total calls
    const totalResult = await db
      .select({ count: count() })
      .from(calls)
      .where(and(...conditions));
    const totalCalls = Number(totalResult[0]?.count || 0);

    // Active calls
    const activeResult = await db
      .select({ count: count() })
      .from(calls)
      .where(and(...conditions, eq(calls.status, 'active')));
    const activeCalls = Number(activeResult[0]?.count || 0);

    // Conversion rate - Combines both N8N conversion_result and legacy status data
    // Counts: 1) Calls with conversion_result = 'converted' (N8N data)
    //         2) Calls with status = 'completed' but NO conversion_result set (legacy data)
    // This ensures we don't undercount during mixed data scenarios
    
    // Count calls explicitly converted via N8N
    const convertedResult = await db
      .select({ count: count() })
      .from(calls)
      .where(and(...conditions, eq(calls.conversionResult, 'converted')));
    const convertedCalls = Number(convertedResult[0]?.count || 0);
    
    // Count legacy completed calls that don't have conversion_result set
    const legacyCompletedResult = await db
      .select({ count: count() })
      .from(calls)
      .where(and(
        ...conditions, 
        eq(calls.status, 'completed'),
        sql`${calls.conversionResult} IS NULL OR ${calls.conversionResult} = ''`
      ));
    const legacyCompletedCalls = Number(legacyCompletedResult[0]?.count || 0);
    
    // Total successful calls = N8N converted + legacy completed (no overlap)
    const successfulCalls = convertedCalls + legacyCompletedCalls;
    const conversionRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

    // Average duration (only for completed calls)
    const durationResult = await db
      .select({ avgDuration: sql<number>`AVG(${calls.duration})` })
      .from(calls)
      .where(and(...conditions, eq(calls.status, 'completed')));
    const averageDuration = Number(durationResult[0]?.avgDuration || 0);

    // Business metrics
    const MINUTES_PER_CALL = 3;
    const AVERAGE_CLIENT_VALUE = 80;
    
    // Hours saved: totalCalls × 5 minutes / 60
    const hoursSaved = (totalCalls * MINUTES_PER_CALL) / 60;
    
    // Estimated revenue: successful conversions × average client value
    const estimatedRevenue = successfulCalls * AVERAGE_CLIENT_VALUE;

    return {
      totalCalls,
      activeCalls,
      conversionRate: Math.round(conversionRate * 10) / 10,
      averageDuration: Math.round(averageDuration),
      hoursSaved: Math.round(hoursSaved * 10) / 10,
      estimatedRevenue,
    };
  }

  async getChartData(userId: string, timeFilter?: 'hour' | 'today' | 'two_days' | 'week'): Promise<{
    date: string;
    totalCalls: number;
    completedCalls: number;
    averageDuration: number;
  }[]> {
    const conditions = [eq(calls.userId, userId)];
    
    if (timeFilter) {
      const timeDate = this.getTimeFilterDate(timeFilter);
      if (timeDate) {
        conditions.push(gte(calls.startTime, timeDate));
      }
    }

    // Group by date
    const result = await db
      .select({
        date: sql<string>`DATE(${calls.startTime})`,
        totalCalls: count(),
        completedCalls: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
        averageDuration: sql<number>`COALESCE(AVG(CASE WHEN ${calls.status} = 'completed' THEN ${calls.duration} END), 0)`,
      })
      .from(calls)
      .where(and(...conditions))
      .groupBy(sql`DATE(${calls.startTime})`)
      .orderBy(sql`DATE(${calls.startTime})`);

    return result.map(row => ({
      date: row.date,
      totalCalls: Number(row.totalCalls),
      completedCalls: Number(row.completedCalls),
      averageDuration: Math.round(Number(row.averageDuration)),
    }));
  }

  // Notifications management implementations
  async getNotifications(userId: string, filters?: {
    timeFilter?: 'day' | 'two_days' | 'three_days' | 'week' | 'month';
    typeFilter?: 'daily_summary' | 'failed_calls' | 'active_call' | 'password_changed' | 'payment_updated' | 'subscription_renewed' | 'subscription_created' | 'subscription_expired' | 'subscription_expiring_soon';
    isRead?: boolean;
  }): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId)];
    
    // Apply time filter
    if (filters?.timeFilter) {
      const now = new Date();
      let filterDate: Date | null = null;
      
      switch (filters.timeFilter) {
        case 'day':
          filterDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'two_days':
          filterDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
          break;
        case 'three_days':
          filterDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          break;
        case 'week':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      
      if (filterDate) {
        conditions.push(gte(notifications.createdAt, filterDate));
      }
    }
    
    // Apply type filter
    if (filters?.typeFilter) {
      conditions.push(eq(notifications.type, filters.typeFilter));
    }
    
    // Apply read/unread filter
    if (filters?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead));
    }
    
    const result = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));
    
    return result;
  }

  async getNotificationById(id: string, userId: string): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    
    return notification || undefined;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    
    return created;
  }

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async getUnreadNotificationsCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    
    return Number(result[0]?.count || 0);
  }

  // Notification preferences implementations
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    
    return prefs || undefined;
  }

  async upsertNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    // Try to update first
    const existing = await this.getNotificationPreferences(userId);
    
    if (existing) {
      const [updated] = await db
        .update(notificationPreferences)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      
      return updated;
    }
    
    // Create new if doesn't exist
    const [created] = await db
      .insert(notificationPreferences)
      .values({
        userId,
        ...preferences,
      })
      .returning();
    
    return created;
  }

  // Monthly reports implementations
  async getMonthlyReports(userId: string): Promise<MonthlyReport[]> {
    const reports = await db
      .select()
      .from(monthlyReports)
      .where(eq(monthlyReports.userId, userId))
      .orderBy(desc(monthlyReports.periodStart));
    
    return reports;
  }

  async getMonthlyReportById(id: string, userId: string): Promise<MonthlyReport | undefined> {
    const [report] = await db
      .select()
      .from(monthlyReports)
      .where(and(
        eq(monthlyReports.id, id),
        eq(monthlyReports.userId, userId)
      ));
    
    return report || undefined;
  }

  async getMonthlyReportByPeriod(userId: string, periodStart: Date, periodEnd: Date): Promise<MonthlyReport | undefined> {
    const [report] = await db
      .select()
      .from(monthlyReports)
      .where(and(
        eq(monthlyReports.userId, userId),
        eq(monthlyReports.periodStart, periodStart),
        eq(monthlyReports.periodEnd, periodEnd)
      ));
    
    return report || undefined;
  }

  async createMonthlyReport(insertReport: InsertMonthlyReport): Promise<MonthlyReport> {
    const [report] = await db
      .insert(monthlyReports)
      .values(insertReport)
      .returning();
    
    return report;
  }

  async getUsersForMonthlyReportGeneration(): Promise<User[]> {
    // Get users whose subscription renews in approximately 2 days
    // We look for subscriptionCurrentPeriodEnd between 1.5 and 2.5 days from now
    const now = new Date();
    const minDate = new Date(now.getTime() + 1.5 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);
    
    const eligibleUsers = await db
      .select()
      .from(users)
      .where(and(
        eq(users.subscriptionStatus, 'active'),
        gte(users.subscriptionCurrentPeriodEnd, minDate),
        sql`${users.subscriptionCurrentPeriodEnd} <= ${maxDate}`,
        eq(users.role, 'user') // Exclude admins
      ));
    
    return eligibleUsers;
  }

  async getUsersWithExpiringTrials(): Promise<User[]> {
    // Get users whose trial ends today or has already ended
    const now = new Date();
    
    const expiringUsers = await db
      .select()
      .from(users)
      .where(and(
        eq(users.accountStatus, 'trial'),
        sql`${users.countdownEnd} <= ${now}`,
        eq(users.role, 'user') // Exclude admins
      ));
    
    return expiringUsers;
  }

  // ===== ADMIN FUNCTIONS =====

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async suspendUser(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ accountStatus: 'suspended' })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async activateUser(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ accountStatus: 'active' })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async assignPlan(userId: string, plan: string | null): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ plan })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getUserStats(userId: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    lastActivity: Date | null;
    healthStatus: 'green' | 'orange' | 'red';
  }> {
    // Get total calls count
    const totalCallsResult = await db
      .select({ count: count() })
      .from(calls)
      .where(eq(calls.userId, userId));
    const totalCalls = totalCallsResult[0]?.count || 0;

    // Get total minutes (sum of all call durations)
    const totalMinutesResult = await db
      .select({ total: sql<number>`COALESCE(SUM(duration), 0)` })
      .from(calls)
      .where(eq(calls.userId, userId));
    const totalSeconds = totalMinutesResult[0]?.total || 0;
    const totalMinutes = Math.round(totalSeconds / 60);

    // Get last activity (most recent call)
    const lastActivityResult = await db
      .select({ startTime: calls.startTime })
      .from(calls)
      .where(eq(calls.userId, userId))
      .orderBy(desc(calls.startTime))
      .limit(1);
    const lastActivity = lastActivityResult[0]?.startTime || null;

    // Calculate health status based on recent activity and failed calls
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get failed calls in last 24 hours
    const failedCallsResult = await db
      .select({ count: count() })
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          eq(calls.status, 'failed'),
          gte(calls.startTime, twentyFourHoursAgo)
        )
      );
    const failedCalls = failedCallsResult[0]?.count || 0;

    // Get total calls in last 24 hours
    const recentCallsResult = await db
      .select({ count: count() })
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          gte(calls.startTime, twentyFourHoursAgo)
        )
      );
    const recentCalls = recentCallsResult[0]?.count || 0;

    // Determine health status
    let healthStatus: 'green' | 'orange' | 'red' = 'green';
    
    if (recentCalls === 0 && lastActivity && (now.getTime() - lastActivity.getTime() > 7 * 24 * 60 * 60 * 1000)) {
      // No recent calls and last activity > 7 days ago = red
      healthStatus = 'red';
    } else if (failedCalls > 0) {
      const failureRate = failedCalls / Math.max(recentCalls, 1);
      if (failureRate > 0.5) {
        // More than 50% failed = red
        healthStatus = 'red';
      } else if (failureRate > 0.2) {
        // More than 20% failed = orange
        healthStatus = 'orange';
      }
    }

    return {
      totalCalls,
      totalMinutes,
      lastActivity,
      healthStatus,
    };
  }

  // ===== SpeedAI Clients Management =====
  
  async getSpeedaiClientByAgentId(agentId: string): Promise<SpeedaiClient | undefined> {
    const [client] = await db
      .select()
      .from(speedaiClients)
      .where(eq(speedaiClients.agentId, agentId));
    return client || undefined;
  }

  async getAllSpeedaiClients(): Promise<SpeedaiClient[]> {
    return await db
      .select()
      .from(speedaiClients)
      .orderBy(desc(speedaiClients.lastCallAt));
  }

  async createOrUpdateSpeedaiClient(agentId: string, data?: Partial<InsertSpeedaiClient>): Promise<SpeedaiClient> {
    const existing = await this.getSpeedaiClientByAgentId(agentId);
    const now = new Date();
    
    if (existing) {
      // Update existing client
      const [updated] = await db
        .update(speedaiClients)
        .set({
          ...data,
          lastCallAt: now,
          updatedAt: now,
        })
        .where(eq(speedaiClients.agentId, agentId))
        .returning();
      return updated;
    } else {
      // Create new client
      const [created] = await db
        .insert(speedaiClients)
        .values({
          agentId,
          firstCallAt: now,
          lastCallAt: now,
          ...data,
        })
        .returning();
      return created;
    }
  }

  async getCallsByAgentId(agentId: string, filters?: { month?: number; year?: number }): Promise<Call[]> {
    let query = db.select().from(calls).where(eq(calls.agentId, agentId));
    
    // Apply month/year filter if provided
    if (filters?.month && filters?.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
      
      const allCalls = await query.orderBy(desc(calls.startTime));
      return allCalls.filter(call => {
        const callDate = new Date(call.startTime);
        return callDate >= startDate && callDate <= endDate;
      });
    }
    
    return await query.orderBy(desc(calls.startTime));
  }

  // ===== Push Subscriptions Management =====
  
  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return subscription || undefined;
  }

  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    // Check if subscription already exists for this endpoint
    const existing = await this.getPushSubscriptionByEndpoint(subscription.endpoint);
    
    if (existing) {
      // Update existing subscription
      const [updated] = await db
        .update(pushSubscriptions)
        .set({
          ...subscription,
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .returning();
      return updated;
    }
    
    // Create new subscription
    const [created] = await db
      .insert(pushSubscriptions)
      .values(subscription)
      .returning();
    return created;
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async deletePushSubscriptionsByUserId(userId: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async getAllActivePushSubscriptions(): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, true));
  }

  // ===== CB Guarantee Management =====
  
  async getGuaranteeConfig(userId: string): Promise<ClientGuaranteeConfig | undefined> {
    const [config] = await db
      .select()
      .from(clientGuaranteeConfig)
      .where(eq(clientGuaranteeConfig.userId, userId));
    return config || undefined;
  }

  async upsertGuaranteeConfig(userId: string, config: Partial<InsertClientGuaranteeConfig>): Promise<ClientGuaranteeConfig> {
    const existing = await this.getGuaranteeConfig(userId);
    
    if (existing) {
      const [updated] = await db
        .update(clientGuaranteeConfig)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(eq(clientGuaranteeConfig.userId, userId))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(clientGuaranteeConfig)
      .values({
        userId,
        ...config,
      })
      .returning();
    return created;
  }

  // ===== Guarantee Sessions =====
  
  async getGuaranteeSessions(userId: string, filters?: {
    status?: string;
    period?: 'today' | 'week' | 'month';
  }): Promise<GuaranteeSession[]> {
    const conditions = [eq(guaranteeSessions.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(guaranteeSessions.status, filters.status));
    }
    
    if (filters?.period) {
      const now = new Date();
      let startDate: Date;
      
      switch (filters.period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      
      conditions.push(gte(guaranteeSessions.reservationDate, startDate));
    }
    
    return await db
      .select()
      .from(guaranteeSessions)
      .where(and(...conditions))
      .orderBy(desc(guaranteeSessions.reservationDate));
  }

  async getGuaranteeSessionById(id: string): Promise<GuaranteeSession | undefined> {
    const [session] = await db
      .select()
      .from(guaranteeSessions)
      .where(eq(guaranteeSessions.id, id));
    return session || undefined;
  }

  async getGuaranteeSessionByReservationId(reservationId: string): Promise<GuaranteeSession | undefined> {
    const [session] = await db
      .select()
      .from(guaranteeSessions)
      .where(eq(guaranteeSessions.reservationId, reservationId));
    return session || undefined;
  }

  async getGuaranteeSessionByCheckoutSessionId(checkoutSessionId: string): Promise<GuaranteeSession | undefined> {
    const [session] = await db
      .select()
      .from(guaranteeSessions)
      .where(eq(guaranteeSessions.checkoutSessionId, checkoutSessionId));
    return session || undefined;
  }

  async getGuaranteeSessionByShortCode(shortCode: string): Promise<GuaranteeSession | undefined> {
    const [session] = await db
      .select()
      .from(guaranteeSessions)
      .where(eq(guaranteeSessions.shortCode, shortCode));
    return session || undefined;
  }

  async createGuaranteeSession(session: InsertGuaranteeSession): Promise<GuaranteeSession> {
    const [created] = await db
      .insert(guaranteeSessions)
      .values(session)
      .returning();
    return created;
  }

  async updateGuaranteeSession(id: string, updates: Partial<GuaranteeSession>): Promise<GuaranteeSession | undefined> {
    const [updated] = await db
      .update(guaranteeSessions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(guaranteeSessions.id, id))
      .returning();
    return updated || undefined;
  }

  async getSessionsForAppointmentReminder(): Promise<Array<GuaranteeSession & { config: ClientGuaranteeConfig }>> {
    const now = new Date();
    
    const results = await db
      .select({
        session: guaranteeSessions,
        config: clientGuaranteeConfig,
      })
      .from(guaranteeSessions)
      .innerJoin(clientGuaranteeConfig, eq(guaranteeSessions.userId, clientGuaranteeConfig.userId))
      .where(
        and(
          eq(guaranteeSessions.status, 'validated'),
          eq(guaranteeSessions.appointmentReminderSent, false),
          eq(clientGuaranteeConfig.appointmentReminderEnabled, true),
          isNotNull(guaranteeSessions.reservationDate),
          gt(guaranteeSessions.reservationDate, now)
        )
      );
    
    const sessionsToRemind: Array<GuaranteeSession & { config: ClientGuaranteeConfig }> = [];
    
    for (const { session, config } of results) {
      if (!session.reservationDate) continue;
      
      const reminderHours = config.appointmentReminderHours || 24;
      const reminderWindowStart = new Date(session.reservationDate.getTime() - (reminderHours * 60 * 60 * 1000));
      
      if (now >= reminderWindowStart && now < session.reservationDate) {
        sessionsToRemind.push({ ...session, config });
      }
    }
    
    return sessionsToRemind;
  }

  async markAppointmentReminderSent(sessionId: string): Promise<void> {
    await db
      .update(guaranteeSessions)
      .set({
        appointmentReminderSent: true,
        appointmentReminderSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(guaranteeSessions.id, sessionId));
  }

  async getCallsForAppointmentReminder(): Promise<Array<Call & { guaranteeConfig: ClientGuaranteeConfig | null }>> {
    const now = new Date();
    
    const results = await db
      .select({
        call: calls,
        config: clientGuaranteeConfig,
      })
      .from(calls)
      .leftJoin(clientGuaranteeConfig, eq(calls.userId, clientGuaranteeConfig.userId))
      .where(
        and(
          eq(calls.appointmentReminderSent, false),
          isNotNull(calls.appointmentDate),
          gt(calls.appointmentDate, now),
          isNotNull(calls.phoneNumber)
        )
      );
    
    const callsToRemind: Array<Call & { guaranteeConfig: ClientGuaranteeConfig | null }> = [];
    
    for (const { call, config } of results) {
      if (!call.appointmentDate) continue;
      if (!config?.appointmentReminderEnabled) continue;
      
      const reminderHours = config.appointmentReminderHours || 24;
      const reminderWindowStart = new Date(call.appointmentDate.getTime() - (reminderHours * 60 * 60 * 1000));
      
      if (now >= reminderWindowStart && now < call.appointmentDate) {
        callsToRemind.push({ ...call, guaranteeConfig: config });
      }
    }
    
    return callsToRemind;
  }

  async getOrdersForAppointmentReminder(): Promise<Array<ExternalOrder & { guaranteeConfig: ClientGuaranteeConfig | null }>> {
    const now = new Date();
    
    const results = await db
      .select({
        order: externalOrders,
        config: clientGuaranteeConfig,
      })
      .from(externalOrders)
      .leftJoin(clientGuaranteeConfig, eq(externalOrders.userId, clientGuaranteeConfig.userId))
      .where(
        and(
          eq(externalOrders.appointmentReminderSent, false),
          isNotNull(externalOrders.reservationDate),
          gt(externalOrders.reservationDate, now),
          isNotNull(externalOrders.customerPhone)
        )
      );
    
    const ordersToRemind: Array<ExternalOrder & { guaranteeConfig: ClientGuaranteeConfig | null }> = [];
    
    for (const { order, config } of results) {
      if (!order.reservationDate) continue;
      if (!config?.appointmentReminderEnabled) continue;
      
      const reminderHours = config.appointmentReminderHours || 24;
      const reminderWindowStart = new Date(order.reservationDate.getTime() - (reminderHours * 60 * 60 * 1000));
      
      if (now >= reminderWindowStart && now < order.reservationDate) {
        ordersToRemind.push({ ...order, guaranteeConfig: config });
      }
    }
    
    return ordersToRemind;
  }

  async markCallReminderSent(callId: string): Promise<void> {
    await db
      .update(calls)
      .set({
        appointmentReminderSent: true,
        appointmentReminderSentAt: new Date(),
      })
      .where(eq(calls.id, callId));
  }

  async markOrderReminderSent(orderId: string): Promise<void> {
    await db
      .update(externalOrders)
      .set({
        appointmentReminderSent: true,
        appointmentReminderSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(externalOrders.id, orderId));
  }

  async getRemindersSentCount(userId: string): Promise<number> {
    // Count reminders sent from guarantee_sessions
    const [sessionsResult] = await db
      .select({ count: count() })
      .from(guaranteeSessions)
      .where(and(
        eq(guaranteeSessions.userId, userId),
        eq(guaranteeSessions.appointmentReminderSent, true)
      ));
    
    // Count reminders sent from calls
    const [callsResult] = await db
      .select({ count: count() })
      .from(calls)
      .where(and(
        eq(calls.userId, userId),
        eq(calls.appointmentReminderSent, true)
      ));
    
    // Count reminders sent from external_orders
    const [ordersResult] = await db
      .select({ count: count() })
      .from(externalOrders)
      .where(and(
        eq(externalOrders.userId, userId),
        eq(externalOrders.appointmentReminderSent, true)
      ));
    
    return (sessionsResult?.count || 0) + (callsResult?.count || 0) + (ordersResult?.count || 0);
  }

  // ===== No-Show Charges =====
  
  async getNoshowCharges(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<NoshowCharge[]> {
    const conditions = [eq(noshowCharges.userId, userId)];
    
    if (period && period !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
      
      conditions.push(gte(noshowCharges.createdAt, startDate));
    }
    
    return await db
      .select()
      .from(noshowCharges)
      .where(and(...conditions))
      .orderBy(desc(noshowCharges.createdAt));
  }

  async createNoshowCharge(charge: InsertNoshowCharge): Promise<NoshowCharge> {
    const [created] = await db
      .insert(noshowCharges)
      .values(charge)
      .returning();
    return created;
  }

  async getGuaranteeStats(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    noshowCount: number;
    totalRecovered: number;
    failedCharges: number;
    totalAvoided: number;
  }> {
    const conditions = [eq(noshowCharges.userId, userId)];
    
    if (period && period !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
      
      conditions.push(gte(noshowCharges.createdAt, startDate));
    }
    
    const charges = await db
      .select()
      .from(noshowCharges)
      .where(and(...conditions));
    
    const noshowCount = charges.length;
    const totalRecovered = charges
      .filter(c => c.status === 'succeeded')
      .reduce((sum, c) => sum + c.amount, 0);
    const failedCharges = charges.filter(c => c.status === 'failed').length;
    
    // Estimate avoided no-shows (cancellations after CB validation)
    const sessionConditions = [eq(guaranteeSessions.userId, userId)];
    if (period && period !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
      sessionConditions.push(gte(guaranteeSessions.createdAt, startDate));
    }
    
    const cancelledSessions = await db
      .select()
      .from(guaranteeSessions)
      .where(and(...sessionConditions, eq(guaranteeSessions.status, 'cancelled')));
    
    const totalAvoided = cancelledSessions.reduce(
      (sum, s) => sum + (s.penaltyAmount * s.nbPersons * 100),
      0
    );
    
    return {
      noshowCount,
      totalRecovered,
      failedCharges,
      totalAvoided,
    };
  }

  // ===== REVIEW & REPUTATION SYSTEM IMPLEMENTATIONS =====

  async getReviewConfig(userId: string): Promise<ReviewConfig | undefined> {
    const [config] = await db
      .select()
      .from(reviewConfig)
      .where(eq(reviewConfig.userId, userId));
    return config || undefined;
  }

  async upsertReviewConfig(userId: string, config: Partial<InsertReviewConfig>): Promise<ReviewConfig> {
    const existing = await this.getReviewConfig(userId);
    
    if (existing) {
      const [updated] = await db
        .update(reviewConfig)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(reviewConfig.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(reviewConfig)
        .values({ ...config, userId })
        .returning();
      return created;
    }
  }

  async getReviewIncentives(userId: string): Promise<ReviewIncentive[]> {
    return await db
      .select()
      .from(reviewIncentives)
      .where(eq(reviewIncentives.userId, userId))
      .orderBy(desc(reviewIncentives.createdAt));
  }

  async getReviewIncentiveById(id: string, userId: string): Promise<ReviewIncentive | undefined> {
    const [incentive] = await db
      .select()
      .from(reviewIncentives)
      .where(and(eq(reviewIncentives.id, id), eq(reviewIncentives.userId, userId)));
    return incentive || undefined;
  }

  async getDefaultIncentive(userId: string): Promise<ReviewIncentive | undefined> {
    const [incentive] = await db
      .select()
      .from(reviewIncentives)
      .where(and(
        eq(reviewIncentives.userId, userId),
        eq(reviewIncentives.isActive, true),
        eq(reviewIncentives.isDefault, true)
      ))
      .limit(1);
    return incentive || undefined;
  }

  async createReviewIncentive(incentive: InsertReviewIncentive): Promise<ReviewIncentive> {
    const [created] = await db
      .insert(reviewIncentives)
      .values(incentive)
      .returning();
    return created;
  }

  async updateReviewIncentive(id: string, userId: string, updates: Partial<ReviewIncentive>): Promise<ReviewIncentive | undefined> {
    const [updated] = await db
      .update(reviewIncentives)
      .set(updates)
      .where(and(eq(reviewIncentives.id, id), eq(reviewIncentives.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteReviewIncentive(id: string, userId: string): Promise<void> {
    await db
      .delete(reviewIncentives)
      .where(and(eq(reviewIncentives.id, id), eq(reviewIncentives.userId, userId)));
  }

  async setDefaultIncentive(id: string, userId: string): Promise<void> {
    // First, unset all defaults for this user
    await db
      .update(reviewIncentives)
      .set({ isDefault: false })
      .where(eq(reviewIncentives.userId, userId));
    
    // Then set the new default
    await db
      .update(reviewIncentives)
      .set({ isDefault: true })
      .where(and(eq(reviewIncentives.id, id), eq(reviewIncentives.userId, userId)));
  }

  async getReviewRequests(userId: string, filters?: {
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ReviewRequest[]> {
    const conditions = [eq(reviewRequests.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(reviewRequests.status, filters.status));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(reviewRequests.createdAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(reviewRequests.createdAt, filters.dateTo));
    }
    
    let query = db
      .select()
      .from(reviewRequests)
      .where(and(...conditions))
      .orderBy(desc(reviewRequests.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return await query;
  }

  async getReviewRequestById(id: string, userId: string): Promise<ReviewRequest | undefined> {
    const [request] = await db
      .select()
      .from(reviewRequests)
      .where(and(eq(reviewRequests.id, id), eq(reviewRequests.userId, userId)));
    return request || undefined;
  }

  async getReviewRequestByIdAdmin(id: string): Promise<ReviewRequest | undefined> {
    const [request] = await db
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.id, id));
    return request || undefined;
  }

  async getReviewRequestByToken(token: string): Promise<ReviewRequest | undefined> {
    const [request] = await db
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.trackingToken, token));
    return request || undefined;
  }

  async getReviewRequestByShortCode(shortCode: string): Promise<ReviewRequest | undefined> {
    const [request] = await db
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.shortCode, shortCode));
    return request || undefined;
  }

  async getPendingReviewRequests(maxAge: Date): Promise<ReviewRequest[]> {
    return await db
      .select()
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.status, 'pending'),
          gte(reviewRequests.createdAt, maxAge)
        )
      )
      .orderBy(reviewRequests.createdAt);
  }

  async createReviewRequest(request: InsertReviewRequest): Promise<ReviewRequest> {
    const [created] = await db
      .insert(reviewRequests)
      .values(request)
      .returning();
    return created;
  }

  async updateReviewRequest(id: string, updates: Partial<ReviewRequest>): Promise<ReviewRequest | undefined> {
    const [updated] = await db
      .update(reviewRequests)
      .set(updates)
      .where(eq(reviewRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async getReviewRequestStats(userId: string): Promise<{
    requestsSent: number;
    linkClicks: number;
    clickRate: number;
    reviewsConfirmed: number;
    conversionRate: number;
    promosGenerated: number;
    promosUsed: number;
    revenueGenerated: number;
    estimatedRevenue: number;
  }> {
    const allRequests = await db
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.userId, userId));
    
    const config = await this.getReviewConfig(userId);
    const avgClientValue = config?.averageClientValue || 0;
    
    const requestsSent = allRequests.filter(r => r.sentAt).length;
    const linkClicks = allRequests.filter(r => r.linkClickedAt).length;
    const reviewsConfirmed = allRequests.filter(r => r.reviewConfirmedAt).length;
    const promosGenerated = allRequests.filter(r => r.promoCode).length;
    const promosUsed = allRequests.filter(r => r.promoCodeUsedAt).length;
    const revenueGenerated = allRequests
      .filter(r => r.promoOrderAmount)
      .reduce((sum, r) => sum + (r.promoOrderAmount || 0), 0);
    const estimatedRevenue = Math.round(reviewsConfirmed * (avgClientValue / 100));
    
    return {
      requestsSent,
      linkClicks,
      clickRate: requestsSent > 0 ? Math.round((linkClicks / requestsSent) * 100) : 0,
      reviewsConfirmed,
      conversionRate: requestsSent > 0 ? Math.round((reviewsConfirmed / requestsSent) * 100) : 0,
      promosGenerated,
      promosUsed,
      revenueGenerated,
      estimatedRevenue,
    };
  }

  async usePromoCode(promoCode: string, orderAmount: number): Promise<ReviewRequest | null> {
    const [request] = await db
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.promoCode, promoCode));
    
    if (!request) return null;
    if (request.promoCodeUsedAt) return null;
    
    const [updated] = await db
      .update(reviewRequests)
      .set({
        promoCodeUsedAt: new Date(),
        promoOrderAmount: orderAmount,
      })
      .where(eq(reviewRequests.id, request.id))
      .returning();
    
    return updated || null;
  }

  async getReviews(userId: string, filters?: {
    platform?: string;
    ratingMin?: number;
    ratingMax?: number;
    sentiment?: string;
    isRead?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Review[]> {
    const conditions = [eq(reviews.userId, userId)];
    
    if (filters?.platform) {
      conditions.push(eq(reviews.platform, filters.platform));
    }
    if (filters?.ratingMin) {
      conditions.push(gte(reviews.rating, filters.ratingMin));
    }
    if (filters?.ratingMax) {
      conditions.push(lte(reviews.rating, filters.ratingMax));
    }
    if (filters?.sentiment) {
      conditions.push(eq(reviews.sentiment, filters.sentiment));
    }
    if (typeof filters?.isRead === 'boolean') {
      conditions.push(eq(reviews.isRead, filters.isRead));
    }
    
    let query = db
      .select()
      .from(reviews)
      .where(and(...conditions))
      .orderBy(desc(reviews.reviewDate));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    const result = await query;
    
    // Filter by search if provided (in-memory since Drizzle doesn't support ILIKE easily)
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      return result.filter(r => 
        r.content?.toLowerCase().includes(searchLower) ||
        r.reviewerName?.toLowerCase().includes(searchLower)
      );
    }
    
    return result;
  }

  async getReviewById(id: string, userId: string): Promise<Review | undefined> {
    const [review] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, id), eq(reviews.userId, userId)));
    return review || undefined;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db
      .insert(reviews)
      .values(review)
      .returning();
    return created;
  }

  async updateReview(id: string, userId: string, updates: Partial<Review>): Promise<Review | undefined> {
    const [updated] = await db
      .update(reviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(reviews.id, id), eq(reviews.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async getReviewStats(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    globalScore: number;
    totalReviews: number;
    newReviewsPeriod: number;
    responseRate: number;
    platforms: Record<string, { score: number; count: number }>;
    ratingDistribution: Record<number, number>;
    sentimentDistribution: Record<string, number>;
    trends: Array<{ date: string; count: number; avgRating: number }>;
    avgResponseTimeHours: number | null;
    sentimentTrend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
    platformComparison: Array<{ platform: string; score: number; count: number; trend: number }>;
  }> {
    const conditions = [eq(reviews.userId, userId)];
    
    let periodStartDate: Date | null = null;
    let previousPeriodStart: Date | null = null;
    const now = new Date();
    
    if (period && period !== 'all') {
      switch (period) {
        case 'week':
          periodStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          previousPeriodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          periodStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          periodStartDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          previousPeriodStart = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
          break;
      }
    }
    
    const allReviews = await db
      .select()
      .from(reviews)
      .where(and(...conditions));
    
    const totalReviews = allReviews.length;
    const globalScore = totalReviews > 0 
      ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0;
    
    const periodReviews = periodStartDate 
      ? allReviews.filter(r => r.reviewDate && r.reviewDate >= periodStartDate!)
      : allReviews;
    const newReviewsPeriod = periodReviews.length;
    
    const reviewsWithResponse = allReviews.filter(r => r.responseStatus === 'published').length;
    const responseRate = totalReviews > 0 ? Math.round((reviewsWithResponse / totalReviews) * 100) : 0;
    
    // Aggregate by platform
    const platforms: Record<string, { score: number; count: number }> = {};
    allReviews.forEach(r => {
      if (!platforms[r.platform]) {
        platforms[r.platform] = { score: 0, count: 0 };
      }
      platforms[r.platform].count++;
      platforms[r.platform].score += r.rating;
    });
    Object.keys(platforms).forEach(p => {
      platforms[p].score = Math.round((platforms[p].score / platforms[p].count) * 10) / 10;
    });
    
    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating]++;
      }
    });
    
    // Sentiment distribution
    const sentimentDistribution: Record<string, number> = {
      very_positive: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      very_negative: 0
    };
    allReviews.forEach(r => {
      if (r.sentiment && sentimentDistribution.hasOwnProperty(r.sentiment)) {
        sentimentDistribution[r.sentiment]++;
      }
    });
    
    // === NEW ANALYTICS ===
    
    // Trends: Group by date (last 30 days by default, or period)
    const trendMap = new Map<string, { count: number; totalRating: number }>();
    const trendDays = period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 12 : 30;
    
    periodReviews.forEach(r => {
      if (r.reviewDate) {
        const dateKey = period === 'year' 
          ? `${r.reviewDate.getFullYear()}-${String(r.reviewDate.getMonth() + 1).padStart(2, '0')}`
          : r.reviewDate.toISOString().split('T')[0];
        
        if (!trendMap.has(dateKey)) {
          trendMap.set(dateKey, { count: 0, totalRating: 0 });
        }
        const entry = trendMap.get(dateKey)!;
        entry.count++;
        entry.totalRating += r.rating;
      }
    });
    
    const trends = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        avgRating: Math.round((data.totalRating / data.count) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-trendDays);
    
    // Average response time (for reviews that have responses)
    const reviewsWithResponseTime = allReviews.filter(
      r => r.reviewDate && r.responseDate && r.responseStatus === 'published'
    );
    let avgResponseTimeHours: number | null = null;
    if (reviewsWithResponseTime.length > 0) {
      const totalHours = reviewsWithResponseTime.reduce((sum, r) => {
        const diffMs = r.responseDate!.getTime() - r.reviewDate!.getTime();
        return sum + (diffMs / (1000 * 60 * 60));
      }, 0);
      avgResponseTimeHours = Math.round(totalHours / reviewsWithResponseTime.length);
    }
    
    // Sentiment trend by date
    const sentimentTrendMap = new Map<string, { positive: number; neutral: number; negative: number }>();
    periodReviews.forEach(r => {
      if (r.reviewDate && r.sentiment) {
        const dateKey = period === 'year'
          ? `${r.reviewDate.getFullYear()}-${String(r.reviewDate.getMonth() + 1).padStart(2, '0')}`
          : r.reviewDate.toISOString().split('T')[0];
        
        if (!sentimentTrendMap.has(dateKey)) {
          sentimentTrendMap.set(dateKey, { positive: 0, neutral: 0, negative: 0 });
        }
        const entry = sentimentTrendMap.get(dateKey)!;
        if (r.sentiment === 'very_positive' || r.sentiment === 'positive') {
          entry.positive++;
        } else if (r.sentiment === 'neutral') {
          entry.neutral++;
        } else {
          entry.negative++;
        }
      }
    });
    
    const sentimentTrend = Array.from(sentimentTrendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-trendDays);
    
    // Platform comparison with trend (compare to previous period)
    const previousPeriodReviews = previousPeriodStart && periodStartDate
      ? allReviews.filter(r => r.reviewDate && r.reviewDate >= previousPeriodStart! && r.reviewDate < periodStartDate!)
      : [];
    
    const previousPlatformScores: Record<string, number> = {};
    previousPeriodReviews.forEach(r => {
      if (!previousPlatformScores[r.platform]) {
        previousPlatformScores[r.platform] = 0;
      }
      previousPlatformScores[r.platform] += r.rating;
    });
    const previousPlatformCounts: Record<string, number> = {};
    previousPeriodReviews.forEach(r => {
      previousPlatformCounts[r.platform] = (previousPlatformCounts[r.platform] || 0) + 1;
    });
    
    const platformComparison = Object.entries(platforms).map(([platform, data]) => {
      const prevCount = previousPlatformCounts[platform] || 0;
      const prevScore = prevCount > 0 
        ? (previousPlatformScores[platform] || 0) / prevCount 
        : data.score;
      const trend = Math.round((data.score - prevScore) * 10) / 10;
      
      return {
        platform,
        score: data.score,
        count: data.count,
        trend,
      };
    });
    
    return {
      globalScore,
      totalReviews,
      newReviewsPeriod,
      responseRate,
      platforms,
      ratingDistribution,
      sentimentDistribution,
      trends,
      avgResponseTimeHours,
      sentimentTrend,
      platformComparison,
    };
  }

  async getReviewAlerts(userId: string): Promise<ReviewAlert[]> {
    return await db
      .select()
      .from(reviewAlerts)
      .where(eq(reviewAlerts.userId, userId));
  }

  async upsertReviewAlerts(userId: string, alerts: Partial<InsertReviewAlert>[]): Promise<void> {
    for (const alert of alerts) {
      if (!alert.alertType) continue;
      
      const existing = await db
        .select()
        .from(reviewAlerts)
        .where(and(eq(reviewAlerts.userId, userId), eq(reviewAlerts.alertType, alert.alertType)));
      
      if (existing.length > 0) {
        await db
          .update(reviewAlerts)
          .set(alert)
          .where(and(eq(reviewAlerts.userId, userId), eq(reviewAlerts.alertType, alert.alertType)));
      } else {
        await db
          .insert(reviewAlerts)
          .values({ ...alert, userId, alertType: alert.alertType });
      }
    }
  }

  // ===== REVIEW SOURCES =====

  async getReviewSources(userId: string): Promise<ReviewSource[]> {
    return await db
      .select()
      .from(reviewSources)
      .where(eq(reviewSources.userId, userId))
      .orderBy(desc(reviewSources.createdAt));
  }

  async getReviewSourceById(id: string, userId: string): Promise<ReviewSource | undefined> {
    const [source] = await db
      .select()
      .from(reviewSources)
      .where(and(eq(reviewSources.id, id), eq(reviewSources.userId, userId)));
    return source || undefined;
  }

  async getReviewSourceByPlatform(userId: string, platform: string): Promise<ReviewSource | undefined> {
    const [source] = await db
      .select()
      .from(reviewSources)
      .where(and(eq(reviewSources.userId, userId), eq(reviewSources.platform, platform)));
    return source || undefined;
  }

  async getAllConnectedSources(): Promise<ReviewSource[]> {
    return await db
      .select()
      .from(reviewSources)
      .where(eq(reviewSources.connectionStatus, 'connected'));
  }

  async createReviewSource(source: InsertReviewSource): Promise<ReviewSource> {
    const [created] = await db
      .insert(reviewSources)
      .values(source)
      .returning();
    return created;
  }

  async updateReviewSource(id: string, userId: string, updates: Partial<ReviewSource>): Promise<ReviewSource | undefined> {
    const [updated] = await db
      .update(reviewSources)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(reviewSources.id, id), eq(reviewSources.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteReviewSource(id: string, userId: string): Promise<void> {
    await db
      .delete(reviewSources)
      .where(and(eq(reviewSources.id, id), eq(reviewSources.userId, userId)));
  }

  // ===== REVIEW SYNC LOGS =====

  async createSyncLog(log: InsertReviewSyncLog): Promise<ReviewSyncLog> {
    const [created] = await db
      .insert(reviewSyncLogs)
      .values(log)
      .returning();
    return created;
  }

  async updateSyncLog(id: string, updates: Partial<ReviewSyncLog>): Promise<ReviewSyncLog | undefined> {
    const [updated] = await db
      .update(reviewSyncLogs)
      .set(updates)
      .where(eq(reviewSyncLogs.id, id))
      .returning();
    return updated || undefined;
  }

  async getSyncLogs(sourceId: string, limit: number = 10): Promise<ReviewSyncLog[]> {
    return await db
      .select()
      .from(reviewSyncLogs)
      .where(eq(reviewSyncLogs.sourceId, sourceId))
      .orderBy(desc(reviewSyncLogs.startedAt))
      .limit(limit);
  }

  // ===== REVIEWS WITH PLATFORM ID =====

  async getReviewByPlatformId(platformReviewId: string, platform: string): Promise<Review | undefined> {
    const [review] = await db
      .select()
      .from(reviews)
      .where(and(
        eq(reviews.platformReviewId, platformReviewId),
        eq(reviews.platform, platform)
      ));
    return review || undefined;
  }

  async upsertReviewFromPlatform(review: InsertReview): Promise<Review> {
    // Check if review already exists
    if (review.platformReviewId) {
      const existing = await this.getReviewByPlatformId(review.platformReviewId, review.platform);
      if (existing) {
        // Update existing review
        const [updated] = await db
          .update(reviews)
          .set({ ...review, updatedAt: new Date() })
          .where(eq(reviews.id, existing.id))
          .returning();
        return updated;
      }
    }
    
    // Create new review
    const [created] = await db
      .insert(reviews)
      .values(review)
      .returning();
    return created;
  }

  // ===== REVIEW AUTOMATIONS IMPLEMENTATION =====

  async getReviewAutomations(userId: string): Promise<ReviewAutomation[]> {
    return await db
      .select()
      .from(reviewAutomations)
      .where(eq(reviewAutomations.userId, userId))
      .orderBy(desc(reviewAutomations.createdAt));
  }

  async getReviewAutomationById(id: string, userId: string): Promise<ReviewAutomation | undefined> {
    const [automation] = await db
      .select()
      .from(reviewAutomations)
      .where(and(
        eq(reviewAutomations.id, id),
        eq(reviewAutomations.userId, userId)
      ));
    return automation || undefined;
  }

  async createReviewAutomation(automation: InsertReviewAutomation): Promise<ReviewAutomation> {
    const [created] = await db
      .insert(reviewAutomations)
      .values(automation)
      .returning();
    return created;
  }

  async updateReviewAutomation(id: string, userId: string, updates: Partial<InsertReviewAutomation>): Promise<ReviewAutomation | undefined> {
    const [updated] = await db
      .update(reviewAutomations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(reviewAutomations.id, id),
        eq(reviewAutomations.userId, userId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteReviewAutomation(id: string, userId: string): Promise<void> {
    await db
      .delete(reviewAutomations)
      .where(and(
        eq(reviewAutomations.id, id),
        eq(reviewAutomations.userId, userId)
      ));
  }

  async toggleReviewAutomation(id: string, userId: string): Promise<ReviewAutomation | undefined> {
    const automation = await this.getReviewAutomationById(id, userId);
    if (!automation) return undefined;
    
    const [updated] = await db
      .update(reviewAutomations)
      .set({ isActive: !automation.isActive, updatedAt: new Date() })
      .where(and(
        eq(reviewAutomations.id, id),
        eq(reviewAutomations.userId, userId)
      ))
      .returning();
    return updated || undefined;
  }

  // ===== MARKETING MODULE IMPLEMENTATION =====

  // Marketing Contacts
  async getMarketingContacts(userId: string, filters?: {
    search?: string;
    source?: string;
    hasEmail?: boolean;
    hasPhone?: boolean;
    optInEmail?: boolean;
    optInSms?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<MarketingContact[]> {
    const conditions = [eq(marketingContacts.userId, userId)];
    
    if (filters?.search) {
      conditions.push(or(
        ilike(marketingContacts.email, `%${filters.search}%`),
        ilike(marketingContacts.firstName, `%${filters.search}%`),
        ilike(marketingContacts.lastName, `%${filters.search}%`),
        ilike(marketingContacts.phone, `%${filters.search}%`)
      )!);
    }
    if (filters?.source) {
      conditions.push(eq(marketingContacts.source, filters.source));
    }
    if (filters?.hasEmail === true) {
      conditions.push(isNotNull(marketingContacts.email));
    }
    if (filters?.hasPhone === true) {
      conditions.push(isNotNull(marketingContacts.phone));
    }
    if (filters?.optInEmail !== undefined) {
      conditions.push(eq(marketingContacts.optInEmail, filters.optInEmail));
    }
    if (filters?.optInSms !== undefined) {
      conditions.push(eq(marketingContacts.optInSms, filters.optInSms));
    }
    
    let query = db
      .select()
      .from(marketingContacts)
      .where(and(...conditions))
      .orderBy(desc(marketingContacts.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return await query;
  }

  async getMarketingContactById(id: string, userId: string): Promise<MarketingContact | undefined> {
    const [contact] = await db
      .select()
      .from(marketingContacts)
      .where(and(eq(marketingContacts.id, id), eq(marketingContacts.userId, userId)));
    return contact || undefined;
  }

  async getMarketingContactByEmail(userId: string, email: string): Promise<MarketingContact | undefined> {
    const [contact] = await db
      .select()
      .from(marketingContacts)
      .where(and(eq(marketingContacts.userId, userId), eq(marketingContacts.email, email)));
    return contact || undefined;
  }

  async getMarketingContactByPhone(userId: string, phone: string): Promise<MarketingContact | undefined> {
    const [contact] = await db
      .select()
      .from(marketingContacts)
      .where(and(eq(marketingContacts.userId, userId), eq(marketingContacts.phone, phone)));
    return contact || undefined;
  }

  async createMarketingContact(contact: InsertMarketingContact): Promise<MarketingContact> {
    const [created] = await db
      .insert(marketingContacts)
      .values(contact as any)
      .returning();
    return created;
  }

  async updateMarketingContact(id: string, userId: string, updates: Partial<MarketingContact>): Promise<MarketingContact | undefined> {
    const [updated] = await db
      .update(marketingContacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(marketingContacts.id, id), eq(marketingContacts.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteMarketingContact(id: string, userId: string): Promise<void> {
    await db
      .delete(marketingContacts)
      .where(and(eq(marketingContacts.id, id), eq(marketingContacts.userId, userId)));
  }

  async bulkCreateMarketingContacts(contacts: InsertMarketingContact[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    for (const contact of contacts) {
      try {
        // Check for existing contact by email or phone
        let existing: MarketingContact | undefined;
        if (contact.email) {
          existing = await this.getMarketingContactByEmail(contact.userId, contact.email);
        }
        if (!existing && contact.phone) {
          existing = await this.getMarketingContactByPhone(contact.userId, contact.phone);
        }
        
        if (existing) {
          await this.updateMarketingContact(existing.id, contact.userId, contact as Partial<MarketingContact>);
          updated++;
        } else {
          await this.createMarketingContact(contact);
          created++;
        }
      } catch (error) {
        errors++;
      }
    }
    
    return { created, updated, errors };
  }

  async getMarketingContactsCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(marketingContacts)
      .where(eq(marketingContacts.userId, userId));
    return result?.count || 0;
  }

  async getMarketingContactsBySegmentFilters(userId: string, filters: SegmentFilters): Promise<MarketingContact[]> {
    const conditions = [eq(marketingContacts.userId, userId)];
    
    if (filters.visitsMin !== undefined) {
      conditions.push(gte(marketingContacts.totalVisits, filters.visitsMin));
    }
    if (filters.visitsMax !== undefined) {
      conditions.push(lte(marketingContacts.totalVisits, filters.visitsMax));
    }
    if (filters.inactiveDays !== undefined) {
      const inactiveDate = new Date();
      inactiveDate.setDate(inactiveDate.getDate() - filters.inactiveDays);
      conditions.push(or(
        isNull(marketingContacts.lastVisitAt),
        lte(marketingContacts.lastVisitAt, inactiveDate)
      )!);
    }
    if (filters.hasEmail === true) {
      conditions.push(isNotNull(marketingContacts.email));
    }
    if (filters.hasPhone === true) {
      conditions.push(isNotNull(marketingContacts.phone));
    }
    if (filters.source) {
      conditions.push(eq(marketingContacts.source, filters.source));
    }
    if (filters.birthdayMonth !== undefined) {
      conditions.push(sql`EXTRACT(MONTH FROM ${marketingContacts.birthDate}) = ${filters.birthdayMonth}`);
    }
    if (filters.createdAfter) {
      conditions.push(gte(marketingContacts.createdAt, new Date(filters.createdAfter)));
    }
    if (filters.createdBefore) {
      conditions.push(lte(marketingContacts.createdAt, new Date(filters.createdBefore)));
    }
    
    return await db
      .select()
      .from(marketingContacts)
      .where(and(...conditions))
      .orderBy(desc(marketingContacts.createdAt));
  }

  async incrementContactEmailStats(contactId: string, stat: 'sent' | 'opened' | 'clicked'): Promise<void> {
    const updates: any = { updatedAt: new Date() };
    if (stat === 'sent') {
      updates.totalEmailsSent = sql`${marketingContacts.totalEmailsSent} + 1`;
      updates.lastEmailSentAt = new Date();
    } else if (stat === 'opened') {
      updates.totalEmailsOpened = sql`${marketingContacts.totalEmailsOpened} + 1`;
    } else if (stat === 'clicked') {
      updates.totalEmailsClicked = sql`${marketingContacts.totalEmailsClicked} + 1`;
    }
    await db.update(marketingContacts).set(updates).where(eq(marketingContacts.id, contactId));
  }

  async incrementContactSmsStats(contactId: string): Promise<void> {
    await db
      .update(marketingContacts)
      .set({
        totalSmsSent: sql`${marketingContacts.totalSmsSent} + 1`,
        lastSmsSentAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(marketingContacts.id, contactId));
  }

  // Marketing Consent History
  async createConsentHistory(contactId: string, action: string, channel: string, source: string, ipAddress?: string, userAgent?: string): Promise<MarketingConsentHistory> {
    const [created] = await db
      .insert(marketingConsentHistory)
      .values({ contactId, action, channel, source, ipAddress, userAgent })
      .returning();
    return created;
  }

  async getConsentHistory(contactId: string): Promise<MarketingConsentHistory[]> {
    return await db
      .select()
      .from(marketingConsentHistory)
      .where(eq(marketingConsentHistory.contactId, contactId))
      .orderBy(desc(marketingConsentHistory.createdAt));
  }

  // Marketing Segments
  async getMarketingSegments(userId: string): Promise<MarketingSegment[]> {
    return await db
      .select()
      .from(marketingSegments)
      .where(eq(marketingSegments.userId, userId))
      .orderBy(desc(marketingSegments.createdAt));
  }

  async getMarketingSegmentById(id: string, userId: string): Promise<MarketingSegment | undefined> {
    const [segment] = await db
      .select()
      .from(marketingSegments)
      .where(and(eq(marketingSegments.id, id), eq(marketingSegments.userId, userId)));
    return segment || undefined;
  }

  async createMarketingSegment(segment: InsertMarketingSegment): Promise<MarketingSegment> {
    const [created] = await db
      .insert(marketingSegments)
      .values(segment as any)
      .returning();
    return created;
  }

  async updateMarketingSegment(id: string, userId: string, updates: Partial<MarketingSegment>): Promise<MarketingSegment | undefined> {
    const [updated] = await db
      .update(marketingSegments)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(marketingSegments.id, id), eq(marketingSegments.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteMarketingSegment(id: string, userId: string): Promise<void> {
    await db
      .delete(marketingSegments)
      .where(and(eq(marketingSegments.id, id), eq(marketingSegments.userId, userId)));
  }

  async updateSegmentContactCount(id: string, count: number): Promise<void> {
    await db
      .update(marketingSegments)
      .set({ contactCount: count, lastCalculatedAt: new Date() })
      .where(eq(marketingSegments.id, id));
  }

  // Marketing Templates
  async getMarketingTemplates(userId: string, filters?: {
    category?: string;
    channel?: string;
    businessType?: string;
    includeSystem?: boolean;
  }): Promise<MarketingTemplate[]> {
    const conditions = [];
    
    if (filters?.includeSystem) {
      conditions.push(or(
        eq(marketingTemplates.userId, userId),
        eq(marketingTemplates.isSystem, true)
      )!);
    } else {
      conditions.push(eq(marketingTemplates.userId, userId));
    }
    
    if (filters?.category) {
      conditions.push(eq(marketingTemplates.category, filters.category));
    }
    if (filters?.channel) {
      conditions.push(eq(marketingTemplates.channel, filters.channel));
    }
    if (filters?.businessType) {
      conditions.push(or(
        eq(marketingTemplates.businessType, filters.businessType),
        eq(marketingTemplates.businessType, 'all')
      )!);
    }
    
    return await db
      .select()
      .from(marketingTemplates)
      .where(and(...conditions))
      .orderBy(desc(marketingTemplates.createdAt));
  }

  async getMarketingTemplateById(id: string, userId: string): Promise<MarketingTemplate | undefined> {
    const [template] = await db
      .select()
      .from(marketingTemplates)
      .where(and(
        eq(marketingTemplates.id, id),
        or(eq(marketingTemplates.userId, userId), eq(marketingTemplates.isSystem, true))!
      ));
    return template || undefined;
  }

  async createMarketingTemplate(template: InsertMarketingTemplate): Promise<MarketingTemplate> {
    const [created] = await db
      .insert(marketingTemplates)
      .values(template as any)
      .returning();
    return created;
  }

  async updateMarketingTemplate(id: string, userId: string, updates: Partial<MarketingTemplate>): Promise<MarketingTemplate | undefined> {
    const [updated] = await db
      .update(marketingTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(marketingTemplates.id, id), eq(marketingTemplates.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteMarketingTemplate(id: string, userId: string): Promise<void> {
    await db
      .delete(marketingTemplates)
      .where(and(eq(marketingTemplates.id, id), eq(marketingTemplates.userId, userId)));
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db
      .update(marketingTemplates)
      .set({ timesUsed: sql`${marketingTemplates.timesUsed} + 1` })
      .where(eq(marketingTemplates.id, id));
  }

  async getSystemTemplates(filters?: { category?: string; channel?: string; businessType?: string }): Promise<MarketingTemplate[]> {
    const conditions = [eq(marketingTemplates.isSystem, true), eq(marketingTemplates.isActive, true)];
    
    if (filters?.category) {
      conditions.push(eq(marketingTemplates.category, filters.category));
    }
    if (filters?.channel) {
      conditions.push(eq(marketingTemplates.channel, filters.channel));
    }
    if (filters?.businessType) {
      conditions.push(or(
        eq(marketingTemplates.businessType, filters.businessType),
        eq(marketingTemplates.businessType, 'all'),
        isNull(marketingTemplates.businessType)
      )!);
    }
    
    return await db
      .select()
      .from(marketingTemplates)
      .where(and(...conditions))
      .orderBy(asc(marketingTemplates.category), asc(marketingTemplates.name));
  }

  // Marketing Campaigns
  async getMarketingCampaigns(userId: string, filters?: {
    status?: string;
    type?: string;
    channel?: string;
    limit?: number;
    offset?: number;
  }): Promise<MarketingCampaign[]> {
    const conditions = [eq(marketingCampaigns.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(marketingCampaigns.status, filters.status));
    }
    if (filters?.type) {
      conditions.push(eq(marketingCampaigns.type, filters.type));
    }
    if (filters?.channel) {
      conditions.push(eq(marketingCampaigns.channel, filters.channel));
    }
    
    let query = db
      .select()
      .from(marketingCampaigns)
      .where(and(...conditions))
      .orderBy(desc(marketingCampaigns.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return await query;
  }

  async getMarketingCampaignById(id: string, userId: string): Promise<MarketingCampaign | undefined> {
    const [campaign] = await db
      .select()
      .from(marketingCampaigns)
      .where(and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.userId, userId)));
    return campaign || undefined;
  }

  async createMarketingCampaign(campaign: InsertMarketingCampaign): Promise<MarketingCampaign> {
    const [created] = await db
      .insert(marketingCampaigns)
      .values(campaign as any)
      .returning();
    return created;
  }

  async updateMarketingCampaign(id: string, userId: string, updates: Partial<MarketingCampaign>): Promise<MarketingCampaign | undefined> {
    const [updated] = await db
      .update(marketingCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteMarketingCampaign(id: string, userId: string): Promise<void> {
    await db
      .delete(marketingCampaigns)
      .where(and(eq(marketingCampaigns.id, id), eq(marketingCampaigns.userId, userId)));
  }

  async getScheduledCampaigns(): Promise<MarketingCampaign[]> {
    const now = new Date();
    return await db
      .select()
      .from(marketingCampaigns)
      .where(and(
        eq(marketingCampaigns.status, 'scheduled'),
        lte(marketingCampaigns.scheduledAt, now)
      ))
      .orderBy(asc(marketingCampaigns.scheduledAt));
  }

  async updateCampaignStats(id: string, stats: Partial<{
    totalRecipients: number;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalConverted: number;
    totalUnsubscribed: number;
    totalBounced: number;
    totalFailed: number;
    totalRevenue: string;
    emailCost: string;
    smsCost: string;
  }>): Promise<void> {
    await db
      .update(marketingCampaigns)
      .set({ ...stats, updatedAt: new Date() })
      .where(eq(marketingCampaigns.id, id));
  }

  // Marketing Sends
  async createMarketingSend(send: Partial<MarketingSend> & { campaignId: string; contactId: string; channel: string }): Promise<MarketingSend> {
    const [created] = await db
      .insert(marketingSends)
      .values(send as any)
      .returning();
    return created;
  }

  async getMarketingSendByTrackingId(trackingId: string): Promise<MarketingSend | undefined> {
    const [send] = await db
      .select()
      .from(marketingSends)
      .where(eq(marketingSends.trackingId, trackingId));
    return send || undefined;
  }

  async updateMarketingSend(id: string, updates: Partial<MarketingSend>): Promise<MarketingSend | undefined> {
    const [updated] = await db
      .update(marketingSends)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketingSends.id, id))
      .returning();
    return updated || undefined;
  }

  async getMarketingSendsByCampaign(campaignId: string): Promise<MarketingSend[]> {
    return await db
      .select()
      .from(marketingSends)
      .where(eq(marketingSends.campaignId, campaignId))
      .orderBy(desc(marketingSends.createdAt));
  }

  async getCampaignSendStats(campaignId: string): Promise<{
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
    unsubscribed: number;
  }> {
    const sends = await this.getMarketingSendsByCampaign(campaignId);
    return {
      total: sends.length,
      sent: sends.filter(s => s.sentAt).length,
      delivered: sends.filter(s => s.deliveredAt).length,
      opened: sends.filter(s => s.openedAt).length,
      clicked: sends.filter(s => s.clickedAt).length,
      bounced: sends.filter(s => s.bouncedAt).length,
      failed: sends.filter(s => s.failedAt).length,
      unsubscribed: sends.filter(s => s.unsubscribedAt).length
    };
  }

  // Marketing Click Events
  async createClickEvent(sendId: string, url: string, ipAddress?: string, userAgent?: string, device?: string, browser?: string, os?: string): Promise<MarketingClickEvent> {
    const [created] = await db
      .insert(marketingClickEvents)
      .values({ sendId, url, ipAddress, userAgent, device, browser, os })
      .returning();
    return created;
  }

  async getClickEventsBySend(sendId: string): Promise<MarketingClickEvent[]> {
    return await db
      .select()
      .from(marketingClickEvents)
      .where(eq(marketingClickEvents.sendId, sendId))
      .orderBy(desc(marketingClickEvents.clickedAt));
  }

  // Marketing Automations
  async getMarketingAutomations(userId: string): Promise<MarketingAutomation[]> {
    return await db
      .select()
      .from(marketingAutomations)
      .where(eq(marketingAutomations.userId, userId))
      .orderBy(desc(marketingAutomations.createdAt));
  }

  async getMarketingAutomationById(id: string, userId: string): Promise<MarketingAutomation | undefined> {
    const [automation] = await db
      .select()
      .from(marketingAutomations)
      .where(and(eq(marketingAutomations.id, id), eq(marketingAutomations.userId, userId)));
    return automation || undefined;
  }

  async createMarketingAutomation(automation: InsertMarketingAutomation): Promise<MarketingAutomation> {
    const [created] = await db
      .insert(marketingAutomations)
      .values(automation as any)
      .returning();
    return created;
  }

  async updateMarketingAutomation(id: string, userId: string, updates: Partial<MarketingAutomation>): Promise<MarketingAutomation | undefined> {
    const [updated] = await db
      .update(marketingAutomations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(marketingAutomations.id, id), eq(marketingAutomations.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async deleteMarketingAutomation(id: string, userId: string): Promise<void> {
    await db
      .delete(marketingAutomations)
      .where(and(eq(marketingAutomations.id, id), eq(marketingAutomations.userId, userId)));
  }

  async getActiveAutomationsByTrigger(triggerType: string): Promise<MarketingAutomation[]> {
    return await db
      .select()
      .from(marketingAutomations)
      .where(and(
        eq(marketingAutomations.isActive, true),
        eq(marketingAutomations.triggerType, triggerType)
      ));
  }

  async incrementAutomationStats(id: string, stat: 'triggered' | 'completed' | 'failed'): Promise<void> {
    const updates: any = { updatedAt: new Date() };
    if (stat === 'triggered') {
      updates.totalTriggered = sql`${marketingAutomations.totalTriggered} + 1`;
      updates.lastTriggeredAt = new Date();
    } else if (stat === 'completed') {
      updates.totalCompleted = sql`${marketingAutomations.totalCompleted} + 1`;
    } else if (stat === 'failed') {
      updates.totalFailed = sql`${marketingAutomations.totalFailed} + 1`;
    }
    await db.update(marketingAutomations).set(updates).where(eq(marketingAutomations.id, id));
  }

  // Marketing Automation Logs
  async createAutomationLog(log: Partial<MarketingAutomationLog> & { automationId: string; contactId: string; status: string }): Promise<MarketingAutomationLog> {
    const [created] = await db
      .insert(marketingAutomationLogs)
      .values(log as any)
      .returning();
    return created;
  }

  async updateAutomationLog(id: string, updates: Partial<MarketingAutomationLog>): Promise<MarketingAutomationLog | undefined> {
    const [updated] = await db
      .update(marketingAutomationLogs)
      .set(updates)
      .where(eq(marketingAutomationLogs.id, id))
      .returning();
    return updated || undefined;
  }

  async getPendingAutomationLogs(): Promise<MarketingAutomationLog[]> {
    const now = new Date();
    return await db
      .select()
      .from(marketingAutomationLogs)
      .where(and(
        eq(marketingAutomationLogs.status, 'running'),
        or(
          isNull(marketingAutomationLogs.nextStepAt),
          lte(marketingAutomationLogs.nextStepAt, now)
        )!
      ))
      .orderBy(asc(marketingAutomationLogs.triggeredAt));
  }

  async getAutomationLogsByContact(contactId: string): Promise<MarketingAutomationLog[]> {
    return await db
      .select()
      .from(marketingAutomationLogs)
      .where(eq(marketingAutomationLogs.contactId, contactId))
      .orderBy(desc(marketingAutomationLogs.triggeredAt));
  }

  // Marketing Analytics
  async getMarketingOverviewStats(userId: string, period?: 'week' | 'month' | 'year'): Promise<{
    totalContacts: number;
    newContactsPeriod: number;
    totalCampaigns: number;
    campaignsSentPeriod: number;
    totalEmailsSent: number;
    avgOpenRate: number;
    avgClickRate: number;
    totalRevenue: number;
    costPerConversion: number;
  }> {
    const periodStart = new Date();
    if (period === 'week') {
      periodStart.setDate(periodStart.getDate() - 7);
    } else if (period === 'month') {
      periodStart.setMonth(periodStart.getMonth() - 1);
    } else {
      periodStart.setFullYear(periodStart.getFullYear() - 1);
    }
    
    // Total contacts
    const [contactsResult] = await db
      .select({ count: count() })
      .from(marketingContacts)
      .where(eq(marketingContacts.userId, userId));
    
    // New contacts in period
    const [newContactsResult] = await db
      .select({ count: count() })
      .from(marketingContacts)
      .where(and(
        eq(marketingContacts.userId, userId),
        gte(marketingContacts.createdAt, periodStart)
      ));
    
    // Total campaigns
    const [campaignsResult] = await db
      .select({ count: count() })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.userId, userId));
    
    // Campaigns sent in period
    const [sentCampaignsResult] = await db
      .select({ count: count() })
      .from(marketingCampaigns)
      .where(and(
        eq(marketingCampaigns.userId, userId),
        eq(marketingCampaigns.status, 'sent'),
        gte(marketingCampaigns.sentAt, periodStart)
      ));
    
    // Aggregate campaign stats
    const campaigns = await db
      .select()
      .from(marketingCampaigns)
      .where(and(
        eq(marketingCampaigns.userId, userId),
        eq(marketingCampaigns.status, 'sent')
      ));
    
    const totalEmailsSent = campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + (c.totalOpened || 0), 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + (c.totalClicked || 0), 0);
    const totalConverted = campaigns.reduce((sum, c) => sum + (c.totalConverted || 0), 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + parseFloat(c.totalRevenue || '0'), 0);
    const totalCost = campaigns.reduce((sum, c) => sum + parseFloat(c.emailCost || '0') + parseFloat(c.smsCost || '0'), 0);
    
    return {
      totalContacts: contactsResult?.count || 0,
      newContactsPeriod: newContactsResult?.count || 0,
      totalCampaigns: campaignsResult?.count || 0,
      campaignsSentPeriod: sentCampaignsResult?.count || 0,
      totalEmailsSent,
      avgOpenRate: totalEmailsSent > 0 ? (totalOpened / totalEmailsSent) * 100 : 0,
      avgClickRate: totalEmailsSent > 0 ? (totalClicked / totalEmailsSent) * 100 : 0,
      totalRevenue,
      costPerConversion: totalConverted > 0 ? totalCost / totalConverted : 0
    };
  }

  async getCampaignPerformanceChart(userId: string, period?: 'week' | 'month' | 'year'): Promise<Array<{
    date: string;
    emailsSent: number;
    opened: number;
    clicked: number;
    conversions: number;
  }>> {
    const periodStart = new Date();
    if (period === 'week') {
      periodStart.setDate(periodStart.getDate() - 7);
    } else if (period === 'month') {
      periodStart.setMonth(periodStart.getMonth() - 1);
    } else {
      periodStart.setFullYear(periodStart.getFullYear() - 1);
    }
    
    const campaigns = await db
      .select()
      .from(marketingCampaigns)
      .where(and(
        eq(marketingCampaigns.userId, userId),
        eq(marketingCampaigns.status, 'sent'),
        gte(marketingCampaigns.sentAt, periodStart)
      ))
      .orderBy(asc(marketingCampaigns.sentAt));
    
    // Group by date
    const dateMap = new Map<string, { emailsSent: number; opened: number; clicked: number; conversions: number }>();
    
    for (const campaign of campaigns) {
      if (!campaign.sentAt) continue;
      const dateKey = campaign.sentAt.toISOString().split('T')[0];
      const existing = dateMap.get(dateKey) || { emailsSent: 0, opened: 0, clicked: 0, conversions: 0 };
      dateMap.set(dateKey, {
        emailsSent: existing.emailsSent + (campaign.totalSent || 0),
        opened: existing.opened + (campaign.totalOpened || 0),
        clicked: existing.clicked + (campaign.totalClicked || 0),
        conversions: existing.conversions + (campaign.totalConverted || 0)
      });
    }
    
    return Array.from(dateMap.entries()).map(([date, stats]) => ({
      date,
      ...stats
    }));
  }

  // ===== EXTERNAL INTEGRATIONS SYSTEM IMPLEMENTATION =====

  // External Connections
  async getExternalConnections(userId: string): Promise<ExternalConnection[]> {
    return db.select().from(externalConnections)
      .where(eq(externalConnections.userId, userId))
      .orderBy(desc(externalConnections.createdAt));
  }

  async getExternalConnectionById(id: string, userId: string): Promise<ExternalConnection | undefined> {
    const [connection] = await db.select().from(externalConnections)
      .where(and(eq(externalConnections.id, id), eq(externalConnections.userId, userId)));
    return connection || undefined;
  }

  async getExternalConnectionByProvider(userId: string, provider: string): Promise<ExternalConnection | undefined> {
    const [connection] = await db.select().from(externalConnections)
      .where(and(eq(externalConnections.userId, userId), eq(externalConnections.provider, provider)));
    return connection || undefined;
  }

  async createExternalConnection(connection: Partial<ExternalConnection> & { userId: string; provider: string; name: string; authType: string }): Promise<ExternalConnection> {
    // SECURITY: Encrypt all credential fields before storing
    const encryptedCreds = encryptCredentials({
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      apiKey: connection.apiKey,
      apiSecret: connection.apiSecret,
      dbPassword: connection.dbPassword,
      webhookSecret: connection.webhookSecret,
    });
    
    const [created] = await db.insert(externalConnections).values({
      ...connection,
      ...encryptedCreds,
    }).returning();
    return created;
  }

  async updateExternalConnection(id: string, userId: string, updates: Partial<ExternalConnection>): Promise<ExternalConnection | undefined> {
    // SECURITY: Encrypt credential fields if present in updates
    const encryptedCreds = encryptCredentials({
      accessToken: updates.accessToken,
      refreshToken: updates.refreshToken,
      apiKey: updates.apiKey,
      apiSecret: updates.apiSecret,
      dbPassword: updates.dbPassword,
      webhookSecret: updates.webhookSecret,
    });
    
    // Only include encrypted values for fields that were actually updated
    const secureUpdates: Partial<ExternalConnection> = { ...updates };
    if (updates.accessToken !== undefined) secureUpdates.accessToken = encryptedCreds.accessToken;
    if (updates.refreshToken !== undefined) secureUpdates.refreshToken = encryptedCreds.refreshToken;
    if (updates.apiKey !== undefined) secureUpdates.apiKey = encryptedCreds.apiKey;
    if (updates.apiSecret !== undefined) secureUpdates.apiSecret = encryptedCreds.apiSecret;
    if (updates.dbPassword !== undefined) secureUpdates.dbPassword = encryptedCreds.dbPassword;
    if (updates.webhookSecret !== undefined) secureUpdates.webhookSecret = encryptedCreds.webhookSecret;
    
    const [updated] = await db.update(externalConnections)
      .set({ ...secureUpdates, updatedAt: new Date() })
      .where(and(eq(externalConnections.id, id), eq(externalConnections.userId, userId)))
      .returning();
    return updated || undefined;
  }
  
  // Get decrypted connection credentials for sync jobs (internal use only)
  async getExternalConnectionWithCredentials(id: string, userId: string): Promise<ExternalConnection | undefined> {
    const connections = await db.select().from(externalConnections)
      .where(and(eq(externalConnections.id, id), eq(externalConnections.userId, userId)))
      .limit(1);
    
    if (connections.length === 0) return undefined;
    
    const connection = connections[0];
    const decryptedCreds = decryptCredentials({
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      apiKey: connection.apiKey,
      apiSecret: connection.apiSecret,
      dbPassword: connection.dbPassword,
      webhookSecret: connection.webhookSecret,
    });
    
    return {
      ...connection,
      ...decryptedCreds,
    };
  }

  async deleteExternalConnection(id: string, userId: string): Promise<void> {
    await db.delete(externalConnections)
      .where(and(eq(externalConnections.id, id), eq(externalConnections.userId, userId)));
  }

  async getActiveConnections(userId: string): Promise<ExternalConnection[]> {
    return db.select().from(externalConnections)
      .where(and(
        eq(externalConnections.userId, userId),
        eq(externalConnections.status, 'active'),
        eq(externalConnections.syncEnabled, true)
      ))
      .orderBy(desc(externalConnections.lastSyncAt));
  }
  
  async getAllActiveConnections(): Promise<ExternalConnection[]> {
    return db.select().from(externalConnections)
      .where(and(
        eq(externalConnections.status, 'active'),
        eq(externalConnections.syncEnabled, true)
      ))
      .orderBy(desc(externalConnections.lastSyncAt));
  }

  // External Sync Jobs
  async createSyncJob(job: Partial<ExternalSyncJob> & { connectionId: string; userId: string; jobType: string }): Promise<ExternalSyncJob> {
    const [created] = await db.insert(externalSyncJobs).values(job).returning();
    return created;
  }

  async updateSyncJob(id: string, updates: Partial<ExternalSyncJob>): Promise<ExternalSyncJob | undefined> {
    const [updated] = await db.update(externalSyncJobs)
      .set(updates)
      .where(eq(externalSyncJobs.id, id))
      .returning();
    return updated || undefined;
  }

  async getSyncJobsByConnection(connectionId: string, limit: number = 10): Promise<ExternalSyncJob[]> {
    return db.select().from(externalSyncJobs)
      .where(eq(externalSyncJobs.connectionId, connectionId))
      .orderBy(desc(externalSyncJobs.createdAt))
      .limit(limit);
  }

  async getLatestSyncJob(connectionId: string): Promise<ExternalSyncJob | undefined> {
    const [job] = await db.select().from(externalSyncJobs)
      .where(eq(externalSyncJobs.connectionId, connectionId))
      .orderBy(desc(externalSyncJobs.createdAt))
      .limit(1);
    return job || undefined;
  }

  async getPendingSyncJobs(): Promise<ExternalSyncJob[]> {
    return db.select().from(externalSyncJobs)
      .where(eq(externalSyncJobs.status, 'pending'))
      .orderBy(asc(externalSyncJobs.createdAt));
  }

  // External Field Mappings
  async getFieldMappings(connectionId: string): Promise<ExternalFieldMapping[]> {
    return db.select().from(externalFieldMappings)
      .where(eq(externalFieldMappings.connectionId, connectionId));
  }

  async getFieldMappingByEntity(connectionId: string, entityType: string): Promise<ExternalFieldMapping | undefined> {
    const [mapping] = await db.select().from(externalFieldMappings)
      .where(and(
        eq(externalFieldMappings.connectionId, connectionId),
        eq(externalFieldMappings.entityType, entityType)
      ));
    return mapping || undefined;
  }

  async upsertFieldMapping(connectionId: string, entityType: string, mappings: object, customFields?: object): Promise<ExternalFieldMapping> {
    const existing = await this.getFieldMappingByEntity(connectionId, entityType);
    if (existing) {
      const [updated] = await db.update(externalFieldMappings)
        .set({ mappings, customFields, updatedAt: new Date() })
        .where(eq(externalFieldMappings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(externalFieldMappings)
      .values({ connectionId, entityType, mappings, customFields })
      .returning();
    return created;
  }

  async deleteFieldMapping(id: string): Promise<void> {
    await db.delete(externalFieldMappings).where(eq(externalFieldMappings.id, id));
  }

  // External Customers
  async getExternalCustomers(userId: string, filters?: {
    search?: string;
    source?: string;
    segment?: string;
    minSpent?: number;
    maxSpent?: number;
    limit?: number;
    offset?: number;
  }): Promise<ExternalCustomer[]> {
    const conditions = [eq(externalCustomers.userId, userId)];
    
    if (filters?.search) {
      conditions.push(or(
        ilike(externalCustomers.email, `%${filters.search}%`),
        ilike(externalCustomers.firstName, `%${filters.search}%`),
        ilike(externalCustomers.lastName, `%${filters.search}%`),
        ilike(externalCustomers.phone, `%${filters.search}%`),
        ilike(externalCustomers.companyName, `%${filters.search}%`)
      )!);
    }
    if (filters?.source) {
      conditions.push(eq(externalCustomers.externalSource, filters.source));
    }
    if (filters?.segment) {
      conditions.push(eq(externalCustomers.customerSegment, filters.segment));
    }
    if (filters?.minSpent !== undefined) {
      conditions.push(gte(externalCustomers.totalSpent, String(filters.minSpent)));
    }
    if (filters?.maxSpent !== undefined) {
      conditions.push(lte(externalCustomers.totalSpent, String(filters.maxSpent)));
    }
    
    let query = db.select().from(externalCustomers)
      .where(and(...conditions))
      .orderBy(desc(externalCustomers.totalSpent));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return query;
  }

  async getExternalCustomerById(id: string, userId: string): Promise<ExternalCustomer | undefined> {
    const [customer] = await db.select().from(externalCustomers)
      .where(and(eq(externalCustomers.id, id), eq(externalCustomers.userId, userId)));
    return customer || undefined;
  }

  async getExternalCustomerByExternalId(userId: string, externalId: string, source: string): Promise<ExternalCustomer | undefined> {
    const [customer] = await db.select().from(externalCustomers)
      .where(and(
        eq(externalCustomers.userId, userId),
        eq(externalCustomers.externalId, externalId),
        eq(externalCustomers.externalSource, source)
      ));
    return customer || undefined;
  }

  async createExternalCustomer(customer: Partial<ExternalCustomer> & { userId: string }): Promise<ExternalCustomer> {
    const [created] = await db.insert(externalCustomers).values(customer).returning();
    return created;
  }

  async updateExternalCustomer(id: string, userId: string, updates: Partial<ExternalCustomer>): Promise<ExternalCustomer | undefined> {
    const [updated] = await db.update(externalCustomers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(externalCustomers.id, id), eq(externalCustomers.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async upsertExternalCustomer(userId: string, externalId: string, source: string, data: Partial<ExternalCustomer>): Promise<ExternalCustomer> {
    const existing = await this.getExternalCustomerByExternalId(userId, externalId, source);
    if (existing) {
      const updated = await this.updateExternalCustomer(existing.id, userId, data);
      return updated!;
    }
    return this.createExternalCustomer({ ...data, userId, externalId, externalSource: source });
  }

  async deleteExternalCustomer(id: string, userId: string): Promise<void> {
    await db.delete(externalCustomers)
      .where(and(eq(externalCustomers.id, id), eq(externalCustomers.userId, userId)));
  }

  async getExternalCustomersCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(externalCustomers)
      .where(eq(externalCustomers.userId, userId));
    return result?.count || 0;
  }

  async findEmailByPhone(phone: string, userId?: string): Promise<{ email: string; source: string; name?: string } | null> {
    const normalizedPhone = phone.replace(/\s+/g, '').replace(/^0/, '+33');
    const phoneVariants = [
      phone,
      normalizedPhone,
      phone.replace(/\s+/g, ''),
      phone.replace(/^\+33/, '0'),
    ];
    
    for (const phoneVariant of phoneVariants) {
      const conditions = userId 
        ? and(eq(externalCustomers.userId, userId), eq(externalCustomers.phone, phoneVariant))
        : eq(externalCustomers.phone, phoneVariant);
      
      const [customer] = await db.select().from(externalCustomers)
        .where(conditions)
        .limit(1);
      
      if (customer?.email) {
        return {
          email: customer.email,
          source: 'external_customers',
          name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || undefined,
        };
      }
    }
    
    for (const phoneVariant of phoneVariants) {
      const conditions = userId 
        ? and(eq(marketingContacts.userId, userId), eq(marketingContacts.phone, phoneVariant))
        : eq(marketingContacts.phone, phoneVariant);
      
      const [contact] = await db.select().from(marketingContacts)
        .where(conditions)
        .limit(1);
      
      if (contact?.email) {
        return {
          email: contact.email,
          source: 'marketing_contacts',
          name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || undefined,
        };
      }
    }
    
    return null;
  }

  async recalculateCustomerStats(customerId: string): Promise<void> {
    const orders = await db.select().from(externalOrders)
      .where(eq(externalOrders.customerId, customerId));
    
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0);
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastOrderAt = orders.length > 0 ? orders.sort((a, b) => 
      new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    )[0].orderDate : null;
    const firstOrderAt = orders.length > 0 ? orders.sort((a, b) => 
      new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
    )[0].orderDate : null;
    
    // Determine customer segment based on spending
    let customerSegment = 'new';
    if (totalOrders === 0) customerSegment = 'new';
    else if (totalSpent > 1000) customerSegment = 'vip';
    else if (totalOrders > 5) customerSegment = 'regular';
    else if (lastOrderAt && new Date(lastOrderAt) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) {
      customerSegment = 'at_risk';
    }
    
    await db.update(externalCustomers)
      .set({
        totalOrders,
        totalSpent: String(totalSpent),
        avgOrderValue: String(avgOrderValue),
        lastOrderAt,
        firstOrderAt,
        lifetimeValue: String(totalSpent),
        customerSegment,
        updatedAt: new Date()
      })
      .where(eq(externalCustomers.id, customerId));
  }

  async getTopCustomers(userId: string, limit: number = 10): Promise<ExternalCustomer[]> {
    return db.select().from(externalCustomers)
      .where(eq(externalCustomers.userId, userId))
      .orderBy(desc(externalCustomers.totalSpent))
      .limit(limit);
  }

  // External Orders
  async getExternalOrders(userId: string, filters?: {
    customerId?: string;
    source?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }): Promise<ExternalOrder[]> {
    const conditions = [eq(externalOrders.userId, userId)];
    
    if (filters?.customerId) {
      conditions.push(eq(externalOrders.customerId, filters.customerId));
    }
    if (filters?.source) {
      conditions.push(eq(externalOrders.externalSource, filters.source));
    }
    if (filters?.status) {
      conditions.push(eq(externalOrders.status, filters.status));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(externalOrders.orderDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(externalOrders.orderDate, filters.dateTo));
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(gte(externalOrders.totalAmount, String(filters.minAmount)));
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(lte(externalOrders.totalAmount, String(filters.maxAmount)));
    }
    
    let query = db.select().from(externalOrders)
      .where(and(...conditions))
      .orderBy(desc(externalOrders.orderDate));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return query;
  }

  async getExternalOrderById(id: string, userId: string): Promise<ExternalOrder | undefined> {
    const [order] = await db.select().from(externalOrders)
      .where(and(eq(externalOrders.id, id), eq(externalOrders.userId, userId)));
    return order || undefined;
  }

  async getExternalOrderByExternalId(userId: string, externalId: string, source: string): Promise<ExternalOrder | undefined> {
    const [order] = await db.select().from(externalOrders)
      .where(and(
        eq(externalOrders.userId, userId),
        eq(externalOrders.externalId, externalId),
        eq(externalOrders.externalSource, source)
      ));
    return order || undefined;
  }

  async createExternalOrder(order: Partial<ExternalOrder> & { userId: string; externalId: string; externalSource: string; totalAmount: string; orderDate: Date }): Promise<ExternalOrder> {
    const [created] = await db.insert(externalOrders).values(order).returning();
    
    // Update customer stats if linked
    if (created.customerId) {
      await this.recalculateCustomerStats(created.customerId);
    }
    
    return created;
  }

  async updateExternalOrder(id: string, userId: string, updates: Partial<ExternalOrder>): Promise<ExternalOrder | undefined> {
    const [updated] = await db.update(externalOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(externalOrders.id, id), eq(externalOrders.userId, userId)))
      .returning();
    
    // Recalculate customer stats if linked
    if (updated?.customerId) {
      await this.recalculateCustomerStats(updated.customerId);
    }
    
    return updated || undefined;
  }

  async upsertExternalOrder(userId: string, externalId: string, source: string, data: Partial<ExternalOrder>): Promise<ExternalOrder> {
    const existing = await this.getExternalOrderByExternalId(userId, externalId, source);
    if (existing) {
      const updated = await this.updateExternalOrder(existing.id, userId, data);
      return updated!;
    }
    return this.createExternalOrder({ 
      ...data, 
      userId, 
      externalId, 
      externalSource: source,
      totalAmount: data.totalAmount || '0',
      orderDate: data.orderDate || new Date()
    });
  }

  async deleteExternalOrder(id: string, userId: string): Promise<void> {
    const order = await this.getExternalOrderById(id, userId);
    await db.delete(externalOrders)
      .where(and(eq(externalOrders.id, id), eq(externalOrders.userId, userId)));
    
    // Recalculate customer stats if linked
    if (order?.customerId) {
      await this.recalculateCustomerStats(order.customerId);
    }
  }

  async getOrderStats(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    ordersByStatus: Record<string, number>;
    ordersByChannel: Record<string, number>;
    revenueBySource: Record<string, number>;
  }> {
    let dateFilter: Date | undefined;
    if (period === 'week') {
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === 'year') {
      dateFilter = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    }
    
    const conditions = [eq(externalOrders.userId, userId)];
    if (dateFilter) {
      conditions.push(gte(externalOrders.orderDate, dateFilter));
    }
    
    const orders = await db.select().from(externalOrders).where(and(...conditions));
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const ordersByStatus: Record<string, number> = {};
    const ordersByChannel: Record<string, number> = {};
    const revenueBySource: Record<string, number> = {};
    
    for (const order of orders) {
      const status = order.status || 'unknown';
      const channel = order.channel || 'unknown';
      const source = order.externalSource;
      
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
      ordersByChannel[channel] = (ordersByChannel[channel] || 0) + 1;
      revenueBySource[source] = (revenueBySource[source] || 0) + parseFloat(order.totalAmount || '0');
    }
    
    return { totalOrders, totalRevenue, avgOrderValue, ordersByStatus, ordersByChannel, revenueBySource };
  }

  async getCustomerOrders(customerId: string): Promise<ExternalOrder[]> {
    return db.select().from(externalOrders)
      .where(eq(externalOrders.customerId, customerId))
      .orderBy(desc(externalOrders.orderDate));
  }

  // External Transactions
  async getExternalTransactions(userId: string, filters?: {
    customerId?: string;
    orderId?: string;
    source?: string;
    transactionType?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ExternalTransaction[]> {
    const conditions = [eq(externalTransactions.userId, userId)];
    
    if (filters?.customerId) {
      conditions.push(eq(externalTransactions.customerId, filters.customerId));
    }
    if (filters?.orderId) {
      conditions.push(eq(externalTransactions.orderId, filters.orderId));
    }
    if (filters?.source) {
      conditions.push(eq(externalTransactions.externalSource, filters.source));
    }
    if (filters?.transactionType) {
      conditions.push(eq(externalTransactions.transactionType, filters.transactionType));
    }
    if (filters?.status) {
      conditions.push(eq(externalTransactions.status, filters.status));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(externalTransactions.transactionDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(externalTransactions.transactionDate, filters.dateTo));
    }
    
    let query = db.select().from(externalTransactions)
      .where(and(...conditions))
      .orderBy(desc(externalTransactions.transactionDate));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return await query;
  }

  async getExternalTransactionById(id: string, userId: string): Promise<ExternalTransaction | undefined> {
    const [transaction] = await db.select().from(externalTransactions)
      .where(and(eq(externalTransactions.id, id), eq(externalTransactions.userId, userId)));
    return transaction || undefined;
  }

  async createExternalTransaction(transaction: InsertExternalTransaction): Promise<ExternalTransaction> {
    const [created] = await db.insert(externalTransactions).values(transaction).returning();
    return created;
  }

  async updateExternalTransaction(id: string, userId: string, updates: Partial<ExternalTransaction>): Promise<ExternalTransaction | undefined> {
    const [updated] = await db.update(externalTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(externalTransactions.id, id), eq(externalTransactions.userId, userId)))
      .returning();
    return updated || undefined;
  }

  async getTransactionStats(userId: string, period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    totalTransactions: number;
    totalAmount: number;
    totalFees: number;
    netAmount: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byPaymentMethod: Record<string, number>;
  }> {
    const conditions = [eq(externalTransactions.userId, userId)];
    
    if (period && period !== 'all') {
      const now = new Date();
      let dateFilter: Date;
      switch (period) {
        case 'week':
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
      conditions.push(gte(externalTransactions.transactionDate, dateFilter!));
    }
    
    const transactions = await db.select().from(externalTransactions).where(and(...conditions));
    
    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
    const totalFees = transactions.reduce((sum, t) => sum + parseFloat(t.fee || '0'), 0);
    const netAmount = transactions.reduce((sum, t) => sum + parseFloat(t.netAmount || '0'), 0);
    
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byPaymentMethod: Record<string, number> = {};
    
    for (const transaction of transactions) {
      const type = transaction.transactionType || 'unknown';
      const status = transaction.status || 'unknown';
      const method = transaction.paymentMethod || 'unknown';
      
      byType[type] = (byType[type] || 0) + 1;
      byStatus[status] = (byStatus[status] || 0) + 1;
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + 1;
    }
    
    return { totalTransactions, totalAmount, totalFees, netAmount, byType, byStatus, byPaymentMethod };
  }

  // External Products
  async getExternalProducts(userId: string, filters?: {
    search?: string;
    category?: string;
    source?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ExternalProduct[]> {
    const conditions = [eq(externalProducts.userId, userId)];
    
    if (filters?.search) {
      conditions.push(or(
        ilike(externalProducts.name, `%${filters.search}%`),
        ilike(externalProducts.description, `%${filters.search}%`),
        ilike(externalProducts.sku, `%${filters.search}%`)
      )!);
    }
    if (filters?.category) {
      conditions.push(eq(externalProducts.category, filters.category));
    }
    if (filters?.source) {
      conditions.push(eq(externalProducts.externalSource, filters.source));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(externalProducts.isActive, filters.isActive));
    }
    
    let query = db.select().from(externalProducts)
      .where(and(...conditions))
      .orderBy(desc(externalProducts.totalRevenue));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return query;
  }

  async getExternalProductById(id: string, userId: string): Promise<ExternalProduct | undefined> {
    const [product] = await db.select().from(externalProducts)
      .where(and(eq(externalProducts.id, id), eq(externalProducts.userId, userId)));
    return product || undefined;
  }

  async getExternalProductByExternalId(userId: string, externalId: string, source: string): Promise<ExternalProduct | undefined> {
    const [product] = await db.select().from(externalProducts)
      .where(and(
        eq(externalProducts.userId, userId),
        eq(externalProducts.externalId, externalId),
        eq(externalProducts.externalSource, source)
      ));
    return product || undefined;
  }

  async createExternalProduct(product: Partial<ExternalProduct> & { userId: string; externalId: string; externalSource: string; name: string }): Promise<ExternalProduct> {
    const [created] = await db.insert(externalProducts).values(product).returning();
    return created;
  }

  async upsertExternalProduct(userId: string, externalId: string, source: string, data: Partial<ExternalProduct>): Promise<ExternalProduct> {
    const existing = await this.getExternalProductByExternalId(userId, externalId, source);
    if (existing) {
      const [updated] = await db.update(externalProducts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(externalProducts.id, existing.id))
        .returning();
      return updated;
    }
    return this.createExternalProduct({ 
      ...data, 
      userId, 
      externalId, 
      externalSource: source,
      name: data.name || 'Unknown Product'
    });
  }

  async deleteExternalProduct(id: string, userId: string): Promise<void> {
    await db.delete(externalProducts)
      .where(and(eq(externalProducts.id, id), eq(externalProducts.userId, userId)));
  }

  async getTopProducts(userId: string, limit: number = 10): Promise<ExternalProduct[]> {
    return db.select().from(externalProducts)
      .where(eq(externalProducts.userId, userId))
      .orderBy(desc(externalProducts.totalRevenue))
      .limit(limit);
  }

  // External Activities
  async getExternalActivities(userId: string, filters?: {
    customerId?: string;
    activityType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ExternalActivity[]> {
    const conditions = [eq(externalActivities.userId, userId)];
    
    if (filters?.customerId) {
      conditions.push(eq(externalActivities.customerId, filters.customerId));
    }
    if (filters?.activityType) {
      conditions.push(eq(externalActivities.activityType, filters.activityType));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(externalActivities.activityDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(externalActivities.activityDate, filters.dateTo));
    }
    
    let query = db.select().from(externalActivities)
      .where(and(...conditions))
      .orderBy(desc(externalActivities.activityDate));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as typeof query;
    }
    
    return query;
  }

  async createExternalActivity(activity: Partial<ExternalActivity> & { userId: string; externalSource: string; activityType: string; activityDate: Date }): Promise<ExternalActivity> {
    const [created] = await db.insert(externalActivities).values(activity).returning();
    return created;
  }

  async getCustomerActivities(customerId: string): Promise<ExternalActivity[]> {
    return db.select().from(externalActivities)
      .where(eq(externalActivities.customerId, customerId))
      .orderBy(desc(externalActivities.activityDate));
  }

  // Integration Webhooks
  async getIntegrationWebhooks(connectionId: string): Promise<IntegrationWebhook[]> {
    return db.select().from(integrationWebhooks)
      .where(eq(integrationWebhooks.connectionId, connectionId));
  }

  async createIntegrationWebhook(webhook: Partial<IntegrationWebhook> & { connectionId: string; userId: string; event: string }): Promise<IntegrationWebhook> {
    const [created] = await db.insert(integrationWebhooks).values(webhook).returning();
    return created;
  }

  async updateIntegrationWebhook(id: string, updates: Partial<IntegrationWebhook>): Promise<IntegrationWebhook | undefined> {
    const [updated] = await db.update(integrationWebhooks)
      .set(updates)
      .where(eq(integrationWebhooks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteIntegrationWebhook(id: string): Promise<void> {
    await db.delete(integrationWebhooks).where(eq(integrationWebhooks.id, id));
  }

  // Integration Provider Configs
  async getProviderConfigs(): Promise<IntegrationProviderConfig[]> {
    return db.select().from(integrationProviderConfigs)
      .where(eq(integrationProviderConfigs.isEnabled, true))
      .orderBy(asc(integrationProviderConfigs.displayName));
  }

  async getProviderConfigByProvider(provider: string): Promise<IntegrationProviderConfig | undefined> {
    const [config] = await db.select().from(integrationProviderConfigs)
      .where(eq(integrationProviderConfigs.provider, provider));
    return config || undefined;
  }

  async getProviderConfigsByCategory(category: string): Promise<IntegrationProviderConfig[]> {
    return db.select().from(integrationProviderConfigs)
      .where(and(
        eq(integrationProviderConfigs.category, category),
        eq(integrationProviderConfigs.isEnabled, true)
      ))
      .orderBy(asc(integrationProviderConfigs.displayName));
  }

  // Integration Analytics
  async getIntegrationStats(userId: string): Promise<{
    totalConnections: number;
    activeConnections: number;
    totalCustomers: number;
    totalOrders: number;
    totalRevenue: number;
    lastSyncAt: Date | null;
    syncErrorsLast24h: number;
    customersBySource: Record<string, number>;
    revenueBySource: Record<string, number>;
  }> {
    // Get connections
    const connections = await this.getExternalConnections(userId);
    const totalConnections = connections.length;
    const activeConnections = connections.filter(c => c.status === 'active').length;
    const lastSyncAt = connections
      .filter(c => c.lastSyncAt)
      .sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0]?.lastSyncAt || null;
    
    // Get customer count
    const [customerCount] = await db.select({ count: count() }).from(externalCustomers)
      .where(eq(externalCustomers.userId, userId));
    const totalCustomers = customerCount?.count || 0;
    
    // Get orders and revenue
    const orders = await db.select().from(externalOrders)
      .where(eq(externalOrders.userId, userId));
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0);
    
    // Calculate customers by source
    const customers = await db.select().from(externalCustomers)
      .where(eq(externalCustomers.userId, userId));
    const customersBySource: Record<string, number> = {};
    for (const c of customers) {
      const source = c.externalSource || 'unknown';
      customersBySource[source] = (customersBySource[source] || 0) + 1;
    }
    
    // Calculate revenue by source
    const revenueBySource: Record<string, number> = {};
    for (const o of orders) {
      const source = o.externalSource;
      revenueBySource[source] = (revenueBySource[source] || 0) + parseFloat(o.totalAmount || '0');
    }
    
    // Count sync errors in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [errorCount] = await db.select({ count: count() }).from(externalSyncJobs)
      .where(and(
        eq(externalSyncJobs.userId, userId),
        eq(externalSyncJobs.status, 'failed'),
        gte(externalSyncJobs.createdAt, yesterday)
      ));
    const syncErrorsLast24h = errorCount?.count || 0;
    
    return {
      totalConnections,
      activeConnections,
      totalCustomers,
      totalOrders,
      totalRevenue,
      lastSyncAt,
      syncErrorsLast24h,
      customersBySource,
      revenueBySource
    };
  }

  // ===== USER OAUTH CONFIG =====

  async getUserOAuthConfig(userId: string, provider: string): Promise<UserOAuthConfig | undefined> {
    const [config] = await db
      .select()
      .from(userOAuthConfig)
      .where(and(eq(userOAuthConfig.userId, userId), eq(userOAuthConfig.provider, provider)));
    return config;
  }

  async upsertUserOAuthConfig(userId: string, provider: string, clientId: string, encryptedSecret: string, label?: string): Promise<UserOAuthConfig> {
    const existing = await this.getUserOAuthConfig(userId, provider);
    if (existing) {
      const [updated] = await db
        .update(userOAuthConfig)
        .set({ clientId, encryptedClientSecret: encryptedSecret, label, updatedAt: new Date() })
        .where(eq(userOAuthConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userOAuthConfig)
        .values({ userId, provider, clientId, encryptedClientSecret: encryptedSecret, label })
        .returning();
      return created;
    }
  }

  async deleteUserOAuthConfig(userId: string, provider: string): Promise<void> {
    await db
      .delete(userOAuthConfig)
      .where(and(eq(userOAuthConfig.userId, userId), eq(userOAuthConfig.provider, provider)));
  }
}

export const storage = new DatabaseStorage();
