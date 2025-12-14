# 🔄 MIGRATION COMPLÈTE DEPUIS REPLIT - CHECKLIST TOTALE

**Objectif** : Reproduire à l'identique l'environnement Replit (visuel, configuration, code, données)

---

## 📋 TABLE DES MATIÈRES

1. [Variables d'environnement](#1-variables-denvironnement)
2. [Base de données PostgreSQL](#2-base-de-données-postgresql)
3. [Services externes & API Keys](#3-services-externes--api-keys)
4. [Configuration Stripe](#4-configuration-stripe)
5. [Configuration Email](#5-configuration-email)
6. [Configuration SMS (Twilio)](#6-configuration-sms-twilio)
7. [Configuration Push Notifications](#7-configuration-push-notifications)
8. [Configuration N8N](#8-configuration-n8n)
9. [Configuration OpenAI](#9-configuration-openai)
10. [Intégrations OAuth](#10-intégrations-oauth)
11. [Fichiers de configuration](#11-fichiers-de-configuration)
12. [Données existantes](#12-données-existantes)

---

## 1. VARIABLES D'ENVIRONNEMENT

### 🔴 CRITIQUES (obligatoires pour démarrer)

#### Base de données PostgreSQL
```env
DATABASE_URL=postgresql://user:password@host:5432/database
# OU séparément :
PGHOST=your-db-host
PGPORT=5432
PGUSER=your-db-user
PGPASSWORD=your-db-password
PGDATABASE=your-db-name
```

#### Session & Sécurité
```env
SESSION_SECRET=your-random-secret-key-min-32-chars
NODE_ENV=production
PORT=5000
```

### 🟡 STRIPE (Production)

```env
# Clés Stripe Production
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Price IDs (déjà dans le code, mais à vérifier)
STRIPE_PRICE_ID=price_1SQDvA442ACh1eI8X8ym3WC5  # Standard (800€)

# Stripe Connect (pour garantie CB)
STRIPE_CONNECT_CLIENT_ID=ca_xxxxxxxxxxxxxxxxxxxxx
```

**Price IDs confirmés (déjà dans `server/stripe-plans.ts`)** :
- Basic (400€) : `price_1SRfP3442ACh1eI8PFt5z2b4`
- Standard (800€) : `price_1SQDvA442ACh1eI8X8ym3WC5`
- Premium (1000€) : `price_1SRfPE442ACh1eI8pzFhIJLH`

### 🟡 STRIPE (Test - pour développement)

```env
TESTING_STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
TESTING_VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
```

### 🟡 EMAIL

#### SMTP Gmail
```env
SMTP_USER=leopickskairos@gmail.com
SMTP_PASSWORD=your-gmail-app-password
MAIL_SENDER=leopickskairos@gmail.com
```

#### Resend (alternative)
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

### 🟡 SMS (Twilio)

```env
TWILIO_ACCOUNT_SID=AC668734744ce27846303d6cc3f58b754e
TWILIO_AUTH_TOKEN=9488f2416855f08570dffbb78271e794
TWILIO_FROM_NUMBER=+33939035391
# OU (si différent)
TWILIO_SID=AC668734744ce27846303d6cc3f58b754e
TWILIO_PHONE=+15017122661
```

### 🟡 PUSH NOTIFICATIONS (VAPID)

```env
VAPID_PUBLIC_KEY=BBm_Z2AMWybXAkTUpGGMdb4_hWLiNKNbozGmNBpY1PBEycJ9df2d-YppyjRkTRsO18IjhTsasstwVhATOpAHLdU
VITE_VAPID_PUBLIC_KEY=BBm_Z2AMWybXAkTUpGGMdb4_hWLiNKNbozGmNBpY1PBEycJ9df2d-YppyjRkTRsO18IjhTsasstwVhATOpAHLdU
VAPID_PRIVATE_KEY=your-vapid-private-key-here
```

### 🟡 N8N

```env
N8N_MASTER_API_KEY=your-n8n-master-api-key
N8N_WEBHOOK_CB_VALIDEE=https://djeydejy.app.n8n.cloud/webhook/garantie-nouvelle-resa
```

### 🟡 OPENAI

```env
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
```

### 🟢 OPTIONNELS (intégrations)

#### Google Business Profile
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Facebook Pages
```env
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

#### HubSpot
```env
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URI=https://your-domain.com/api/integrations/oauth/hubspot/callback
```

#### Tripadvisor
```env
TRIPADVISOR_API_KEY=your-tripadvisor-api-key
```

### 🟢 URLS & DOMAINES

```env
FRONTEND_URL=https://your-domain.com
PUBLIC_URL=https://your-domain.com
REPLIT_DEV_DOMAIN=your-replit-domain.replit.app  # Si encore utilisé
REPLIT_DOMAINS=domain1.com,domain2.com  # Si plusieurs domaines
REPLIT_API_URL=https://vocal-dash-leosedilleau41.replit.app
REPLIT_API_KEY=563086a9-7c46-4bbc-b971-21d1ad4dff4a
```

### 🟢 AUTRES

```env
CREDENTIAL_ENCRYPTION_KEY=your-encryption-key  # Sinon utilise SESSION_SECRET
DISABLE_INTERNAL_CRONS=false  # true si vous utilisez N8N pour les crons
```

---

## 2. BASE DE DONNÉES POSTGRESQL

### 📊 Informations nécessaires

1. **Type de base** : PostgreSQL 16 (comme sur Replit)
2. **Host** : Adresse du serveur PostgreSQL
3. **Port** : 5432 (par défaut)
4. **Database** : Nom de la base de données
5. **User** : Nom d'utilisateur
6. **Password** : Mot de passe

### 🔄 Migration des données

**Option A : Export depuis Replit**
```bash
# Depuis Replit, exporter la base
pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE > backup.sql
```

**Option B : Utiliser la même base (si accessible)**
- Copier les credentials depuis Replit Secrets
- Utiliser directement la même DATABASE_URL

**Option C : Nouvelle base + migration**
1. Créer une nouvelle base sur Neon/Supabase/Railway
2. Appliquer le schéma : `npm run db:push`
3. Migrer les données si nécessaire

### 📋 Tables principales (vérifier les données)

- `users` - Utilisateurs et abonnements
- `calls` - Appels téléphoniques
- `appointments` - Rendez-vous
- `reviews` - Avis clients
- `review_requests` - Demandes d'avis
- `notifications` - Notifications
- `integrations` - Intégrations OAuth
- `marketing_contacts` - Contacts marketing
- `marketing_campaigns` - Campagnes marketing
- Et toutes les autres tables du schéma

---

## 3. SERVICES EXTERNES & API KEYS

### 🔑 Où récupérer chaque clé

#### Stripe
- **Dashboard** : https://dashboard.stripe.com
- **Clés** : Developers → API keys
- **Webhooks** : Developers → Webhooks → Endpoint secret
- **Connect** : Connect → Settings → Client ID

#### Resend
- **Dashboard** : https://resend.com/api-keys
- **Clé API** : API Keys section

#### Twilio
- **Dashboard** : https://console.twilio.com
- **Account SID** : Dashboard overview
- **Auth Token** : Dashboard overview
- **Phone Number** : Phone Numbers → Manage → Active numbers

#### OpenAI
- **Dashboard** : https://platform.openai.com/api-keys
- **Clé API** : API keys section

#### N8N
- **Dashboard** : https://your-n8n-instance.com
- **Master Key** : Settings → API → Master Key

#### Google Business Profile
- **Console** : https://console.cloud.google.com
- **OAuth 2.0** : APIs & Services → Credentials

#### Facebook Pages
- **Developers** : https://developers.facebook.com
- **App** : My Apps → Your App → Settings → Basic

#### HubSpot
- **Settings** : https://app.hubspot.com/settings
- **OAuth** : Integrations → Private Apps ou OAuth Apps

---

## 4. CONFIGURATION STRIPE

### ✅ À vérifier dans Stripe Dashboard

1. **Products & Prices**
   - [ ] Basic : 400€/mois → `price_1SRfP3442ACh1eI8PFt5z2b4`
   - [ ] Standard : 800€/mois → `price_1SQDvA442ACh1eI8X8ym3WC5`
   - [ ] Premium : 1000€/mois → `price_1SRfPE442ACh1eI8pzFhIJLH`

2. **Webhooks**
   - [ ] Endpoint configuré : `https://your-domain.com/api/webhooks/stripe`
   - [ ] Events sélectionnés :
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

3. **Stripe Connect** (pour garantie CB)
   - [ ] Connect activé
   - [ ] Client ID récupéré
   - [ ] Webhooks Connect configurés si nécessaire

---

## 5. CONFIGURATION EMAIL

### Gmail SMTP

1. **Activer l'authentification à 2 facteurs** sur le compte Gmail
2. **Générer un mot de passe d'application** :
   - Google Account → Security → 2-Step Verification → App passwords
   - Créer un mot de passe pour "Mail"
3. **Utiliser ce mot de passe** dans `SMTP_PASSWORD`

### Resend (alternative)

1. Créer un compte sur https://resend.com
2. Vérifier le domaine d'envoi
3. Récupérer la clé API

---

## 6. CONFIGURATION SMS (TWILIO)

### ✅ Informations déjà connues

- **Account SID** : `AC668734744ce27846303d6cc3f58b754e`
- **Auth Token** : `9488f2416855f08570dffbb78271e794`
- **From Number** : `+33939035391` (ou `+15017122661`)

### 📋 À vérifier

- [ ] Compte Twilio actif
- [ ] Numéro de téléphone vérifié
- [ ] Crédits disponibles
- [ ] Webhooks configurés si nécessaire

---

## 7. CONFIGURATION PUSH NOTIFICATIONS

### VAPID Keys

**Public Key** (déjà connu) :
```
BBm_Z2AMWybXAkTUpGGMdb4_hWLiNKNbozGmNBpY1PBEycJ9df2d-YppyjRkTRsO18IjhTsasstwVhATOpAHLdU
```

**Private Key** : À récupérer depuis Replit Secrets

### 🔧 Générer de nouvelles clés (si perdues)

```bash
npm install -g web-push
web-push generate-vapid-keys
```

---

## 8. CONFIGURATION N8N

### Webhooks N8N

**Webhook Garantie CB** :
```
https://djeydejy.app.n8n.cloud/webhook/garantie-nouvelle-resa
```

### Master API Key

- À récupérer depuis Replit Secrets ou N8N Dashboard
- Utilisé pour authentifier les appels API depuis N8N vers le dashboard

### 📋 Workflows N8N à vérifier

1. **Garantie CB** - Webhook de nouvelle réservation
2. **Crons externes** - Si `DISABLE_INTERNAL_CRONS=true`
3. **Autres automations** - Selon votre configuration

---

## 9. CONFIGURATION OPENAI

### API Key

- À récupérer depuis https://platform.openai.com/api-keys
- Vérifier les limites et crédits disponibles

### Base URL

Par défaut : `https://api.openai.com/v1`
(Pour utiliser d'autres providers, modifier si nécessaire)

---

## 10. INTÉGRATIONS OAUTH

### Google Business Profile

1. **Console Google Cloud** : https://console.cloud.google.com
2. **Créer un projet** (ou utiliser existant)
3. **Activer Google My Business API**
4. **Créer OAuth 2.0 credentials**
5. **Ajouter redirect URI** : `https://your-domain.com/api/integrations/oauth/google/callback`

### Facebook Pages

1. **Facebook Developers** : https://developers.facebook.com
2. **Créer une App** (ou utiliser existante)
3. **Récupérer App ID et App Secret**
4. **Ajouter redirect URI** : `https://your-domain.com/api/integrations/oauth/facebook/callback`
5. **Permissions nécessaires** : `pages_read_engagement`, `pages_manage_metadata`

### HubSpot

1. **HubSpot Settings** : https://app.hubspot.com/settings
2. **Integrations** → **Private Apps** ou **OAuth Apps**
3. **Créer une app** avec scopes nécessaires
4. **Redirect URI** : `https://your-domain.com/api/integrations/oauth/hubspot/callback`

---

## 11. FICHIERS DE CONFIGURATION

### ✅ Fichiers déjà présents (à vérifier)

- [x] `package.json` - Dépendances
- [x] `vite.config.ts` - Configuration Vite
- [x] `tailwind.config.ts` - Configuration Tailwind
- [x] `drizzle.config.ts` - Configuration Drizzle ORM
- [x] `tsconfig.json` - Configuration TypeScript
- [x] `.replit` - Configuration Replit (pour référence)

### 📝 Fichier `.env` à créer

Créer un fichier `.env` à la racine avec toutes les variables listées ci-dessus.

**Template complet** :
```env
# ============================================
# BASE DE DONNÉES POSTGRESQL
# ============================================
DATABASE_URL=postgresql://user:password@host:5432/database
PGHOST=your-db-host
PGPORT=5432
PGUSER=your-db-user
PGPASSWORD=your-db-password
PGDATABASE=your-db-name

# ============================================
# SESSION & SÉCURITÉ
# ============================================
SESSION_SECRET=your-random-secret-key-min-32-chars
NODE_ENV=production
PORT=5000

# ============================================
# STRIPE PRODUCTION
# ============================================
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_ID=price_1SQDvA442ACh1eI8X8ym3WC5
STRIPE_CONNECT_CLIENT_ID=ca_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# STRIPE TEST (pour développement)
# ============================================
TESTING_STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
TESTING_VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# EMAIL
# ============================================
SMTP_USER=leopickskairos@gmail.com
SMTP_PASSWORD=your-gmail-app-password
MAIL_SENDER=leopickskairos@gmail.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# SMS (TWILIO)
# ============================================
TWILIO_ACCOUNT_SID=AC668734744ce27846303d6cc3f58b754e
TWILIO_AUTH_TOKEN=9488f2416855f08570dffbb78271e794
TWILIO_FROM_NUMBER=+33939035391

# ============================================
# PUSH NOTIFICATIONS (VAPID)
# ============================================
VAPID_PUBLIC_KEY=BBm_Z2AMWybXAkTUpGGMdb4_hWLiNKNbozGmNBpY1PBEycJ9df2d-YppyjRkTRsO18IjhTsasstwVhATOpAHLdU
VITE_VAPID_PUBLIC_KEY=BBm_Z2AMWybXAkTUpGGMdb4_hWLiNKNbozGmNBpY1PBEycJ9df2d-YppyjRkTRsO18IjhTsasstwVhATOpAHLdU
VAPID_PRIVATE_KEY=your-vapid-private-key-here

# ============================================
# N8N
# ============================================
N8N_MASTER_API_KEY=your-n8n-master-api-key
N8N_WEBHOOK_CB_VALIDEE=https://djeydejy.app.n8n.cloud/webhook/garantie-nouvelle-resa

# ============================================
# OPENAI
# ============================================
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# ============================================
# INTÉGRATIONS OAUTH (optionnel)
# ============================================
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URI=https://your-domain.com/api/integrations/oauth/hubspot/callback
TRIPADVISOR_API_KEY=your-tripadvisor-api-key

# ============================================
# URLS & DOMAINES
# ============================================
FRONTEND_URL=https://your-domain.com
PUBLIC_URL=https://your-domain.com
REPLIT_DEV_DOMAIN=your-replit-domain.replit.app
REPLIT_DOMAINS=domain1.com,domain2.com
REPLIT_API_URL=https://vocal-dash-leosedilleau41.replit.app
REPLIT_API_KEY=563086a9-7c46-4bbc-b971-21d1ad4dff4a

# ============================================
# AUTRES
# ============================================
CREDENTIAL_ENCRYPTION_KEY=your-encryption-key
DISABLE_INTERNAL_CRONS=false
```

---

## 12. DONNÉES EXISTANTES

### 📊 À migrer depuis Replit

1. **Base de données complète**
   - Export SQL depuis Replit
   - Import dans la nouvelle base

2. **Fichiers uploadés** (si stockage local)
   - PDFs générés
   - Images uploadées
   - Documents utilisateurs

3. **Sessions actives**
   - Les utilisateurs devront se reconnecter
   - Les sessions ne peuvent pas être migrées (sécurité)

4. **Configurations utilisateurs**
   - Intégrations OAuth (à reconnecter)
   - Préférences utilisateurs
   - Paramètres de compte

---

## ✅ CHECKLIST FINALE DE MIGRATION

### Phase 1 : Préparation
- [ ] Récupérer toutes les clés API depuis Replit Secrets
- [ ] Exporter la base de données PostgreSQL
- [ ] Noter toutes les URLs et domaines
- [ ] Vérifier les webhooks Stripe
- [ ] Vérifier les configurations N8N

### Phase 2 : Configuration locale
- [ ] Créer le fichier `.env` avec toutes les variables
- [ ] Installer les dépendances : `npm install`
- [ ] Configurer la base de données
- [ ] Importer les données (si migration)
- [ ] Tester la connexion à la base

### Phase 3 : Services externes
- [ ] Vérifier les clés Stripe (production + test)
- [ ] Configurer les webhooks Stripe
- [ ] Tester l'envoi d'emails (SMTP/Resend)
- [ ] Tester l'envoi de SMS (Twilio)
- [ ] Vérifier les push notifications (VAPID)
- [ ] Tester les intégrations OAuth

### Phase 4 : Tests
- [ ] Tester l'authentification (login/signup)
- [ ] Tester les paiements Stripe
- [ ] Tester les webhooks Stripe
- [ ] Tester les emails
- [ ] Tester les SMS
- [ ] Tester les push notifications
- [ ] Tester les intégrations (HubSpot, Google, Facebook)
- [ ] Tester les crons (ou N8N)

### Phase 5 : Déploiement
- [ ] Configurer le domaine
- [ ] Configurer SSL/HTTPS
- [ ] Mettre à jour les URLs dans les services externes
- [ ] Tester en production
- [ ] Monitorer les logs

---

## 🆘 EN CAS DE PROBLÈME

### Base de données
- Vérifier la connexion : `npm run db:push`
- Vérifier les credentials dans `.env`
- Vérifier que PostgreSQL est accessible

### Stripe
- Vérifier les clés dans Stripe Dashboard
- Vérifier les webhooks sont bien configurés
- Tester avec les cartes de test

### Emails
- Vérifier le mot de passe Gmail App
- Vérifier Resend API key
- Vérifier les logs d'envoi

### Autres
- Vérifier les logs serveur : `npm run dev`
- Vérifier la console navigateur
- Vérifier les variables d'environnement chargées

---

## 📞 SUPPORT

Si vous avez besoin d'aide pour récupérer une clé spécifique depuis Replit :
1. Ouvrir Replit
2. Aller dans Secrets (🔒)
3. Copier chaque variable une par une
4. Les coller dans le fichier `.env` local

---

**Date de création** : 2025-01-14  
**Dernière mise à jour** : 2025-01-14
