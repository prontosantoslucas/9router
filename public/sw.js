const CACHE = "maxrouter-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
    ])
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension://, moz-extension://, blob:, data:)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Ignore non-GET requests, API routes, and v1 endpoints
  if (request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/")) {
    return;
  }

  // Network-First strategy for HTML document / navigation requests so users always get fresh pages
  const isNavigation = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");

  if (isNavigation) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone).catch(() => {})).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request).catch(() => null);
          return cached || new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  // Stale-While-Revalidate strategy for static assets
  e.respondWith(
    (async () => {
      const cached = await caches.match(request).catch(() => null);
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone).catch(() => {})).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
    })()
  );
});
