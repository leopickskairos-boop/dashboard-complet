# Documentation Technique Complète - Système Avis & Réputation SpeedAI

## Vue d'ensemble

Le système Avis & Réputation de SpeedAI permet aux entreprises clientes de collecter automatiquement des avis clients après leurs interactions. Il offre un système d'incitations (réductions, cadeaux) pour encourager les clients à laisser des avis positifs sur les plateformes de réputation.

**Fonctionnalités principales:**
- Envoi automatique de demandes d'avis (email/SMS)
- Système d'incitations configurables (réductions, cadeaux, tirages au sort)
- Tracking complet du parcours client (envoi → clic → confirmation)
- Centralisation des avis de toutes les plateformes
- Alertes personnalisables (avis négatifs, etc.)
- Génération de codes promo après confirmation

---

# PARTIE 1 : ARCHITECTURE BASE DE DONNÉES

## Tables et Relations

```
┌──────────────────┐     ┌────────────────────┐
│     users        │────<│   review_config    │  (1:1)
│                  │     └────────────────────┘
│                  │
│                  │────<┌────────────────────┐
│                  │     │ review_incentives  │  (1:N)
│                  │     └────────────────────┘
│                  │              │
│                  │              │ (référence optionnelle)
│                  │              ▼
│                  │────<┌────────────────────┐
│                  │     │  review_requests   │  (1:N)
│                  │     └────────────────────┘
│                  │              │
│                  │              │ (matching optionnel)
│                  │              ▼
│                  │────<┌────────────────────┐
│                  │     │     reviews        │  (1:N)
│                  │     └────────────────────┘
│                  │
│                  │────<┌────────────────────┐
└──────────────────┘     │   review_alerts    │  (1:N)
                         └────────────────────┘
```

---

## Table 1: `review_config`

Configuration globale du système d'avis pour chaque utilisateur. **Relation 1:1 avec `users`**.

| Colonne | Type | Nullable | Default | Description |
|---------|------|----------|---------|-------------|
| `id` | VARCHAR (UUID) | NON | `gen_random_uuid()` | Clé primaire |
| `user_id` | VARCHAR (UUID) | NON | - | FK vers `users.id`, UNIQUE |
| **Activation** |
| `enabled` | BOOLEAN | NON | `false` | Système activé/désactivé |
| **Timing d'envoi** |
| `timing_mode` | TEXT | NON | `'smart'` | `'smart'` \| `'fixed_delay'` \| `'fixed_time'` |
| `fixed_delay_hours` | INTEGER | NON | `24` | Délai en heures (mode `fixed_delay`) |
| `fixed_time` | TEXT | OUI | `'18:00'` | Heure fixe HH:MM (mode `fixed_time`) |
| `send_window_start` | TEXT | OUI | `'10:00'` | Début fenêtre d'envoi HH:MM |
| `send_window_end` | TEXT | OUI | `'20:00'` | Fin fenêtre d'envoi HH:MM |
| `avoid_weekends` | BOOLEAN | NON | `false` | Éviter envoi le weekend |
| **Informations entreprise** |
| `company_name` | TEXT | OUI | `null` | Nom de l'entreprise (pour emails/SMS) |
| **Messages personnalisés** |
| `sms_message` | TEXT | OUI | `null` | Template SMS personnalisé |
| `email_subject` | TEXT | OUI | `null` | Objet email personnalisé |
| `email_message` | TEXT | OUI | `null` | Corps email personnalisé |
| **URLs des plateformes** |
| `google_place_id` | TEXT | OUI | `null` | ID Google Places |
| `google_review_url` | TEXT | OUI | `null` | URL directe avis Google |
| `tripadvisor_url` | TEXT | OUI | `null` | URL TripAdvisor |
| `facebook_page_url` | TEXT | OUI | `null` | URL page Facebook |
| `pages_jaunes_url` | TEXT | OUI | `null` | URL Pages Jaunes |
| `doctolib_url` | TEXT | OUI | `null` | URL Doctolib |
| `yelp_url` | TEXT | OUI | `null` | URL Yelp |
| **OAuth (Phase 2 - non implémenté)** |
| `google_business_connected` | BOOLEAN | NON | `false` | Connexion Google Business |
| `google_business_token` | JSONB | OUI | `null` | Token OAuth Google |
| `google_business_account_id` | TEXT | OUI | `null` | ID compte Google Business |
| `google_business_location_id` | TEXT | OUI | `null` | ID location Google |
| `facebook_connected` | BOOLEAN | NON | `false` | Connexion Facebook Pages |
| `facebook_token` | JSONB | OUI | `null` | Token OAuth Facebook |
| `facebook_page_id` | TEXT | OUI | `null` | ID page Facebook |
| **Configuration** |
| `platforms_priority` | JSONB | OUI | `['google', 'tripadvisor', 'facebook']` | Ordre d'affichage plateformes |
| **Timestamps** |
| `created_at` | TIMESTAMP | NON | `NOW()` | Date création |
| `updated_at` | TIMESTAMP | NON | `NOW()` | Date mise à jour |

### Valeurs `timing_mode`:
- `smart` : L'IA détermine le meilleur moment (non implémenté, utilise `fixed_delay` par défaut)
- `fixed_delay` : Envoie X heures après la création de la demande
- `fixed_time` : Envoie à une heure fixe chaque jour

---

## Table 2: `review_incentives`

Gestion des offres incitatives pour encourager les avis. **Relation 1:N avec `users`**.

| Colonne | Type | Nullable | Default | Description |
|---------|------|----------|---------|-------------|
| `id` | VARCHAR (UUID) | NON | `gen_random_uuid()` | Clé primaire |
| `user_id` | VARCHAR (UUID) | NON | - | FK vers `users.id` |
| **Type d'incitation** |
| `type` | TEXT | NON | - | Type d'offre (voir enum) |
| **Valeurs selon type** |
| `percentage_value` | INTEGER | OUI | `null` | Pourcentage (1-100) |
| `fixed_amount_value` | INTEGER | OUI | `null` | Montant en **centimes** |
| `free_item_name` | TEXT | OUI | `null` | Nom article offert |
| `lottery_prize` | TEXT | OUI | `null` | Description lot tirage |
| `loyalty_points_value` | INTEGER | OUI | `null` | Points fidélité |
| `custom_description` | TEXT | OUI | `null` | Description personnalisée |
| **Conditions** |
| `validity_days` | INTEGER | NON | `30` | Durée validité en jours |
| `single_use` | BOOLEAN | NON | `true` | Usage unique |
| `minimum_purchase` | INTEGER | OUI | `0` | Achat minimum en **centimes** |
| **Affichage** |
| `display_message` | TEXT | OUI | `null` | Message affiché au client |
| **Statut** |
| `is_active` | BOOLEAN | NON | `true` | Offre active |
| `is_default` | BOOLEAN | NON | `false` | Offre par défaut (1 seule/user) |
| **Timestamp** |
| `created_at` | TIMESTAMP | NON | `NOW()` | Date création |

### Enum `type` (review_incentive_type):

| Valeur | Description | Champ utilisé | Exemple `display_message` |
|--------|-------------|---------------|---------------------------|
| `percentage` | Réduction % | `percentage_value` | "-10% sur votre prochaine visite" |
| `fixed_amount` | Réduction € | `fixed_amount_value` | "-5€ sur votre prochain achat" |
| `free_item` | Article offert | `free_item_name` | "Un café offert !" |
| `lottery` | Tirage au sort | `lottery_prize` | "Participez au tirage d'un iPhone" |
| `loyalty_points` | Points fidélité | `loyalty_points_value` | "100 points fidélité offerts" |
| `custom` | Personnalisé | `custom_description` | Texte libre |

---

## Table 3: `review_requests`

Suivi de chaque demande d'avis envoyée. **Relation 1:N avec `users`**.

| Colonne | Type | Nullable | Default | Description |
|---------|------|----------|---------|-------------|
| `id` | VARCHAR (UUID) | NON | `gen_random_uuid()` | Clé primaire |
| `user_id` | VARCHAR (UUID) | NON | - | FK vers `users.id` |
| **Informations client** |
| `customer_name` | TEXT | OUI | `null` | Nom du client |
| `customer_email` | TEXT | OUI | `null` | Email du client |
| `customer_phone` | TEXT | OUI | `null` | Téléphone (+33...) |
| **Lien réservation** |
| `reservation_id` | TEXT | OUI | `null` | ID externe réservation |
| `reservation_date` | TIMESTAMP | OUI | `null` | Date du RDV |
| `reservation_time` | TEXT | OUI | `null` | Heure RDV (HH:MM) |
| **Envoi** |
| `scheduled_at` | TIMESTAMP | OUI | `null` | Date planifiée envoi |
| `sent_at` | TIMESTAMP | OUI | `null` | Date envoi effectif |
| `send_method` | TEXT | NON | `'both'` | `'sms'` \| `'email'` \| `'both'` |
| **Tracking** |
| `tracking_token` | TEXT | OUI | UNIQUE | Token unique tracking |
| `link_clicked_at` | TIMESTAMP | OUI | `null` | Date clic sur lien |
| `platform_clicked` | TEXT | OUI | `null` | Plateforme choisie |
| **Confirmation** |
| `review_confirmed_at` | TIMESTAMP | OUI | `null` | Date confirmation avis |
| `review_confirmed_platform` | TEXT | OUI | `null` | Plateforme de l'avis |
| **Incitation** |
| `incentive_id` | VARCHAR (UUID) | OUI | `null` | FK vers `review_incentives.id` |
| `promo_code` | TEXT | OUI | `null` | Code promo généré |
| `promo_code_used_at` | TIMESTAMP | OUI | `null` | Date utilisation code |
| **Statut** |
| `status` | TEXT | NON | `'pending'` | Statut (voir enum) |
| **Timestamp** |
| `created_at` | TIMESTAMP | NON | `NOW()` | Date création |

### Format `tracking_token`:
```
rv_{timestamp_ms}_{random_9_chars}
Exemple: rv_1733567890123_a7b2c9d4e
```

### Enum `status` (review_request_status):

| Valeur | Description | Transition suivante |
|--------|-------------|---------------------|
| `pending` | Créée, en attente d'envoi | → `scheduled` ou `sent` |
| `scheduled` | Planifiée pour envoi | → `sent` |
| `sent` | Message envoyé | → `clicked` ou `expired` |
| `clicked` | Client a cliqué sur le lien | → `confirmed` ou `expired` |
| `confirmed` | Client a confirmé avoir laissé un avis | FIN |
| `expired` | Demande expirée sans réponse | FIN |

### Diagramme d'états:
```
[pending] ──▶ [scheduled] ──▶ [sent] ──▶ [clicked] ──▶ [confirmed]
    │             │              │            │
    └─────────────┴──────────────┴────────────┴──────▶ [expired]
```

---

## Table 4: `reviews`

Stockage centralisé des avis de toutes les plateformes. **Relation 1:N avec `users`**.

| Colonne | Type | Nullable | Default | Description |
|---------|------|----------|---------|-------------|
| `id` | VARCHAR (UUID) | NON | `gen_random_uuid()` | Clé primaire |
| `user_id` | VARCHAR (UUID) | NON | - | FK vers `users.id` |
| **Source** |
| `platform` | TEXT | NON | - | `'google'` \| `'tripadvisor'` \| `'facebook'` \| `'yelp'` \| `'doctolib'` \| `'pages_jaunes'` |
| `platform_review_id` | TEXT | OUI | `null` | ID unique sur la plateforme |
| **Contenu** |
| `rating` | INTEGER | NON | - | Note 1-5 |
| `content` | TEXT | OUI | `null` | Texte de l'avis |
| `reviewer_name` | TEXT | OUI | `null` | Nom de l'auteur |
| `reviewer_avatar_url` | TEXT | OUI | `null` | URL avatar |
| `review_date` | TIMESTAMP | OUI | `null` | Date de l'avis |
| **Réponse** |
| `response_text` | TEXT | OUI | `null` | Texte réponse |
| `response_date` | TIMESTAMP | OUI | `null` | Date réponse |
| `response_status` | TEXT | NON | `'none'` | `'none'` \| `'draft'` \| `'published'` |
| **Analyse IA** |
| `sentiment` | TEXT | OUI | `null` | Sentiment détecté (voir enum) |
| `themes` | JSONB | OUI | `null` | Thèmes extraits (array strings) |
| `ai_summary` | TEXT | OUI | `null` | Résumé IA |
| `ai_suggested_response` | TEXT | OUI | `null` | Réponse suggérée par IA |
| **Matching** |
| `matched_request_id` | VARCHAR (UUID) | OUI | `null` | FK vers `review_requests.id` |
| **Statut** |
| `is_read` | BOOLEAN | NON | `false` | Marqué comme lu |
| `is_flagged` | BOOLEAN | NON | `false` | Marqué pour attention |
| **Timestamps** |
| `created_at` | TIMESTAMP | NON | `NOW()` | Date création |
| `updated_at` | TIMESTAMP | NON | `NOW()` | Date mise à jour |

### Enum `sentiment` (review_sentiment):

| Valeur | Description | Notes typiques |
|--------|-------------|----------------|
| `very_positive` | Très positif | 5 étoiles + contenu enthousiaste |
| `positive` | Positif | 4-5 étoiles |
| `neutral` | Neutre | 3 étoiles |
| `negative` | Négatif | 2 étoiles |
| `very_negative` | Très négatif | 1 étoile |

---

## Table 5: `review_alerts`

Configuration des alertes par type. **Relation 1:N avec `users`** (1 ligne par type d'alerte).

| Colonne | Type | Nullable | Default | Description |
|---------|------|----------|---------|-------------|
| `id` | VARCHAR (UUID) | NON | `gen_random_uuid()` | Clé primaire |
| `user_id` | VARCHAR (UUID) | NON | - | FK vers `users.id` |
| `alert_type` | TEXT | NON | - | Type d'alerte (voir enum) |
| `is_enabled` | BOOLEAN | NON | `true` | Alerte activée |
| `email_notification` | BOOLEAN | NON | `true` | Notifier par email |
| `sms_notification` | BOOLEAN | NON | `false` | Notifier par SMS |
| `push_notification` | BOOLEAN | NON | `true` | Notifier par push |
| `threshold_value` | INTEGER | OUI | `null` | Seuil personnalisé |
| `created_at` | TIMESTAMP | NON | `NOW()` | Date création |

### Enum `alert_type` (review_alert_type):

| Valeur | Description | `threshold_value` |
|--------|-------------|-------------------|
| `negative_review` | Nouvel avis 1-2 étoiles | Non utilisé |
| `new_5_star` | Nouvel avis 5 étoiles | Non utilisé |
| `no_response_48h` | Avis sans réponse >48h | Heures (défaut: 48) |
| `weekly_report` | Rapport hebdomadaire | Non utilisé |
| `rating_drop` | Baisse note moyenne | Points x10 (3 = -0.3) |

---

# PARTIE 2 : API ENDPOINTS

## Authentification

Toutes les routes `/api/reviews/*` (sauf `/public/*`) nécessitent une **session authentifiée** via cookie httpOnly.

**Headers requis:**
```
Cookie: connect.sid=<session_id>
```

---

## Configuration (`/api/reviews/config`)

### GET `/api/reviews/config`
Récupère la configuration (crée une config par défaut si inexistante).

**Réponse 200:**
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "enabled": true,
  "timingMode": "fixed_delay",
  "fixedDelayHours": 24,
  "fixedTime": "18:00",
  "sendWindowStart": "10:00",
  "sendWindowEnd": "20:00",
  "avoidWeekends": false,
  "smsMessage": null,
  "emailSubject": "Partagez votre expérience !",
  "emailMessage": null,
  "googlePlaceId": null,
  "googleReviewUrl": "https://g.page/r/xxx",
  "tripadvisorUrl": "https://tripadvisor.com/xxx",
  "facebookPageUrl": null,
  "pagesJaunesUrl": null,
  "doctolibUrl": null,
  "yelpUrl": null,
  "googleBusinessConnected": false,
  "googleBusinessToken": null,
  "googleBusinessAccountId": null,
  "googleBusinessLocationId": null,
  "facebookConnected": false,
  "facebookToken": null,
  "facebookPageId": null,
  "platformsPriority": ["google", "tripadvisor", "facebook"],
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

### PUT `/api/reviews/config`
Met à jour la configuration (tous les champs optionnels).

**Body:**
```json
{
  "enabled": true,
  "timingMode": "fixed_delay",
  "fixedDelayHours": 2,
  "fixedTime": "18:00",
  "sendWindowStart": "10:00",
  "sendWindowEnd": "20:00",
  "avoidWeekends": true,
  "smsMessage": "Bonjour {{customerName}}, merci pour votre visite...",
  "emailSubject": "Votre avis compte !",
  "googleReviewUrl": "https://g.page/r/xxx",
  "tripadvisorUrl": "https://tripadvisor.com/xxx",
  "platformsPriority": ["google", "tripadvisor"]
}
```

**Réponse 200:** Config mise à jour (même format que GET)

---

## Incitations (`/api/reviews/incentives`)

### GET `/api/reviews/incentives`
Liste toutes les offres de l'utilisateur.

**Réponse 200:**
```json
[
  {
    "id": "incentive-uuid",
    "userId": "user-uuid",
    "type": "percentage",
    "percentageValue": 10,
    "fixedAmountValue": null,
    "freeItemName": null,
    "lotteryPrize": null,
    "loyaltyPointsValue": null,
    "customDescription": null,
    "validityDays": 30,
    "singleUse": true,
    "minimumPurchase": 0,
    "displayMessage": "-10% sur votre prochaine visite",
    "isActive": true,
    "isDefault": true,
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
]
```

### POST `/api/reviews/incentives`
Crée une nouvelle offre.

**Body:**
```json
{
  "type": "free_item",
  "freeItemName": "Café",
  "displayMessage": "Un café offert pour votre avis !",
  "validityDays": 30,
  "singleUse": true,
  "minimumPurchase": 0,
  "isActive": true
}
```

**Réponse 200:** Offre créée

### PUT `/api/reviews/incentives/:id`
Met à jour une offre existante.

**Body:** Champs à modifier
**Réponse 200:** Offre mise à jour
**Réponse 404:** `{ "message": "Incitation non trouvée" }`

### DELETE `/api/reviews/incentives/:id`
Supprime une offre.

**Réponse 200:** `{ "success": true }`

### POST `/api/reviews/incentives/:id/default`
Définit une offre comme offre par défaut (désactive `isDefault` sur les autres).

**Réponse 200:** `{ "success": true }`

---

## Demandes d'avis (`/api/reviews/requests`)

### GET `/api/reviews/requests`
Liste les demandes d'avis avec filtres optionnels.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filtrer par statut |
| `limit` | number | Nombre max de résultats |
| `offset` | number | Pagination |

**Réponse 200:**
```json
[
  {
    "id": "request-uuid",
    "userId": "user-uuid",
    "customerName": "Jean Dupont",
    "customerEmail": "jean@example.com",
    "customerPhone": "+33612345678",
    "reservationId": "res_123",
    "reservationDate": "2024-01-20T12:00:00.000Z",
    "reservationTime": "12:00",
    "scheduledAt": null,
    "sentAt": "2024-01-15T14:00:00.000Z",
    "sendMethod": "email",
    "trackingToken": "rv_1733567890123_a7b2c9d4e",
    "linkClickedAt": null,
    "platformClicked": null,
    "reviewConfirmedAt": null,
    "reviewConfirmedPlatform": null,
    "incentiveId": "incentive-uuid",
    "promoCode": null,
    "promoCodeUsedAt": null,
    "status": "sent",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
]
```

### POST `/api/reviews/requests`
Crée une demande d'avis manuellement.

**Body:**
```json
{
  "customerName": "Jean Dupont",
  "customerEmail": "jean@example.com",
  "customerPhone": "+33612345678",
  "sendMethod": "email",
  "incentiveId": "incentive-uuid"
}
```

**Validation:**
- `customerName` : requis
- `customerEmail` OU `customerPhone` : au moins un requis

**Réponse 200:** Demande créée avec `trackingToken` généré
**Réponse 400:** 
- `{ "message": "Nom du client requis" }`
- `{ "message": "Email ou téléphone requis" }`

### POST `/api/reviews/requests/:id/send`
Envoie immédiatement la demande (email et/ou SMS).

**Réponse 200:**
```json
{
  "success": true,
  "emailSent": true,
  "smsSent": false
}
```

**Note:** SMS non implémenté (TODO: Twilio), mais le message est préparé et loggé.

### GET `/api/reviews/requests/stats`
Statistiques des demandes d'avis.

**Réponse 200:**
```json
{
  "totalSent": 150,
  "linkClicked": 89,
  "reviewsConfirmed": 45,
  "conversionRate": 30.0
}
```

---

## Avis centralisés (`/api/reviews`)

### GET `/api/reviews`
Liste les avis avec filtres.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `platform` | string | Filtrer par plateforme |
| `ratingMin` | number | Note minimum (1-5) |
| `ratingMax` | number | Note maximum (1-5) |
| `sentiment` | string | Filtrer par sentiment |
| `isRead` | boolean | Filtrer par statut lu |
| `search` | string | Recherche texte |
| `limit` | number | Nombre max |
| `offset` | number | Pagination |

**Réponse 200:** Array d'avis

### GET `/api/reviews/:id`
Récupère un avis spécifique.

**Réponse 200:** Objet avis complet
**Réponse 404:** `{ "message": "Avis non trouvé" }`

### POST `/api/reviews/:id/read`
Marque un avis comme lu.

**Réponse 200:** Avis mis à jour

### POST `/api/reviews/:id/flag`
Marque/démarque un avis pour attention.

**Body:**
```json
{ "flagged": true }
```

**Réponse 200:** Avis mis à jour

### POST `/api/reviews/:id/respond`
Enregistre une réponse à un avis.

**Body:**
```json
{
  "responseText": "Merci beaucoup pour votre retour !",
  "publish": false
}
```

**Réponse 200:** Avis avec réponse
- `publish: false` → `responseStatus: 'draft'`
- `publish: true` → `responseStatus: 'published'` + `responseDate`

### GET `/api/reviews/stats`
Statistiques globales des avis.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `period` | string | `'week'` \| `'month'` \| `'year'` \| `'all'` |

**Réponse 200:**
```json
{
  "averageRating": 4.2,
  "totalReviews": 127,
  "newReviewsPeriod": 15,
  "ratingDistribution": { "1": 5, "2": 8, "3": 12, "4": 45, "5": 57 },
  "platformDistribution": { "google": 80, "tripadvisor": 30, "facebook": 17 },
  "sentimentDistribution": { "very_positive": 50, "positive": 40, "neutral": 20, "negative": 12, "very_negative": 5 }
}
```

---

## Alertes (`/api/reviews/alerts`)

### GET `/api/reviews/alerts`
Liste la configuration des alertes.

**Réponse 200:**
```json
[
  {
    "id": "alert-uuid",
    "userId": "user-uuid",
    "alertType": "negative_review",
    "isEnabled": true,
    "emailNotification": true,
    "smsNotification": false,
    "pushNotification": true,
    "thresholdValue": null,
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
]
```

### PUT `/api/reviews/alerts`
Met à jour les alertes.

**Body:**
```json
{
  "alerts": [
    {
      "alertType": "negative_review",
      "isEnabled": true,
      "emailNotification": true,
      "pushNotification": true
    },
    {
      "alertType": "rating_drop",
      "isEnabled": true,
      "thresholdValue": 3
    }
  ]
}
```

**Réponse 200:** Array alertes mises à jour

---

## Routes Publiques (SANS authentification)

Ces routes sont utilisées par les clients finaux qui reçoivent le lien.

### GET `/api/reviews/public/track/:token`
Appelée quand le client clique sur le lien dans l'email/SMS.

**Params:**
- `:token` : Le tracking_token (ex: `rv_1733567890123_a7b2c9d4e`)

**Query params:**
- `platform` (optionnel) : Plateforme pré-sélectionnée

**Effets:**
1. Met à jour `linkClickedAt` et `status` → `'clicked'`
2. Enregistre `platformClicked` si fourni

**Réponse 200:**
```json
{
  "platforms": {
    "google": "https://g.page/r/xxx",
    "tripadvisor": "https://tripadvisor.com/xxx",
    "facebook": null,
    "yelp": null,
    "doctolib": null,
    "pagesJaunes": null
  },
  "priority": ["google", "tripadvisor"],
  "customerName": "Jean"
}
```

**Réponse 404:** `{ "message": "Lien invalide" }`

### POST `/api/reviews/public/confirm/:token`
Appelée quand le client confirme avoir laissé un avis.

**Body:**
```json
{
  "platform": "google"
}
```

**Effets:**
1. Met à jour `reviewConfirmedAt`, `reviewConfirmedPlatform`
2. Change `status` → `'confirmed'`
3. Génère un `promoCode` si `incentiveId` était associé

**Réponse 200:**
```json
{
  "success": true,
  "promoCode": "MERCI-A7B2C9",
  "alreadyConfirmed": false
}
```

**Format code promo:** `MERCI-{6_CHARS_RANDOM_UPPERCASE}`

---

## Routes OAuth (Stubs - Non implémentées)

### GET `/api/reviews/oauth/google/connect`
**Réponse 501:**
```json
{
  "message": "Connexion Google Business Profile disponible prochainement",
  "status": "not_implemented"
}
```

### GET `/api/reviews/oauth/facebook/connect`
**Réponse 501:**
```json
{
  "message": "Connexion Facebook Pages disponible prochainement",
  "status": "not_implemented"
}
```

---

# PARTIE 3 : INTÉGRATION N8N

## Authentification pour N8N

Pour intégrer avec N8N, vous avez deux options:

### Option A: Session Cookie (recommandé pour tests)
1. Authentifiez-vous via `/api/auth/login`
2. Utilisez le cookie `connect.sid` dans les requêtes suivantes

### Option B: API Key (pour production)
Le système SpeedAI dispose d'un système d'API key hashé (bcrypt) stocké dans `users.apiKeyHash`. 

**Headers requis:**
```
Authorization: Bearer <api_key>
```

**Note:** L'implémentation de la vérification API key pour les routes reviews n'est pas encore active. Utilisez l'authentification session pour l'instant.

---

## Workflow N8N 1: Demande d'avis après appel

### Trigger: Webhook réception fin d'appel
```json
{
  "event": "call.completed",
  "call_id": "call_abc123",
  "agent_id": "agent_74b0dd455566d4141adc040641",
  "caller_name": "Marie Martin",
  "caller_email": "marie.martin@email.com",
  "caller_phone": "+33687654321",
  "call_type": "reservation",
  "appointment_date": "2024-01-20T19:00:00Z",
  "appointment_confirmed": true
}
```

### Étapes N8N:

```
1. Webhook Trigger
   └── Réception données appel

2. IF Node
   └── Condition: {{ $json.appointment_confirmed }} == true

3. HTTP Request - Créer demande
   └── Method: POST
   └── URL: https://[domain]/api/reviews/requests
   └── Headers: Cookie: connect.sid=<session>
   └── Body JSON:
       {
         "customerName": "{{ $json.caller_name }}",
         "customerEmail": "{{ $json.caller_email }}",
         "customerPhone": "{{ $json.caller_phone }}",
         "sendMethod": "email"
       }
   └── Store response.id as {{ $node["HTTP Request"].json.id }}

4. Wait Node
   └── Delay: 2 hours after {{ $json.appointment_date }}

5. HTTP Request - Envoyer demande
   └── Method: POST
   └── URL: https://[domain]/api/reviews/requests/{{ $node["Create Request"].json.id }}/send
   └── Headers: Cookie: connect.sid=<session>

6. End
```

### Diagramme:
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
[POST requests] [End]
    │
    ▼
[WAIT 2h après RDV]
    │
    ▼
[POST requests/:id/send]
    │
    ▼
  [End]
```

---

## Workflow N8N 2: Demande avec incitation spécifique

```
1. Webhook Trigger (VIP customer detected)

2. HTTP Request - Get incentives
   └── Method: GET
   └── URL: https://[domain]/api/reviews/incentives
   └── Filtrer: type == "percentage" && percentageValue >= 15

3. HTTP Request - Create request with incentive
   └── Method: POST
   └── URL: https://[domain]/api/reviews/requests
   └── Body:
       {
         "customerName": "{{ $json.caller_name }}",
         "customerEmail": "{{ $json.caller_email }}",
         "sendMethod": "email",
         "incentiveId": "{{ $node["Get Incentives"].json[0].id }}"
       }

4. HTTP Request - Send immediately
   └── Method: POST
   └── URL: https://[domain]/api/reviews/requests/{{ $node["Create"].json.id }}/send

5. End
```

---

## Workflow N8N 3: Suivi des conversions

```
1. Schedule Trigger (toutes les heures)

2. HTTP Request - Get stats
   └── Method: GET
   └── URL: https://[domain]/api/reviews/requests/stats

3. IF Node
   └── Condition: {{ $json.conversionRate }} < 20

4. [Si taux bas] Slack/Email notification
   └── "Alerte: Taux de conversion avis bas ({{ $json.conversionRate }}%)"

5. End
```

---

## Workflow N8N 4: Import avis externes

Pour importer des avis récupérés ailleurs (scraping, API Google):

```
1. HTTP Request ou Code Node
   └── Récupérer avis depuis source externe

2. Loop Over Items

3. HTTP Request - Create review
   └── Method: POST
   └── URL: https://[domain]/api/reviews (endpoint à créer)
   └── Body:
       {
         "platform": "google",
         "platformReviewId": "{{ $json.review_id }}",
         "rating": {{ $json.rating }},
         "content": "{{ $json.text }}",
         "reviewerName": "{{ $json.author }}",
         "reviewDate": "{{ $json.date }}"
       }

4. End
```

---

## Mapping données appels → demandes avis

| Champ appel (N8N) | Champ demande (API) | Notes |
|-------------------|---------------------|-------|
| `caller_name` | `customerName` | Obligatoire |
| `caller_email` | `customerEmail` | Requis si sendMethod inclut email |
| `caller_phone` | `customerPhone` | Requis si sendMethod inclut sms |
| `call_id` | `reservationId` | Pour traçabilité |
| `appointment_date` | `reservationDate` | Pour timing intelligent |
| - | `incentiveId` | UUID de l'incitation à utiliser |
| - | `sendMethod` | `'email'` \| `'sms'` \| `'both'` |

---

## Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL | Oui |
| `SMTP_USER` | Email Gmail SMTP | Oui (pour emails) |
| `SMTP_PASSWORD` | Mot de passe app Gmail | Oui (pour emails) |
| `SESSION_SECRET` | Secret sessions Express | Oui |

---

## Flux complet du système

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUX DEMANDE D'AVIS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [N8N: Appel terminé]                                                       │
│         │                                                                   │
│         ▼                                                                   │
│  POST /api/reviews/requests                                                 │
│  { customerName, customerEmail, incentiveId }                               │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────┐                                                   │
│  │  review_requests     │  status: 'pending'                                │
│  │  tracking_token: rv_xxx                                                  │
│  └──────────────────────┘                                                   │
│         │                                                                   │
│         ▼                                                                   │
│  POST /api/reviews/requests/:id/send                                        │
│         │                                                                   │
│         ├─────────────────────────────────┐                                 │
│         ▼                                 ▼                                 │
│  [Email envoyé]                    [SMS envoyé]                             │
│  status: 'sent'                    (si configuré)                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    CLIENT REÇOIT MESSAGE                      │          │
│  │                                                               │          │
│  │  "Bonjour Jean, merci pour votre visite !                    │          │
│  │   🎁 -10% sur votre prochaine visite                         │          │
│  │   [Laisser mon avis]"                                        │          │
│  │                                                               │          │
│  │  Lien: https://domain/review/rv_xxx                          │          │
│  └──────────────────────────────────────────────────────────────┘          │
│         │                                                                   │
│         ▼                                                                   │
│  GET /api/reviews/public/track/rv_xxx                                       │
│  → Retourne URLs plateformes                                                │
│  → status: 'clicked'                                                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    PAGE PUBLIQUE                              │          │
│  │                                                               │          │
│  │  "Où souhaitez-vous laisser votre avis ?"                    │          │
│  │                                                               │          │
│  │  [Google] [TripAdvisor] [Facebook]                           │          │
│  │                                                               │          │
│  │  ─────────────────────────────────────                       │          │
│  │  [J'ai laissé mon avis !]                                    │          │
│  └──────────────────────────────────────────────────────────────┘          │
│         │                                                                   │
│         ▼                                                                   │
│  POST /api/reviews/public/confirm/rv_xxx                                    │
│  { platform: "google" }                                                     │
│  → Génère promoCode: "MERCI-A7B2C9"                                        │
│  → status: 'confirmed'                                                      │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    CONFIRMATION                               │          │
│  │                                                               │          │
│  │  "Merci ! Voici votre code promo:"                           │          │
│  │                                                               │          │
│  │  ╔════════════════════╗                                      │          │
│  │  ║   MERCI-A7B2C9     ║                                      │          │
│  │  ╚════════════════════╝                                      │          │
│  │                                                               │          │
│  │  Valable 30 jours - -10% sur votre prochaine visite          │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Codes d'erreur

| Code HTTP | Message | Cause |
|-----------|---------|-------|
| 400 | "Nom du client requis" | `customerName` manquant |
| 400 | "Email ou téléphone requis" | Ni email ni phone fourni |
| 400 | "Configuration des avis non trouvée" | Config non initialisée |
| 400 | "Format invalide" | Body mal formaté |
| 400 | "Texte de réponse requis" | `responseText` manquant |
| 404 | "Demande non trouvée" | ID request invalide |
| 404 | "Avis non trouvé" | ID review invalide |
| 404 | "Incitation non trouvée" | ID incentive invalide |
| 404 | "Lien invalide" | Token tracking invalide |
| 500 | "Erreur serveur" | Erreur interne |
| 501 | "Connexion ... disponible prochainement" | OAuth non implémenté |

---

## Points d'attention pour N8N

1. **Authentification:** Les routes protégées nécessitent une session. Stockez le cookie `connect.sid` après login.

2. **Timing:** Le mode `smart` n'est pas encore implémenté. Utilisez `fixed_delay` avec un Wait node N8N.

3. **SMS:** Non implémenté côté serveur. Vous pouvez implémenter l'envoi SMS directement dans N8N (Twilio).

4. **Incitations par défaut:** Si vous ne spécifiez pas `incentiveId`, le système utilise l'incitation marquée `isDefault: true`.

5. **Tracking token:** Conservez le `trackingToken` retourné lors de la création pour pouvoir suivre le parcours.

6. **Idempotence:** La confirmation (`/public/confirm/:token`) est idempotente - un second appel retourne `alreadyConfirmed: true`.

---

## Exemple payload complet

### Création demande avec tous les champs
```json
POST /api/reviews/requests
{
  "customerName": "Jean Dupont",
  "customerEmail": "jean.dupont@email.com",
  "customerPhone": "+33612345678",
  "sendMethod": "both",
  "incentiveId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Réponse
```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "userId": "c97480ed-fa92-4218-baed-971b6dd1a607",
  "customerName": "Jean Dupont",
  "customerEmail": "jean.dupont@email.com",
  "customerPhone": "+33612345678",
  "reservationId": null,
  "reservationDate": null,
  "reservationTime": null,
  "scheduledAt": null,
  "sentAt": null,
  "sendMethod": "both",
  "trackingToken": "rv_1733580000000_x8k2m5p7q",
  "linkClickedAt": null,
  "platformClicked": null,
  "reviewConfirmedAt": null,
  "reviewConfirmedPlatform": null,
  "incentiveId": "550e8400-e29b-41d4-a716-446655440000",
  "promoCode": null,
  "promoCodeUsedAt": null,
  "status": "pending",
  "createdAt": "2024-12-07T15:00:00.000Z"
}
```
