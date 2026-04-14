'use client';
import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { fmtAmount } from '@/lib/format';
import SearchInput from '@/components/SearchInput';

interface Complex {
  aptName: string; sigungu: string; region: string; dong: string;
  builtYear: number; saleCount: number; rentCount: number;
  lastPrice: number; jeonse: number; monthly: number; monthlyRent: number;
  ageGroup: string; jeonseRatio: number | null;
  pyeongPrice: number; hasCoords: boolean;
  imageUrl?: string | null;
}

/* ── 원형 게이지 ── */
function Gauge({ ratio, size = 40 }: { ratio: number; size?: number }) {
  const r = (size - 4) / 2, circ = 2 * Math.PI * r;
  const pct = Math.min(ratio, 100) / 100;
  const color = ratio > 80 ? '#ef4444' : ratio > 60 ? '#f59e0b' : '#22c55e';
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.5s' }} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize="10" fontWeight="800">{ratio}%</text>
    </svg>
  );
}

export default function ComplexClient({ complexes, ageGroups, regions, initialRegion, ageChartData }: {
  complexes: Complex[]; ageGroups: string[]; regions: string[];
  initialRegion?: string | null;
  ageChartData?: { group: string; avg: number; count: number }[];
}) {
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
      return (b.saleCount + b.rentCount) - (a.saleCount + a.rentCount);
    });
  }, [displayData, searchResults, selectedAge, selectedRegion, sortBy, initialRegion]);

  return (
    <>
      {/* 연차 pill + 정렬 */}
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {(() => {
          const ageColors: Record<string, string> = { '신축': '#3B7BF6', '5년차': '#22d3ee', '10년차': '#8b5cf6', '15년차': '#f59e0b', '20년차': '#f97316', '25년차': '#ef4444', '30년+': '#dc2626' };
          return (
          <>
        <button aria-label="닫기" onClick={() => setSelectedAge(null)} style={{
          padding: '4px 10px', borderRadius: 'var(--radius-xs)', cursor: 'pointer',
          fontSize: 10, fontWeight: !selectedAge ? 700 : 500,
          background: !selectedAge ? 'rgba(59,123,246,0.2)' : 'transparent',
          color: !selectedAge ? 'var(--brand)' : 'var(--text-tertiary)',
          border: !selectedAge ? '1px solid rgba(59,123,246,0.4)' : '1px solid var(--border)',
        }}>전체</button>
        {ageGroups.map((g: any) => {
          const active = selectedAge === g;
          const c = ageColors[g] || '#6B82A0';
          return (
            <button key={g} onClick={() => setSelectedAge(active ? null : g)} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-xs)', cursor: 'pointer',
              fontSize: 10, fontWeight: active ? 700 : 500,
              background: active ? `${c}20` : 'transparent',
              color: active ? c : 'var(--text-tertiary)',
              border: active ? `1px solid ${c}50` : '1px solid var(--border)',
            }}>{g}</button>
          );
        })}
          </>);
        })()}
        <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value)} style={{
          marginLeft: 'auto', padding: '4px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)',
          background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 10, cursor: 'pointer',
        }}>
          <option value="saleCount">거래순</option>
          <option value="lastPrice">매매가순</option>
          <option value="pyeongPrice">평당가순</option>
          <option value="jeonseRatio">전세가율순</option>
        </select>
      </div>

      {/* 연차 통계 바 — 클릭 가능, 연차별 액센트 컬러 */}
      {ageChartData && (() => {
        const ageColors: Record<string, string> = { '신축': '#3B7BF6', '5년차': '#22d3ee', '10년차': '#8b5cf6', '15년차': '#f59e0b', '20년차': '#f97316', '25년차': '#ef4444', '30년+': '#dc2626' };
        return (
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {ageChartData.map((a: any) => {
            const max = Math.max(...ageChartData.map((x: any) => x.avg));
            const on = selectedAge === a.group;
            const c = ageColors[a.group] || '#6B82A0';
            return (
              <div key={a.group} onClick={() => setSelectedAge(selectedAge === a.group ? null : a.group)} style={{
                flex: 1, background: on ? 'var(--bg-hover)' : 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '7px 2px',
                textAlign: 'center', cursor: 'pointer',
                border: on ? `1px solid ${c}60` : '1px solid var(--border)',
                boxShadow: on ? `0 0 10px ${c}25` : 'none',
              }}>
                <div style={{ fontSize: 10, color: on ? c : 'var(--text-tertiary)', fontWeight: 600 }}>{a.group}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{a.avg > 0 ? fmtAmount(a.avg) : '—'}</div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, margin: '3px 3px 0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${max > 0 ? (a.avg / max) * 100 : 0}%`, borderRadius: 4,
                    background: on ? `linear-gradient(90deg, ${c}, ${c}90)` : `${c}40`,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* 검색 + 카운트 */}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 14, alignItems: 'center' }}>
        <SearchInput
          value={searchQuery}
          onChange={v => handleSearch(v)}
          placeholder="단지명 검색"
          size="sm"
          loading={searching}
          style={{ flex: '1 1 200px' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700, flexShrink: 0 }}>
          <span style={{ color: 'var(--brand)', fontWeight: 900 }}>{filtered.length}</span>개
        </span>
      </div>

      {/* ═══ 2열 카드 그리드 — V1 프리미엄 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px 20px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--sp-sm)' }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--sp-xs)' }}>검색 결과가 없습니다</div>
            <div style={{ fontSize: 12 }}>다른 검색어나 필터를 시도해보세요</div>
          </div>
        )}
        {filtered.map((c: any, i: number) => {
          return (
            <Link key={`${c.aptName}__${c.sigungu}`} href={`/apt/complex/${encodeURIComponent(c.aptName)}`} className="hero-card" style={{
              display: 'block', position: 'relative', overflow: 'hidden',
            }}>
              {/* 히어로 이미지 (소형) */}
              <div className="hero-img hero-img-sm">
                <img src={c.imageUrl || `/api/og?title=${encodeURIComponent(c.aptName)}&category=apt&design=2`} alt={c.aptName} width={300} height={90} loading="lazy" />
                <div className="hero-badges">
                  {(() => {
                    const ageColors: Record<string, string> = { '신축': 'rgba(59,123,246,0.9)', '5년차': 'rgba(34,211,238,0.9)', '10년차': 'rgba(139,92,246,0.9)', '15년차': 'rgba(245,158,11,0.9)', '20년차': 'rgba(249,115,22,0.9)', '25년차': 'rgba(239,68,68,0.9)', '30년+': 'rgba(220,38,38,0.9)' };
                    return <span className="hero-badge" style={{ background: ageColors[c.ageGroup] || 'rgba(100,116,139,0.85)', color: '#fff' }}>{c.ageGroup}</span>;
                  })()}
                </div>
                {/* TOP 뱃지 */}
                {i < 3 && !searchResults && !selectedAge && (
                  <div className="hero-chip">
                    <span className="hero-badge" style={{
                      background: i === 0 ? 'rgba(245,158,11,0.9)' : i === 1 ? 'rgba(148,163,184,0.9)' : 'rgba(205,127,50,0.9)',
                      color: '#fff', letterSpacing: 0.3,
                    }}>TOP {i + 1}</span>
                  </div>
                )}
                <div className="hero-overlay">
                  <div className="hero-name" style={{ fontSize: 14 }}>{c.aptName}</div>
                  <div className="hero-addr">{c.region} {c.sigungu}{c.dong ? ` ${c.dong}` : ''}{c.builtYear > 0 ? ` · ${c.builtYear}년` : ''}</div>
                </div>
              </div>

              {/* 매매 크게 + 원형 게이지 */}
              <div style={{ padding: '10px 12px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>매매</div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: -0.5 }}>{c.lastPrice > 0 ? fmtAmount(c.lastPrice) : '—'}</div>
                </div>
                {c.jeonseRatio ? <Gauge ratio={c.jeonseRatio} size={42} /> : null}
              </div>

              {/* 3열x2줄 부가 데이터 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, margin: '0 10px 4px', background: 'var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {[
                  { label: '전세', value: c.jeonse > 0 ? fmtAmount(c.jeonse) : '—', color: 'var(--accent-green)' },
                  { label: '평당가', value: c.pyeongPrice > 0 ? fmtAmount(c.pyeongPrice) : '—', color: 'var(--accent-purple, #A78BFA)' },
                  { label: '갭투자', value: c.lastPrice > 0 && c.jeonse > 0 ? fmtAmount(c.lastPrice - c.jeonse) : '—', color: 'var(--accent-orange)' },
                  { label: '매매', value: c.saleCount > 0 ? `${c.saleCount}건` : '—', color: 'var(--brand)' },
                  { label: '전월세', value: c.rentCount > 0 ? `${c.rentCount}건` : '—', color: 'var(--accent-cyan, #22D3EE)' },
                  { label: '월세', value: c.monthlyRent > 0 ? `${c.monthlyRent}만` : '—', color: 'var(--text-secondary)' },
                ].map(p => (
                  <div key={p.label} style={{ textAlign: 'center', padding: '4px 2px', background: 'var(--bg-surface)' }}>
                    <div style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{p.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: p.color }}>{p.value}</div>
                  </div>
                ))}
              </div>

              {/* 하단 */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '6px 12px', fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>거래 <b style={{ color: 'var(--text-secondary)' }}>{(c.saleCount + (c.rentCount || 0)).toLocaleString()}</b>건</span>
                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>상세 →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
