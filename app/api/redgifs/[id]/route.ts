import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync } from 'fs';
import { open, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';

// id is the PascalCase filename extracted from the CDN thumbnail URL
// e.g. "WiryGiddyWaterbuck" -> proxy https://media.redgifs.com/WiryGiddyWaterbuck.mp4

const UPSTREAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://www.redgifs.com/',
  'Origin': 'https://www.redgifs.com',
};

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cacheDir = process.env.MEDIA_CACHE_DIR;

  if (cacheDir) {
    mkdirSync(cacheDir, { recursive: true });
    const cachePath = join(cacheDir, `${id}.mp4`);

    if (!existsSync(cachePath)) {
      // Fetch full file from upstream and cache it
      const upstream = await fetch(`https://media.redgifs.com/${id}.mp4`, { headers: UPSTREAM_HEADERS });
      if (!upstream.ok) return new NextResponse(null, { status: upstream.status });
      await writeFile(cachePath, Buffer.from(await upstream.arrayBuffer()));
    }

    // Serve from cache with range support for seeking
    const { size } = await stat(cachePath);
    const rangeHeader = req.headers.get('range');

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : size - 1;
      const chunkSize = end - start + 1;

      const fd = await open(cachePath, 'r');
      const buf = Buffer.alloc(chunkSize);
      await fd.read(buf, 0, chunkSize, start);
      await fd.close();

      return new NextResponse(buf, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'video/mp4',
        },
      });
    }

    const buf = await readFile(cachePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
      },
    });
  }

  // No cache - stream proxy with range support
  const upstream = await fetch(`https://media.redgifs.com/${id}.mp4`, {
    headers: {
      ...UPSTREAM_HEADERS,
      ...(req.headers.get('range') ? { Range: req.headers.get('range')! } : {}),
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

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
