# 🚀 GUIDE : Visualisation en Live du Projet (Comme sur Replit)

Ce guide vous explique comment lancer votre projet en local avec **rechargement automatique** (hot-reload) comme sur Replit.

---

## ✅ PRÉREQUIS

Avant de commencer, assurez-vous d'avoir :

1. **Node.js** installé (version 20 ou supérieure)
   ```bash
   node --version
   # Doit afficher v20.x.x ou supérieur
   ```

2. **npm** installé
   ```bash
   npm --version
   ```

3. **Fichier `.env`** configuré avec toutes les variables d'environnement
   (Voir `GUIDE_RECUPERATION_REPLIT.md`)

4. **Base de données PostgreSQL** accessible
   (Soit la même que Replit, soit une nouvelle base)

---

## 🎯 ÉTAPE 1 : Installer les dépendances

Ouvrez un terminal à la racine du projet et exécutez :

```bash
npm install
```

Cette commande va installer toutes les dépendances nécessaires (React, Express, Vite, etc.).

**⏱️ Temps estimé** : 2-5 minutes selon votre connexion

---

## 🎯 ÉTAPE 2 : Configurer la base de données

Si vous utilisez une nouvelle base de données, synchronisez le schéma :

```bash
npm run db:push
```

Cette commande va créer toutes les tables nécessaires dans votre base PostgreSQL.

**⚠️ Important** : Assurez-vous que `DATABASE_URL` est bien configuré dans votre `.env`

---

## 🎯 ÉTAPE 3 : Lancer le serveur de développement

C'est ici que la magie opère ! 🎉

```bash
npm run dev
```

Cette commande va :
- ✅ Lancer le serveur Express (backend)
- ✅ Lancer Vite en mode développement (frontend)
- ✅ Activer le **Hot Module Replacement (HMR)** - rechargement automatique
- ✅ Servir l'application sur `http://localhost:5000`

### 📺 Ce que vous verrez dans le terminal :

```
[Server] Monthly report cron job initialized
[Server] Trial expiration cron job initialized
[Server] Push notification cron jobs initialized
[Server] Review sync cron job initialized
[Server] Integration sync cron job initialized
[Server] Appointment reminder cron job initialized
serving on port 5000
```

---

## 🌐 ÉTAPE 4 : Ouvrir l'application dans le navigateur

Une fois le serveur lancé, ouvrez votre navigateur et allez sur :

```
http://localhost:5000
```

Vous devriez voir votre application SpeedAI s'afficher ! 🎊

---

## 🔥 FONCTIONNALITÉS LIVE (Comme sur Replit)

### ✅ Hot Module Replacement (HMR)

**Qu'est-ce que c'est ?**

Le HMR permet de voir vos modifications **instantanément** dans le navigateur **sans recharger la page** !

**Comment ça marche ?**

1. **Modifiez un fichier** (par exemple `client/src/pages/dashboard.tsx`)
2. **Sauvegardez** (Cmd+S / Ctrl+S)
3. **Le navigateur se met à jour automatiquement** en quelques millisecondes ! ⚡

**Exemple :**

```tsx
// client/src/pages/dashboard.tsx
export default function Dashboard() {
  return (
    <div>
      <h1>Mon Dashboard</h1>
      {/* Changez ce texte */}
      <p>Nouveau texte ici</p>
    </div>
  );
}
```

Après avoir sauvegardé, vous verrez le changement **immédiatement** dans le navigateur !

### ✅ Rechargement automatique du serveur

Si vous modifiez un fichier **backend** (`server/`), le serveur se redémarre automatiquement grâce à `tsx`.

**Exemple :**

```typescript
// server/routes.ts
app.get('/api/test', (req, res) => {
  res.json({ message: 'Nouveau message' }); // Changez ce message
});
```

Après sauvegarde, le serveur redémarre et vos changements sont actifs !

### ✅ Erreurs affichées en temps réel

Si vous faites une erreur de syntaxe :

1. **L'erreur s'affiche dans le terminal** avec le fichier et la ligne
2. **L'erreur s'affiche dans le navigateur** avec un overlay (si frontend)
3. **Corrigez l'erreur** et sauvegardez
4. **L'application se recharge automatiquement** une fois corrigée

---

## 🛠️ COMMANDES UTILES

### Démarrer le serveur de développement

```bash
npm run dev
```

### Arrêter le serveur

Dans le terminal où le serveur tourne, appuyez sur :
- **Ctrl + C** (Windows/Linux)
- **Cmd + C** (Mac)

### Vérifier la syntaxe TypeScript

```bash
npm run check
```

### Build de production

```bash
npm run build
```

### Lancer en production (après build)

```bash
npm start
```

---

## 🐛 DÉPANNAGE

### ❌ Le serveur ne démarre pas

**Erreur** : `Cannot find module` ou `Error: Cannot find package`

**Solution** :
```bash
# Supprimez node_modules et réinstallez
rm -rf node_modules package-lock.json
npm install
```

---

### ❌ Erreur de connexion à la base de données

**Erreur** : `Error: connect ECONNREFUSED` ou `password authentication failed`

**Solution** :
1. Vérifiez que `DATABASE_URL` est correct dans `.env`
2. Vérifiez que PostgreSQL est accessible
3. Testez la connexion :
   ```bash
   # Si vous avez psql installé
   psql $DATABASE_URL
   ```

---

### ❌ Le port 5000 est déjà utilisé

**Erreur** : `Error: listen EADDRINUSE: address already in use :::5000`

**Solution 1** : Arrêter le processus qui utilise le port
```bash
# Sur Mac/Linux
lsof -ti:5000 | xargs kill -9

# Sur Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**Solution 2** : Utiliser un autre port
```bash
# Dans votre .env
PORT=5001

# Puis relancez
npm run dev
```

L'application sera accessible sur `http://localhost:5001`

---

### ❌ Les modifications ne se rechargent pas

**Problème** : Vous modifiez un fichier mais rien ne se passe

**Solutions** :
1. Vérifiez que le serveur tourne (`npm run dev`)
2. Vérifiez que vous sauvegardez bien le fichier (Cmd+S / Ctrl+S)
3. Videz le cache du navigateur (Cmd+Shift+R / Ctrl+Shift+R)
4. Vérifiez la console du navigateur (F12) pour voir les erreurs

---

### ❌ Erreurs TypeScript dans le terminal

**Erreur** : Beaucoup d'erreurs TypeScript affichées

**Note** : Les erreurs TypeScript n'empêchent pas l'application de fonctionner en développement. Elles sont juste des avertissements.

Pour vérifier les erreurs :
```bash
npm run check
```

---

## 🎨 DIFFÉRENCES AVEC REPLIT

### ✅ Avantages du développement local

- **Plus rapide** : Pas de latence réseau
- **Plus de contrôle** : Accès complet au système
- **Meilleur debugging** : Outils de développement plus puissants
- **Pas de limites** : Pas de restrictions de ressources

### ⚠️ Différences à noter

1. **URL** : `http://localhost:5000` au lieu de `https://vocal-dash-leosedilleau41.replit.app`
2. **HTTPS** : Pas de HTTPS en local (normal pour le développement)
3. **Webhooks Stripe** : Nécessitent un tunnel (ngrok) pour fonctionner en local
4. **Domaines** : Les variables `REPLIT_DEV_DOMAIN` ne fonctionnent pas en local

---

## 🔗 CONFIGURER LES WEBHOOKS STRIPE EN LOCAL

Si vous voulez tester les webhooks Stripe en local, vous devez utiliser un tunnel :

### Option 1 : ngrok (recommandé)

1. **Installer ngrok** : https://ngrok.com/download
2. **Lancer votre serveur** : `npm run dev`
3. **Dans un autre terminal, lancer ngrok** :
   ```bash
   ngrok http 5000
   ```
4. **Copier l'URL HTTPS** (ex: `https://abc123.ngrok.io`)
5. **Configurer dans Stripe Dashboard** :
   - Webhook URL : `https://abc123.ngrok.io/api/webhooks/stripe`
   - Copier le nouveau `STRIPE_WEBHOOK_SECRET` dans votre `.env`

### Option 2 : Stripe CLI

```bash
# Installer Stripe CLI
# https://stripe.com/docs/stripe-cli

# Lancer le forward
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

---

## 📱 ACCÈDER DEPUIS VOTRE TÉLÉPHONE/TABLETTE

Pour tester sur mobile en local :

1. **Trouvez votre adresse IP locale** :
   ```bash
   # Sur Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Sur Windows
   ipconfig
   ```

2. **Accédez depuis votre mobile** (même réseau WiFi) :
   ```
   http://VOTRE_IP:5000
   # Exemple : http://192.168.1.100:5000
   ```

---

## 🎯 WORKFLOW DE DÉVELOPPEMENT RECOMMANDÉ

1. **Ouvrir le projet** dans votre éditeur (Cursor, VS Code, etc.)
2. **Lancer le serveur** : `npm run dev`
3. **Ouvrir le navigateur** : `http://localhost:5000`
4. **Modifier le code** dans votre éditeur
5. **Voir les changements** automatiquement dans le navigateur
6. **Vérifier les logs** dans le terminal
7. **Tester les fonctionnalités** dans le navigateur

---

## ✅ CHECKLIST DE DÉMARRAGE

Avant de commencer à développer, vérifiez :

- [ ] Node.js installé (v20+)
- [ ] `npm install` exécuté avec succès
- [ ] Fichier `.env` créé et configuré
- [ ] Base de données accessible et schéma synchronisé (`npm run db:push`)
- [ ] Serveur démarre sans erreur (`npm run dev`)
- [ ] Application accessible sur `http://localhost:5000`
- [ ] Hot-reload fonctionne (modifier un fichier et voir le changement)

---

## 🎉 C'EST PARTI !

Vous êtes maintenant prêt à développer en local avec le même confort qu sur Replit !

**Astuce** : Gardez le terminal ouvert pour voir les logs en temps réel. C'est très utile pour déboguer ! 🐛

---

**Date de création** : 2025-01-14
