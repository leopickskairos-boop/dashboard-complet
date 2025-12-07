import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
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
  'monthly_report_ready'
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
export const n8nCallWebhookSchema = z.object({
  // Basic call info (required)
  phoneNumber: z.string().min(1, "Numéro de téléphone requis"),
  status: z.enum(['active', 'completed', 'failed', 'canceled', 'no_answer']),
  startTime: z.string().datetime({ message: "Format de date invalide pour startTime" }),
  
  // Basic call info (optional)
  endTime: z.string().datetime({ message: "Format de date invalide pour endTime" }).optional(),
  duration: z.number().int().min(0).optional(),
  
  // External references
  call_id: z.string().optional(),
  agent_id: z.string().optional(),
  
  // Call type and event
  event_type: z.string().optional(),
  
  // Call outcome
  call_answered: z.boolean().optional(),
  is_out_of_scope: z.boolean().optional(),
  conversion_result: z.string().optional(),
  call_successful: z.boolean().optional(),
  disconnection_reason: z.string().optional(),
  
  // Content
  summary: z.string().optional(),
  transcript: z.string().optional(),
  tags: z.array(z.string()).optional(),
  
  // Appointment details
  appointmentDate: z.string().datetime({ message: "Format de date invalide pour appointmentDate" }).optional(),
  appointmentHour: z.number().int().min(0).max(23).optional(),
  appointmentDayOfWeek: z.number().int().min(0).max(6).optional(),
  booking_delay_days: z.number().int().optional(),
  is_last_minute: z.boolean().optional(),
  group_category: z.string().optional(),
  
  // N8N specific fields (ignored but accepted)
  dashboard_api_key: z.string().optional(),
  dashboard_url: z.string().optional(),
  collected_at: z.string().datetime().optional(),
  
  // Rich metadata from N8N (all fields extracted)
  metadata: z.object({
    event_type: z.string().optional(),
    agency_name: z.string().optional(),
    company_name: z.string().optional(),
    nb_personnes: z.number().int().optional(),
    group_category: z.string().optional(),
    service_type: z.string().optional(),
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
    booking_confidence: z.number().int().min(0).max(100).optional(),
    questions_asked: z.array(z.string()).optional(),
    objections: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    pain_points: z.array(z.string()).optional(),
    compliments: z.array(z.string()).optional(),
    upsell_accepted: z.boolean().nullable().optional(),
    competitor_mentioned: z.boolean().optional(),
    language_detected: z.string().optional(),
    call_quality: z.string().optional(),
    calendar_id: z.string().nullable().optional(),
    timezone: z.string().optional(),
    recording_url: z.string().nullable().optional(),
  }).passthrough().optional(), // passthrough allows additional unknown fields
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
  
  // Email expéditeur
  gmailSenderEmail: text("gmail_sender_email"),
  gmailSenderName: text("gmail_sender_name"),
  
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
  
  // Infos client final
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  nbPersons: integer("nb_persons").notNull().default(1),
  reservationDate: timestamp("reservation_date").notNull(),
  reservationTime: text("reservation_time"), // Heure au format HH:MM
  
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
  
  // Relances
  reminderCount: integer("reminder_count").notNull().default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  
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
  reservation_date: z.string(), // ISO date string
  reservation_time: z.string().optional(), // HH:MM
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
  
  // Plateformes (liens directs)
  googlePlaceId: text("google_place_id"),
  googleReviewUrl: text("google_review_url"),
  tripadvisorUrl: text("tripadvisor_url"),
  facebookPageUrl: text("facebook_page_url"),
  pagesJaunesUrl: text("pages_jaunes_url"),
  doctolibUrl: text("doctolib_url"),
  yelpUrl: text("yelp_url"),
  
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
  linkClickedAt: timestamp("link_clicked_at"),
  platformClicked: text("platform_clicked"),
  
  // Confirmation
  reviewConfirmedAt: timestamp("review_confirmed_at"),
  reviewConfirmedPlatform: text("review_confirmed_platform"),
  
  // Incitation
  incentiveId: varchar("incentive_id").references(() => reviewIncentives.id, { onDelete: 'set null' }),
  promoCode: text("promo_code"),
  promoCodeUsedAt: timestamp("promo_code_used_at"),
  
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
