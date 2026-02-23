// Plot Twisted - Service Worker
// Cache-first strategy with background updates

const CACHE_NAME = 'plot-twisted-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './clues.json',
    './icons/icon-32.png',
    './icons/icon-64.png',
    './icons/icon-128.png',
    './icons/icon-192.png',
    './icons/icon-256.png',
    './icons/icon-512.png',
    './icons/icon-512-maskable.png',
    './favicon-32.png',
];

// External resources to cache (fonts, confetti)
const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,500&family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Special+Elite&display=swap',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
];

// ── Install: pre-cache all static assets ──────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Cache static assets (must succeed)
            const staticPromise = cache.addAll(STATIC_ASSETS);
            // Cache external assets (best effort - don't fail install)
            const externalPromise = Promise.allSettled(
                EXTERNAL_ASSETS.map(url => 
                    fetch(url, { mode: 'cors' })
                        .then(res => res.ok ? cache.put(url, res) : null)
                        .catch(() => null)
                )
            );
            return Promise.all([staticPromise, externalPromise]);
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: cache-first with network fallback ───────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    
    // Skip non-GET and browser-extension requests
    if (request.method !== 'GET') return;
    if (!request.url.startsWith('http')) return;
    
    // For Google Analytics - always network, never cache
    if (request.url.includes('googletagmanager') || request.url.includes('google-analytics')) {
        return;
    }
    
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) {
                // Serve from cache, update in background (stale-while-revalidate)
                const fetchPromise = fetch(request)
                    .then(networkRes => {
                        if (networkRes && networkRes.ok) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, networkRes.clone());
                            });
                        }
                        return networkRes;
                    })
                    .catch(() => cached);
                
                return cached;
            }
            
            // Not in cache — fetch from network and cache it
            return fetch(request)
                .then(networkRes => {
                    if (!networkRes || !networkRes.ok || networkRes.type === 'opaque') {
                        return networkRes;
                    }
                    const responseClone = networkRes.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                    return networkRes;
                })
                .catch(() => {
                    // Offline fallback for navigation requests
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
        })
    );
});

// ── Message: handle skip waiting from client ───────────────────
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
