import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { useAppStore, useHasHydrated } from '@/stores/useAppStore'
import { useRedditPosts } from '@/hooks/useRedditPosts'
import ReelView from '@/components/ReelView'
import GalleryView from '@/components/GalleryView'
import BottomNav from '@/components/BottomNav'
import TopBar from '@/components/TopBar'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'

function Scrolller() {
  const hydrated = useHasHydrated()
  const { currentSub, bottomTab, setBottomTab, starred, lastPositions, initStarred, toggleStar } = useAppStore()
  const { data } = useRedditPosts()
  const posts = data?.pages.flatMap(p => p.posts) || []

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedStarredIdx, setSelectedStarredIdx] = useState(-1)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => { initStarred() }, [initStarred])

  useEffect(() => {
    const pos = lastPositions[currentSub]
    if (pos && posts.length > pos.index) setCurrentIndex(pos.index)
  }, [currentSub, posts.length])

  useEffect(() => {
    if (bottomTab !== 'starred') setSelectedStarredIdx(-1)
  }, [bottomTab])

  useEffect(() => {
    if (selectedStarredIdx >= 0) {
      itemRefs.current[selectedStarredIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedStarredIdx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'

      if (!isInput && (e.key === 's' || e.key === '/')) {
        e.preventDefault()
        document.getElementById('subreddit-input')?.focus()
        return
      }

      if (isInput) return

      if (e.key === 'r') { setBottomTab('reel'); return }
      if (e.key === 'g') { setBottomTab('gallery'); return }
      if (e.key === 'b') { setBottomTab('starred'); return }
      if (e.key === 'f') { toggleStar(currentSub); return }

      if (bottomTab === 'starred' && starred.length > 0) {
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedStarredIdx(i => Math.min(i + 1, starred.length - 1))
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedStarredIdx(i => Math.max(i - 1, 0))
        } else if (e.key === 'Enter' && selectedStarredIdx >= 0) {
          e.preventDefault()
          const sub = starred[selectedStarredIdx]
          useAppStore.getState().setCurrentSub(sub)
          setBottomTab(useAppStore.getState().lastContentTab)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bottomTab, starred, selectedStarredIdx, currentSub, setBottomTab, toggleStar])

  if (!hydrated) return null

  const openReelAt = (idx: number) => {
    useAppStore.getState().updateLastPosition(currentSub, idx, null)
    setCurrentIndex(idx)
    setBottomTab('reel')
  }

  if (bottomTab === 'starred') {
    return (
      <div className="min-h-screen p-4">
        <TopBar />
        <div className="pt-20 pb-20">
          <h2 className="text-2xl font-bold mb-6">Starred</h2>
          <div className="space-y-3">
            {starred.map((sub, idx) => (
              <div
                key={sub}
                ref={el => { itemRefs.current[idx] = el }}
                className={`px-6 py-4 rounded-2xl flex justify-between items-center transition-colors ${
                  idx === selectedStarredIdx ? 'bg-zinc-700 ring-1 ring-zinc-500' : 'bg-zinc-900'
                }`}
              >
                <span
                  onClick={() => { useAppStore.getState().setCurrentSub(sub); setBottomTab(useAppStore.getState().lastContentTab) }}
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
    )
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
  )
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 300000 } },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ServiceWorkerRegistrar />
      <PwaInstallPrompt />
      <Scrolller />
    </QueryClientProvider>
  )
}
