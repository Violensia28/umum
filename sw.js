const CACHE_NAME = 'techpartner-v6-cache-v1';

// Daftar file yang WAJIB disimpan agar aplikasi jalan Offline
const urlsToCache = [
  './',
  './index.html',
  './assets/js/app.js',
  './assets/js/db.js',
  './assets/js/state.js',
  './assets/js/ui.js',
  './assets/js/utils.js',
  './assets/js/modules/ai.js',
  './assets/js/modules/wo.js',
  './assets/js/modules/report.js',
  './assets/js/modules/qr.js'
];

// 1. INSTALL: Simpan file ke cache saat pertama kali dibuka
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('PWA: Caching file lokal...');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('PWA: Cache gagal', err))
  );
});

// 2. FETCH: Saat user minta file, cek dulu di cache (Offline First)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Jika ada di cache, pakai itu (Cepat & Offline)
        if (response) {
          return response;
        }
        // Jika tidak, ambil dari internet (Online)
        return fetch(event.request);
      })
  );
});

// 3. ACTIVATE: Hapus cache versi lama jika ada update baru
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
