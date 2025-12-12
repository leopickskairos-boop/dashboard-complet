# Documentation Complète - Système Avis & Réputation SpeedAI

## Table des Matières
1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture du Système](#architecture-du-système)
3. [Pages du Dashboard](#pages-du-dashboard)
4. [Parcours Utilisateur (Client SpeedAI)](#parcours-utilisateur-client-speedai)
5. [Parcours Client Final (Destinataire)](#parcours-client-final-destinataire)
6. [Système d'Incitations](#système-dincitations)
7. [Intégration N8N](#intégration-n8n)
8. [Widgets & QR Codes](#widgets--qr-codes)
9. [Aggregation Multi-Plateformes](#aggregation-multi-plateformes)
10. [Flux de Données Complet](#flux-de-données-complet)

---

## Vue d'Ensemble

Le système **Avis & Réputation** de SpeedAI est une solution complète pour :
- **Collecter automatiquement des avis** après les interactions client (appel, réservation, visite)
- **Inciter les clients** à laisser des avis positifs avec des offres promotionnelles
- **Centraliser tous les avis** de différentes plateformes (Google, TripAdvisor, Facebook, Yelp, etc.)
- **Analyser la réputation** avec des statistiques, tendances et insights IA
- **Répondre aux avis** directement depuis le dashboard
- **Générer des outils marketing** (QR codes, widgets intégrables)

### Fonctionnalités Clés
| Fonctionnalité | Description |
|----------------|-------------|
| Demandes d'avis automatiques | Envoi email/SMS après une interaction client |
| Système d'incitations | Réductions, cadeaux, tirages au sort pour encourager les avis |
| Tracking complet | Suivi du parcours : envoi → clic → avis confirmé |
| Codes promo auto-générés | Code unique généré après confirmation d'avis |
| Centralisation des avis | Tous les avis de toutes les plateformes en un seul endroit |
| Alertes configurables | Notifications pour avis négatifs, 5 étoiles, etc. |
| QR Codes personnalisables | Pour affichage en établissement |
| Widgets intégrables | Pour afficher les avis sur un site web |

---

## Architecture du Système

### Base de Données (7 Tables)

```
┌──────────────────┐
│      users       │
└────────┬─────────┘
         │
    ┌────┴────┬────────────┬───────────┬───────────┐
    ▼         ▼            ▼           ▼           ▼
┌────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐ ┌────────────┐
│ review │ │ review   │ │ review  │ │reviews│ │review      │
│ config │ │incentives│ │requests │ │       │ │ alerts     │
└────────┘ └──────────┘ └─────────┘ └───────┘ └────────────┘
                              │           │
                              ▼           │
                        ┌───────────┐     │
                        │review     │     │
                        │sources    │◄────┘
                        └─────┬─────┘
                              │
                              ▼
                        ┌───────────┐
                        │review     │
                        │sync_logs  │
                        └───────────┘
```

### Tables Détaillées

#### 1. `review_config` (1 par utilisateur)
Configuration globale du système d'avis.

| Champ | Description |
|-------|-------------|
| `enabled` | Système activé/désactivé |
| `timing_mode` | `smart` / `fixed_delay` / `fixed_time` |
| `fixed_delay_hours` | Délai d'envoi en heures |
| `fixed_time` | Heure fixe d'envoi (ex: "18:00") |
| `send_window_start/end` | Fenêtre horaire autorisée |
| `avoid_weekends` | Ne pas envoyer le weekend |
| `company_name` | Nom affiché dans les messages |
| `sms_message` | Template SMS personnalisé |
| `email_subject/message` | Template email personnalisé |
| `google_review_url` | URL directe vers Google |
| `tripadvisor_url` | URL TripAdvisor |
| `facebook_page_url` | URL page Facebook |
| `yelp_url`, `doctolib_url`, `pages_jaunes_url` | Autres plateformes |
| `platforms_priority` | Ordre d'affichage des plateformes |

#### 2. `review_incentives` (Plusieurs par utilisateur)
Offres incitatives pour encourager les avis.

| Type | Description | Exemple |
|------|-------------|---------|
| `percentage` | Réduction en % | -10% sur la prochaine visite |
| `fixed_amount` | Réduction en € | -5€ sur le prochain achat |
| `free_item` | Article offert | Un café offert |
| `lottery` | Tirage au sort | Gagnez un iPhone |
| `loyalty_points` | Points fidélité | 100 points offerts |
| `custom` | Personnalisé | Texte libre |

Chaque incitation a :
- `validity_days` : Durée de validité du code promo
- `single_use` : Usage unique ou multiple
- `minimum_purchase` : Achat minimum requis
- `is_default` : Incitation utilisée par défaut

#### 3. `review_requests` (Demandes d'avis)
Suivi de chaque demande envoyée.

| Champ | Description |
|-------|-------------|
| `customer_name/email/phone` | Coordonnées client |
| `reservation_id/date/time` | Infos réservation |
| `send_method` | `email` / `sms` / `both` |
| `tracking_token` | Token unique (format: `rv_{timestamp}_{random}`) |
| `status` | `pending` → `scheduled` → `sent` → `clicked` → `confirmed` / `expired` |
| `incentive_id` | FK vers l'incitation utilisée |
| `promo_code` | Code promo généré après confirmation |

#### 4. `reviews` (Avis centralisés)
Stockage de tous les avis récupérés.

| Champ | Description |
|-------|-------------|
| `platform` | google/tripadvisor/facebook/yelp/doctolib/pages_jaunes |
| `rating` | Note 1-5 |
| `content` | Texte de l'avis |
| `reviewer_name` | Nom de l'auteur |
| `review_date` | Date de l'avis |
| `response_text` | Réponse du propriétaire |
| `response_status` | `none` / `draft` / `published` |
| `sentiment` | `very_positive` / `positive` / `neutral` / `negative` / `very_negative` |
| `is_read` / `is_flagged` | Marqueurs de gestion |

#### 5. `review_alerts`
Configuration des alertes par type.

| Type d'Alerte | Description |
|---------------|-------------|
| `negative_review` | Nouvel avis 1-2 étoiles |
| `new_5_star` | Nouvel avis 5 étoiles |
| `no_response_48h` | Avis sans réponse >48h |
| `weekly_report` | Rapport hebdomadaire |
| `rating_drop` | Baisse de la note moyenne |

#### 6. `review_sources` (Connexions plateformes)
Sources OAuth pour synchronisation automatique.

| Champ | Description |
|-------|-------------|
| `platform` | google/facebook/tripadvisor |
| `status` | `pending` / `connected` / `error` / `disconnected` |
| `last_sync_at` | Dernière synchronisation |
| `total_reviews_count` | Nombre d'avis synchronisés |

#### 7. `review_sync_logs`
Historique des synchronisations.

---

## Pages du Dashboard

### 1. **ReviewsStats** - Statistiques des Avis
**URL**: `/dashboard/reviews/stats`

**Contenu**:
- **KPI Cards** (5 indicateurs):
  - Note globale (avec étoiles visuelles)
  - Total des avis + nouveaux sur la période
  - Taux de réponse aux avis
  - Temps moyen de réponse
  - Répartition du sentiment

- **Graphiques**:
  - Distribution par note (1-5 étoiles) - Bar Chart
  - Distribution du sentiment - Pie Chart
  - Tendance des avis dans le temps - Line Chart
  - Comparaison par plateforme - Composed Chart

- **Filtres temporels**: Cette semaine / Ce mois / Cette année / Tout le temps

- **Bouton IA**: "Générer des insights" - Analyse IA des tendances

### 2. **ReviewsList** - Tous les Avis
**URL**: `/dashboard/reviews/list`

**Contenu**:
- Liste de tous les avis centralisés
- Filtres par plateforme, note, sentiment
- Barre de recherche textuelle
- Pour chaque avis:
  - Avatar et nom de l'auteur
  - Étoiles et plateforme
  - Contenu de l'avis
  - Date relative
  - Badge sentiment
  - Indicateurs lu/non-lu, flagged

**Actions disponibles**:
- Cliquer sur un avis ouvre un dialog détaillé
- Rédiger une réponse (brouillon ou publier)
- Marquer comme lu
- Flagger pour attention

### 3. **ReviewsCampaigns** - Campagnes de Demandes
**URL**: `/dashboard/reviews/campaigns`

**Contenu**:
- **KPI Cards**:
  - Demandes envoyées
  - Taux de clic
  - Avis confirmés
  - Taux de conversion
  - Codes promo générés/utilisés

- **Tableau des demandes** avec colonnes:
  - Client (nom, email/téléphone)
  - Méthode d'envoi (icône email/SMS)
  - Date de création
  - Statut (badges colorés)
  - Actions (envoyer, voir détails)

**Statuts des demandes**:
| Statut | Couleur | Description |
|--------|---------|-------------|
| En attente | Gris | Créée, pas encore envoyée |
| Planifié | Ambre | Programmée pour envoi |
| Envoyé | Bleu | Message envoyé |
| Cliqué | Or | Client a cliqué sur le lien |
| Converti | Vert | Avis confirmé |
| Expiré | Rouge | Pas de réponse dans le délai |

**Bouton "Nouvelle demande"**:
- Dialog avec formulaire:
  - Nom du client (obligatoire)
  - Email
  - Téléphone
  - Méthode d'envoi (Email / SMS / Les deux)
  - Incitation à utiliser (dropdown)

### 4. **ReviewsSettings** - Configuration
**URL**: `/dashboard/reviews/settings`

**Sections**:

#### A. Activation du système
- Switch ON/OFF pour activer/désactiver le système

#### B. Timing d'envoi
- Mode de timing:
  - `Smart (IA)` : L'IA choisit le meilleur moment
  - `Délai fixe` : X heures après création
  - `Heure fixe` : Tous les jours à HH:MM
- Fenêtre d'envoi (début/fin)
- Option "Éviter les weekends"

#### C. Informations entreprise
- Nom de l'entreprise (affiché dans les messages)

#### D. Messages personnalisés
- Template SMS (avec variables disponibles)
- Sujet email personnalisé
- Corps de l'email personnalisé

#### E. URLs des plateformes
- Champs pour chaque plateforme:
  - Google Review URL
  - TripAdvisor URL
  - Facebook Page URL
  - Yelp URL
  - Doctolib URL
  - Pages Jaunes URL
- Ordre de priorité des plateformes (drag & drop)

#### F. Gestion des incitations
- Liste des incitations créées
- Bouton "Ajouter une incitation"
- Pour chaque incitation:
  - Type et valeur
  - Message affiché
  - Validité
  - Bouton "Définir par défaut"
  - Bouton supprimer

#### G. Connexions Plateformes (Collapsible)
- Connexion OAuth:
  - Google Business Profile
  - Facebook Pages
  - TripAdvisor (via URL)
- Statut de chaque connexion (connecté/déconnecté)
- Bouton synchroniser manuellement
- Logs de synchronisation

#### H. Configuration des alertes
- Pour chaque type d'alerte:
  - Switch activé/désactivé
  - Options de notification (email, SMS, push)
  - Seuil si applicable

### 5. **ReviewsWidgets** - QR Codes & Widgets
**URL**: `/dashboard/reviews/widgets`

**Onglets**:

#### A. QR Code
- Preview du QR code en temps réel
- Configuration:
  - Taille (slider)
  - Couleur foreground
  - Couleur background
  - Marge incluse (switch)
  - Plateforme cible (toutes ou spécifique)
- Boutons:
  - Télécharger PNG
  - Copier dans presse-papier

#### B. Widget Avis
- Preview interactive du widget
- Configuration:
  - Thème (clair/sombre)
  - Nombre d'avis max
  - Afficher plateforme (switch)
  - Afficher date (switch)
  - Auto-scroll (switch)
  - Dimensions (largeur/hauteur)
- Code d'intégration (iframe) à copier

#### C. Badge de Note
- Preview du badge
- Configuration:
  - Style (moderne/classique)
  - Afficher nombre d'avis
  - Plateforme
- Code HTML à copier

### 6. **ReviewCollect** - Page Publique de Collecte
**URL**: `/review/collect?userId={id}&platform={platform}`

Page publique accessible sans authentification, utilisée par les QR codes.

**Affichage**:
- Nom de l'entreprise (si configuré)
- "Votre avis compte !"
- Liste des plateformes configurées (triées par priorité)
- Chaque plateforme est un bouton cliquable

**Comportement**:
- Si `platform` est spécifié et existe → redirection automatique
- Sinon → affichage de la liste des choix

### 7. **ReviewPage** - Page de Tracking avec Token
**URL**: `/review/{tracking_token}`

Page publique utilisée par les liens dans les emails/SMS.

**Flux**:
1. Affichage des plateformes disponibles
2. Si incitation configurée → affichage de l'offre (ex: "-10% sur votre prochaine visite")
3. Client clique sur une plateforme → ouverture dans nouvel onglet
4. Bouton "J'ai laissé mon avis" apparaît
5. Clic sur confirmation → génération du code promo
6. Affichage du code avec bouton copier

### 8. **ReviewsEmbed** - Widget Intégrable (iframe)
**URL**: `/embed/reviews?userId={id}&theme=dark&max=5`

Widget conçu pour être intégré via iframe sur un site externe.

**Paramètres**:
- `userId` : ID de l'utilisateur SpeedAI
- `theme` : `dark` ou `light`
- `max` : Nombre d'avis à afficher
- `showPlatform` : Afficher l'icône plateforme
- `showDate` : Afficher la date relative
- `autoScroll` : Défilement automatique des avis

**Contenu**:
- Note globale + étoiles
- Nombre total d'avis
- Carrousel/liste des derniers avis

---

## Parcours Utilisateur (Client SpeedAI)

### Configuration Initiale

```
1. Accéder à Avis > Configuration
   │
2. Activer le système (switch ON)
   │
3. Configurer le timing
   ├── Choisir mode: Smart / Délai fixe / Heure fixe
   ├── Définir fenêtre d'envoi (ex: 10h-20h)
   └── Cocher/décocher "Éviter weekends"
   │
4. Renseigner les URLs des plateformes
   ├── Copier URL Google Review
   ├── Copier URL TripAdvisor
   └── etc.
   │
5. Personnaliser les messages (optionnel)
   ├── Template SMS
   └── Sujet + corps email
   │
6. Créer des incitations (optionnel)
   ├── Choisir type (réduction %, montant fixe, cadeau...)
   ├── Définir valeur
   ├── Définir durée de validité
   └── Marquer comme "défaut"
   │
7. Configurer les alertes (optionnel)
   └── Activer alertes pour avis négatifs, 5 étoiles, etc.
```

### Utilisation Quotidienne

#### Scénario A: Demande Manuelle
```
1. Aller dans Avis > Campagnes
   │
2. Cliquer "Nouvelle demande"
   │
3. Remplir le formulaire
   ├── Nom: Jean Dupont
   ├── Email: jean@exemple.fr
   ├── Téléphone: +33612345678
   ├── Méthode: Email + SMS
   └── Incitation: -10% (optionnel)
   │
4. Cliquer "Créer"
   │
5. La demande apparaît avec statut "En attente"
   │
6. Cliquer "Envoyer" pour envoi immédiat
   OU
   Laisser le système envoyer selon le timing configuré
```

#### Scénario B: Automatisation via N8N
```
[Appel terminé dans Retell/VAPI]
        │
        ▼
[Webhook déclenche workflow N8N]
        │
        ▼
[N8N appelle POST /api/n8n/reviews/create-request]
        │
        ▼
[Demande créée automatiquement]
        │
        ▼
[N8N attend le délai configuré]
        │
        ▼
[N8N appelle POST /api/n8n/reviews/send-request]
        │
        ▼
[Email/SMS envoyé au client]
```

#### Consultation des Résultats
```
1. Avis > Statistiques
   ├── Voir note globale
   ├── Voir évolution dans le temps
   ├── Analyser sentiment des avis
   └── Comparer les plateformes
   │
2. Avis > Tous les avis
   ├── Filtrer par plateforme/note
   ├── Lire les nouveaux avis
   ├── Rédiger des réponses
   └── Flagger les avis importants
   │
3. Avis > Campagnes
   ├── Voir taux de conversion
   ├── Suivre statut de chaque demande
   └── Voir codes promo générés/utilisés
```

---

## Parcours Client Final (Destinataire)

Le client final est la personne qui a visité l'établissement et reçoit la demande d'avis.

### Étape 1: Réception du Message

#### Email Reçu
```
De: noreply@speedai.fr
Objet: Partagez votre expérience avec [Nom Entreprise]

Bonjour Jean,

Merci pour votre visite chez [Nom Entreprise] !

Votre avis nous est précieux et nous aide à nous améliorer.

🎁 En remerciement : -10% sur votre prochaine visite

[Bouton: Laisser mon avis]

Cordialement,
L'équipe [Nom Entreprise]
```

#### SMS Reçu
```
[Nom Entreprise]: Bonjour Jean ! Votre avis compte.
🎁 -10% en cadeau
👉 Donnez votre avis: https://speedai.fr/review/rv_xxx
```

### Étape 2: Clic sur le Lien

Le client arrive sur la page `/review/rv_xxx` qui affiche:

```
┌────────────────────────────────────┐
│                                    │
│     ★ ★ ★ ★ ★                     │
│                                    │
│     Bonjour Jean !                 │
│                                    │
│  Partagez votre expérience sur     │
│  la plateforme de votre choix      │
│                                    │
│  ┌────────────────────────────┐   │
│  │ 🎁 -10% sur votre          │   │
│  │    prochaine visite        │   │
│  │    Valable 30 jours        │   │
│  └────────────────────────────┘   │
│                                    │
│  [Google             →]           │
│  [TripAdvisor        →]           │
│  [Facebook           →]           │
│                                    │
│  ─────────────────────────────    │
│                                    │
│  [J'ai laissé mon avis !]         │
│                                    │
└────────────────────────────────────┘
```

### Étape 3: Choix de la Plateforme

1. Le client clique sur "Google"
2. Un nouvel onglet s'ouvre avec la page Google pour laisser un avis
3. Le client rédige et publie son avis sur Google
4. Le client revient sur l'onglet SpeedAI

### Étape 4: Confirmation

1. Le client clique sur "J'ai laissé mon avis !"
2. Le système enregistre la confirmation
3. Un code promo est généré (si incitation configurée)

### Étape 5: Réception du Code Promo

```
┌────────────────────────────────────┐
│                                    │
│         ✓ Merci beaucoup !        │
│                                    │
│     Votre avis compte énormément  │
│            pour nous.              │
│                                    │
│  ┌────────────────────────────┐   │
│  │  🎁 Votre code promo       │   │
│  │                            │   │
│  │    ╔══════════════════╗    │   │
│  │    ║   MERCI-A7B2C9   ║ 📋 │   │
│  │    ╚══════════════════╝    │   │
│  │                            │   │
│  │  Présentez ce code lors    │   │
│  │  de votre prochaine visite │   │
│  └────────────────────────────┘   │
│                                    │
└────────────────────────────────────┘
```

### Format du Code Promo
```
MERCI-{6 caractères aléatoires majuscules}
Exemples: MERCI-A7B2C9, MERCI-X4K9P2
```

---

## Système d'Incitations

### Types d'Incitations Disponibles

| Type | Champs Utilisés | Exemple d'Affichage |
|------|-----------------|---------------------|
| `percentage` | `percentage_value` (1-100) | "-10% sur votre prochaine visite" |
| `fixed_amount` | `fixed_amount_value` (centimes) | "-5€ sur votre prochain achat" |
| `free_item` | `free_item_name` | "Un café offert !" |
| `lottery` | `lottery_prize` | "Participez au tirage d'un iPhone" |
| `loyalty_points` | `loyalty_points_value` | "100 points fidélité offerts" |
| `custom` | `custom_description` | Texte libre personnalisé |

### Configuration d'une Incitation

```javascript
{
  type: "percentage",
  percentageValue: 10,
  displayMessage: "-10% sur votre prochaine visite",
  validityDays: 30,
  singleUse: true,
  minimumPurchase: 0, // centimes
  isActive: true,
  isDefault: true // Utilisée automatiquement pour les nouvelles demandes
}
```

### Cycle de Vie du Code Promo

```
1. Demande créée avec incentiveId
   └── promoCode = null
   
2. Client confirme l'avis
   └── promoCode = "MERCI-XXXXXX" généré
   
3. Client présente le code en caisse
   └── promoCodeUsedAt = NOW()
```

---

## Intégration N8N

### Endpoints Dédiés N8N

Tous les endpoints N8N nécessitent l'authentification via header:
```
Authorization: Bearer <N8N_MASTER_API_KEY>
```

#### 1. Créer une Demande
```http
POST /api/n8n/reviews/create-request

{
  "client_email": "restaurant@example.com",  // Email du client SpeedAI
  "customer_name": "Jean Dupont",
  "customer_email": "jean@email.com",
  "customer_phone": "+33612345678",
  "reservation_id": "RES-001",
  "reservation_date": "2024-12-20",
  "reservation_time": "20:00",
  "send_method": "email"  // "email" | "sms" | "both"
}
```

**Réponse:**
```json
{
  "success": true,
  "request_id": "uuid-xxx",
  "tracking_token": "rv_1733567890123_abc123",
  "status": "pending",
  "incentive": {
    "id": "uuid-incentive",
    "display_message": "-10% sur votre prochaine visite"
  }
}
```

#### 2. Envoyer une Demande
```http
POST /api/n8n/reviews/send-request

{
  "request_id": "uuid-xxx"
}
```

**Réponse:**
```json
{
  "success": true,
  "email_sent": true,
  "sms_sent": true,
  "sms_data": {
    "to": "+33612345678",
    "message": "Bonjour Jean, merci pour votre visite...",
    "company_name": "Mon Restaurant",
    "review_link": "https://domain.com/review/rv_xxx",
    "incentive": "-10% sur votre prochaine visite"
  },
  "tracking_url": "https://domain.com/review/rv_xxx"
}
```

#### 3. Récupérer les Demandes en Attente
```http
GET /api/n8n/reviews/pending-requests?max_age_hours=48&ready_only=true
```

#### 4. Marquer comme Envoyées
```http
POST /api/n8n/reviews/mark-sent

{
  "request_ids": ["uuid-1", "uuid-2"]
}
```

### Workflow N8N Type

```
[Webhook: Appel terminé]
       │
       ▼
[IF: RDV confirmé?]
       │
  ┌────┴────┐
 OUI       NON
  │         │
  ▼         ▼
[POST create-request] [Fin]
  │
  ▼
[WAIT 2h après RDV]
  │
  ▼
[POST send-request]
  │
  ▼
[Fin]
```

---

## Widgets & QR Codes

### QR Code de Collecte

**URL générée:**
```
https://speedai.fr/review/collect?userId={user_id}&platform={platform}
```

**Options de configuration:**
- `platform`: `all` (affiche tous les choix) ou spécifique (`google`, `tripadvisor`, etc.)
- Personnalisation visuelle:
  - Taille (128px à 512px)
  - Couleur de premier plan
  - Couleur de fond
  - Marge incluse ou non

**Usage:**
- Imprimer pour affichage en établissement
- Inclure dans les factures/reçus
- Afficher sur table ou comptoir

### Widget Iframe

**Code d'intégration:**
```html
<iframe 
  src="https://speedai.fr/embed/reviews?userId={id}&theme=dark&max=5&showPlatform=true&showDate=true&autoScroll=true"
  width="400"
  height="300"
  frameborder="0"
  style="border: none; border-radius: 12px; overflow: hidden;"
  title="Avis clients"
></iframe>
```

**Paramètres:**
| Paramètre | Valeurs | Description |
|-----------|---------|-------------|
| `theme` | `dark` / `light` | Thème du widget |
| `max` | 1-20 | Nombre d'avis affichés |
| `showPlatform` | `true` / `false` | Icône de la plateforme |
| `showDate` | `true` / `false` | Date relative de l'avis |
| `autoScroll` | `true` / `false` | Carrousel automatique |

### Badge de Note

**HTML généré:**
```html
<a href="https://speedai.fr/reviews" target="_blank" 
   style="display: inline-flex; align-items: center; gap: 8px; ...">
  <span style="color: #C8B88A;">4.8★</span>
  <span style="color: rgba(255,255,255,0.7);">127 avis</span>
</a>
```

---

## Aggregation Multi-Plateformes

### Plateformes Supportées

| Plateforme | Méthode de Connexion | Synchronisation |
|------------|----------------------|-----------------|
| Google Business Profile | OAuth 2.0 | Automatique (cron 4h) |
| Facebook Pages | OAuth 2.0 | Automatique (cron 4h) |
| TripAdvisor | URL manuelle | Automatique (cron 4h) |
| Yelp | URL manuelle | Manuelle |
| Doctolib | URL manuelle | Manuelle |
| Pages Jaunes | URL manuelle | Manuelle |

### Flux de Synchronisation

```
[Cron Job: 4h00 Paris]
       │
       ▼
[Pour chaque source connectée]
       │
       ▼
[Appel API plateforme]
       │
       ▼
[Dédoublonnage par platform_review_id]
       │
       ▼
[Insertion/Update dans reviews]
       │
       ▼
[Création log dans review_sync_logs]
       │
       ▼
[Mise à jour last_sync_at dans review_sources]
```

### Synchronisation Manuelle

- **Par source**: Bouton "Synchroniser" sur chaque connexion
- **Globale**: Bouton "Synchroniser tout" dans les paramètres

---

## Flux de Données Complet

### Diagramme Complet du Système

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUX DEMANDE D'AVIS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [N8N: Appel terminé] ──── ou ──── [Dashboard: Nouvelle demande]           │
│         │                                     │                             │
│         ▼                                     ▼                             │
│  POST /api/n8n/reviews/create-request   POST /api/reviews/requests          │
│         │                                     │                             │
│         └──────────────┬──────────────────────┘                             │
│                        ▼                                                    │
│              ┌──────────────────────┐                                       │
│              │  review_requests     │  status: 'pending'                    │
│              │  tracking_token: rv_xxx                                      │
│              └──────────────────────┘                                       │
│                        │                                                    │
│                        ▼                                                    │
│  POST /api/reviews/requests/:id/send                                        │
│         │                                                                   │
│         ├─────────────────────────────────────┐                             │
│         ▼                                     ▼                             │
│  [📧 Email envoyé]                     [📱 SMS envoyé]                      │
│  status: 'sent'                        (via Resend/Twilio)                  │
│         │                                                                   │
│         ▼                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │                    CLIENT REÇOIT MESSAGE                       │         │
│  │                                                                │         │
│  │  "Bonjour Jean, merci pour votre visite !                     │         │
│  │   🎁 -10% sur votre prochaine visite                          │         │
│  │   [Laisser mon avis]"                                         │         │
│  │                                                                │         │
│  │  Lien: https://speedai.fr/review/rv_xxx                       │         │
│  └───────────────────────────────────────────────────────────────┘         │
│         │                                                                   │
│         ▼                                                                   │
│  GET /api/reviews/public/track/rv_xxx                                       │
│  → linkClickedAt = NOW()                                                    │
│  → status: 'clicked'                                                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │                    PAGE PUBLIQUE                               │         │
│  │                                                                │         │
│  │  "Où souhaitez-vous laisser votre avis ?"                     │         │
│  │                                                                │         │
│  │  🎁 -10% sur votre prochaine visite (valable 30 jours)        │         │
│  │                                                                │         │
│  │  [Google] [TripAdvisor] [Facebook]                            │         │
│  │                                                                │         │
│  │  ─────────────────────────────────────                        │         │
│  │  [✓ J'ai laissé mon avis !]                                   │         │
│  └───────────────────────────────────────────────────────────────┘         │
│         │                                                                   │
│         ├─── Client clique sur Google ───▶ [Nouvel onglet: Google Reviews] │
│         │                                                                   │
│         ▼                                                                   │
│  POST /api/reviews/public/confirm/rv_xxx                                    │
│  { platform: "google" }                                                     │
│  → reviewConfirmedAt = NOW()                                                │
│  → reviewConfirmedPlatform = "google"                                       │
│  → status: 'confirmed'                                                      │
│  → promoCode = "MERCI-A7B2C9" (si incentive)                               │
│         │                                                                   │
│         ▼                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │                    CONFIRMATION                                │         │
│  │                                                                │         │
│  │  ✓ Merci beaucoup !                                           │         │
│  │                                                                │         │
│  │  ╔════════════════════╗                                       │         │
│  │  ║   MERCI-A7B2C9     ║  [📋 Copier]                          │         │
│  │  ╚════════════════════╝                                       │         │
│  │                                                                │         │
│  │  Présentez ce code lors de votre prochaine visite             │         │
│  │  -10% sur votre prochaine visite                              │         │
│  │  Valable 30 jours                                             │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    SYNCHRONISATION AVIS (en parallèle)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Cron: 4h00]                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  [Pour chaque review_source connectée]                                      │
│       │                                                                     │
│       ├── Google: GET Google Business API                                   │
│       ├── Facebook: GET Facebook Graph API                                  │
│       └── TripAdvisor: Scraping/API                                        │
│       │                                                                     │
│       ▼                                                                     │
│  [Insertion dans table reviews]                                             │
│       │                                                                     │
│       ▼                                                                     │
│  [Dashboard affiche avis centralisés]                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints - Résumé

### Endpoints Authentifiés (Session Cookie)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/reviews/config` | Récupérer configuration |
| PUT | `/api/reviews/config` | Mettre à jour configuration |
| GET | `/api/reviews/incentives` | Liste des incitations |
| POST | `/api/reviews/incentives` | Créer incitation |
| PUT | `/api/reviews/incentives/:id` | Modifier incitation |
| DELETE | `/api/reviews/incentives/:id` | Supprimer incitation |
| POST | `/api/reviews/incentives/:id/default` | Définir par défaut |
| GET | `/api/reviews/requests` | Liste des demandes |
| POST | `/api/reviews/requests` | Créer demande |
| POST | `/api/reviews/requests/:id/send` | Envoyer demande |
| GET | `/api/reviews/requests/stats` | Statistiques demandes |
| GET | `/api/reviews` | Liste des avis |
| GET | `/api/reviews/:id` | Détail d'un avis |
| POST | `/api/reviews/:id/read` | Marquer comme lu |
| POST | `/api/reviews/:id/flag` | Flagger un avis |
| POST | `/api/reviews/:id/respond` | Répondre à un avis |
| GET | `/api/reviews/stats` | Statistiques globales |
| GET | `/api/reviews/alerts` | Configuration alertes |
| PUT | `/api/reviews/alerts` | Modifier alertes |
| GET | `/api/reviews/sources` | Sources connectées |
| POST | `/api/reviews/sources/:id/sync` | Sync manuelle |
| POST | `/api/reviews/sources/sync-all` | Sync globale |
| DELETE | `/api/reviews/sources/:id` | Déconnecter source |

### Endpoints Publics (Sans Auth)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/reviews/public/track/:token` | Tracking clic lien |
| POST | `/api/reviews/public/confirm/:token` | Confirmation avis |
| GET | `/api/reviews/public/collect/:userId` | Collecte via QR code |
| GET | `/api/reviews/public/embed/:userId` | Widget intégrable |

### Endpoints N8N (API Key)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/n8n/reviews/create-request` | Créer demande |
| POST | `/api/n8n/reviews/send-request` | Envoyer demande |
| GET | `/api/n8n/reviews/pending-requests` | Demandes en attente |
| POST | `/api/n8n/reviews/mark-sent` | Marquer envoyées |

---

## Variables d'Environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `RESEND_API_KEY` | Clé API Resend (emails) |
| `N8N_MASTER_API_KEY` | Clé pour endpoints N8N |
| `SESSION_SECRET` | Secret sessions Express |

---

## Points Clés à Retenir

1. **Deux flux de collecte**:
   - Via tracking token (email/SMS) → Page `/review/{token}`
   - Via QR code direct → Page `/review/collect?userId=...`

2. **Le code promo est généré UNIQUEMENT après confirmation** de l'avis, pas avant.

3. **Le SMS n'est pas envoyé par SpeedAI directement** - les données sont préparées pour N8N qui gère l'envoi via Twilio.

4. **La synchronisation des avis externes** se fait via cron à 4h00 Paris.

5. **Les incitations sont optionnelles** - le système fonctionne sans.

6. **Le tracking token a un format spécifique**: `rv_{timestamp_ms}_{random_9_chars}`

7. **L'analyse IA** (sentiment, thèmes, suggestions) est disponible mais optionnelle.
