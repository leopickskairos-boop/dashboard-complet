// Reference: javascript_database blueprint - DatabaseStorage implementation
import { 
  users, 
  calls, 
  notifications,
  notificationPreferences,
  monthlyReports,
  type User, 
  type InsertUser, 
  type Call, 
  type InsertCall,
  type Notification,
  type InsertNotification,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type MonthlyReport,
  type InsertMonthlyReport
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";
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
    return db
      .select()
      .from(users)
      .where(sql`${users.apiKeyHash} IS NOT NULL`);
  }

  async regenerateApiKey(userId: string): Promise<{ apiKey: string; apiKeyHash: string }> {
    const { apiKey, apiKeyHash } = await generateApiKey();
    await db
      .update(users)
      .set({ apiKeyHash })
      .where(eq(users.id, userId));
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

    // Conversion rate (completed calls / total calls)
    const completedResult = await db
      .select({ count: count() })
      .from(calls)
      .where(and(...conditions, eq(calls.status, 'completed')));
    const completedCalls = Number(completedResult[0]?.count || 0);
    const conversionRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;

    // Average duration (only for completed calls)
    const durationResult = await db
      .select({ avgDuration: sql<number>`AVG(${calls.duration})` })
      .from(calls)
      .where(and(...conditions, eq(calls.status, 'completed')));
    const averageDuration = Number(durationResult[0]?.avgDuration || 0);

    return {
      totalCalls,
      activeCalls,
      conversionRate: Math.round(conversionRate * 10) / 10, // Round to 1 decimal
      averageDuration: Math.round(averageDuration),
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
}

export const storage = new DatabaseStorage();
