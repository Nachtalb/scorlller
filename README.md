# Scorlller

TikTok-style Reddit media viewer. Browse any subreddit as a vertical reel or a grid gallery.

**Stack:** Vite + React SPA · nginx (Docker) · No server-side runtime

---

## Architecture

```
Browser (PWA)
  │
  ├── /                          ← nginx file_server → dist/
  ├── /proxy/reddit/*            → www.reddit.com     (OpenSSL TLS — bypasses Go fingerprint block)
  ├── /proxy/redgifs/*           → media.redgifs.com  (browser UA spoofing + disk cache)
  ├── /proxy/preview/*           → preview.redd.it    (CORS injection)
  └── /proxy/ext-preview/*       → external-preview.redd.it (CORS injection, downloads only)
```

nginx is the only backend process. No Node.js. No Bun.

---

## Development

```bash
npm install

# Terminal 1: nginx proxy (docker compose up starts nginx on :3001)
PORT=3001 docker compose up -d

# Terminal 2: Vite dev server with HMR (:5173, proxies /proxy/* to nginx)
npm run dev

# Open http://localhost:5173
```

Vite's dev server forwards all `/proxy/*` requests to nginx, so HMR and proxy routes work together.

---

## Production

```bash
npm run build          # outputs to dist/
PORT=3000 docker compose up -d   # nginx serves dist/ + proxy routes on :3000
```

---

## Proxy routes

### `/proxy/reddit/*` → `www.reddit.com`

Reddit's JSON API returns no CORS headers for browser requests. nginx proxies with a bot-style User-Agent (`scorlller/2.0 by Nachtalb`) and injects CORS headers. nginx uses OpenSSL for upstream TLS — Go's TLS fingerprint gets blocked by Reddit's Cloudflare layer.

### `/proxy/redgifs/*` → `media.redgifs.com`

Spoofs browser headers (`User-Agent`, `Referer`, `Origin`) and strips proxy-reveal headers that CDN77 bot detection rejects. Uses nginx's `slice` module to stream video in 1 MB chunks — each chunk is cached to disk and streamed to the client simultaneously (no buffer-then-serve delay). Cache TTL: 7 days.

### `/proxy/preview/*` → `preview.redd.it`

`preview.redd.it` sends no CORS headers. nginx injects `Access-Control-Allow-Origin: *` so the browser can render preview images and mp4 GIF variants.

### `/proxy/ext-preview/*` → `external-preview.redd.it`

Same as above. Only used in the download flow.

---

## Caching

Redgifs video slices are cached to disk via nginx's built-in `proxy_cache` (Docker named volume `redgifs-cache`). Max size: 5 GB, inactive eviction after 7 days. Cache status visible in the `X-Cache-Status` response header (`HIT` / `MISS`).

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

| Key             | Action                |
| --------------- | --------------------- |
| `j` / `↓`      | Next post             |
| `k` / `↑`      | Previous post         |
| `d` / `Ctrl+S` | Download current post |

### Bookmarks view

| Key        | Action                   |
| ---------- | ------------------------ |
| `j` / `↓` | Select next bookmark     |
| `k` / `↑` | Select previous bookmark |
| `Enter`    | Open selected bookmark   |

---

## License

[MIT](LICENSE)
