'use client';

import { Home, LayoutGrid, Star, PanelBottomOpen, PanelLeftOpen } from 'lucide-react';
import { useAppStore, BottomTab } from '@/stores/useAppStore';

export default function BottomNav() {
  const { bottomTab, setBottomTab, navPosition, setNavPosition } = useAppStore();

  const tabs: { id: BottomTab; icon: React.ReactNode; label: string }[] = [
    { id: 'reel', icon: <Home size={24} />, label: 'Reels' },
    { id: 'gallery', icon: <LayoutGrid size={24} />, label: 'Gallery' },
    { id: 'starred', icon: <Star size={24} />, label: 'Starred' },
  ];

  const handleTab = (id: BottomTab) => {
    setBottomTab(id);
    if ((id === 'reel' || id === 'gallery') && bottomTab === id) {
      window.location.reload();
    }
  };

  const togglePosition = () =>
    setNavPosition(navPosition === 'bottom' ? 'left' : 'bottom');

  if (navPosition === 'left') {
    return (
      <div className="fixed top-16 left-3 z-50 flex flex-col gap-1 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-2xl p-2 shadow-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
            title={t.label}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-colors ${
              bottomTab === t.id
                ? 'text-blue-500 bg-zinc-800'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {t.icon}
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
        <div className="border-t border-zinc-700 mt-1 pt-1">
          <button
            onClick={togglePosition}
            title="Move to bottom"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors w-full"
          >
            <PanelBottomOpen size={18} />
            <span className="text-[10px]">Bottom</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 z-50">
      <div className="flex">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 ${
              bottomTab === t.id ? 'text-blue-500' : 'text-zinc-400'
            }`}
          >
            {t.icon}
            <span className="text-xs">{t.label}</span>
          </button>
        ))}
        <button
          onClick={togglePosition}
          title="Move to left"
          className="px-4 flex flex-col items-center gap-1 py-3 text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <PanelLeftOpen size={24} />
          <span className="text-xs">Left</span>
        </button>
      </div>
    </div>
  );
}
