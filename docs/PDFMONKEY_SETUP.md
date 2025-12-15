# Guide de Configuration PDF Monkey

## 1. Compte PDF Monkey

1. Créez un compte sur [pdfmonkey.io](https://www.pdfmonkey.io/)
2. Récupérez votre clé API : Dashboard → Settings → API Keys
3. Ajoutez la clé dans Replit Secrets : `PDFMONKEY_API_KEY`

## 2. Créer le Template

### Étape 1 : Obtenir la structure de données

Appelez l'endpoint suivant pour obtenir le JSON de sample :

```
GET /api/admin/pdfmonkey/payload-sample
```

Ou via curl :
```bash
curl -X GET https://VOTRE_DOMAINE/api/admin/pdfmonkey/payload-sample \
  -H "Cookie: auth_token=VOTRE_TOKEN"
```

### Étape 2 : Créer le template dans PDF Monkey

1. Allez dans PDF Monkey → Templates → New Template
2. Choisissez "Blank" ou un template de base
3. Dans "Sample Data", collez le JSON obtenu à l'étape 1 (le champ `payload`)
4. Designez votre rapport avec les variables disponibles

### Étape 3 : Variables disponibles

#### Header
- `{{companyName}}` - "SpeedAI"
- `{{reportMonth}}` - "Novembre 2024"
- `{{generatedDate}}` - "15 décembre 2024"
- `{{userEmail}}` - Email du client

#### Executive Summary
- `{{executiveSummary.totalCalls}}` - Total appels
- `{{executiveSummary.totalCallsChange}}` - "↑ 15%"
- `{{executiveSummary.conversionRate}}` - 68
- `{{executiveSummary.conversionRateChange}}` - "↑ 10%"
- `{{executiveSummary.appointmentsTaken}}` - 156
- `{{executiveSummary.performanceScore}}` - 82
- `{{executiveSummary.performanceLabel}}` - "Bon"
- `{{executiveSummary.performanceColor}}` - "#22c55e"

#### KPIs Principaux
- `{{kpis.totalCalls}}` - 247
- `{{kpis.totalCallsChange}}` - "↑ 15%"
- `{{kpis.activeCalls}}` - 198
- `{{kpis.conversionRate}}` - "69%"
- `{{kpis.averageDuration}}` - "3m 5s"

#### Métriques Business
- `{{business.appointmentsTaken}}` - 156
- `{{business.appointmentsChange}}` - "↑ 16%"
- `{{business.appointmentConversionRate}}` - "63%"
- `{{business.afterHoursCalls}}` - 42
- `{{business.timeSavedHours}}` - "12.7h"
- `{{business.estimatedRevenue}}` - "15 600€"
- `{{business.roi}}` - "780%"

#### Score de Performance
- `{{performanceScore.score}}` - 82
- `{{performanceScore.label}}` - "Bon"
- `{{performanceScore.color}}` - "#22c55e"
- `{{performanceScore.previousScoreChange}}` - "↑ 9%"

#### Recommandations IA (boucle)
```html
{{#each recommendations}}
  <div class="recommendation {{type}}">
    <h4>{{title}}</h4>
    <p>{{message}}</p>
  </div>
{{/each}}
```
- `type` : "success", "alert", "info"

#### Heures de Pic (boucle)
```html
{{#each peakHours}}
  <div>{{hour}}: {{callCount}} appels</div>
{{/each}}
```

#### Statuts des Appels (boucle)
```html
{{#each callsByStatus}}
  <div style="color: {{color}}">
    {{statusLabel}}: {{count}} ({{percentage}})
  </div>
{{/each}}
```

#### Résultats de Conversion (boucle)
```html
{{#each conversionResults}}
  <div>{{result}}: {{count}} ({{percentage}})</div>
{{/each}}
```

#### Humeur Clients (boucle)
```html
{{#each clientMoods}}
  <div>{{emoji}} {{moodLabel}}: {{count}} ({{percentage}})</div>
{{/each}}
```

#### Types de Services (boucle)
```html
{{#each serviceTypes}}
  <div>{{typeLabel}}: {{count}} ({{percentage}})</div>
{{/each}}
```

#### RDV par Jour (boucle)
```html
{{#each appointmentsByDay}}
  <div>{{dayLabel}}: {{count}}</div>
{{/each}}
```

#### Mots-clés (boucle)
```html
{{#each topKeywords}}
  <div>{{keyword}}: {{count}}</div>
{{/each}}
```

#### Métriques Additionnelles
- `{{additionalMetrics.returningClients}}` - 67
- `{{additionalMetrics.returningClientsPercent}}` - "27.1%"
- `{{additionalMetrics.upsellAccepted}}` - 18
- `{{additionalMetrics.upsellPercent}}` - "11.5%"
- `{{additionalMetrics.lastMinuteBookings}}` - 23
- `{{additionalMetrics.averageBookingConfidence}}` - "87%"
- `{{additionalMetrics.averageBookingDelayDays}}` - "4.2 jours"

#### Insights Automatiques
- `{{insights.peakActivity}}` - Texte analyse pic d'activité
- `{{insights.statusDistribution}}` - Texte analyse statuts
- `{{insights.monthComparison}}` - Texte comparaison mois

#### CB Guarantee (optionnel)
```html
{{#if cbGuarantee}}
  <div>No-show: {{cbGuarantee.noShowRate}}</div>
  <div>Récupéré: {{cbGuarantee.revenueRecovered}}</div>
{{/if}}
```

## 3. Configurer le Template ID

1. Une fois le template créé, copiez son ID (visible dans l'URL ou les paramètres)
2. Ajoutez-le dans Replit Secrets : `PDFMONKEY_TEMPLATE_ID`

## 4. Tester

1. Redémarrez l'application
2. Allez dans Admin → cliquez sur "Test PDF Monkey"
3. Ou appelez : `POST /api/admin/pdfmonkey/test`

## 5. Endpoints Disponibles

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/admin/pdfmonkey/status` | GET | Vérifie la configuration |
| `/api/admin/pdfmonkey/payload-sample` | GET | Obtient le JSON de sample |
| `/api/admin/pdfmonkey/set-template` | POST | Valide un template ID |
| `/api/admin/pdfmonkey/test` | POST | Génère un PDF de test |

## Design Recommandé

### Structure de Page
1. **Page 1** : Header + Executive Summary + Score
2. **Page 2** : KPIs + Business Metrics
3. **Page 3** : Graphiques (heures de pic, statuts)
4. **Page 4** : Données enrichies (humeur, services, jours)
5. **Page 5** : Recommandations IA + Insights

### Couleurs SpeedAI
- Primary : `#3b82f6` (Bleu)
- Success : `#10b981` (Vert)
- Warning : `#f59e0b` (Orange)
- Error : `#ef4444` (Rouge)
- Text : `#1f2937` (Gris foncé)
- Background : `#f9fafb` (Gris clair)

### Police
- Inter ou SF Pro pour un look moderne
