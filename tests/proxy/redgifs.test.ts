/**
 * Tests for /proxy/redgifs/* → media.redgifs.com
 *
 * What we expect from the proxy:
 *  - Strips proxy-reveal headers (Via, X-Forwarded-*) — CDN77 bot detection rejects them
 *  - Spoofs Referer and Origin as redgifs.com
 *  - Rewrites Access-Control-Allow-Origin from "https://www.redgifs.com" to "*"
 *  - Strips Set-Cookie
 *  - Forwards Range requests transparently (Android Chrome sends Range: bytes=0- for all videos)
 *  - Second identical request hits Souin cache (Cache-Status: hit)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { BASE, REDGIFS_ID, REDGIFS_SIZE } from '../fixtures'

const URL = `${BASE}/proxy/redgifs/${REDGIFS_ID}.mp4`

describe('GET /proxy/redgifs/{id}.mp4', () => {
  it('returns 200', async () => {
    const res = await fetch(URL)
    expect(res.status).toBe(200)
  })

  it('returns Content-Type: video/mp4', async () => {
    const res = await fetch(URL)
    expect(res.headers.get('content-type')).toMatch(/video\/mp4/)
  })

  it('returns the full file (Content-Length matches known size)', async () => {
    const res = await fetch(URL)
    const len = Number(res.headers.get('content-length'))
    expect(len).toBe(REDGIFS_SIZE)
  })

  it('injects Access-Control-Allow-Origin: * (not locked to redgifs.com)', async () => {
    const res = await fetch(URL, { headers: { Origin: 'http://localhost:3001' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('strips Set-Cookie from response', async () => {
    const res = await fetch(URL)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('second request is served from Souin cache (Cache-Status: hit)', async () => {
    // First request populates the cache
    await fetch(URL)
    // Second request should hit
    const res = await fetch(URL)
    const cacheStatus = res.headers.get('cache-status') ?? ''
    expect(cacheStatus.toLowerCase()).toContain('hit')
  })
})

describe('Range requests through /proxy/redgifs/{id}.mp4', () => {
  it('Range: bytes=0- returns 206 with full body (Android Chrome pattern)', async () => {
    const res = await fetch(URL, { headers: { Range: 'bytes=0-' } })
    expect(res.status).toBe(206)
    const len = Number(res.headers.get('content-length'))
    expect(len).toBe(REDGIFS_SIZE)
  })

  it('Range: bytes=0-1023 returns 206 with exactly 1024 bytes', async () => {
    const res = await fetch(URL, { headers: { Range: 'bytes=0-1023' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe(`bytes 0-1023/${REDGIFS_SIZE}`)
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBe(1024)
  })

  it('Range: mid-file returns 206 with correct Content-Range', async () => {
    const start = 1048576
    const end   = 2097151
    const res = await fetch(URL, { headers: { Range: `bytes=${start}-${end}` } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe(`bytes ${start}-${end}/${REDGIFS_SIZE}`)
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBe(end - start + 1)
  })

  it('has Accept-Ranges: bytes header', async () => {
    const res = await fetch(URL)
    expect(res.headers.get('accept-ranges')).toBe('bytes')
  })
})

describe('GET /proxy/redgifs/{id}.mp4 — unknown ID', () => {
  it('returns 4xx for a nonexistent redgifs ID', async () => {
    const res = await fetch(`${BASE}/proxy/redgifs/ThisIdDefinitelyDoesNotExist12345.mp4`)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})
