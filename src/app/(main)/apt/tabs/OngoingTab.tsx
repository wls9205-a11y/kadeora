'use client';
import SectionShareButton from '@/components/SectionShareButton';
import type { OngoingApt, PremiumListing } from '@/types/apt';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isNew, NewBadge, kstNow, kstToday, generateAptSlug, type SharedTabProps } from './apt-utils';
import dynamic from 'next/dynamic';

const BottomSheet = dynamic(() => import('@/components/BottomSheet'), { ssr: false });

interface Props extends SharedTabProps {
  ongoingApts: OngoingApt[];
  premiumListings: PremiumListing[];
  freshDate?: string;
}

export default function OngoingTab({ ongoingApts, premiumListings, watchlist, toggleWatchlist, setCommentTarget, globalRegion, globalSearch, freshDate }: Props) {
  const [ongoingRegion, setOngoingRegion] = useState(globalRegion || '전체');
  const [ongoingPage, setOngoingPage] = useState(1);
  const [ongoingSort, setOngoingSort] = useState<'supply'|'unsold'|'price'|'competition'>('supply');
  const [ongoingSearch, setOngoingSearch] = useState('');
  const [ongoingStatus, setOngoingStatus] = useState('전체');
  const [selectedOngoing, setSelectedOngoing] = useState<any | null>(null);
  const effectiveSearch = globalSearch || ongoingSearch;

  useEffect(() => {
    setOngoingRegion(globalRegion || '전체');
    setOngoingPage(1);
  }, [globalRegion]);

  const pill = (v: string, sel: string, set: (v: string) => void, label?: string) => (
    <button key={v} onClick={() => set(v)} style={{
      padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600,
      background: sel === v ? 'var(--brand)' : 'var(--bg-hover)',
      color: sel === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
      border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>
      {label || v}
    </button>
  );

  if (!ongoingApts.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>🏢 분양중 데이터를 수집 중입니다<br/><span style={{ fontSize: 'var(--fs-sm)' }}>청약 마감 후 입주 전 현장 및 미분양 현장이 표시됩니다</span></div>;

  const regs = ['전체', ...Array.from(new Set(ongoingApts.map((o) => o.region_nm || '기타'))).sort()];
  let filtered = ongoingRegion === '전체' ? ongoingApts : ongoingApts.filter((o) => (o.region_nm || '기타') === ongoingRegion);
  if (effectiveSearch.trim()) {
    const q = effectiveSearch.trim().toLowerCase();
    filtered = filtered.filter((o) => (o.house_nm || '').toLowerCase().includes(q) || (o.address || '').toLowerCase().includes(q) || (o.region_nm || '').toLowerCase().includes(q) || (o.constructor_nm || '').toLowerCase().includes(q));
  }
  if (ongoingStatus !== '전체') filtered = filtered.filter((o) => ongoingStatus === '미분양' ? o.source === 'unsold' : o.source === 'subscription');
  const totalSites = filtered.length;
  const totalUnsoldUnits = filtered.reduce((s: number, o) => s + (o.unsold_count || 0), 0);
  const allSubCount = filtered.filter((o) => o.source === 'subscription').length;
  const allUnsoldCount = filtered.filter((o) => o.source === 'unsold').length;
  const PER_PAGE = 30;
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
    const items = ongoingApts.filter((o) => (o.region_nm || '기타') === r);
    const subC = items.filter((o) => o.source === 'subscription').length;
    const unsC = items.filter((o) => o.source === 'unsold').length;
    return { name: r, count: items.length, subCount: subC, unsoldCount: unsC, unsoldUnits: items.reduce((s: number, o) => s + (o.unsold_count || 0), 0) };
  }).sort((a, b) => b.count - a.count);

  // ① 입주 임박 현장
  const todayD = kstNow();
  const urgentMove = filtered.filter((o) => {
    if (!o.mvn_prearnge_ym) return false;
    const mvn = String(o.mvn_prearnge_ym).replace(/[^0-9]/g, '').slice(0, 6);
    if (mvn.length < 6) return false;
    const mvnDate = new Date(parseInt(mvn.slice(0, 4)), parseInt(mvn.slice(4, 6)) - 1, 1);
    const diffMs = mvnDate.getTime() - todayD.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays >= 0 && diffDays <= 90;
  }).map((o) => {
    const mvn = String(o.mvn_prearnge_ym).replace(/[^0-9]/g, '').slice(0, 6);
    const mvnDate = new Date(parseInt(mvn.slice(0, 4)), parseInt(mvn.slice(4, 6)) - 1, 1);
    return { ...o, daysToMove: Math.ceil((mvnDate.getTime() - todayD.getTime()) / 86400000) };
  }).sort((a, b) => a.daysToMove - b.daysToMove);

  // ③ 단계별 파이프라인
  const todayPipe = kstToday();
  const pipeStages = ['청약마감', '당첨발표', '계약중', '공사중', '입주예정'];
  const pipeCounts: Record<string, number> = {};
  pipeStages.forEach(s => { pipeCounts[s] = 0; });
  filtered.forEach((o) => {
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
  const capitalCount = filtered.filter((o) => capitalRegions.some(c => (o.region_nm || '').includes(c))).length;
  const localCount = filtered.length - capitalCount;


    return (
    <div>
      {/* 정렬 + 상태 필터 한 줄 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <select value={ongoingSort} onChange={e => { setOngoingSort(e.target.value as typeof ongoingSort); setOngoingPage(1); }} style={{
          padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
        }}>
          <option value="supply">세대수순</option>
          <option value="unsold">미분양순</option>
          <option value="price">분양가순</option>
          <option value="competition">경쟁률순</option>
        </select>
        <div style={{ display: 'flex', gap: 3, flex: 1, justifyContent: 'flex-end' }}>
          {(['전체', '분양중', '미분양'] as const).map(s => (
            <button key={s} onClick={() => { setOngoingStatus(s); setOngoingPage(1); }} style={{
              padding: '4px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: ongoingStatus === s ? 'var(--brand)' : 'var(--bg-hover)',
              color: ongoingStatus === s ? '#fff' : 'var(--text-secondary)',
            }}>{s}{s === '전체' ? ` ${totalSites}` : s === '분양중' ? ` ${allSubCount}` : ` ${allUnsoldCount}`}</button>
          ))}
        </div>
      </div>


      {/* ⑥⑦ 카드 리스트 (borderLeft + 클릭 모달) */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
          {effectiveSearch ? `"${effectiveSearch}" 검색 결과가 없습니다` : '조건에 맞는 분양 현장이 없습니다'}
          {effectiveSearch && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>단지명, 지역, 시공사로 검색해보세요</div>}
        </div>
      )}
      <div className="listing-grid">
      {paged.map((o) => {
        const isUnsold = o.source === 'unsold';
        const pMin = o.sale_price_min ? Math.round(o.sale_price_min / 10000 * 10) / 10 : null;
        const pMax = o.sale_price_max ? Math.round(o.sale_price_max / 10000 * 10) / 10 : null;
        const priceStr = pMin ? `${pMin}억${pMax && pMax !== pMin ? `~${pMax}억` : ''}` : null;
        const wlKey = isUnsold ? `unsold:${o.link_id}` : `sub:${o.link_id}`;
        const isWatched = watchlist.has(wlKey);
        const accentColor = isUnsold ? 'var(--accent-red)' : 'var(--accent-blue)';
        const premiumMatch = premiumListings.find((pl) => String(pl.listing_id) === String(o.link_id) && pl.listing_type === (isUnsold ? 'unsold' : 'subscription'));
        const isPremium = !!premiumMatch;

        const linkH = `/apt/${encodeURIComponent(generateAptSlug(o.house_nm) || String(o.link_id))}`;
        return (
          <Link key={o.id} href={linkH} className="kd-card-hover" style={{
            display: 'block', textDecoration: 'none', color: 'inherit',
            background: isPremium ? 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(245,158,11,0.03))' : 'var(--bg-surface)',
            border: isPremium ? '1.5px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--sp-md) var(--card-p)',
            borderLeft: `4px solid ${isPremium ? 'var(--accent-yellow)' : accentColor}`,
            boxShadow: isPremium ? '0 0 12px rgba(251,191,36,0.08)' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-sm)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  {isPremium && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'linear-gradient(135deg,#FFD43B,#F59E0B)', color: 'var(--bg-base)', marginRight: 4 }}>PREMIUM</span>}
                  {isNew(o, 'ongoing') && <NewBadge />}
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: isUnsold ? 'var(--accent-red-bg)' : 'var(--accent-blue-bg)', color: isUnsold ? 'var(--accent-red)' : 'var(--accent-blue)', border: `1px solid ${isUnsold ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.25)'}` }}>
                    {isUnsold ? '미분양' : '분양중'}
                  </span>
                  {o.competition_rate && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent-yellow)' }}>🔥 {o.competition_rate}:1</span>}
                  {(o as any).brand_name && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,123,246,0.08)', color: 'var(--brand)' }}>{(o as any).brand_name}</span>}
                  {(o as any).project_type && (o as any).project_type !== '민간' && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: (o as any).project_type === '재개발' ? 'rgba(251,146,60,0.1)' : (o as any).project_type === '재건축' ? 'rgba(167,139,250,0.1)' : 'rgba(52,211,153,0.1)', color: (o as any).project_type === '재개발' ? 'var(--accent-orange)' : (o as any).project_type === '재건축' ? 'var(--accent-purple)' : 'var(--accent-green)' }}>{(o as any).project_type}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{o.region_nm}</span>
                </div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>{o.house_nm || '현장명 없음'}</div>
                {/* KPI 8칸 그리드 (4x2) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, marginBottom: 1, background: 'var(--bg-hover)', borderRadius: '6px 6px 0 0', overflow: 'hidden' }}>
                  {[
                    { l: '분양가', v: priceStr || '-', c: priceStr ? 'var(--brand)' : 'var(--text-tertiary)' },
                    { l: '평당가', v: (o as any).price_per_pyeong_avg ? `${Math.round((o as any).price_per_pyeong_avg).toLocaleString()}만` : '-', c: (o as any).price_per_pyeong_avg ? 'var(--accent-purple)' : 'var(--text-tertiary)' },
                    { l: '세대수', v: (o.total_supply ?? 0) > 0 ? (o.total_supply ?? 0).toLocaleString() : '-', c: 'var(--text-primary)' },
                    { l: '입주', v: o.mvn_prearnge_ym ? `${String(o.mvn_prearnge_ym).slice(2, 4)}.${String(o.mvn_prearnge_ym).slice(4, 6)}` : '-', c: o.mvn_prearnge_ym ? 'var(--accent-green)' : 'var(--text-tertiary)' },
                  ].map((k, ki) => <div key={ki} style={{ textAlign: 'center', padding: '5px 2px', background: 'var(--bg-surface)' }}><div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 1 }}>{k.l}</div><div style={{ fontSize: 11, fontWeight: 800, color: k.c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.v}</div></div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, marginBottom: 5, background: 'var(--bg-hover)', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                  {[
                    { l: isUnsold ? '미분양' : '취득세', v: isUnsold ? `${(o.unsold_count ?? 0).toLocaleString()}호` : ((o as any).acquisition_tax_est ? `~${Math.round((o as any).acquisition_tax_est / 10000).toLocaleString()}만` : '-'), c: isUnsold ? 'var(--accent-red)' : ((o as any).acquisition_tax_est ? 'var(--accent-yellow)' : 'var(--text-tertiary)') },
                    { l: '계약금', v: (o as any).down_payment_pct ? `${(o as any).down_payment_pct}%` : '-', c: 'var(--text-primary)' },
                    { l: '시공사', v: o.constructor_nm ? o.constructor_nm.split('(')[0].split('주식')[0].trim().slice(0, 6) : '-', c: 'var(--text-primary)' },
                    { l: o.daysToMove ? 'D-입주' : '경쟁률', v: o.daysToMove ? `D-${o.daysToMove}` : (o.competition_rate ? `${o.competition_rate}:1` : '-'), c: o.daysToMove ? 'var(--accent-yellow)' : (o.competition_rate ? 'var(--accent-yellow)' : 'var(--text-tertiary)') },
                  ].map((k, ki) => <div key={ki} style={{ textAlign: 'center', padding: '5px 2px', background: 'var(--bg-surface)' }}><div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 1 }}>{k.l}</div><div style={{ fontSize: 11, fontWeight: 700, color: k.c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.v}</div></div>)}
                </div>
                {/* 중도금 대출 배지 */}
                {(o as any).loan_rate && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: (o as any).loan_rate.includes('무이자') ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)', color: (o as any).loan_rate.includes('무이자') ? 'var(--accent-green)' : 'var(--accent-yellow)', fontWeight: 600, marginBottom: 4, display: 'inline-block' }}>
                    중도금 {(o as any).loan_rate}
                  </span>
                )}
                {/* 분양가 범위 바 */}
                {pMin && pMax && pMin !== pMax && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-xs)' }}>
                    <span style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 600 }}>{pMin}억</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'linear-gradient(90deg, rgba(96,165,250,0.3), var(--brand), rgba(248,113,113,0.3))', position: 'relative', maxWidth: 120 }}>
                      <div style={{ position: 'absolute', top: -1, left: '50%', width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', border: '1px solid var(--bg-surface)', transform: 'translateX(-50%)' }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--accent-red)', fontWeight: 600 }}>{pMax}억</span>
                  </div>
                )}
                {/* 미분양률 바 */}
                {isUnsold && (o.unsold_count ?? 0) > 0 && (o.total_supply ?? 0) > 0 && (() => {
                  const rate = Math.round(((o.unsold_count ?? 0) / (o.total_supply ?? 1)) * 100);
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-xs)' }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? 'var(--accent-red)' : rate > 40 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }} />
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-red)' }}>미분양 {(o.unsold_count ?? 0).toLocaleString()}호 ({rate}%)</span>
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
                  return diff > 0 ? <div style={{ marginTop: 'var(--sp-xs)', fontSize: '10px', color: 'var(--accent-green)', fontWeight: 600 }}>📊 인근 시세 대비 약 {diff}% 저렴</div> : null;
                })()}
                {/* 프리미엄 상담사 CTA */}
                {isPremium && premiumMatch?.consultant && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6, padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                    <span style={{ fontSize: 12, lineHeight: 1 }}>👔</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent-yellow)' }}>
                        {premiumMatch.consultant.is_verified && <span style={{ marginRight: 3 }}>✓</span>}
                        {premiumMatch.consultant.company || '분양 상담사'} · {premiumMatch.consultant.name}
                      </div>
                      {premiumMatch.description && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{premiumMatch.description}</div>}
                    </div>
                    {(premiumMatch.cta_phone || premiumMatch.consultant.phone) && (
                      <a href={`tel:${premiumMatch.cta_phone || premiumMatch.consultant.phone}`} onClick={() => { fetch('/api/consultant/listing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: premiumMatch.id, type: 'phone' }) }).catch(() => {}); }} style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent-yellow)', padding: '3px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid rgba(251,191,36,0.3)', textDecoration: 'none', whiteSpace: 'nowrap' }}>📞 상담</a>
                    )}
                  </div>
                )}
              </div>
              <a href={`${linkH}#interest-section`} onClick={(e) => e.stopPropagation()} aria-label="관심등록" style={{
                fontSize: 'var(--fs-lg)', background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '2px 6px', cursor: 'pointer', lineHeight: 1,
                textDecoration: 'none', color: 'var(--text-tertiary)',
              }}>☆</a>
            </div>
          </Link>
        );
      })}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-xs)', marginTop: 'var(--sp-md)' }}>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setOngoingPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
              padding: '6px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${ongoingPage === p ? 'var(--brand)' : 'var(--border)'}`,
              background: ongoingPage === p ? 'var(--brand)' : 'transparent',
              color: ongoingPage === p ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            }}>{p}</button>
          ))}
        </div>
      )}

      {/* ① 입주 임박 배너 */}
      {urgentMove.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(96,165,250,0.1))', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 'var(--radius-card)', padding: 14, marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--accent-green)', marginBottom: 'var(--sp-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ animation: 'pulse 2s infinite' }}>🏠</span> 입주 임박 ({urgentMove.length}건)
          </div>
          {urgentMove.slice(0, 5).map((o) => (
            <Link key={o.id} href={`/apt/${encodeURIComponent(generateAptSlug(o.house_nm) || String(o.link_id))}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(52,211,153,0.1)', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{o.house_nm}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginLeft: 6 }}>{o.region_nm}</span>
              </div>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: o.daysToMove <= 30 ? 'var(--accent-red)' : 'var(--accent-green)', flexShrink: 0 }}>
                {o.daysToMove <= 30 ? `D-${o.daysToMove}` : `${Math.ceil(o.daysToMove / 30)}개월 후`}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* 종합 현황 + 수도권/지방 */}
      <div className="kd-card" style={{ marginBottom: 'var(--sp-md)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>🏢 {ongoingRegion !== '전체' ? `${ongoingRegion} ` : ''}분양중 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: 6 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-sm)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>청약홈 + 국토교통부 미분양 통계 기준{freshDate ? ` · ${freshDate} 수집` : ''}</div>
          <SectionShareButton section="apt-ongoing" label="분양중 아파트 현황 — 분양가·시공사·미분양 한눈에" pagePath="/apt?tab=ongoing" />
        </div>
      </div>

      {/* ③ 단계별 파이프라인 */}
      <div className="kd-card" style={{ marginBottom: 'var(--sp-md)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>🏗️ 분양 진행 단계</div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'stretch' }}>
          {pipeStages.map((stage, i) => {
            const count = pipeCounts[stage] || 0;
            const pct = Math.round((count / pipeTotal) * 100);
            return (
              <div key={stage} style={{ flex: Math.max(pct, 10), textAlign: 'center', padding: '8px 2px', borderRadius: 'var(--radius-xs)', background: `${pipeColors[i]}22`, border: `1px solid ${pipeColors[i]}44`, position: 'relative', minWidth: 48 }}>
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
        <div className="kd-card" style={{ marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>💰 분양가 TOP {Math.min(priceTop.length, 10)}</div>
          {priceTop.map((d, i: number) => {
            const pct = ((d.sale_price_max || 0) / maxPrice) * 100;
            const pAmt = ((d.sale_price_max ?? 0) / 10000).toFixed(1);
            return (
              <Link key={d.id} href={`/apt/${encodeURIComponent(generateAptSlug(d.house_nm) || String(d.link_id))}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: 14, fontSize: '10px', fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', textAlign: 'right' }}>{i + 1}</div>
                <div style={{ width: 80, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{d.house_nm}</div>
                <div style={{ flex: 1, height: 20, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: `hsl(${240 - (pct / 100) * 240}, 70%, 55%)` }} />
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)', minWidth: 40, textAlign: 'right' }}>{pAmt}억</div>
              </Link>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-md)', textAlign: 'center' }}>
        청약홈·국토교통부 미분양 통계 기준{freshDate ? ` · ${freshDate} 수집` : ''} · 청약 마감 후 입주 전 현장 + 미분양 현장 통합 · 정확한 분양 정보는 각 현장에 직접 확인하세요
      </p>

      {/* 상담사 CTA 배너 — 유저 100명 이후 오픈 예정 */}

      {/* ⑦ 모달 상세 */}
      {selectedOngoing && (() => {
        const o = selectedOngoing;
        const isU = o.source === 'unsold';
        const pMin = o.sale_price_min ? (o.sale_price_min / 10000).toFixed(1) : null;
        const pMax = o.sale_price_max ? (o.sale_price_max / 10000).toFixed(1) : null;
        const mvn = o.mvn_prearnge_ym ? `${String(o.mvn_prearnge_ym).slice(0, 4)}년 ${parseInt(String(o.mvn_prearnge_ym).slice(4, 6))}월` : null;
        const linkH = `/apt/${encodeURIComponent(generateAptSlug(o.house_nm) || String(o.link_id))}`;
        return (
          <BottomSheet open={!!selectedOngoing} onClose={() => setSelectedOngoing(null)} title={o.house_nm}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-md)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: isU ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)', color: isU ? 'var(--accent-red)' : 'var(--accent-green)' }}>{isU ? '미분양' : '분양중'}</span>
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>{o.region_nm}{o.address ? ` · ${o.address}` : ''}</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
                {[
                  ['공급 세대수', (o.total_supply ?? 0) > 0 ? (() => {
                    const types = Array.isArray((o as any).house_type_info) ? (o as any).house_type_info : [];
                    const gen = types.reduce((s: number, t: any) => s + (t.supply || 0), 0);
                    const spe = types.reduce((s: number, t: any) => s + (t.spsply_hshldco || 0), 0);
                    return gen > 0 ? `총 ${(o.total_supply ?? 0).toLocaleString()}세대\n(일반${gen}·특별${spe})` : `총 ${(o.total_supply ?? 0).toLocaleString()}세대`;
                  })() : '-'],
                  ['미분양', o.unsold_count ? `${(o.unsold_count ?? 0).toLocaleString()}호` : '-'],
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
                  <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 'var(--sp-lg)' }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-green)' }}>📊 인근 시세 대비 약 {diff}% 저렴</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>지역 평균 실거래가 {(o.nearby_avg_price / 10000).toFixed(1)}억 기준</div>
                  </div>
                ) : null;
              })()}

              <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
                <a href={linkH} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>자세히 보기 →</a>
                {o.pblanc_url && <a href={o.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>공고 보기</a>}
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
                <a href={`${linkH}#interest-section`} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>☆ 관심등록</a>
                <button onClick={() => { setSelectedOngoing(null); setCommentTarget({ houseKey: isU ? `unsold_${o.link_id}` : `sub_${o.link_id}`, houseNm: o.house_nm || '현장', houseType: isU ? 'unsold' : 'sub' }); }} style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer' }}>💬 한줄평</button>
              </div>
              {/* 지도 버튼 */}
              {(o.address || o.house_nm) && (
                <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 'var(--sp-sm)' }}>
                  <a href={`https://map.kakao.com/?q=${encodeURIComponent(o.address || o.house_nm)}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>🗺️ 카카오맵</a>
                  <a href={`https://map.naver.com/p/search/${encodeURIComponent(o.address || o.house_nm)}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>🗺️ 네이버지도</a>
                </div>
              )}
          </BottomSheet>
        );
      })()}
    </div>
  );

}
