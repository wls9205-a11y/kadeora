'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PostWithProfile } from '@/types/database';

const CATEGORY_MAP: Record<string, { label: string; bg: string; color: string }> = {
  stock:   { label: '주식',  bg: 'var(--info-bg)',      color: 'var(--info)' },
  apt:     { label: '청약',  bg: 'var(--success-bg)',   color: 'var(--success)' },
  discuss: { label: '토론',  bg: 'var(--brand-light)',  color: 'var(--brand)' },
  free:    { label: '자유',  bg: 'var(--warning-bg)',   color: 'var(--warning)' },
};

interface StockResult {
  symbol: string;
  name: string;
  market: string;
  price: number;
  change_pct: number;
  currency?: string;
}

interface AptResult {
  id: string;
  house_nm: string;
  region_nm: string;
  rcept_bgnde: string;
  rcept_endde: string;
}

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
      ? <mark key={i} style={{ background: 'var(--info-bg)', color: 'var(--brand)', borderRadius: 2 }}>{p}</mark>
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

  // Autocomplete state
  const [acOpen, setAcOpen] = useState(false);
  const [acStocks, setAcStocks] = useState<StockResult[]>([]);
  const [acApts, setAcApts] = useState<AptResult[]>([]);
  const [acPosts, setAcPosts] = useState<PostWithProfile[]>([]);
  const [acLoading, setAcLoading] = useState(false);
  const acDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string, cat: string, offset: number, append = false) => {
    if (q.length < 2) { setResults([]); setTotal(0); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, category: cat, limit: '20', page: String(offset + 1) });
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      setResults(prev => append ? [...prev, ...(data.posts ?? [])] : (data.posts ?? []));
      setTotal(data.total ?? 0);
      setHasMore((data.posts?.length ?? 0) === 20);
    } finally {
      setLoading(false);
    }
  }, []);

  // Autocomplete fetch
  const fetchAutocomplete = useCallback(async (q: string) => {
    if (q.length < 2) {
      setAcStocks([]);
      setAcApts([]);
      setAcPosts([]);
      setAcOpen(false);
      return;
    }
    setAcLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      setAcStocks(data.stocks ?? []);
      setAcApts(data.apts ?? []);
      setAcPosts(data.posts ?? []);
      setAcOpen(true);
    } catch {
      setAcOpen(false);
    } finally {
      setAcLoading(false);
    }
  }, []);

  // Handle input change: trigger autocomplete with 300ms debounce
  const handleInputChange = useCallback((val: string) => {
    setInputVal(val);
    if (acDebounceRef.current) clearTimeout(acDebounceRef.current);
    acDebounceRef.current = setTimeout(() => {
      fetchAutocomplete(val);
    }, 300);
  }, [fetchAutocomplete]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setAcOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setAcOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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

  const handleAcNavigate = (href: string) => {
    setAcOpen(false);
    router.push(href);
  };

  const acSectionHeader = (label: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </div>
  );

  const acItemStyle: React.CSSProperties = {
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>🔍 검색</h1>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { if (inputVal.length >= 2) setAcOpen(true); }}
          placeholder="검색어를 입력하세요 (2글자 이상)"
          className="kd-input"
          style={{ paddingLeft: 44, fontSize: 16, padding: '14px 14px 14px 44px' }}
          autoFocus
        />
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>🔍</span>
        {inputVal && (
          <button
            onClick={() => { setInputVal(''); setResults([]); setTotal(0); setAcOpen(false); setAcStocks([]); setAcApts([]); setAcPosts([]); }}
            aria-label="검색어 지우기"
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}
          >✕</button>
        )}

        {/* Autocomplete dropdown */}
        {acOpen && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              zIndex: 500,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-lg)',
              marginTop: 4,
              maxHeight: 300,
              overflowY: 'auto' as const,
            }}
          >
            {acLoading && acStocks.length === 0 && acApts.length === 0 && acPosts.length === 0 && (
              <div style={{ padding: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              </div>
            )}

            {!acLoading && acStocks.length === 0 && acApts.length === 0 && acPosts.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>검색 결과가 없습니다</div>
            )}

            {/* Stocks section */}
            {acStocks.length > 0 && (
              <div>
                {acSectionHeader('종목')}
                {acStocks.map(stock => (
                  <div
                    key={stock.symbol}
                    style={acItemStyle}
                    onClick={() => handleAcNavigate(`/stock/${stock.symbol}`)}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{highlight(stock.name, inputVal)}</span>
                        {stock.currency === 'USD' && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 700, marginLeft: 4 }}>해외</span>}
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>{highlight(stock.symbol, inputVal)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>{stock.market}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{stock.currency === 'USD' ? `$${stock.price}` : `₩${stock.price?.toLocaleString()}`}</span>
                        {stock.change_pct != null && (
                          <span style={{ fontSize: 12, marginLeft: 6, color: stock.change_pct >= 0 ? 'var(--success)' : 'var(--error, #EF4444)', fontWeight: 600 }}>
                            {stock.change_pct >= 0 ? '+' : ''}{(stock.change_pct ?? 0).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Apts section */}
            {acApts.length > 0 && (
              <div>
                {acSectionHeader('청약')}
                {acApts.map(apt => (
                  <div
                    key={apt.id}
                    style={acItemStyle}
                    onClick={() => handleAcNavigate(`/apt/${apt.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{highlight(apt.house_nm, inputVal)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {highlight(apt.region_nm, inputVal)}
                      {apt.rcept_bgnde && <span style={{ marginLeft: 8 }}>{apt.rcept_bgnde} ~ {apt.rcept_endde}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Posts section */}
            {acPosts.length > 0 && (
              <div>
                {acSectionHeader('게시글')}
                {acPosts.map(post => {
                  const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
                  return (
                    <div
                      key={post.id}
                      style={acItemStyle}
                      onClick={() => handleAcNavigate(`/feed/${post.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 700, background: cat.bg, color: cat.color }}>{cat.label}</span>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {highlight(post.title, inputVal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['all', '전체'], ['stock', '주식'], ['apt', '청약'], ['free', '자유']].map(([k, l]) => (
          <button key={k} onClick={() => { setCategory(k); setPage(0); }}
            style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: category === k ? 'var(--brand)' : 'var(--bg-surface)',
              color: category === k ? 'var(--text-inverse)' : 'var(--text-secondary)',
              border: `1px solid ${category === k ? 'var(--brand)' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}
          >{l}</button>
        ))}
      </div>

      {/* Results header */}
      {query.length >= 2 && (
        <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
          {loading && results.length === 0
            ? '검색 중...'
            : total > 0
              ? <><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>&ldquo;{query}&rdquo;</span> 검색 결과 <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{total.toLocaleString()}</span>건</>
              : <><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>&ldquo;{query}&rdquo;</span>에 대한 검색 결과가 없습니다</>
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
                background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, fontWeight: 700, background: cat.bg, color: cat.color }}>{cat.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{post.profiles?.nickname ?? '익명'} · {timeAgo(post.created_at)}</span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {highlight(post.title, query)}
                </h3>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {highlight(post.content.slice(0, 200), query)}
                </p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
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
            <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%' }} className="animate-spin" />
          )}
        </div>
      )}

      {/* Empty state */}
      {query.length < 2 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>검색어를 입력해주세요</div>
          <div style={{ fontSize: 13 }}>주식, 청약, 재테크 관련 글을 검색할 수 있습니다</div>
        </div>
      )}
    </div>
  );
}
