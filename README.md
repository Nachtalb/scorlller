# Scrolller

TikTok-style Reddit media viewer. Browse any subreddit as a vertical reel or a grid gallery.

## Usage

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), type any subreddit, and scroll.

## Docker

### Quick start (single container)

```bash
docker build -t scrolller .
docker run -p 3000:3000 scrolller
```

### Docker Compose (with nginx + media cache)

```bash
docker compose up -d
```

The compose setup runs two services:

| Service | Port | Description                               |
| ------- | ---- | ----------------------------------------- |
| `app`   | 3001 | Next.js app (Bun runtime)                 |
| `nginx` | 80   | Reverse proxy with static asset caching   |

nginx caches `/_next/static/` assets for 1 year and `/static/` assets for 30 days, so only the first request hits the app.

### Environment variables

| Variable          | Default    | Description                                                                                                                                                                             |
| ----------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEDIA_CACHE_DIR` | *(unset)*  | Directory to cache proxied redgifs videos on disk. When set, videos are downloaded once and served from the local filesystem with range-request support. Unset to stream directly instead. |

Example in `docker-compose.yml`:

```yaml
environment:
  - MEDIA_CACHE_DIR=/cache/media
volumes:
  - ./media_cache:/cache/media
```

## Keyboard shortcuts

### Navigation

| Key        | Action                                    |
| ---------- | ----------------------------------------- |
| `r`        | Switch to Reels                           |
| `g`        | Switch to Gallery                         |
| `b`        | Switch to Bookmarks                       |
| `s` or `/` | Focus the subreddit search field          |
| `f`        | Toggle bookmark for the current subreddit |

### Reel view

| Key           | Action               |
| ------------- | -------------------- |
| `j` / `↓`    | Next post            |
| `k` / `↑`    | Previous post        |
| `d` / `Ctrl+S` | Download current post |

### Bookmarks view

| Key        | Action                    |
| ---------- | ------------------------- |
| `j` / `↓` | Select next bookmark      |
| `k` / `↑` | Select previous bookmark  |
| `Enter`    | Open selected bookmark    |

## License

[MIT](LICENSE)
