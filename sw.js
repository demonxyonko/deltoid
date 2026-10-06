const CACHE = 'shivi-v1.3.0';
const ASSETS = ['./', 'index.html', 'manifest.json', 'css/styles.css',
  'js/app.js', 'js/api.js', 'js/config.js', 'js/storage.js', 'js/ui.js', 'js/voice.js',
  'js/moods.js', 'js/memory.js', 'js/memory-ui.js', 'js/stickers.js', 'js/voicenote.js', 'js/stickers-ui.js',
  'assets/icons/avatar.webp', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png', 'assets/icons/apple-touch-icon.png', 'assets/icons/favicon-32.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API calls always go to network
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('index.html'))));
});
