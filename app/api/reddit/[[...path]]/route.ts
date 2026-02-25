import { NextRequest, NextResponse } from 'next/server';

const USER_AGENT = 'Scrolller/1.0 (+https://github.com/scrolller)';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  let pathStr = path.join('/');
  if (!pathStr.endsWith('.json')) pathStr += '.json';

  const url = new URL(req.url);
  const search = url.search;

  const redditUrl = `https://www.reddit.com/${pathStr}${search}`;

  try {
    const res = await fetch(redditUrl, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Reddit ${res.status}`);

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}