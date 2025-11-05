import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with authentication, email verification, and Stripe subscription
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  isVerified: boolean("is_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;

// Public user type (without sensitive data)
export type PublicUser = Omit<User, 'password' | 'verificationToken' | 'verificationTokenExpiry'>;
