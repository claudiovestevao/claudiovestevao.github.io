const CACHE_NAME = "orlando-trip-v6";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/orlando-icon.svg",
  "/leaflet.css",
  "/leaflet.js"
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

  // PDFs protected by the trip login are opened as navigations. Let the
  // browser request those files directly, instead of treating a document
  // response as an offline page when the service worker cannot reach it.
  if (url.pathname.startsWith("/minha-viagem/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
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

async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#081529">
  <title>Minha Viagem offline</title>
  <style>
    *{box-sizing:border-box}
    body{min-height:100dvh;margin:0;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));background:linear-gradient(180deg,#eef6ff,#fffaf0);color:#182238;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
    main{width:min(440px,100%);border:1px solid #d9e4f2;border-radius:16px;padding:24px;background:#fff;box-shadow:0 18px 48px rgba(8,21,41,.12)}
    span{display:inline-flex;border-radius:999px;padding:5px 10px;background:#fff4c2;color:#7c4a03;font-size:12px;font-weight:900}
    h1{margin:14px 0 6px;font-size:28px;line-height:1.1}
    p{margin:0 0 18px;color:#4b5f79}
    nav{display:grid;gap:8px}
    a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;border:1px solid #173a72;border-radius:10px;padding:10px 14px;color:#fff;background:#173a72;font-weight:900;text-decoration:none}
    a:last-child{color:#173a72;background:#fff}
  </style>
</head>
<body>
  <main>
    <span>Offline</span>
    <h1>A viagem continua no celular</h1>
    <p>Os dados que ja estavam abertos continuam disponiveis localmente. Conecte-se para sincronizar check-ins, PDFs e o diario.</p>
    <nav aria-label="Acoes offline">
      <a href="">Tentar novamente</a>
      <a href="/">Voltar ao Claudio Code</a>
    </nav>
  </main>
</body>
</html>`, {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8"
      }
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
