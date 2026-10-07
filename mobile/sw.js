// Service worker: keeps a copy of the app on the phone so it opens instantly and works offline.
//
// IMPORTANT: after changing any app file, bump VERSION so phones pick up the new copy.

const VERSION = 'v1';
const APP_CACHE = `library-app-${VERSION}`;
const COVER_CACHE = 'library-covers'; // book cover images, kept across versions

const APP_FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/app.css',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png',
    'js/app.js',
    'js/components.js',
    'js/config.js',
    'js/db.js',
    'js/isbn.js',
    'js/lookup.js',
    'js/migrations.js',
    'js/repo.js',
    'js/scanner.js',
    'js/store.js',
    'js/ui.js',
    'js/pages/add.js',
    'js/pages/backup.js',
    'js/pages/book.js',
    'js/pages/catalog.js',
    'js/pages/home.js',
    'js/pages/lend.js',
    'js/pages/manual.js',
    'js/pages/people.js',
    'js/pages/return.js',
    'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
    'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm',
    'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
];

const COVER_HOSTS = ['covers.openlibrary.org', 'books.google.com', 'books.googleusercontent.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_CACHE)
            .then((cache) => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys
                .filter((key) => key.startsWith('library-app-') && key !== APP_CACHE)
                .map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Book covers: show the saved copy if we have one, otherwise fetch and save it.
    if (COVER_HOSTS.includes(url.hostname)) {
        event.respondWith(caches.open(COVER_CACHE).then(async (cache) => {
            const cached = await cache.match(request);
            if (cached) return cached;
            const response = await fetch(request);
            if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
        }));
        return;
    }

    // App files: use the saved copy (works offline), fall back to the network.
    // Book lookups (Open Library / Google APIs) aren't cached and always go to the network.
    event.respondWith(
        caches.match(request, { ignoreSearch: url.origin === location.origin })
            .then((cached) => cached ?? fetch(request)),
    );
});
