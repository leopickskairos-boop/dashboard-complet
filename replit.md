# SpeedAI - Plateforme IA Réceptionniste Vocale

## Overview

SpeedAI is a SaaS platform designed to automate business phone calls using Artificial Intelligence. It provides companies with real-time call summaries and statistics through a professional dashboard, aiming to streamline communication and provide actionable insights. The project's ambition is to integrate advanced AI voice capabilities for a comprehensive receptionist solution.

## User Preferences

I prefer detailed explanations and iterative development. Ask before making major changes. Do not make changes to the folder Z and to the file Y.

## System Architecture

The project utilizes a modern web stack:
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI for a responsive and professional user interface.
- **Backend**: Express.js with Node.js.
- **Database**: PostgreSQL (Neon) managed with Drizzle ORM.
- **Authentication**: Secure JWT sessions with httpOnly cookies.
- **Payments**: Stripe Subscriptions with webhook integration for automated payment processing.
- **Email**: Gmail SMTP integration (speedaivoiceai@gmail.com) for sending verification emails, password reset links, and monthly PDF reports. Email links automatically use the application's public URL via intelligent environment variable cascade:
  1. `FRONTEND_URL` (custom domain/production override)
  2. `REPLIT_DEV_DOMAIN` (automatic Replit public URL)
  3. `localhost:5000` (local development fallback)

**Key Features Implemented (MVP Phase 1 - Complete):**
- **Comprehensive Authentication System**: User registration with double password confirmation, email verification, secure login, password reset, and account management. Passwords are hashed with bcrypt, and secure tokens are used for verification and resets. All password input fields feature eye icons for toggling visibility, improving user experience and reducing input errors.
- **30-Day Free Trial System**: New users receive immediate dashboard access with a 30-day free trial. No payment required at signup - Stripe Customer is created automatically for seamless conversion.
- **Multi-Tier Subscription Model**: Three subscription plans available:
  - **Basic**: €400/month (Stripe Price ID: price_1SRfP3442ACh1eI8PFt5z2b4)
  - **Standard**: €800/month (Stripe Price ID: price_1QvKJl442ACh1eI85LGNRt9O)
  - **Premium**: €1000/month (Stripe Price ID: price_1SRfPE442ACh1eI8pzFhIJLH)
- **Automated Trial-to-Paid Conversion**: Daily cron service (3:00 AM) checks trial expirations, generates Stripe Checkout Sessions per assigned plan, sends payment links via email, and updates account status. Stripe webhooks (subscription.created, invoice.payment_succeeded) automatically activate accounts on successful payment.
- **Admin Plan Assignment**: Admins can assign subscription plans to trial users via dropdown interface, enabling targeted tier management during trial period.
- **User Dashboard**: Protected dashboard accessible to verified users (trial or active subscription), featuring real-time statistics (total calls, active calls, conversion rate, average call duration), temporal filters, dynamic charts (Recharts), and trial countdown banner showing days remaining.
- **Notification System**: A robust notification center with filtering options (time, type, read/unread status), user preferences for notification types (daily summaries, failed calls, active calls, subscription alerts), and an alert banner for expiring subscriptions. Automatic notification generation for key events (e.g., subscription changes, password changes).
- **Monthly PDF Reports**: Automated system generating professional monthly activity reports sent 2 days before subscription renewal. Reports include:
  - 4 key metrics (total calls, completed calls, conversion rate, avg duration) with month-over-month comparisons
  - 3 interactive charts (call volume timeline, status distribution pie chart, hourly activity heatmap)
  - 3 automatic insights sections (peak hours, status distribution, monthly comparison)
  - Email delivery with PDF attachment and dashboard notification
  - Downloadable reports accessible in Account page
  - Production-ready cron service (runs daily at 2:00 AM) with idempotency guard preventing duplicates
  - File storage service with MD5 integrity checksums
  - Secure API routes with authentication and ownership verification

**Admin Dashboard (Phase 2 - Complete):**
- **Secure Admin Interface**: Protected route `/admin` accessible only to administrators with dedicated middleware (`requireAdmin`).
- **User Management Dashboard**: Comprehensive table showing all users with real-time statistics, subscription status, and account status.
- **Health Monitoring System**: Automatic health indicator for each user's dashboard:
  - 🟢 Green (Optimal): Normal operation, recent activity, failure rate < 20%
  - 🟠 Orange (Attention): Failure rate between 20-50% in last 24h
  - 🔴 Red (Critical): Failure rate > 50% OR no activity for 7+ days
- **Advanced Filtering**: Filter users by account status (active/suspended), subscription plan (free/paid), and health status.
- **Account Actions**: Suspend, activate, or delete user accounts with confirmation dialogs. Admins cannot delete their own account.
- **Statistics Display**: Total calls, total minutes used, last activity date, and registration date for each user.
- **N8N Webhook Integration**: Unique API keys for each client enabling automated call creation via external workflows.

**Trial System Details:**
- **Account States**: Users progress through states: `trial` (30-day access) → `expired` (trial ended, awaiting payment) → `active` (paid subscription) or `suspended` (admin action)
- **Trial Expiration Flow**: When trial ends, account status becomes `expired`, user redirected to trial-expired page, Stripe Checkout Session generated and sent via email
- **Automated Cron Jobs**: Two daily services run automatically:
  - Monthly Reports Cron (2:00 AM): Generates and emails PDF reports 2 days before subscription renewal
  - Trial Expiration Cron (3:00 AM): Processes expired trials and generates payment links

**Upcoming Features (Phase 3):**
- **AI Voice Integration**: Connection with AI voice services (Retell.ai, VAPI, ElevenLabs) for real-time call display, AI-generated summaries, and detailed analytics.
- **Security Enhancement**: Hash API keys with bcrypt/argon2 for maximum security (currently stored in plaintext).

**Design Guidelines**: The project adheres to strict design guidelines using Inter font, a consistent spacing scale, Shadcn UI components with variants, a token-based color system supporting dark mode, and a mobile-first responsive approach.

## External Dependencies

- **Stripe**: For subscription management, payment processing (Stripe Elements), and customer portal integration.
- **Neon (PostgreSQL)**: Managed PostgreSQL database service.
- **Drizzle ORM**: Object-Relational Mapper for database interactions.
- **Nodemailer (or similar)**: For sending transactional emails (e.g., email verification, password reset).
- **Retell.ai / VAPI / ElevenLabs**: Planned integrations for AI voice capabilities.