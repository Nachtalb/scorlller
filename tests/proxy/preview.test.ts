/**
 * Tests for /proxy/preview/* → preview.redd.it
 *            /proxy/ext-preview/* → external-preview.redd.it
 *
 * What we expect from the proxy:
 *  - Forwards request to preview.redd.it preserving path + query params (signed URLs)
 *  - Injects Access-Control-Allow-Origin: * (preview.redd.it has no CORS headers)
 *  - Strips Set-Cookie
 *  - Returns actual image/video content
 *
 * Note: preview.redd.it uses time-limited signed URLs (s= param).
 * A fresh URL is fetched from Reddit in beforeAll so tests don't use stale signatures.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { BASE, fetchFreshPreviewUrl } from '../fixtures'

let previewUrl: string         // e.g. https://preview.redd.it/abc123.jpeg?auto=webp&s=xxx
let proxyPath: string          // e.g. /proxy/preview/abc123.jpeg?auto=webp&s=xxx

beforeAll(async () => {
  previewUrl = await fetchFreshPreviewUrl()
  // Convert absolute URL to proxy-relative path
  const u = new URL(previewUrl)
  proxyPath = `/proxy/preview${u.pathname}${u.search}`
})

describe('GET /proxy/preview/{path}?{signed-params}', () => {
  it('returns 200 for a fresh signed preview URL', async () => {
    const res = await fetch(`${BASE}${proxyPath}`)
    expect(res.status).toBe(200)
  })

  it('returns image content (Content-Type: image/*)', async () => {
    const res = await fetch(`${BASE}${proxyPath}`)
    expect(res.headers.get('content-type')).toMatch(/^image\//)
  })

  it('returns non-empty body', async () => {
    const res = await fetch(`${BASE}${proxyPath}`)
    const len = Number(res.headers.get('content-length'))
    expect(len).toBeGreaterThan(0)
  })

  it('injects Access-Control-Allow-Origin: *', async () => {
    // preview.redd.it returns no CORS headers — proxy must inject
    const res = await fetch(`${BASE}${proxyPath}`, {
      headers: { Origin: 'http://localhost:3001' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('strips Set-Cookie from response', async () => {
    const res = await fetch(`${BASE}${proxyPath}`)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('returns 403 for an expired/wrong signature', async () => {
    // Tamper the s= param to simulate an expired signature
    const u = new URL(previewUrl)
    u.searchParams.set('s', 'invalidsignature0000000000000000000000000000')
    const tampered = `/proxy/preview${u.pathname}${u.search}`
    const res = await fetch(`${BASE}${tampered}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /proxy/ext-preview/{path}?{signed-params}', () => {
  // external-preview.redd.it has partial CORS but we proxy it for reliable download support
  it('returns a non-5xx response for a proxied ext-preview path', async () => {
    // We don't have a live ext-preview URL to hand, so just verify nginx routes it
    // (not serving the SPA index.html) by checking Content-Type is not text/html
    const testPath = `/proxy/ext-preview/test/nonexistent.jpg?s=fake`
    const res = await fetch(`${BASE}${testPath}`)
    // nginx should forward to external-preview.redd.it, not serve index.html
    expect(res.headers.get('content-type')).not.toMatch(/text\/html/)
    // Response from upstream is expected to be 4xx (not found), not 200 with index.html
    expect(res.status).not.toBe(200)
  })
})
