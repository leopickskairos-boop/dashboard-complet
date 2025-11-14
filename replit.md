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
-   **AI Analytics Deep Insights**: On-demand AI-powered deep analysis for call volume, conversion rate, time slots, and average duration, triggered from dashboard KPI cards.

## External Dependencies

-   **Stripe**: Subscription management, payment processing, and customer portal.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.
-   **Drizzle ORM**: Object-Relational Mapper.
-   **Nodemailer**: For sending transactional emails.
-   **Retell.ai / VAPI / ElevenLabs**: Planned integrations for AI voice capabilities.