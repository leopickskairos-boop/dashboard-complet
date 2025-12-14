# 📥 GUIDE : Récupérer toutes les informations depuis Replit

Ce guide vous explique étape par étape comment récupérer **TOUTES** les informations nécessaires depuis votre Replit pour reproduire l'environnement à l'identique.

---

## 🎯 ÉTAPE 1 : Accéder aux Secrets Replit

1. Ouvrez votre projet sur Replit : https://replit.com
2. Dans la barre latérale gauche, cliquez sur l'icône **🔒 Secrets** (ou `Tools` → `Secrets`)
3. Vous verrez une liste de toutes les variables d'environnement

---

## 📋 ÉTAPE 2 : Liste complète à récupérer

Copiez-collez chaque valeur dans un document temporaire ou directement dans votre fichier `.env` local.

### 🔴 OBLIGATOIRES (pour démarrer)

#### Base de données
```
DATABASE_URL
PGHOST
PGUSER
PGPASSWORD
PGDATABASE
```

#### Session
```
SESSION_SECRET
```

### 🟡 STRIPE

```
STRIPE_SECRET_KEY
VITE_STRIPE_PUBLIC_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
STRIPE_CONNECT_CLIENT_ID
TESTING_STRIPE_SECRET_KEY (si existe)
TESTING_VITE_STRIPE_PUBLIC_KEY (si existe)
```

### 🟡 EMAIL

```
SMTP_USER
SMTP_PASSWORD
MAIL_SENDER
RESEND_API_KEY (si utilisé)
```

### 🟡 SMS

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```

### 🟡 PUSH NOTIFICATIONS

```
VAPID_PUBLIC_KEY
VITE_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

### 🟡 N8N

```
N8N_MASTER_API_KEY
N8N_WEBHOOK_CB_VALIDEE
```

### 🟡 OPENAI

```
AI_INTEGRATIONS_OPENAI_BASE_URL
AI_INTEGRATIONS_OPENAI_API_KEY
```

### 🟢 OPTIONNELS (intégrations)

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
FACEBOOK_APP_ID
FACEBOOK_APP_SECRET
HUBSPOT_CLIENT_ID
HUBSPOT_CLIENT_SECRET
HUBSPOT_REDIRECT_URI
TRIPADVISOR_API_KEY
```

### 🟢 URLS

```
FRONTEND_URL
PUBLIC_URL
REPLIT_DEV_DOMAIN
REPLIT_DOMAINS
REPLIT_API_URL
REPLIT_API_KEY
```

### 🟢 AUTRES

```
CREDENTIAL_ENCRYPTION_KEY
DISABLE_INTERNAL_CRONS
NODE_ENV
PORT
```

---

## 🔍 ÉTAPE 3 : Vérifier les valeurs connues

Certaines valeurs sont déjà dans le code. Vérifiez si elles correspondent :

### Twilio (déjà connues)
- `TWILIO_ACCOUNT_SID` = `AC668734744ce27846303d6cc3f58b754e`
- `TWILIO_AUTH_TOKEN` = `9488f2416855f08570dffbb78271e794`
- `TWILIO_FROM_NUMBER` = `+33939035391`

### VAPID (déjà connues)
- `VAPID_PUBLIC_KEY` = `BBm_Z2AMWybXAkTUpGGMdb4_hWLiNKNbozGmNBpY1PBEycJ9df2d-YppyjRkTRsO18IjhTsasstwVhATOpAHLdU`
- `VITE_VAPID_PUBLIC_KEY` = (même valeur)

### N8N Webhook (déjà connu)
- `N8N_WEBHOOK_CB_VALIDEE` = `https://djeydejy.app.n8n.cloud/webhook/garantie-nouvelle-resa`

### Replit (déjà connues)
- `REPLIT_API_URL` = `https://vocal-dash-leosedilleau41.replit.app`
- `REPLIT_API_KEY` = `563086a9-7c46-4bbc-b971-21d1ad4dff4a`

---

## 📊 ÉTAPE 4 : Exporter la base de données

### Option A : Via Replit Shell

1. Ouvrez le Shell dans Replit
2. Exécutez :
```bash
pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE > backup.sql
```
3. Téléchargez le fichier `backup.sql`

### Option B : Via interface Replit Database

1. Allez dans `Tools` → `Database`
2. Utilisez l'interface pour exporter les données
3. Téléchargez le fichier SQL

### Option C : Utiliser la même base (si accessible)

Si votre base PostgreSQL est hébergée ailleurs (Neon, Supabase, Railway), vous pouvez utiliser directement les mêmes credentials.

---

## 🔐 ÉTAPE 5 : Vérifier les webhooks Stripe

1. Allez sur https://dashboard.stripe.com
2. `Developers` → `Webhooks`
3. Vérifiez que l'endpoint est configuré :
   - URL : `https://vocal-dash-leosedilleau41.replit.app/api/webhooks/stripe`
   - Events sélectionnés (voir liste dans MIGRATION_REPLIT_COMPLETE.md)
4. Copiez le **Signing secret** → c'est `STRIPE_WEBHOOK_SECRET`

---

## 📧 ÉTAPE 6 : Vérifier Gmail App Password

Si vous avez oublié le mot de passe d'application Gmail :

1. Allez sur https://myaccount.google.com
2. `Security` → `2-Step Verification`
3. `App passwords`
4. Si vous en avez un existant, vous pouvez le voir (mais pas le récupérer)
5. Sinon, créez-en un nouveau pour "Mail"
6. Utilisez ce nouveau mot de passe dans `SMTP_PASSWORD`

---

## 🎨 ÉTAPE 7 : Vérifier le visuel et les styles

Le visuel est déjà dans le code :
- ✅ `tailwind.config.ts` - Configuration Tailwind
- ✅ `client/src/index.css` - Styles globaux
- ✅ Composants dans `client/src/components/`

**Aucune action nécessaire** - le code contient déjà tout le visuel.

---

## 📦 ÉTAPE 8 : Vérifier les dépendances

Les dépendances sont dans `package.json`. Pour les installer :

```bash
npm install
```

**Aucune action supplémentaire nécessaire** - tout est déjà listé.

---

## ✅ CHECKLIST DE RÉCUPÉRATION

Cochez chaque élément au fur et à mesure :

### Secrets Replit
- [ ] `DATABASE_URL` ou (`PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`)
- [ ] `SESSION_SECRET`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `VITE_STRIPE_PUBLIC_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_ID`
- [ ] `STRIPE_CONNECT_CLIENT_ID`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASSWORD`
- [ ] `RESEND_API_KEY` (si utilisé)
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_FROM_NUMBER`
- [ ] `VAPID_PRIVATE_KEY`
- [ ] `N8N_MASTER_API_KEY`
- [ ] `AI_INTEGRATIONS_OPENAI_API_KEY`
- [ ] `GOOGLE_CLIENT_ID` (si utilisé)
- [ ] `GOOGLE_CLIENT_SECRET` (si utilisé)
- [ ] `FACEBOOK_APP_ID` (si utilisé)
- [ ] `FACEBOOK_APP_SECRET` (si utilisé)
- [ ] `HUBSPOT_CLIENT_ID` (si utilisé)
- [ ] `HUBSPOT_CLIENT_SECRET` (si utilisé)
- [ ] `TRIPADVISOR_API_KEY` (si utilisé)
- [ ] `FRONTEND_URL`
- [ ] `PUBLIC_URL`
- [ ] `REPLIT_DEV_DOMAIN`
- [ ] `CREDENTIAL_ENCRYPTION_KEY` (si existe)

### Base de données
- [ ] Export SQL créé
- [ ] Credentials notés

### Services externes
- [ ] Webhooks Stripe vérifiés
- [ ] Gmail App Password vérifié/créé
- [ ] Comptes externes accessibles (Stripe, Twilio, etc.)

---

## 🚀 ÉTAPE 9 : Créer le fichier .env local

1. Copiez `.env.example` vers `.env`
2. Remplissez chaque variable avec les valeurs récupérées
3. Vérifiez qu'il n'y a pas d'espaces avant/après les valeurs
4. Vérifiez que les guillemets ne sont pas nécessaires (sauf cas spéciaux)

---

## ⚠️ IMPORTANT : Sécurité

- ❌ **NE COMMITTEZ JAMAIS** le fichier `.env` sur Git
- ✅ Le fichier `.env` est déjà dans `.gitignore`
- ✅ Utilisez des secrets différents pour dev/prod si possible
- ✅ Ne partagez jamais vos clés API

---

## 🆘 EN CAS DE PROBLÈME

### Je ne trouve pas une variable dans Replit Secrets

1. Vérifiez si elle est dans `.replit` → `[userenv.shared]`
2. Vérifiez si elle est hardcodée dans le code (cherchez `process.env.XXX`)
3. Vérifiez si elle est optionnelle (voir MIGRATION_REPLIT_COMPLETE.md)

### Je ne peux pas exporter la base de données

1. Vérifiez que PostgreSQL est accessible depuis Replit
2. Utilisez l'interface Database de Replit
3. Contactez le support Replit si nécessaire

### Une clé API ne fonctionne pas

1. Vérifiez qu'elle est bien copiée (pas d'espaces)
2. Vérifiez qu'elle n'a pas expiré
3. Régénérez-la depuis le dashboard du service concerné

---

**Date de création** : 2025-01-14
