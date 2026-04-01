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

export default function SubscriptionTab({ apts, alertCounts, regionStats, aptUser, watchlist, toggleWatchlist, setCommentTarget: _setCommentTarget, showToast: _showToast, globalRegion, globalSearch, subTotalCount, freshDate }: Props) {
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

          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>{effectiveSearch ? `"${effectiveSearch}" 검색 결과가 없습니다` : '조건에 맞는 청약이 없습니다'}{effectiveSearch && <div style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>단지명, 지역, 시공사로 검색해보세요</div>}</div>}

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
                display: 'block', padding: '10px 10px 8px', borderRadius: 'var(--radius-card)',
                background: st === 'open' ? 'linear-gradient(135deg, var(--bg-surface), rgba(96,165,250,0.04))' : 'var(--bg-surface)',
                border: st === 'open' ? '1.5px solid rgba(96,165,250,0.3)' : '1px solid var(--border)',
                opacity: st === 'closed' ? 0.55 : 1,
                textDecoration: 'none', color: 'inherit',
              }}>
                {/* 1행: 상태배지 + D-day + 특성 + 지역 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                  {isNew(apt, 'subscription') && <NewBadge />}
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: bd.bg, color: bd.color, border: `1px solid ${bd.border}` }}>{bd.label}</span>
                  {dday !== null && dday >= 0 && st !== 'closed' && (
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: dday <= 2 ? 'rgba(248,113,113,0.15)' : dday <= 6 ? 'var(--accent-yellow-bg)' : 'rgba(148,163,184,0.1)', color: dday <= 2 ? 'var(--accent-red)' : dday <= 6 ? 'var(--accent-yellow)' : 'var(--text-secondary)' }}>
                      {st === 'open' ? (dday === 0 ? '🔴 오늘 마감' : `⏰ D-${dday}`) : `D-${dday}`}
                    </span>
                  )}
                  {(apt as Record<string, any>)['PARCPRC_ULS_AT'] === 'Y' || (apt as Record<string, any>).is_price_limit ? <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: 'var(--accent-purple-bg)', color: 'var(--accent-purple)' }}>분양가상한</span> : null}
                  {(apt as any).brand_name && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: 'rgba(59,123,246,0.08)', color: 'var(--brand)' }}>{(apt as any).brand_name}</span>}
                  {(apt as any).project_type && (apt as any).project_type !== '민간' && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: (apt as any).project_type === '재개발' ? 'rgba(251,146,60,0.1)' : (apt as any).project_type === '재건축' ? 'rgba(167,139,250,0.1)' : 'rgba(52,211,153,0.1)', color: (apt as any).project_type === '재개발' ? 'var(--accent-orange)' : (apt as any).project_type === '재건축' ? 'var(--accent-purple)' : 'var(--accent-green)' }}>{(apt as any).project_type}</span>}
                  {(apt as any).loan_rate && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: (apt as any).loan_rate.includes('무이자') ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)', color: (apt as any).loan_rate.includes('무이자') ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>중도금 {(apt as any).loan_rate}</span>}
                  {(apt as any).is_regulated_area && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)' }}>규제지역</span>}
                  {(apt as any).balcony_extension && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: 'rgba(34,211,238,0.08)', color: 'var(--accent-cyan, #22D3EE)' }}>발코니확장</span>}
                  {(apt as Record<string, any>)['SPECLT_RDN_EARTH_AT'] === 'Y' && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: 'var(--accent-red-bg)', color: 'var(--accent-red)' }}>투기과열</span>}
                  {(apt as Record<string, any>)['MDAT_TRGET_AREA_SECD'] === 'Y' && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: 'rgba(251,146,60,0.12)', color: 'var(--accent-orange-light)' }}>조정대상</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{apt.region_nm}</span>
                  <button aria-label="닫기" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist('subscription', String(apt.id)); }} style={{ fontSize: 'var(--fs-lg)', background: watchlist.has(`subscription:${apt.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`subscription:${apt.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', cursor: 'pointer', lineHeight: 1 }}>
                    {watchlist.has(`subscription:${apt.id}`) ? '⭐' : '☆'}
                  </button>
                </div>
                {/* 경쟁률 */}
                {(apt.competition_rate_1st != null && Number(apt.competition_rate_1st) > 0) && (
                  <div style={{ fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-xs)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: Number(apt.competition_rate_1st) >= 10 ? 'var(--accent-red)' : Number(apt.competition_rate_1st) >= 5 ? 'var(--accent-orange)' : 'var(--accent-green)', fontWeight: 800 }}>
                      {Number(apt.competition_rate_1st) >= 10 ? '🔥' : ''} 1순위 {Number(apt.competition_rate_1st).toFixed(1)}:1
                    </span>
                    {apt.competition_rate_2nd != null && Number(apt.competition_rate_2nd) > 0 && (
                      <span style={{ color: 'var(--text-tertiary)' }}>2순위 {Number(apt.competition_rate_2nd).toFixed(1)}:1</span>
                    )}
                  </div>
                )}
                {/* 단지명 + 브랜드 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{apt.house_nm}</div>
                  {(apt as any).brand_name && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,123,246,0.1)', color: 'var(--brand)', border: '1px solid rgba(59,123,246,0.2)', flexShrink: 0, whiteSpace: 'nowrap' }}>{(apt as any).brand_name}</span>}
                </div>
                {/* 주소 + 시공사/시행사 + 스펙 */}
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {shortAddr}{apt.constructor_nm ? ` · ${apt.constructor_nm}` : ''}{(apt as any).developer_nm && (apt as any).developer_nm !== apt.constructor_nm ? ` · 시행 ${(apt as any).developer_nm}` : ''}{(apt as any).heating_type ? ` · ${(apt as any).heating_type}` : ''}{(apt as any).parking_ratio ? ` · 주차 ${(apt as any).parking_ratio}대` : ''}
                </div>
                {/* 💰 분양가 + 평당가 + 세대수 + 일반/특별 + 입주 KPI */}
                {(() => {
                  const hti = (apt as Record<string, any>).house_type_info;
                  const prices = Array.isArray(hti) ? hti.map((t: any) => t.lttot_top_amount).filter((p: number) => p > 0) : [];
                  const pMin = prices.length > 0 ? Math.min(...prices) : 0;
                  const pMax = prices.length > 0 ? Math.max(...prices) : 0;
                  const fmtP = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
                  const mvnYm = apt.mvn_prearnge_ym;
                  const mvnLabel = mvnYm ? `${mvnYm.slice(0, 4)}.${parseInt(mvnYm.slice(4, 6))}` : ((apt as any).move_in_month || null);
                  const ppAvg = (apt as any).price_per_pyeong_avg;
                  const genT = (apt as any).general_supply_total || 0;
                  const spcT = (apt as any).special_supply_total || 0;
                  const totS = apt.tot_supply_hshld_co || 0;
                  const totalHH = (apt as any).total_households || 0;
                  const isRedev = (apt as any).project_type === '재개발' || (apt as any).project_type === '재건축';
                  const hhNull = !(apt as any).total_households && isRedev;
                  const genPct = totS > 0 ? Math.round((genT / totS) * 100) : 0;
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 2, marginBottom: 4, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', padding: '5px 3px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>분양가</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: pMax > 0 ? 'var(--brand)' : 'var(--text-tertiary)' }}>{pMax > 0 ? (pMin !== pMax ? `${fmtP(pMin)}~${fmtP(pMax)}` : fmtP(pMax)) : '미정'}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>평당가</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: ppAvg > 0 ? 'var(--accent-purple)' : 'var(--text-tertiary)' }}>{ppAvg > 0 ? fmtP(ppAvg) : '-'}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{totalHH > 0 && totalHH !== totS ? '총세대/공급' : hhNull ? '총세대수' : '총 공급'}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: totalHH > 0 ? 'var(--text-primary)' : hhNull ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                            {totalHH > 0 && totalHH !== totS 
                              ? <>{totalHH.toLocaleString()}<span style={{ color: 'var(--text-tertiary)' }}>/</span>{totS.toLocaleString()}</>
                              : hhNull ? '🔍 확인중' : totS > 0 ? `${totS.toLocaleString()}세대` : '-'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>일반/특별</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: genT > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{genT > 0 || spcT > 0 ? `${genT}/${spcT}` : '-'}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>입주</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: mvnLabel ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>{mvnLabel || '-'}</div>
                        </div>
                      </div>
                      {/* 일반/특별 공급 비율 바 */}
                      {totS > 0 && (genT > 0 || spcT > 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${genPct}%`, height: '100%', background: 'var(--accent-blue-light, #60A5FA)', borderRadius: '2px 0 0 2px' }} />
                            <div style={{ width: `${100 - genPct}%`, height: '100%', background: 'var(--accent-purple, #A78BFA)' }} />
                          </div>
                          <span style={{ fontSize: 8, color: 'var(--text-tertiary)', flexShrink: 0 }}>일반{genPct}%</span>
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* 납부 비율 미니 바 */}
                {(() => {
                  const ps = (apt as any).payment_schedule;
                  if (!ps) return null;
                  const sched = typeof ps === 'string' ? JSON.parse(ps) : ps;
                  const dep = sched?.deposit?.pct || 10;
                  const mid = sched?.interim?.pct || 60;
                  const bal = sched?.balance?.pct || 30;
                  return (
                    <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                      {[{l:'계약금',p:dep,c:'var(--brand)'},{l:'중도금',p:mid,c:'var(--accent-purple)'},{l:'잔금',p:bal,c:'var(--accent-orange)'}].map(s => (
                        <div key={s.l} style={{ flex: s.p, height: 14, borderRadius: 3, background: `${s.c}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 8, color: s.c, fontWeight: 700 }}>{s.l} {s.p}%</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {/* 평형별 미니 */}
                {(() => {
                  const hti = (apt as Record<string, any>).house_type_info;
                  const types = Array.isArray(hti) ? hti.filter((t: any) => t.lttot_top_amount > 0).slice(0, 3) : [];
                  if (!types.length) return null;
                  const fmtPM = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;
                  return (
                    <div style={{ display: 'flex', gap: 3, marginBottom: 4, overflowX: 'auto' }}>
                      {types.map((t: any) => (
                        <div key={t.type} style={{ padding: '3px 6px', borderRadius: 5, background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.12)', fontSize: 9, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.type?.split?.('.')?.[0] || t.type}</span> {t.area ? `${Number(t.area).toFixed(0)}㎡` : ''} · {fmtPM(t.lttot_top_amount)} · {(t.supply || 0) + (t.spsply_hshldco || 0)}세대
                        </div>
                      ))}
                      {Array.isArray(hti) && hti.length > 3 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '3px 4px' }}>+{hti.length - 3}</span>}
                    </div>
                  );
                })()}
                {/* 커뮤니티 시설 */}
                {(apt as any).community_facilities && (() => {
                  const comms = Array.isArray((apt as any).community_facilities) ? (apt as any).community_facilities : [];
                  if (!comms.length) return null;
                  return (
                    <div style={{ display: 'flex', gap: 2, marginBottom: 4, flexWrap: 'wrap' }}>
                      {comms.slice(0, 4).map((f: string) => (
                        <span key={f} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,211,238,0.06)', color: 'var(--accent-cyan, #22D3EE)', border: '1px solid rgba(34,211,238,0.1)' }}>{f}</span>
                      ))}
                    </div>
                  );
                })()}
                {/* 타임라인 바 */}
                <div style={{ display: 'flex', gap: 2, fontSize: '9px', color: 'var(--text-tertiary)', overflow: 'hidden' }}>
                  {apt.spsply_rcept_bgnde && <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: 'var(--accent-purple-bg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>특별 {fmtD(apt.spsply_rcept_bgnde)}</div>}
                  <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: st === 'open' ? 'rgba(96,165,250,0.15)' : 'rgba(148,163,184,0.06)', color: st === 'open' ? 'var(--accent-blue-light)' : undefined, fontWeight: st === 'open' ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>접수 {fmtD(apt.rcept_bgnde)}~{fmtD(apt.rcept_endde)}</div>
                  {apt.przwner_presnatn_de && <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: 'rgba(52,211,153,0.06)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>당첨 {fmtD(apt.przwner_presnatn_de)}</div>}
                  {apt.cntrct_cncls_bgnde && <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: 'rgba(251,191,36,0.06)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>계약 {fmtD(apt.cntrct_cncls_bgnde)}</div>}
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
                <div style={{ marginTop: 'var(--sp-md)', padding: '12px', background: 'var(--bg-hover)', borderRadius: 8 }}>
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
            📊 청약홈·공공데이터포털 API 기준{freshDate ? ` · ${freshDate} 수집` : ''} · 매일 06시 자동 갱신
          </p>
        </div>

  );
}
