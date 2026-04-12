'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { haptic } from '@/lib/haptic';
import { isTossMode } from '@/lib/toss-mode';
import TossTeaser from '@/components/TossTeaser';
import { type Apt, getStatus, fmtD, kstNow, isNew, NewBadge, STATUS_BADGE, generateAptSlug, type SharedTabProps } from './apt-utils';
import SectionShareButton from '@/components/SectionShareButton';

interface Props extends SharedTabProps {
  apts: Apt[];
  alertCounts: Record<string, number>;
  regionStats: { name: string; total: number; open: number; upcoming: number; closed: number }[];
  subTotalCount?: number;
  freshDate?: string;
}

const SB = STATUS_BADGE;

export default function SubscriptionTab({ apts, alertCounts, regionStats, aptUser, watchlist, toggleWatchlist, setCommentTarget: _setCommentTarget, showToast: _showToast, globalRegion, globalSearch, subTotalCount, freshDate, aptImageMap }: Props) {
  const [region, setRegion] = useState(globalRegion || '전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [aptSort, setAptSort] = useState<'date'|'supply'|'deadline'|'competition'|'price'>('date');
  const [subSearch, setSubSearch] = useState('');
  const [calOffset, setCalOffset] = useState(0);
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [myAlerts, setMyAlerts] = useState<Set<string>>(new Set());
  const [subPage, setSubPage] = useState(1);
  const effectiveSearch = globalSearch || subSearch;

  // globalRegion 변경 시 내부 필터 동기화
  useEffect(() => {
    setRegion(globalRegion || '전체');
  }, [globalRegion]);

  const pill = (v: string, sel: string, set: (v: string) => void, label?: string) => (
    <button aria-label="닫기" key={v} onClick={() => set(v)} style={{
      padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600,
      background: sel === v ? 'var(--brand)' : 'var(--bg-hover)',
      color: sel === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
      border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>
      {label || v}
    </button>
  );

  const _availableRegions = useMemo(() => ['전체', ...Array.from(new Set(apts.map(a => a.region_nm).filter(Boolean))).sort()], [apts]);
  const filtered = useMemo(() => {
    const f = apts.filter(a => {
      if (region !== '전체' && a.region_nm !== region) return false;
      if (statusFilter !== '전체' && getStatus(a) !== statusFilter) return false;
      if (effectiveSearch) {
        const q = effectiveSearch.toLowerCase();
        if (!(a.house_nm || '').toLowerCase().includes(q) && !(a.region_nm || '').toLowerCase().includes(q) && !(a.hssply_adres || '').toLowerCase().includes(q) && !(a.constructor_nm || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (aptSort === 'supply') f.sort((a, b) => (b.tot_supply_hshld_co || 0) - (a.tot_supply_hshld_co || 0));
    if (aptSort === 'deadline') f.sort((a, b) => String(a.rcept_endde || '9999').localeCompare(String(b.rcept_endde || '9999')));
    if (aptSort === 'competition') f.sort((a, b) => (Number(b.competition_rate_1st) || 0) - (Number(a.competition_rate_1st) || 0));
    if (aptSort === 'price') f.sort((a, b) => {
      const getMax = (apt: any) => {
        const hti = apt.house_type_info;
        if (!hti || !Array.isArray(hti) || hti.length === 0) return 0;
        return Math.max(...hti.map((t: any) => t.lttot_top_amount || 0));
      };
      return getMax(b) - getMax(a);
    });
    return f;
  }, [apts, region, statusFilter, aptSort, effectiveSearch]);

  // 페이지네이션 (30개씩)
  const SUB_PER_PAGE = 30;
  const subTotalPages = Math.ceil(filtered.length / SUB_PER_PAGE);
  const paged = (typeof window !== 'undefined' && isTossMode())
    ? filtered.slice(0, 5)
    : filtered.slice((subPage - 1) * SUB_PER_PAGE, subPage * SUB_PER_PAGE);

  // 필터 변경 시 1페이지로 리셋
  useEffect(() => { setSubPage(1); }, [region, statusFilter, aptSort, effectiveSearch]);

  const _toggleAlert = async (apt: Apt) => {
    if (!aptUser) return;
    const sb = createSupabaseBrowser();
    const h = apt.house_manage_no || String(apt.id);
    if (myAlerts.has(h)) {
      await sb.from('apt_alerts').delete().eq('user_id', aptUser.id).eq('house_manage_no', h);
      setMyAlerts(p => { const s = new Set(p); s.delete(h); return s; });
    } else {
      await sb.from('apt_alerts').insert({ user_id: aptUser.id, house_manage_no: h, house_nm: apt.house_nm });
      setMyAlerts(p => new Set([...p, h]));
    }
    haptic('light');
  };

  return (
        <div>
          {/* 정렬 + 상태 필터 한 줄 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-sm)', alignItems: 'center' }}>
            <select value={aptSort} onChange={e => setAptSort(e.target.value as typeof aptSort)} style={{
              padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
            }}>
              <option value="date">최신순</option>
              <option value="deadline">마감임박</option>
              <option value="supply">세대수</option>
              <option value="competition">경쟁률</option>
              <option value="price">분양가순</option>
            </select>
            <div style={{ display: 'flex', gap: 3, flex: 1, justifyContent: 'flex-end' }}>
              {(['전체', 'open', 'upcoming', 'closed'] as const).map(v => {
                const labels: Record<string, string> = { '전체': '전체', 'open': '접수중', 'upcoming': '예정', 'closed': '마감' };
                const counts: Record<string, number> = {
                  '전체': (region === '전체' && !effectiveSearch && subTotalCount) ? subTotalCount : filtered.length,
                  'open': filtered.filter(a => getStatus(a) === 'open').length,
                  'upcoming': filtered.filter(a => getStatus(a) === 'upcoming').length,
                  'closed': filtered.filter(a => getStatus(a) === 'closed').length,
                };
                return (
                  <button aria-label="닫기" key={v} onClick={() => setStatusFilter(v)} style={{
                    padding: '4px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: statusFilter === v ? 'var(--brand)' : 'var(--bg-hover)',
                    color: statusFilter === v ? '#fff' : 'var(--text-secondary)',
                  }}>
                    {labels[v]}{counts[v] > 0 ? ` ${counts[v]}` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>{effectiveSearch ? `"${effectiveSearch}" 검색 결과가 없습니다` : '조건에 맞는 청약이 없습니다'}{effectiveSearch && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>단지명, 지역, 시공사로 검색해보세요</div>}</div>}

          <div className="listing-grid">
          {paged.map((apt, i) => {
            const st = getStatus(apt);
            const bd = SB[st];
            const h = apt.house_manage_no || String(apt.id);
            const _ac = alertCounts[h] || 0;
            const _my = myAlerts.has(h);
            const dday = (() => {
              if (st === 'open' && apt.rcept_endde) return Math.ceil((new Date(apt.rcept_endde).getTime() - Date.now()) / 86400000);
              if (st === 'upcoming' && apt.rcept_bgnde) return Math.ceil((new Date(apt.rcept_bgnde).getTime() - Date.now()) / 86400000);
              return null;
            })();

            const _accentColor = st === 'open' ? 'var(--accent-green)' : st === 'upcoming' ? 'var(--accent-blue)' : 'var(--border)';
            // 간략 주소: 전체 주소에서 구+동 추출
            const shortAddr = apt.hssply_adres ? apt.hssply_adres.replace(/^[^\s]+\s/, '').split(' ').slice(0, 3).join(' ') : '';
            return (
              <Link key={apt.id} href={`/apt/${encodeURIComponent(generateAptSlug(apt.house_nm) || apt.house_manage_no || String(apt.id))}`} className="kd-card-hover" style={{
                display: 'block', borderRadius: 'var(--radius-card)', overflow: 'hidden',
                background: 'var(--bg-surface)',
                border: st === 'open' ? '1.5px solid rgba(96,165,250,0.35)' : '1px solid var(--border)',
                boxShadow: st === 'open' ? '0 0 16px rgba(59,123,246,0.08)' : undefined,
                opacity: 1,
                textDecoration: 'none', color: 'inherit',
              }}>
                {/* ⓪ OG 이미지 스트립 */}
                <div style={{ height: 56, background: 'var(--bg-hover)', position: 'relative', overflow: 'hidden' }}>
                  <img src={aptImageMap?.[apt.house_nm] || `/api/og?title=${encodeURIComponent(apt.house_nm)}&category=apt&design=2`} alt={apt.house_nm || "부동산 이미지"} width={400} height={56} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.85 }} loading="lazy" />
                  <div style={{ position: 'absolute', top: 6, left: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: st === 'open' ? 'rgba(54,240,176,0.9)' : st === 'upcoming' ? 'rgba(74,138,247,0.9)' : 'rgba(148,163,184,0.8)', color: '#fff', lineHeight: '16px' }}>{bd.label}</span>
                  </div>
                  {dday !== null && dday >= 0 && st !== 'closed' && (
                    <div style={{ position: 'absolute', bottom: 5, right: 8, fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>
                      {st === 'open' ? (dday === 0 ? '오늘 마감' : `D-${dday}`) : `D-${dday}`}
                    </div>
                  )}
                </div>
                {/* ① 헤더: 배지 + 경쟁률 링 */}
                <div style={{ padding: '6px 10px 4px', display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 배지 행 (상태+D-day는 이미지 스트립에 표시) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3, flexWrap: 'wrap' }}>
                      {st !== 'closed' && isNew(apt, 'subscription') && <NewBadge />}
                      {((apt as Record<string, any>)['PARCPRC_ULS_AT'] === 'Y' || (apt as Record<string, any>).is_price_limit) && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: 'var(--accent-purple-bg)', color: 'var(--accent-purple)', lineHeight: '14px' }}>상한제</span>}
                      {(apt as any).project_type && (apt as any).project_type !== '민간' && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: (apt as any).project_type === '재개발' ? 'rgba(251,146,60,0.1)' : 'rgba(167,139,250,0.1)', color: (apt as any).project_type === '재개발' ? 'var(--accent-orange)' : 'var(--accent-purple)', lineHeight: '14px' }}>{(apt as any).project_type}</span>}
                      {(apt as any).is_regulated_area && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.06)', color: 'var(--accent-red)', lineHeight: '14px' }}>규제</span>}
                      {(apt as Record<string, any>)['SPECLT_RDN_EARTH_AT'] === 'Y' && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', lineHeight: '14px' }}>투기과열</span>}
                      {(apt as any).brand_name && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: 'rgba(59,123,246,0.08)', color: 'var(--brand)', lineHeight: '14px' }}>{(apt as any).brand_name}</span>}
                      {(apt as any).balcony_extension && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,211,238,0.06)', color: 'var(--accent-cyan, #22D3EE)', lineHeight: '14px' }}>발코니확장</span>}
                    </div>
                    {/* 단지명 */}
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{apt.house_nm}</div>
                    {/* 주소 + 시공사 + 스펙 */}
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      {shortAddr}{apt.constructor_nm ? ` · ${apt.constructor_nm}` : ''}{(apt as any).developer_nm && (apt as any).developer_nm !== apt.constructor_nm ? ` · 시행 ${String((apt as any).developer_nm).slice(0, 12)}` : ''}{(apt as any).heating_type ? ` · ${(apt as any).heating_type}` : ''}{(apt as any).parking_ratio ? ` · 주차 ${(apt as any).parking_ratio}대` : ''}
                    </div>
                  </div>
                  {/* 경쟁률 링 + 즐찾 */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    {(apt.competition_rate_1st != null && Number(apt.competition_rate_1st) > 0) ? (
                      <div style={{ width: 48, height: 48, position: 'relative' }}>
                        <svg width="48" height="48" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--bg-hover)" strokeWidth="3" />
                          <circle cx="24" cy="24" r="20" fill="none" stroke={Number(apt.competition_rate_1st) >= 10 ? 'var(--accent-red)' : Number(apt.competition_rate_1st) >= 5 ? 'var(--accent-orange)' : 'var(--accent-green)'} strokeWidth="3" strokeDasharray={`${Math.min(Number(apt.competition_rate_1st) / 50 * 100, 100) / 100 * Math.PI * 40} ${Math.PI * 40}`} strokeLinecap="round" transform="rotate(-90 24 24)" />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: Number(apt.competition_rate_1st) >= 10 ? 'var(--accent-red)' : 'var(--text-primary)', lineHeight: 1 }}>{Number(apt.competition_rate_1st).toFixed(1)}</span>
                          <span style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>:1</span>
                        </div>
                      </div>
                    ) : null}
                    {apt.competition_rate_2nd != null && Number(apt.competition_rate_2nd) > 0 && <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>2순위 {Number(apt.competition_rate_2nd).toFixed(1)}:1</span>}
                    <a aria-label="관심등록" href={`/apt/${encodeURIComponent(generateAptSlug(apt.house_nm) || apt.house_manage_no || String(apt.id))}#interest-section`} onClick={(e) => { e.stopPropagation(); }} style={{ fontSize: 16, background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 5px', cursor: 'pointer', lineHeight: 1, textDecoration: 'none' }}>
                      ☆
                    </a>
                  </div>
                </div>

                {/* ② 8열 KPI 그리드 (모바일 4열x2줄) */}
                {(() => {
                  const hti = (apt as Record<string, any>).house_type_info;
                  const prices = Array.isArray(hti) ? hti.map((t: any) => t.lttot_top_amount).filter((p: number) => p > 0) : [];
                  const pMin = prices.length > 0 ? Math.min(...prices) : 0;
                  const pMax = prices.length > 0 ? Math.max(...prices) : 0;
                  const fmtP = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
                  const mvnYm = apt.mvn_prearnge_ym;
                  const mvnLabel = mvnYm ? `${mvnYm.slice(0, 4)}.${parseInt(mvnYm.slice(4, 6))}` : ((apt as any).move_in_month || null);
                  // 평당가: DB 우선, 없으면 house_type_info에서 계산
                  const dbPpAvg = (apt as any).price_per_pyeong_avg;
                  const ppAvg = dbPpAvg || (() => {
                    const ht = Array.isArray(hti) ? hti.filter((t: any) => t.lttot_top_amount > 0 && t.type) : [];
                    if (ht.length === 0) return 0;
                    const s = ht.reduce((acc: number, t: any) => { const a = parseFloat(String(t.type).replace(/[A-Za-z]/g, '')) || 84; return acc + (t.lttot_top_amount / (a / 3.3058)); }, 0);
                    return Math.round(s / ht.length);
                  })();
                  const genT = (apt as any).general_supply_total || 0;
                  const spcT = (apt as any).special_supply_total || 0;
                  const totS = apt.tot_supply_hshld_co || 0;
                  const totalHH = (apt as any).total_households || 0;
                  const isRedevType = (apt as any).project_type === '재개발' || (apt as any).project_type === '재건축';
                  const genPct = totS > 0 ? Math.round((genT / totS) * 100) : 0;
                  const hasAnnouncement = !!(apt.rcept_bgnde);
                  const pendingLabel = hasAnnouncement ? '공고확인' : '공고전';
                  const kpiStyle = { textAlign: 'center' as const, padding: '3px 4px', background: 'var(--bg-surface)', borderRadius: 2 };
                  const kpiLabel = { fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2, fontWeight: 500 as const };
                  const kpiVal = (c: string) => ({ fontSize: 'var(--fs-sm)', fontWeight: 800 as const, color: c, lineHeight: 1.3 });
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, margin: '0 10px 8px', background: 'var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={kpiStyle}><div style={kpiLabel}>분양가(최저)</div><div style={kpiVal(pMin > 0 ? 'var(--accent-blue-light, #93C5FD)' : 'var(--text-tertiary)')}>{pMin > 0 ? fmtP(pMin) : pendingLabel}</div></div>
                        <div style={kpiStyle}><div style={kpiLabel}>분양가(최고)</div><div style={kpiVal(pMax > 0 ? 'var(--brand)' : 'var(--text-tertiary)')}>{pMax > 0 ? fmtP(pMax) : pendingLabel}</div></div>
                        <div style={kpiStyle}><div style={kpiLabel}>평당가</div><div style={kpiVal(ppAvg > 0 ? 'var(--accent-purple)' : 'var(--text-tertiary)')}>{ppAvg > 0 ? fmtP(ppAvg) : (pMin > 0 ? '계산중' : pendingLabel)}</div></div>
                        <div style={kpiStyle}><div style={kpiLabel}>입주예정</div><div style={kpiVal(mvnLabel ? 'var(--accent-green)' : 'var(--text-tertiary)')}>{mvnLabel || '미정'}</div></div>
                        {/* 총세대: total_households가 있고 totS와 다를 때만 따로 표시 */}
                        {totalHH > 0 && totalHH !== totS ? (
                          <>
                            <div style={kpiStyle}><div style={kpiLabel}>총세대수</div><div style={kpiVal('var(--text-primary)')}>{totalHH.toLocaleString()}</div></div>
                            <div style={kpiStyle}><div style={kpiLabel}>공급세대</div><div style={kpiVal('var(--brand)')}>{totS > 0 ? totS.toLocaleString() : <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{pendingLabel}</span>}</div></div>
                          </>
                        ) : totalHH > 0 ? (
                          <>
                            <div style={kpiStyle}><div style={kpiLabel}>총세대수</div><div style={kpiVal('var(--text-primary)')}>{totalHH.toLocaleString()}</div></div>
                            <div style={kpiStyle}><div style={kpiLabel}>공급세대</div><div style={kpiVal('var(--brand)')}>{totS > 0 ? totS.toLocaleString() : totalHH.toLocaleString()}</div></div>
                          </>
                        ) : (
                          <>
                            <div style={kpiStyle}><div style={kpiLabel}>공급세대</div><div style={kpiVal(totS > 0 ? 'var(--brand)' : 'var(--text-tertiary)')}>{totS > 0 ? totS.toLocaleString() : <span style={{ fontSize: 9 }}>{pendingLabel}</span>}</div></div>
                            <div style={kpiStyle}><div style={kpiLabel}>시공사</div><div style={kpiVal('var(--text-primary)')}>{(apt as any).constructor_nm ? (apt as any).constructor_nm.split('(')[0].trim().slice(0, 6) : '미공개'}</div></div>
                          </>
                        )}
                        <div style={kpiStyle}><div style={kpiLabel}>일반공급</div><div style={kpiVal(genT > 0 ? 'var(--accent-blue-light, #60A5FA)' : 'var(--text-tertiary)')}>{genT > 0 ? genT.toLocaleString() : <span style={{ fontSize: 9 }}>{pendingLabel}</span>}</div></div>
                        <div style={kpiStyle}><div style={kpiLabel}>특별공급</div><div style={kpiVal(spcT > 0 ? 'var(--accent-purple, #A78BFA)' : 'var(--text-tertiary)')}>{spcT > 0 ? spcT.toLocaleString() : <span style={{ fontSize: 9 }}>{pendingLabel}</span>}</div></div>
                      </div>

                      {/* 일반/특별 비율 바 */}
                      {totS > 0 && (genT > 0 || spcT > 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', marginBottom: 5 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', display: 'flex', background: 'var(--bg-hover)' }}>
                            <div style={{ width: `${genPct}%`, height: '100%', background: 'var(--accent-blue-light, #60A5FA)' }} />
                            <div style={{ width: `${100 - genPct}%`, height: '100%', background: 'var(--accent-purple, #A78BFA)' }} />
                          </div>
                          <span style={{ fontSize: 8, color: 'var(--text-tertiary)', flexShrink: 0 }}>일반{genPct}% 특별{100 - genPct}%</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* ③ 평형별 카드 (일반+특별 분리) */}
                {(() => {
                  const hti = (apt as Record<string, any>).house_type_info;
                  const types = Array.isArray(hti) ? hti.filter((t: any) => t.lttot_top_amount > 0).slice(0, 4) : [];
                  if (!types.length) return null;
                  const fmtPM = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
                  const maxP = Math.max(...types.map((t: any) => t.lttot_top_amount));
                  return (
                    <div style={{ padding: '0 12px 5px' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 3, fontWeight: 600 }}>평형별 분양가 · 공급(일반+특별)</div>
                      <div style={{ display: 'flex', gap: 3, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        {types.map((t: any, idx: number) => {
                          const pctH = Math.round((t.lttot_top_amount / maxP) * 100);
                          return (
                            <div key={t.type || idx} style={{ flex: '1 0 0', minWidth: 64, background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)', padding: '4px 5px', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)' }}>{t.type?.split?.('.')?.[0] || t.type}</span>
                                <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{t.area ? `${Number(t.area).toFixed(0)}㎡` : ''}</span>
                              </div>
                              <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginBottom: 3 }}><div style={{ height: '100%', width: `${pctH}%`, borderRadius: 2, background: 'var(--brand)' }} /></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
                                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{fmtPM(t.lttot_top_amount)}</span>
                                <span style={{ color: 'var(--accent-purple, #A78BFA)' }}>{(t.supply || 0)}+{(t.spsply_hshldco || 0)}</span>
                              </div>
                              <div style={{ fontSize: 7, color: 'var(--text-tertiary)', textAlign: 'right' }}>총{(t.supply || 0) + (t.spsply_hshldco || 0)}세대</div>
                            </div>
                          );
                        })}
                        {Array.isArray(hti) && hti.length > 4 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '3px 4px', alignSelf: 'center' }}>+{hti.length - 4}</span>}
                      </div>
                    </div>
                  );
                })()}

                {/* ④ 납부비율 바 + 중도금 대출 */}
                {(() => {
                  const ps = (apt as any).payment_schedule;
                  const loanRate = (apt as any).loan_rate;
                  if (!ps && !loanRate) return null;
                  const sched = ps ? (typeof ps === 'string' ? JSON.parse(ps) : ps) : null;
                  const dep = sched?.deposit?.pct || 10;
                  const mid = sched?.interim?.pct || 60;
                  const bal = sched?.balance?.pct || 30;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 12px 5px' }}>
                      {sched && [{l:'계약금',p:dep,c:'var(--brand)'},{l:'중도금',p:mid,c:'var(--accent-purple)'},{l:'잔금',p:bal,c:'var(--accent-orange)'}].map(s => (
                        <div key={s.l} style={{ flex: s.p, height: 14, borderRadius: 3, background: `${s.c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 8, color: s.c, fontWeight: 700 }}>{s.l} {s.p}%</span>
                        </div>
                      ))}
                      {loanRate && <span style={{ fontSize: 9, color: loanRate.includes('무이자') ? 'var(--accent-green)' : 'var(--accent-yellow)', fontWeight: 700, marginLeft: 2, flexShrink: 0 }}>중도금 {loanRate}</span>}
                    </div>
                  );
                })()}

                {/* ⑤ 커뮤니티 시설 + 스펙 배지 */}
                {(() => {
                  const comms = Array.isArray((apt as any).community_facilities) ? (apt as any).community_facilities : [];
                  if (!comms.length) return null;
                  return (
                    <div style={{ display: 'flex', gap: 2, padding: '0 12px 5px', flexWrap: 'wrap' }}>
                      {comms.slice(0, 5).map((f: string) => (
                        <span key={f} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,211,238,0.05)', color: 'var(--accent-cyan, #22D3EE)', border: '1px solid rgba(34,211,238,0.08)' }}>{f}</span>
                      ))}
                    </div>
                  );
                })()}

                {/* ⑥ 도트 타임라인 */}
                <div style={{ padding: '6px 12px 10px', borderTop: '1px solid var(--border)', marginTop: 2 }}>
                  {(() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const steps = [
                      { label: '특별공급', date: fmtD(apt.spsply_rcept_bgnde), done: !!apt.spsply_rcept_bgnde && today >= String(apt.spsply_rcept_bgnde).slice(0, 10), active: false },
                      { label: '1순위접수', date: `${fmtD(apt.rcept_bgnde)}~${fmtD(apt.rcept_endde)}`, done: st === 'open' || st === 'closed', active: st === 'open' },
                      { label: '당첨발표', date: fmtD(apt.przwner_presnatn_de), done: !!apt.przwner_presnatn_de && today >= String(apt.przwner_presnatn_de).slice(0, 10), active: false },
                      { label: '계약체결', date: fmtD(apt.cntrct_cncls_bgnde), done: !!apt.cntrct_cncls_bgnde && today >= String(apt.cntrct_cncls_bgnde).slice(0, 10), active: false },
                    ];
                    return (
                      <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
                        {steps.map((s, si) => {
                          const dotColor = s.active ? 'var(--brand)' : s.done ? 'var(--accent-green)' : 'var(--border)';
                          const textColor = s.active ? 'var(--brand)' : s.done ? 'var(--accent-green)' : 'var(--text-tertiary)';
                          return (
                            <div key={si} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, zIndex: 1, border: '2px solid var(--bg-surface)', boxShadow: s.active ? '0 0 6px rgba(59,123,246,0.5)' : undefined }} />
                              {si < steps.length - 1 && <div style={{ position: 'absolute', top: 4, left: 'calc(50% + 4px)', width: 'calc(100% - 8px)', height: 2, background: s.done ? 'rgba(52,211,153,0.3)' : 'var(--border)' }} />}
                              <div style={{ fontSize: 8, color: textColor, fontWeight: s.active ? 700 : 500, marginTop: 3, whiteSpace: 'nowrap' }}>{s.label}</div>
                              <div style={{ fontSize: 8, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{s.date}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </Link>
            );
          })}
          </div>

          {/* 토스 모드 CTA */}
          {typeof window !== 'undefined' && isTossMode() && filtered.length > 5 && (
            <TossTeaser
              path="/apt"
              label={`전체 ${filtered.length}건 청약 보기`}
              subtitle="경쟁률 · 분양가 · 일정 전부 확인"
            />
          )}

          {/* 페이지네이션 */}
          {subTotalPages > 1 && !(typeof window !== 'undefined' && isTossMode()) && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-sm)', padding: 'var(--sp-md) 0' }}>
              <button onClick={() => setSubPage(p => Math.max(1, p - 1))} disabled={subPage === 1} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: subPage === 1 ? 'var(--bg-hover)' : 'var(--brand)', color: subPage === 1 ? 'var(--text-tertiary)' : '#fff', border: 'none', cursor: subPage === 1 ? 'default' : 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>← 이전</button>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{subPage} / {subTotalPages}</span>
              <button onClick={() => setSubPage(p => Math.min(subTotalPages, p + 1))} disabled={subPage === subTotalPages} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: subPage === subTotalPages ? 'var(--bg-hover)' : 'var(--brand)', color: subPage === subTotalPages ? 'var(--text-tertiary)' : '#fff', border: 'none', cursor: subPage === subTotalPages ? 'default' : 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>다음 →</button>
            </div>
          )}

          {/* 청약 캘린더 */}
          <div className="kd-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-xs)' }}>
              <SectionShareButton section="apt-calendar" label="청약 정보, 부동산 정보(분양/미분양/실거래/재개발재건축) 찾기 힘드시죠? 여기는 보기 편해요!" pagePath="/apt" />
            </div>
            {(() => {
              const now = kstNow();
              const targetDate = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
              const year = targetDate.getFullYear();
              const month = targetDate.getMonth();
              const monthLabel = `${year}년 ${month + 1}월`;
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells: { day: number; apts: any[] }[] = [];
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayApts = filtered.filter(a => dateStr >= String(a.rcept_bgnde || '').slice(0, 10) && dateStr <= String(a.rcept_endde || '').slice(0, 10));
                cells.push({ day: d, apts: dayApts });
              }
              return (
                <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
                  <button onClick={() => { setCalOffset(p => p - 1); setSelectedCalDate(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)', padding: '4px 8px' }}>‹</button>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📅 {monthLabel}</div>
                  <button onClick={() => { setCalOffset(p => p + 1); setSelectedCalDate(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)', padding: '4px 8px' }}>›</button>
                </div>
                <div className="kd-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, fontSize: 'var(--fs-xs)' }}>
                  {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                    <div key={d} style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontWeight: 700, padding: 4 }}>{d}</div>
                  ))}
                  {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                  {cells.map(c => (
                    <div key={c.day} onClick={() => c.apts.length > 0 && setSelectedCalDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`)} style={{
                      textAlign: 'center', padding: '4px 2px', borderRadius: 'var(--radius-xs)', cursor: c.apts.length > 0 ? 'pointer' : 'default',
                      background: selectedCalDate?.endsWith(`-${String(c.day).padStart(2, '0')}`) ? 'rgba(96,165,250,0.25)' : c.apts.length > 0 ? 'rgba(96,165,250,0.1)' : 'transparent',
                      border: calOffset === 0 && c.day === kstNow().getDate() ? '2px solid var(--brand)' : '1px solid transparent',
                    }}>
                      <div style={{ color: c.apts.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: c.apts.length > 0 ? 700 : 400 }}>{c.day}</div>
                      {c.apts.length > 0 && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', fontWeight: 700 }}>{c.apts.length}건</div>}
                      {c.apts.length > 0 && (
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 1 }}>
                          {c.apts.some(a => getStatus(a) === 'open') && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }} />}
                          {c.apts.some(a => getStatus(a) === 'upcoming') && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-blue)', display: 'inline-block' }} />}
                          {c.apts.some(a => getStatus(a) === 'closed') && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-tertiary)', display: 'inline-block' }} />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                </>
              );
            })()}
            {selectedCalDate && (() => {
              const dayApts = apts.filter(a => selectedCalDate >= String(a.rcept_bgnde || '').slice(0, 10) && selectedCalDate <= String(a.rcept_endde || '').slice(0, 10));
              return dayApts.length > 0 ? (
                <div style={{ marginTop: 'var(--sp-md)', padding: '12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>
                    📅 {selectedCalDate.slice(5).replace('-', '월 ')}일 청약 일정 ({dayApts.length}건)
                  </div>
                  {dayApts.map(a => (
                    <a key={a.id} href={`/apt/${encodeURIComponent(generateAptSlug(a.house_nm) || a.house_manage_no || String(a.id))}`} style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', padding: '6px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-link, #58a6ff)' }}>{a.house_nm}</span>
                      <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{a.region_nm} · 총 {a.tot_supply_hshld_co?.toLocaleString() || '-'}세대</span>
                    </a>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-md)', textAlign: 'center' }}>
            📊 청약홈·공공데이터포털 API 기준{freshDate ? ` · ${freshDate} 수집` : ''} · 매일 자동 갱신
          </p>
        </div>

  );
}
