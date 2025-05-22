const CACHE_NAME = 'castSender-webxr-v1.2.0';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache ouvert');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Fichiers mis en cache');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Erreur lors de la mise en cache', error);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Suppression ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Contrôle des clients');
      return self.clients.claim();
    })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-HTTP et WebSocket
  if (!event.request.url.startsWith('http') || 
      event.request.url.includes('ws://') || 
      event.request.url.includes('wss://') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Retourner la ressource depuis le cache si elle existe
        if (cachedResponse) {
          console.log('Service Worker: Ressource servie depuis le cache', event.request.url);
          return cachedResponse;
        }

        // Sinon, faire la requête réseau
        return fetch(event.request)
          .then((response) => {
            // Vérifier si la réponse est valide
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Cloner la réponse car elle ne peut être consommée qu'une fois
            const responseToCache = response.clone();

            // Ajouter au cache pour les futures requêtes
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Erreur réseau', error);
            
            // En cas d'erreur réseau, retourner une page d'erreur personnalisée
            if (event.request.destination === 'document') {
              return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>CastSender - Hors ligne</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      text-align: center;
                      padding: 50px 20px;
                      margin: 0;
                    }
                    .offline-container {
                      max-width: 500px;
                      margin: 0 auto;
                    }
                    .offline-icon {
                      font-size: 64px;
                      margin-bottom: 20px;
                    }
                    .retry-button {
                      background: #FF6B6B;
                      color: white;
                      border: none;
                      padding: 12px 24px;
                      border-radius: 8px;
                      font-size: 16px;
                      cursor: pointer;
                      margin-top: 20px;
                    }
                  </style>
                </head>
                <body>
                  <div class="offline-container">
                    <div class="offline-icon">📡</div>
                    <h1>Application hors ligne</h1>
                    <p>Impossible de se connecter au réseau. Vérifiez votre connexion internet.</p>
                    <button class="retry-button" onclick="window.location.reload()">
                      🔄 Réessayer
                    </button>
                  </div>
                </body>
                </html>
              `, {
                headers: {
                  'Content-Type': 'text/html'
                }
              });
            }
            
            throw error;
          });
      })
  );
});

// Gestion des messages depuis l'application principale
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message reçu', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Gestion des notifications push (pour futures fonctionnalités)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push reçu', event);
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Nouveau message',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Ouvrir',
          icon: '/icon-72.png'
        },
        {
          action: 'close',
          title: 'Fermer'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'CastSender', options)
    );
  }
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Clic notification', event);
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Synchronisation en arrière-plan (pour futures fonctionnalités)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Effectuer des tâches de synchronisation
      doBackgroundSync()
    );
  }
});

async function doBackgroundSync() {
  try {
    // Logique de synchronisation
    console.log('Service Worker: Synchronisation en arrière-plan');
    return Promise.resolve();
  } catch (error) {
    console.error('Service Worker: Erreur sync', error);
    throw error;
  }
}