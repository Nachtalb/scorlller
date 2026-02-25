'use client';

import { Star, Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useState, useEffect } from 'react';

export default function TopBar() {
  const { 
    currentSub, 
    setCurrentSub, 
    toggleStar, 
    starred, 
    sort, 
    setSort, 
    timePeriod, 
    setTimePeriod,
    setBottomTab 
  } = useAppStore();

  const [inputValue, setInputValue] = useState(currentSub);
  const [validation, setValidation] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const isStarred = starred.includes(currentSub.toLowerCase());

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setInputValue(currentSub); }, [currentSub]);

  useEffect(() => {
    if (inputValue === currentSub || !inputValue.trim()) {
      setValidation('idle');
      return;
    }
    setValidation('checking');
    const timer = setTimeout(async () => {
      const clean = inputValue.toLowerCase().replace(/^r\//, '').trim();
      try {
        const res = await fetch(`/api/reddit/r/${clean}.json?limit=1`);
        setValidation(res.ok ? 'valid' : 'invalid');
      } catch { setValidation('invalid'); }
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, currentSub]);

  const handleSubmit = async () => {
    const clean = inputValue.toLowerCase().replace(/^r\//, '').trim();
    if (!clean) return;

    setValidation('checking');
    const res = await fetch(`/api/reddit/r/${clean}.json?limit=1`);
    
    if (res.ok) {
      setCurrentSub(inputValue);
      setError('');
      setValidation('valid');
      setBottomTab(useAppStore.getState().lastContentTab);
    } else {
      setError(`r/${clean} doesn't exist`);
      setValidation('invalid');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center gap-3" suppressHydrationWarning>
        <div className="relative flex-1">
          <input
            type="text"
            value={mounted ? inputValue : currentSub}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-zinc-900 border border-zinc-700 rounded-full px-4 py-1 w-full text-sm focus:outline-none focus:border-blue-500"
            placeholder="subreddit"
            data-protonpass="not-allowed"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {validation === 'checking' && <Loader2 size={16} className="animate-spin text-zinc-400" />}
            {validation === 'valid' && <CheckCircle size={16} className="text-green-500" />}
            {validation === 'invalid' && <XCircle size={16} className="text-red-500" />}
          </div>
        </div>

        <button title="Search" onClick={handleSubmit} className="p-2 text-zinc-400 hover:text-white">
          <Search size={20} />
        </button>

        <button title={isStarred ? 'Unstar subreddit' : 'Star subreddit'} onClick={() => toggleStar(currentSub)} className={`p-2 ${isStarred ? 'text-yellow-400' : 'text-zinc-400'}`}>
          <Star size={20} fill={isStarred ? 'currentColor' : 'none'} />
        </button>

        <select title="Sort" value={sort} onChange={e => setSort(e.target.value as any)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1 text-sm">
          {['hot', 'new', 'top', 'rising'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {sort === 'top' && (
          <select title="Time period" value={timePeriod} onChange={e => setTimePeriod(e.target.value as any)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1 text-sm">
            {['day', 'week', 'month', 'year', 'all'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-6 py-2 rounded-full z-50">
          {error}
        </div>
      )}
    </>
  );
}