import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, createReadStream, createWriteStream } from 'fs';
import { stat, rename, unlink } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

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
    const rangeHeader = req.headers.get('range');

    // Cache hit — stream from disk with range support
    if (existsSync(cachePath)) {
      const { size } = await stat(cachePath);

      if (rangeHeader) {
        const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : size - 1;
        const stream = createReadStream(cachePath, { start, end });
        return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(end - start + 1),
            'Content-Type': 'video/mp4',
          },
        });
      }

      const stream = createReadStream(cachePath);
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(size),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    // Cache miss with range request — stream from upstream directly, skip caching
    // (range requests happen during seeking; by then the file is likely already cached)
    if (rangeHeader) {
      const upstream = await fetch(`https://media.redgifs.com/${id}.mp4`, {
        headers: { ...UPSTREAM_HEADERS, Range: rangeHeader },
      });
      if (!upstream.ok && upstream.status !== 206) return new NextResponse(null, { status: upstream.status });
      const headers = new Headers();
      for (const h of PASS_HEADERS) {
        const v = upstream.headers.get(h);
        if (v) headers.set(h, v);
      }
      return new NextResponse(upstream.body, { status: upstream.status, headers });
    }

    // Cache miss, full request — tee: serve client immediately + write to disk in background
    const upstream = await fetch(`https://media.redgifs.com/${id}.mp4`, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok || !upstream.body) return new NextResponse(null, { status: upstream.status });

    const [clientStream, diskStream] = upstream.body.tee();
    const tmpPath = `${cachePath}.tmp`;

    // Background write: stream → tmp file → atomic rename to final path
    pipeline(Readable.fromWeb(diskStream as any), createWriteStream(tmpPath))
      .then(() => rename(tmpPath, cachePath))
      .catch(async () => {
        try { await unlink(tmpPath); } catch {}
      });

    const resHeaders = new Headers({ 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' });
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) resHeaders.set('Content-Length', contentLength);

    return new NextResponse(clientStream, { status: 200, headers: resHeaders });
  }

  // No cache — stream proxy with range support
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
