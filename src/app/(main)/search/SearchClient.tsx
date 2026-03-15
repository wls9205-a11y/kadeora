'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PostWithProfile } from '@/types/database';

const CATEGORY_MAP: Record<string, { label: string; bg: string; color: string }> = {
  stock:   { label: '주식',  bg: 'rgba(59,130,246,0.15)',  color: '#60A5FA' },
  apt:     { label: '청약',  bg: 'rgba(16,185,129,0.15)', color: '#34D399' },
  discuss: { label: '토론',  bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
  free:    { label: '자유',  bg: 'rgba(245,158,11,0.15)', color: '#FBBF24' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'rgba(59,130,246,0.3)', color: 'var(--kd-primary)', borderRadius: 2 }}>{p}</mark>
      : p
  );
}

export default function SearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQ);
  const [inputVal, setInputVal] = useState(initialQ);
  const [results, setResults] = useState<PostWithProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string, cat: string, offset: number, append = false) => {
    if (q.length < 2) { setResults([]); setTotal(0); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, category: cat, limit: '20', offset: String(offset * 20) });
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      setResults(prev => append ? [...prev, ...(data.results ?? [])] : (data.results ?? []));
      setTotal(data.total ?? 0);
      setHasMore((data.results?.length ?? 0) === 20);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      setResults([]);
      doSearch(inputVal, category, 0);
      setQuery(inputVal);
      if (inputVal) router.replace(`/search?q=${encodeURIComponent(inputVal)}`, { scroll: false });
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputVal, category, doSearch, router]);

  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        doSearch(query, category, nextPage, true);
      }
    }, { threshold: 0.1 });
    io.observe(loaderRef.current);
    return () => io.disconnect();
  }, [hasMore, loading, page, query, category, doSearch]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800, color: 'var(--kd-text)' }}>🔍 검색</h1>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder="검색어를 입력하세요 (2글자 이상)"
          className="kd-input"
          style={{ paddingLeft: 44, fontSize: 16, padding: '14px 14px 14px 44px' }}
          autoFocus
        />
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>🔍</span>
        {inputVal && (
          <button
            onClick={() => { setInputVal(''); setResults([]); setTotal(0); }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--kd-muted, #64748B)', cursor: 'pointer', fontSize: 18 }}
          >✕</button>
        )}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['all', '전체'], ['stock', '주식'], ['apt', '청약'], ['free', '자유']].map(([k, l]) => (
          <button key={k} onClick={() => { setCategory(k); setPage(0); }}
            style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: category === k ? 'var(--kd-primary)' : 'var(--kd-surface)',
              color: category === k ? 'white' : 'var(--kd-text-muted, #94A3B8)',
              border: `1px solid ${category === k ? 'var(--kd-primary)' : 'var(--kd-border)'}`,
              transition: 'all 0.15s',
            }}
          >{l}</button>
        ))}
      </div>

      {/* Results header */}
      {query.length >= 2 && (
        <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--kd-text-muted, #94A3B8)' }}>
          {loading && results.length === 0
            ? '검색 중...'
            : total > 0
              ? <><span style={{ color: 'var(--kd-text)', fontWeight: 700 }}>"{query}"</span> 검색 결과 <span style={{ color: 'var(--kd-primary)', fontWeight: 700 }}>{total.toLocaleString()}</span>건</>
              : <><span style={{ color: 'var(--kd-text)', fontWeight: 700 }}>"{query}"</span>에 대한 검색 결과가 없습니다</>
          }
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {results.map(post => {
          const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
          return (
            <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 12, padding: '16px 18px',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--kd-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--kd-border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, fontWeight: 700, background: cat.bg, color: cat.color }}>{cat.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--kd-text-muted, #64748B)' }}>{post.profiles?.nickname ?? '익명'} · {timeAgo(post.created_at)}</span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--kd-text)' }}>
                  {highlight(post.title, query)}
                </h3>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--kd-text-muted, #94A3B8)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {highlight(post.content.slice(0, 200), query)}
                </p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--kd-text-muted, #64748B)' }}>
                  <span>👁️ {post.view_count}</span>
                  <span>❤️ {post.likes_count}</span>
                  <span>💬 {post.comments_count}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Loader */}
      {hasMore && (
        <div ref={loaderRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
          {loading && (
            <div style={{ width: 24, height: 24, border: '2px solid var(--kd-border)', borderTopColor: 'var(--kd-primary)', borderRadius: '50%' }} className="animate-spin" />
          )}
        </div>
      )}

      {/* Empty state */}
      {query.length < 2 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--kd-text-muted, #64748B)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--kd-text)' }}>검색어를 입력해주세요</div>
          <div style={{ fontSize: 13 }}>주식, 청약, 재테크 관련 글을 검색할 수 있습니다</div>
        </div>
      )}
    </div>
  );
}