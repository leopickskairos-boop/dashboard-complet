# SpeedAI - Optimisation Autoscale Replit

## Objectif

Réduire les coûts d'hébergement en permettant à l'application de s'endormir quand il n'y a pas de trafic.

## Problème identifié

L'application utilisait **6 cron jobs internes** (via `node-cron`) qui maintenaient le processus actif 24/7, empêchant le mode sleep d'Autoscale.

## Solution implémentée

### 1. Endpoints API pour cron externe

Tous les cron jobs peuvent maintenant être déclenchés via des appels API externes :

| Endpoint | Méthode | Fréquence recommandée |
|----------|---------|----------------------|
| `/api/cron/monthly-reports` | POST | Quotidien à 2h |
| `/api/cron/trial-expirations` | POST | Quotidien à 3h |
| `/api/cron/daily-summary` | POST | Quotidien à 9h |
| `/api/cron/trial-expiring-notifications` | POST | Quotidien à 10h |
| `/api/cron/review-sync` | POST | Quotidien à 4h |
| `/api/cron/integration-sync` | POST | Toutes les heures |

### 2. Authentification

Tous les endpoints cron nécessitent une clé API dans le header :

```
Authorization: Bearer {N8N_MASTER_API_KEY}
```

### 3. Variable d'environnement

Pour activer le mode optimisé en production :

```bash
DISABLE_INTERNAL_CRONS=true
```

Cela désactive tous les cron jobs internes et force l'utilisation des triggers externes.

## Configuration N8N

### Workflow type pour un cron

```json
{
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hour": 2
            }
          ]
        }
      }
    },
    {
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://votre-app.replit.app/api/cron/monthly-reports",
        "method": "POST",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "credentials": {
        "httpHeaderAuth": {
          "name": "SpeedAI API Key",
          "headerName": "Authorization",
          "headerValue": "Bearer {N8N_MASTER_API_KEY}"
        }
      }
    }
  ]
}
```

## Alternative : cron-job.org

Si vous n'utilisez pas N8N, vous pouvez utiliser [cron-job.org](https://cron-job.org) (gratuit) :

1. Créer un compte gratuit
2. Ajouter un job pour chaque endpoint
3. Configurer le header `Authorization: Bearer {votre_clé_api}`
4. Définir la fréquence (ex: `0 2 * * *` pour 2h du matin)

## Configuration Autoscale recommandée

```
minInstances: 0
maxInstances: 1
idleTimeout: 300 (5 minutes)
```

Avec ces paramètres :
- L'app s'endort après 5 minutes d'inactivité
- Elle se réveille automatiquement à la première requête
- Les cron externes réveillent l'app uniquement quand nécessaire

## Estimation des économies

| Scénario | Coût estimé/mois |
|----------|------------------|
| Sans optimisation (24/7) | ~$15-25 |
| Avec optimisation (8h actif/jour) | ~$5-10 |
| Trafic faible (2h actif/jour) | ~$2-5 |

## Vérification

Pour tester que les endpoints fonctionnent :

```bash
curl -X GET https://votre-app.replit.app/api/cron/health \
  -H "Authorization: Bearer {N8N_MASTER_API_KEY}"
```

Réponse attendue :
```json
{
  "status": "ok",
  "timestamp": "2024-12-11T08:00:00.000Z",
  "endpoints": [...]
}
```
