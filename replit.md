# VoiceAI - Plateforme IA Réceptionniste Vocale

## Overview

VoiceAI is a SaaS platform designed to automate business phone calls using Artificial Intelligence. It provides companies with real-time call summaries and statistics through a professional dashboard, aiming to streamline communication and provide actionable insights. The project's ambition is to integrate advanced AI voice capabilities for a comprehensive receptionist solution.

## User Preferences

I prefer detailed explanations and iterative development. Ask before making major changes. Do not make changes to the folder Z and to the file Y.

## System Architecture

The project utilizes a modern web stack:
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI for a responsive and professional user interface.
- **Backend**: Express.js with Node.js.
- **Database**: PostgreSQL (Neon) managed with Drizzle ORM.
- **Authentication**: Secure JWT sessions with httpOnly cookies.
- **Payments**: Stripe Subscriptions with webhook integration for automated payment processing.
- **Email**: Dedicated service for sending verification and transactional emails.

**Key Features Implemented (MVP Phase 1 - Complete):**
- **Comprehensive Authentication System**: User registration, email verification, secure login, password reset, and account management. Passwords are hashed with bcrypt, and secure tokens are used for verification and resets.
- **Stripe Subscription Integration**: Single plan subscription model (29€/month) with secure payment via Stripe Elements and webhook-validated subscriptions. Includes features for managing payment methods and viewing payment history via Stripe Customer Portal.
- **User Dashboard**: Protected dashboard accessible only to verified and subscribed users, featuring real-time statistics (total calls, active calls, conversion rate, average call duration), temporal filters, and dynamic charts (Recharts).
- **Notification System**: A robust notification center with filtering options (time, type, read/unread status), user preferences for notification types (daily summaries, failed calls, active calls, subscription alerts), and an alert banner for expiring subscriptions. Automatic notification generation for key events (e.g., subscription changes, password changes).

**Upcoming Features (Phase 2):**
- **AI Voice Integration**: Connection with AI voice services (Retell.ai, VAPI, ElevenLabs) for real-time call display, AI-generated summaries, and detailed analytics.

**Design Guidelines**: The project adheres to strict design guidelines using Inter font, a consistent spacing scale, Shadcn UI components with variants, a token-based color system supporting dark mode, and a mobile-first responsive approach.

## External Dependencies

- **Stripe**: For subscription management, payment processing (Stripe Elements), and customer portal integration.
- **Neon (PostgreSQL)**: Managed PostgreSQL database service.
- **Drizzle ORM**: Object-Relational Mapper for database interactions.
- **Nodemailer (or similar)**: For sending transactional emails (e.g., email verification, password reset).
- **Retell.ai / VAPI / ElevenLabs**: Planned integrations for AI voice capabilities.