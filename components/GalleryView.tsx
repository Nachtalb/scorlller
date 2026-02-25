'use client';

import { useAppStore } from '@/stores/useAppStore';
import { useRedditPosts } from '@/hooks/useRedditPosts';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import Masonry from 'react-masonry-css';

const BREAKPOINTS = { default: 5, 1280: 4, 1024: 3, 640: 2, 0: 1 };

export default function GalleryView({ onOpenReel }: { onOpenReel: (idx: number) => void }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useRedditPosts();
  const posts = data?.pages.flatMap(p => p.posts) || [];
  const { currentSub } = useAppStore();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Auto-load more until we have at least one media post
  useEffect(() => {
    if (posts.length === 0 && hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [posts.length, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // Infinite scroll: load next page when sentinel enters the viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading || (posts.length === 0 && isFetchingNextPage)) {
    return (
      <div className="pt-20 pb-24 px-4 h-screen overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[9/16] bg-zinc-900 rounded-2xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="pt-20 pb-24 flex flex-col items-center justify-center h-[calc(100vh-120px)] text-center px-6">
        <div className="text-6xl mb-6">📭</div>
        <div className="text-2xl font-medium mb-2">No media found in r/{currentSub}</div>
        <div className="text-zinc-400 mb-8">Try another subreddit or change sort</div>
        <button
          onClick={() => fetchNextPage()}
          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-24 px-4 overflow-y-auto h-screen">
      <Masonry breakpointCols={BREAKPOINTS} className="masonry-grid" columnClassName="masonry-grid_column">
        {posts.map((post, idx) => (
          <motion.div
            key={post.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => onOpenReel(idx)}
            className="rounded-2xl overflow-hidden bg-zinc-900 cursor-pointer relative"
          >
            {post.type === 'video' ? (
              <video
                src={post.src}
                className="w-full"
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={post.src}
                alt=""
                className="w-full"
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 p-3 text-xs">
              r/{post.subreddit}
            </div>
          </motion.div>
        ))}
      </Masonry>

      <div ref={sentinelRef} className="flex justify-center mt-8 pb-4">
        {isFetchingNextPage && <Loader2 size={24} className="animate-spin text-zinc-400" />}
        {!hasNextPage && posts.length > 0 && (
          <span className="text-zinc-600 text-sm">No more posts</span>
        )}
      </div>
    </div>
  );
}