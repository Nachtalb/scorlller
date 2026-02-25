# Scrolller

TikTok-style Reddit media viewer. Browse any subreddit as a vertical reel or grid gallery, with full support for Reddit videos, GIF-as-MP4, and Redgifs embeds.

## Features

- **Reel view** — full-screen vertical scroll through posts (touch, mouse wheel, or swipe)
- **Gallery view** — infinite-scroll grid of thumbnails
- **Starred subreddits** — star/unstar with persistent storage (IndexedDB)
- **Sort & filter** — hot / new / top (day · week · month · year · all) / rising
- **Redgifs support** — server-side proxy spoofs the correct `Referer` so Cloudflare-protected `.mp4` files load natively
- **Smart autoplay** — videos start muted in a browser tab (autoplay policy); installed as a PWA they honour your saved mute preference (unmuted by default)
- **Mute persistence** — preference saved to `localStorage` via Zustand, only in PWA mode
- **Position memory** — remembers which post you were on per subreddit

## Stack

| Layer | Library |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS |
| Carousel | Embla Carousel |
| State | Zustand (persist middleware) |
| Data fetching | TanStack Query v5 |
| Icons | Lucide React |
| Runtime | Bun |

## Getting started

```bash
bun install
bun run dev       # http://localhost:3000
```

## Production build

```bash
bun run build
bun run start
```

## Docker

```bash
docker build -t scrolller .
docker run -p 3000:3000 scrolller
```

Multi-stage build: Bun installs deps and builds, then a minimal `node:22-alpine` image runs the Next.js standalone output.

## API routes

| Route | Purpose |
|---|---|
| `GET /api/reddit/[[...path]]` | Proxy to `reddit.com` (adds `User-Agent`, bypasses CORS) |
| `GET /api/redgifs/[id]` | Proxy to `media.redgifs.com` (adds `Referer`, streams bytes with Range support) |

## Project structure

```
app/
  page.tsx            # root page — view switcher, subreddit state
  layout.tsx
  providers.tsx       # React Query provider
  api/
    reddit/           # Reddit proxy
    redgifs/          # Redgifs proxy
components/
  TopBar.tsx          # subreddit input, sort controls, star button
  BottomNav.tsx       # reel / gallery / starred tab bar
  ReelView.tsx        # full-screen vertical carousel
  GalleryView.tsx     # masonry-style infinite grid
hooks/
  useRedditPosts.ts   # infinite query + media normalisation
stores/
  useAppStore.ts      # Zustand store (current sub, sort, starred, mute, positions)
lib/
  db.ts               # IndexedDB helpers for starred subreddits
```
