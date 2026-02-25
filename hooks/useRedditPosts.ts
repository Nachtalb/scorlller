'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/useAppStore';

export interface MediaPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  url: string;
  thumbnail?: string;
  is_video: boolean;
  post_hint?: string;
  media?: any;
  preview?: any;
  score: number;
  num_comments: number;
  type: 'image' | 'video';
  src: string;
}

const isMediaPost = (p: any): boolean => {
  const u = p.url || '';
  return !!(p.is_video || p.post_hint === 'image' || p.post_hint === 'hosted:video' ||
    /\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i.test(u) || u.includes('v.redd.it') || u.includes('i.redd.it'));
};

const getMediaSrc = (p: any): {type: 'image' | 'video'; src: string} => {
  // 1. Reddit video (v.redd.it)
  if (p.is_video && p.media?.reddit_video?.fallback_url) {
    return { type: 'video', src: p.media.reddit_video.fallback_url };
  }

  // 2. Prefer MP4 variant for "GIF" posts (huge improvement)
  const mp4Variant = p.preview?.images?.[0]?.variants?.mp4?.source?.url;
  if (mp4Variant) {
    return { type: 'video', src: mp4Variant.replace(/&amp;/g, '&') };
  }

  // 3. Fallback to image (real GIFs or static)
  return { 
    type: 'image', 
    src: p.url || p.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '' 
  };
};

export function useRedditPosts() {
  const { currentSub, sort, timePeriod } = useAppStore();

  return useInfiniteQuery({
    queryKey: ['posts', currentSub, sort, timePeriod],
    queryFn: async ({ pageParam = '' }) => {
      let url = `/api/reddit/r/${currentSub}/${sort === 'top' ? `top?t=${timePeriod}` : sort}.json?limit=25`;
      if (pageParam) url += `&after=${pageParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = json.data.children.map((c: any) => c.data);
      const posts = raw.filter(isMediaPost).map((p: any) => ({ ...p, ...getMediaSrc(p) }));
      return { posts, after: json.data.after };
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.after,
  });
}