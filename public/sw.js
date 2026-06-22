// ChoreTracker service worker.
// Strategy:
//   - Navigations: network-first, fall back to the cached /offline shell.
//   - Same-origin static GETs: cache-first (stale-while-style), runtime-cached.
//   - Everything else (incl. Supabase API / auth on another origin): passthrough.
// We deliberately NEVER cache authenticated data responses — only the app shell
// and same-origin static assets — so a kid can never see another state's data.
const CACHE = "chore-tracker-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icon.svg?v=1", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: network-first with an offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || Response.error()),
      ),
    );
    return;
  }

  // Only cache-first for same-origin static assets. Cross-origin (Supabase) and
  // any non-basic response are passed straight through, never cached.
  if (!sameOrigin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
