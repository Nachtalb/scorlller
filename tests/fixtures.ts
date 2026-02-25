/**
 * Shared test fixtures.
 * Live URLs are fetched once from Reddit so signed s= params are fresh.
 */

export const BASE = process.env.PROXY_BASE ?? 'http://localhost:3001'

// Known-stable redgifs ID (verified working, large enough for range tests)
export const REDGIFS_ID = 'WiryGiddyWaterbuck'
export const REDGIFS_SIZE = 12091579  // bytes, confirmed via HEAD

// Fetch a fresh preview.redd.it URL from Reddit (signed URLs expire)
export async function fetchFreshPreviewUrl(): Promise<string> {
  const res = await fetch('https://www.reddit.com/r/earthporn/hot.json?limit=5', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  })
  if (!res.ok) throw new Error(`Reddit API returned ${res.status}`)
  const json = await res.json() as { data: { children: { data: Record<string, unknown> }[] } }

  for (const { data: post } of json.data.children) {
    const preview = post.preview as Record<string, unknown> | undefined
    const images = preview?.images as Record<string, unknown>[] | undefined
    const source = images?.[0]?.source as Record<string, unknown> | undefined
    const url = source?.url as string | undefined
    if (url?.includes('preview.redd.it')) {
      return url.replace(/&amp;/g, '&')
    }
  }
  throw new Error('No preview.redd.it URL found in earthporn feed')
}

// Fetch a fresh i.redd.it URL
export async function fetchFreshIReddItUrl(): Promise<string> {
  const res = await fetch('https://www.reddit.com/r/earthporn/hot.json?limit=5', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  })
  if (!res.ok) throw new Error(`Reddit API returned ${res.status}`)
  const json = await res.json() as { data: { children: { data: Record<string, unknown> }[] } }

  for (const { data: post } of json.data.children) {
    const url = post.url as string | undefined
    if (url?.includes('i.redd.it')) return url
  }
  throw new Error('No i.redd.it URL found in earthporn feed')
}
