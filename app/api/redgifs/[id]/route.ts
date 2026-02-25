import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, createReadStream, createWriteStream } from 'fs';
import { stat, rename, unlink } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { log } from '@/lib/logger';

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
    const rangeStr = rangeHeader ? ` [${rangeHeader}]` : '';

    // Cache hit — stream from disk with range support
    if (existsSync(cachePath)) {
      const { size } = await stat(cachePath);
      log.hit(`redgifs ${id}${rangeStr} — serving from disk (${(size / 1024 / 1024).toFixed(1)}MB)`);

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
    if (rangeHeader) {
      log.miss(`redgifs ${id}${rangeStr} — range miss, proxying without cache`);
      const upstream = await fetch(`https://media.redgifs.com/${id}.mp4`, {
        headers: { ...UPSTREAM_HEADERS, Range: rangeHeader },
      });
      if (!upstream.ok && upstream.status !== 206) {
        log.error(`redgifs ${id} — upstream ${upstream.status}`);
        return new NextResponse(null, { status: upstream.status });
      }
      const headers = new Headers();
      for (const h of PASS_HEADERS) {
        const v = upstream.headers.get(h);
        if (v) headers.set(h, v);
      }
      return new NextResponse(upstream.body, { status: upstream.status, headers });
    }

    // Cache miss, full request — tee: serve client immediately + write to disk in background
    log.miss(`redgifs ${id} — fetching upstream + caching to disk`);
    const upstream = await fetch(`https://media.redgifs.com/${id}.mp4`, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok || !upstream.body) {
      log.error(`redgifs ${id} — upstream ${upstream.status}`);
      return new NextResponse(null, { status: upstream.status });
    }

    const [clientStream, diskStream] = upstream.body.tee();
    const tmpPath = `${cachePath}.tmp`;
    const contentLength = upstream.headers.get('content-length');
    const sizeStr = contentLength ? ` (${(+contentLength / 1024 / 1024).toFixed(1)}MB)` : '';
    log.info(`redgifs ${id} — teeing stream to client + disk${sizeStr}`);

    pipeline(Readable.fromWeb(diskStream as any), createWriteStream(tmpPath))
      .then(() => rename(tmpPath, cachePath))
      .then(() => log.ok(`redgifs ${id} — cached to disk`))
      .catch(async (e) => {
        log.error(`redgifs ${id} — disk write failed:`, e);
        try { await unlink(tmpPath); } catch {}
      });

    const resHeaders = new Headers({ 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' });
    if (contentLength) resHeaders.set('Content-Length', contentLength);

    return new NextResponse(clientStream, { status: 200, headers: resHeaders });
  }

  // No cache — stream proxy with range support
  const rangeHeader = req.headers.get('range');
  log.info(`redgifs ${id}${rangeHeader ? ` [${rangeHeader}]` : ''} — no-cache proxy`);

  const upstream = await fetch(`https://media.redgifs.com/${id}.mp4`, {
    headers: {
      ...UPSTREAM_HEADERS,
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    },
  });

  if (!upstream.ok && upstream.status !== 206) {
    log.error(`redgifs ${id} — upstream ${upstream.status}`);
    return new NextResponse(null, { status: upstream.status });
  }

  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
