# VoiceAI - Plateforme IA Réceptionniste Vocale

## Vue d'ensemble

VoiceAI est une plateforme SaaS permettant aux entreprises de gérer leurs appels téléphoniques automatiquement avec l'intelligence artificielle. Les utilisateurs peuvent consulter les résumés d'appels et les statistiques en temps réel depuis un dashboard professionnel.

## Architecture du projet

### Stack technique
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (Neon) avec Drizzle ORM
- **Authentication**: Sessions JWT avec cookies httpOnly
- **Payments**: Stripe Subscriptions avec webhooks
- **Email**: Service d'envoi d'emails pour vérification

### Structure des dossiers
```
├── client/               # Application React frontend
│   ├── src/
│   │   ├── components/  # Composants réutilisables (Logo, ProtectedRoute)
│   │   ├── pages/       # Pages de l'application
│   │   └── lib/         # Utilitaires (queryClient, etc.)
├── server/              # Backend Express
│   ├── routes.ts        # Routes API
│   ├── storage.ts       # Interface de stockage
│   └── db.ts           # Configuration base de données
├── shared/              # Code partagé frontend/backend
│   └── schema.ts        # Schémas de données et types
```

## Fonctionnalités MVP

### Phase 1 : Authentification et abonnement ✅
1. **Inscription** (`/signup`)
   - Formulaire avec email + mot de passe
   - Validation côté client avec Zod
   - Envoi automatique d'email de vérification

2. **Vérification email** (`/verify-email`)
   - Lien unique avec token
   - Expiration du token après 24h
   - Possibilité de renvoyer l'email

3. **Connexion** (`/login`)
   - Authentification par email/password
   - Sessions sécurisées avec JWT
   - Redirection intelligente selon le statut
   - Lien "Mot de passe oublié ?" vers /forgot-password

4. **Réinitialisation mot de passe** (`/forgot-password`, `/reset-password`)
   - Demande de réinitialisation avec email
   - Envoi d'email avec lien sécurisé
   - Token unique avec expiration 1h
   - Formulaire de nouveau mot de passe
   - Protection contre l'énumération d'emails

5. **Abonnement Stripe** (`/subscribe`)
   - Plan unique : 29€/mois
   - Paiement sécurisé via Stripe Elements
   - Webhooks pour validation automatique

6. **Dashboard protégé** (`/dashboard`)
   - Accessible uniquement avec email vérifié + abonnement actif
   - Statistiques vides (prêtes pour intégration future)
   - Interface professionnelle suivant design guidelines

7. **Gestion des expirations** (`/subscription-expired`)
   - Détection automatique d'abonnement expiré
   - Redirection et possibilité de renouvellement

### Phase 2 : Intégration IA vocale (À venir)
- Connexion avec Retell.ai / VAPI / ElevenLabs
- Affichage des appels en temps réel
- Résumés générés par IA
- Statistiques détaillées

## Schéma de données

### Table `users`
```typescript
{
  id: varchar (UUID)
  email: text (unique)
  password: text (hashed with bcrypt)
  isVerified: boolean
  verificationToken: text
  verificationTokenExpiry: timestamp
  resetPasswordToken: text
  resetPasswordTokenExpiry: timestamp
  stripeCustomerId: text
  stripeSubscriptionId: text
  subscriptionStatus: text ('active', 'canceled', 'past_due', etc.)
  subscriptionCurrentPeriodEnd: timestamp
  createdAt: timestamp
}
```

## Flux utilisateur

### 1. Nouvel utilisateur
```
Inscription → Email de vérification → Clic sur lien → 
Page d'abonnement → Paiement Stripe → Dashboard
```

### 2. Utilisateur existant
```
Connexion → Vérification du statut →
  - Si email non vérifié: /verify-email-sent
  - Si pas d'abonnement: /subscribe
  - Si abonnement expiré: /subscription-expired
  - Si tout OK: /dashboard
```

## Variables d'environnement

### Stripe (REQUIS)
- `VITE_STRIPE_PUBLIC_KEY` : Clé publique Stripe (frontend)
- `STRIPE_SECRET_KEY` : Clé secrète Stripe (backend) - **OBLIGATOIRE**
- `STRIPE_PRICE_ID` : Price ID du plan 29€/mois (commence par `price_`) - **OBLIGATOIRE**
- `STRIPE_WEBHOOK_SECRET` : Secret webhook pour vérification des signatures - **OBLIGATOIRE**

### Database
- `DATABASE_URL` : URL de connexion PostgreSQL (auto-configuré par Replit)

### Session
- `SESSION_SECRET` : Secret pour signer les tokens JWT - **OBLIGATOIRE**

### Email (optionnel en développement)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` : Configuration SMTP pour l'envoi d'emails
- Note : Les erreurs d'envoi d'email ne bloquent pas l'inscription (le token est accessible via la DB)

## Design Guidelines

Le projet suit rigoureusement les guidelines définies dans `design_guidelines.md` :
- Typographie : Inter font family
- Spacing : échelle cohérente (4, 6, 8, 12, 16, 24)
- Composants : Shadcn UI avec variants définis
- Couleurs : Système de tokens avec support dark mode
- Responsive : Mobile-first avec breakpoints standards

## Commandes importantes

### Développement
```bash
npm run dev              # Démarre le serveur de développement
```

### Base de données
```bash
npm run db:push          # Pousse le schéma vers la DB
npm run db:push --force  # Force la synchronisation
```

## Sécurité

### Authentification
- Mots de passe hashés avec bcrypt (salt rounds: 10)
- Sessions JWT avec cookies httpOnly
- Tokens de vérification email avec expiration (24h)
- Tokens de réinitialisation mot de passe avec expiration (1h)
- Protection anti-énumération lors du reset password
- Protection CSRF avec SameSite cookies

### Routes protégées
- Middleware d'authentification sur toutes les routes `/api/*` nécessitant auth
- Vérification email obligatoire avant accès paiement
- Vérification abonnement actif avant accès dashboard

### Paiements
- Intégration Stripe sécurisée
- Webhooks signés pour validation
- Pas de stockage de données bancaires

## État du projet

### MVP Phase 1 : ✅ COMPLET ET TESTÉ

Toutes les fonctionnalités d'authentification, d'abonnement et du dashboard sont **100% fonctionnelles** :

✅ **Authentification complète**
- Inscription avec email/password
- Hashage bcrypt des mots de passe (10 salt rounds)
- Génération et envoi d'emails de vérification
- Tokens de vérification avec expiration (24h)
- Connexion avec sessions JWT sécurisées (httpOnly cookies)
- Réinitialisation mot de passe avec tokens sécurisés (1h expiration)
- Protection anti-énumération (même réponse email valide/invalide)
- Middlewares de protection (requireAuth, requireVerified, requireSubscription)

✅ **Intégration Stripe production-ready**
- Création d'abonnements avec Price ID correct (price_1SQDvA442ACh1eI8X8ym3WC5)
- Affichage de 800€/mois sur les pages (charge réelle selon Stripe)
- Stripe Elements pour paiement sécurisé
- Webhooks signés avec validation (customer.subscription.*, invoice.payment_*)
- Synchronisation automatique du statut d'abonnement
- Gestion complète du cycle de vie (actif, expiré, annulé)

✅ **Dashboard complet et fonctionnel**
- 4 KPI cards avec données réelles et variation N-1 :
  * Total des appels avec variation
  * Appels actifs en temps réel
  * Taux de conversion (% de rendez-vous pris)
  * Durée moyenne des appels
- Filtres temporels globaux (1h, aujourd'hui, 2 jours, semaine)
- Tableau des appels avec :
  * Badges de statut colorés (completed, failed, canceled, no_answer, active)
  * Filtres indépendants (temps + statut)
  * Tri et affichage des détails
- Dialog de détail d'appel avec toutes les informations
- Graphiques dynamiques avec Recharts (vraies données API) :
  * Total des appels : courbe temporelle
  * Taux de conversion : histogramme
  * Durée moyenne : courbe d'évolution
- Tous les graphiques respectent les filtres temporels
- États de chargement et gestion d'erreurs
- Design responsive et professionnel

✅ **Frontend professionnel**
- Toutes les pages implémentées et polies
- Design cohérent suivant design_guidelines.md
- Redirections intelligentes selon le statut utilisateur
- Gestion des états (loading, erreurs, succès)
- Tests E2E validés sur tout le flux

✅ **Sécurité renforcée**
- Hard-fail sur secrets manquants (SESSION_SECRET, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID)
- Validation Zod sur tous les endpoints
- Protection CSRF avec SameSite cookies
- Vérification des signatures Stripe avec raw body
- Aucune fuite de données sensibles
- Routes API protégées par auth + email vérifié + abonnement actif

### Prochaines étapes (Phase 2)

1. **Intégration IA vocale** (Retell.ai / VAPI / ElevenLabs)
   - Connexion API avec service vocal
   - Récupération des appels et transcriptions
   - Affichage en temps réel dans le dashboard
   - Génération de résumés par IA
   - Analytics et statistiques détaillées

2. **Améliorations suggérées par l'architecte**
   - Logging des event IDs Stripe pour audit
   - Tests de lifecycle webhook (cancellation, past_due)
   - Monitoring des erreurs de paiement

## Notes techniques

### Production-ready
- ✅ Tests E2E complets (signup → verification → login → payment → dashboard)
- ✅ Tests E2E réinitialisation mot de passe (forgot → reset → login)
- ✅ Validation architecte (aucun problème de sécurité détecté)
- ✅ Base de données PostgreSQL configurée et migrée
- ✅ Stripe webhooks testés avec cartes de test (4242...)
- ✅ Tous les flux utilisateur fonctionnels

### Points d'attention
- Les erreurs SMTP sont non-bloquantes (signup/reset continue même si email échoue)
- En développement, récupérer les tokens (vérification/reset) via la DB si besoin
- Tokens de reset expirent après 1h (vs 24h pour vérification email)
- Tester les webhooks Stripe en mode test avant production
- Configurer un domaine personnalisé pour les emails de production
