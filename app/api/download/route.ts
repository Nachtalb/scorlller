import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  // Only allow fetching from known media hosts
  let host: string;
  try { host = new URL(url).hostname; } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  const allowed = [
    'i.redd.it', 'preview.redd.it', 'external-preview.redd.it',
    'v.redd.it', 'media.redgifs.com', 'i.imgur.com', 'i.giphy.com',
  ];
  if (!allowed.some(h => host === h || host.endsWith('.' + h))) {
    log.warn(`download — blocked host: ${host}`);
    return new NextResponse('Host not allowed', { status: 403 });
  }

  log.info(`download ← ${host}${new URL(url).pathname}`);

  const t = Date.now();
  const upstream = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.reddit.com/',
    },
  });

  if (!upstream.ok) {
    log.error(`download — upstream ${upstream.status} for ${host}`);
    return new NextResponse(null, { status: upstream.status });
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const size = upstream.headers.get('content-length');
  log.ok(`download → ${host}${new URL(url).pathname} — ${contentType}${size ? ` ${(+size/1024).toFixed(0)}KB` : ''} (${Date.now()-t}ms)`);

  return new NextResponse(upstream.body, {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}
