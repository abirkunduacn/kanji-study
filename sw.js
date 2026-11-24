// Offline support: network first for the site's own files, cache first for web fonts.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `kanji-study-${VERSION}`;
const FONT_CACHE = 'kanji-study-fonts';
// Web fonts and the version-pinned Firebase SDK never change at a given URL, so cache them.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'data/kanji.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/account.js',
  'js/app.js',
  'js/config.js',
  'js/firebase-config.js',
  'js/sync.js',
  'js/views/account.js',
  'js/data.js',
  'js/quiz.js',
  'js/render.js',
  'js/scroll-memory.js',
  'js/session.js',
  'js/srs.js',
  'js/store.js',
  'js/util.js',
  'js/views/family.js',
  'js/views/home.js',
  'js/views/kanji.js',
  'js/views/learn.js',
  'js/views/level.js',
  'js/views/quick.js',
  'js/views/quiz.js',
  'js/views/review.js',
  'js/views/search.js',
  'js/views/settings.js',
  'js/views/stats.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== FONT_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    // Revalidate with the server each time so a new deploy shows up on the next load.
    const response = await fetch(request.url, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('index.html');
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(event.request));
  else if (FONT_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(event.request));
});
