import { NextRequest, NextResponse } from 'next/server';

const USER_AGENT = 'Scrolller/1.0';

// Cache the temporary token in module scope — it lasts ~24h
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch('https://api.redgifs.com/v2/auth/temporary', {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`redgifs auth ${res.status}`);
  const data = await res.json();
  cachedToken = data.token as string;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23h
  return cachedToken;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const token = await getToken();

    const res = await fetch(`https://api.redgifs.com/v2/gifs/${id.toLowerCase()}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(`redgifs api ${res.status}`);

    const data = await res.json();
    const videoUrl: string = data.gif?.urls?.hd || data.gif?.urls?.sd;

    if (!videoUrl) throw new Error('no video url');

    return NextResponse.redirect(videoUrl, { status: 302 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'redgifs proxy failed' }, { status: 500 });
  }
}
