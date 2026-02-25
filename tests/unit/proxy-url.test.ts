/**
 * Unit tests for proxyUrl()
 *
 * proxyUrl() rewrites CDN hostnames that lack browser CORS headers to go
 * through the Caddy proxy routes. Everything else passes through unchanged.
 */

import { describe, it, expect } from 'vitest'
import { proxyUrl } from '../../src/lib/proxy'

describe('proxyUrl() — hosts that need proxying', () => {
  it('rewrites preview.redd.it to /proxy/preview/...', () => {
    const url = 'https://preview.redd.it/abc123.jpeg?auto=webp&s=deadbeef'
    expect(proxyUrl(url)).toBe('/proxy/preview/abc123.jpeg?auto=webp&s=deadbeef')
  })

  it('preserves the full path and all query params for preview.redd.it', () => {
    const url = 'https://preview.redd.it/hash/file.jpg?width=640&format=pjpg&auto=webp&s=sig'
    expect(proxyUrl(url)).toBe('/proxy/preview/hash/file.jpg?width=640&format=pjpg&auto=webp&s=sig')
  })

  it('rewrites external-preview.redd.it to /proxy/ext-preview/...', () => {
    const url = 'https://external-preview.redd.it/abc.jpg?s=xyz'
    expect(proxyUrl(url)).toBe('/proxy/ext-preview/abc.jpg?s=xyz')
  })
})

describe('proxyUrl() — direct hosts (no proxy needed)', () => {
  it('leaves i.redd.it URLs unchanged (has CORS)', () => {
    const url = 'https://i.redd.it/abc123.jpeg'
    expect(proxyUrl(url)).toBe(url)
  })

  it('leaves v.redd.it URLs unchanged (has CORS)', () => {
    const url = 'https://v.redd.it/xyz/CMAF_720.mp4?source=fallback'
    expect(proxyUrl(url)).toBe(url)
  })

  it('leaves i.imgur.com URLs unchanged (has CORS)', () => {
    const url = 'https://i.imgur.com/abc.gif'
    expect(proxyUrl(url)).toBe(url)
  })

  it('leaves i.giphy.com URLs unchanged (has CORS)', () => {
    const url = 'https://i.giphy.com/media/abc/giphy.mp4'
    expect(proxyUrl(url)).toBe(url)
  })
})

describe('proxyUrl() — already-proxied paths', () => {
  it('leaves /proxy/redgifs/... unchanged (already a proxy path)', () => {
    // Relative URLs can't be parsed as URL() — should return as-is
    const src = '/proxy/redgifs/WiryGiddyWaterbuck.mp4'
    expect(proxyUrl(src)).toBe(src)
  })

  it('leaves /proxy/preview/... unchanged (idempotent)', () => {
    const src = '/proxy/preview/abc.jpg?s=sig'
    expect(proxyUrl(src)).toBe(src)
  })
})

describe('proxyUrl() — edge cases', () => {
  it('returns non-URL strings unchanged', () => {
    expect(proxyUrl('not-a-url')).toBe('not-a-url')
  })

  it('returns empty string unchanged', () => {
    expect(proxyUrl('')).toBe('')
  })

  it('returns undefined-ish values unchanged', () => {
    expect(proxyUrl('undefined')).toBe('undefined')
  })
})
