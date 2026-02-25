'use client';

import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getStarred, saveStarred } from '@/lib/db';

export type SortType = 'hot' | 'new' | 'top' | 'rising';
export type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all';
export type BottomTab = 'reel' | 'gallery' | 'starred';
export type ActionPosition = 'bottom-right' | 'top-left';

interface LastPosition { index: number; after: string | null; }

interface AppStore {
  currentSub: string;
  sort: SortType;
  timePeriod: TimePeriod;
  bottomTab: BottomTab;
  lastContentTab: 'reel' | 'gallery';
  starred: string[];
  lastPositions: Record<string, LastPosition>;
  muted: boolean;
  actionPosition: ActionPosition;

  setCurrentSub: (sub: string) => void;
  setSort: (s: SortType, p?: TimePeriod) => void;
  setTimePeriod: (p: TimePeriod) => void;
  setBottomTab: (t: BottomTab) => void;
  toggleStar: (sub: string) => Promise<void>;
  updateLastPosition: (sub: string, idx: number, aft: string | null) => void;
  resetPosition: (sub: string) => void;
  initStarred: () => Promise<void>;
  setMuted: (m: boolean) => void;
  setActionPosition: (p: ActionPosition) => void;
}

/** true once Zustand has rehydrated state from localStorage */
export const useHasHydrated = () => {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    // already hydrated (fast path)
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      currentSub: 'memes',
      sort: 'hot',
      timePeriod: 'day',
      bottomTab: 'reel',
      lastContentTab: 'reel',
      starred: [],
      lastPositions: {},
      muted: false,
      actionPosition: 'bottom-right',

      setCurrentSub: (sub) => {
        const clean = sub.toLowerCase().replace(/^r\//, '').trim();
        if (clean) set({ currentSub: clean });
      },
      setSort: (s, p) => set({ sort: s, timePeriod: p ?? get().timePeriod }),
      setTimePeriod: (p) => set({ timePeriod: p }),
      setBottomTab: (t) => set(t === 'starred' ? { bottomTab: t } : { bottomTab: t, lastContentTab: t }),
      toggleStar: async (sub) => {
        const clean = sub.toLowerCase().replace(/^r\//, '').trim();
        const cur = get().starred;
        const newList = cur.includes(clean) ? cur.filter(s => s !== clean) : [...cur, clean].sort();
        set({ starred: newList });
        await saveStarred(newList);
      },
      updateLastPosition: (sub, idx, aft) => set(state => ({
        lastPositions: { ...state.lastPositions, [sub.toLowerCase()]: { index: idx, after: aft } }
      })),
      resetPosition: (sub) => set(state => {
        const key = sub.toLowerCase();
        const { [key]: _, ...rest } = state.lastPositions;
        return { lastPositions: rest };
      }),
      initStarred: async () => {
        const saved = await getStarred();
        set({ starred: saved });
      },
      setMuted: (m) => set({ muted: m }),
      setActionPosition: (p) => set({ actionPosition: p }),
    }),
    {
      name: 'scrolller-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentSub: state.currentSub,
        sort: state.sort,
        timePeriod: state.timePeriod,
        bottomTab: state.bottomTab,
        lastContentTab: state.lastContentTab,
        starred: state.starred,
        lastPositions: state.lastPositions,
        muted: state.muted,
        actionPosition: state.actionPosition,
      }),
    }
  )
);