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

/* ── SVG 스파크라인 (면적 채우기) ── */
function Spark({ data, w = 56, h = 20 }: { data: number[]; w?: number; h?: number }) {
  const v = data.filter(x => x > 0);
  if (v.length < 2) return <div style={{ width: w, height: h }} />;
  const mn = Math.min(...v), mx = Math.max(...v), rng = mx - mn || 1;
  const pts = v.map((val, i) => `${(i / (v.length - 1)) * w},${h - ((val - mn) / rng) * (h - 3) - 1.5}`).join(' ');
  const fill = v.map((val, i) => `${(i / (v.length - 1)) * w},${h - ((val - mn) / rng) * (h - 3) - 1.5}`);
  fill.push(`${w},${h}`, `0,${h}`);
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polygon points={fill.join(' ')} fill="rgba(59,123,246,0.12)" />
      <polyline points={pts} fill="none" stroke="#3B7BF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((v[v.length - 1] - mn) / rng) * (h - 3) - 1.5} r="2.5" fill="#3B7BF6" />
    </svg>
  );
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

// 간이 트렌드 데이터 (실제로는 서버에서 전달)
function makeTrend(price: number): number[] {
  if (!price) return [];
  const base = price * 0.85;
  return [0.88, 0.91, 0.94, 0.96, 0.98, 1].map(m => Math.round(base + (price - base) * m));
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
        <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
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
                <div style={{ fontSize: 8, color: on ? c : 'var(--text-tertiary)', fontWeight: 600 }}>{a.group}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{a.avg > 0 ? fmtAmount(a.avg) : '—'}</div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, margin: '3px 3px 0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${max > 0 ? (a.avg / max) * 100 : 0}%`, borderRadius: 2,
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
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <input type="text" value={searchQuery} onChange={(e: any) => handleSearch(e.target.value)}
            placeholder="🔍 단지명 검색..."
            className="kd-search-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          {searching && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-tertiary)' }}>...</span>}
          {searchResults && !searching && <span onClick={() => { setSearchQuery(''); setSearchResults(null); }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--brand)', cursor: 'pointer', fontWeight: 700 }}>✕</span>}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>
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
          const trend = makeTrend(c.lastPrice);
          return (
            <Link key={`${c.aptName}__${c.sigungu}`} href={`/apt/complex/${encodeURIComponent(c.aptName)}`} style={{
              display: 'block', padding: '14px 12px', borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderTop: '3px solid var(--brand)',
              textDecoration: 'none', color: 'inherit', position: 'relative', overflow: 'hidden',
              boxShadow: i < 3 && !searchResults && !selectedAge ? '0 4px 16px rgba(59,123,246,0.08)' : 'none',
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            }}
              onMouseEnter={(e: any) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(59,123,246,0.12)'; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = i < 3 ? '0 4px 16px rgba(59,123,246,0.08)' : 'none'; }}
            >
              {/* TOP 뱃지 */}
              {i < 3 && !searchResults && !selectedAge && (
                <div style={{
                  position: 'absolute', top: -1, right: 12,
                  background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#cd7f32',
                  color: '#050A18', fontSize: 8, fontWeight: 900, padding: '2px 7px 3px',
                  borderRadius: '0 0 5px 5px', letterSpacing: 0.3,
                }}>TOP {i + 1}</div>
              )}

              {/* 이름 + 스파크라인 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-sm)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.aptName}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {c.region} {c.sigungu}{c.dong ? ` ${c.dong}` : ''} · {c.builtYear > 0 ? `${c.builtYear}년` : ''}
                    {c.hasCoords && <span style={{ marginLeft: 3, fontSize: 9 }}>📍</span>}
                    <span style={{ marginLeft: 4, color: 'var(--brand)', fontWeight: 600 }}>{c.ageGroup}</span>
                  </div>
                </div>
                <Spark data={trend} />
              </div>

              {/* 매매 크게 + 원형 게이지 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
                <div>
                  <div style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 600 }}>매매</div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: -0.5 }}>{c.lastPrice > 0 ? fmtAmount(c.lastPrice) : '—'}</div>
                </div>
                {c.jeonseRatio ? <Gauge ratio={c.jeonseRatio} size={42} /> : null}
              </div>

              {/* 3열 부가 데이터 */}
              <div className="kd-grid-3" style={{ gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
                {[
                  { label: '전세', value: c.jeonse > 0 ? fmtAmount(c.jeonse) : '—' },
                  { label: '월세', value: c.monthlyRent > 0 ? `${c.monthlyRent}만` : '—' },
                  { label: '평당가', value: c.pyeongPrice > 0 ? fmtAmount(c.pyeongPrice) : '—' },
                ].map(p => (
                  <div key={p.label} style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)', padding: '4px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{p.value}</div>
                  </div>
                ))}
              </div>

              {/* 하단 */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
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
