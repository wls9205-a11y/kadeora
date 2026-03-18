'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Apt {
  id: number;
  house_nm: string;
  house_manage_no?: string;
  region_nm: string;
  hssply_adres: string;
  tot_supply_hshld_co: number;
  rcept_bgnde: string;
  rcept_endde: string;
  spsply_rcept_bgnde: string;
  spsply_rcept_endde: string;
  przwner_presnatn_de: string;
  cntrct_cncls_bgnde: string;
  cntrct_cncls_endde: string;
  mvn_prearnge_ym: string;
  pblanc_url: string;
  mdatrgbn_nm: string;
  competition_rate_1st: number | null;
  competition_rate_2nd?: number | null;
  view_count?: number;
}

// 동적 지역 목록은 useMemo로 apts에서 추출

function getStatus(apt: Apt): 'open'|'upcoming'|'closed' {
  const today = new Date().toISOString().slice(0,10);
  if (!apt.rcept_bgnde) return 'upcoming';
  if (today >= apt.rcept_bgnde && today <= apt.rcept_endde) return 'open';
  if (today < apt.rcept_bgnde) return 'upcoming';
  return 'closed';
}

function getDday(apt: Apt): number | null {
  if (!apt.rcept_bgnde) return null;
  const today = new Date();
  const start = new Date(apt.rcept_bgnde);
  const diff = Math.ceil((start.getTime() - today.getTime()) / 86400000);
  return diff;
}

const STATUS_BADGE = {
  open:     { label: '접수중',   bg: '#14532d', color: '#86efac', border: '#166534' },
  upcoming: { label: '접수예정', bg: '#1e3a5f', color: '#93c5fd', border: '#1e40af' },
  closed:   { label: '마감',     bg: 'transparent', color: 'var(--text-tertiary)', border: 'var(--border)' },
} as const;

function fmtSupply(v: number | null | undefined): string {
  if (!v || v === 0) return '정보 업데이트 예정';
  return `${v.toLocaleString()}세대`;
}

export default function AptClient({ apts, unsold = [], alertCounts = {} }: { apts: Apt[]; unsold?: any[]; alertCounts?: Record<string, number> }) {
  const [activeTab, setActiveTab] = useState<'sub'|'unsold'>('sub');
  const [region, setRegion] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [expandedId, setExpandedId] = useState<number|null>(null);
  const [unsoldRegion, setUnsoldRegion] = useState('전체');
  const [myAlerts, setMyAlerts] = useState<Set<string>>(new Set());
  const [aptUser, setAptUser] = useState<any>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAptUser(data.session.user);
        sb.from('apt_alerts').select('house_manage_no').eq('user_id', data.session.user.id)
          .then(({ data: alerts }) => { if (alerts) setMyAlerts(new Set(alerts.map(a => a.house_manage_no))); });
      }
    });
  }, []);

  const toggleAlert = async (apt: Apt) => {
    if (!aptUser) return;
    const sb = createSupabaseBrowser();
    const houseNo = apt.house_manage_no || String(apt.id);
    if (myAlerts.has(houseNo)) {
      await sb.from('apt_alerts').delete().eq('user_id', aptUser.id).eq('house_manage_no', houseNo);
      setMyAlerts(prev => { const s = new Set(prev); s.delete(houseNo); return s; });
    } else {
      await sb.from('apt_alerts').insert({ user_id: aptUser.id, house_manage_no: houseNo, house_nm: apt.house_nm });
      setMyAlerts(prev => new Set([...prev, houseNo]));
    }
  };

  const availableRegions = useMemo(() => {
    const rs = Array.from(new Set(apts.map(a => a.region_nm).filter(Boolean)));
    return ['전체', ...rs.sort()];
  }, [apts]);

  const filtered = useMemo(() => {
    return apts.filter(apt => {
      if (region !== '전체' && apt.region_nm !== region) return false;
      if (statusFilter !== '전체' && getStatus(apt) !== statusFilter) return false;
      return true;
    });
  }, [apts, region, statusFilter]);

  const haptic = () => { try { if ('vibrate' in navigator) navigator.vibrate(10); } catch {} };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>🏢 부동산</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>전국 청약 일정과 미분양 현황을 한눈에</p>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <a href="/apt/diagnose" style={{ fontSize:12, color:'var(--brand)', textDecoration:'none', fontWeight:600 }}>🎯 청약 가점 진단 →</a>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:0, marginBottom:12, background:'var(--bg-surface)', borderRadius:8, padding:4, border:'1px solid var(--border)' }}>
        {([['sub','청약 일정'],['unsold','미분양']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            flex:1, padding:'8px 0', borderRadius:6, border:'none', cursor:'pointer',
            background: activeTab === key ? 'var(--brand)' : 'transparent',
            color: activeTab === key ? '#fff' : 'var(--text-secondary)', fontWeight:600, fontSize:13,
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'unsold' && (() => {
        if (unsold.length === 0) return <div style={{ textAlign:'center', padding:40, color:'var(--text-tertiary)' }}>미분양 데이터가 없습니다</div>;
        const totalUnsold = unsold.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
        const regions = Array.from(new Set(unsold.map((u: any) => u.region_nm || '기타')));
        const filteredU = unsoldRegion === '전체' ? unsold : unsold.filter((u: any) => (u.region_nm || '기타') === unsoldRegion);
        const grouped = filteredU.reduce((a: any, u: any) => { const r = u.region_nm || '기타'; if (!a[r]) a[r] = []; a[r].push(u); return a; }, {} as Record<string, any[]>);
        return (
          <div style={{ marginBottom:16 }}>
            {/* 미분양 요약 배너 */}
            <div style={{ background:'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.05))', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>전국 미분양</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#dc2626' }}>{totalUnsold.toLocaleString()}세대</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>현장 수</div>
                <div style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)' }}>{unsold.length}곳</div>
              </div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', flex:1, textAlign:'right' }}>국토교통부 기준 · 매월 갱신</div>
            </div>

            <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:16, paddingBottom:4 }}>
              {['전체', ...regions].map(r => (
                <button key={r} onClick={() => setUnsoldRegion(r)} style={{
                  padding:'6px 14px', borderRadius:20, border:'1px solid',
                  borderColor: unsoldRegion === r ? 'var(--brand)' : 'var(--border)',
                  background: unsoldRegion === r ? 'var(--brand)' : 'var(--bg-hover)',
                  color: unsoldRegion === r ? '#fff' : 'var(--text-secondary)',
                  fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                }}>{r}</button>
              ))}
            </div>
            {Object.entries(grouped).map(([region, items]) => (
              <div key={region} style={{ marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:8, borderBottom:'1px solid var(--border)', paddingBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                  📍 {region}
                  <span style={{ fontSize:11, color:'var(--text-tertiary)', background:'var(--bg-hover)', borderRadius:10, padding:'1px 6px' }}>{(items as any[]).length}개</span>
                </div>
                {(items as any[]).map((u: any) => {
                  const unsoldRate = u.tot_supply_hshld_co ? Math.round((u.tot_unsold_hshld_co / u.tot_supply_hshld_co) * 100) : null;
                  const priceMin = u.sale_price_min ? Math.round(u.sale_price_min / 10000 * 10) / 10 : null;
                  const priceMax = u.sale_price_max ? Math.round(u.sale_price_max / 10000 * 10) / 10 : null;
                  return (
                  <div key={u.id} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:16, marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:'rgba(239,68,68,0.15)', color:'#f87171', border:'1px solid rgba(239,68,68,0.3)', flexShrink:0 }}>
                            미분양 {(u.tot_unsold_hshld_co||0).toLocaleString()}세대
                          </span>
                          <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{u.house_nm || '미분양 단지'}</span>
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{u.sigungu_nm || ''}{u.supply_addr ? ` · ${u.supply_addr}` : ''}</div>
                      </div>
                      {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'var(--brand)', textDecoration:'none', fontWeight:600, flexShrink:0 }}>자세히 →</a>}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
                      {(priceMin || priceMax) && (
                        <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:'8px 10px' }}>
                          <div style={{ fontSize:10, color:'var(--text-tertiary)', marginBottom:3 }}>분양가</div>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{priceMin}억{priceMax && priceMax !== priceMin ? `~${priceMax}억` : ''} 원</div>
                        </div>
                      )}
                      {u.tot_supply_hshld_co && (
                        <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:'8px 10px' }}>
                          <div style={{ fontSize:10, color:'var(--text-tertiary)', marginBottom:3 }}>총 공급</div>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{u.tot_supply_hshld_co.toLocaleString()}세대</div>
                        </div>
                      )}
                      {u.completion_ym && (
                        <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:'8px 10px' }}>
                          <div style={{ fontSize:10, color:'var(--text-tertiary)', marginBottom:3 }}>준공예정</div>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{u.completion_ym.slice(0,4)}년 {u.completion_ym.slice(4,6)}월</div>
                        </div>
                      )}
                      {u.contact_tel && (
                        <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:'8px 10px' }}>
                          <div style={{ fontSize:10, color:'var(--text-tertiary)', marginBottom:3 }}>문의처</div>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{u.contact_tel}</div>
                        </div>
                      )}
                    </div>
                    {unsoldRate !== null && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>미분양률</span>
                          <span style={{ fontSize:10, fontWeight:700, color:'#f87171' }}>{unsoldRate}%</span>
                        </div>
                        <div style={{ height:4, background:'var(--bg-hover)', borderRadius:2 }}>
                          <div style={{ height:'100%', borderRadius:2, width:`${Math.min(unsoldRate,100)}%`, background: unsoldRate > 70 ? '#ef4444' : unsoldRate > 40 ? '#f97316' : '#eab308' }} />
                        </div>
                      </div>
                    )}
                    <div style={{ display:'flex', gap:8 }}>
                      <a href="/discussion/field_discussion" style={{ fontSize:12, padding:'5px 11px', borderRadius:8, background:'var(--bg-hover)', color:'var(--text-secondary)', border:'1px solid var(--border)', textDecoration:'none', fontWeight:600 }}>📍 현장토론방</a>
                      <a href={`/discussion/field_discussion?apt=${encodeURIComponent(u.house_nm||'')}`} style={{ fontSize:12, padding:'5px 11px', borderRadius:8, background:'var(--bg-hover)', color:'var(--text-secondary)', border:'1px solid var(--border)', textDecoration:'none', fontWeight:600 }}>✏️ 한줄평</a>
                    </div>
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

      {activeTab === 'sub' && (<>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>📅 청약홈 기준 · 매일 자동 갱신</p>

      {/* 지역 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
        {availableRegions.map(r => (
          <button
            key={r}
            onClick={() => { haptic(); setRegion(r); }}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              backgroundColor: region === r ? 'var(--brand)' : 'var(--bg-hover)',
              color: region === r ? 'var(--text-inverse, #fff)' : 'var(--text-secondary)',
              border: region === r ? 'none' : '1px solid var(--border)',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-5">
        {['전체','open','upcoming','closed'].map(s => (
          <button
            key={s}
            onClick={() => { haptic(); setStatusFilter(s); }}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: statusFilter === s ? 'var(--brand)' : 'var(--bg-hover)',
              color: statusFilter === s ? 'var(--text-inverse, #fff)' : 'var(--text-secondary)',
              border: statusFilter === s ? 'none' : '1px solid var(--border)',
            }}
          >
            {s === '전체' ? '전체' : s === 'open' ? '접수중' : s === 'upcoming' ? '예정' : '마감'}
          </button>
        ))}
      </div>

      {/* 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
            조건에 맞는 청약 정보가 없습니다
          </div>
        )}
        {filtered.map(apt => {
          const status = getStatus(apt);
          const badge = STATUS_BADGE[status];
          const dday = getDday(apt);
          const isClosed = status === 'closed';
          const houseNo = apt.house_manage_no || String(apt.id);

          return (
            <div key={apt.id} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '14px 16px', opacity: isClosed ? 0.75 : 1,
            }}>
              {/* 상단: 현장명 + 상태 배지 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{apt.house_nm}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, flexShrink: 0 }}>{badge.label}</span>
                    {status === 'upcoming' && dday !== null && dday >= 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'var(--brand-light)', color: 'var(--brand)' }}>D-{dday}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{apt.region_nm} {apt.hssply_adres ? `· ${apt.hssply_adres}` : ''}</div>
                </div>
                {apt.pblanc_url && (
                  <a href={apt.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none', flexShrink: 0, marginLeft: 8, fontWeight: 600 }}>자세히 →</a>
                )}
              </div>

              {/* 청약 일정 그리드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '7px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>청약 접수</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {apt.rcept_bgnde ? String(apt.rcept_bgnde).slice(5).replace('-', '/') : '-'} ~ {apt.rcept_endde ? String(apt.rcept_endde).slice(5).replace('-', '/') : '-'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '7px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>당첨자 발표</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{apt.przwner_presnatn_de ? String(apt.przwner_presnatn_de).slice(5).replace('-', '/') : '-'}</div>
                </div>
                {apt.tot_supply_hshld_co > 0 && (
                  <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '7px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>총 공급</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{apt.tot_supply_hshld_co.toLocaleString()}세대</div>
                  </div>
                )}
                {apt.cntrct_cncls_bgnde && (
                  <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '7px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>계약</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{String(apt.cntrct_cncls_bgnde).slice(5).replace('-', '/')} ~ {apt.cntrct_cncls_endde ? String(apt.cntrct_cncls_endde).slice(5).replace('-', '/') : ''}</div>
                  </div>
                )}
              </div>

              {/* 경쟁률 (마감 현장) */}
              {isClosed && apt.competition_rate_1st && Number(apt.competition_rate_1st) > 0 && (
                <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>경쟁률</div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>1순위</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#6366f1' }}>{Number(apt.competition_rate_1st).toFixed(1)} : 1</div>
                  </div>
                </div>
              )}

              {/* 조회수 + 알림 + 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>👁 {(apt.view_count || 0).toLocaleString()}</span>
                {(alertCounts[houseNo] || 0) > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>🔔 {alertCounts[houseNo]}명 알림</span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => toggleAlert(apt)} style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                  background: myAlerts.has(houseNo) ? 'rgba(255,69,0,0.1)' : 'var(--bg-hover)',
                  color: myAlerts.has(houseNo) ? 'var(--brand)' : 'var(--text-secondary)',
                  border: `1px solid ${myAlerts.has(houseNo) ? 'var(--brand)' : 'var(--border)'}`, fontWeight: 600,
                }}>{myAlerts.has(houseNo) ? '🔔 알림중' : '🔕 알림받기'}</button>
                <a href={`/discussion/field_discussion?apt=${encodeURIComponent(apt.house_nm || '')}`} style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 8, background: 'var(--bg-hover)',
                  color: 'var(--text-secondary)', border: '1px solid var(--border)', textDecoration: 'none', fontWeight: 600,
                }}>✏️ 한줄평</a>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 16 }}>
        청약 정보: 청약홈(applyhome.co.kr) 공공 데이터 기반 · 정확한 일정은 청약홈에서 반드시 확인하세요
      </p>
      </>)}
    </div>
  );
}
