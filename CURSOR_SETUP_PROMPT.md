# PROMPT POUR CURSOR/GPT ATLAS

Copie ce texte et colle-le dans Cursor pour configurer le projet :

---

## CONTEXTE

Je viens de cloner le projet SpeedAI depuis GitHub : https://github.com/leopickskairos-boop/dashboard-complet

C'est une plateforme SaaS de réceptionniste IA vocale avec :
- Frontend React + Vite + Tailwind + Shadcn UI
- Backend Express.js + Node.js
- Base de données PostgreSQL avec Drizzle ORM
- Authentification JWT avec sessions httpOnly
- Paiements Stripe (abonnements + Connect)
- Emails via Resend et SMTP Gmail
- SMS via Twilio
- IA via OpenAI

---

## ÉTAPES À SUIVRE

### 1. INSTALLER LES DÉPENDANCES
```bash
npm install
```

### 2. CRÉER LE FICHIER .ENV

Crée un fichier `.env` à la racine du projet avec ce contenu (je vais te donner les valeurs) :

```env
# BASE DE DONNÉES POSTGRESQL
DATABASE_URL=
PGHOST=
PGPORT=5432
PGUSER=
PGPASSWORD=
PGDATABASE=

# SESSION
SESSION_SECRET=

# STRIPE PRODUCTION
STRIPE_SECRET_KEY=
VITE_STRIPE_PUBLIC_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
STRIPE_CONNECT_CLIENT_ID=

# STRIPE TEST
TESTING_STRIPE_SECRET_KEY=
TESTING_VITE_STRIPE_PUBLIC_KEY=

# EMAIL SMTP GMAIL
SMTP_USER=
SMTP_PASSWORD=

# RESEND
RESEND_API_KEY=

# TWILIO SMS
TWILIO_ACCOUNT_SID=AC668734744ce27846303d6cc3f58b754e
TWILIO_AUTH_TOKEN=9488f2416855f08570dffbb78271e794
TWILIO_FROM_NUMBER=+33939035391

# VAPID PUSH NOTIFICATIONS
VAPID_PUBLIC_KEY=BBm_Z2AMWybXAkTUpGGMdb4_hWLiNKNbozGmNBpY1PBEycJ9df2d-YppyjRkTRsO18IjhTsasstwVhATOpAHLdU
VITE_VAPID_PUBLIC_KEY=BBm_Z2AMWybXAkTUpGGMdb4_hWLiNKNbozGmNBpY1PBEycJ9df2d-YppyjRkTRsO18IjhTsasstwVhATOpAHLdU
VAPID_PRIVATE_KEY=

# N8N
N8N_WEBHOOK_CB_VALIDEE=https://djeydejy.app.n8n.cloud/webhook/garantie-nouvelle-resa
N8N_MASTER_API_KEY=

# OPENAI
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=
```

### 3. CONFIGURER LA BASE DE DONNÉES

Option A - Utiliser une nouvelle base PostgreSQL :
1. Crée une base sur Neon (https://neon.tech), Supabase, ou Railway
2. Copie la DATABASE_URL
3. Lance : `npm run db:push`

Option B - Utiliser la même base que Replit :
- Copie les valeurs PGHOST, PGUSER, PGPASSWORD, PGDATABASE depuis Replit Secrets

### 4. LANCER L'APPLICATION
```bash
npm run dev
```

L'app sera accessible sur http://localhost:5000

---

## STRUCTURE DU PROJET

```
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Pages de l'application
│   │   ├── components/    # Composants UI
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilitaires
├── server/                # Backend Express
│   ├── routes.ts          # Routes API
│   ├── storage.ts         # Interface base de données
│   ├── services/          # Services métier
│   └── crons/             # Tâches planifiées
├── shared/                # Code partagé
│   └── schema.ts          # Schéma Drizzle (modèles BDD)
└── docs/                  # Documentation technique
```

---

## FONCTIONNALITÉS PRINCIPALES

1. **Authentification** : inscription, connexion, reset password, vérification email
2. **Dashboard** : KPIs, graphiques, insights IA, filtres temporels
3. **Abonnements** : trial 30j, plans Basic/Standard/Premium, Stripe
4. **CB Garantie** : système anti no-show avec Stripe Connect
5. **Avis & Réputation** : collecte, incentives, réponses IA automatiques
6. **Marketing** : contacts, campagnes, segments, automations
7. **Intégrations** : HubSpot, Stripe, synchronisation CRM
8. **Notifications** : push, email, SMS
9. **Rapports PDF** : génération mensuelle automatique
10. **Admin** : gestion utilisateurs, logs N8N, santé système

---

## COMMANDES UTILES

```bash
npm run dev          # Lance le serveur de développement
npm run db:push      # Synchronise le schéma DB
npm run db:studio    # Ouvre Drizzle Studio (interface DB)
npm run build        # Build de production
```

---

## IMPORTANT

- Ne jamais committer le fichier `.env` (il est dans .gitignore)
- Le port par défaut est 5000
- Les webhooks Stripe nécessitent un tunnel (ngrok) en local
