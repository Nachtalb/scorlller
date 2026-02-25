# Scorlller

TikTok-style Reddit media viewer. Browse any subreddit as a vertical reel or a grid gallery.

**Stack:** Vite + React SPA · Caddy (with cache-handler) · No server-side runtime

---

## Architecture

```
Browser (PWA)
  │
  ├── Static assets              ← Caddy file_server → dist/
  ├── /proxy/redgifs/*           → media.redgifs.com  (header spoofing + in-memory cache)
  ├── /proxy/preview/*           → preview.redd.it    (CORS injection)
  ├── /proxy/ext-preview/*       → external-preview.redd.it (CORS injection, downloads only)
  └── www.reddit.com/r/…         → Direct (Reddit JSON API has CORS)
```

Caddy is the only backend process. No Node.js. No Bun.

---

## Development

```bash
# Install dependencies
npm install

# Download Caddy with cache-handler plugin (amd64)
curl -fL "https://caddyserver.com/api/download?os=linux&arch=amd64&p=github.com/caddyserver/cache-handler" \
  -o caddy-amd64 && chmod +x caddy-amd64

# Terminal 1: Vite dev server (HMR on :5173)
npm run dev

# Terminal 2: Caddy dev proxy (:3000 → :5173 + proxy routes)
./caddy-amd64 run --config Caddyfile.dev

# Open http://localhost:3000
```

`Caddyfile.dev` forwards all non-proxy traffic to Vite's dev server so HMR works normally. Proxy routes are identical to production.

---

## Production build

```bash
npm run build          # outputs to dist/
./caddy-amd64 run --config Caddyfile   # serves dist/ + proxy routes on :3000
```

Override port and dist dir via env vars:

```bash
PORT=8080 CADDY_DIST_DIR=/opt/scorlller/dist ./caddy run --config Caddyfile
```

---

## Portable tarball (ARM64 for Termux)

```bash
./scripts/build-portable.sh arm64
# → /tmp/scorlller-arm64.tar.gz
```

The script downloads `caddy-arm64` with cache-handler, runs `npm run build`, and packages everything into a self-contained tarball.

**Deploy on Termux:**

```bash
tar -xzf scorlller-arm64.tar.gz
cd scorlller-dist
./start.sh    # Caddy on :3000, cache lives in ./caddy-cache/
```

Tarball contents:
```
scorlller-dist/
├── dist/       ← Vite build output
├── caddy       ← Caddy binary with cache-handler (~50MB)
├── Caddyfile   ← Production config
└── start.sh    ← exec ./caddy run --config Caddyfile
```

---

## Proxy routes

### `/proxy/redgifs/*` → `media.redgifs.com`

Spoofs browser headers (`User-Agent`, `Referer`, `Origin`) and strips proxy-reveal headers (`X-Forwarded-*`, `Via`) that CDN77 bot detection rejects. Responses cached in-memory by Souin (24h TTL).

### `/proxy/preview/*` → `preview.redd.it`

`preview.redd.it` has no CORS headers. Caddy injects `Access-Control-Allow-Origin: *` so the browser can fetch preview images and mp4 GIF variants.

### `/proxy/ext-preview/*` → `external-preview.redd.it`

Same as above. Only used in the download flow (the `<img>` rendering uses Reddit's partial CORS directly).

---

## Caching

Caddy uses the [souin](https://github.com/darkweak/souin) cache-handler module. Default storage is in-memory LRU — fast, no extra plugins needed. Cache survives as long as Caddy runs; cleared on restart.

> **For disk persistence** across Caddy restarts, rebuild with the nuts storage plugin:
> ```
> github.com/darkweak/storages/nuts/caddy
> ```
> Then add `nuts { path ./caddy-cache }` inside the `cache {}` block in Caddyfile.

---

## Keyboard shortcuts

### Global

| Key        | Action                                    |
| ---------- | ----------------------------------------- |
| `r`        | Switch to Reels                           |
| `g`        | Switch to Gallery                         |
| `b`        | Switch to Bookmarks                       |
| `s` or `/` | Focus the subreddit search field          |
| `f`        | Toggle bookmark for the current subreddit |

### Reel view

| Key              | Action                |
| ---------------- | --------------------- |
| `j` / `↓`       | Next post             |
| `k` / `↑`       | Previous post         |
| `d` / `Ctrl+S`  | Download current post |

### Bookmarks view

| Key        | Action                   |
| ---------- | ------------------------ |
| `j` / `↓` | Select next bookmark     |
| `k` / `↑` | Select previous bookmark |
| `Enter`    | Open selected bookmark   |

---

## License

[MIT](LICENSE)
