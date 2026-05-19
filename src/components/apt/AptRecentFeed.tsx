'use client';
// s269d V2: 2-col grid + 카테고리 chip + fresh 배너 + 무한 스크롤.
// Architecture Rule #14: 모든 hook unconditionally at top.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AptFeedCard, { type FeedItem } from './AptFeedCard';

export type FeedStats = {
  region: string;
  totals: { all: number; subscription: number; unsold: number; redev: number };
  fresh: { window: '24h' | '7d' | null; count: number };
};

type Category = 'all' | 'subscription' | 'unsold' | 'redev';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'subscription', label: '청약' },
  { key: 'unsold', label: '미분양' },
  { key: 'redev', label: '재개발' },
];

type Props = {
  initialItems: FeedItem[];
  region: string;
  stats?: FeedStats;
};

export default function AptRecentFeed({ initialItems, region, stats }: Props) {
  const [category, setCategory] = useState<Category>('all');
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const seenIds = useRef<Set<string>>(new Set(initialItems.map(i => i.id)));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (category === 'all') {
      setItems(initialItems);
      seenIds.current = new Set(initialItems.map(i => i.id));
      setDone(initialItems.length === 0);
    } else {
      const filtered = initialItems.filter(i => i.section === category);
      setItems(filtered);
      seenIds.current = new Set(filtered.map(i => i.id));
      setDone(false);
    }
  }, [category, initialItems]);

  const fetchMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const last = items[items.length - 1];
      const params = new URLSearchParams({
        region, category, limit: '20',
      });
      if (last?.created_at) params.set('cursor', last.created_at);
      if (last?.id) params.set('cursor_id', last.id);
      const res = await fetch(`/api/apt/recent-feed?${params}`);
      const data = await res.json();
      const next = (data?.items ?? []) as FeedItem[];
      const fresh = next.filter(i => !seenIds.current.has(i.id));
      fresh.forEach(i => seenIds.current.add(i.id));
      setItems(prev => [...prev, ...fresh]);
      if (next.length === 0 || fresh.length === 0) setDone(true);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [items, region, category, loading, done]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) fetchMore(); },
      { rootMargin: '120px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchMore]);

  const chipBar = useMemo(() => (
    <div style={{
      display: 'flex', gap: 5, overflowX: 'auto',
      padding: '10px 6px 4px', WebkitOverflowScrolling: 'touch',
    }}>
      {CATEGORIES.map(c => {
        const active = category === c.key;
        const count = stats ? (stats.totals as Record<string, number>)[c.key] ?? 0 : null;
        return (
          <button key={c.key} type="button"
            onClick={() => setCategory(c.key)}
            style={{
              fontSize: 11.5, padding: '4px 10px', borderRadius: 999,
              background: active ? 'var(--text-primary, #111827)' : 'transparent',
              color: active ? 'var(--bg-surface, #FFFFFF)' : 'var(--text-secondary, #6B7280)',
              border: '0.5px solid',
              borderColor: active ? 'var(--text-primary, #111827)' : 'var(--border-base, #E5E7EB)',
              whiteSpace: 'nowrap', cursor: 'pointer',
              fontWeight: active ? 500 : 400,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            {c.label}
            {count !== null && (
              <span style={{ fontSize: 10, opacity: active ? 0.7 : 0.55, fontWeight: 400 }}>
                {count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  ), [category, stats]);

  return (
    <section>
      {stats && stats.fresh.window && stats.fresh.count > 0 && (
        <div style={{
          margin: '4px 6px 0', padding: '8px 12px',
          fontSize: 11.5, color: '#0F6E56',
          background: '#E1F5EE', borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 12 }}>✨</span>
          <span>
            최근 {stats.fresh.window === '24h' ? '24시간' : '7일'}{' '}
            <strong style={{ color: '#04342C', fontWeight: 500 }}>{stats.fresh.count}건</strong> 신규 등록
          </span>
        </div>
      )}
      {chipBar}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 8px 8px', fontSize: 10.5, color: 'var(--text-tertiary, #9CA3AF)',
      }}>
        <span>최근 등록 · {region}</span>
        <span>최신순</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 6px 10px',
      }}>
        {items.map(item => (
          <AptFeedCard key={item.id} item={item} />
        ))}
      </div>
      {items.length === 0 && (
        <div style={{
          padding: '40px 16px', textAlign: 'center',
          color: 'var(--text-tertiary, #9CA3AF)', fontSize: 13,
        }}>이 카테고리에 최근 등록된 단지가 없어요</div>
      )}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {loading && (
        <div style={{
          padding: '12px 16px', textAlign: 'center',
          color: 'var(--text-tertiary, #9CA3AF)', fontSize: 11.5,
        }}>불러오는 중…</div>
      )}
      {done && items.length > 0 && (
        <div style={{
          padding: '20px 16px', textAlign: 'center', fontSize: 11.5,
          color: 'var(--text-tertiary, #9CA3AF)',
        }}>— 끝 —</div>
      )}
    </section>
  );
}
