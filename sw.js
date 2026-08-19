const CACHE_NAME = 'aisle-tracker-v1';

// The core assets and CDNs needed for the app to render offline
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0'
];

/* --- 1. Install Event --- */
// Fires when the service worker is first installed. We use it to pre-cache our core assets.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache, adding core assets');
                return cache.addAll(urlsToCache);
            })
    );
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

/* --- 2. Activate Event --- */
// Fires when the service worker starts up. We use it to clean up old, outdated caches.
self.addEventListener('activate', (event) => {
    const cacheAllowlist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheAllowlist.includes(cacheName)) {
                        console.log(`Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Ensure the service worker takes control of all clients immediately
    self.clients.claim();
});

/* --- 3. Fetch Event --- */
// Intercepts all network requests. 
// Strategy: Cache First, falling back to Network.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return the response directly from the cache
                if (response) {
                    return response;
                }

                // Not in cache - fetch from the network
                // We clone the request because it's a stream and can only be consumed once
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then((networkResponse) => {
                    // Check if we received a valid response
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        // If it's from a CDN (like our Google Fonts), the type might be 'cors'.
                        // We still want to return it, we just can't cache opaque responses easily 
                        // without specialized caching strategies, so we just return the network response.
                        return networkResponse;
                    }

                    // Clone the response because we want to cache it AND return it to the browser
                    const responseToCache = networkResponse.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            // Dynamically cache new requests (like specific font .woff2 files loaded by the CSS)
                            cache.put(event.request, responseToCache);
                        });

                    return networkResponse;
                }).catch(() => {
                    // If both cache and network fail, this is where you'd return an offline fallback page.
                    // For our single-page app, the core HTML is already cached, so this mainly catches
                    // failed dynamic requests when completely offline.
                    console.log('Fetch failed; returning offline fallback if applicable.');
                });
            })
    );
});
