'use client';
import SectionShareButton from '@/components/SectionShareButton';
import type { AptTransaction } from '@/types/apt';
import { useState, useEffect } from 'react';
import { isNew, fmtAmount, type SharedTabProps } from './apt-utils';
import dynamic from 'next/dynamic';

const BottomSheet = dynamic(() => import('@/components/BottomSheet'), { ssr: false });
const MiniLineChart = dynamic(() => import('@/components/charts/MiniLineChart'), { ssr: false });

const AptPriceTrendChart = dynamic(() => import('@/components/charts/AptPriceTrendChart'), { ssr: false });
const AptReviewSection = dynamic(() => import('@/components/AptReviewSection'), { ssr: false });

interface Props extends SharedTabProps {
  transactions: AptTransaction[];
  tradeMonthly: { stat_month: string; region: string; avg_price: number; count: number }[];
  freshDate?: string;
}

export default function TransactionTab({ transactions, tradeMonthly, watchlist, toggleWatchlist, globalRegion, globalSearch, freshDate, aptImageMap }: Props) {
  const [region, setRegion] = useState(globalRegion || '전체');
  const [page, setPage] = useState(1);
  const [areaFilter, setAreaFilter] = useState('전체');
  const [sort, setSort] = useState<'date'|'price_desc'|'price_asc'|'area'>('date');
  const [search, setSearch] = useState('');
  const [chartRegion, setChartRegion] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showTop10, setShowTop10] = useState(false);
  const effectiveSearch = globalSearch || search;

  useEffect(() => {
    setRegion(globalRegion || '전체');
    setPage(1);
  }, [globalRegion]);

  if (!transactions.length) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
        💰 실거래가 데이터를 수집 중입니다
        <span style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-sm)', display: 'block' }}>국토교통부 실거래가 API에서 평일 08시에 자동 수집합니다</span>
      </div>
    );
  }

  const regs = ['전체', ...Array.from(new Set(transactions.map((t) => t.region_nm || '기타'))).sort()];
  const filtered = transactions.filter((t) => {
    if (region !== '전체' && t.region_nm !== region) return false;
    if (areaFilter !== '전체') {
      const a = t.exclusive_area || 0;
      if (areaFilter === '~59' && a > 60) return false;
      if (areaFilter === '59~84' && (a <= 59 || a > 85)) return false;
      if (areaFilter === '84~' && a <= 84) return false;
    }
    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase();
      if (!(t.apt_name || '').toLowerCase().includes(q) && !(t.dong || '').toLowerCase().includes(q) && !(t.sigungu || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sort === 'price_desc') return (b.deal_amount || 0) - (a.deal_amount || 0);
    if (sort === 'price_asc') return (a.deal_amount || 0) - (b.deal_amount || 0);
    if (sort === 'area') return (b.exclusive_area || 0) - (a.exclusive_area || 0);
    return 0;
  });

  const paged = filtered.slice(0, page * 20);
  const totalCount = filtered.length;
  const avgAmount = totalCount > 0 ? Math.round(filtered.reduce((s: number, t) => s + (t.deal_amount || 0), 0) / totalCount) : 0;
  const maxTrade = filtered.reduce((max: any, t: any) => (!max || (t.deal_amount || 0) > (max.deal_amount || 0)) ? t : max, null as typeof filtered[0] | null);

  // 면적별 통계 카드
  const areaGroups = [
    { key: '소형', label: '~59㎡', filter: (a: number) => a > 0 && a <= 60 },
    { key: '중형', label: '59~84㎡', filter: (a: number) => a > 59 && a <= 85 },
    { key: '대형', label: '85㎡~', filter: (a: number) => a > 84 },
  ];
  const areaStats = areaGroups.map(g => {
    const items = filtered.filter(t => g.filter(t.exclusive_area || 0));
    const avg = items.length > 0 ? Math.round(items.reduce((s: number, t) => s + (t.deal_amount || 0), 0) / items.length) : 0;
    const max = items.length > 0 ? Math.max(...items.map(t => t.deal_amount || 0)) : 0;
    return { ...g, count: items.length, avg, max };
  }).filter(a => a.count > 0);

  const regStats = regs.filter(r => r !== '전체').map(r => {
    const items = transactions.filter((t) => (t.region_nm || '기타') === r);
    const avg = items.length > 0 ? Math.round(items.reduce((s: number, t) => s + (t.deal_amount || 0), 0) / items.length) : 0;
    return { name: r, count: items.length, avg };
  }).sort((a, b) => b.count - a.count);

  const pill = (k: string, sel: string, set: (v: string) => void, label?: string) => (
    <button key={k} onClick={() => { set(k); setPage(1); }} style={{
      padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600,
      background: sel === k ? 'var(--brand)' : 'var(--bg-hover)',
      color: sel === k ? 'var(--text-inverse)' : 'var(--text-secondary)',
      border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>{label || k}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>실거래 현황</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-link)' }}>총 {transactions.length}건</span>
      </div>

      {/* 대시보드 */}
      <div className="kd-card" style={{ marginBottom: 'var(--sp-md)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>📊 {region !== '전체' ? `${region} ` : ''}최근 거래 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-sm)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--brand)' }}>{totalCount.toLocaleString()}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>거래 건수</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{fmtAmount(avgAmount)}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평균가</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-red)' }}>{maxTrade ? fmtAmount(maxTrade.deal_amount) : '-'}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>최고가</div>
          </div>
        </div>
        {/* 지역별 동향 한줄 요약 */}
        {tradeMonthly.length > 4 && (() => {
          const regionTrends = [...new Set(tradeMonthly.map(s => s.region))].slice(0, 5).map(r => {
            const data = tradeMonthly.filter(s => s.region === r).sort((a, b) => String(a.stat_month).localeCompare(String(b.stat_month)));
            if (data.length < 2) return null;
            const prev = data[data.length - 2]?.avg_price || 0;
            const curr = data[data.length - 1]?.avg_price || 0;
            if (!prev || !curr) return null;
            const pct = Math.round((curr - prev) / prev * 100);
            return { region: r, pct, up: pct > 0 };
          }).filter(Boolean) as { region: string; pct: number; up: boolean }[];
          if (regionTrends.length === 0) return null;
          return (
            <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>월간 추이</span>
              {regionTrends.map(t => (
                <span key={t.region} style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: t.up ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
                  {t.region} {t.up ? '▲' : '▼'}{Math.abs(t.pct)}%
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {/* 추이 차트 */}
      {tradeMonthly.length > 0 && (() => {
        const regions = [...new Set(tradeMonthly.map((s) => s.region))];
        const active = chartRegion || regions[0] || '';
        const data = tradeMonthly.filter((s) => s.region === active);
        return (
          <div className="kd-card">
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>📊 지역별 평균 거래가 추이</div>
            <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 6, flexWrap: 'wrap' }}>
              {regions.slice(0, 8).map(r => (
                <button key={r} onClick={() => setChartRegion(r)} style={{ fontSize: 'var(--fs-xs)', padding: '3px 8px', borderRadius: 'var(--radius-md)', border: (chartRegion || regions[0]) === r ? '1px solid var(--brand)' : 'none', background: (chartRegion || regions[0]) === r ? 'var(--brand)' : 'var(--bg-hover)', color: (chartRegion || regions[0]) === r ? 'var(--text-inverse)' : 'var(--text-secondary)', cursor: 'pointer' }}>{r}</button>
              ))}
            </div>
            <MiniLineChart data={data.map((s) => ({ label: String(s.stat_month).slice(5), value: Math.round((s.avg_price || 0) / 10000) }))} color="var(--accent-green)" showValues={true} height={140} />
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>단위: 억원</div>
          </div>
        );
      })()}

      {/* 면적 필터 + 정렬 한 줄 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
        <select value={sort} onChange={e => { setSort(e.target.value as typeof sort); setPage(1); }} style={{
          padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
        }}>
          <option value="date">최신순</option>
          <option value="price_desc">고가순</option>
          <option value="price_asc">저가순</option>
          <option value="area">면적순</option>
        </select>
        <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
          {([{ key: '전체', label: '전체' }, { key: '~59', label: '~59㎡' }, { key: '59~84', label: '59~84㎡' }, { key: '84~', label: '84㎡~' }] as const).map(a => (
            <button key={a.key} onClick={() => setAreaFilter(a.key)} style={{
              padding: '4px 7px', borderRadius: 'var(--radius-pill)', fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: areaFilter === a.key ? 'var(--brand)' : 'var(--bg-hover)',
              color: areaFilter === a.key ? '#fff' : 'var(--text-secondary)',
            }}>{a.label}</button>
          ))}
        </div>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{filtered.length}건</span>
      </div>

      {/* 평당가 TOP10 */}
      {(() => {
        const withPP = filtered.filter((t: any) => t.deal_amount > 0 && t.exclusive_area > 0)
          .map((t: any) => ({ ...t, pp: Math.round(t.deal_amount / t.exclusive_area * 3.3058) }))
          .sort((a: any, b: any) => b.pp - a.pp).slice(0, 10);
        if (withPP.length === 0) return null;
        const maxPP = withPP[0].pp;
        return (
          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <button onClick={() => setShowTop10(!showTop10)} style={{
              width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>📊 평당가 TOP 10</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{showTop10 ? '접기 ▲' : '펼치기 ▼'}</span>
            </button>
            {showTop10 && (
              <div style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                {withPP.map((t: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ minWidth: 16, fontWeight: 700, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.apt_name}</div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 2 }}>
                        <div style={{ height: '100%', width: `${(t.pp / maxPP) * 100}%`, borderRadius: 2, background: 'var(--brand)' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{t.pp.toLocaleString()}만/평</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 카드 리스트 */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
          {effectiveSearch ? `"${effectiveSearch}" 검색 결과가 없습니다` : '해당 조건의 실거래 데이터가 없습니다'}
          {effectiveSearch && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>단지명, 법정동, 시군구로 검색해보세요</div>}
        </div>
      )}
      {/* 면적별 시세 요약 */}
      {areaStats.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, overflowX: 'auto' }}>
          {areaStats.map(a => (
            <div key={a.key} style={{ flex: 1, minWidth: 90, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{fmtAmount(a.avg)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>{a.count}건 · 최고 {fmtAmount(a.max)}</div>
            </div>
          ))}
        </div>
      )}

      {paged.map((t, i: number) => {
        const amt = t.deal_amount || 0;
        const borderColor = amt >= 100000 ? 'var(--accent-red)' : amt >= 50000 ? 'var(--accent-orange)' : amt >= 30000 ? 'var(--accent-yellow)' : 'var(--accent-green)';
        const sameApt = filtered.filter((x) => x.apt_name === t.apt_name && (x.deal_amount || 0) > 0);
        const maxP = sameApt.length > 1 ? Math.max(...sameApt.map((x) => x.deal_amount || 0)) : 0;
        const vsMax = maxP > 0 && amt > 0 && maxP !== amt ? Math.round(((amt - maxP) / maxP) * 100) : null;
        const isMax = maxP > 0 && amt >= maxP && sameApt.length >= 2;
        const ageYears = t.built_year ? new Date().getFullYear() - t.built_year : null;
        const ageLabel = ageYears !== null ? (ageYears <= 5 ? '신축' : ageYears <= 15 ? `${ageYears}년차` : ageYears <= 30 ? `${ageYears}년차` : `${ageYears}년차`) : null;
        const ageColor = ageYears !== null ? (ageYears <= 5 ? 'var(--accent-green)' : ageYears <= 15 ? 'var(--accent-blue)' : ageYears <= 30 ? 'var(--accent-orange)' : 'var(--accent-red)') : 'var(--text-tertiary)';
        return (
          <div key={`${t.id || i}`} onClick={() => setSelected(t)} className="hero-card" style={{ cursor: 'pointer', borderLeft: isMax ? '3px solid rgba(251,191,36,0.5)' : `3px solid ${borderColor}40` }}>
            {/* 히어로 이미지 */}
            <div className="hero-img">
              <img src={aptImageMap?.[t.apt_name] || `/api/og?title=${encodeURIComponent(t.apt_name || '아파트')}&category=apt&design=2`} alt={t.apt_name || "아파트"} width={400} height={120} loading="lazy" />
              <div className="hero-badges">
                <span className="hero-badge" style={{ background: t.trade_type === '매매' ? 'rgba(124,58,237,0.9)' : 'rgba(5,150,105,0.9)', color: '#fff' }}>{t.trade_type || '매매'}</span>
                {isNew(t, 'transaction') && <span className="hero-badge" style={{ background: 'rgba(254,243,199,0.95)', color: '#92400E' }}>NEW</span>}
                {isMax && <span className="hero-badge" style={{ background: 'rgba(251,191,36,0.9)', color: '#1a1a2e' }}>신고가</span>}
                {vsMax !== null && <span className="hero-badge" style={{ background: vsMax > 0 ? 'rgba(239,68,68,0.9)' : 'rgba(52,211,153,0.9)', color: '#fff' }}>{vsMax > 0 ? '▲' : '▼'}{vsMax > 0 ? '+' : ''}{vsMax}%</span>}
                {ageLabel && <span className="hero-badge" style={{ background: 'rgba(255,255,255,0.92)', color: ageColor }}>{ageLabel}</span>}
              </div>
              <div className="hero-overlay" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hero-name">{t.apt_name || '아파트'}</div>
                  <div className="hero-addr">{t.sigungu || ''}{t.dong ? ` ${t.dong}` : ''} · {t.exclusive_area}㎡({Math.round((t.exclusive_area || 0) / 3.3058)}평) · {t.floor}층{t.built_year ? ` · ${t.built_year}년` : ''}</div>
                </div>
                <div className="hero-overlay-stat">
                  <div style={{ fontSize: 18, fontWeight: 800, color: borderColor === 'var(--accent-green)' ? '#34D399' : borderColor === 'var(--accent-red)' ? '#F87171' : borderColor === 'var(--accent-orange)' ? '#FB923C' : '#FBBF24', lineHeight: 1 }}>{fmtAmount(amt)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{t.deal_date || ''}</div>
                </div>
              </div>
            </div>

            {/* ② 8열 KPI (4x2) */}
            {(() => {
              const kS = { textAlign: 'center' as const, padding: '5px 3px', background: 'var(--bg-surface)' };
              const kL = { fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 };
              const ppyeong = (t.exclusive_area || 0) > 0 ? Math.round(amt / ((t.exclusive_area || 1) / 3.3058)) : 0;
              const prevTx = sameApt.length >= 2 ? sameApt[1] : null;
              const prevAmt = prevTx?.deal_amount || 0;
              const prevDiff = prevAmt > 0 ? amt - prevAmt : 0;
              const prevPct = prevAmt > 0 ? Math.round((prevDiff / prevAmt) * 100) : 0;
              const avgAmt = sameApt.length > 0 ? Math.round(sameApt.reduce((s: number, x: any) => s + (x.deal_amount || 0), 0) / sameApt.length) : 0;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, margin: '0 10px 4px', background: 'var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={kS}><div style={kL}>평당가</div><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--accent-purple)' }}>{ppyeong > 0 ? `${ppyeong.toLocaleString()}만` : '-'}</div></div>
                  <div style={kS}><div style={kL}>거래수</div><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--brand)' }}>{sameApt.length}건</div></div>
                  <div style={kS}><div style={kL}>최저가</div><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--accent-cyan, #22D3EE)' }}>{sameApt.length > 1 ? fmtAmount(Math.min(...sameApt.map(x => x.deal_amount || 0))) : fmtAmount(amt)}</div></div>
                  <div style={kS}><div style={kL}>최고가</div><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--accent-red)' }}>{maxP > 0 ? fmtAmount(maxP) : fmtAmount(amt)}</div></div>
                  <div style={kS}><div style={kL}>전고점대비</div><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: vsMax !== null ? (vsMax >= 0 ? 'var(--accent-red)' : 'var(--accent-green)') : 'var(--text-tertiary)' }}>{vsMax !== null ? `${vsMax >= 0 ? '▲+' : '▼'}${vsMax}%` : (isMax ? '신고가' : '-')}</div></div>
                  <div style={kS}><div style={kL}>평형 평균</div><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--accent-blue-light, #60A5FA)' }}>{avgAmt > 0 ? fmtAmount(avgAmt) : '-'}</div></div>
                  <div style={kS}><div style={kL}>직전거래</div><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary)' }}>{prevAmt > 0 ? fmtAmount(prevAmt) : '-'}</div></div>
                  <div style={kS}><div style={kL}>직전대비</div><div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: prevDiff > 0 ? 'var(--accent-red)' : prevDiff < 0 ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>{prevDiff !== 0 ? `${prevDiff > 0 ? '+' : ''}${fmtAmount(prevDiff)}` : '-'}</div></div>
                </div>
              );
            })()}

            {/* ③ 미니 추이 차트 */}
            {sameApt.length >= 3 && (() => {
              const recent = sameApt.slice(0, 9).reverse();
              const mx = Math.max(...recent.map(x => x.deal_amount || 0));
              return (
                <div style={{ padding: '0 12px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
                    {recent.map((r, ri) => { const pct = mx > 0 ? ((r.deal_amount || 0) / mx) * 100 : 0; const isLast = ri === recent.length - 1; return (<div key={ri} style={{ flex: 1, height: `${Math.max(pct, 8)}%`, background: isLast ? borderColor : `${borderColor}30`, borderRadius: '1px 1px 0 0' }} />); })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}><span>{recent.length}건 전</span><span>최근</span></div>
                </div>
              );
            })()}
          </div>
        );
      })}

      {page * 20 < filtered.length && (
        <button onClick={() => setPage(p => p + 1)} style={{
          width: '100%', padding: '12px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          background: 'var(--bg-surface)', color: 'var(--text-secondary)',
          fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', marginBottom: 'var(--sp-sm)',
        }}>더 보기 ({Math.min(page * 20, filtered.length)} / {filtered.length}건)</button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-md)' }}>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
          📊 국토교통부 실거래가 공개시스템 기준{freshDate ? ` · 최근 거래일 ${freshDate}` : ''} · 2026년 기준
        </p>
        <SectionShareButton section="apt-trade" label="아파트 실거래가 현황 — 지역별·단지별 시세" pagePath="/apt?tab=trade" />
      </div>

      {/* 단지백과 유도 */}
      <a href="/apt/complex" style={{ display: 'block', marginTop: 'var(--sp-md)', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(139,92,246,0.06))', border: '1px solid rgba(59,123,246,0.15)', textDecoration: 'none', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--brand)', marginBottom: 2 }}>📊 더 많은 실거래 데이터는 단지백과에서</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전국 34,000+ 아파트 · 매매 49만건 + 전월세 209만건 · 연차별 비교</div>
      </a>

      {/* 실거래 상세 모달 */}
      {selected && (() => {
        const t = selected;
        const related = transactions.filter((x) => x.apt_name === t.apt_name && x.dong === t.dong).slice(0, 20);
        return (
          <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={t.apt_name}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>{t.region_nm} {t.sigungu} {t.dong}</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>거래가</div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{fmtAmount(t.deal_amount || 0)}</div>
                </div>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전용면적</div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{t.exclusive_area}㎡</div>
                </div>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평당가</div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--accent-blue)', marginTop: 2 }}>{t.exclusive_area > 0 && t.deal_amount > 0 ? fmtAmount(Math.round(t.deal_amount / (t.exclusive_area / 3.3058))) : '-'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-lg)' }}>
                <a href={`https://map.kakao.com/?q=${encodeURIComponent(t.apt_name + ' ' + (t.dong || ''))}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>🗺️ 카카오맵</a>
                <a href={`https://map.naver.com/p/search/${encodeURIComponent(t.apt_name + ' ' + (t.dong || ''))}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>🗺️ 네이버지도</a>
                <a href={`/apt/complex/${encodeURIComponent(t.apt_name)}`} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 'var(--radius-sm)', background: 'var(--brand-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>📊 단지 상세</a>
              </div>

              {/* 거래 이력 */}
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>거래 이력 ({related.length}건)</div>
              {related.map((r, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{r.deal_date}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{r.exclusive_area}㎡ · {r.floor}층</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtAmount(r.deal_amount)}</span>
                </div>
              ))}

              <AptPriceTrendChart aptName={t.apt_name} region={t.region_nm} />
              <AptReviewSection aptName={t.apt_name} region={t.region_nm} />
          </BottomSheet>
        );
      })()}
    </div>
  );
}
