'use client';
import { useState } from 'react';
import { isNew, NewBadge, fmtAmount, kstNow, kstToday, STAGE_COLORS, STAGE_ORDER, type SharedTabProps } from './apt-utils';
import { haptic } from '@/lib/haptic';
import BottomSheet from '@/components/BottomSheet';

interface Props extends SharedTabProps {
  ongoingApts: any[];
  premiumListings: any[];
}

export default function OngoingTab({ ongoingApts, premiumListings, aptUser, watchlist, toggleWatchlist, setCommentTarget, showToast }: Props) {
  const [ongoingRegion, setOngoingRegion] = useState('전체');
  const [ongoingPage, setOngoingPage] = useState(1);
  const [ongoingSort, setOngoingSort] = useState<'supply'|'unsold'|'price'|'competition'>('supply');
  const [ongoingSearch, setOngoingSearch] = useState('');
  const [ongoingStatus, setOngoingStatus] = useState('전체');
  const [selectedOngoing, setSelectedOngoing] = useState<any | null>(null);

  const pill = (v: string, sel: string, set: (v: string) => void, label?: string) => (
    <button key={v} onClick={() => set(v)} style={{
      padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600,
      background: sel === v ? 'var(--brand)' : 'var(--bg-hover)',
      color: sel === v ? '#fff' : 'var(--text-secondary)',
      border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>
      {label || v}
    </button>
  );

  if (!ongoingApts.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>🏢 분양중 데이터를 수집 중입니다<br/><span style={{ fontSize: 'var(--fs-sm)' }}>청약 마감 후 입주 전 현장 및 미분양 현장이 표시됩니다</span></div>;

  const regs = ['전체', ...Array.from(new Set(ongoingApts.map((o: any) => o.region_nm || '기타'))).sort()];
  let filtered = ongoingRegion === '전체' ? ongoingApts : ongoingApts.filter((o: any) => (o.region_nm || '기타') === ongoingRegion);
  if (ongoingSearch.trim()) {
    const q = ongoingSearch.trim().toLowerCase();
    filtered = filtered.filter((o: any) => (o.house_nm || '').toLowerCase().includes(q) || (o.address || '').toLowerCase().includes(q) || (o.region_nm || '').toLowerCase().includes(q) || (o.constructor_nm || '').toLowerCase().includes(q));
  }
  if (ongoingStatus !== '전체') filtered = filtered.filter((o: any) => ongoingStatus === '미분양' ? o.source === 'unsold' : o.source === 'subscription');
  const totalSites = filtered.length;
  const totalUnsoldUnits = filtered.reduce((s: number, o: any) => s + (o.unsold_count || 0), 0);
  const allSubCount = filtered.filter((o: any) => o.source === 'subscription').length;
  const allUnsoldCount = filtered.filter((o: any) => o.source === 'unsold').length;
  const PER_PAGE = 20;
  const sorted = [...filtered].sort((a, b) => {
    if (ongoingSort === 'unsold') return (b.unsold_count || 0) - (a.unsold_count || 0);
    if (ongoingSort === 'price') return (b.sale_price_max || 0) - (a.sale_price_max || 0);
    if (ongoingSort === 'competition') return (b.competition_rate || 0) - (a.competition_rate || 0);
    return (b.total_supply || 0) - (a.total_supply || 0);
  });
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paged = sorted.slice((ongoingPage - 1) * PER_PAGE, ongoingPage * PER_PAGE);

  // 지역별 집계
  const regionCounts = regs.filter(r => r !== '전체').map(r => {
    const items = ongoingApts.filter((o: any) => (o.region_nm || '기타') === r);
    const subC = items.filter((o: any) => o.source === 'subscription').length;
    const unsC = items.filter((o: any) => o.source === 'unsold').length;
    return { name: r, count: items.length, subCount: subC, unsoldCount: unsC, unsoldUnits: items.reduce((s: number, o: any) => s + (o.unsold_count || 0), 0) };
  }).sort((a, b) => b.count - a.count);
  const maxRegionCount = Math.max(...regionCounts.map(r => r.count), 1);

  // ① 입주 임박 현장
  const todayD = kstNow();
  const urgentMove = filtered.filter((o: any) => {
    if (!o.mvn_prearnge_ym) return false;
    const mvn = String(o.mvn_prearnge_ym).replace(/[^0-9]/g, '').slice(0, 6);
    if (mvn.length < 6) return false;
    const mvnDate = new Date(parseInt(mvn.slice(0, 4)), parseInt(mvn.slice(4, 6)) - 1, 1);
    const diffMs = mvnDate.getTime() - todayD.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays >= 0 && diffDays <= 90;
  }).map((o: any) => {
    const mvn = String(o.mvn_prearnge_ym).replace(/[^0-9]/g, '').slice(0, 6);
    const mvnDate = new Date(parseInt(mvn.slice(0, 4)), parseInt(mvn.slice(4, 6)) - 1, 1);
    return { ...o, daysToMove: Math.ceil((mvnDate.getTime() - todayD.getTime()) / 86400000) };
  }).sort((a: any, b: any) => a.daysToMove - b.daysToMove);

  // ③ 단계별 파이프라인
  const todayPipe = kstToday();
  const pipeStages = ['청약마감', '당첨발표', '계약중', '공사중', '입주예정'];
  const pipeCounts: Record<string, number> = {};
  pipeStages.forEach(s => { pipeCounts[s] = 0; });
  filtered.forEach((o: any) => {
    if (o.source === 'unsold') { pipeCounts['공사중']++; return; }
    const dates = [o.rcept_endde, o.przwner_presnatn_de, o.cntrct_cncls_endde, o.mvn_prearnge_ym].map(d => d ? String(d).slice(0, 10) : '');
    if (dates[3] && dates[3] <= todayPipe) pipeCounts['입주예정']++;
    else if (dates[2] && dates[2] <= todayPipe) pipeCounts['공사중']++;
    else if (dates[1] && dates[1] <= todayPipe) pipeCounts['계약중']++;
    else if (dates[0] && dates[0] <= todayPipe) pipeCounts['당첨발표']++;
    else pipeCounts['청약마감']++;
  });
  const pipeTotal = filtered.length || 1;
  const pipeColors = ['var(--text-tertiary)', 'var(--accent-blue)', 'var(--accent-yellow)', 'var(--accent-orange)', 'var(--accent-green)'];

  // ④ 분양가 TOP10
  const priceTop = [...filtered].filter(o => o.sale_price_max && o.sale_price_max > 0).sort((a, b) => (b.sale_price_max || 0) - (a.sale_price_max || 0)).slice(0, 10);
  const maxPrice = priceTop[0]?.sale_price_max || 1;

  // 수도권/지방 집계
  const capitalRegions = ['서울', '경기', '인천'];
  const capitalCount = filtered.filter((o: any) => capitalRegions.some(c => (o.region_nm || '').includes(c))).length;
  const localCount = filtered.length - capitalCount;


    return (
    <div>
      {/* 지역별 현황 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-link)' }}>총 {ongoingApts.length}건</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
          <button onClick={() => { setOngoingRegion('전체'); setOngoingPage(1); }} style={{
            padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
            border: ongoingRegion === '전체' ? '2px solid #60A5FA' : '1px solid var(--border)',
            background: ongoingRegion === '전체' ? 'var(--brand-light)' : 'var(--bg-surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: ongoingRegion === '전체' ? '#fff' : 'var(--text-primary)' }}>{ongoingApts.length}</span>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: ongoingRegion === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
          </button>
          {regionCounts.map(r => (
            <button key={r.name} onClick={() => { setOngoingRegion(r.name === ongoingRegion ? '전체' : r.name); setOngoingPage(1); }} style={{
              padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
              border: ongoingRegion === r.name ? '2px solid #60A5FA' : '1px solid var(--border)',
              background: ongoingRegion === r.name ? 'var(--brand-light)' : 'var(--bg-surface)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: ongoingRegion === r.name ? '#fff' : 'var(--text-primary)' }}>{r.count}</span>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: ongoingRegion === r.name ? '#fff' : 'var(--text-secondary)' }}>{r.name}</span>
              <div style={{ display: 'flex', gap: 2, fontSize: 10, color: ongoingRegion === r.name ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>
                {r.subCount > 0 && <span style={{ color: ongoingRegion === r.name ? '#fff' : 'var(--accent-green)' }}>분양{r.subCount}</span>}
                {r.unsoldCount > 0 && <span style={{ color: ongoingRegion === r.name ? '#fff' : 'var(--accent-red)' }}>미분양{r.unsoldCount}</span>}
              </div>
              {r.count > 0 && (
                <div style={{ width: '100%', height: 3, background: ongoingRegion === r.name ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 2, overflow: 'hidden', display: 'flex', marginTop: 2 }}>
                  <div style={{ height: '100%', background: 'var(--accent-blue)', width: `${(r.subCount / r.count) * 100}%` }} />
                  <div style={{ height: '100%', background: 'var(--accent-red)', width: `${(r.unsoldCount / r.count) * 100}%` }} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ① 입주 임박 배너 */}
      {urgentMove.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(96,165,250,0.1))', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--accent-green)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ animation: 'pulse 2s infinite' }}>🏠</span> 입주 임박 ({urgentMove.length}건)
          </div>
          {urgentMove.slice(0, 5).map((o: any) => (
            <div key={o.id} onClick={() => setSelectedOngoing(o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(52,211,153,0.1)', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{o.house_nm}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginLeft: 6 }}>{o.region_nm}</span>
              </div>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: o.daysToMove <= 30 ? 'var(--accent-red)' : 'var(--accent-green)', flexShrink: 0 }}>
                {o.daysToMove <= 30 ? `D-${o.daysToMove}` : `${Math.ceil(o.daysToMove / 30)}개월 후`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 종합 현황 + 수도권/지방 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>🏢 {ongoingRegion !== '전체' ? `${ongoingRegion} ` : ''}분양중 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {[
            { label: '전체', value: filtered.length, color: 'var(--brand)' },
            { label: '분양중', value: allSubCount, color: 'var(--accent-green)' },
            { label: '미분양', value: allUnsoldCount, color: 'var(--accent-red)' },
            { label: '수도권', value: capitalCount, color: 'var(--text-primary)' },
            { label: '지방', value: localCount, color: 'var(--text-primary)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>청약홈 + 국토교통부 미분양 통계 기준</div>
      </div>

      {/* ③ 단계별 파이프라인 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>🏗️ 분양 진행 단계</div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'stretch' }}>
          {pipeStages.map((stage, i) => {
            const count = pipeCounts[stage] || 0;
            const pct = Math.round((count / pipeTotal) * 100);
            return (
              <div key={stage} style={{ flex: Math.max(pct, 10), textAlign: 'center', padding: '8px 2px', borderRadius: 6, background: `${pipeColors[i]}22`, border: `1px solid ${pipeColors[i]}44`, position: 'relative', minWidth: 48 }}>
                <div style={{ fontSize: '9px', fontWeight: 600, color: pipeColors[i] }}>{stage}</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: pipeColors[i], margin: '2px 0' }}>{count}</div>
                <div style={{ fontSize: '8px', color: pipeColors[i], opacity: 0.7 }}>{pct}%</div>
                {i < pipeStages.length - 1 && <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', fontSize: '8px', color: 'var(--text-tertiary)' }}>→</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ④ 분양가 TOP10 바 차트 */}
      {priceTop.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>💰 분양가 TOP {Math.min(priceTop.length, 10)}</div>
          {priceTop.map((d: any, i: number) => {
            const pct = ((d.sale_price_max || 0) / maxPrice) * 100;
            const pAmt = (d.sale_price_max / 10000).toFixed(1);
            return (
              <div key={d.id} onClick={() => setSelectedOngoing(d)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, cursor: 'pointer' }}>
                <div style={{ width: 14, fontSize: '10px', fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', textAlign: 'right' }}>{i + 1}</div>
                <div style={{ width: 80, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{d.house_nm}</div>
                <div style={{ flex: 1, height: 20, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: `hsl(${240 - (pct / 100) * 240}, 70%, 55%)` }} />
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)', minWidth: 40, textAlign: 'right' }}>{pAmt}억</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 검색바 */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input type="text" value={ongoingSearch} onChange={e => { setOngoingSearch(e.target.value); setOngoingPage(1); }} placeholder="단지명, 지역, 시공사 검색..."
          style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>🔍</span>
        {ongoingSearch && <button onClick={() => setOngoingSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>✕</button>}
      </div>

      {/* 정렬 + 상태 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, overflowX: 'auto' }}>
        {([['supply', '세대수순'], ['unsold', '미분양순'], ['price', '분양가순'], ['competition', '경쟁률순']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setOngoingSort(k); setOngoingPage(1); }} style={{
            padding: '3px 10px', borderRadius: 14, fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `1px solid ${ongoingSort === k ? 'var(--brand)' : 'var(--border)'}`,
            background: ongoingSort === k ? 'var(--brand)' : 'transparent',
            color: ongoingSort === k ? '#fff' : 'var(--text-tertiary)',
          }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {['전체', '분양중', '미분양'].map(s => pill(s, ongoingStatus, (v) => { setOngoingStatus(v); setOngoingPage(1); }))}
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 10 }}>
        {ongoingRegion !== '전체' ? `${ongoingRegion} ` : '전체 '}{totalSites}곳{totalUnsoldUnits > 0 ? ` · 미분양 ${totalUnsoldUnits.toLocaleString()}호` : ''}
      </div>

      {/* ⑥⑦ 카드 리스트 (borderLeft + 클릭 모달) */}
      {paged.map((o: any) => {
        const isUnsold = o.source === 'unsold';
        const pMin = o.sale_price_min ? Math.round(o.sale_price_min / 10000 * 10) / 10 : null;
        const pMax = o.sale_price_max ? Math.round(o.sale_price_max / 10000 * 10) / 10 : null;
        const priceStr = pMin ? `${pMin}억${pMax && pMax !== pMin ? `~${pMax}억` : ''}` : null;
        const mvnStr = o.mvn_prearnge_ym ? `${String(o.mvn_prearnge_ym).slice(0, 4)}.${String(o.mvn_prearnge_ym).slice(4, 6)}` : null;
        const wlKey = isUnsold ? `unsold:${o.link_id}` : `sub:${o.link_id}`;
        const isWatched = watchlist.has(wlKey);
        const accentColor = isUnsold ? 'var(--accent-red)' : 'var(--accent-blue)';
        const premiumMatch = premiumListings.find((pl: any) => String(pl.listing_id) === String(o.link_id) && pl.listing_type === (isUnsold ? 'unsold' : 'subscription'));
        const isPremium = !!premiumMatch;

        return (
          <div key={o.id} onClick={() => setSelectedOngoing(o)} style={{
            background: isPremium ? 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(245,158,11,0.03))' : 'var(--bg-surface)',
            border: isPremium ? '1.5px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 8,
            borderLeft: `4px solid ${isPremium ? 'var(--accent-yellow)' : accentColor}`, cursor: 'pointer',
            boxShadow: isPremium ? '0 0 12px rgba(251,191,36,0.08)' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  {isPremium && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', color: '#1a1a1a', marginRight: 4 }}>PREMIUM</span>}
                  {isNew(o, 'ongoing') && <NewBadge />}
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: isUnsold ? 'var(--accent-red-bg)' : 'var(--accent-blue-bg)', color: isUnsold ? 'var(--accent-red)' : 'var(--accent-blue)', border: `1px solid ${isUnsold ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.25)'}` }}>
                    {isUnsold ? '미분양' : '분양중'}
                  </span>
                  {o.competition_rate && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-yellow)' }}>🔥 {o.competition_rate}:1</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{o.region_nm}</span>
                </div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, lineHeight: 1.3 }}>{o.house_nm || '현장명 없음'}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  {o.address ? o.address.replace(/^[^\s]+\s/, '').split(' ').slice(0, 3).join(' ') : ''}
                  {o.total_supply > 0 ? ` · 일반분양 ${o.total_supply.toLocaleString()}세대` : ''}
                  {o.constructor_nm ? ` · ${o.constructor_nm}` : ''}
                  {priceStr ? ` · ${priceStr}` : ''}
                </div>
                {/* 미분양률 바 */}
                {isUnsold && o.unsold_count > 0 && o.total_supply > 0 && (() => {
                  const rate = Math.round((o.unsold_count / o.total_supply) * 100);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? 'var(--accent-red)' : rate > 40 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }} />
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-red)' }}>미분양 {o.unsold_count.toLocaleString()}호 ({rate}%)</span>
                    </div>
                  );
                })()}
                {/* 프로그레스바 */}
                {!isUnsold && (() => {
                  const stages = [
                    { key: 'r', label: '접수', date: o.rcept_bgnde },
                    { key: 'e', label: '마감', date: o.rcept_endde },
                    { key: 'w', label: '당첨', date: o.przwner_presnatn_de },
                    { key: 'c', label: '계약', date: o.cntrct_cncls_bgnde },
                    { key: 'm', label: '입주', date: o.mvn_prearnge_ym },
                  ];
                  const td = kstToday();
                  let ci = 0;
                  stages.forEach((s, i) => { if (s.date && String(s.date).slice(0, 10) <= td) ci = i + 1; });
                  ci = Math.min(ci, stages.length - 1);
                  const pc = Math.min(100, Math.round((ci / (stages.length - 1)) * 100));
                  return (
                    <div style={{ marginTop: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        {stages.map((s, i) => <span key={s.key} style={{ fontSize: '8px', color: i <= ci ? 'var(--brand)' : 'var(--text-tertiary)', fontWeight: i === ci ? 800 : 400 }}>{s.label}</span>)}
                      </div>
                      <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${pc}%`, background: 'var(--brand)' }} />
                      </div>
                    </div>
                  );
                })()}
                {/* 인근 시세 비교 */}
                {o.nearby_avg_price && o.sale_price_min && (() => {
                  const diff = Math.round(((o.nearby_avg_price - o.sale_price_min) / o.nearby_avg_price) * 100);
                  return diff > 0 ? <div style={{ marginTop: 4, fontSize: '10px', color: 'var(--accent-green)', fontWeight: 600 }}>📊 인근 시세 대비 약 {diff}% 저렴</div> : null;
                })()}
                {/* 프리미엄 상담사 CTA */}
                {isPremium && premiumMatch?.consultant && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, lineHeight: 1 }}>👔</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-yellow)' }}>
                        {premiumMatch.consultant.is_verified && <span style={{ marginRight: 3 }}>✓</span>}
                        {premiumMatch.consultant.company || '분양 상담사'} · {premiumMatch.consultant.name}
                      </div>
                      {premiumMatch.description && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{premiumMatch.description}</div>}
                    </div>
                    {(premiumMatch.cta_phone || premiumMatch.consultant.phone) && (
                      <a href={`tel:${premiumMatch.cta_phone || premiumMatch.consultant.phone}`} onClick={() => { fetch('/api/consultant/listing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: premiumMatch.id, type: 'phone' }) }).catch(() => {}); }} style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-yellow)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(251,191,36,0.3)', textDecoration: 'none', whiteSpace: 'nowrap' }}>📞 상담</a>
                    )}
                  </div>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(isUnsold ? 'unsold' : 'sub', String(o.link_id)); }} style={{
                fontSize: 'var(--fs-lg)', background: isWatched ? 'var(--accent-yellow-bg)' : 'transparent',
                border: isWatched ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)',
                borderRadius: 8, padding: '2px 6px', cursor: 'pointer', lineHeight: 1,
              }}>{isWatched ? '⭐' : '☆'}</button>
            </div>
          </div>
        );
      })}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 12 }}>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setOngoingPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${ongoingPage === p ? 'var(--brand)' : 'var(--border)'}`,
              background: ongoingPage === p ? 'var(--brand)' : 'transparent',
              color: ongoingPage === p ? '#fff' : 'var(--text-tertiary)',
            }}>{p}</button>
          ))}
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
        청약홈·국토교통부 미분양 통계 기준 · 청약 마감 후 입주 전 현장 + 미분양 현장 통합 · 정확한 분양 정보는 각 현장에 직접 확인하세요
      </p>

      {/* 상담사 CTA 배너 */}
      <a href="/consultant" style={{
        display: 'block', marginTop: 16, padding: 20, borderRadius: 14, textDecoration: 'none',
        background: 'linear-gradient(135deg, var(--accent-purple-bg), var(--accent-blue-bg))',
        border: '1px solid rgba(167,139,250,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 32, lineHeight: 1 }}>🏢</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>분양 상담사이신가요?</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>프리미엄 리스팅으로 분양 관심 고객에게 직접 노출되세요. 월 4.9만원~</div>
          </div>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-purple)', fontWeight: 700, flexShrink: 0 }}>등록 →</span>
        </div>
      </a>

      {/* ⑦ 모달 상세 */}
      {selectedOngoing && (() => {
        const o = selectedOngoing;
        const isU = o.source === 'unsold';
        const pMin = o.sale_price_min ? (o.sale_price_min / 10000).toFixed(1) : null;
        const pMax = o.sale_price_max ? (o.sale_price_max / 10000).toFixed(1) : null;
        const mvn = o.mvn_prearnge_ym ? `${String(o.mvn_prearnge_ym).slice(0, 4)}년 ${parseInt(String(o.mvn_prearnge_ym).slice(4, 6))}월` : null;
        const linkH = isU ? `/apt/unsold/${o.link_id}` : `/apt/${o.link_id}`;
        return (
          <BottomSheet open={!!selectedOngoing} onClose={() => setSelectedOngoing(null)} title={o.house_nm}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isU ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)', color: isU ? 'var(--accent-red)' : 'var(--accent-green)' }}>{isU ? '미분양' : '분양중'}</span>
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>{o.region_nm}{o.address ? ` · ${o.address}` : ''}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  ['공급 세대수', o.total_supply > 0 ? `${o.total_supply.toLocaleString()}세대 (일반분양)` : '-'],
                  ['미분양', o.unsold_count ? `${o.unsold_count.toLocaleString()}호` : '-'],
                  ['분양가', pMin ? `${pMin}${pMax && pMax !== pMin ? `~${pMax}` : ''}억` : '-'],
                  ['입주예정', mvn || '-'],
                  ['시공사', o.constructor_nm || '-'],
                  ['경쟁률', o.competition_rate ? `${o.competition_rate}:1` : '-'],
                ].map(([label, value]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{label}</span>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {o.nearby_avg_price && o.sale_price_min && (() => {
                const diff = Math.round(((o.nearby_avg_price - o.sale_price_min) / o.nearby_avg_price) * 100);
                return diff > 0 ? (
                  <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-green)' }}>📊 인근 시세 대비 약 {diff}% 저렴</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>지역 평균 실거래가 {(o.nearby_avg_price / 10000).toFixed(1)}억 기준</div>
                  </div>
                ) : null;
              })()}

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <a href={linkH} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>자세히 보기 →</a>
                {o.pblanc_url && <a href={o.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>공고 보기</a>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setSelectedOngoing(null); toggleWatchlist(isU ? 'unsold' : 'sub', String(o.link_id)); }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer' }}>⭐ 관심단지</button>
                <button onClick={() => { setSelectedOngoing(null); setCommentTarget({ houseKey: isU ? `unsold_${o.link_id}` : `sub_${o.link_id}`, houseNm: o.house_nm || '현장', houseType: isU ? 'unsold' : 'sub' }); }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer' }}>💬 한줄평</button>
              </div>
              {/* 지도 버튼 */}
              {(o.address || o.house_nm) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <a href={`https://map.kakao.com/?q=${encodeURIComponent(o.address || o.house_nm)}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>🗺️ 카카오맵</a>
                  <a href={`https://map.naver.com/p/search/${encodeURIComponent(o.address || o.house_nm)}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>🗺️ 네이버지도</a>
                </div>
              )}
          </BottomSheet>
        );
      })()}
    </div>
  );

}
