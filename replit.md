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
-   **Reviews & Reputation Management System**: Complete review collection and management system with:
    -   7-table architecture (review_config, review_incentives, review_requests, reviews, review_alerts, review_sources, review_sync_logs)
    -   Automated review request sending via email (SMS prepared)
    -   Incentive system with 6 types: percentage, fixed_amount, free_item, lottery, loyalty_points, custom
    -   Tracking system with unique tokens (format: rv_{timestamp}_{random})
    -   Public pages for customers to select review platforms and confirm submission
    -   Incentive display on public page (shows offer with validity period)
    -   Automatic promo code generation after review confirmation (format: MERCI-{6_CHARS})
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