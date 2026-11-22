// Neo4BG Nova — service worker : coquille hors ligne et clic sur les notifications.
const CACHE = 'neo4bg-nova-v3';
const BASE = new URL('./', self.location).pathname;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE, BASE + 'icon.svg', BASE + 'manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Réseau d'abord pour les pages, cache en secours ; fichiers versionnés de /assets en cache d'abord.
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;
    // Retour de connexion Google : jamais servi depuis le cache.
    if (url.hash || url.search.includes('state=')) return;
    if (url.pathname.startsWith(BASE + 'assets/')) {
        event.respondWith(
            caches.match(req).then(
                (hit) =>
                    hit ||
                    fetch(req).then((res) => {
                        const copy = res.clone();
                        caches.open(CACHE).then((c) => c.put(req, copy));
                        return res;
                    })
            )
        );
        return;
    }
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(BASE, copy));
                    return res;
                })
                .catch(() => caches.match(BASE))
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            const open = list.find((c) => 'focus' in c);
            return open ? open.focus() : self.clients.openWindow(BASE);
        })
    );
});
