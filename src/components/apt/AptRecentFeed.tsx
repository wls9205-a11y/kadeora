'use client';
// s269: V1 통합 피드 컨테이너. 카테고리 chip + IntersectionObserver 무한 스크롤.
// Architecture Rule #14: 모든 hook 은 early return 위에.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AptFeedCard, { type FeedItem } from './AptFeedCard';

type Category = 'all' | 'subscription' | 'unsold' | 'redev';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all',          label: '전체' },
  { key: 'subscription', label: '청약' },
  { key: 'unsold',       label: '미분양' },
  { key: 'redev',        label: '재개발' },
];

type Props = {
  initialItems: FeedItem[];
  region: string;
};

export default function AptRecentFeed({ initialItems, region }: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [category, setCategory] = useState<Category>('all');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length >= 20);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (category === 'all') {
      setItems(initialItems);
      setHasMore(initialItems.length >= 20);
      return;
    }
    setLoading(true);
    fetch(`/api/apt/recent-feed?region=${encodeURIComponent(region)}&category=${category}&limit=20`)
      .then((r) => r.json())
      .then((res: { items?: FeedItem[] }) => {
        if (cancelled) return;
        const next = res.items ?? [];
        setItems(next);
        setHasMore(next.length >= 20);
      })
      .catch(() => { if (!cancelled) setHasMore(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, region, initialItems]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || items.length === 0) return;
    setLoading(true);
    try {
      const last = items[items.length - 1];
      const u = new URL('/api/apt/recent-feed', window.location.origin);
      u.searchParams.set('region', region);
      u.searchParams.set('category', category);
      u.searchParams.set('limit', '20');
      if (last?.created_at) u.searchParams.set('cursor', last.created_at);
      // s269b: composite cursor (created_at, id) — 동일 시각 bulk insert 안전.
      if (last?.id) u.searchParams.set('cursor_id', last.id);
      const res = await fetch(u.toString()).then((r) => r.json());
      const next: FeedItem[] = res?.items ?? [];
      if (next.length === 0) {
        setHasMore(false);
      } else {
        setItems((cur) => {
          const seen = new Set(cur.map((x) => x.id));
          const filtered = next.filter((x) => !seen.has(x.id));
          if (filtered.length === 0) { setHasMore(false); return cur; }
          return [...cur, ...filtered];
        });
        if (next.length < 20) setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [items, loading, hasMore, region, category]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const target = sentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [loadMore, hasMore]);

  const chipBar = useMemo(
    () => (
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 6px 10px', WebkitOverflowScrolling: 'touch' }}>
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              style={{
                fontSize: 13, padding: '6px 12px', borderRadius: 999,
                background: active ? 'var(--text-primary, #111827)' : 'transparent',
                color: active ? 'var(--bg-surface, #FFFFFF)' : 'var(--text-secondary, #6B7280)',
                border: active ? '1px solid var(--text-primary, #111827)' : '1px solid var(--border-base, #E5E7EB)',
                whiteSpace: 'nowrap', cursor: 'pointer',
                fontWeight: active ? 500 : 400,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    ),
    [category]
  );

  return (
    <section>
      {chipBar}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 6px 10px', fontSize: 12, color: 'var(--text-secondary, #6B7280)' }}>
        <span>최근 등록 · {region}</span>
        <span style={{ fontSize: 11 }}>최신순</span>
      </div>

      {items.length === 0 && !loading ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary, #9CA3AF)', fontSize: 13 }}>
          이 카테고리에 최근 등록된 단지가 없어요
        </div>
      ) : (
        <div style={{ padding: '0 6px' }}>
          {items.map((it, i) => <AptFeedCard key={it.id} item={it} priority={i < 2} />)}
        </div>
      )}

      <div ref={sentinelRef} style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary, #9CA3AF)' }}>
        {loading ? '불러오는 중...' : hasMore ? ' ' : '— 끝 —'}
      </div>
    </section>
  );
}
