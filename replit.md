# SpeedAI - Plateforme IA Réceptionniste Vocale

## Overview

SpeedAI is a SaaS platform designed to automate business phone calls using Artificial Intelligence. It provides companies with real-time call summaries and statistics through a professional dashboard, aiming to streamline communication and provide actionable insights. The project's ambition is to integrate advanced AI voice capabilities for a comprehensive receptionist solution, offering business intelligence, and a multi-tier subscription model.

## User Preferences

I prefer detailed explanations and iterative development. Ask before making major changes. Do not make changes to the folder Z and to the file Y.

## System Architecture

The project utilizes a modern web stack for a responsive and professional user interface. The core architecture includes:
-   **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI.
-   **Backend**: Express.js with Node.js.
-   **Database**: PostgreSQL (Neon) managed with Drizzle ORM.
-   **Authentication**: Secure JWT sessions with httpOnly cookies.
-   **Payments**: Stripe Subscriptions with webhook integration.
-   **Email**: Gmail SMTP integration for various notifications and reports.
-   **UI/UX**: Inter font, consistent spacing, Shadcn UI components, token-based color system with dark mode, and a mobile-first responsive approach.

**Key Features:**
-   **Comprehensive Authentication**: User registration with email verification, secure login, password reset, and account management.
-   **Subscription & Trial System**: 30-day free trial, multi-tier subscription model (Basic, Standard, Premium), automated trial-to-paid conversion via cron jobs and Stripe webhooks, and admin plan assignment.
-   **User Dashboard**: Protected dashboard with 6 KPI cards, AI Insights & Trends (3 data-driven recommendations), temporal filters, dynamic charts, and a trial countdown banner.
-   **Notification System**: Robust notification center with filtering, user preferences, and alert banners for key events.
-   **Monthly PDF Reports**: Automated, professional reports with core metrics, business metrics, a performance score, smart AI recommendations, and interactive charts, delivered via email and downloadable.
-   **Admin Dashboard**: Secure interface for user management, health monitoring (Optimal, Attention, Critical statuses), advanced filtering, account actions, and statistics display.
-   **N8N Logs Router**: Scalable multi-client infrastructure for receiving N8N workflow data, ensuring client isolation and traceability.
-   **N8N Logs Visualization**: Admin-only section in the dashboard for monitoring logs from all clients with comprehensive filtering and detailed log viewing.
-   **Admin Clients Data API**: Comprehensive endpoint for administrators to overview all client data for N8N integration management.
-   **AI Analytics Deep Insights**: On-demand AI-powered deep analysis for call volume, conversion rate, time slots, and average duration, triggered from dashboard KPI cards. Enhanced with CB Guarantee data for comprehensive business intelligence:
    -   No-show rate analysis with performance scoring
    -   Revenue recovered from penalties tracking
    -   Guarantee validation rate monitoring
    -   Customer reliability patterns analysis
    -   Actionable recommendations based on guarantee metrics
-   **CB Guarantee Anti No-Show System**: Complete credit card guarantee system for reservations with:
    -   Stripe Connect integration for direct payouts to merchants
    -   N8N API endpoint for creating guarantee sessions from external workflows
    -   Public customer-facing page for card validation (no auth required)
    -   Dashboard pages for configuration, reservations management, and no-show history
    -   Configurable penalty amounts (€1-200/person), cancellation delays (1-72h), and application rules
    -   Company branding customization (logo, colors)
    -   Automatic charging for no-shows with failure tracking
    -   Statistics and recovery metrics
    -   **Automated Notification System**:
        -   Client-specific SMTP configuration (Gmail App Password) for personalized emails
        -   Centralized SMS via SpeedAI Twilio (no client config needed)
        -   Auto email+SMS on session creation (card validation request)
        -   Auto email+SMS on card validation (booking confirmation)
        -   Professional branded email templates with company logo and colors
        -   SMS with short links for mobile validation
        -   Configurable notification toggles per client (smsEnabled, autoSend toggles)
        -   N8N calendar booking trigger on successful card validation
    -   **Appointment Reminder SMS System**:
        -   Automated SMS reminders for all appointment types (not just CB Guarantee)
        -   3 sources supported: CB Guarantee sessions, calls with appointmentDate, external orders with reservationDate
        -   Configurable reminder timing (appointmentReminderHours in clientGuaranteeConfig)
        -   Cron job runs every 15 minutes to process all sources
        -   Tracking via appointmentReminderSent/appointmentReminderSentAt columns in calls and external_orders tables
-   **Marketing Module**: Complete marketing automation system with:
    -   8-table architecture (marketing_contacts, marketing_consent_history, marketing_segments, marketing_templates, marketing_campaigns, marketing_sends, marketing_automations, marketing_automation_logs)
    -   Contact management with CSV import, SpeedAI sync, tags, and RGPD-compliant consent tracking
    -   Campaign creation for email, SMS, or multi-channel with scheduling support
    -   Reusable templates with dynamic variables ({prenom}, {nom}, {email}, etc.)
    -   Dynamic segments with auto-update filters (optIn, tags, source, date range, etc.)
    -   Marketing automations with 6 trigger types: new_contact, birthday, inactive, tag_added, segment_joined, custom_event
    -   5 action types: send_email, send_sms, send_both, add_tag, remove_tag
    -   Complete analytics dashboard with KPIs, performance charts, and industry benchmarks
    -   Email tracking with open/click pixels via Resend webhooks
    -   Public RGPD-compliant unsubscribe page (/unsubscribe/:trackingId)
    -   Dashboard pages: Overview, Contacts, Campaigns, Templates, Segments, Automations, Analytics
-   **Reviews & Reputation Management System**: Complete review collection and management system with:
    -   7-table architecture (review_config, review_incentives, review_requests, reviews, review_alerts, review_sources, review_sync_logs)
    -   Automated review request sending via email (SMS prepared)
    -   Incentive system with 6 types: percentage, fixed_amount, free_item, lottery, loyalty_points, custom
    -   Tracking system with unique tokens (format: rv_{timestamp}_{random})
    -   Public pages for customers to select review platforms and confirm submission
    -   Incentive display on public page (shows offer with validity period)
    -   Automatic promo code generation after review confirmation (format: MERCI-{6_CHARS})
    -   Promo code usage tracking via POST /api/reviews/promo/use endpoint (N8N integration)
    -   Revenue tracking: promoOrderAmount field tracks order amounts when promo codes are used
    -   Dashboard KPIs: promosUsed/promosGenerated ratio and revenueGenerated (CA généré)
    -   Configurable timing modes: smart (AI), fixed_delay, fixed_time
    -   Multi-platform support: Google, TripAdvisor, Facebook, Yelp, Doctolib, Pages Jaunes
    -   Alert configuration for negative reviews, 5-star reviews, response delays
    -   Company name personalization in emails/SMS via review_config.companyName
    -   Full API documentation available at: docs/REVIEWS_SYSTEM_DOCUMENTATION.md
    -   **Multi-Platform Review Aggregation**:
        -   Centralized review collection from Google Business Profile, Facebook, TripAdvisor
        -   OAuth flows for Google and Facebook platform connections
        -   URL-based TripAdvisor integration with Location ID extraction
        -   Automated daily sync at 4:00 AM Paris time via cron job
        -   Manual sync trigger capability per source or globally
        -   Sync logs with status tracking (success, error, reviewsFetched)
        -   Platform connection UI in ReviewsSettings with status badges
        -   ReviewsList with platform, rating, and search filters
-   **Intelligent Waitlist System**: Cost-optimized event-driven waitlist management with:
    -   3-table architecture (waitlist_slots, waitlist_entries, waitlist_tokens) with efficient indexes
    -   **Event-Driven Architecture**: No global polling - only per-slot dynamic timers
    -   **Adaptive Check Frequency**: 30min (beyond D-1), 10min (D-1), 3min (within 6h of slot)
    -   **Token-Based Public Confirmation**: Secure tokens for SMS links (format: wl_{timestamp}_{random})
    -   **Automatic Cleanup**: Timers stop after slot expiration, expired entries auto-cleaned
    -   **SMS Notifications**: Twilio integration for slot availability alerts
    -   **N8N Integration**: Voice agent API endpoint for creating waitlist entries (POST /api/waitlist/n8n/trigger)
    -   Dashboard page for waitlist management with filters and status tracking
    -   Public confirmation page (/waitlist/:token) - no auth required
    -   Scheduler stays completely idle when no active waitlists
    -   Priority-based queue processing (FIFO within priority levels)

## Technical Documentation

-   **Reviews & Reputation System**: Complete technical documentation for N8N integration available at `docs/REVIEWS_SYSTEM_DOCUMENTATION.md`. Includes:
    -   Full database schema with all 5 tables and field-by-field documentation
    -   Complete API reference with request/response schemas
    -   N8N workflow examples with ASCII diagrams and JSON payloads
    -   Data flow diagrams and state machine documentation
    -   All enums and their values documented

## External Dependencies

-   **Stripe**: Subscription management, payment processing, and customer portal.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.
-   **Drizzle ORM**: Object-Relational Mapper.
-   **Nodemailer**: For sending transactional emails.
-   **Retell.ai / VAPI / ElevenLabs**: Planned integrations for AI voice capabilities.

## Universal CRM/Database Integration Hub

Complete integration system for synchronizing customer data from external CRM and database systems:

**Architecture:**
-   **Adapter Pattern**: Extensible design with base adapter class and provider-specific implementations
-   **Real API Connections**: Live connections to external APIs (not mock data)
-   **AES-256-GCM Encryption**: All credentials encrypted at rest, decrypted only during sync operations
-   **OAuth 2.0 Support**: Full OAuth flows for supported providers (HubSpot)

**Implemented Adapters:**
-   **HubSpot**: Contacts and deals synchronization
    -   Supports both OAuth tokens (Bearer header) and legacy API keys (hapikey query parameter)
    -   Incremental sync using POST /search endpoints with date filters
    -   Full sync using standard GET endpoints
-   **Stripe**: Customers, payments, charges, and refunds
    -   Full Stripe SDK integration
    -   Real-time payment data synchronization

**Key Files:**
-   `server/integrations/adapters/base-adapter.ts`: Base class with interface definitions
-   `server/integrations/adapters/hubspot-adapter.ts`: HubSpot CRM adapter
-   `server/integrations/adapters/stripe-adapter.ts`: Stripe payments adapter
-   `server/integrations/adapter-factory.ts`: Factory for creating adapters by provider
-   `server/integrations/integration-service.ts`: Orchestration service for sync operations
-   `server/integrations/oauth/hubspot-oauth.ts`: HubSpot OAuth flow implementation
-   `server/crons/integration-sync.cron.ts`: Automated sync cron job (runs at 3 AM Paris time)
-   `server/integration-routes.ts`: API routes for integration management

**API Endpoints:**
-   `POST /api/integrations/connect-apikey`: Connect with API key (tests connection first)
-   `POST /api/integrations/sync`: Trigger manual synchronization
-   `POST /api/integrations/test`: Test existing connection
-   `GET /api/integrations/oauth/hubspot/start`: Initiate HubSpot OAuth flow
-   `GET /api/integrations/oauth/hubspot/callback`: OAuth callback handler

**Frontend Pages:**
-   Integration Hub overview with provider cards
-   Connection configuration with credential forms
-   Real-time connection testing
-   Sync status and history display

## Autoscale Optimization

The application supports Replit Autoscale optimization to reduce hosting costs:

**Problem Solved:**
-   6 internal cron jobs (node-cron) kept the app running 24/7, preventing sleep mode

**Solution:**
-   External API endpoints for all cron tasks (authenticated with N8N_MASTER_API_KEY)
-   Set `DISABLE_INTERNAL_CRONS=true` in production to disable internal cron jobs
-   Use N8N or cron-job.org to trigger tasks externally

**Cron API Endpoints:**
-   `POST /api/cron/monthly-reports` - Daily at 2h
-   `POST /api/cron/trial-expirations` - Daily at 3h  
-   `POST /api/cron/daily-summary` - Daily at 9h
-   `POST /api/cron/trial-expiring-notifications` - Daily at 10h
-   `POST /api/cron/review-sync` - Daily at 4h
-   `POST /api/cron/integration-sync` - Hourly
-   `GET /api/cron/health` - Health check

**Recommended Autoscale Config:**
```
minInstances: 0
maxInstances: 1
idleTimeout: 300
```

**Documentation:** See `docs/AUTOSCALE_OPTIMIZATION.md` for full setup guide.

## Email Infrastructure

**Resend Integration:**
-   Centralized email sending via Resend API (SpeedAI manages costs)
-   Professional HTML email templates with client branding
-   Automatic fallback handling
-   Domain verification required for production (currently using onboarding@resend.dev for dev)