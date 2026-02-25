'use client';

import { Home, LayoutGrid, Star } from 'lucide-react';
import { useAppStore, BottomTab } from '@/stores/useAppStore';

export default function BottomNav() {
  const { bottomTab, setBottomTab } = useAppStore();

  const tabs: { id: BottomTab; icon: React.ReactNode; label: string }[] = [
    { id: 'reel', icon: <Home size={24} />, label: 'Reels' },
    { id: 'gallery', icon: <LayoutGrid size={24} />, label: 'Gallery' },
    { id: 'starred', icon: <Star size={24} />, label: 'Starred' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 z-50">
      <div className="flex">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => {
              setBottomTab(t.id);
              if ((t.id === 'reel' || t.id === 'gallery') && bottomTab === t.id) {
                window.location.reload();
              }
            }}
            className={`flex-1 flex flex-col items-center gap-1 py-3 ${bottomTab === t.id ? 'text-blue-500' : 'text-zinc-400'}`}
          >
            {t.icon}
            <span className="text-xs">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
