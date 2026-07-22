const CACHE = "maxrouter-v4";

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

  // 1. Ignore non-HTTP/HTTPS schemes (chrome-extension://, etc.)
  if (!url.protocol.startsWith("http")) return;

  // 2. Ignore non-GET requests, API routes, and v1 endpoints
  if (request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/")) return;

  // 3. CRITICAL: Never intercept or cache Next.js App Router RSC payload requests (_rsc query or RSC header)
  if (
    url.searchParams.has("_rsc") ||
    request.headers.get("rsc") ||
    request.headers.get("accept")?.includes("text/x-component")
  ) {
    return;
  }

  // 4. HTML Navigation requests: ALWAYS bypass cache and fetch directly from network to ensure 100% fresh HTML & JWT state
  const isNavigation = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
  if (isNavigation) {
    e.respondWith(
      fetch(request).catch(async () => {
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
      })
    );
    return;
  }

  // 5. Static immutable assets (_next/static, fonts, images, css) -> Cache First / Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|gif|svg|ico|woff2|woff|ttf|css|js)$/i.test(url.pathname);

  if (!isStaticAsset) return;

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

      return cached || (await fetchPromise) || new Response("", { status: 404 });
    })()
  );
});
