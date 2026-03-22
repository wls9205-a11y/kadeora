'use client';
import { useState, useEffect } from 'react';

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
    <button onClick={toggle} disabled={loading} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 20,
      border: watched ? '1px solid var(--brand)' : '1px solid var(--border)',
      background: watched ? 'rgba(251,191,36,0.12)' : 'var(--bg-surface)',
      color: watched ? 'var(--brand)' : 'var(--text-secondary)',
      fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.6 : 1,
    }}>
      {watched ? '⭐ 관심종목' : '☆ 관심종목 추가'}
    </button>
  );
}
