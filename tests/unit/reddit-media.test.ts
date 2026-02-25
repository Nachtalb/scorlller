/**
 * Unit tests for isMediaPost() and getMediaSrc()
 *
 * These test the media classification and URL extraction logic
 * using mock Reddit post data. No network calls.
 */

import { describe, it, expect } from 'vitest'
import { isMediaPost, getMediaSrc } from '../../hooks/useRedditPosts'

// ─── Mock post builders ────────────────────────────────────────────────────────

const imagePost = (url: string, overrides: Record<string, unknown> = {}) => ({
  url,
  post_hint: 'image' as const,
  is_video: false,
  preview: {
    images: [{
      source: { url: `https://preview.redd.it/preview.jpeg?s=abc`, width: 1920, height: 1080 },
      variants: {},
    }],
  },
  ...overrides,
})

const redditVideoPost = (fallbackUrl: string) => ({
  url: 'https://v.redd.it/someid',
  post_hint: 'hosted:video' as const,
  is_video: true,
  media: {
    reddit_video: {
      fallback_url: fallbackUrl,
      dash_url: 'https://v.redd.it/someid/DASHPlaylist.mpd',
      is_gif: false,
    },
  },
  secure_media: null,
  preview: { images: [] },
})

const redgifsPost = (thumbnailUrl: string) => ({
  url: 'https://www.redgifs.com/watch/SomeCamelCaseId',
  post_hint: 'rich:video' as const,
  is_video: false,
  media: null,
  secure_media: {
    type: 'redgifs.com',
    oembed: {
      thumbnail_url: thumbnailUrl,
      type: 'video',
      provider_name: 'Redgifs',
    },
  },
  preview: { images: [] },
})

const gifMp4Post = (mp4Url: string) => ({
  url: 'https://i.imgur.com/something.gif',
  post_hint: 'image' as const,
  is_video: false,
  media: null,
  preview: {
    images: [{
      source: { url: 'https://preview.redd.it/img.gif?s=abc', width: 500, height: 300 },
      variants: {
        mp4: {
          source: { url: mp4Url, width: 500, height: 300 },
          resolutions: [],
        },
      },
    }],
  },
})

const selfPost = () => ({
  url: 'https://www.reddit.com/r/all/comments/abc/title/',
  post_hint: 'self' as const,
  is_video: false,
  media: null,
  preview: undefined,
})

const linkPost = () => ({
  url: 'https://example.com/some-article',
  post_hint: 'link' as const,
  is_video: false,
  media: null,
  preview: undefined,
})

// ─── isMediaPost ──────────────────────────────────────────────────────────────

describe('isMediaPost()', () => {
  it('accepts image posts (post_hint: image)', () => {
    expect(isMediaPost(imagePost('https://i.redd.it/abc.jpg'))).toBe(true)
  })

  it('accepts hosted video posts (post_hint: hosted:video, is_video: true)', () => {
    expect(isMediaPost(redditVideoPost('https://v.redd.it/id/CMAF_720.mp4?source=fallback'))).toBe(true)
  })

  it('accepts redgifs posts (secure_media.type: redgifs.com)', () => {
    expect(isMediaPost(redgifsPost('https://media.redgifs.com/WiryGiddyWaterbuck-poster.jpg'))).toBe(true)
  })

  it('accepts posts with .jpg extension in URL', () => {
    expect(isMediaPost({ url: 'https://i.redd.it/photo.jpg', is_video: false })).toBe(true)
  })

  it('accepts posts with .mp4 extension in URL', () => {
    expect(isMediaPost({ url: 'https://v.redd.it/video.mp4', is_video: false })).toBe(true)
  })

  it('accepts posts with .gif extension in URL', () => {
    expect(isMediaPost({ url: 'https://i.imgur.com/anim.gif', is_video: false })).toBe(true)
  })

  it('accepts posts from i.redd.it domain', () => {
    expect(isMediaPost({ url: 'https://i.redd.it/somefile', is_video: false })).toBe(true)
  })

  it('accepts posts from v.redd.it domain', () => {
    expect(isMediaPost({ url: 'https://v.redd.it/somevideo', is_video: false })).toBe(true)
  })

  it('rejects self posts', () => {
    expect(isMediaPost(selfPost())).toBe(false)
  })

  it('rejects link posts pointing to non-media URLs', () => {
    expect(isMediaPost(linkPost())).toBe(false)
  })

  it('rejects posts with no media indicators', () => {
    expect(isMediaPost({ url: 'https://example.com', post_hint: 'link', is_video: false })).toBe(false)
  })
})

// ─── getMediaSrc ──────────────────────────────────────────────────────────────

describe('getMediaSrc()', () => {
  describe('Redgifs posts', () => {
    it('extracts ID from thumbnail_url and returns /proxy/redgifs/{id}.mp4', () => {
      const post = redgifsPost('https://media.redgifs.com/WiryGiddyWaterbuck-poster.jpg')
      const result = getMediaSrc(post)
      expect(result.type).toBe('video')
      expect(result.src).toBe('/proxy/redgifs/WiryGiddyWaterbuck.mp4')
    })

    it('handles thumbnail URLs without a -poster suffix', () => {
      const post = redgifsPost('https://media.redgifs.com/SomeCamelCaseId.jpg')
      const result = getMediaSrc(post)
      expect(result.type).toBe('video')
      expect(result.src).toBe('/proxy/redgifs/SomeCamelCaseId.mp4')
    })

    it('handles thumbnail URLs with -mobile suffix', () => {
      const post = redgifsPost('https://media.redgifs.com/SomeCamelCaseId-mobile.jpg')
      const result = getMediaSrc(post)
      expect(result.type).toBe('video')
      expect(result.src).toBe('/proxy/redgifs/SomeCamelCaseId.mp4')
    })
  })

  describe('Reddit video posts', () => {
    it('returns the fallback_url directly (v.redd.it has CORS)', () => {
      const fallback = 'https://v.redd.it/someid/CMAF_720.mp4?source=fallback'
      const post = redditVideoPost(fallback)
      const result = getMediaSrc(post)
      expect(result.type).toBe('video')
      expect(result.src).toBe(fallback)
    })

    it('does NOT proxy v.redd.it through Caddy', () => {
      const post = redditVideoPost('https://v.redd.it/someid/CMAF_720.mp4?source=fallback')
      const result = getMediaSrc(post)
      expect(result.src).not.toContain('/proxy/')
    })
  })

  describe('GIF posts with mp4 variant', () => {
    it('returns mp4 variant URL through /proxy/preview/ (preview.redd.it has no CORS)', () => {
      const mp4Url = 'https://preview.redd.it/abc.gif?format=mp4&s=sig'
      const post = gifMp4Post(mp4Url)
      const result = getMediaSrc(post)
      expect(result.type).toBe('video')
      expect(result.src).toBe('/proxy/preview/abc.gif?format=mp4&s=sig')
    })

    it('decodes HTML entities in mp4 URLs (&amp; → &)', () => {
      const mp4Url = 'https://preview.redd.it/abc.gif?format=mp4&amp;s=sig'
      const post = gifMp4Post(mp4Url)
      const result = getMediaSrc(post)
      expect(result.src).not.toContain('&amp;')
      expect(result.src).toContain('&s=sig')
    })
  })

  describe('Image posts', () => {
    it('returns i.redd.it URL directly (has CORS, no proxy needed)', () => {
      const url = 'https://i.redd.it/abc123.jpeg'
      const post = imagePost(url)
      const result = getMediaSrc(post)
      expect(result.type).toBe('image')
      expect(result.src).toBe(url)
    })

    it('returns i.imgur.com URL directly (has CORS, no proxy needed)', () => {
      const url = 'https://i.imgur.com/abc.jpg'
      const post = { url, post_hint: 'image', is_video: false, media: null, preview: { images: [] } }
      const result = getMediaSrc(post)
      expect(result.type).toBe('image')
      expect(result.src).toBe(url)
    })

    it('rewrites preview.redd.it fallback images through /proxy/preview/', () => {
      const previewUrl = 'https://preview.redd.it/abc.jpeg?auto=webp&s=sig'
      const post = {
        url: '',
        post_hint: 'image',
        is_video: false,
        media: null,
        preview: {
          images: [{
            source: { url: previewUrl, width: 1920, height: 1080 },
            variants: {},
          }],
        },
      }
      const result = getMediaSrc(post)
      expect(result.type).toBe('image')
      expect(result.src).toBe('/proxy/preview/abc.jpeg?auto=webp&s=sig')
    })
  })
})
