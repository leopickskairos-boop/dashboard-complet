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
