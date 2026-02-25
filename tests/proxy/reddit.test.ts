/**
 * Tests for /proxy/reddit/* → www.reddit.com
 *
 * What we expect from the proxy:
 *  - Forwards request to Reddit using a browser UA (no UA → Reddit returns 403)
 *  - Injects Access-Control-Allow-Origin: * (Reddit omits it when Origin header is present)
 *  - Strips Set-Cookie from the response
 *  - Returns valid Reddit JSON structure
 */

import { describe, it, expect } from 'vitest'
import { BASE } from '../fixtures'

describe('GET /proxy/reddit/r/{sub}/{sort}.json', () => {
  it('returns 200 for a valid public subreddit', async () => {
    const res = await fetch(`${BASE}/proxy/reddit/r/earthporn/hot.json?limit=3`)
    expect(res.status).toBe(200)
  })

  it('returns valid Reddit JSON structure', async () => {
    const res = await fetch(`${BASE}/proxy/reddit/r/earthporn/hot.json?limit=3`)
    const json = await res.json() as { data?: { children?: unknown[]; after?: string } }
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('children')
    expect(Array.isArray(json.data?.children)).toBe(true)
    expect((json.data?.children ?? []).length).toBeGreaterThan(0)
  })

  it('returns Content-Type: application/json', async () => {
    const res = await fetch(`${BASE}/proxy/reddit/r/earthporn/hot.json?limit=1`)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
  })

  it('injects Access-Control-Allow-Origin: *', async () => {
    // Reddit does NOT return this header when an Origin is present — proxy must inject it
    const res = await fetch(`${BASE}/proxy/reddit/r/earthporn/hot.json?limit=1`, {
      headers: { Origin: 'http://localhost:3001' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('strips Set-Cookie from response', async () => {
    const res = await fetch(`${BASE}/proxy/reddit/r/earthporn/hot.json?limit=1`)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('passes query params through (limit, after, sort)', async () => {
    const res = await fetch(`${BASE}/proxy/reddit/r/earthporn/hot.json?limit=5`)
    const json = await res.json() as { data: { children: unknown[] } }
    expect(json.data.children.length).toBeLessThanOrEqual(5)
  })

  it('returns 404 for a nonexistent subreddit', async () => {
    const res = await fetch(`${BASE}/proxy/reddit/r/thissubredditshouldnot3xist99999/hot.json?limit=1`)
    expect(res.status).toBe(404)
  })
})

describe('GET /proxy/reddit/r/{sub}.json (subreddit validation)', () => {
  it('returns 200 for a valid subreddit', async () => {
    const res = await fetch(`${BASE}/proxy/reddit/r/earthporn.json?limit=1`)
    expect(res.status).toBe(200)
  })

  it('returns 404 for an invalid subreddit', async () => {
    const res = await fetch(`${BASE}/proxy/reddit/r/thissubredditshouldnot3xist99999.json?limit=1`)
    expect(res.status).toBe(404)
  })
})
