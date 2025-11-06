import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
}).pick({
  email: true,
  password: true,
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
export type LoginCredentials = z.infer<typeof loginSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type User = typeof users.$inferSelect;

// Public user type (without sensitive data)
export type PublicUser = Omit<User, 'password' | 'verificationToken' | 'verificationTokenExpiry' | 'resetPasswordToken' | 'resetPasswordTokenExpiry'>;

// Calls table for tracking phone calls
export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  phoneNumber: text("phone_number").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // Duration in seconds
  status: text("status").notNull(), // 'active', 'completed', 'failed', 'canceled', 'no_answer'
  summary: text("summary"),
  appointmentDate: timestamp("appointment_date"), // Date du rendez-vous (seulement pour status 'completed')
  emailSent: boolean("email_sent").notNull().default(false),
  callSid: text("call_sid"), // External call reference from voice API
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
