'use client';
import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { fmtAmount } from '@/lib/format';

interface Complex {
  aptName: string; sigungu: string; region: string; dong: string;
  builtYear: number; saleCount: number; rentCount: number;
  lastPrice: number; jeonse: number; monthly: number; monthlyRent: number;
  ageGroup: string; jeonseRatio: number | null;
  pyeongPrice: number; hasCoords: boolean;
}

function RatioGauge({ ratio }: { ratio: number | null }) {
  if (!ratio) return null;
  const color = ratio > 80 ? '#ef4444' : ratio > 60 ? '#f59e0b' : '#22c55e';
  const pct = Math.min(ratio, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', minWidth: 32 }}>전세가율</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 28, textAlign: 'right' }}>{ratio}%</span>
    </div>
  );
}

export default function ComplexClient({ complexes, ageGroups, regions, initialRegion }: { complexes: Complex[]; ageGroups: string[]; regions: string[]; initialRegion?: string | null }) {
  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'saleCount' | 'lastPrice' | 'jeonseRatio' | 'pyeongPrice'>('saleCount');
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
      if (!initialRegion && selectedRegion) result = result.filter((c: any) => c.region === selectedRegion);
    }
    return result.sort((a: any, b: any) => {
      if (sortBy === 'lastPrice') return (b.lastPrice || 0) - (a.lastPrice || 0);
      if (sortBy === 'jeonseRatio') return (b.jeonseRatio || 0) - (a.jeonseRatio || 0);
      if (sortBy === 'pyeongPrice') return (b.pyeongPrice || 0) - (a.pyeongPrice || 0);
      return b.saleCount - a.saleCount;
    });
  }, [displayData, searchResults, selectedAge, selectedRegion, sortBy, initialRegion]);

  const ageColors: Record<string, string> = {
    '신축': '#3b7bf6', '5년차': '#06b6d4', '10년차': '#8b5cf6',
    '15년차': '#f59e0b', '20년차': '#f97316', '25년차': '#ef4444', '30년+': '#dc2626',
  };

  return (
    <>
      {/* 검색 + 필터 — 1줄 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <input type="text" value={searchQuery} onChange={(e: any) => handleSearch(e.target.value)}
            placeholder="🔍 단지명 검색..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searching && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-tertiary)' }}>...</span>}
          {searchResults && !searching && <span onClick={() => { setSearchQuery(''); setSearchResults(null); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--brand)', cursor: 'pointer', fontWeight: 700 }}>✕</span>}
        </div>
        <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value)} style={{
          padding: '8px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
          border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer',
        }}>
          <option value="saleCount">거래순</option>
          <option value="lastPrice">매매가순</option>
          <option value="pyeongPrice">평당가순</option>
          <option value="jeonseRatio">전세가율순</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>
          <span style={{ color: 'var(--brand)', fontWeight: 900 }}>{filtered.length}</span>개
        </span>
      </div>

      {/* 연차 필터 — 컴팩트 필 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedAge(null)} style={{
          padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: !selectedAge ? 'var(--brand)' : 'var(--bg-surface)', color: !selectedAge ? '#fff' : 'var(--text-secondary)',
          border: !selectedAge ? 'none' : '1px solid var(--border)',
        }}>전체</button>
        {ageGroups.map((g: any) => {
          const active = selectedAge === g;
          const c = ageColors[g] || '#666';
          return (
            <button key={g} onClick={() => setSelectedAge(active ? null : g)} style={{
              padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: active ? c : 'var(--bg-surface)', color: active ? '#fff' : 'var(--text-secondary)',
              border: active ? 'none' : '1px solid var(--border)',
            }}>{g}</button>
          );
        })}
      </div>

      {/* 카드 그리드 — 정보 풍부 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
        {filtered.map((c: any, i: number) => {
          const borderColor = ageColors[c.ageGroup] || 'var(--border)';
          const totalTrades = (c.saleCount || 0) + (c.rentCount || 0);
          return (
            <Link key={`${c.aptName}__${c.sigungu}`} href={`/apt/complex/${encodeURIComponent(c.aptName)}`} style={{
              display: 'block', padding: '14px 16px', borderRadius: 14,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderTop: `3px solid ${borderColor}`,
              textDecoration: 'none', color: 'inherit',
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
              position: 'relative',
            }}
              onMouseEnter={(e: any) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${borderColor}20`; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* TOP 3 */}
              {i < 3 && !searchResults && !selectedAge && (
                <div style={{
                  position: 'absolute', top: 0, right: 14,
                  background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#cd7f32',
                  color: '#fff', fontSize: 9, fontWeight: 900, padding: '1px 7px 3px', borderRadius: '0 0 5px 5px',
                }}>#{i + 1}</div>
              )}

              {/* 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.aptName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    {c.region} {c.sigungu}{c.dong ? ` ${c.dong}` : ''}{c.builtYear > 0 ? ` · ${c.builtYear}년` : ''}
                    {c.hasCoords && <span style={{ marginLeft: 4, fontSize: 9 }}>📍</span>}
                  </div>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 800, flexShrink: 0, marginLeft: 6,
                  background: `${borderColor}15`, color: borderColor,
                }}>{c.ageGroup}</span>
              </div>

              {/* 가격 4열 그리드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, marginBottom: 8 }}>
                {[
                  { label: '매매', value: c.lastPrice > 0 ? fmtAmount(c.lastPrice) : '—', color: 'var(--text-primary)' },
                  { label: '전세', value: c.jeonse > 0 ? fmtAmount(c.jeonse) : '—', color: '#3b82f6' },
                  { label: '월세', value: c.monthlyRent > 0 ? `${c.monthlyRent}만` : '—', color: '#f97316' },
                  { label: '평당가', value: c.pyeongPrice > 0 ? fmtAmount(c.pyeongPrice) : '—', color: '#8b5cf6' },
                ].map(p => (
                  <div key={p.label} style={{ background: 'var(--bg-hover)', borderRadius: 6, padding: '5px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: p.color, lineHeight: 1.2, marginTop: 1 }}>{p.value}</div>
                  </div>
                ))}
              </div>

              {/* 전세가율 게이지 */}
              <RatioGauge ratio={c.jeonseRatio} />

              {/* 하단 — 거래 건수 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span>매매 <b style={{ color: 'var(--text-secondary)' }}>{c.saleCount.toLocaleString()}</b>건</span>
                  {c.rentCount > 0 && <span>전월세 <b style={{ color: 'var(--text-secondary)' }}>{c.rentCount.toLocaleString()}</b>건</span>}
                </div>
                <span style={{ fontSize: 10, color: 'var(--brand)' }}>상세 →</span>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>검색 결과가 없습니다</div>
          <div style={{ fontSize: 12 }}>다른 검색어나 필터를 시도해보세요</div>
        </div>
      )}
    </>
  );
}
