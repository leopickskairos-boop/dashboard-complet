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

4. **Abonnement Stripe** (`/subscribe`)
   - Plan unique : 29€/mois
   - Paiement sécurisé via Stripe Elements
   - Webhooks pour validation automatique

5. **Dashboard protégé** (`/dashboard`)
   - Accessible uniquement avec email vérifié + abonnement actif
   - Statistiques vides (prêtes pour intégration future)
   - Interface professionnelle suivant design guidelines

6. **Gestion des expirations** (`/subscription-expired`)
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

### Stripe
- `VITE_STRIPE_PUBLIC_KEY` : Clé publique Stripe (frontend)
- `STRIPE_SECRET_KEY` : Clé secrète Stripe (backend)

### Database
- `DATABASE_URL` : URL de connexion PostgreSQL (auto-configuré par Replit)

### Session
- `SESSION_SECRET` : Secret pour signer les tokens JWT

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
- Tokens de vérification email avec expiration
- Protection CSRF avec SameSite cookies

### Routes protégées
- Middleware d'authentification sur toutes les routes `/api/*` nécessitant auth
- Vérification email obligatoire avant accès paiement
- Vérification abonnement actif avant accès dashboard

### Paiements
- Intégration Stripe sécurisée
- Webhooks signés pour validation
- Pas de stockage de données bancaires

## Prochaines étapes

1. **Backend complet** (Task 2)
   - Implémenter tous les endpoints API
   - Configurer la base de données PostgreSQL
   - Mettre en place les webhooks Stripe
   - Implémenter l'envoi d'emails

2. **Intégration** (Task 3)
   - Connecter frontend et backend
   - Tester tous les flux utilisateurs
   - Valider la sécurité

3. **Intégration IA vocale** (Phase future)
   - Connexion avec Retell.ai
   - Affichage des appels
   - Résumés IA
   - Analytics avancés

## Notes de développement

- Le frontend est **complet et magnifique** ✅
- Tous les composants suivent les design guidelines
- Interface responsive et accessible
- États de chargement et d'erreur soignés
- Prêt pour l'intégration backend
