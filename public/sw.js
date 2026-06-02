/* Service worker minimal (PWA) — cache du shell + offline basique.
   N'intercepte JAMAIS /api/* ni les origines externes (Firebase, OpenAI/Anthropic…). */
const CACHE = "webmail-shell-v5";
const SHELL = ["/", "/icone/app-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // externe → réseau direct
  if (url.pathname.startsWith("/api")) return; // dynamique/auth → jamais en cache

  // Navigations : réseau d'abord, repli sur le shell en cache si hors-ligne.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r || Response.error()))
    );
    return;
  }

  // Assets statiques : cache d'abord, sinon réseau (et mise en cache).
  if (
    url.pathname.startsWith("/_next/static") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
});
