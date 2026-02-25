'use client';

import { useState, useEffect } from 'react';
import { useAppStore, useHasHydrated } from '@/stores/useAppStore';
import { useRedditPosts } from '@/hooks/useRedditPosts';
import ReelView from '@/components/ReelView';
import GalleryView from '@/components/GalleryView';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';

export default function Scrolller() {
  const hydrated = useHasHydrated();
  const { currentSub, bottomTab, setBottomTab, starred, lastPositions, initStarred } = useAppStore();
  const { data } = useRedditPosts();
  const posts = data?.pages.flatMap(p => p.posts) || [];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    initStarred();
  }, [initStarred]);

  useEffect(() => {
    const pos = lastPositions[currentSub];
    if (pos && posts.length > pos.index) setCurrentIndex(pos.index);
  }, [currentSub, posts.length]);

  // Don't render until Zustand has rehydrated from localStorage
  if (!hydrated) return null;

  const openReelAt = (idx: number) => {
    useAppStore.getState().updateLastPosition(currentSub, idx, null);
    setCurrentIndex(idx);
    setBottomTab('reel');
  };

  if (bottomTab === 'starred') {
    return (
      <div className="min-h-screen p-4">
        <TopBar />
        <div className="pt-20 pb-20">
          <h2 className="text-2xl font-bold mb-6">Starred</h2>
          <div className="space-y-3">
            {starred.map(sub => (
              <div
                key={sub}
                className="bg-zinc-900 px-6 py-4 rounded-2xl flex justify-between items-center"
              >
                <span
                  onClick={() => { useAppStore.getState().setCurrentSub(sub); setBottomTab('reel'); }}
                  className="flex-1 cursor-pointer active:scale-95 transition-transform"
                >
                  r/{sub}
                </span>
                <button onClick={() => useAppStore.getState().toggleStar(sub)} className="text-red-500 text-sm">Remove</button>
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden relative">
      <TopBar />
      {bottomTab === 'reel' ? (
        <ReelView posts={posts} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} />
      ) : (
        <GalleryView onOpenReel={openReelAt} />
      )}
      <BottomNav />
    </div>
  );
}