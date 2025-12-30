# Demo Mode Reference

## Overview
Le mode demo permet d'afficher des données fictives réalistes pour "Le Petit Bistrot" sans accès à la base de données.

## Configuration
- `DEMO_MODE = true` dans `server/demo-data.ts`
- `getDemoUrl(url)` dans `client/src/lib/demo-mode.ts` transforme `/api/*` en `/api/demo/*`

## Règles Obligatoires pour les Pages Frontend

### 1. Import getDemoUrl
```typescript
import { getDemoUrl } from "@/lib/demo-mode";
```

### 2. Utiliser getDemoUrl dans TOUS les queryKey
```typescript
// CORRECT
useQuery({
  queryKey: [getDemoUrl('/api/reviews/stats')],
});

// INCORRECT - ne fonctionnera pas en mode demo
useQuery({
  queryKey: ['/api/reviews/stats'],
});
```

### 3. Extraire les données des enveloppes
Les routes demo retournent souvent des objets avec clés. Toujours vérifier le format:
```typescript
// Si l'API retourne { reports: [...] }
const reports = data?.reports || [];

// Si l'API retourne { datasets: [...] }
const chartData = data?.datasets || [];

// Si l'API retourne directement [...]
const items = data || [];
```

## Format des Réponses API Demo

| Endpoint | Format Retour | Clé à extraire |
|----------|--------------|----------------|
| `/api/demo/reports` | `{ reports: [...] }` | `data.reports` |
| `/api/demo/calls` | `{ calls: [...] }` | `data.calls` |
| `/api/demo/reviews` | `[...]` | `data` directement |
| `/api/demo/reviews/requests` | `{ requests: [...] }` | `data.requests` |
| `/api/demo/marketing/campaigns` | `{ campaigns: [...] }` | `data.campaigns` |
| `/api/demo/marketing/contacts` | `{ contacts: [...] }` | `data.contacts` |
| `/api/demo/marketing/analytics/performance` | `{ datasets: [...] }` | `data.datasets` |
| `/api/demo/marketing/analytics/overview` | `{ stats object }` | `data` directement |
| `/api/demo/guarantee/reservations` | `{ pending: [...], validated: [...] }` | `data.pending`, etc. |

## Checklist pour Nouvelle Page

- [ ] Import `getDemoUrl` from "@/lib/demo-mode"
- [ ] Tous les `queryKey` utilisent `getDemoUrl(url)`
- [ ] Vérifier le format de réponse dans `demo-routes.ts`
- [ ] Extraire correctement les données (array vs object)
- [ ] Gérer les cas où data est undefined (`data?.field || []`)

## Pages Auditées et Corrigées

- [x] Dashboard.tsx
- [x] ReviewsStats.tsx
- [x] ReviewsList.tsx
- [x] ReviewsCampaigns.tsx
- [x] MarketingAnalytics.tsx
- [x] MarketingOverview.tsx
- [x] Reports.tsx
- [x] Guarantee pages
- [x] Waitlist pages

## Debugging

Si une page casse en mode demo:
1. Ouvrir la console navigateur
2. Chercher l'erreur (ex: "X.map is not a function")
3. Vérifier que getDemoUrl est utilisé
4. Vérifier le format de réponse dans demo-routes.ts
5. Adapter l'extraction des données
