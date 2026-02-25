/**
 * Tests for CORS preflight (OPTIONS) across all proxy routes.
 *
 * Browsers send a preflight OPTIONS request before cross-origin fetches.
 * Caddy must respond with 204 + correct CORS headers before the actual
 * request is attempted — otherwise the browser aborts.
 */

import { describe, it, expect } from 'vitest'
import { BASE } from '../fixtures'

const PROXY_ROUTES = [
  '/proxy/reddit/r/earthporn/hot.json',
  '/proxy/redgifs/WiryGiddyWaterbuck.mp4',
  '/proxy/preview/somepath/file.jpg',
  '/proxy/ext-preview/somepath/file.jpg',
]

describe('OPTIONS preflight on all proxy routes', () => {
  for (const route of PROXY_ROUTES) {
    describe(`OPTIONS ${route}`, () => {
      it('returns 204 No Content', async () => {
        const res = await fetch(`${BASE}${route}`, { method: 'OPTIONS' })
        expect(res.status).toBe(204)
      })

      it('has Access-Control-Allow-Origin: *', async () => {
        const res = await fetch(`${BASE}${route}`, { method: 'OPTIONS' })
        expect(res.headers.get('access-control-allow-origin')).toBe('*')
      })

      it('has Access-Control-Allow-Methods containing GET', async () => {
        const res = await fetch(`${BASE}${route}`, { method: 'OPTIONS' })
        const methods = res.headers.get('access-control-allow-methods') ?? ''
        expect(methods).toContain('GET')
      })

      it('has Access-Control-Max-Age for caching preflight', async () => {
        const res = await fetch(`${BASE}${route}`, { method: 'OPTIONS' })
        const maxAge = res.headers.get('access-control-max-age')
        expect(maxAge).not.toBeNull()
        expect(Number(maxAge)).toBeGreaterThan(0)
      })
    })
  }
})

describe('SPA routes are NOT caught by OPTIONS handler', () => {
  it('OPTIONS / does not return 204 (served by file_server, not CORS handler)', async () => {
    const res = await fetch(`${BASE}/`, { method: 'OPTIONS' })
    // file_server doesn't handle OPTIONS the same way; it may return 200 or 405
    expect(res.status).not.toBe(204)
  })
})
