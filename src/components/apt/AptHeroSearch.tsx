'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  region: string;
  sigungu: string | null;
}

export default function AptHeroSearch({ region, sigungu }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/apt/search?q=${encodeURIComponent(term)}&region=${encodeURIComponent(region)}${sigungu ? `&sigungu=${encodeURIComponent(sigungu)}` : ''}`);
  };

  return (
    <section
      aria-label="아파트 검색"
      style={{
        maxWidth: 720, margin: '12px auto 8px',
        padding: '0 var(--sp-lg)',
      }}
    >
      <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${sigungu ?? region} 단지·시공사·동 검색`}
          aria-label="검색"
          style={{
            flex: 1, padding: '12px 14px',
            fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 12,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '12px 18px', borderRadius: 12,
            fontSize: 13, fontWeight: 800,
            background: 'var(--brand)', color: 'var(--text-inverse, #fff)',
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >🔍 검색</button>
      </form>
    </section>
  );
}
