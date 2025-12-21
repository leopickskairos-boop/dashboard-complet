/**
 * Mode Démonstration - Bascule les endpoints vers les données fictives
 * 
 * Pour activer le mode démo, mettre DEMO_MODE = true
 * Les requêtes API seront automatiquement redirigées vers /api/demo/*
 */

export const DEMO_MODE = true;

/**
 * Transforme une URL d'API pour utiliser les données de démo
 * @param url L'URL originale (ex: /api/calls/stats)
 * @returns L'URL de démo (ex: /api/demo/calls/stats) si le mode démo est activé
 */
export function getDemoUrl(url: string): string {
  if (!DEMO_MODE) return url;
  
  // Liste des endpoints à rediriger vers le mode démo
  const demoEndpoints = [
    '/api/calls',
    '/api/reviews',
    '/api/marketing',
    '/api/guarantee',
    '/api/integrations',
    '/api/reports',
    '/api/waitlist',
    '/api/recommendations',
    '/api/notifications',
    '/api/auth',
    '/api/user',
    '/api/settings',
  ];
  
  // Vérifier si l'URL correspond à un endpoint de démo
  for (const endpoint of demoEndpoints) {
    if (url.startsWith(endpoint)) {
      return url.replace('/api/', '/api/demo/');
    }
  }
  
  return url;
}

/**
 * Hook pour utiliser les données de démo dans les queries
 */
export function useDemoQueryKey(key: string | string[]): string | string[] {
  if (!DEMO_MODE) return key;
  
  if (typeof key === 'string') {
    return getDemoUrl(key);
  }
  
  return key.map((k, i) => i === 0 ? getDemoUrl(k) : k);
}
