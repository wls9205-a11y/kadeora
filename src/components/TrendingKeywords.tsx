'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Keyword { keyword: string; rank?: number; }

export default function TrendingKeywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  useEffect(() => {
    fetch('/api/search/trending')
      .then(r => r.json())
      .then(d => {
        const kw = d?.keywords || d?.data || d || [];
        if (Array.isArray(kw)) setKeywords(kw.slice(0, 10).map((k: any, i: number) => ({
          keyword: k.keyword || k, rank: k.rank || i + 1,
        })));
      })
      .catch(() => {});
  }, []);

  if (!keywords.length) return null;

  return (
    <div style={{ marginTop: 'var(--sp-sm)', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>🔥 실시간 인기 검색어</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {keywords.map((k, i) => (
          <Link key={i} href={`/search?q=${encodeURIComponent(k.keyword)}`} style={{
            padding: '4px 10px', borderRadius: 'var(--radius-card)', fontSize: 11, fontWeight: 600,
            background: i < 3 ? 'var(--brand-bg)' : 'var(--bg-hover)',
            color: i < 3 ? 'var(--brand)' : 'var(--text-secondary)',
            textDecoration: 'none', border: '1px solid var(--border)',
            transition: 'all var(--transition-fast)',
          }}>
            <span style={{ marginRight: 3, fontWeight: 800, fontSize: 10 }}>{i + 1}</span>
            {k.keyword}
          </Link>
        ))}
      </div>
    </div>
  );
}
