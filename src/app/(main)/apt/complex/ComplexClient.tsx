'use client';
import { useState, useMemo } from 'react';
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

export default function ComplexClient({ complexes, ageGroups, regions }: { complexes: Complex[]; ageGroups: string[]; regions: string[] }) {
  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'saleCount' | 'lastPrice' | 'jeonseRatio'>('saleCount');

  const filtered = useMemo(() => {
    let result = complexes;
    if (selectedAge) result = result.filter(c => c.ageGroup === selectedAge);
    if (selectedRegion) result = result.filter(c => c.region === selectedRegion);
    return result.sort((a, b) => {
      if (sortBy === 'lastPrice') return (b.lastPrice || 0) - (a.lastPrice || 0);
      if (sortBy === 'jeonseRatio') return (b.jeonseRatio || 0) - (a.jeonseRatio || 0);
      return b.saleCount - a.saleCount;
    });
  }, [complexes, selectedAge, selectedRegion, sortBy]);

  return (
    <>
      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* 연차 필터 */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedAge(null)} style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: !selectedAge ? 'var(--brand)' : 'var(--bg-hover)', color: !selectedAge ? '#fff' : 'var(--text-secondary)',
          }}>전체</button>
          {ageGroups.map(g => (
            <button key={g} onClick={() => setSelectedAge(selectedAge === g ? null : g)} style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: selectedAge === g ? 'var(--brand)' : 'var(--bg-hover)', color: selectedAge === g ? '#fff' : 'var(--text-secondary)',
            }}>{g}</button>
          ))}
        </div>
      </div>

      {/* 지역 + 정렬 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedRegion || ''} onChange={e => setSelectedRegion(e.target.value || null)} style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer',
        }}>
          <option value="">전체 지역</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer',
        }}>
          <option value="saleCount">거래 많은 순</option>
          <option value="lastPrice">매매가 높은 순</option>
          <option value="jeonseRatio">전세가율 높은 순</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{filtered.length}개 단지</span>
      </div>

      {/* 카드 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {filtered.map(c => (
          <Link key={`${c.aptName}__${c.sigungu}`} href={`/apt/complex/${encodeURIComponent(c.aptName)}`} style={{
            display: 'block', padding: '14px 16px', borderRadius: 12,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            textDecoration: 'none', color: 'inherit', transition: 'border-color 0.12s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{c.aptName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.region} {c.sigungu}</div>
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                background: c.ageGroup === '신축' ? 'rgba(59,123,246,0.1)' : c.ageGroup.includes('30') ? 'rgba(239,68,68,0.1)' : 'var(--bg-hover)',
                color: c.ageGroup === '신축' ? 'var(--brand)' : c.ageGroup.includes('30') ? 'var(--accent-red)' : 'var(--text-secondary)',
              }}>{c.ageGroup}</span>
            </div>

            {/* 가격 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>매매</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {c.lastPrice > 0 ? fmtAmount(c.lastPrice) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전세</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {c.jeonse > 0 ? fmtAmount(c.jeonse) : '—'}
                </div>
              </div>
            </div>

            {/* 하단 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span>
                {c.monthlyRent > 0 ? `월세 ${fmtAmount(c.monthly)}/${c.monthlyRent}만` : c.monthly > 0 ? `보증 ${fmtAmount(c.monthly)}` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {c.jeonseRatio && (
                  <span style={{ color: c.jeonseRatio > 70 ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 600 }}>
                    전세가율 {c.jeonseRatio}%
                  </span>
                )}
                <span>거래 {c.saleCount}건</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
          해당 조건의 단지가 없습니다. 필터를 변경해보세요.
        </div>
      )}
    </>
  );
}
