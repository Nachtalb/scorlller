import { log } from '@/lib/logger';

const TEST_URL = 'https://www.reddit.com/r/pics/hot.json?limit=1';
const USER_AGENT = 'Scrolller/1.0 (+https://github.com/scrolller)';

export async function register() {
  // Only run in the Node/Bun server runtime, not during edge/build
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  log.info('────────────────────────────────────────');
  log.info(`Scrolller starting up — build ${process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'dev'}`);

  // ── Config dump ──────────────────────────────────────────────────────────
  const cacheDir = process.env.MEDIA_CACHE_DIR;
  if (cacheDir) {
    log.info(`MEDIA_CACHE_DIR  : ${cacheDir}`);
  } else {
    log.warn('MEDIA_CACHE_DIR  : not set — redgifs videos will not be cached to disk');
  }
  log.info(`PORT             : ${process.env.PORT ?? 3000}`);
  log.info(`NODE_ENV         : ${process.env.NODE_ENV}`);

  // ── Reddit connectivity check ────────────────────────────────────────────
  log.info('Checking Reddit API connectivity...');
  try {
    const t = Date.now();
    const res = await fetch(TEST_URL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log.warn(`Reddit API check failed — HTTP ${res.status}`);
      if (body) log.warn('Response:', body.slice(0, 200));
      log.warn('This IP may be blocked by Reddit. Requests will likely fail at runtime.');
    } else {
      const data = await res.json();
      const sub = data?.data?.children?.[0]?.data?.subreddit ?? '?';
      log.ok(`Reddit API reachable — ${res.status} in ${Date.now() - t}ms (r/${sub})`);
    }
  } catch (e: any) {
    log.warn('Reddit API check failed —', e?.message ?? e);
    log.warn('Network error or timeout — starting anyway, requests may fail.');
  }

  log.info('────────────────────────────────────────');
}
