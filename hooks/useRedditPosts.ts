import { useInfiniteQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/useAppStore';
import { proxyUrl } from '@/src/lib/proxy';

export interface MediaPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  url: string;
  thumbnail?: string;
  is_video: boolean;
  post_hint?: string;
  media?: unknown;
  preview?: unknown;
  score: number;
  num_comments: number;
  type: 'image' | 'video';
  src: string;
}

const isMediaPost = (p: Record<string, unknown>): boolean => {
  const u = (p.url as string) || '';
  const media = p.media as Record<string, unknown> | undefined;
  const secure_media = p.secure_media as Record<string, unknown> | undefined;
  const isRedgifs = media?.type === 'redgifs.com' || secure_media?.type === 'redgifs.com';
  return !!(p.is_video || p.post_hint === 'image' || p.post_hint === 'hosted:video' ||
    /\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i.test(u) || u.includes('v.redd.it') || u.includes('i.redd.it') ||
    isRedgifs);
};

const getMediaSrc = (p: Record<string, unknown>): { type: 'image' | 'video'; src: string } => {
  const media = p.media as Record<string, unknown> | undefined;
  const secure_media = p.secure_media as Record<string, unknown> | undefined;
  const preview = p.preview as Record<string, unknown> | undefined;

  // 1. Redgifs — extract PascalCase ID from oEmbed thumbnail URL, proxy through Caddy
  // thumbnail_url: https://media.redgifs.com/WiryGiddyWaterbuck-poster.jpg  -> id: WiryGiddyWaterbuck
  // proxy route:   /proxy/redgifs/WiryGiddyWaterbuck.mp4  (sets correct Referer, cached by Caddy)
  const rgOembed = (secure_media?.type === 'redgifs.com' && (secure_media?.oembed as Record<string, unknown>))
                || (media?.type === 'redgifs.com' && (media?.oembed as Record<string, unknown>));
  if (rgOembed && (rgOembed as Record<string, unknown>).thumbnail_url) {
    const thumbUrl = ((rgOembed as Record<string, unknown>).thumbnail_url as string);
    const m = thumbUrl.match(/\/([^/]+?)(?:-(?:poster|mobile|large|small))?\.[a-z]+$/i);
    if (m?.[1]) {
      return { type: 'video', src: `/proxy/redgifs/${m[1]}.mp4` };
    }
  }

  // 2. Reddit video (v.redd.it)
  const redditVideo = (media as Record<string, unknown> | undefined)?.reddit_video
                   || (secure_media as Record<string, unknown> | undefined)?.reddit_video;
  if (redditVideo && (redditVideo as Record<string, unknown>).fallback_url) {
    return { type: 'video', src: (redditVideo as Record<string, unknown>).fallback_url as string };
  }

  // 3. Prefer MP4 variant for "GIF" posts — may be preview.redd.it, route through proxy
  const images = (preview as Record<string, unknown> | undefined)?.images as unknown[];
  const mp4Variant = (images?.[0] as Record<string, unknown> | undefined)
    ?.variants as Record<string, unknown> | undefined;
  const mp4Source = mp4Variant?.mp4 as Record<string, unknown> | undefined;
  const mp4Url = (mp4Source?.source as Record<string, unknown> | undefined)?.url as string | undefined;
  if (mp4Url) {
    return { type: 'video', src: proxyUrl(mp4Url.replace(/&amp;/g, '&')) };
  }

  // 4. Bare v.redd.it URL (cross-posts)
  if (((p.url as string) || '').includes('v.redd.it')) {
    const id = (p.url as string).split('/').filter(Boolean).pop();
    return { type: 'video', src: `https://v.redd.it/${id}/DASH_720.mp4?source=fallback` };
  }

  // 5. Fallback to image — may be preview.redd.it, route through proxy
  const imgSource = (images?.[0] as Record<string, unknown> | undefined)
    ?.source as Record<string, unknown> | undefined;
  const fallbackUrl = (p.url as string)
    || (imgSource?.url as string | undefined)?.replace(/&amp;/g, '&')
    || '';
  return { type: 'image', src: proxyUrl(fallbackUrl) };
};

export function useRedditPosts() {
  const { currentSub, sort, timePeriod } = useAppStore();

  return useInfiniteQuery({
    queryKey: ['posts', currentSub, sort, timePeriod],
    queryFn: async ({ pageParam = '' }) => {
      const params = new URLSearchParams({ limit: '25' });
      if (sort === 'top') params.set('t', timePeriod);
      if (pageParam) params.set('after', String(pageParam));

      // Reddit JSON via Caddy proxy — www.reddit.com has no CORS headers for browser requests
      const url = `/proxy/reddit/r/${currentSub}/${sort}.json?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const json = await res.json() as { data: { children: { data: Record<string, unknown> }[]; after: string } };
      const raw = json.data.children.map(c => c.data);
      const posts = raw.filter(isMediaPost).map(p => ({ ...p, ...getMediaSrc(p) })) as MediaPost[];
      return { posts, after: json.data.after };
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.after,
  });
}
