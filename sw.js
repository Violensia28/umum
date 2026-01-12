const CACHE_NAME = 'techpartner-v6-core';
const ASSETS = [
  './',
  './index.html',
  './assets/js/app.js',
  './assets/js/state.js',
  './assets/js/db.js',
  './assets/js/ui.js',
  './assets/js/utils.js',
  './assets/js/modules/ai.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.7/dayjs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.7/locale/id.min.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js',
  'https://unpkg.com/docx@7.1.0/build/index.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
];

// Install SW & Cache Assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate & Cleanup Old Caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
});

// Fetch Strategy: Stale-While-Revalidate
// (Pakai cache dulu biar cepat, lalu update di background jika ada internet)
self.addEventListener('fetch', (e) => {
  // Jangan cache request ke API GitHub atau Gemini agar data selalu fresh
  if (e.request.url.includes('api.github.com') || e.request.url.includes('generativelanguage.googleapis.com')) {
    return; // Biarkan browser handle network normal
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Kembalikan cache jika ada
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
        });
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});
