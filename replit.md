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
  - **Standard**: €800/month (Stripe Price ID: price_1SQDvA442ACh1eI8X8ym3WC5)
  - **Premium**: €1000/month (Stripe Price ID: price_1SRfPE442ACh1eI8pzFhIJLH)
- **Automated Trial-to-Paid Conversion**: Daily cron service (3:00 AM) checks trial expirations, generates Stripe Checkout Sessions per assigned plan, sends payment links via email, and updates account status. Stripe webhooks (subscription.created, invoice.payment_succeeded) automatically activate accounts on successful payment.
- **Admin Plan Assignment**: Admins can assign subscription plans to trial users via dropdown interface, enabling targeted tier management during trial period.
- **User Dashboard**: Protected dashboard accessible to verified users (trial or active subscription), featuring:
  - **6 KPI Cards**: Total calls, active calls, conversion rate, average duration, hours saved (calls × 5min / 60), and estimated revenue (appointments × €80) - all with unified design
  - **AI Insights & Trends**: Intelligent section displaying exactly 3 data-driven recommendations powered by `AIInsightsService`:
    - **Personalized Analysis**: Analyzes real call data for best performing hours, optimal days, conversion trends, after-hours opportunities, and call duration patterns
    - **Smart Fallback System**: Guarantees 3 insights always - supplements with business tips when data insufficient
    - **Real-time Synchronization**: Insights update based on temporal filter selection (hour/today/2 days/week)
    - **Dynamic Icon Mapping**: Visual icons adapt to insight type (brain, chart, trending-up, lightbulb, calendar, target)
  - **Temporal Filters**: Real-time filtering across all statistics
  - **Dynamic Charts**: Recharts integration for visual analytics
  - **Trial Countdown Banner**: Shows days remaining for trial users
  - **Business Intelligence**: Automated calculation of time savings and revenue estimates based on call activity
- **Notification System**: A robust notification center with filtering options (time, type, read/unread status), user preferences for notification types (daily summaries, failed calls, active calls, subscription alerts), and an alert banner for expiring subscriptions. Automatic notification generation for key events (e.g., subscription changes, password changes).
- **Monthly PDF Reports**: Automated system generating professional monthly activity reports sent 2 days before subscription renewal. Reports include:
  - **Core Metrics (4 KPIs)**: Total calls, completed calls, conversion rate, average duration - all with month-over-month comparisons
  - **Business Metrics (6 KPIs)**: Appointments taken, appointment conversion rate, after-hours calls (19h-8h), time saved, estimated revenue (appointments × €150), ROI - all with N/N-1 comparisons
  - **Performance Score**: AI-calculated global score (0-100) based on weighted multi-criteria algorithm (conversion 35%, appointments 30%, after-hours 20%, efficiency 15%)
  - **Smart AI Recommendations**: Up to 4 intelligent insights/alerts per report:
    - Appointment decline detection (>15% drop triggers alert)
    - High failed call rate warnings (>25%)
    - Best performing time slots identification
    - After-hours opportunity analysis
    - Conversion rate trend alerts
  - **Interactive Charts**: Call volume timeline, status distribution pie chart, hourly activity heatmap
  - **Automatic Insights**: Peak hours, status distribution, monthly comparison
  - Email delivery with PDF attachment and dashboard notification
  - Downloadable reports accessible in Account page
  - Production-ready cron service (runs daily at 2:00 AM) with idempotency guard preventing duplicates
  - File storage service with MD5 integrity checksums
  - Secure API routes with authentication and ownership verification
  - **Business Assumptions**: Average client value €150, AI cost €50/month, business hours 8h-19h

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

**N8N Logs Router - Multi-Client Infrastructure (Phase 2.5 - Complete):**
- **Dynamic Log Reception**: Scalable endpoint `/api/logs/router/:clientId` for receiving N8N workflow data per client
- **Client Isolation**: Each client has dedicated storage directory `/reports/logs/{clientId}/`
- **Automatic Organization**: Files auto-named with ISO timestamps `log-{timestamp}.json`
- **Traceability**: Complete audit trail with horodated JSON logs for compliance and debugging
- **Scalability Benefits**:
  - 🔹 Multi-tenant ready: Zero data mixing between clients
  - 🔹 Integration ready: Foundation for CRM, analytics, external APIs
  - 🔹 Automation friendly: N8N workflows send to isolated client channels
  - 🔹 Future security: Prepared for per-client token authentication (TODO)
- **Example N8N Call**: `POST /api/logs/router/speedai_001` with JSON body containing event data
- **TODO**: Implement per-client API token authentication, optional PostgreSQL storage for analytics

**N8N Logs Visualization (Phase 2.6 - Complete):**
- **Dashboard Integration**: New "Logs N8N" section in client dashboard displaying all N8N workflow events
- **Comprehensive Filtering**: Dual filtering system with temporal and event type filters
  - **Temporal Filters**: "Toutes les périodes", "Il y a 1h", "Aujourd'hui", "Il y a 2 jours", "Cette semaine" (consistent with other dashboard sections)
  - **Event Filters**: "Tous les événements", "Test de connexion", "Appel démarré", "Appel terminé", "Webhook reçu"
- **API Endpoint**: `GET /api/logs/client/:id` with authentication, pagination (limit=50), and query parameters (event, startDate)
- **Interactive Table**: Displays timestamp (formatted French locale), event type (badge), source, and user email
- **Detail Dialog**: Click any log row to view complete log data including:
  - Full timestamp with seconds
  - Event type and source
  - User information
  - JSON data payload (pretty-printed)
  - Optional metadata (if present)
  - File name reference
- **Type Safety**: Complete TypeScript types (N8NLog, N8NLogWithMetadata, N8NLogFilters) with Zod validation
- **Real-time Updates**: Query cache invalidation on filter changes ensures fresh data
- **Empty States**: Clear messaging when no logs match filter criteria
- **Security**: Requires authentication, clients can only view their own logs (isolation by user ID)

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