const CACHE_NAME = "orlando-trip-v2";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/orlando-icon.svg"
];
const STALE_WHILE_REVALIDATE_PATHS = [
  "/api/travel/orlando/live",
  "/api/travel/orlando/fx"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (STALE_WHILE_REVALIDATE_PATHS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  }
});

async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (url.pathname === "/minha-viagem" && response.ok) {
      const clone = response.clone();
      const text = await clone.text().catch(() => "");
      if (text.includes("travel-frame-page") && text.includes("Agente da viagem Orlando")) {
        await cache.put("/minha-viagem", response.clone());
      }
    }
    return response;
  } catch {
    if (url.pathname === "/minha-viagem") {
      const cachedTrip = await cache.match("/minha-viagem");
      if (cachedTrip) return cachedTrip;
    }
    const cached = await cache.match(request);
    return cached || new Response("Offline: abra a viagem uma vez com internet para salvar o app.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const response = await network;
  return response || new Response(JSON.stringify({
    ok: false,
    offline: true,
    message: "Offline: abra com internet para atualizar este dado."
  }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
