# Intelligent Waitlist System - Technical Documentation

## Overview

The SpeedAI Intelligent Waitlist System enables customers to join a waiting list when their desired time slot is unavailable. The system uses an event-driven architecture to monitor Google Calendar for cancellations and automatically notifies customers when slots become available.

## Architecture

### Key Features

1. **Event-Driven Architecture**: No global polling - uses per-slot dynamic timers
2. **Cost-Optimized Adaptive Check Frequency**: 
   - Beyond 24h: every 60 minutes (minimal checks)
   - D-1 (within 24h): every 30 minutes
   - Within 6h of slot: every 10 minutes (more frequent as slot approaches)
3. **Token-Based Public Confirmation**: Secure tokens for SMS links
4. **Google Calendar Integration**: OAuth connection for real-time slot monitoring
5. **SMS Notifications**: Twilio integration for availability alerts

## Database Schema

### Tables

#### `waitlist_slots`
Stores monitored time slots that customers are waiting for.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| userId | varchar | User (business) who owns this slot |
| slotStart | timestamp | Start time of the desired slot |
| slotEnd | timestamp | End time of the slot |
| calendarEventId | text | External calendar reference |
| status | enum | pending, monitoring, available, filled, expired, cancelled |
| lastCheckAt | timestamp | Last time availability was checked |
| nextCheckAt | timestamp | Next scheduled check time |
| checkIntervalMinutes | integer | Current check frequency |
| businessName | text | Business name for context |
| serviceType | text | Type of service |
| notes | text | Additional notes |

#### `waitlist_entries`
Stores customers waiting for specific slots.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| slotId | varchar | Reference to waitlist_slots |
| userId | varchar | User (business) who owns this entry |
| firstName | text | Customer first name |
| lastName | text | Customer last name |
| phone | text | Customer phone number |
| email | text | Customer email |
| requestedSlot | timestamp | Original requested time |
| alternativeSlots | timestamp[] | Other acceptable times (auto-generated evening slots) |
| nbPersons | integer | Number of people |
| status | enum | pending, notified, confirmed, declined, expired, cancelled |
| priority | integer | Queue priority (lower = higher priority) |
| smsMessageSid | text | Twilio message ID |
| notifiedAt | timestamp | When customer was notified of availability |
| confirmedAt | timestamp | When customer confirmed the slot |
| responseDeadline | timestamp | Timeout for response |
| source | text | voice_agent, web, or manual |

#### `waitlist_tokens`
Secure access tokens for public confirmation pages.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| entryId | varchar | Reference to waitlist_entries |
| token | text | Unique token for URL (plaintext) |
| tokenHash | text | Hashed version for verification |
| tokenType | text | registration or confirmation |
| expiresAt | timestamp | Token expiration time |
| consumedAt | timestamp | When token was used |

#### `waitlist_calendar_config`
OAuth configuration for Google Calendar per user.

| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| userId | varchar | User who owns this configuration |
| provider | enum | google_calendar, cal_com, calendly, outlook, custom |
| googleAccessToken | text | OAuth access token |
| googleRefreshToken | text | OAuth refresh token |
| googleTokenExpiry | timestamp | Token expiration time |
| calendarId | text | Selected calendar ID |
| calendarName | text | Selected calendar name |
| isEnabled | boolean | Whether monitoring is enabled |
| checkIntervalMinutes | integer | Override for check frequency |
| lastSyncAt | timestamp | Last successful sync |
| lastError | text | Last error message |

## N8N Integration Flow

### Complete Flow: Retell Voice Agent → Waitlist System

```
┌─────────────────┐
│  Retell AI      │
│  Voice Agent    │
└────────┬────────┘
         │ End of call
         ▼
┌─────────────────┐
│  N8N Workflow   │
│  "Fin d'appel"  │
└────────┬────────┘
         │ POST to SpeedAI
         ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/n8n/webhook/:userId                              │
│  {                                                          │
│    "phoneNumber": "+33612345678",                           │
│    "status": "completed",                                   │
│    "event_type": "booking_failed",                          │
│    "wants_waitlist": true,                                  │
│    "waitlist_slot_requested": "2025-01-15T19:30:00+01:00",  │
│    "metadata": {                                            │
│      "client_name": "Jean Dupont",                          │
│      "nb_personnes": 4                                      │
│    }                                                        │
│  }                                                          │
└────────┬────────────────────────────────────────────────────┘
         │ Call saved with wantsWaitlist=true
         │ N8N continues...
         ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/waitlist/n8n/trigger                             │
│  {                                                          │
│    "requested_slot": "2025-01-15T19:30:00+01:00",           │
│    "business_id": "user_uuid",                              │
│    "phone": "+33612345678",                                 │
│    "firstName": "Jean",                                     │
│    "lastName": "Dupont",                                    │
│    "email": "jean@example.com",                             │
│    "nbPersons": 4,                                          │
│    "alternativeSlots": []                                   │
│  }                                                          │
└────────┬────────────────────────────────────────────────────┘
         │ Entry created
         │ SMS sent with registration link
         ▼
┌─────────────────────┐
│  SMS to Customer    │
│  with token link    │
│  wl_{timestamp}...  │
└────────┬────────────┘
         │ Customer clicks link
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Public Page: /waitlist/:token                              │
│  - Displays requested slot                                  │
│  - Shows auto-generated evening alternatives (18:00-22:00)  │
│  - Customer completes registration form                     │
└────────┬────────────────────────────────────────────────────┘
         │ Customer confirms
         ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/waitlist/confirm/:token                          │
│  {                                                          │
│    "firstName": "Jean",                                     │
│    "lastName": "Dupont",                                    │
│    "phone": "+33612345678",                                 │
│    "email": "jean@example.com",                             │
│    "selectedSlots": ["2025-01-15T19:30:00", ...]            │
│  }                                                          │
└────────┬────────────────────────────────────────────────────┘
         │ Entry confirmed
         │ Scheduler activated
         ▼
┌─────────────────────────────────────────────────────────────┐
│  WaitlistScheduler                                          │
│  - Monitors Google Calendar                                 │
│  - Adaptive frequency: 60min/30min/10min                    │
│  - Event-driven timers per slot                             │
└────────┬────────────────────────────────────────────────────┘
         │ Slot becomes available!
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Notification SMS                                           │
│  "Bonne nouvelle! Votre créneau du 15/01 à 19h30 est        │
│   maintenant disponible. Confirmez ici: [link]"             │
└────────┬────────────────────────────────────────────────────┘
         │ Customer confirms
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Slot filled                                                │
│  Entry status: confirmed                                    │
│  (Optional: N8N webhook to create calendar event)           │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### N8N Trigger Endpoint

**POST `/api/waitlist/n8n/trigger`**

Creates a waitlist entry from N8N voice agent workflow.

```json
{
  "requested_slot": "2025-01-15T19:30:00+01:00",
  "business_id": "user_uuid",
  "phone": "+33612345678",
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@example.com",
  "nbPersons": 4,
  "alternativeSlots": [],
  "source": "voice_agent"
}
```

**Response:**
```json
{
  "success": true,
  "entry": { ... },
  "slot": { ... },
  "token": "wl_1704825600_abc123def"
}
```

### Call Webhook with Waitlist Data

**POST `/api/n8n/webhook/:userId`**

When recording calls, include waitlist preference:

```json
{
  "phoneNumber": "+33612345678",
  "status": "completed",
  "wants_waitlist": true,
  "waitlist_slot_requested": "2025-01-15T19:30:00+01:00",
  "metadata": {
    "client_name": "Jean Dupont"
  }
}
```

The `wantsWaitlist` and `waitlistSlotRequested` fields are stored in the calls table for tracking.

### Calendar Configuration Endpoints

**GET `/api/waitlist/calendar/config`**
Returns calendar configuration for authenticated user.

**GET `/api/waitlist/calendar/oauth/google/start`**
Initiates Google OAuth flow, returns `oauthUrl`.

**GET `/api/waitlist/calendar/oauth/google/callback`**
OAuth callback handler (automatic redirect).

**GET `/api/waitlist/calendar/calendars`**
Lists available Google calendars for selection.

**POST `/api/waitlist/calendar/select`**
```json
{
  "calendarId": "primary",
  "calendarName": "Mon calendrier"
}
```

**POST `/api/waitlist/calendar/toggle`**
```json
{
  "isEnabled": true
}
```

**POST `/api/waitlist/calendar/disconnect`**
Disconnects Google Calendar integration.

### Public Confirmation Page

**GET `/waitlist/:token`**
Public page for customer registration/confirmation. No authentication required.

**POST `/api/waitlist/confirm/:token`**
Confirms waitlist registration with full contact details.

## Alternative Slot Generation

When a customer requests a slot, the system automatically generates alternative evening slots from 18:00 to 22:00 (every 30 minutes) on the same day, excluding the originally requested slot.

Example: Customer requests 19:30
- Generated alternatives: 18:00, 18:30, 19:00, 20:00, 20:30, 21:00, 21:30, 22:00

## Cost Optimization

The system is designed to minimize Replit hosting costs:

1. **No Global Polling**: Timers are created per-slot, not globally
2. **Adaptive Frequency**: Longer intervals when slots are far away
3. **Automatic Cleanup**: Timers stop after slot expiration
4. **Idle State**: Scheduler stays completely idle when no active waitlists

### Autoscale Compatible

Set `DISABLE_INTERNAL_CRONS=true` to use external cron triggers:
- **POST `/api/cron/waitlist-check`**: Triggers global waitlist check

## Dashboard Features

The waitlist dashboard (`/waitlist`) includes:

1. **Entries Tab**: View/manage customer waitlist registrations
2. **Slots Tab**: Monitor active slots with check intervals
3. **Settings Tab**: 
   - Google Calendar OAuth connection
   - Connection status with last sync time
   - Step-by-step workflow explanation

## Environment Variables

| Variable | Description |
|----------|-------------|
| GOOGLE_CLIENT_ID | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret |
| TWILIO_ACCOUNT_SID | Twilio account SID for SMS |
| TWILIO_AUTH_TOKEN | Twilio auth token |
| TWILIO_FROM_NUMBER | Twilio sender phone number |
