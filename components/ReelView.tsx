'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import EmblaCarousel from 'embla-carousel-react';
import { useAppStore } from '@/stores/useAppStore';
import { useRedditPosts, MediaPost } from '@/hooks/useRedditPosts';
import { Download, Share2, Volume2, VolumeX, Loader2, SearchX, ArrowUp, MoveUpLeft, MoveDownRight } from 'lucide-react';

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}m`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}k`
  : String(n);

interface Props {
  posts: MediaPost[];
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
}

const WHEEL_THRESHOLD = 60; // px accumulated before snapping to next/prev

export default function ReelView({ posts, currentIndex, setCurrentIndex }: Props) {
  const [emblaRef, emblaApi] = EmblaCarousel({
    axis: 'y',
    loop: false,
    dragFree: false,
    containScroll: 'trimSnaps',
    inViewThreshold: 0.7,
    startIndex: currentIndex,
  });

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const wheelAccum = useRef(0);
  const wheelLocked = useRef(false);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const { updateLastPosition, currentSub, setMuted, actionPosition, setActionPosition } = useAppStore();

  // PWA (standalone) allows unmuted autoplay; regular browser tabs require muted
  const [isPWA] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
           !!(navigator as any).standalone;
  });

  // sessionMuted: PWA follows persisted preference (default unmuted); browser always starts muted
  const [sessionMuted, setSessionMuted] = useState<boolean>(() =>
    isPWA ? useAppStore.getState().muted : true
  );
  const sessionMutedRef = useRef(sessionMuted);
  sessionMutedRef.current = sessionMuted;
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useRedditPosts();

  const currentAfter = data?.pages[data.pages.length - 1]?.after || null;

  // Auto-load first page when opening Reel
  useEffect(() => {
    if (posts.length === 0 && hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [posts.length, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // Play current video, respecting session mute preference
  useEffect(() => {
    const v = videoRefs.current[currentIndex];
    if (v) {
      v.muted = sessionMutedRef.current;
      v.play().catch(() => {});
    }
  }, [currentIndex]);

  const handleSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    setCurrentIndex(idx);
    updateLastPosition(currentSub, idx, currentAfter);

    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === idx) {
        v.muted = sessionMuted;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });

    if (idx > posts.length - 5 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [emblaApi, setCurrentIndex, updateLastPosition, currentSub, currentAfter, sessionMuted, posts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', handleSelect);
    return () => { emblaApi.off('select', handleSelect); };
  }, [emblaApi, handleSelect]);

  // Mouse wheel navigation
  useEffect(() => {
    if (!emblaApi) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelLocked.current) return;

      wheelAccum.current += e.deltaY;

      if (Math.abs(wheelAccum.current) >= WHEEL_THRESHOLD) {
        wheelLocked.current = true;
        wheelAccum.current = 0;
        if (e.deltaY > 0) emblaApi.scrollNext();
        else emblaApi.scrollPrev();
        // unlock after animation settles
        setTimeout(() => { wheelLocked.current = false; }, 600);
      }
    };

    const node = emblaApi.rootNode();
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [emblaApi]);

  const toggleMute = (idx: number) => {
    const v = videoRefs.current[idx];
    if (v) {
      const next = !v.muted;
      v.muted = next;
      setSessionMuted(next);
      if (isPWA) setMuted(next);
    }
  };

  const handleSave = async (post: MediaPost) => {
    if (downloading.has(post.id)) return;
    setDownloading(prev => new Set(prev).add(post.id));

    let ext = post.type === 'video' ? 'mp4' : 'jpg';
    if (post.type === 'image') {
      const match = post.src.match(/\.(\w+)(?:\?|$)/i);
      if (match) ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    }

    // Route through server proxy so the download is same-origin
    // (cross-origin fetch + blob URL is the only reliable way to trigger a real download)
    const proxySrc = post.src.startsWith('/') ? post.src : `/api/download?url=${encodeURIComponent(post.src)}`;

    try {
      const response = await fetch(proxySrc, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${post.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      // Last resort: open in new tab so user can long-press save
      window.open(proxySrc, '_blank');
    } finally {
      setDownloading(prev => { const s = new Set(prev); s.delete(post.id); return s; });
    }
  };

  // Keyboard navigation: ↑/↓, j/k, Ctrl+S / d for download
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        emblaApi?.scrollNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        emblaApi?.scrollPrev();
      } else if ((e.ctrlKey && e.key === 's') || (!e.ctrlKey && !e.metaKey && e.key === 'd')) {
        e.preventDefault();
        const post = posts[currentIndex];
        if (post) handleSave(post);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [emblaApi, posts, currentIndex, handleSave]);

  const handleShare = async (post: MediaPost) => {
    const url = `https://reddit.com/r/${post.subreddit}/comments/${post.id}`;
    if (navigator.share) await navigator.share({ title: post.title, url });
    else navigator.clipboard.writeText(url);
  };

  if (isLoading || (posts.length === 0 && isFetchingNextPage)) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 size={36} className="animate-spin text-zinc-500" />
        <span className="text-zinc-500 text-sm">Loading r/{currentSub}...</span>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-3 px-6 text-center">
        <SearchX size={48} className="text-zinc-600" />
        <div className="text-xl font-medium text-zinc-300">No media found in r/{currentSub}</div>
        <div className="text-zinc-500 text-sm">Try another subreddit or change sort</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-black" ref={emblaRef}>
      <div className="embla__container flex flex-col h-full">
        {posts.map((post, idx) => {
          const isDownloading = downloading.has(post.id);
          const postUrl = `https://reddit.com/r/${post.subreddit}/comments/${post.id}`;
          return (
            <div
              key={post.id}
              className="flex-shrink-0 h-screen w-full relative bg-black flex items-center justify-center overflow-hidden"
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {post.type === 'video' ? (
                  <video
                    ref={el => { videoRefs.current[idx] = el; }}
                    src={post.src}
                    className="max-h-full max-w-full object-contain"
                    loop
                    playsInline
                    autoPlay
                    muted
                    onClick={() => toggleMute(idx)}
                  />
                ) : (
                  <img
                    src={post.src}
                    alt={post.title}
                    className="max-h-full max-w-full object-contain"
                    draggable={false}
                  />
                )}
              </div>

              {/* Action buttons — top-left floating or bottom-right overlay */}
              {actionPosition === 'top-left' && idx === currentIndex && (
                <div className="absolute top-16 left-3 z-50 flex flex-col gap-1 bg-black/60 backdrop-blur-md border border-zinc-700/50 rounded-2xl p-2">
                  <div className="flex flex-col items-center gap-1 px-2 py-1.5">
                    <ArrowUp size={22} className="text-zinc-300" />
                    <span className="text-[10px] text-zinc-300 font-medium">{fmt(post.score)}</span>
                  </div>
                  <button title="Download" onClick={() => handleSave(post)} disabled={isDownloading}
                    className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-zinc-700/50 transition-colors disabled:opacity-60">
                    {isDownloading ? <Loader2 size={22} className="animate-spin" /> : <Download size={22} />}
                  </button>
                  <button title="Share" onClick={() => handleShare(post)}
                    className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-zinc-700/50 transition-colors">
                    <Share2 size={22} />
                  </button>
                  {post.type === 'video' && (
                    <button title={sessionMuted ? 'Unmute' : 'Mute'} onClick={() => toggleMute(idx)}
                      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-zinc-700/50 transition-colors">
                      {sessionMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                    </button>
                  )}
                  <div className="border-t border-zinc-700/50 mt-1 pt-1">
                    <button title="Move to bottom-right" onClick={() => setActionPosition('bottom-right')}
                      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors w-full">
                      <MoveDownRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-20 pb-24 px-6">
                <div className="flex justify-between items-end gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-400">
                      <a
                        href={`https://reddit.com/r/${post.subreddit}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-zinc-200 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        r/{post.subreddit}
                      </a>
                      {' • '}
                      <a
                        href={`https://reddit.com/u/${post.author}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-zinc-200 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        u/{post.author}
                      </a>
                    </div>
                    <a
                      href={postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium leading-tight text-lg line-clamp-2 mt-1 hover:text-zinc-300 transition-colors block"
                      onClick={e => e.stopPropagation()}
                    >
                      {post.title}
                    </a>
                  </div>

                  {actionPosition === 'bottom-right' && (
                    <div className="flex flex-col gap-6 text-3xl">
                      <div className="flex flex-col items-center gap-1">
                        <ArrowUp size={28} className="text-zinc-300" />
                        <span className="text-xs text-zinc-300 font-medium">{fmt(post.score)}</span>
                      </div>
                      <button title="Download" onClick={() => handleSave(post)} disabled={isDownloading}
                        className="transition-all disabled:opacity-60">
                        {isDownloading ? <Loader2 size={28} className="animate-spin" /> : <Download size={28} />}
                      </button>
                      <button title="Share" onClick={() => handleShare(post)}><Share2 size={28} /></button>
                      {post.type === 'video' && (
                        <button title={idx === currentIndex && sessionMuted ? 'Unmute' : 'Mute'} onClick={() => toggleMute(idx)}>
                          {idx === currentIndex && sessionMuted ? <VolumeX size={28} /> : <Volume2 size={28} />}
                        </button>
                      )}
                      <button title="Move to top-left" onClick={() => setActionPosition('top-left')}
                        className="text-zinc-600 hover:text-zinc-400 transition-colors">
                        <MoveUpLeft size={24} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
