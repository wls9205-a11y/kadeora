'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Keyword { keyword: string; heat_score: number; category: string; rank: number; }

export default function TrendingKeywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  useEffect(() => {
    fetch('/api/public/trending').then(r => r.json()).then(d => setKeywords(d.data || [])).catch(() => {});
  }, []);
  if (!keywords.length) return null;

  const catColor: Record<string, string> = { stock: '#3B7BF6', apt: '#10B981', general: '#F59E0B' };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>🔥 실시간 트렌드</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {keywords.slice(0, 12).map((k, i) => (
          <Link key={i} href={`/search?q=${encodeURIComponent(k.keyword)}`} style={{
            padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600,
            background: (catColor[k.category] || '#888') + '12',
            color: catColor[k.category] || 'var(--text-secondary)',
            textDecoration: 'none', border: `1px solid ${(catColor[k.category] || '#888')}20`,
          }}>
            {k.rank <= 3 && <span style={{ marginRight: 3 }}>{k.rank === 1 ? '🥇' : k.rank === 2 ? '🥈' : '🥉'}</span>}
            {k.keyword}
          </Link>
        ))}
      </div>
    </div>
  );
}
