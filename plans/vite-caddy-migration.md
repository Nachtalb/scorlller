# Scorlller: Vite SPA + Caddy Migration Plan

> Reference: `git clone ~/src/github.com/Nachtalb/scorlller /tmp/scorlller-ref` before touching anything.
> New work: branch `vite-rewrite` off `main`.

---

## 1. Goals

| Current (Next.js + Bun) | New (Vite + Caddy) |
|---|---|
| Node.js + Bun runtime required | Zero runtime — static `dist/` + Caddy binary |
| ~130MB tarball (Bun + standalone) | ~50MB tarball (Caddy with cache plugin + dist) |
| API routes in TypeScript (proxy + disk cache) | Caddyfile handles all proxying + caching |
| SW media cache (browser-managed, quota-limited) | Caddy disk cache (file-system, explicit sizing) |
| Vite proxy in dev, Next.js server in prod | Caddy in dev AND prod — identical proxy behaviour |

---

## 2. Architecture

```
Browser (PWA — minimal SW, installable only)
  │
  ├── Static assets (HTML, JS, CSS, icons, manifest)
  │       └─► Caddy file_server → dist/
  │
  ├── /proxy/redgifs/*        → media.redgifs.com  (header spoofing + disk cache)
  ├── /proxy/preview/*        → preview.redd.it    (CORS injection)
  ├── /proxy/ext-preview/*    → external-preview.redd.it  (CORS injection, downloads only)
  │
  └── www.reddit.com/r/*/hot.json  → Direct from browser (Reddit JSON has CORS)
```

No Node.js. No Bun. No server-side TypeScript. No SW caching logic.

---

## 3. Caddy Build (with cache-handler plugin)

Standard Caddy does not include a cache module. We need a custom build.

### Option A — Caddy Download API (no local toolchain needed)

```sh
# ARM64 (Termux / deploy target)
curl -fL \
  "https://caddyserver.com/api/download?os=linux&arch=arm64&p=github.com/caddyserver/cache-handler" \
  -o caddy-arm64
chmod +x caddy-arm64

# AMD64 (dev / CI)
curl -fL \
  "https://caddyserver.com/api/download?os=linux&arch=amd64&p=github.com/caddyserver/cache-handler" \
  -o caddy-amd64
chmod +x caddy-amd64
```

The `p=` param tells Caddy's build service to compile in the plugin. No Go or xcaddy needed locally.

### Option B — xcaddy (if pinning a specific version or offline build)

```sh
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest

# ARM64 cross-compile
GOOS=linux GOARCH=arm64 xcaddy build \
  --with github.com/caddyserver/cache-handler \
  --output caddy-arm64
```

### Verifying the build

```sh
./caddy-arm64 list-modules | grep cache
# should output: http.handlers.cache
```

---

## 4. Caddyfile

Two files sharing common logic via `import`. One binary, two configs.

### `Caddyfile` (production)

```caddyfile
{
  admin off
  auto_https off

  # Disk cache for proxied media (redgifs videos etc.)
  cache {
    ttl 24h
    stale 1h
    # Filesystem backend — persists across Caddy restarts
    nuts {
      path {$CADDY_CACHE_DIR:./caddy-cache}
    }
  }
}

:{$PORT:3000} {

  # ─── Redgifs media proxy + cache ─────────────────────────────────────────
  # Spoofs browser + redgifs.com headers. Caddy transparently forwards Range
  # requests (Android sends Range: bytes=0- for all video elements — that's fine,
  # cache-handler caches the full response and serves ranges from it).
  handle /proxy/redgifs/* {
    cache
    reverse_proxy https://media.redgifs.com {
      header_up Host       "media.redgifs.com"
      header_up User-Agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      header_up Referer    "https://www.redgifs.com/"
      header_up Origin     "https://www.redgifs.com"
      header_up -Cookie
      header_down Access-Control-Allow-Origin   "*"
      header_down Access-Control-Allow-Methods  "GET, HEAD, OPTIONS"
      header_down Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges"
      header_down -Set-Cookie
    }
  }

  # ─── preview.redd.it CORS proxy ──────────────────────────────────────────
  # No CORS upstream. Caddy injects the headers so the browser can fetch.
  # Used for: GIF mp4 variants, preview images (rendering + downloading).
  handle /proxy/preview/* {
    uri strip_prefix /proxy/preview
    reverse_proxy https://preview.redd.it {
      header_up Host "preview.redd.it"
      header_up -Cookie
      header_down Access-Control-Allow-Origin  "*"
      header_down Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
      header_down -Set-Cookie
    }
  }

  # ─── external-preview.redd.it CORS proxy ─────────────────────────────────
  # Partial CORS upstream — sufficient for <img> tags, not for fetch()-based downloads.
  # Only used in the download flow, not for rendering.
  handle /proxy/ext-preview/* {
    uri strip_prefix /proxy/ext-preview
    reverse_proxy https://external-preview.redd.it {
      header_up Host "external-preview.redd.it"
      header_up -Cookie
      header_down Access-Control-Allow-Origin  "*"
      header_down Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
      header_down -Set-Cookie
    }
  }

  # ─── CORS preflight ───────────────────────────────────────────────────────
  @options method OPTIONS
  handle @options {
    header Access-Control-Allow-Origin  "*"
    header Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
    header Access-Control-Max-Age       "86400"
    respond 204
  }

  # ─── Static SPA ──────────────────────────────────────────────────────────
  root * {$CADDY_DIST_DIR:./dist}
  encode gzip
  try_files {path} /index.html
  file_server
}
```

### `Caddyfile.dev` (development)

Identical proxy routes. Instead of `file_server`, reverse-proxies to the Vite dev server.
Vite HMR WebSocket (`/@vite/client`, `/__vite_hmr`) passes through transparently.

```caddyfile
{
  admin off
  auto_https off

  cache {
    ttl 24h
    stale 1h
    nuts {
      path ./caddy-cache-dev
    }
  }
}

:3000 {

  handle /proxy/redgifs/* {
    cache
    reverse_proxy https://media.redgifs.com {
      header_up Host       "media.redgifs.com"
      header_up User-Agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      header_up Referer    "https://www.redgifs.com/"
      header_up Origin     "https://www.redgifs.com"
      header_up -Cookie
      header_down Access-Control-Allow-Origin   "*"
      header_down Access-Control-Allow-Methods  "GET, HEAD, OPTIONS"
      header_down Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges"
      header_down -Set-Cookie
    }
  }

  handle /proxy/preview/* {
    uri strip_prefix /proxy/preview
    reverse_proxy https://preview.redd.it {
      header_up Host "preview.redd.it"
      header_up -Cookie
      header_down Access-Control-Allow-Origin  "*"
      header_down Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
      header_down -Set-Cookie
    }
  }

  handle /proxy/ext-preview/* {
    uri strip_prefix /proxy/ext-preview
    reverse_proxy https://external-preview.redd.it {
      header_up Host "external-preview.redd.it"
      header_up -Cookie
      header_down Access-Control-Allow-Origin  "*"
      header_down Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
      header_down -Set-Cookie
    }
  }

  @options method OPTIONS
  handle @options {
    header Access-Control-Allow-Origin  "*"
    header Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
    header Access-Control-Max-Age       "86400"
    respond 204
  }

  # Dev: forward everything else to Vite dev server
  handle {
    reverse_proxy localhost:5173
  }
}
```

**Dev workflow:**

```sh
# Terminal 1
npm run dev           # Vite on :5173

# Terminal 2
./caddy-amd64 run --config Caddyfile.dev   # Caddy on :3000 (your actual dev URL)
```

Browse to `http://localhost:3000`. All proxy routes work identically to production.

---

## 5. Repository Setup

```sh
# 1. Clone reference (read-only)
git clone ~/src/github.com/Nachtalb/scorlller /tmp/scorlller-ref

# 2. New branch
cd ~/src/github.com/Nachtalb/scorlller
git checkout -b vite-rewrite

# 3. Nuke Next.js
rm -rf app node_modules .next next.config.mjs next-env.d.ts nginx.conf instrumentation.ts bun.lock

# 4. Scaffold Vite in-place
npm create vite@latest . -- --template react-ts
# Overwrite package.json: yes
```

**Keep from current repo:**
- `components/` (port with minor changes — see §7)
- `hooks/useRedditPosts.ts` (port — update API URL only)
- `stores/useAppStore.ts` (works unchanged)
- `lib/db.ts` (works unchanged — IndexedDB)
- `public/` icons + manifest (rewrite `sw.js`)
- `tailwind.config.ts`, `postcss.config.mjs`

---

## 6. Vite Project Setup

### `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      manifest: {
        name: 'Scorlller',
        short_name: 'Scorlller',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  // No proxy config — Caddy handles all proxying in dev too
})
```

### Dependencies

```sh
npm install zustand @tanstack/react-query framer-motion lucide-react \
  clsx tailwind-merge embla-carousel-react react-masonry-css

npm install -D vite-plugin-pwa tailwindcss autoprefixer postcss \
  @types/react @types/react-dom typescript eslint
```

---

## 7. Service Worker (`public/sw.js`)

**Minimal** — only exists so the app is PWA-installable. No caching whatsoever.
Caching is Caddy's job now.

```js
// Minimal SW — PWA installability only. No fetch interception, no caching.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
```

That's the entire file.

---

## 8. Component Migration

### 8.1 Changes by file

| File | Change |
|---|---|
| All `components/*.tsx` | Remove `'use client'` directives |
| `components/TopBar.tsx` | `process.env.NEXT_PUBLIC_COMMIT_HASH` → `import.meta.env.VITE_COMMIT_HASH` |
| All components | No other changes — they don't reference API routes directly |
| `hooks/useRedditPosts.ts` | Update API URL (see §8.2) |
| `lib/logger.ts` | Drop entirely (was server-side stdout logging) |
| `instrumentation.ts` | Drop entirely (Next.js server hook) |

### 8.2 `hooks/useRedditPosts.ts` — API URL

```ts
// OLD:
const url = `/api/reddit/r/${currentSub}/${sort}.json?${params}`;

// NEW (direct):
const url = `https://www.reddit.com/r/${currentSub}/${sort}.json?${params}`;
```

Also update the redgifs src construction:

```ts
// OLD:
return { type: 'video', src: `/api/redgifs/${m[1]}` };

// NEW:
return { type: 'video', src: `/proxy/redgifs/${m[1]}.mp4` };
```

Note: The `.mp4` extension is added explicitly here. The old route inferred it server-side;
Caddy needs the full path to match `media.redgifs.com/{id}.mp4` after prefix stripping.

### 8.3 `proxyUrl()` utility — new file `src/lib/proxy.ts`

```ts
/**
 * Rewrites CDN URLs that lack CORS headers to go through Caddy proxy routes.
 * Used for both rendering (img/video src) and downloading.
 *
 * i.redd.it       → direct (has CORS)
 * v.redd.it       → direct (has CORS)
 * preview.redd.it → /proxy/preview/...    (no CORS upstream)
 * external-preview.redd.it → /proxy/ext-preview/...  (partial CORS, unreliable for fetch)
 */
export function proxyUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'preview.redd.it')
      return `/proxy/preview${u.pathname}${u.search}`;
    if (u.hostname === 'external-preview.redd.it')
      return `/proxy/ext-preview${u.pathname}${u.search}`;
    return url;
  } catch {
    return url;
  }
}
```

### 8.4 `components/ReelView.tsx` — download flow

```ts
// OLD (§144):
const proxySrc = post.src.startsWith('/') ? post.src : `/api/download?url=${encodeURIComponent(post.src)}`;

// NEW:
import { proxyUrl } from '@/lib/proxy';
const proxySrc = proxyUrl(post.src);
// post.src is already '/proxy/redgifs/…' for redgifs, or direct https:// for v.redd.it/i.redd.it
// proxyUrl() only rewrites preview.redd.it / external-preview.redd.it
```

### 8.5 Image rendering — apply `proxyUrl()` to preview sources

In `useRedditPosts.ts`, some image srcs come from `preview.redd.it` (fallback case #5, mp4 variant #3).
Wrap those with `proxyUrl()` so `<img src={...}>` doesn't CORS-fail:

```ts
// In getMediaSrc():

// Case 3 — mp4 variant (preview.redd.it URL)
const mp4Variant = p.preview?.images?.[0]?.variants?.mp4?.source?.url;
if (mp4Variant) {
  const src = mp4Variant.replace(/&amp;/g, '&');
  return { type: 'video', src: proxyUrl(src) };
}

// Case 5 — fallback image (may be preview.redd.it)
return {
  type: 'image',
  src: proxyUrl(p.url || p.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '')
};
```

---

## 9. Disk Cache (Caddy cache-handler)

The `cache-handler` module uses `souin` internally. The `nuts` storage backend writes to disk.

```caddyfile
cache {
  ttl 24h          # How long to keep a cached response
  stale 1h         # Serve stale while revalidating after TTL expires
  nuts {
    path ./caddy-cache   # Relative to Caddyfile location
  }
}
```

**What gets cached:**
- `/proxy/redgifs/*` responses (video mp4 files) — most important, large files, rewatched often
- Directive `cache` inside the `handle` block opts that route into the cache

**What doesn't get cached:**
- `/proxy/preview/*` — short-lived image URLs with query params (not worth caching)
- `/proxy/ext-preview/*` — same
- Static files — served directly from disk by `file_server`, no need for cache layer

**Range request behaviour:**
Caddy's `reverse_proxy` passes `Range` headers through to upstream. The cache-handler intercepts the response before caching. When Android Chrome sends `Range: bytes=0-` (full-file range), the upstream returns a `206` response with the full body — the cache-handler caches this and can serve subsequent range requests from the cached response.

> **Note:** The `cache-handler` module handles range-request caching if the upstream response includes the full content in the `206`. This covers Android Chrome's `bytes=0-` behaviour. True mid-file seeks (e.g. `bytes=1234567-`) will cache-miss and be proxied directly — same as the old Next.js behaviour.

---

## 10. Build & Deployment Tarball

### `scripts/build-portable.sh`

```sh
#!/bin/sh
set -e
ARCH="${1:-arm64}"   # Usage: ./build-portable.sh [arm64|amd64]

echo "▶ Downloading Caddy ($ARCH) with cache-handler..."
curl -fL \
  "https://caddyserver.com/api/download?os=linux&arch=${ARCH}&p=github.com/caddyserver/cache-handler" \
  -o "caddy-${ARCH}"
chmod +x "caddy-${ARCH}"

echo "▶ Building Vite SPA..."
VITE_COMMIT_HASH="$(git rev-parse --short HEAD 2>/dev/null || echo dev)" \
  npm run build

echo "▶ Packaging..."
DIST=/tmp/scorlller-dist
rm -rf "$DIST"
mkdir -p "$DIST"
cp -r dist/. "$DIST/dist/"
cp "caddy-${ARCH}" "$DIST/caddy"
cp Caddyfile "$DIST/Caddyfile"

cat > "$DIST/start.sh" << 'EOF'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
exec ./caddy run --config Caddyfile
EOF
chmod +x "$DIST/caddy" "$DIST/start.sh"

cd /tmp
tar -czf "scorlller-${ARCH}.tar.gz" scorlller-dist
echo "✓ /tmp/scorlller-${ARCH}.tar.gz"
```

### Tarball structure

```
scorlller-dist/
├── dist/          ← Vite build (index.html + assets/ + sw.js + manifest + icons)
├── caddy          ← custom Caddy binary with cache-handler (~50MB)
├── Caddyfile      ← production config (PORT + CADDY_DIST_DIR env vars)
└── start.sh       ← exec ./caddy run --config Caddyfile
```

### Deploy on Termux

```sh
tar -xzf scorlller-arm64.tar.gz
cd scorlller-dist
./start.sh        # serves on :3000, cache written to ./caddy-cache/
```

---

## 11. GitHub Actions CI

```yaml
name: Build Portable

on:
  push:
    branches: [vite-rewrite, main]

jobs:
  build:
    strategy:
      matrix:
        arch: [amd64, arm64]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Download Caddy ${{ matrix.arch }} (with cache-handler)
        run: |
          curl -fL \
            "https://caddyserver.com/api/download?os=linux&arch=${{ matrix.arch }}&p=github.com/caddyserver/cache-handler" \
            -o caddy-${{ matrix.arch }}
          chmod +x caddy-${{ matrix.arch }}

      - name: Build SPA
        env:
          VITE_COMMIT_HASH: ${{ github.sha }}
        run: npm run build

      - name: Package
        run: bash scripts/build-portable.sh ${{ matrix.arch }}

      - uses: actions/upload-artifact@v4
        with:
          name: scorlller-${{ matrix.arch }}
          path: /tmp/scorlller-${{ matrix.arch }}.tar.gz
```

---

## 12. Migration Checklist

### Setup
- [ ] Clone reference to `/tmp/scorlller-ref`
- [ ] Create `vite-rewrite` branch, nuke Next.js files
- [ ] `npm create vite@latest . -- --template react-ts`
- [ ] Install dependencies

### Caddy
- [ ] Download `caddy-amd64` with cache-handler for local dev
- [ ] Write `Caddyfile` (production)
- [ ] Write `Caddyfile.dev` (dev — proxies to Vite :5173)
- [ ] Verify `list-modules | grep cache` works
- [ ] Verify redgifs proxy: `curl -I http://localhost:3000/proxy/redgifs/WiryGiddyWaterbuck.mp4`
- [ ] Verify CORS headers on preview proxy: `curl -I http://localhost:3000/proxy/preview/…`
- [ ] Verify cache headers present on second redgifs request (`X-Cache: HIT` or similar)

### Frontend
- [ ] `vite.config.ts` with vite-plugin-pwa (injectManifest)
- [ ] Tailwind + global CSS ported
- [ ] Minimal `public/sw.js` (install + activate only)
- [ ] `stores/useAppStore.ts` ported
- [ ] `lib/db.ts` ported
- [ ] `src/lib/proxy.ts` written
- [ ] `hooks/useRedditPosts.ts` ported (direct Reddit URL, `/proxy/redgifs/`, `proxyUrl()` on preview srcs)
- [ ] All components ported (remove `'use client'`, update env var)
- [ ] `ReelView.tsx` download: `proxyUrl(post.src)` instead of `/api/download?url=`
- [ ] App entry point (`src/main.tsx`, `src/App.tsx`)

### Verify
- [ ] Dev: `npm run dev` + `caddy run --config Caddyfile.dev` → browse :3000
- [ ] Reddit feed loads (direct CORS)
- [ ] Redgifs video plays
- [ ] `preview.redd.it` images load (GIF mp4 variants work)
- [ ] Download button works for all media types
- [ ] PWA installable (manifest + SW present)
- [ ] Production build: `npm run build` → `./caddy run` → verify all of the above

### Build
- [ ] `scripts/build-portable.sh` written
- [ ] ARM64 tarball built and tested on Termux
- [ ] GitHub Actions workflow updated

---

## Testing Notes (Phase 2 findings)

### Reddit JSON API — CORS behaviour
- No UA → **403** (must send a UA)
- Any UA **without** `Origin` header → 200 + `access-control-allow-origin: *`
- Any UA **with** `Origin` header (as browsers always send) → 200 + **no CORS header** → browser blocks
- **Conclusion:** Reddit's JSON API never echoes CORS for browser requests. Proxy is mandatory.
- **UA to use in proxy:** browser UA (`Mozilla/5.0 ...`) — not app/bot UA

### preview.redd.it — signed URLs
- URLs contain a time-limited `s=` signature param
- Valid signature → 200, no CORS header
- Expired/wrong signature → 403
- With `Origin` → 200, still no CORS header
- **Conclusion:** Proxy must inject `Access-Control-Allow-Origin: *`

### media.redgifs.com — CORS
- No headers → 200, no CORS header
- With spoofed Referer+Origin → 200, `access-control-allow-origin: https://www.redgifs.com` (locked — blocks our origin)
- Range: bytes=0- (Android pattern) → 206, returns full body
- Range: bytes=X-Y → 206, correct partial content
- **Conclusion:** Proxy must overwrite CORS header to `*`

### Direct (no proxy)
- `i.redd.it` → reflects any `Origin` as `access-control-allow-origin: <origin>` ✅
- `v.redd.it` → `access-control-allow-origin: *` ✅
