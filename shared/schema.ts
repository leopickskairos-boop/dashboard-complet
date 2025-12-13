import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, pgEnum, jsonb, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Notification type enum
export const notificationTypeEnum = pgEnum('notification_type', [
  'daily_summary',
  'failed_calls',
  'active_call',
  'password_changed',
  'payment_updated',
  'subscription_renewed',
  'subscription_created',
  'subscription_expired',
  'subscription_expiring_soon',
  'monthly_report_ready',
  // Reviews & Reputation
  'review_received',
  'review_negative',
  // Marketing
  'campaign_sent',
  'automation_triggered',
  // CB Guarantee
  'guarantee_noshow_charged',
  'guarantee_card_validated',
  // Integrations
  'integration_sync_complete',
  'integration_error'
]);

// Push notification type enum for PWA notifications
export const pushNotificationTypeEnum = pgEnum('push_notification_type', [
  'daily_summary',
  'alert',
  'win',
  'affiliation'
]);

// Business type enum for vocabulary adaptation
export const businessTypeEnum = pgEnum('business_type', [
  'restaurant',
  'kine',
  'garage',
  'other'
]);

// Users table with authentication, email verification, and Stripe subscription
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'user' or 'admin'
  isVerified: boolean("is_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordTokenExpiry: timestamp("reset_password_token_expiry"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // 'active', 'canceled', 'past_due', 'incomplete', null
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  plan: text("plan"), // 'basic', 'standard', 'premium', null
  countdownStart: timestamp("countdown_start"),
  countdownEnd: timestamp("countdown_end"),
  apiKeyHash: text("api_key_hash").unique(), // Hashed API key for N8N webhooks (bcrypt)
  accountStatus: text("account_status").notNull().default("trial"), // 'trial', 'active', 'expired', 'suspended'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
}).pick({
  email: true,
  password: true,
}).extend({
  stripeCustomerId: z.string().optional(),
  countdownStart: z.date().optional(),
  countdownEnd: z.date().optional(),
  accountStatus: z.enum(['trial', 'active', 'expired', 'suspended']).optional(),
});

export const signupSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Confirmation requise"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requis"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Confirmation requise"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SignupData = z.infer<typeof signupSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type User = typeof users.$inferSelect;

// Public user type (without sensitive data)
export type PublicUser = Omit<User, 'password' | 'verificationToken' | 'verificationTokenExpiry' | 'resetPasswordToken' | 'resetPasswordTokenExpiry'>;

// SpeedAI Clients table - Each agent_id represents a SpeedAI client (business)
export const speedaiClients = pgTable("speedai_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull().unique(), // Unique identifier from N8N (e.g., agent_74b0dd455566d4141adc040641)
  
  // Business info
  businessName: text("business_name"), // Name of the business (e.g., "Restaurant Le Gourmet")
  businessType: text("business_type"), // Type of business (e.g., "restaurant", "medical", "hotel")
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  
  // Subscription info
  plan: text("plan").default("basic"), // 'basic', 'standard', 'premium'
  isActive: boolean("is_active").notNull().default(true),
  
  // Metadata
  timezone: text("timezone").default("Europe/Paris"),
  language: text("language").default("fr"),
  notes: text("notes"),
  
  // Timestamps
  firstCallAt: timestamp("first_call_at"), // When we received the first call for this client
  lastCallAt: timestamp("last_call_at"), // When we received the last call
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for speedai_clients
export const insertSpeedaiClientSchema = createInsertSchema(speedaiClients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for speedai_clients
export type InsertSpeedaiClient = z.infer<typeof insertSpeedaiClientSchema>;
export type SpeedaiClient = typeof speedaiClients.$inferSelect;

// Calls table for tracking phone calls with rich N8N data
export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Basic call info
  phoneNumber: text("phone_number").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // Duration in seconds
  status: text("status").notNull(), // 'active', 'completed', 'failed', 'canceled', 'no_answer'
  
  // External references
  callId: text("call_id"), // External call ID from N8N (e.g., call_test_curl_001)
  agentId: text("agent_id"), // AI agent ID (e.g., agent_74b0dd455566d4141adc040641)
  callSid: text("call_sid"), // Legacy external call reference
  
  // Call type and event
  eventType: text("event_type"), // 'reservation', 'inquiry', 'cancellation', 'modification', etc.
  
  // Call outcome
  callAnswered: boolean("call_answered"),
  isOutOfScope: boolean("is_out_of_scope"),
  conversionResult: text("conversion_result"), // 'converted', 'not_converted', 'pending'
  callSuccessful: boolean("call_successful"),
  disconnectionReason: text("disconnection_reason"), // 'user_hangup', 'agent_hangup', 'timeout', etc.
  
  // Content
  summary: text("summary"),
  transcript: text("transcript"), // Full conversation transcript
  tags: text("tags").array(), // Array of tags (e.g., ['réservation', 'restaurant', 'dîner'])
  
  // Appointment details
  appointmentDate: timestamp("appointment_date"),
  appointmentHour: integer("appointment_hour"), // Hour of appointment (0-23)
  appointmentDayOfWeek: integer("appointment_day_of_week"), // Day of week (0-6, 0=Sunday)
  bookingDelayDays: integer("booking_delay_days"), // Days between call and appointment
  isLastMinute: boolean("is_last_minute"), // Booking made with short notice
  groupCategory: text("group_category"), // Size category (e.g., "2", "4-6", "7+")
  
  // Client info (from metadata)
  clientName: text("client_name"),
  clientEmail: text("client_email"),
  clientMood: text("client_mood"), // 'positif', 'neutre', 'négatif'
  isReturningClient: boolean("is_returning_client"),
  
  // Business context
  agencyName: text("agency_name"),
  companyName: text("company_name"),
  serviceType: text("service_type"), // 'diner', 'dejeuner', 'consultation', etc.
  nbPersonnes: integer("nb_personnes"), // Number of people for reservation
  
  // Call quality metrics
  bookingConfidence: integer("booking_confidence"), // 0-100 confidence score
  callQuality: text("call_quality"), // 'fluide', 'difficile', 'interrompu'
  languageDetected: text("language_detected"), // 'fr', 'en', 'es', etc.
  
  // Analysis fields
  questionsAsked: text("questions_asked").array(),
  objections: text("objections").array(),
  keywords: text("keywords").array(),
  painPoints: text("pain_points").array(),
  compliments: text("compliments").array(),
  upsellAccepted: boolean("upsell_accepted"),
  competitorMentioned: boolean("competitor_mentioned"),
  
  // Special cases
  preferences: text("preferences"),
  specialOccasion: text("special_occasion"),
  originalDate: text("original_date"), // For modifications
  originalTime: text("original_time"),
  modificationReason: text("modification_reason"),
  cancellationReason: text("cancellation_reason"),
  cancellationTime: timestamp("cancellation_time"),
  
  // Technical
  calendarId: text("calendar_id"),
  timezone: text("timezone"),
  recordingUrl: text("recording_url"),
  collectedAt: timestamp("collected_at"), // When N8N collected this data
  
  // Legacy fields
  emailSent: boolean("email_sent").notNull().default(false),
  metadata: jsonb("metadata"), // Any additional data not captured in specific fields
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schema for calls
export const insertCallSchema = createInsertSchema(calls, {
  phoneNumber: z.string().min(1, "Numéro de téléphone requis"),
  status: z.enum(['active', 'completed', 'failed', 'canceled', 'no_answer']),
}).omit({
  id: true,
  createdAt: true,
});

// Types for calls
export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;

// N8N Webhook payload schema for call data ingestion (comprehensive)
// Supports both ISO datetime strings and Unix timestamps (milliseconds or seconds)
const flexibleDateTime = z.union([
  z.string().datetime({ message: "Format de date invalide" }),
  z.string(), // Accept any string (N8N may send various formats)
  z.number(), // Unix timestamp (ms or seconds)
]).nullable().optional();

export const n8nCallWebhookSchema = z.object({
  // Basic call info (required)
  phoneNumber: z.string().min(1, "Numéro de téléphone requis"),
  status: z.enum(['active', 'completed', 'failed', 'canceled', 'no_answer']),
  startTime: flexibleDateTime, // Accept string, number, or null
  
  // Basic call info (optional)
  endTime: flexibleDateTime, // Accept string, number, or null
  duration: z.number().int().min(0).nullable().optional(),
  
  // External references
  call_id: z.string().nullable().optional(),
  agent_id: z.string().nullable().optional(),
  
  // Call type and event
  event_type: z.string().nullable().optional(),
  
  // Call outcome
  call_answered: z.boolean().nullable().optional(),
  is_out_of_scope: z.boolean().nullable().optional(),
  conversion_result: z.string().nullable().optional(),
  call_successful: z.boolean().nullable().optional(),
  disconnection_reason: z.string().nullable().optional(),
  
  // Content
  summary: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  
  // Appointment details (all nullable for non-booking calls)
  appointmentDate: flexibleDateTime, // Accept string, number, or null
  appointmentHour: z.number().int().min(0).max(23).nullable().optional(),
  appointmentDayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  booking_delay_days: z.number().int().nullable().optional(),
  is_last_minute: z.boolean().nullable().optional(),
  group_category: z.string().nullable().optional(),
  
  // N8N specific fields (ignored but accepted)
  dashboard_api_key: z.string().nullable().optional(),
  dashboard_url: z.string().nullable().optional(),
  collected_at: z.union([z.string(), z.number()]).nullable().optional(),
  
  // Rich metadata from N8N (all fields extracted)
  metadata: z.object({
    event_type: z.string().nullable().optional(),
    agency_name: z.string().nullable().optional(),
    company_name: z.string().nullable().optional(),
    nb_personnes: z.number().int().nullable().optional(),
    group_category: z.string().nullable().optional(),
    service_type: z.string().nullable().optional(),
    preferences: z.string().nullable().optional(),
    special_occasion: z.string().nullable().optional(),
    original_date: z.string().nullable().optional(),
    original_time: z.string().nullable().optional(),
    modification_reason: z.string().nullable().optional(),
    cancellation_reason: z.string().nullable().optional(),
    cancellation_time: z.string().nullable().optional(),
    client_name: z.string().nullable().optional(),
    client_email: z.string().nullable().optional(),
    client_mood: z.string().nullable().optional(),
    is_returning_client: z.boolean().nullable().optional(),
    booking_confidence: z.number().int().min(0).max(100).nullable().optional(),
    questions_asked: z.array(z.string()).nullable().optional(),
    objections: z.array(z.string()).nullable().optional(),
    keywords: z.array(z.string()).nullable().optional(),
    pain_points: z.array(z.string()).nullable().optional(),
    compliments: z.array(z.string()).nullable().optional(),
    upsell_accepted: z.boolean().nullable().optional(),
    competitor_mentioned: z.boolean().nullable().optional(),
    language_detected: z.string().nullable().optional(),
    call_quality: z.string().nullable().optional(),
    calendar_id: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    recording_url: z.string().nullable().optional(),
  }).passthrough().nullable().optional(), // passthrough allows additional unknown fields
});

export type N8nCallWebhookPayload = z.infer<typeof n8nCallWebhookSchema>;

// Notifications table for user notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  metadata: text("metadata"), // JSON string for additional data (e.g., call counts, dates)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schema for notifications
export const insertNotificationSchema = createInsertSchema(notifications, {
  type: z.enum([
    'daily_summary',
    'failed_calls',
    'active_call',
    'password_changed',
    'payment_updated',
    'subscription_renewed',
    'subscription_created',
    'subscription_expired',
    'subscription_expiring_soon',
    'monthly_report_ready'
  ]),
  title: z.string().min(1, "Titre requis"),
  message: z.string().min(1, "Message requis"),
}).omit({
  id: true,
  createdAt: true,
});

// Types for notifications
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Notification preferences table for user settings
export const notificationPreferences = pgTable("notification_preferences", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  dailySummaryEnabled: boolean("daily_summary_enabled").notNull().default(true),
  failedCallsEnabled: boolean("failed_calls_enabled").notNull().default(true),
  activeCallEnabled: boolean("active_call_enabled").notNull().default(true),
  subscriptionAlertsEnabled: boolean("subscription_alerts_enabled").notNull().default(true),
  // Reviews & Reputation
  reviewsEnabled: boolean("reviews_enabled").notNull().default(true),
  negativeReviewsEnabled: boolean("negative_reviews_enabled").notNull().default(true),
  // Marketing
  marketingEnabled: boolean("marketing_enabled").notNull().default(true),
  // CB Guarantee
  guaranteeEnabled: boolean("guarantee_enabled").notNull().default(true),
  // Integrations
  integrationsEnabled: boolean("integrations_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for notification preferences
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  createdAt: true,
  updatedAt: true,
});

// Types for notification preferences
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

// Monthly reports table for storing generated PDF reports
export const monthlyReports = pgTable("monthly_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  subscriptionRenewalAt: timestamp("subscription_renewal_at").notNull(),
  metrics: text("metrics").notNull(), // JSON string with all KPIs and aggregated data
  pdfPath: text("pdf_path").notNull(),
  pdfChecksum: text("pdf_checksum"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  emailedAt: timestamp("emailed_at"),
  notificationId: varchar("notification_id").references(() => notifications.id, { onDelete: 'set null' }),
  retryCount: integer("retry_count").notNull().default(0),
});

// Insert schema for monthly reports
export const insertMonthlyReportSchema = createInsertSchema(monthlyReports, {
  periodStart: z.date(),
  periodEnd: z.date(),
  subscriptionRenewalAt: z.date(),
  metrics: z.string().min(1, "Metrics data required"),
  pdfPath: z.string().min(1, "PDF path required"),
}).omit({
  id: true,
  generatedAt: true,
});

// Types for monthly reports
export type InsertMonthlyReport = z.infer<typeof insertMonthlyReportSchema>;
export type MonthlyReport = typeof monthlyReports.$inferSelect;

// ===== N8N LOGS (File-based storage, no PostgreSQL table) =====

/**
 * Schema for N8N logs received via webhook router
 * Logs are stored as JSON files in /reports/logs/{clientId}/
 */
export const n8nLogSchema = z.object({
  timestamp: z.string().datetime(), // ISO 8601 timestamp
  event: z.string(), // Event type (e.g., 'call_started', 'call_ended', 'test_connection')
  source: z.string().optional(), // Source identifier (e.g., 'n8n_workflow', 'api')
  user: z.string().optional(), // User email or identifier
  data: z.record(z.unknown()).optional(), // Flexible payload data
  metadata: z.record(z.unknown()).optional(), // Additional metadata
});

// Schema for log query filters
export const n8nLogFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  event: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

// Types for N8N logs
export type N8NLog = z.infer<typeof n8nLogSchema>;
export type N8NLogFilters = z.infer<typeof n8nLogFiltersSchema>;

// Extended N8N log with file metadata (returned by API)
export type N8NLogWithMetadata = N8NLog & {
  fileName: string;
  fileTimestamp: string;
};

// ===== PWA PUSH NOTIFICATIONS SYSTEM =====

// Push subscriptions table - stores Web Push API subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text("endpoint").notNull().unique(), // Push service endpoint URL
  p256dhKey: text("p256dh_key").notNull(), // Public key for encryption
  authKey: text("auth_key").notNull(), // Auth secret for encryption
  userAgent: text("user_agent"), // Browser/device info
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

// Insert schema for push subscriptions
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

// Types for push subscriptions
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// Push notification preferences - granular control per notification type
export const pushNotificationPreferences = pgTable("push_notification_preferences", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  
  // Channel preferences
  pushEnabled: boolean("push_enabled").notNull().default(false), // Master toggle for push
  emailEnabled: boolean("email_enabled").notNull().default(true), // Master toggle for email
  
  // Push notification types
  dailySummaryPush: boolean("daily_summary_push").notNull().default(true),
  alertsPush: boolean("alerts_push").notNull().default(true),
  winsPush: boolean("wins_push").notNull().default(true),
  affiliationPush: boolean("affiliation_push").notNull().default(true),
  
  // Email notification types
  dailySummaryEmail: boolean("daily_summary_email").notNull().default(true),
  alertsEmail: boolean("alerts_email").notNull().default(true),
  winsEmail: boolean("wins_email").notNull().default(false),
  affiliationEmail: boolean("affiliation_email").notNull().default(false),
  
  // Quiet hours (no push between these hours)
  quietHoursStart: integer("quiet_hours_start").default(23), // 23:00
  quietHoursEnd: integer("quiet_hours_end").default(7), // 07:00
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for push notification preferences
export const insertPushNotificationPreferencesSchema = createInsertSchema(pushNotificationPreferences).omit({
  createdAt: true,
  updatedAt: true,
});

// Types for push notification preferences
export type InsertPushNotificationPreferences = z.infer<typeof insertPushNotificationPreferencesSchema>;
export type PushNotificationPreferences = typeof pushNotificationPreferences.$inferSelect;

// Push notification history - tracks sent notifications
export const pushNotificationHistory = pgTable("push_notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: pushNotificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tag: text("tag").notNull(), // Unique tag for deduplication (e.g., "daily-summary-2025-12-05")
  url: text("url").default("/dashboard"), // Redirect URL on click
  
  // Delivery status
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  clickedAt: timestamp("clicked_at"),
  failedAt: timestamp("failed_at"),
  errorMessage: text("error_message"),
  
  // Affiliation tracking
  includesAffiliation: boolean("includes_affiliation").notNull().default(false),
  affiliationBody: text("affiliation_body"),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional data (clientData snapshot, etc.)
});

// Insert schema for push notification history
export const insertPushNotificationHistorySchema = createInsertSchema(pushNotificationHistory).omit({
  id: true,
  sentAt: true,
});

// Types for push notification history
export type InsertPushNotificationHistory = z.infer<typeof insertPushNotificationHistorySchema>;
export type PushNotificationHistory = typeof pushNotificationHistory.$inferSelect;

// Client business data for notifications (extends speedaiClients with notification-specific data)
export const clientNotificationData = pgTable("client_notification_data", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  
  // Business identity
  companyName: text("company_name"),
  ownerName: text("owner_name"),
  businessType: businessTypeEnum("business_type").default('other'),
  
  // Business config
  openingHour: integer("opening_hour").default(9), // 09:00
  closingHour: integer("closing_hour").default(18), // 18:00
  avgTicket: integer("avg_ticket").default(50), // € average per conversion
  
  // Affiliation tracking
  lastAffiliationNotif: timestamp("last_affiliation_notif"),
  totalReferrals: integer("total_referrals").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0), // € total earned from referrals
  
  // Records tracking
  bestDayReservations: integer("best_day_reservations").notNull().default(0),
  bestDayRevenue: integer("best_day_revenue").notNull().default(0),
  
  // Notification state tracking
  lastDailySummary: timestamp("last_daily_summary"),
  lastWinNotification: timestamp("last_win_notification"),
  lastAlertNotification: timestamp("last_alert_notification"),
  notificationsToday: integer("notifications_today").notNull().default(0),
  lastNotificationReset: timestamp("last_notification_reset").defaultNow(),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for client notification data
export const insertClientNotificationDataSchema = createInsertSchema(clientNotificationData).omit({
  createdAt: true,
  updatedAt: true,
});

// Types for client notification data
export type InsertClientNotificationData = z.infer<typeof insertClientNotificationDataSchema>;
export type ClientNotificationData = typeof clientNotificationData.$inferSelect;

// ===== NOTIFICATION GENERATION SCHEMAS =====

// Schema for daily stats used in notification generation
export const dailyStatsSchema = z.object({
  calls_total: z.number().default(0),
  calls_converted: z.number().default(0),
  reservations: z.number().default(0),
  cancellations: z.number().default(0),
  no_shows: z.number().default(0),
  revenue_generated: z.number().default(0),
  calls_outside_hours: z.number().default(0),
  revenue_outside_hours: z.number().default(0),
  hours_saved: z.number().default(0),
  empty_slots_tomorrow: z.number().default(0),
  empty_slots_revenue_potential: z.number().default(0),
  big_cancellation: z.object({
    nb_persons: z.number(),
    revenue_lost: z.number(),
  }).nullable().default(null),
  frustrated_client_detected: z.boolean().default(false),
});

// Schema for period stats
export const periodStatsSchema = z.object({
  week_revenue: z.number().default(0),
  week_revenue_previous: z.number().default(0),
  week_growth_percent: z.number().default(0),
  month_revenue: z.number().default(0),
  month_calls: z.number().default(0),
  month_hours_saved: z.number().default(0),
  days_without_noshow: z.number().default(0),
  conversion_rate: z.number().default(0),
});

// Schema for records
export const recordsSchema = z.object({
  best_day_reservations: z.number().default(0),
  best_day_revenue: z.number().default(0),
  is_new_record_today: z.boolean().default(false),
});

// Complete client data schema for notification generation
export const clientDataForNotificationsSchema = z.object({
  client_id: z.string(),
  company_name: z.string().default("Votre entreprise"),
  owner_name: z.string().default("Client"),
  business_type: z.enum(['restaurant', 'kine', 'garage', 'other']).default('other'),
  opening_hours: z.object({
    open: z.string().default("09:00"),
    close: z.string().default("18:00"),
  }),
  avg_ticket: z.number().default(50),
  today: dailyStatsSchema,
  period: periodStatsSchema,
  records: recordsSchema,
  affiliation: z.object({
    last_affiliation_notif: z.string().nullable().default(null),
    total_referrals: z.number().default(0),
    total_earned: z.number().default(0),
  }),
});

// Types for notification generation
export type DailyStats = z.infer<typeof dailyStatsSchema>;
export type PeriodStats = z.infer<typeof periodStatsSchema>;
export type Records = z.infer<typeof recordsSchema>;
export type ClientDataForNotifications = z.infer<typeof clientDataForNotificationsSchema>;

// Notification output schema
export const notificationOutputSchema = z.object({
  client_id: z.string(),
  notification: z.object({
    type: z.enum(['daily_summary', 'alert', 'win', 'affiliation']),
    title: z.string(),
    body: z.string(),
    icon: z.string().default("/icon-192.png"),
    badge: z.string().default("/badge-72.png"),
    tag: z.string(),
    data: z.object({
      url: z.string().default("/dashboard"),
      type: z.enum(['daily_summary', 'alert', 'win', 'affiliation']),
    }),
  }),
  scheduled_at: z.string(),
  include_affiliation: z.boolean().default(false),
  affiliation_body: z.string().optional(),
});

export type NotificationOutput = z.infer<typeof notificationOutputSchema>;

// ===== CB GUARANTEE (ANTI NO-SHOW) TABLES =====

// Guarantee session status enum
export const guaranteeSessionStatusEnum = pgEnum('guarantee_session_status', [
  'pending',        // CB demandée, pas encore validée
  'validated',      // CB enregistrée, résa confirmée
  'completed',      // Client venu
  'cancelled',      // Résa annulée
  'noshow_charged', // No-show, débit réussi
  'noshow_failed'   // No-show, débit échoué
]);

// Apply to conditions enum
export const guaranteeApplyToEnum = pgEnum('guarantee_apply_to', [
  'all',            // Toutes les réservations
  'min_persons',    // Minimum X personnes
  'weekend'         // Weekend seulement
]);

// Client guarantee configuration table
export const clientGuaranteeConfig = pgTable("client_guarantee_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // Activation
  enabled: boolean("enabled").notNull().default(false),
  
  // Stripe Connect
  paymentProvider: text("payment_provider").default("stripe"),
  stripeAccountId: text("stripe_account_id"), // Compte Stripe Connect du client
  
  // Paramètres pénalité
  penaltyAmount: integer("penalty_amount").notNull().default(30), // € par personne
  cancellationDelay: integer("cancellation_delay").notNull().default(24), // heures avant résa
  
  // Conditions d'application
  applyTo: text("apply_to").notNull().default("all"), // 'all', 'min_persons', 'weekend'
  minPersons: integer("min_persons").notNull().default(1),
  
  // Branding page client
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").default("#C8B88A"), // SpeedAI gold
  
  // Email expéditeur via Resend (centralisé SpeedAI)
  senderEmail: text("sender_email"), // Adresse email expéditeur (doit être vérifiée sur Resend)
  gmailSenderEmail: text("gmail_sender_email"), // Deprecated - anciennement Gmail SMTP
  gmailSenderName: text("gmail_sender_name"),
  gmailAppPassword: text("gmail_app_password"), // Deprecated - anciennement Gmail SMTP
  
  // SMS (optionnel - utilise Twilio du client ou notre propre config)
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioFromNumber: text("twilio_from_number"),
  
  // Automatisation
  autoSendEmailOnCreate: boolean("auto_send_email_on_create").notNull().default(true), // Email demande CB
  autoSendSmsOnCreate: boolean("auto_send_sms_on_create").notNull().default(false), // SMS demande CB
  autoSendEmailOnValidation: boolean("auto_send_email_on_validation").notNull().default(true), // Email confirmation
  autoSendSmsOnValidation: boolean("auto_send_sms_on_validation").notNull().default(false), // SMS confirmation
  
  // Rappels SMS avant RDV
  appointmentReminderEnabled: boolean("appointment_reminder_enabled").notNull().default(false),
  appointmentReminderHours: integer("appointment_reminder_hours").notNull().default(24), // Heures avant le RDV
  
  // CGV
  termsUrl: text("terms_url"),
  
  // Company info (pour page publique)
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for client guarantee config
export const insertClientGuaranteeConfigSchema = createInsertSchema(clientGuaranteeConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for client guarantee config
export type InsertClientGuaranteeConfig = z.infer<typeof insertClientGuaranteeConfigSchema>;
export type ClientGuaranteeConfig = typeof clientGuaranteeConfig.$inferSelect;

// Guarantee sessions table
export const guaranteeSessions = pgTable("guarantee_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reservationId: text("reservation_id").notNull().unique(), // ID unique de réservation (N8N)
  
  // Agent/Business info (pour N8N callback)
  agentId: text("agent_id"), // ID agent Retell
  businessType: text("business_type"), // restaurant, garage, etc.
  
  // Infos client final
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  nbPersons: integer("nb_persons").notNull().default(1),
  reservationDate: timestamp("reservation_date").notNull(),
  reservationTime: text("reservation_time"), // Heure au format HH:MM
  duration: integer("duration"), // Durée en minutes
  
  // Infos pour créer le RDV après validation (N8N callback)
  calendarId: text("calendar_id"), // ID/email du calendrier Google
  companyName: text("company_name"),
  companyEmail: text("company_email"),
  timezone: text("timezone").default("Europe/Paris"),
  
  // Champs spécifiques garage
  vehicule: text("vehicule"),
  typeService: text("type_service"),
  
  // Lien court pour SMS
  shortCode: text("short_code").unique(), // Code court (ex: g_abc123)
  
  // Stripe
  paymentProvider: text("payment_provider").default("stripe"),
  checkoutSessionId: text("checkout_session_id"),
  setupIntentId: text("setup_intent_id"),
  paymentMethodId: text("payment_method_id"),
  customerStripeId: text("customer_stripe_id"),
  
  // Statuts
  status: text("status").notNull().default("pending"), // pending, validated, completed, cancelled, noshow_charged, noshow_failed
  
  // Montants
  penaltyAmount: integer("penalty_amount").notNull(), // € par personne
  chargedAmount: integer("charged_amount"), // Montant réellement débité (centimes)
  
  // Dates
  validatedAt: timestamp("validated_at"),
  chargedAt: timestamp("charged_at"),
  
  // Relances CB
  reminderCount: integer("reminder_count").notNull().default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  
  // Rappel SMS avant RDV
  appointmentReminderSent: boolean("appointment_reminder_sent").notNull().default(false),
  appointmentReminderSentAt: timestamp("appointment_reminder_sent_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for guarantee sessions
export const insertGuaranteeSessionSchema = createInsertSchema(guaranteeSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for guarantee sessions
export type InsertGuaranteeSession = z.infer<typeof insertGuaranteeSessionSchema>;
export type GuaranteeSession = typeof guaranteeSessions.$inferSelect;

// No-show charges table (historique des débits)
export const noshowCharges = pgTable("noshow_charges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guaranteeSessionId: varchar("guarantee_session_id").notNull().references(() => guaranteeSessions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Stripe PaymentIntent
  paymentIntentId: text("payment_intent_id"),
  amount: integer("amount").notNull(), // Montant en centimes
  currency: text("currency").notNull().default("eur"),
  status: text("status").notNull(), // 'succeeded', 'failed', 'requires_action'
  failureReason: text("failure_reason"),
  
  // Litige
  disputed: boolean("disputed").notNull().default(false),
  disputeReason: text("dispute_reason"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schema for noshow charges
export const insertNoshowChargeSchema = createInsertSchema(noshowCharges).omit({
  id: true,
  createdAt: true,
});

// Types for noshow charges
export type InsertNoshowCharge = z.infer<typeof insertNoshowChargeSchema>;
export type NoshowCharge = typeof noshowCharges.$inferSelect;

// ===== GUARANTEE API SCHEMAS =====

// Schema for creating a guarantee session (called by N8N)
export const createGuaranteeSessionSchema = z.object({
  reservation_id: z.string().min(1, "ID de réservation requis"),
  customer_name: z.string().min(1, "Nom du client requis"),
  customer_email: z.string().email("Email invalide").optional(),
  customer_phone: z.string().optional(),
  nb_persons: z.number().int().min(1).default(1),
  reservation_date: z.string(), // ISO date string ou format texte "15 janvier 2025"
  reservation_time: z.string().optional(), // HH:MM
  
  // Agent/Business info
  agent_id: z.string().optional(), // ID agent Retell
  business_type: z.string().optional(), // restaurant, garage, etc.
  
  // Infos pour créer le RDV après validation (N8N callback)
  calendar_id: z.string().optional(), // ID/email du calendrier Google
  company_name: z.string().optional(),
  company_email: z.string().email().optional(),
  timezone: z.string().default("Europe/Paris"),
  duration: z.number().int().optional(), // Durée en minutes
  
  // Champs spécifiques garage
  vehicule: z.string().optional(),
  type_service: z.string().optional(),
});

// Schema for updating guarantee config
export const updateGuaranteeConfigSchema = z.object({
  enabled: z.boolean().optional(),
  penaltyAmount: z.number().int().min(1).optional(),
  cancellationDelay: z.number().int().min(1).optional(),
  applyTo: z.enum(['all', 'min_persons', 'weekend']).optional(),
  minPersons: z.number().int().min(1).optional(),
  logoUrl: z.string().url().nullable().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  gmailSenderEmail: z.string().email().nullable().optional(),
  gmailSenderName: z.string().nullable().optional(),
  termsUrl: z.string().url().nullable().optional(),
  companyName: z.string().nullable().optional(),
  companyAddress: z.string().nullable().optional(),
  companyPhone: z.string().nullable().optional(),
});

// Schema for validating session after Stripe checkout
export const validateGuaranteeSessionSchema = z.object({
  checkout_session_id: z.string().min(1),
  setup_intent_id: z.string().optional(),
  customer_stripe_id: z.string().optional(),
  payment_method_id: z.string().optional(),
});

// Schema for updating reservation status
export const updateReservationStatusSchema = z.object({
  status: z.enum(['attended', 'noshow']),
});

export type CreateGuaranteeSession = z.infer<typeof createGuaranteeSessionSchema>;
export type UpdateGuaranteeConfig = z.infer<typeof updateGuaranteeConfigSchema>;
export type ValidateGuaranteeSession = z.infer<typeof validateGuaranteeSessionSchema>;
export type UpdateReservationStatus = z.infer<typeof updateReservationStatusSchema>;

// ===== REVIEW & REPUTATION SYSTEM TABLES =====

// Review timing mode enum
export const reviewTimingModeEnum = pgEnum('review_timing_mode', [
  'smart',        // IA détermine le meilleur moment
  'fixed_delay',  // X heures après le RDV
  'fixed_time'    // Heure fixe chaque jour
]);

// Review incentive type enum
export const reviewIncentiveTypeEnum = pgEnum('review_incentive_type', [
  'percentage',     // -10%
  'fixed_amount',   // -5€
  'free_item',      // Dessert offert
  'lottery',        // Tirage au sort
  'loyalty_points', // Points fidélité
  'custom'          // Personnalisé
]);

// Review request status enum
export const reviewRequestStatusEnum = pgEnum('review_request_status', [
  'pending',    // En attente de planification
  'scheduled',  // Planifié
  'sent',       // Envoyé
  'clicked',    // Lien cliqué
  'confirmed',  // Avis confirmé
  'expired'     // Expiré
]);

// Review sentiment enum
export const reviewSentimentEnum = pgEnum('review_sentiment', [
  'very_positive',
  'positive',
  'neutral',
  'negative',
  'very_negative'
]);

// Review alert type enum
export const reviewAlertTypeEnum = pgEnum('review_alert_type', [
  'negative_review',   // Nouvel avis négatif
  'new_5_star',        // Nouvel avis 5 étoiles
  'no_response_48h',   // Pas de réponse depuis 48h
  'weekly_report',     // Rapport hebdomadaire
  'rating_drop'        // Baisse de note moyenne
]);

// Review configuration table
export const reviewConfig = pgTable("review_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // Activation
  enabled: boolean("enabled").notNull().default(false),
  
  // Timing d'envoi
  timingMode: text("timing_mode").notNull().default("smart"), // 'smart', 'fixed_delay', 'fixed_time'
  fixedDelayHours: integer("fixed_delay_hours").notNull().default(24),
  fixedTime: text("fixed_time").default("18:00"), // HH:MM
  sendWindowStart: text("send_window_start").default("10:00"),
  sendWindowEnd: text("send_window_end").default("20:00"),
  avoidWeekends: boolean("avoid_weekends").notNull().default(false),
  
  // Informations entreprise
  companyName: text("company_name"),
  
  // Message personnalisé
  smsMessage: text("sms_message"),
  emailSubject: text("email_subject"),
  emailMessage: text("email_message"),
  
  // Valeur moyenne d'un client (en centimes) pour calculer le revenu estimé
  averageClientValue: integer("average_client_value"), // ex: 5000 = 50€
  
  // Plateformes (liens directs)
  googlePlaceId: text("google_place_id"),
  googleReviewUrl: text("google_review_url"),
  tripadvisorUrl: text("tripadvisor_url"),
  facebookPageUrl: text("facebook_page_url"),
  pagesJaunesUrl: text("pages_jaunes_url"),
  doctolibUrl: text("doctolib_url"),
  yelpUrl: text("yelp_url"),
  theForkUrl: text("the_fork_url"),
  
  // Connexions API (OAuth) - stub pour phase 2
  googleBusinessConnected: boolean("google_business_connected").notNull().default(false),
  googleBusinessToken: jsonb("google_business_token"),
  googleBusinessAccountId: text("google_business_account_id"),
  googleBusinessLocationId: text("google_business_location_id"),
  
  facebookConnected: boolean("facebook_connected").notNull().default(false),
  facebookToken: jsonb("facebook_token"),
  facebookPageId: text("facebook_page_id"),
  
  // Priorité des plateformes
  platformsPriority: jsonb("platforms_priority").default(['google', 'tripadvisor', 'facebook']),
  
  // Configuration SMS
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  
  // Configuration IA pour réponses automatiques
  aiResponseEnabled: boolean("ai_response_enabled").notNull().default(false),
  aiResponseTone: text("ai_response_tone").notNull().default("professional"), // 'professional', 'friendly', 'formal', 'casual'
  aiResponseLanguage: text("ai_response_language").notNull().default("fr"), // 'fr', 'en', 'es', 'de', 'it'
  aiAutoGenerate: boolean("ai_auto_generate").notNull().default(true), // Génère automatiquement lors du sync
  aiIncludeCompanyName: boolean("ai_include_company_name").notNull().default(true),
  aiMaxLength: integer("ai_max_length").notNull().default(300), // Longueur max en caractères
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for review config
export const insertReviewConfigSchema = createInsertSchema(reviewConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for review config
export type InsertReviewConfig = z.infer<typeof insertReviewConfigSchema>;
export type ReviewConfig = typeof reviewConfig.$inferSelect;

// Review incentives table
export const reviewIncentives = pgTable("review_incentives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Type d'incitation
  type: text("type").notNull(), // 'percentage', 'fixed_amount', 'free_item', 'lottery', 'loyalty_points', 'custom'
  
  // Valeurs selon le type
  percentageValue: integer("percentage_value"),
  fixedAmountValue: integer("fixed_amount_value"), // Centimes
  freeItemName: text("free_item_name"),
  lotteryPrize: text("lottery_prize"),
  loyaltyPointsValue: integer("loyalty_points_value"),
  customDescription: text("custom_description"),
  
  // Conditions
  validityDays: integer("validity_days").notNull().default(30),
  singleUse: boolean("single_use").notNull().default(true),
  minimumPurchase: integer("minimum_purchase").default(0), // Centimes
  
  // Message affiché
  displayMessage: text("display_message"),
  
  // Statut
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schema for review incentives
export const insertReviewIncentiveSchema = createInsertSchema(reviewIncentives).omit({
  id: true,
  createdAt: true,
});

// Types for review incentives
export type InsertReviewIncentive = z.infer<typeof insertReviewIncentiveSchema>;
export type ReviewIncentive = typeof reviewIncentives.$inferSelect;

// Review requests table
export const reviewRequests = pgTable("review_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Infos client
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  
  // Lien réservation
  reservationId: text("reservation_id"),
  reservationDate: timestamp("reservation_date"),
  reservationTime: text("reservation_time"), // HH:MM
  
  // Envoi
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  sendMethod: text("send_method").notNull().default("both"), // 'sms', 'email', 'both'
  
  // Tracking
  trackingToken: text("tracking_token").unique(),
  shortCode: text("short_code").unique(), // Code court pour SMS (ex: r_abc123)
  linkClickedAt: timestamp("link_clicked_at"),
  platformClicked: text("platform_clicked"),
  
  // Confirmation
  reviewConfirmedAt: timestamp("review_confirmed_at"),
  reviewConfirmedPlatform: text("review_confirmed_platform"),
  
  // Incitation
  incentiveId: varchar("incentive_id").references(() => reviewIncentives.id, { onDelete: 'set null' }),
  promoCode: text("promo_code"),
  promoCodeUsedAt: timestamp("promo_code_used_at"),
  promoOrderAmount: integer("promo_order_amount"),
  
  // Statut
  status: text("status").notNull().default("pending"), // 'pending', 'scheduled', 'sent', 'clicked', 'confirmed', 'expired'
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schema for review requests
export const insertReviewRequestSchema = createInsertSchema(reviewRequests).omit({
  id: true,
  createdAt: true,
});

// Types for review requests
export type InsertReviewRequest = z.infer<typeof insertReviewRequestSchema>;
export type ReviewRequest = typeof reviewRequests.$inferSelect;

// Review automations table - envois automatiques d'avis
export const reviewAutomations = pgTable("review_automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  name: text("name").notNull(),
  description: text("description"),
  
  // Trigger type
  triggerType: text("trigger_type").notNull(), // 'new_client', 'post_visit', 'post_reservation', 'days_after_visit', 'manual'
  triggerConfig: jsonb("trigger_config"), // { daysAfter: 1, sendTime: '18:00' }
  
  // Send configuration
  sendMethod: text("send_method").notNull().default("both"), // 'email', 'sms', 'both'
  incentiveId: varchar("incentive_id").references(() => reviewIncentives.id, { onDelete: 'set null' }),
  
  // Status
  isActive: boolean("is_active").notNull().default(false),
  
  // Stats
  totalSent: integer("total_sent").default(0),
  totalClicked: integer("total_clicked").default(0),
  totalConverted: integer("total_converted").default(0),
  
  // Timestamps
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for review automations
export const insertReviewAutomationSchema = createInsertSchema(reviewAutomations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalSent: true,
  totalClicked: true,
  totalConverted: true,
  lastTriggeredAt: true,
});

// Types for review automations
export type InsertReviewAutomation = z.infer<typeof insertReviewAutomationSchema>;
export type ReviewAutomation = typeof reviewAutomations.$inferSelect;

// Reviews table (centralized from all platforms)
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceId: varchar("source_id"), // Reference to review_sources (optional, added later)
  
  // Plateforme
  platform: text("platform").notNull(), // 'google', 'tripadvisor', 'facebook', 'yelp', etc.
  platformReviewId: text("platform_review_id"),
  reviewUrl: text("review_url"), // Direct URL to the review
  
  // Contenu
  rating: integer("rating").notNull(), // 1-5
  content: text("content"),
  reviewerName: text("reviewer_name"),
  reviewerAvatarUrl: text("reviewer_avatar_url"),
  reviewDate: timestamp("review_date"),
  
  // Réponse
  responseText: text("response_text"),
  responseDate: timestamp("response_date"),
  responseStatus: text("response_status").notNull().default("none"), // 'none', 'draft', 'published'
  
  // Analyse IA
  sentiment: text("sentiment"), // 'very_positive', 'positive', 'neutral', 'negative', 'very_negative'
  themes: jsonb("themes"), // Array of detected themes
  aiSummary: text("ai_summary"),
  aiSuggestedResponse: text("ai_suggested_response"),
  
  // Matching
  matchedRequestId: varchar("matched_request_id").references(() => reviewRequests.id, { onDelete: 'set null' }),
  
  // Statut
  isRead: boolean("is_read").notNull().default(false),
  isFlagged: boolean("is_flagged").notNull().default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for reviews
export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for reviews
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Review alerts configuration table
export const reviewAlerts = pgTable("review_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  alertType: text("alert_type").notNull(), // 'negative_review', 'new_5_star', 'no_response_48h', 'weekly_report', 'rating_drop'
  
  isEnabled: boolean("is_enabled").notNull().default(true),
  emailNotification: boolean("email_notification").notNull().default(true),
  smsNotification: boolean("sms_notification").notNull().default(false),
  pushNotification: boolean("push_notification").notNull().default(true),
  
  thresholdValue: integer("threshold_value"), // Pour rating_drop: seuil en points (ex: 3 = -0.3)
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schema for review alerts
export const insertReviewAlertSchema = createInsertSchema(reviewAlerts).omit({
  id: true,
  createdAt: true,
});

// Types for review alerts
export type InsertReviewAlert = z.infer<typeof insertReviewAlertSchema>;
export type ReviewAlert = typeof reviewAlerts.$inferSelect;

// ===== REVIEW API SCHEMAS =====

// Schema for updating review config
export const updateReviewConfigSchema = z.object({
  enabled: z.boolean().optional(),
  timingMode: z.enum(['smart', 'fixed_delay', 'fixed_time']).optional(),
  fixedDelayHours: z.number().int().min(1).max(168).optional(),
  fixedTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  sendWindowStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  sendWindowEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  avoidWeekends: z.boolean().optional(),
  smsMessage: z.string().max(160).nullable().optional(),
  emailSubject: z.string().max(255).nullable().optional(),
  emailMessage: z.string().nullable().optional(),
  googlePlaceId: z.string().nullable().optional(),
  googleReviewUrl: z.string().url().nullable().optional(),
  tripadvisorUrl: z.string().url().nullable().optional(),
  facebookPageUrl: z.string().url().nullable().optional(),
  pagesJaunesUrl: z.string().url().nullable().optional(),
  doctolibUrl: z.string().url().nullable().optional(),
  yelpUrl: z.string().url().nullable().optional(),
  platformsPriority: z.array(z.string()).optional(),
});

// Schema for creating review incentive
export const createReviewIncentiveSchema = z.object({
  type: z.enum(['percentage', 'fixed_amount', 'free_item', 'lottery', 'loyalty_points', 'custom']),
  percentageValue: z.number().int().min(1).max(100).optional(),
  fixedAmountValue: z.number().int().min(1).optional(),
  freeItemName: z.string().max(255).optional(),
  lotteryPrize: z.string().max(255).optional(),
  loyaltyPointsValue: z.number().int().min(1).optional(),
  customDescription: z.string().optional(),
  validityDays: z.number().int().min(1).max(365).default(30),
  singleUse: z.boolean().default(true),
  minimumPurchase: z.number().int().min(0).default(0),
  displayMessage: z.string().max(255),
});

// Schema for creating review request manually
export const createReviewRequestSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  reservationId: z.string().optional(),
  reservationDate: z.string().datetime().optional(),
  reservationTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  sendMethod: z.enum(['sms', 'email', 'both']).default('both'),
  incentiveId: z.string().uuid().optional(),
});

// Schema for responding to a review
export const respondToReviewSchema = z.object({
  responseText: z.string().min(1).max(2000),
  publish: z.boolean().default(false),
});

// Schema for review stats query
export const reviewStatsQuerySchema = z.object({
  period: z.enum(['week', 'month', 'year', 'all']).default('month'),
});

// Types
export type UpdateReviewConfig = z.infer<typeof updateReviewConfigSchema>;
export type CreateReviewIncentive = z.infer<typeof createReviewIncentiveSchema>;
export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>;
export type RespondToReview = z.infer<typeof respondToReviewSchema>;
export type ReviewStatsQuery = z.infer<typeof reviewStatsQuerySchema>;

// ===== REVIEW SOURCES (Platform Connections) =====

// Review source platform enum
export const reviewSourcePlatformEnum = pgEnum('review_source_platform', [
  'google',
  'facebook', 
  'tripadvisor'
]);

// Review source connection status enum
export const reviewSourceStatusEnum = pgEnum('review_source_status', [
  'pending',      // OAuth started but not completed
  'connected',    // Successfully connected
  'error',        // Connection error
  'expired',      // Token expired
  'disconnected'  // User disconnected
]);

// Review sources table (platform connections per user)
export const reviewSources = pgTable("review_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Platform info
  platform: text("platform").notNull(), // 'google', 'facebook', 'tripadvisor'
  displayName: text("display_name"), // Business name on that platform
  platformLocationId: text("platform_location_id"), // Google Place ID, FB Page ID, TA Location ID
  platformUrl: text("platform_url"), // Direct URL to the business page
  
  // Connection status
  connectionStatus: text("connection_status").notNull().default("pending"),
  connectionError: text("connection_error"),
  
  // OAuth tokens (encrypted)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  tokenScopes: text("token_scopes"),
  
  // Sync info
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status"), // 'success', 'error', 'partial'
  lastSyncError: text("last_sync_error"),
  syncCursor: text("sync_cursor"), // Pagination cursor for next sync
  
  // Stats
  totalReviewsCount: integer("total_reviews_count").default(0),
  averageRating: integer("average_rating"), // Stored as integer * 10 (e.g., 45 = 4.5)
  
  // Metadata
  metadata: jsonb("metadata"), // Platform-specific extra data
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for review sources
export const insertReviewSourceSchema = createInsertSchema(reviewSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for review sources
export type InsertReviewSource = z.infer<typeof insertReviewSourceSchema>;
export type ReviewSource = typeof reviewSources.$inferSelect;

// ===== REVIEW SYNC LOGS =====

// Sync log status enum
export const syncLogStatusEnum = pgEnum('sync_log_status', [
  'running',
  'success',
  'partial',
  'error'
]);

// Review sync logs table
export const reviewSyncLogs = pgTable("review_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => reviewSources.id, { onDelete: 'cascade' }),
  
  // Timing
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  
  // Status
  status: text("status").notNull().default("running"), // 'running', 'success', 'partial', 'error'
  errorMessage: text("error_message"),
  
  // Stats
  fetchedCount: integer("fetched_count").default(0),
  newCount: integer("new_count").default(0),
  updatedCount: integer("updated_count").default(0),
  
  // Request info
  requestUrl: text("request_url"),
  responseCode: integer("response_code"),
});

// Insert schema for sync logs
export const insertReviewSyncLogSchema = createInsertSchema(reviewSyncLogs).omit({
  id: true,
  startedAt: true,
});

// Types for sync logs
export type InsertReviewSyncLog = z.infer<typeof insertReviewSyncLogSchema>;
export type ReviewSyncLog = typeof reviewSyncLogs.$inferSelect;

// ===== REVIEW SOURCES API SCHEMAS =====

// Schema for connecting TripAdvisor (just URL)
export const connectTripAdvisorSchema = z.object({
  tripadvisorUrl: z.string().url("URL TripAdvisor invalide"),
  displayName: z.string().min(1).max(255).optional(),
});

// Schema for initiating Google OAuth
export const initiateGoogleOAuthSchema = z.object({
  redirectUri: z.string().url().optional(),
});

// Schema for initiating Facebook OAuth
export const initiateFacebookOAuthSchema = z.object({
  redirectUri: z.string().url().optional(),
});

// Schema for manual sync trigger
export const triggerSyncSchema = z.object({
  sourceId: z.string().uuid(),
  fullSync: z.boolean().default(false),
});

// Types
export type ConnectTripAdvisor = z.infer<typeof connectTripAdvisorSchema>;
export type InitiateGoogleOAuth = z.infer<typeof initiateGoogleOAuthSchema>;
export type InitiateFacebookOAuth = z.infer<typeof initiateFacebookOAuthSchema>;
export type TriggerSync = z.infer<typeof triggerSyncSchema>;

// ===== MARKETING MODULE =====

// Marketing channel enum
export const marketingChannelEnum = pgEnum('marketing_channel', [
  'email',
  'sms',
  'both'
]);

// Marketing campaign status enum
export const marketingCampaignStatusEnum = pgEnum('marketing_campaign_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
  'cancelled'
]);

// Marketing campaign type enum
export const marketingCampaignTypeEnum = pgEnum('marketing_campaign_type', [
  'promo',
  'menu',
  'birthday',
  'event',
  'reactivation',
  'welcome',
  'custom'
]);

// Marketing send status enum
export const marketingSendStatusEnum = pgEnum('marketing_send_status', [
  'pending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'failed',
  'unsubscribed'
]);

// Marketing automation trigger enum
export const marketingAutomationTriggerEnum = pgEnum('marketing_automation_trigger', [
  'new_contact',
  'birthday',
  'inactive_30d',
  'inactive_60d',
  'post_visit',
  'tag_added',
  'segment_entered',
  'manual'
]);

// Marketing contact source enum
export const marketingContactSourceEnum = pgEnum('marketing_contact_source', [
  'speedai',
  'crm',
  'import',
  'manual',
  'website'
]);

// Marketing contacts table
export const marketingContacts = pgTable("marketing_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Contact info
  email: text("email"),
  phone: text("phone"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  
  // Source & external reference
  source: text("source").notNull().default("manual"), // 'speedai', 'crm', 'import', 'manual', 'website'
  externalId: text("external_id"), // ID in external CRM
  
  // RGPD Consent
  optInEmail: boolean("opt_in_email").notNull().default(true),
  optInSms: boolean("opt_in_sms").notNull().default(true),
  consentEmailAt: timestamp("consent_email_at"),
  consentSmsAt: timestamp("consent_sms_at"),
  consentWithdrawnAt: timestamp("consent_withdrawn_at"),
  
  // Profile data
  birthDate: date("birth_date"),
  language: text("language").default("fr"),
  tags: text("tags").array(),
  
  // Behavioral data
  totalVisits: integer("total_visits").default(0),
  lastVisitAt: timestamp("last_visit_at"),
  avgSpend: decimal("avg_spend", { precision: 10, scale: 2 }),
  preferredDay: text("preferred_day"),
  preferredTime: text("preferred_time"),
  
  // Engagement stats
  totalEmailsSent: integer("total_emails_sent").default(0),
  totalEmailsOpened: integer("total_emails_opened").default(0),
  totalEmailsClicked: integer("total_emails_clicked").default(0),
  totalSmsSent: integer("total_sms_sent").default(0),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  lastSmsSentAt: timestamp("last_sms_sent_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for marketing contacts
export const insertMarketingContactSchema = createInsertSchema(marketingContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalEmailsSent: true,
  totalEmailsOpened: true,
  totalEmailsClicked: true,
  totalSmsSent: true,
}).extend({
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
});

// Types for marketing contacts
export type InsertMarketingContact = z.infer<typeof insertMarketingContactSchema>;
export type MarketingContact = typeof marketingContacts.$inferSelect;

// Marketing consent history (RGPD audit trail)
export const marketingConsentHistory = pgTable("marketing_consent_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => marketingContacts.id, { onDelete: 'cascade' }),
  
  action: text("action").notNull(), // 'opt_in', 'opt_out', 'updated'
  channel: text("channel").notNull(), // 'email', 'sms', 'both'
  source: text("source").notNull(), // 'form', 'import', 'unsubscribe_link', 'admin'
  
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Types for consent history
export type MarketingConsentHistory = typeof marketingConsentHistory.$inferSelect;

// Marketing segments table
export const marketingSegments = pgTable("marketing_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  name: text("name").notNull(),
  description: text("description"),
  
  // Filter configuration (JSON)
  filters: jsonb("filters"), // { visits_min: 2, inactive_days: 30, tags: ['vip'], ... }
  
  // Settings
  isSystem: boolean("is_system").notNull().default(false), // Pre-built segments
  autoUpdate: boolean("auto_update").notNull().default(true),
  
  // Cached count
  contactCount: integer("contact_count").default(0),
  lastCalculatedAt: timestamp("last_calculated_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for segments
export const insertMarketingSegmentSchema = createInsertSchema(marketingSegments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  contactCount: true,
  lastCalculatedAt: true,
});

// Types for segments
export type InsertMarketingSegment = z.infer<typeof insertMarketingSegmentSchema>;
export type MarketingSegment = typeof marketingSegments.$inferSelect;

// Marketing templates table
export const marketingTemplates = pgTable("marketing_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }), // NULL = system template
  
  name: text("name").notNull(),
  description: text("description"),
  
  // Categorization
  category: text("category").notNull(), // 'promo', 'event', 'birthday', 'reactivation', 'welcome', 'custom'
  businessType: text("business_type"), // 'restaurant', 'garage', 'kine', 'all'
  channel: text("channel").notNull(), // 'email', 'sms', 'both'
  
  // Content
  emailSubject: text("email_subject"),
  emailContent: text("email_content"), // HTML content
  emailPreviewText: text("email_preview_text"),
  smsContent: text("sms_content"),
  
  // Variables used
  variables: text("variables").array(), // ['{prénom}', '{restaurant}', '{code_promo}']
  
  // Flags
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  
  // Stats
  timesUsed: integer("times_used").default(0),
  
  // Thumbnail for preview
  thumbnailUrl: text("thumbnail_url"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for templates
export const insertMarketingTemplateSchema = createInsertSchema(marketingTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  timesUsed: true,
});

// Types for templates
export type InsertMarketingTemplate = z.infer<typeof insertMarketingTemplateSchema>;
export type MarketingTemplate = typeof marketingTemplates.$inferSelect;

// Marketing campaigns table
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Basic info
  name: text("name").notNull(),
  type: text("type").notNull(), // 'promo', 'menu', 'birthday', 'event', 'reactivation', 'welcome', 'custom'
  status: text("status").notNull().default("draft"), // 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
  channel: text("channel").notNull(), // 'email', 'sms', 'both'
  
  // Content
  emailSubject: text("email_subject"),
  emailContent: text("email_content"), // HTML
  emailPreviewText: text("email_preview_text"),
  smsContent: text("sms_content"),
  
  // Template reference (if used)
  templateId: varchar("template_id").references(() => marketingTemplates.id),
  
  // Targeting
  segmentId: varchar("segment_id").references(() => marketingSegments.id),
  targetAll: boolean("target_all").default(false),
  customFilters: jsonb("custom_filters"), // For advanced targeting without segment
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at"),
  sendingStartedAt: timestamp("sending_started_at"),
  sentAt: timestamp("sent_at"),
  
  // A/B Testing
  isAbTest: boolean("is_ab_test").default(false),
  abVariantOf: varchar("ab_variant_of"), // Parent campaign ID for A/B test
  abTestPercentage: integer("ab_test_percentage"), // % of audience for this variant
  
  // Stats (aggregated)
  totalRecipients: integer("total_recipients").default(0),
  totalSent: integer("total_sent").default(0),
  totalDelivered: integer("total_delivered").default(0),
  totalOpened: integer("total_opened").default(0),
  totalClicked: integer("total_clicked").default(0),
  totalConverted: integer("total_converted").default(0),
  totalUnsubscribed: integer("total_unsubscribed").default(0),
  totalBounced: integer("total_bounced").default(0),
  totalFailed: integer("total_failed").default(0),
  
  // Revenue attribution
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
  
  // Cost tracking
  emailCost: decimal("email_cost", { precision: 10, scale: 2 }).default("0"),
  smsCost: decimal("sms_cost", { precision: 10, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for campaigns
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sendingStartedAt: true,
  sentAt: true,
  totalRecipients: true,
  totalSent: true,
  totalDelivered: true,
  totalOpened: true,
  totalClicked: true,
  totalConverted: true,
  totalUnsubscribed: true,
  totalBounced: true,
  totalFailed: true,
  totalRevenue: true,
  emailCost: true,
  smsCost: true,
});

// Types for campaigns
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;

// Marketing sends table (individual send tracking)
export const marketingSends = pgTable("marketing_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => marketingContacts.id, { onDelete: 'cascade' }),
  
  channel: text("channel").notNull(), // 'email' or 'sms'
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed'
  
  // Tracking IDs
  trackingId: varchar("tracking_id").notNull().default(sql`gen_random_uuid()`), // Unique ID for tracking links/pixels
  externalMessageId: text("external_message_id"), // Resend/Twilio message ID
  
  // Delivery info
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  
  // Timestamps
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  convertedAt: timestamp("converted_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  bouncedAt: timestamp("bounced_at"),
  failedAt: timestamp("failed_at"),
  
  // Conversion tracking
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }),
  conversionType: text("conversion_type"), // 'reservation', 'purchase', 'visit'
  
  // Click tracking
  clickCount: integer("click_count").default(0),
  lastClickedUrl: text("last_clicked_url"),
  
  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types for sends
export type MarketingSend = typeof marketingSends.$inferSelect;

// Marketing automations table
export const marketingAutomations = pgTable("marketing_automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  name: text("name").notNull(),
  description: text("description"),
  
  // Trigger configuration
  triggerType: text("trigger_type").notNull(), // 'new_contact', 'birthday', 'inactive_30d', 'inactive_60d', 'post_visit', 'tag_added', 'segment_entered', 'manual'
  triggerConfig: jsonb("trigger_config"), // { tag: 'vip', days_before: 3, segment_id: '...' }
  
  // Actions (workflow steps)
  actions: jsonb("actions"), // [{ type: 'email', templateId: '...', delay: '0' }, { type: 'wait', delay: '7d' }, ...]
  
  // Status
  isActive: boolean("is_active").notNull().default(false),
  
  // Stats
  totalTriggered: integer("total_triggered").default(0),
  totalCompleted: integer("total_completed").default(0),
  totalFailed: integer("total_failed").default(0),
  
  // Timing
  lastTriggeredAt: timestamp("last_triggered_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for automations
export const insertMarketingAutomationSchema = createInsertSchema(marketingAutomations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalTriggered: true,
  totalCompleted: true,
  totalFailed: true,
  lastTriggeredAt: true,
});

// Types for automations
export type InsertMarketingAutomation = z.infer<typeof insertMarketingAutomationSchema>;
export type MarketingAutomation = typeof marketingAutomations.$inferSelect;

// Marketing automation logs table
export const marketingAutomationLogs = pgTable("marketing_automation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id").notNull().references(() => marketingAutomations.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => marketingContacts.id, { onDelete: 'cascade' }),
  
  // Execution status
  status: text("status").notNull(), // 'running', 'completed', 'failed', 'cancelled'
  currentStep: integer("current_step").default(0),
  
  // Timing
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  nextStepAt: timestamp("next_step_at"), // When next step should execute
  
  // Error handling
  errorMessage: text("error_message"),
  
  // Context data
  contextData: jsonb("context_data"), // Any data needed for template variables
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Types for automation logs
export type MarketingAutomationLog = typeof marketingAutomationLogs.$inferSelect;

// Marketing click tracking table (for detailed link tracking)
export const marketingClickEvents = pgTable("marketing_click_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sendId: varchar("send_id").notNull().references(() => marketingSends.id, { onDelete: 'cascade' }),
  
  url: text("url").notNull(),
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
  
  // Device info
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  device: text("device"), // 'mobile', 'desktop', 'tablet'
  browser: text("browser"),
  os: text("os"),
  
  // Geo info (optional)
  country: text("country"),
  city: text("city"),
});

// Types for click events
export type MarketingClickEvent = typeof marketingClickEvents.$inferSelect;

// ===== MARKETING API SCHEMAS =====

// Schema for importing contacts
export const importContactsSchema = z.object({
  contacts: z.array(z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    tags: z.array(z.string()).optional(),
    birthDate: z.string().optional(),
  })),
  optInEmail: z.boolean().default(true),
  optInSms: z.boolean().default(true),
  source: z.string().default("import"),
  deduplicateBy: z.enum(["email", "phone", "both"]).default("email"),
});

// Schema for creating a quick campaign (simple mode)
export const createQuickCampaignSchema = z.object({
  templateId: z.string().uuid(),
  segmentType: z.enum(["all", "recent", "inactive", "vip", "custom"]),
  customSegmentId: z.string().uuid().optional(),
  channel: z.enum(["email", "sms", "both"]),
  customizations: z.object({
    discountPercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().min(0).optional(),
    validUntil: z.string().optional(),
    customMessage: z.string().optional(),
  }).optional(),
  scheduledAt: z.string().datetime().optional(),
});

// Schema for segment filters
export const segmentFiltersSchema = z.object({
  visitsMin: z.number().optional(),
  visitsMax: z.number().optional(),
  inactiveDays: z.number().optional(),
  avgSpendMin: z.number().optional(),
  avgSpendMax: z.number().optional(),
  tags: z.array(z.string()).optional(),
  tagsExclude: z.array(z.string()).optional(),
  source: z.string().optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  birthdayMonth: z.number().min(1).max(12).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

// Types
export type ImportContacts = z.infer<typeof importContactsSchema>;
export type CreateQuickCampaign = z.infer<typeof createQuickCampaignSchema>;
export type SegmentFilters = z.infer<typeof segmentFiltersSchema>;

// ===== EXTERNAL INTEGRATIONS SYSTEM =====

// Integration provider enum - all supported CRMs and databases
export const integrationProviderEnum = pgEnum('integration_provider', [
  // Generic CRMs
  'hubspot',
  'salesforce',
  'zoho',
  'pipedrive',
  'monday',
  'notion',
  'airtable',
  // Restaurant/Hospitality
  'zenchef',
  'thefork',
  'resy',
  'opentable',
  'lightspeed_restaurant',
  // Hotel/Lodging
  'mews',
  'cloudbeds',
  'opera_pms',
  'booking_com',
  'airbnb',
  // Medical
  'doctolib',
  'drchrono',
  'kareo',
  // E-commerce
  'shopify',
  'woocommerce',
  'prestashop',
  'magento',
  'stripe',
  // Databases
  'postgresql',
  'mysql',
  'mongodb',
  'google_sheets',
  // Other
  'custom_api',
  'webhook'
]);

// Integration auth type enum
export const integrationAuthTypeEnum = pgEnum('integration_auth_type', [
  'oauth2',
  'api_key',
  'basic_auth',
  'database_credentials',
  'webhook_secret'
]);

// Integration sync status enum
export const integrationSyncStatusEnum = pgEnum('integration_sync_status', [
  'pending',
  'syncing',
  'success',
  'partial',
  'failed'
]);

// Integration entity type enum - canonical data types
export const integrationEntityTypeEnum = pgEnum('integration_entity_type', [
  'contact',
  'company',
  'deal',
  'order',
  'reservation',
  'appointment',
  'product',
  'invoice',
  'payment',
  'activity',
  'custom'
]);

// External connections table - stores CRM/DB connection configs
export const externalConnections = pgTable("external_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Provider info
  provider: text("provider").notNull(), // 'hubspot', 'salesforce', etc.
  name: text("name").notNull(), // User-friendly name (e.g., "Mon HubSpot Principal")
  description: text("description"),
  
  // Authentication
  authType: text("auth_type").notNull(), // 'oauth2', 'api_key', 'database_credentials'
  
  // OAuth2 tokens (encrypted)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes").array(),
  
  // API Key auth
  apiKey: text("api_key"), // Encrypted
  apiSecret: text("api_secret"), // Encrypted
  
  // Database connection (encrypted)
  connectionString: text("connection_string"),
  dbHost: text("db_host"),
  dbPort: integer("db_port"),
  dbName: text("db_name"),
  dbUser: text("db_user"),
  dbPassword: text("db_password"),
  
  // Webhook config
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  
  // Provider-specific config
  instanceUrl: text("instance_url"), // For Salesforce, custom instances
  accountId: text("account_id"), // External account identifier
  
  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'active', 'error', 'disconnected'
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  
  // Sync settings
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  syncFrequency: text("sync_frequency").default("daily"), // 'realtime', 'hourly', 'daily', 'weekly', 'manual'
  syncDirection: text("sync_direction").default("pull"), // 'pull', 'push', 'bidirectional'
  
  // Entity types to sync
  enabledEntities: text("enabled_entities").array().default(sql`ARRAY['contact', 'order']::text[]`),
  
  // Timestamps
  connectedAt: timestamp("connected_at"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schema for external connections
export const insertExternalConnectionSchema = createInsertSchema(externalConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for external connections
export type InsertExternalConnection = z.infer<typeof insertExternalConnectionSchema>;
export type ExternalConnection = typeof externalConnections.$inferSelect;

// External sync jobs table - tracks sync operations
export const externalSyncJobs = pgTable("external_sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull().references(() => externalConnections.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Job info
  jobType: text("job_type").notNull(), // 'full', 'incremental', 'entity_specific'
  entityTypes: text("entity_types").array(), // Which entities to sync
  
  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed', 'cancelled'
  progress: integer("progress").default(0), // 0-100
  
  // Sync checkpoint (for incremental syncs)
  checkpoint: jsonb("checkpoint"), // { lastSyncedId, lastModifiedDate, cursor }
  
  // Results
  totalRecords: integer("total_records").default(0),
  processedRecords: integer("processed_records").default(0),
  createdRecords: integer("created_records").default(0),
  updatedRecords: integer("updated_records").default(0),
  failedRecords: integer("failed_records").default(0),
  skippedRecords: integer("skipped_records").default(0),
  
  // Error tracking
  errors: jsonb("errors"), // Array of { record, error, timestamp }
  
  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Types for sync jobs
export type ExternalSyncJob = typeof externalSyncJobs.$inferSelect;

// Field mappings table - maps external fields to canonical schema
export const externalFieldMappings = pgTable("external_field_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull().references(() => externalConnections.id, { onDelete: 'cascade' }),
  
  // Entity type this mapping applies to
  entityType: text("entity_type").notNull(), // 'contact', 'order', etc.
  
  // Mapping config
  mappings: jsonb("mappings").notNull(), // { sourceField: targetField, transforms: [] }
  
  // Custom fields
  customFields: jsonb("custom_fields"), // Additional fields to capture
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types for field mappings
export type ExternalFieldMapping = typeof externalFieldMappings.$inferSelect;

// External customers table - unified customer data from all sources
export const externalCustomers = pgTable("external_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  connectionId: varchar("connection_id").references(() => externalConnections.id, { onDelete: 'set null' }),
  
  // External references
  externalId: text("external_id"), // ID in external system
  externalSource: text("external_source"), // 'hubspot', 'salesforce', etc.
  
  // Link to marketing contact if exists
  marketingContactId: varchar("marketing_contact_id").references(() => marketingContacts.id, { onDelete: 'set null' }),
  
  // Contact info
  email: text("email"),
  phone: text("phone"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  
  // Company info
  companyName: text("company_name"),
  companyId: text("company_id"),
  jobTitle: text("job_title"),
  
  // Address
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country"),
  
  // Financial summary (calculated from orders/transactions)
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0"),
  totalOrders: integer("total_orders").default(0),
  avgOrderValue: decimal("avg_order_value", { precision: 10, scale: 2 }),
  lastOrderAt: timestamp("last_order_at"),
  firstOrderAt: timestamp("first_order_at"),
  
  // Customer value scoring
  lifetimeValue: decimal("lifetime_value", { precision: 12, scale: 2 }).default("0"),
  customerScore: integer("customer_score"), // 0-100
  customerSegment: text("customer_segment"), // 'vip', 'regular', 'new', 'at_risk', 'lost'
  
  // Engagement
  totalVisits: integer("total_visits").default(0),
  lastVisitAt: timestamp("last_visit_at"),
  
  // Additional data (raw from source)
  metadata: jsonb("metadata"),
  
  // Sync tracking
  lastSyncedAt: timestamp("last_synced_at"),
  syncStatus: text("sync_status").default("synced"), // 'synced', 'pending', 'conflict'
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types for external customers
export type ExternalCustomer = typeof externalCustomers.$inferSelect;

// External orders/transactions table - all purchases from CRM/POS
export const externalOrders = pgTable("external_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  connectionId: varchar("connection_id").references(() => externalConnections.id, { onDelete: 'set null' }),
  customerId: varchar("customer_id").references(() => externalCustomers.id, { onDelete: 'set null' }),
  
  // External references
  externalId: text("external_id").notNull(), // Order ID in external system
  externalSource: text("external_source").notNull(),
  
  // Order info
  orderNumber: text("order_number"),
  orderType: text("order_type"), // 'sale', 'refund', 'reservation', 'booking'
  status: text("status"), // 'pending', 'confirmed', 'completed', 'cancelled', 'refunded'
  
  // Financial
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("EUR"),
  
  // Payment
  paymentStatus: text("payment_status"), // 'pending', 'paid', 'partial', 'refunded'
  paymentMethod: text("payment_method"), // 'card', 'cash', 'bank_transfer', etc.
  
  // Order details
  itemsCount: integer("items_count"),
  items: jsonb("items"), // Array of { name, quantity, unitPrice, total }
  
  // For reservations/appointments
  reservationDate: timestamp("reservation_date"),
  reservationTime: text("reservation_time"),
  partySize: integer("party_size"),
  tableName: text("table_name"),
  
  // Channel info
  channel: text("channel"), // 'in_store', 'online', 'phone', 'app'
  
  // Staff/attribution
  staffName: text("staff_name"),
  staffId: text("staff_id"),
  
  // Customer details at time of order
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  
  // Notes
  notes: text("notes"),
  
  // Raw data from source
  metadata: jsonb("metadata"),
  
  // Timestamps
  orderDate: timestamp("order_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types for external orders
export type ExternalOrder = typeof externalOrders.$inferSelect;

// External products table - products/services from connected systems
export const externalProducts = pgTable("external_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  connectionId: varchar("connection_id").references(() => externalConnections.id, { onDelete: 'set null' }),
  
  // External references
  externalId: text("external_id").notNull(),
  externalSource: text("external_source").notNull(),
  
  // Product info
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  sku: text("sku"),
  
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: text("currency").default("EUR"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Stats (calculated)
  totalSold: integer("total_sold").default(0),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types for external products
export type ExternalProduct = typeof externalProducts.$inferSelect;

// External transactions table - individual payment transactions for detailed financial tracking
export const externalTransactions = pgTable("external_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  connectionId: varchar("connection_id").references(() => externalConnections.id, { onDelete: 'set null' }),
  customerId: varchar("customer_id").references(() => externalCustomers.id, { onDelete: 'set null' }),
  orderId: varchar("order_id").references(() => externalOrders.id, { onDelete: 'set null' }),
  
  // External references
  externalId: text("external_id").notNull(),
  externalSource: text("external_source").notNull(),
  
  // Transaction info
  transactionType: text("transaction_type").notNull(), // 'payment', 'refund', 'chargeback', 'payout', 'adjustment'
  status: text("status").notNull(), // 'pending', 'completed', 'failed', 'cancelled', 'disputed'
  
  // Financial
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("EUR"),
  fee: decimal("fee", { precision: 10, scale: 2 }),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }),
  
  // Payment details
  paymentMethod: text("payment_method"), // 'card', 'bank_transfer', 'cash', 'paypal', etc.
  paymentProvider: text("payment_provider"), // 'stripe', 'paypal', 'square', etc.
  paymentReference: text("payment_reference"), // Payment provider reference ID
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"),
  
  // Timing
  transactionDate: timestamp("transaction_date").notNull(),
  processedAt: timestamp("processed_at"),
  
  // Additional context
  description: text("description"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types for external transactions
export type ExternalTransaction = typeof externalTransactions.$inferSelect;
export type InsertExternalTransaction = typeof externalTransactions.$inferInsert;

// External activities table - all customer interactions from CRM
export const externalActivities = pgTable("external_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  connectionId: varchar("connection_id").references(() => externalConnections.id, { onDelete: 'set null' }),
  customerId: varchar("customer_id").references(() => externalCustomers.id, { onDelete: 'set null' }),
  
  // External references
  externalId: text("external_id"),
  externalSource: text("external_source").notNull(),
  
  // Activity info
  activityType: text("activity_type").notNull(), // 'call', 'email', 'meeting', 'note', 'task', 'visit'
  subject: text("subject"),
  description: text("description"),
  
  // Outcome
  outcome: text("outcome"), // 'completed', 'no_answer', 'scheduled', etc.
  
  // Staff
  staffName: text("staff_name"),
  staffId: text("staff_id"),
  
  // Timestamps
  activityDate: timestamp("activity_date").notNull(),
  duration: integer("duration"), // In minutes
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Types for external activities
export type ExternalActivity = typeof externalActivities.$inferSelect;

// Integration webhooks table - for real-time sync
export const integrationWebhooks = pgTable("integration_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull().references(() => externalConnections.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Webhook config
  event: text("event").notNull(), // 'contact.created', 'order.completed', etc.
  webhookId: text("webhook_id"), // ID in external system
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Stats
  totalReceived: integer("total_received").default(0),
  lastReceivedAt: timestamp("last_received_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Types for integration webhooks
export type IntegrationWebhook = typeof integrationWebhooks.$inferSelect;

// Integration provider configs table - stores provider-specific metadata
export const integrationProviderConfigs = pgTable("integration_provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Provider info
  provider: text("provider").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'crm', 'restaurant', 'hotel', 'medical', 'ecommerce', 'database'
  
  // Logo/branding
  logoUrl: text("logo_url"),
  color: text("color"), // Brand color hex
  
  // Auth config
  authType: text("auth_type").notNull(),
  oauthAuthUrl: text("oauth_auth_url"),
  oauthTokenUrl: text("oauth_token_url"),
  requiredScopes: text("required_scopes").array(),
  
  // API config
  apiBaseUrl: text("api_base_url"),
  apiVersion: text("api_version"),
  
  // Rate limits
  rateLimitRequests: integer("rate_limit_requests"),
  rateLimitWindow: integer("rate_limit_window"), // In seconds
  
  // Supported entities
  supportedEntities: text("supported_entities").array(),
  
  // Feature flags
  supportsWebhooks: boolean("supports_webhooks").default(false),
  supportsRealtime: boolean("supports_realtime").default(false),
  supportsBidirectional: boolean("supports_bidirectional").default(false),
  
  // Status
  isEnabled: boolean("is_enabled").default(true),
  isPremium: boolean("is_premium").default(false), // Requires premium plan
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types for provider configs
export type IntegrationProviderConfig = typeof integrationProviderConfigs.$inferSelect;

// ===== INTEGRATION API SCHEMAS =====

// Schema for creating a new connection
export const createConnectionSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  authType: z.enum(['oauth2', 'api_key', 'basic_auth', 'database_credentials', 'webhook_secret']),
  syncFrequency: z.enum(['realtime', 'hourly', 'daily', 'weekly', 'manual']).default('daily'),
  syncDirection: z.enum(['pull', 'push', 'bidirectional']).default('pull'),
  enabledEntities: z.array(z.string()).default(['contact', 'order']),
});

// Schema for OAuth callback
export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

// Schema for API key connection
export const apiKeyConnectionSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().optional(),
  instanceUrl: z.string().optional(),
});

// Schema for database connection
export const databaseConnectionSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().default(true),
});

// Types
export type CreateConnection = z.infer<typeof createConnectionSchema>;
export type OAuthCallback = z.infer<typeof oauthCallbackSchema>;
export type APIKeyConnection = z.infer<typeof apiKeyConnectionSchema>;
export type DatabaseConnection = z.infer<typeof databaseConnectionSchema>;
