import { NextRequest, NextResponse } from 'next/server';

// id is the PascalCase filename extracted from the CDN thumbnail URL
// e.g. "WiryGiddyWaterbuck" -> proxy https://media.redgifs.com/WiryGiddyWaterbuck.mp4

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoUrl = `https://media.redgifs.com/${id}.mp4`;

  const upstream = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.redgifs.com/',
      'Origin': 'https://www.redgifs.com',
      ...(req.headers.get('range') ? { 'Range': req.headers.get('range')! } : {}),
    },
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse(null, { status: upstream.status });
  }

  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
