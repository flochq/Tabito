// Tabito Service Worker
const CACHE_NAME = "tabito-v5";

const PRECACHE = [
  "./tabito.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// External CDN assets to cache on first use
const CDN_HOSTS = [
  "unpkg.com",
  "basemaps.cartocdn.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

// Install — cache app shell
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first for app shell & CDN, network-first for API calls
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Never cache Overpass API or OSRM (real-time data)
  if (url.hostname.includes("overpass") || url.hostname.includes("osrm")) {
    return; // fall through to network
  }

  // Cache-first for map tiles (heavy, rarely change)
  if (url.hostname.includes("cartocdn.com")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }).catch(() => new Response("", { status: 503 }))
    );
    return;
  }

  // Cache-first for CDN assets (leaflet, turf, fonts)
  const isCDN = CDN_HOSTS.some(h => url.hostname.includes(h));
  if (isCDN || PRECACHE.some(p => url.pathname === p)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return cached || new Response("Offline", { status: 503 });
        }
      })
    );
    return;
  }
});
