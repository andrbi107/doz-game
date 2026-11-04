/* ============================================
   SW.JS - Service Worker for Doz (offline PWA)
   Cache-first for app shell, network-first for nothing (no API)
   ============================================ */

const CACHE_NAME = 'doz-v3.0.0';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/themes.css',
    './css/style.css',
    './css/animations.css',
    './css/responsive.css',
    './js/storage.js',
    './js/audio.js',
    './js/game.js',
    './js/ai.js',
    './js/ui.js',
    './js/app.js',
    './js/achievements.js',
    './assets/icon.svg',
    // External fonts (cached for offline use)
    'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Cache app shell, ignore individual failures (e.g., offline fonts)
                return Promise.allSettled(
                    APP_SHELL.map(url => cache.add(url).catch(err => {
                        console.warn('SW: failed to cache', url, err.message);
                    }))
                );
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    // Only handle GET
    if (req.method !== 'GET') return;

    // Skip cross-origin requests except fonts.googleapis.com / fonts.gstatic.com
    const url = new URL(req.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (!isSameOrigin && !isFont) return;

    // Cache-first for app shell & fonts
    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) {
                // Refresh in background
                fetch(req).then(resp => {
                    if (resp && resp.status === 200) {
                        caches.open(CACHE_NAME).then(cache => cache.put(req, resp));
                    }
                }).catch(() => {});
                return cached;
            }
            // Not cached, fetch from network
            return fetch(req).then(resp => {
                if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
                const respClone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
                return resp;
            }).catch(() => {
                // Offline fallback
                if (req.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('', { status: 504, statusText: 'Offline' });
            });
        })
    );
});

// Allow page to trigger skipWaiting
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
