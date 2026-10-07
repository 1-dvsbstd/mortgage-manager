const CACHE_NAME = 'mortgage-manager-preview-backup-fix-003';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './public/icon.svg',
  './public/home-editorial.svg',
  './public/mortgage-icons.svg',
  './public/app-background-hybrid.webp',
  './public/market-rates.json',
  './public/hpi-local-property-type.json',
  './src/styles.css',
  './src/deep-dive.css',
  './src/chart-enhance.css',
  './src/home-profile.css',
  './src/next-home-planner.css',
  './src/design-tokens.css',
  './src/setup-data.css',
  './src/mortgage-history.css',
  './src/app-runtime.css',
  './src/app-navigation.css',
  './src/upcoming.css',
  './src/setup-tabs.css',
  './src/offline-v1-final.css',
  './src/page-refine.css',
  './src/mortgage-store.js',
  './src/view-switcher.js',
  './src/mortgage.js',
  './src/home-projection.js',
  './src/next-home-planner.js',
  './src/chart-enhance.js',
  './src/balance-projection.js',
  './src/home-costs.js',
  './src/setup-data.js',
  './src/setup-home-profile.js',
  './src/mortgage-history.js',
  './src/app-runtime.js',
  './src/app-navigation.js',
  './src/page-refine.js',
  './src/setup-tabs.js',
  './src/layout-finalize.js',
  './src/v15-refresh.js',
  './src/v15-polish.js',
  './src/product-polish.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache:'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache:'no-store' })
      .then((response) => {
        if (response && response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const exact = await caches.match(event.request);
        if (exact) return exact;
        if (new URL(event.request.url).origin === self.location.origin) {
          return caches.match(event.request, { ignoreSearch: true });
        }
        return undefined;
      })
  );
});
