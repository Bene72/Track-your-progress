// Service worker minimal, volontairement sans stratégie de cache.
// Objectif unique : satisfaire le critère d'installabilité PWA de Chrome
// (qui exige un SW avec un handler fetch). On ne met PAS en cache les
// assets ici — une vraie stratégie offline (cache-first sur les assets
// statiques, network-first sur les données) est un chantier séparé,
// à faire une fois qu'on est sûr de ne pas servir du JS périmé après
// chaque déploiement Vercel.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
