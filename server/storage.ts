// Reference: javascript_database blueprint - DatabaseStorage implementation
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
  type InsertReviewSyncLog
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, count, isNotNull, or } from "drizzle-orm";
import { generateApiKey } from "./api-key";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  getUserByStripeSubscriptionId(subscriptionId: string): Promise<User | undefined>;
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
  }): Promise<Call[]>;
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
  }>;
  
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
  }): Promise<Call[]> {
    let query = db.select().from(calls).where(eq(calls.userId, userId));
    
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
    
    const result = await db
      .select()
      .from(calls)
      .where(and(...conditions))
      .orderBy(desc(calls.startTime));
    
    return result;
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
          updatedAt: new Date(),
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
  }> {
    const allRequests = await db
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.userId, userId));
    
    const requestsSent = allRequests.filter(r => r.sentAt).length;
    const linkClicks = allRequests.filter(r => r.linkClickedAt).length;
    const reviewsConfirmed = allRequests.filter(r => r.reviewConfirmedAt).length;
    const promosGenerated = allRequests.filter(r => r.promoCode).length;
    const promosUsed = allRequests.filter(r => r.promoCodeUsedAt).length;
    
    return {
      requestsSent,
      linkClicks,
      clickRate: requestsSent > 0 ? Math.round((linkClicks / requestsSent) * 100) : 0,
      reviewsConfirmed,
      conversionRate: requestsSent > 0 ? Math.round((reviewsConfirmed / requestsSent) * 100) : 0,
      promosGenerated,
      promosUsed,
    };
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
}

export const storage = new DatabaseStorage();
