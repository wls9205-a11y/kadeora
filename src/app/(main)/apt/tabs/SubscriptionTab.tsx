'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { haptic } from '@/lib/haptic';
import { type Apt, getStatus, fmtD, kstNow, isNew, NewBadge, STATUS_BADGE, generateAptSlug, type SharedTabProps } from './apt-utils';
import SectionShareButton from '@/components/SectionShareButton';

interface Props extends SharedTabProps {
  apts: Apt[];
  alertCounts: Record<string, number>;
  regionStats: { name: string; total: number; open: number; upcoming: number; closed: number }[];
}

const SB = STATUS_BADGE;

export default function SubscriptionTab({ apts, alertCounts, regionStats, aptUser, watchlist, toggleWatchlist, setCommentTarget: _setCommentTarget, showToast: _showToast, globalRegion }: Props) {
  const [region, setRegion] = useState(globalRegion || '전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [aptSort, setAptSort] = useState<'date'|'supply'|'deadline'|'competition'>('date');
  const [subSearch, setSubSearch] = useState('');
  const [calOffset, setCalOffset] = useState(0);
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [myAlerts, setMyAlerts] = useState<Set<string>>(new Set());

  // globalRegion 변경 시 내부 필터 동기화
  useEffect(() => {
    setRegion(globalRegion || '전체');
  }, [globalRegion]);

  const pill = (v: string, sel: string, set: (v: string) => void, label?: string) => (
    <button key={v} onClick={() => set(v)} style={{
      padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: 600,
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
      if (subSearch) {
        const q = subSearch.toLowerCase();
        if (!(a.house_nm || '').toLowerCase().includes(q) && !(a.region_nm || '').toLowerCase().includes(q) && !(a.hssply_adres || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (aptSort === 'supply') f.sort((a, b) => (b.tot_supply_hshld_co || 0) - (a.tot_supply_hshld_co || 0));
    if (aptSort === 'deadline') f.sort((a, b) => String(a.rcept_endde || '9999').localeCompare(String(b.rcept_endde || '9999')));
    if (aptSort === 'competition') f.sort((a, b) => (Number(b.competition_rate_1st) || 0) - (Number(a.competition_rate_1st) || 0));
    return f;
  }, [apts, region, statusFilter, aptSort, subSearch]);

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
          {/* 지역 필터 — 컴팩트 필 */}
          <div className="apt-pill-scroll" style={{ display: 'flex', gap: 5, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
            <button onClick={() => setRegion('전체')} style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: region === '전체' ? 700 : 500,
              background: region === '전체' ? 'var(--brand)' : 'var(--bg-hover)',
              color: region === '전체' ? 'var(--text-inverse)' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              전체 {apts.length}
            </button>
            {regionStats.filter(r => r.total > 0).map(r => (
              <button key={r.name} onClick={() => setRegion(r.name === region ? '전체' : r.name)} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: region === r.name ? 700 : 500,
                background: region === r.name ? 'var(--brand)' : 'var(--bg-hover)',
                color: region === r.name ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {r.name} {r.total}
                {r.open > 0 && <span style={{ color: region === r.name ? 'rgba(255,255,255,0.7)' : 'var(--accent-green)', marginLeft: 3, fontSize: 'var(--fs-xs)' }}>●</span>}
              </button>
            ))}
            <div style={{ flexShrink: 0, width: 16 }} aria-hidden />
          </div>

          {/* 검색 + 정렬 + 통계 요약 */}
          <div style={{ marginBottom: 12 }}>
            <input value={subSearch} onChange={e => setSubSearch(e.target.value)} placeholder="단지명, 지역 검색..." className="kd-search-input" />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginRight: 4 }}>정렬</span>
              {([['date', '최신순'], ['deadline', '마감임박'], ['supply', '세대수'], ['competition', '경쟁률']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setAptSort(k)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 'var(--fs-xs)', fontWeight: aptSort === k ? 700 : 500, background: aptSort === k ? 'var(--brand)' : 'var(--bg-hover)', color: aptSort === k ? 'var(--text-inverse)' : 'var(--text-secondary)', cursor: 'pointer' }}>{l}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 'var(--fs-xs)' }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>접수중 {filtered.filter(a => getStatus(a) === 'open').length}</span>
                <span style={{ color: 'var(--accent-yellow)', fontWeight: 700 }}>예정 {filtered.filter(a => getStatus(a) === 'upcoming').length}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>마감 {filtered.filter(a => getStatus(a) === 'closed').length}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            {pill('전체', statusFilter, setStatusFilter)}
            {pill('open', statusFilter, setStatusFilter, '접수중')}
            {pill('upcoming', statusFilter, setStatusFilter, '예정')}
            {pill('closed', statusFilter, setStatusFilter, '마감')}
          </div>

          {/* 이번 주 청약 하이라이트 */}
          {(() => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek);
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
            const ws = weekStart.toISOString().slice(0, 10);
            const we = weekEnd.toISOString().slice(0, 10);
            const thisWeek = filtered.filter(a => {
              const begin = String(a.rcept_bgnde || '').slice(0, 10);
              const end = String(a.rcept_endde || '').slice(0, 10);
              return begin <= we && end >= ws;
            });
            const opening = thisWeek.filter(a => getStatus(a) === 'open');
            const upcoming = thisWeek.filter(a => getStatus(a) === 'upcoming');
            if (thisWeek.length === 0) return null;
            return (
              <div style={{ background: 'linear-gradient(135deg, var(--accent-blue-bg), rgba(52,211,153,0.08))', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--accent-blue)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📅 이번 주 청약 ({thisWeek.length}건)
                  {opening.length > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 8, background: 'var(--accent-green-bg)', color: 'var(--accent-green)', fontWeight: 700 }}>접수중 {opening.length}</span>}
                  {upcoming.length > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 8, background: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)', fontWeight: 700 }}>예정 {upcoming.length}</span>}
                </div>
                {thisWeek.slice(0, 5).map(a => {
                  const st = getStatus(a);
                  const sb = SB[st];
                  return (
                    <a key={a.id} href={`/apt/${encodeURIComponent(generateAptSlug(a.house_nm) || a.house_manage_no || String(a.id))}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(96,165,250,0.1)', textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 8, background: sb.bg, color: sb.color, border: `1px solid ${sb.border}`, fontWeight: 700 }}>{sb.label}</span>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{a.house_nm}</span>
                      </div>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{a.region_nm} · {a.tot_supply_hshld_co?.toLocaleString() || '-'}세대</span>
                    </a>
                  );
                })}
              </div>
            );
          })()}


          {/* 필터 결과 카운트 + 정렬 */}
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>총 <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong>건
              {filtered.filter(a => getStatus(a) === 'open').length > 0 && (
                <span style={{ color: 'var(--accent-green)', fontWeight: 600, marginLeft: 8 }}>접수중 {filtered.filter(a => getStatus(a) === 'open').length}건</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { key: 'date' as const, label: '최신순' },
                { key: 'supply' as const, label: '세대수순' },
                { key: 'deadline' as const, label: '마감임박' },
              ]).map(s => (
                <button key={s.key} onClick={() => setAptSort(s.key)} style={{
                  fontSize: 'var(--fs-xs)', padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: aptSort === s.key ? 'var(--brand)' : 'var(--bg-hover)',
                  color: aptSort === s.key ? 'var(--text-inverse)' : 'var(--text-tertiary)', fontWeight: 600,
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>조건에 맞는 청약이 없습니다</div>}

          {filtered.map((apt, i) => {
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
                display: 'block', padding: '14px 16px 12px', borderRadius: 14, marginBottom: 8,
                background: st === 'open' ? 'linear-gradient(135deg, var(--bg-surface), rgba(96,165,250,0.04))' : 'var(--bg-surface)',
                border: st === 'open' ? '1.5px solid rgba(96,165,250,0.3)' : '1px solid var(--border)',
                opacity: st === 'closed' ? 0.55 : 1,
                textDecoration: 'none', color: 'inherit',
              }}>
                {/* 1행: 상태배지 + D-day + 특성 + 지역 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                  {isNew(apt, 'subscription') && <NewBadge />}
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: bd.bg, color: bd.color, border: `1px solid ${bd.border}` }}>{bd.label}</span>
                  {dday !== null && dday >= 0 && st !== 'closed' && (
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: dday <= 2 ? 'rgba(248,113,113,0.15)' : dday <= 6 ? 'var(--accent-yellow-bg)' : 'rgba(148,163,184,0.1)', color: dday <= 2 ? 'var(--accent-red)' : dday <= 6 ? 'var(--accent-yellow)' : 'var(--text-secondary)' }}>
                      {st === 'open' ? (dday === 0 ? '🔴 오늘 마감' : `⏰ D-${dday}`) : `D-${dday}`}
                    </span>
                  )}
                  {(apt as any).PARCPRC_ULS_AT === 'Y' && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'var(--accent-purple-bg)', color: 'var(--accent-purple)' }}>분양가상한</span>}
                  {(apt as any).SPECLT_RDN_EARTH_AT === 'Y' && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'var(--accent-red-bg)', color: 'var(--accent-red)' }}>투기과열</span>}
                  {(apt as any).MDAT_TRGET_AREA_SECD === 'Y' && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(251,146,60,0.12)', color: 'var(--accent-orange-light)' }}>조정대상</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{apt.region_nm}</span>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist('subscription', String(apt.id)); }} style={{ fontSize: 'var(--fs-lg)', background: watchlist.has(`subscription:${apt.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`subscription:${apt.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', lineHeight: 1 }}>
                    {watchlist.has(`subscription:${apt.id}`) ? '⭐' : '☆'}
                  </button>
                </div>
                {/* 경쟁률 */}
                {(apt.competition_rate_1st != null && Number(apt.competition_rate_1st) > 0) && (
                  <div style={{ fontSize: 'var(--fs-xs)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: Number(apt.competition_rate_1st) >= 10 ? 'var(--accent-red)' : Number(apt.competition_rate_1st) >= 5 ? 'var(--accent-orange)' : 'var(--accent-green)', fontWeight: 800 }}>
                      {Number(apt.competition_rate_1st) >= 10 ? '🔥' : ''} 1순위 {Number(apt.competition_rate_1st).toFixed(1)}:1
                    </span>
                    {apt.competition_rate_2nd != null && Number(apt.competition_rate_2nd) > 0 && (
                      <span style={{ color: 'var(--text-tertiary)' }}>2순위 {Number(apt.competition_rate_2nd).toFixed(1)}:1</span>
                    )}
                  </div>
                )}
                {/* 단지명 */}
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{apt.house_nm}</div>
                {/* 주소 + 세대수 */}
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  {shortAddr}{apt.tot_supply_hshld_co > 0 ? ` · 일반분양 ${apt.tot_supply_hshld_co.toLocaleString()}세대` : ''}
                </div>
                {/* 타임라인 바 */}
                <div style={{ display: 'flex', gap: 2, fontSize: '9px', color: 'var(--text-tertiary)' }}>
                  {apt.spsply_rcept_bgnde && <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: 'var(--accent-purple-bg)' }}>특별 {fmtD(apt.spsply_rcept_bgnde)}</div>}
                  <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: st === 'open' ? 'rgba(96,165,250,0.15)' : 'rgba(148,163,184,0.06)', color: st === 'open' ? 'var(--accent-blue-light)' : undefined, fontWeight: st === 'open' ? 700 : 400 }}>접수 {fmtD(apt.rcept_bgnde)}~{fmtD(apt.rcept_endde)}</div>
                  {apt.przwner_presnatn_de && <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: 'rgba(52,211,153,0.06)' }}>당첨 {fmtD(apt.przwner_presnatn_de)}</div>}
                  {apt.cntrct_cncls_bgnde && <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: 'rgba(251,191,36,0.06)' }}>계약 {fmtD(apt.cntrct_cncls_bgnde)}</div>}
                </div>
              </Link>
            );
          })}

          {/* 청약 캘린더 */}
          <div className="kd-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <SectionShareButton section="apt-calendar" label="이번 달 청약 캘린더" pagePath="/apt" />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <button onClick={() => { setCalOffset(p => p - 1); setSelectedCalDate(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)', padding: '4px 8px' }}>‹</button>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📅 {monthLabel}</div>
                  <button onClick={() => { setCalOffset(p => p + 1); setSelectedCalDate(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)', padding: '4px 8px' }}>›</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, fontSize: 'var(--fs-xs)' }}>
                  {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                    <div key={d} style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontWeight: 700, padding: 4 }}>{d}</div>
                  ))}
                  {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                  {cells.map(c => (
                    <div key={c.day} onClick={() => c.apts.length > 0 && setSelectedCalDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`)} style={{
                      textAlign: 'center', padding: '4px 2px', borderRadius: 6, cursor: c.apts.length > 0 ? 'pointer' : 'default',
                      background: selectedCalDate?.endsWith(`-${String(c.day).padStart(2, '0')}`) ? 'rgba(96,165,250,0.25)' : c.apts.length > 0 ? 'rgba(96,165,250,0.1)' : 'transparent',
                      border: calOffset === 0 && c.day === kstNow().getDate() ? '2px solid var(--brand)' : '1px solid transparent',
                    }}>
                      <div style={{ color: c.apts.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: c.apts.length > 0 ? 700 : 400 }}>{c.day}</div>
                      {c.apts.length > 0 && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', fontWeight: 700 }}>{c.apts.length}건</div>}
                    </div>
                  ))}
                </div>
                </>
              );
            })()}
            {selectedCalDate && (() => {
              const dayApts = apts.filter(a => selectedCalDate >= String(a.rcept_bgnde || '').slice(0, 10) && selectedCalDate <= String(a.rcept_endde || '').slice(0, 10));
              return dayApts.length > 0 ? (
                <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg-hover)', borderRadius: 8 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                    📅 {selectedCalDate.slice(5).replace('-', '월 ')}일 청약 일정 ({dayApts.length}건)
                  </div>
                  {dayApts.map(a => (
                    <a key={a.id} href={`/apt/${encodeURIComponent(generateAptSlug(a.house_nm) || a.house_manage_no || String(a.id))}`} style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', padding: '6px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-link, #58a6ff)' }}>{a.house_nm}</span>
                      <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{a.region_nm} · {a.tot_supply_hshld_co?.toLocaleString() || '-'}세대</span>
                    </a>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
            📊 청약홈·공공데이터포털 API 기준 · 매일 06시 자동 갱신
          </p>
        </div>

  );
}
