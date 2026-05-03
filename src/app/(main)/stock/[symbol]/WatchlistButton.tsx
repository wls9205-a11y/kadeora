'use client';
import { useState, useEffect } from 'react';
import { WatchButton } from '@/components/ui/ActionButtons';

export default function StockWatchlistButton({ symbol }: { symbol: string }) {
  const [watched, setWatched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/stock/watchlist')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.symbols?.includes(symbol)) setWatched(true); })
      .catch(() => {});
  }, [symbol]);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, action: watched ? 'remove' : 'add' }),
      });
      if (res.ok) setWatched(!watched);
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <WatchButton domain="stock" watched={watched} loading={loading} onClick={toggle} variant="inline" pointReward={50} />
  );
}
