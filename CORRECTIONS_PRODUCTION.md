# 🔧 CORRECTIONS POUR LA PRODUCTION

**Date** : 14 Décembre 2025  
**Objectif** : Configurer l'application pour la production avec vocaledash.com

---

## ✅ CORRECTIONS EFFECTUÉES

### 1. URLs de production configurées

Toutes les URLs pointent maintenant vers `https://vocaledash.com` :

- ✅ `FRONTEND_URL=https://vocaledash.com`
- ✅ `PUBLIC_URL=https://vocaledash.com`
- ✅ `REPLIT_DEV_DOMAIN=vocal-dash-leosedilleau41.replit.app`
- ✅ `REPLIT_DOMAINS=vocaledash.com,vocal-dash-leosedilleau41.replit.app`

### 2. URLs hardcodées corrigées

**Fichier `server/routes.ts`** :
- ✅ `success_url` et `cancel_url` pour Stripe garantie CB → utilisent `PUBLIC_URL` ou `FRONTEND_URL`
- ✅ `public_url` pour garantie CB → utilise `PUBLIC_URL` ou `FRONTEND_URL`
- ✅ `dashboard_url` pour N8N → utilise `FRONTEND_URL`

**Avant** :
```typescript
success_url: `${process.env.PUBLIC_URL || 'https://speedai.fr'}/...`
dashboard_url: process.env.FRONTEND_URL || 'https://speedai-b2b-platform-v2.replit.app'
```

**Après** :
```typescript
success_url: `${process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'https://vocaledash.com'}/...`
dashboard_url: process.env.FRONTEND_URL || 'https://vocaledash.com'
```

### 3. Mode production activé

- ✅ `NODE_ENV=production` dans `.env`
- ✅ Cookies `secure: true` activés (nécessite HTTPS)
- ✅ Toutes les URLs utilisent HTTPS

---

## ⚠️ PROBLÈME IDENTIFIÉ : Base de données

### Erreur actuelle
```
password authentication failed for user 'neondb_owner'
```

### Solution nécessaire

Le mot de passe de la base de données dans `.env` semble incorrect. 

**Actions à faire** :

1. **Vérifier le mot de passe dans Replit Secrets** :
   - Aller sur Replit
   - Ouvrir Secrets (🔒)
   - Vérifier `PGPASSWORD` ou `DATABASE_URL`
   - Copier le mot de passe correct

2. **Mettre à jour le `.env`** :
   ```bash
   PGPASSWORD=votre_mot_de_passe_correct
   DATABASE_URL=postgresql://neondb_owner:votre_mot_de_passe_correct@ep-blue-moon-af4eyboy.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

3. **Tester la connexion** :
   ```bash
   npm run db:push
   ```

---

## 🔐 CONNEXION UTILISATEUR

### Identifiants de test
- **Email** : `leosedilleau41@gmail.com`
- **Mot de passe** : `Codole25.`

### Problème actuel
L'erreur 500 lors de la connexion est causée par l'échec de connexion à la base de données.

**Une fois la base de données corrigée**, la connexion devrait fonctionner.

---

## 📋 CHECKLIST PRODUCTION

### ✅ Configuré
- [x] Domaines configurés (vocaledash.com)
- [x] URLs hardcodées corrigées
- [x] NODE_ENV=production
- [x] Cookies secure activés
- [x] Port configuré (5001 en local, 5000 en production)

### ⚠️ À corriger
- [ ] Mot de passe base de données (dans Replit Secrets)
- [ ] Tester la connexion utilisateur
- [ ] Vérifier les webhooks Stripe
- [ ] Tester les emails
- [ ] Tester les SMS

---

## 🚀 DÉPLOIEMENT

### Variables d'environnement à vérifier sur Replit

Assurez-vous que toutes ces variables sont dans Replit Secrets :

```env
# Base de données
DATABASE_URL=postgresql://...
PGPASSWORD=...

# Domaines
FRONTEND_URL=https://vocaledash.com
PUBLIC_URL=https://vocaledash.com
REPLIT_DEV_DOMAIN=vocal-dash-leosedilleau41.replit.app

# Stripe
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
SMTP_USER=...
SMTP_PASSWORD=...
RESEND_API_KEY=...

# Autres services
N8N_MASTER_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
# etc.
```

---

## 🔍 VÉRIFICATIONS POST-DÉPLOIEMENT

1. **Tester la connexion** :
   - Email : `leosedilleau41@gmail.com`
   - Mot de passe : `Codole25.`

2. **Vérifier les URLs** :
   - Tous les liens doivent pointer vers `https://vocaledash.com`
   - Pas de `localhost` ou `speedai.fr` dans les emails/liens

3. **Vérifier les cookies** :
   - Les cookies doivent être `secure: true` (HTTPS uniquement)
   - Les cookies doivent être `httpOnly: true`

4. **Tester les fonctionnalités** :
   - Login/Logout
   - Inscription
   - Emails de vérification
   - Reset password
   - Paiements Stripe
   - Webhooks

---

## 📝 NOTES IMPORTANTES

### En développement local
- Utilisez `NODE_ENV=development` pour avoir les logs détaillés
- Les cookies `secure` seront `false` (HTTP localhost)

### En production
- `NODE_ENV=production` est nécessaire
- Les cookies `secure` seront `true` (HTTPS requis)
- Toutes les URLs doivent être en HTTPS

---

**Date de création** : 14 Décembre 2025  
**Statut** : ⚠️ En attente de correction du mot de passe base de données
