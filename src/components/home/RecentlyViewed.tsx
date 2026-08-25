'use client';

// C-0 블록 3 — 「최근 본 현장」 칩 3개.
//
// ⚠️ 저장된 게 없으면 **섹션 자체를 그리지 않는다**(null 반환). 첫 방문자에게
//    「최근 본 현장 없음」 빈 상자를 보여 주면 화면 맨 위가 죽은 자리가 된다.
//
// ⚠️ 첫 렌더에서 localStorage 를 읽지 않는다. 서버 HTML 에는 이 블록이 없으므로
//    클라이언트가 곧바로 칩을 그리면 하이드레이션이 어긋난다.
//    mount 후 useEffect 에서 한 번 읽는다.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readRecentSites, type RecentSite } from '@/lib/apt/recent-sites';

export default function RecentlyViewed({ limit = 3 }: { limit?: number }) {
  const [items, setItems] = useState<RecentSite[]>([]);

  useEffect(() => {
    setItems(readRecentSites(limit));
  }, [limit]);

  if (items.length === 0) return null;

  return (
    <section aria-label="최근 본 현장" style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-tertiary)',
          letterSpacing: 0.3,
          padding: '0 3px',
          marginBottom: 6,
        }}
      >
        최근 본 현장
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 3px' }}>
        {items.map((r) => (
          <Link
            key={r.slug}
            href={`/apt/${encodeURIComponent(r.slug)}`}
            style={{
              maxWidth: '100%',
              padding: '5px 10px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {r.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
