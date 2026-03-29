'use client';
import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { fmtAmount } from '@/lib/format';

interface Complex {
  aptName: string;
  sigungu: string;
  region: string;
  builtYear: number;
  saleCount: number;
  lastPrice: number;
  jeonse: number;
  monthly: number;
  monthlyRent: number;
  ageGroup: string;
  jeonseRatio: number | null;
}

// 전세가율 게이지
function RatioGauge({ ratio }: { ratio: number | null }) {
  if (!ratio) return null;
  const color = ratio > 80 ? '#ef4444' : ratio > 60 ? '#f59e0b' : '#22c55e';
  const pct = Math.min(ratio, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32, textAlign: 'right' }}>{ratio}%</span>
    </div>
  );
}

export default function ComplexClient({ complexes, ageGroups, regions }: { complexes: Complex[]; ageGroups: string[]; regions: string[] }) {
  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'saleCount' | 'lastPrice' | 'jeonseRatio'>('saleCount');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Complex[] | null>(null);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/complex-search?q=${encodeURIComponent(q)}`);
      const { results } = await res.json();
      setSearchResults(results);
    } catch { setSearchResults(null); }
    setSearching(false);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.length < 2) { setSearchResults(null); return; }
    timerRef.current = setTimeout(() => doSearch(value), 300);
  }, [doSearch]);

  const displayData = searchResults || complexes;

  const filtered = useMemo(() => {
    let result = displayData;
    if (!searchResults) {
      if (selectedAge) result = result.filter((c: any) => c.ageGroup === selectedAge);
      if (selectedRegion) result = result.filter((c: any) => c.region === selectedRegion);
    }
    return result.sort((a: any, b: any) => {
      if (sortBy === 'lastPrice') return (b.lastPrice || 0) - (a.lastPrice || 0);
      if (sortBy === 'jeonseRatio') return (b.jeonseRatio || 0) - (a.jeonseRatio || 0);
      return b.saleCount - a.saleCount;
    });
  }, [displayData, searchResults, selectedAge, selectedRegion, sortBy]);

  const ageColors: Record<string, string> = {
    '신축': '#3b7bf6', '5년차': '#06b6d4', '10년차': '#8b5cf6',
    '15년차': '#f59e0b', '20년차': '#f97316', '25년차': '#ef4444', '30년+': '#dc2626',
  };

  return (
    <>
      {/* 🔍 검색 바 — 글래스모피즘 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          position: 'relative', background: 'rgba(37,99,235,0.06)',
          borderRadius: 14, border: '1px solid rgba(59,123,246,0.15)',
          backdropFilter: 'blur(8px)',
        }}>
          <input type="text" value={searchQuery} onChange={(e: any) => handleSearch(e.target.value)}
            placeholder="🔍 아파트 이름으로 검색 (예: 래미안, 자이, 힐스테이트...)"
            style={{
              width: '100%', padding: '14px 16px 14px 16px', borderRadius: 14,
              border: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searching && (
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          {searchResults && !searching && (
            <button onClick={() => { setSearchQuery(''); setSearchResults(null); }}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--brand)', cursor: 'pointer', background: 'rgba(59,123,246,0.1)', border: 'none', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
              ✕ 초기화
            </button>
          )}
        </div>
      </div>

      {/* 🏷️ 연차 필터 — 컬러 칩 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        <button onClick={() => setSelectedAge(null)} style={{
          padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          background: !selectedAge ? 'var(--brand)' : 'var(--bg-surface)',
          color: !selectedAge ? '#fff' : 'var(--text-secondary)',
          boxShadow: !selectedAge ? '0 2px 8px rgba(59,123,246,0.3)' : 'none',
          transition: 'all 0.2s ease', whiteSpace: 'nowrap',
          border: !selectedAge ? 'none' : '1px solid var(--border)',
        }}>전체</button>
        {ageGroups.map(g => {
          const active = selectedAge === g;
          const c = ageColors[g] || '#666';
          return (
            <button key={g} onClick={() => setSelectedAge(active ? null : g)} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: active ? c : 'var(--bg-surface)',
              color: active ? '#fff' : 'var(--text-secondary)',
              boxShadow: active ? `0 2px 8px ${c}40` : 'none',
              transition: 'all 0.2s ease', whiteSpace: 'nowrap',
              border: active ? 'none' : '1px solid var(--border)',
            }}>{g}</button>
          );
        })}
      </div>

      {/* 지역 + 정렬 + 카운트 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedRegion || ''} onChange={(e: any) => setSelectedRegion(e.target.value || null)} style={{
          padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer',
        }}>
          <option value="">📍 전체 지역</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value as any)} style={{
          padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer',
        }}>
          <option value="saleCount">🔥 거래 많은 순</option>
          <option value="lastPrice">💰 매매가 높은 순</option>
          <option value="jeonseRatio">📊 전세가율 높은 순</option>
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>
          <span style={{ color: 'var(--brand)', fontSize: 16 }}>{filtered.length}</span>
          <span style={{ fontSize: 12, marginLeft: 2 }}>개 단지</span>
        </div>
      </div>

      {/* 📦 카드 그리드 — 글래스 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filtered.map((c: any, i: any) => {
          const borderColor = ageColors[c.ageGroup] || 'var(--border)';
          return (
            <Link key={`${c.aptName}__${c.sigungu}`} href={`/apt/complex/${encodeURIComponent(c.aptName)}`} style={{
              display: 'block', padding: '16px 18px', borderRadius: 14,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderTop: `3px solid ${borderColor}`,
              textDecoration: 'none', color: 'inherit',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              position: 'relative', overflow: 'hidden',
            }}
              onMouseEnter={(e: any) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${borderColor}20`; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* 순위 뱃지 (TOP 3) */}
              {i < 3 && !searchResults && !selectedAge && !selectedRegion && (
                <div style={{
                  position: 'absolute', top: 0, right: 16,
                  background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#cd7f32',
                  color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px 4px',
                  borderRadius: '0 0 6px 6px',
                }}>#{i + 1}</div>
              )}

              {/* 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.aptName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {c.region} {c.sigungu}{c.builtYear > 0 ? ` · ${c.builtYear}년` : ''}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, flexShrink: 0, marginLeft: 8,
                  background: `${borderColor}15`, color: borderColor,
                }}>{c.ageGroup}</span>
              </div>

              {/* 가격 그리드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2, fontWeight: 600 }}>매매</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {c.lastPrice > 0 ? fmtAmount(c.lastPrice) : '—'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2, fontWeight: 600 }}>전세</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-blue)' }}>
                    {c.jeonse > 0 ? fmtAmount(c.jeonse) : '—'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2, fontWeight: 600 }}>월세</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange, #f97316)' }}>
                    {c.monthlyRent > 0 ? `${c.monthlyRent}만` : '—'}
                  </div>
                </div>
              </div>

              {/* 전세가율 게이지 */}
              <RatioGauge ratio={c.jeonseRatio} />

              {/* 하단 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ color: 'var(--brand)' }}>●</span> 거래 {c.saleCount.toLocaleString()}건
                </span>
                <span style={{ fontSize: 10 }}>상세 보기 →</span>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>검색 결과가 없습니다</div>
          <div style={{ fontSize: 13 }}>다른 검색어나 필터를 시도해보세요</div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
