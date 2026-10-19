// Open Heart service worker: app-shell cache-first, API network-first.
const CACHE = "open-heart-v4";
const SHELL = ["/", "/index.html", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/cards") || url.pathname.startsWith("/api/admin")) return; // personal data: never cached
  if (url.pathname.startsWith("/api/") || request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }).catch(() => caches.match("/index.html"))
    )
  );
});
