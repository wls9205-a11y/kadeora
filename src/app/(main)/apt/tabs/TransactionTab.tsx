'use client';
import SectionShareButton from '@/components/SectionShareButton';
import type { AptTransaction } from '@/types/apt';
import { useState, useEffect } from 'react';
import { isNew, NewBadge, fmtAmount, type SharedTabProps } from './apt-utils';
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

export default function TransactionTab({ transactions, tradeMonthly, watchlist, toggleWatchlist, globalRegion, globalSearch, freshDate }: Props) {
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
        <span style={{ fontSize: 'var(--fs-sm)', marginTop: 8, display: 'block' }}>국토교통부 실거래가 API에서 평일 08시에 자동 수집합니다</span>
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

  const regStats = regs.filter(r => r !== '전체').map(r => {
    const items = transactions.filter((t) => (t.region_nm || '기타') === r);
    const avg = items.length > 0 ? Math.round(items.reduce((s: number, t) => s + (t.deal_amount || 0), 0) / items.length) : 0;
    return { name: r, count: items.length, avg };
  }).sort((a, b) => b.count - a.count);

  const pill = (k: string, sel: string, set: (v: string) => void, label?: string) => (
    <button key={k} onClick={() => { set(k); setPage(1); }} style={{
      padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600,
      background: sel === k ? 'var(--brand)' : 'var(--bg-hover)',
      color: sel === k ? 'var(--text-inverse)' : 'var(--text-secondary)',
      border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>{label || k}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>실거래 현황</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-link)' }}>총 {transactions.length}건</span>
      </div>

      {/* 대시보드 */}
      <div className="kd-card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>📊 {region !== '전체' ? `${region} ` : ''}최근 거래 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
      </div>

      {/* 추이 차트 */}
      {tradeMonthly.length > 0 && (() => {
        const regions = [...new Set(tradeMonthly.map((s) => s.region))];
        const active = chartRegion || regions[0] || '';
        const data = tradeMonthly.filter((s) => s.region === active);
        return (
          <div className="kd-card">
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📊 지역별 평균 거래가 추이</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
              {regions.slice(0, 8).map(r => (
                <button key={r} onClick={() => setChartRegion(r)} style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, border: (chartRegion || regions[0]) === r ? '1px solid var(--brand)' : 'none', background: (chartRegion || regions[0]) === r ? 'var(--brand)' : 'var(--bg-hover)', color: (chartRegion || regions[0]) === r ? 'var(--text-inverse)' : 'var(--text-secondary)', cursor: 'pointer' }}>{r}</button>
              ))}
            </div>
            <MiniLineChart data={data.map((s) => ({ label: String(s.stat_month).slice(5), value: Math.round((s.avg_price || 0) / 10000) }))} color="var(--accent-green)" showValues={true} height={140} />
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>단위: 억원</div>
          </div>
        );
      })()}

      {/* 면적 필터 + 정렬 한 줄 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <select value={sort} onChange={e => { setSort(e.target.value as typeof sort); setPage(1); }} style={{
          padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
        }}>
          <option value="date">최신순</option>
          <option value="price_desc">고가순</option>
          <option value="price_asc">저가순</option>
          <option value="area">면적순</option>
        </select>
        <div style={{ display: 'flex', gap: 3, flex: 1, justifyContent: 'flex-end' }}>
          {([{ key: '전체', label: '전체' }, { key: '~59', label: '~59㎡' }, { key: '59~84', label: '59~84㎡' }, { key: '84~', label: '84㎡~' }] as const).map(a => (
            <button key={a.key} onClick={() => setAreaFilter(a.key)} style={{
              padding: '4px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer',
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
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => setShowTop10(!showTop10)} style={{
              width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>📊 평당가 TOP 10</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{showTop10 ? '접기 ▲' : '펼치기 ▼'}</span>
            </button>
            {showTop10 && (
              <div style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                {withPP.map((t: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                    <span style={{ minWidth: 16, fontWeight: 700, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.apt_name}</div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 2 }}>
                        <div style={{ height: '100%', width: `${(t.pp / maxPP) * 100}%`, borderRadius: 2, background: 'var(--brand)' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{t.pp.toLocaleString()}만/평</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 카드 리스트 */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
          {effectiveSearch ? `"${effectiveSearch}" 검색 결과가 없습니다` : '해당 조건의 실거래 데이터가 없습니다'}
          {effectiveSearch && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>단지명, 법정동, 시군구로 검색해보세요</div>}
        </div>
      )}
      {paged.map((t, i: number) => {
        const amt = t.deal_amount || 0;
        const borderColor = amt >= 100000 ? 'var(--accent-red)' : amt >= 50000 ? 'var(--accent-orange)' : amt >= 30000 ? 'var(--accent-yellow)' : 'var(--accent-green)';
        const sameApt = filtered.filter((x) => x.apt_name === t.apt_name && (x.deal_amount || 0) > 0);
        const maxP = sameApt.length > 1 ? Math.max(...sameApt.map((x) => x.deal_amount || 0)) : 0;
        const vsMax = maxP > 0 && amt > 0 && maxP !== amt ? Math.round(((amt - maxP) / maxP) * 100) : null;
        const isMax = maxP > 0 && amt >= maxP && sameApt.length >= 2;
        return (
          <div key={`${t.id || i}`} onClick={() => setSelected(t)} className="kd-card-hover" style={{
            padding: '14px 16px', borderRadius: 14, marginBottom: 8,
            background: isMax ? 'rgba(251,191,36,0.04)' : 'var(--bg-surface)',
            border: isMax ? '1px solid rgba(251,191,36,0.3)' : '1px solid var(--border)',
            cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              {isNew(t, 'transaction') && <NewBadge />}
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'var(--accent-blue-bg)', color: 'var(--accent-blue-light)' }}>{t.trade_type || '매매'}</span>
              {isMax && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(251,191,36,0.15)', color: 'var(--accent-yellow)' }}>🏆 신고가</span>}
              {vsMax !== null && !isMax && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: vsMax >= 0 ? 'var(--accent-red-bg)' : 'var(--accent-blue-bg)', color: vsMax >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>최고가 {vsMax >= 0 ? '+' : ''}{vsMax}%</span>}
              <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{t.region_nm} {t.sigungu}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleWatchlist('transaction', String(t.id)); }} style={{ fontSize: 'var(--fs-lg)', background: watchlist.has(`transaction:${t.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`transaction:${t.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', lineHeight: 1 }}>
                {watchlist.has(`transaction:${t.id}`) ? '⭐' : '☆'}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 2 }}>{t.apt_name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전용 {t.exclusive_area}㎡ · {t.floor}층{t.built_year ? ` · ${t.built_year}년식` : ''}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: borderColor, lineHeight: 1.2 }}>{fmtAmount(amt)}</div>
                {t.exclusive_area > 0 && amt > 0 && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 1 }}>평당 {fmtAmount(Math.round(amt / (t.exclusive_area / 3.3058)))}</div>}
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>📅 {t.deal_date}</div>
          </div>
        );
      })}

      {page * 20 < filtered.length && (
        <button onClick={() => setPage(p => p + 1)} style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--bg-surface)', color: 'var(--text-secondary)',
          fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', marginBottom: 8,
        }}>더 보기 ({Math.min(page * 20, filtered.length)} / {filtered.length}건)</button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
          📊 국토교통부 실거래가 공개시스템 기준{freshDate ? ` · 최근 거래일 ${freshDate}` : ''} · 2026년 기준
        </p>
        <SectionShareButton section="apt-trade" label="아파트 실거래가 현황 — 지역별·단지별 시세" pagePath="/apt?tab=trade" />
      </div>

      {/* 단지백과 유도 */}
      <a href="/apt/complex" style={{ display: 'block', marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(139,92,246,0.06))', border: '1px solid rgba(59,123,246,0.15)', textDecoration: 'none', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--brand)', marginBottom: 2 }}>📊 더 많은 실거래 데이터는 단지백과에서</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전국 34,000+ 아파트 · 매매 49만건 + 전월세 209만건 · 연차별 비교</div>
      </a>

      {/* 실거래 상세 모달 */}
      {selected && (() => {
        const t = selected;
        const related = transactions.filter((x) => x.apt_name === t.apt_name && x.dong === t.dong).slice(0, 20);
        return (
          <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={t.apt_name}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>{t.region_nm} {t.sigungu} {t.dong}</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>거래가</div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{fmtAmount(t.deal_amount || 0)}</div>
                </div>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전용면적</div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{t.exclusive_area}㎡</div>
                </div>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평당가</div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--accent-blue)', marginTop: 2 }}>{t.exclusive_area > 0 && t.deal_amount > 0 ? fmtAmount(Math.round(t.deal_amount / (t.exclusive_area / 3.3058))) : '-'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <a href={`https://map.kakao.com/?q=${encodeURIComponent(t.apt_name + ' ' + (t.dong || ''))}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>🗺️ 카카오맵</a>
                <a href={`https://map.naver.com/p/search/${encodeURIComponent(t.apt_name + ' ' + (t.dong || ''))}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>🗺️ 네이버지도</a>
                <a href={`/apt/complex/${encodeURIComponent(t.apt_name)}`} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: 'var(--brand-bg)', border: '1px solid var(--brand-border)', color: 'var(--brand)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>📊 단지 상세</a>
              </div>

              {/* 거래 이력 */}
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>거래 이력 ({related.length}건)</div>
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
