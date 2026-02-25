const STATIC_CACHE  = 'scrolller-static-v1';
const MEDIA_CACHE   = 'scrolller-media-v1';
const API_CACHE     = 'scrolller-api-v1';

const MEDIA_MAX_ENTRIES = 80;   // ~last 3 pages of media
const API_TTL_MS        = 5 * 60 * 1000; // 5 min

const REDDIT_MEDIA_HOSTS = [
  'i.redd.it',
  'v.redd.it',
  'preview.redd.it',
  'external-preview.redd.it',
  'i.imgur.com',
];

const isRedditMedia = (url) => {
  try { return REDDIT_MEDIA_HOSTS.some(h => new URL(url).hostname === h); }
  catch { return false; }
};

// Install
self.addEventListener('install', () => self.skipWaiting());

// Activate: drop old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![STATIC_CACHE, MEDIA_CACHE, API_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Evict oldest entries if media cache exceeds limit
async function trimMediaCache() {
  const cache = await caches.open(MEDIA_CACHE);
  const keys  = await cache.keys();
  if (keys.length > MEDIA_MAX_ENTRIES) {
    const toDelete = keys.slice(0, keys.length - MEDIA_MAX_ENTRIES);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

self.addEventListener('fetch', (e) => {
  const { url, method } = e.request;
  if (method !== 'GET') return;

  const parsed = new URL(url);

  // ── _next/static — immutable, cache forever ──────────────────────────────
  if (parsed.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // ── /api/reddit/ — stale-while-revalidate, 5min TTL ─────────────────────
  if (parsed.pathname.startsWith('/api/reddit/')) {
    e.respondWith(
      caches.open(API_CACHE).then(async c => {
        const hit = await c.match(e.request);
        if (hit) {
          const age = Date.now() - Number(hit.headers.get('sw-cached-at') || 0);
          if (age < API_TTL_MS) return hit;
        }
        try {
          const res = await fetch(e.request);
          if (res.ok) {
            // Inject timestamp header so we can check TTL later
            const stamped = new Response(res.clone().body, {
              status: res.status,
              headers: new Headers([...res.headers, ['sw-cached-at', String(Date.now())]]),
            });
            c.put(e.request, stamped);
          }
          return res;
        } catch {
          return hit || new Response('offline', { status: 503 });
        }
      })
    );
    return;
  }

  // ── Reddit media (images/videos from CDN) — cache-first ──────────────────
  if (isRedditMedia(url)) {
    e.respondWith(
      caches.open(MEDIA_CACHE).then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          // Don't modify the request mode — let the browser use its natural mode
          // for <img>/<video> elements (avoids CORS conflicts)
          const res = await fetch(e.request);
          if (res.ok || res.type === 'opaque') {
            c.put(e.request, res.clone());
            trimMediaCache();
          }
          return res;
        } catch {
          return new Response(null, { status: 503 });
        }
      })
    );
    return;
  }

  // ── Everything else (HTML, manifest, icons) — network only ───────────────
  e.respondWith(fetch(e.request));
});
