// Plot Twisted — Service Worker v4
// Cinema noir redesign — bumped to bust old caches

const CACHE_NAME = 'plot-twisted-v4';
const STATIC_ASSETS = [
    './',
    './index.html',
    './game.html',
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

const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,500&family=Bebas+Neue&family=Special+Elite&family=DM+Mono:ital,wght@0,400;0,500;1,400&display=swap',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            const staticPromise = cache.addAll(STATIC_ASSETS);
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
    self.skipWaiting();
});

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

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    if (!request.url.startsWith('http')) return;
    if (request.url.includes('googletagmanager') || request.url.includes('google-analytics')) return;

    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) {
                // Stale-while-revalidate
                fetch(request)
                    .then(networkRes => {
                        if (networkRes && networkRes.ok) {
                            caches.open(CACHE_NAME).then(cache => cache.put(request, networkRes.clone()));
                        }
                    })
                    .catch(() => {});
                return cached;
            }
            return fetch(request)
                .then(networkRes => {
                    if (!networkRes || !networkRes.ok || networkRes.type === 'opaque') return networkRes;
                    caches.open(CACHE_NAME).then(cache => cache.put(request, networkRes.clone()));
                    return networkRes;
                })
                .catch(() => {
                    if (request.mode === 'navigate') return caches.match('./game.html');
                    return new Response('Offline', { status: 503 });
                });
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
