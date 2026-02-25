/**
 * Rewrites CDN URLs that lack CORS headers to go through Caddy proxy routes.
 *
 * i.redd.it                 → direct (has CORS)
 * v.redd.it                 → direct (has CORS)
 * preview.redd.it           → /proxy/preview/...         (no CORS upstream)
 * external-preview.redd.it  → /proxy/ext-preview/...     (partial CORS, unreliable for fetch)
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
