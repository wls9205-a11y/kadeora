'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import AptCommentSheet from '@/components/AptCommentSheet';
import UnsoldStatsWidget from '@/components/UnsoldStatsWidget';

interface Apt {
  id: number; house_nm: string; house_manage_no?: string; region_nm: string;
  hssply_adres: string; tot_supply_hshld_co: number;
  rcept_bgnde: string; rcept_endde: string; przwner_presnatn_de: string;
  cntrct_cncls_bgnde: string; cntrct_cncls_endde: string;
  spsply_rcept_bgnde: string; spsply_rcept_endde: string;
  mvn_prearnge_ym: string; pblanc_url: string; mdatrgbn_nm: string;
  competition_rate_1st: number | null; competition_rate_2nd?: number | null;
  view_count?: number;
}

function getStatus(apt: Apt): 'open' | 'upcoming' | 'closed' {
  const today = new Date().toISOString().slice(0, 10);
  if (!apt.rcept_bgnde) return 'upcoming';
  if (today >= String(apt.rcept_bgnde) && today <= String(apt.rcept_endde)) return 'open';
  if (today < String(apt.rcept_bgnde)) return 'upcoming';
  return 'closed';
}

function fmtD(d: string | null | undefined): string {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const [, m, dd] = s.split('-');
  return `${m}.${dd}`;
}

const SB = {
  open: { label: '접수중', bg: '#14532d', color: '#86efac', border: '#166534' },
  upcoming: { label: '접수예정', bg: '#1e3a5f', color: '#93c5fd', border: '#1e40af' },
  closed: { label: '마감', bg: 'transparent', color: 'var(--text-tertiary)', border: 'var(--border)' },
} as const;

export default function AptClient({ apts, unsold = [], alertCounts = {}, lastRefreshed, regionStats = [] }: { apts: Apt[]; unsold?: any[]; alertCounts?: Record<string, number>; lastRefreshed?: string | null; regionStats?: { name: string; total: number; open: number; upcoming: number; closed: number }[] }) {
  const [activeTab, setActiveTab] = useState<'sub' | 'unsold'>('sub');
  const [region, setRegion] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [unsoldRegion, setUnsoldRegion] = useState('전체');
  const [myAlerts, setMyAlerts] = useState<Set<string>>(new Set());
  const [aptUser, setAptUser] = useState<any>(null);
  const [commentTarget, setCommentTarget] = useState<{ houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' } | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAptUser(data.session.user);
        sb.from('apt_alerts').select('house_manage_no').eq('user_id', data.session.user.id)
          .then(({ data: a }) => { if (a) setMyAlerts(new Set(a.map(x => x.house_manage_no))); });
      }
    });
  }, []);

  const toggleAlert = async (apt: Apt) => {
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
  };

  const availableRegions = useMemo(() => ['전체', ...Array.from(new Set(apts.map(a => a.region_nm).filter(Boolean))).sort()], [apts]);
  const filtered = useMemo(() => apts.filter(a => {
    if (region !== '전체' && a.region_nm !== region) return false;
    if (statusFilter !== '전체' && getStatus(a) !== statusFilter) return false;
    return true;
  }), [apts, region, statusFilter]);

  const pill = (v: string, sel: string, set: (v: string) => void, label?: string) => (
    <button key={v} onClick={() => set(v)} style={{
      padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
      border: `1px solid ${sel === v ? 'var(--brand)' : 'var(--border)'}`,
      background: sel === v ? 'var(--brand)' : 'transparent',
      color: sel === v ? '#fff' : 'var(--text-tertiary)',
    }}>{label || v}</button>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 12px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🏢 부동산</h1>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>전국 청약 일정과 미분양 현황</span>
          <a href="/apt/diagnose" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>🎯 가점 진단 →</a>
          <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>🏠 청약홈 →</a>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
        {([['sub', '청약 일정'], ['unsold', '미분양']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{
            flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: activeTab === k ? 'var(--brand)' : 'transparent',
            color: activeTab === k ? '#fff' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13,
          }}>{l}</button>
        ))}
      </div>

      {/* ━━━ 청약 일정 탭 ━━━ */}
      {activeTab === 'sub' && (
        <div>
          {/* 지역별 현황판 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>총 {apts.length}건</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
              <button onClick={() => setRegion('전체')} style={{
                padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                border: region === '전체' ? '2px solid var(--brand)' : '1px solid var(--border)',
                background: region === '전체' ? 'var(--brand)' : 'var(--bg-surface)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: region === '전체' ? '#fff' : 'var(--brand)' }}>{apts.length}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: region === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
              </button>
              {regionStats.map(r => (
                <button key={r.name} onClick={() => setRegion(r.name === region ? '전체' : r.name)} style={{
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                  border: region === r.name ? '2px solid var(--brand)' : '1px solid var(--border)',
                  background: region === r.name ? 'var(--brand)' : 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: region === r.name ? '#fff' : 'var(--brand)' }}>{r.total}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: region === r.name ? '#fff' : 'var(--text-secondary)' }}>{r.name}</span>
                  <div style={{ fontSize: 8, display: 'flex', gap: 2, color: region === r.name ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>
                    {r.open > 0 && <span style={{ color: region === r.name ? '#fff' : '#22c55e' }}>접수{r.open}</span>}
                    {r.upcoming > 0 && <span style={{ color: region === r.name ? '#fff' : '#3b82f6' }}>예정{r.upcoming}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            {pill('전체', statusFilter, setStatusFilter)}
            {pill('open', statusFilter, setStatusFilter, '접수중')}
            {pill('upcoming', statusFilter, setStatusFilter, '예정')}
            {pill('closed', statusFilter, setStatusFilter, '마감')}
          </div>

          {/* 필터 결과 카운트 */}
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>총 <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong>건</span>
            {filtered.filter(a => getStatus(a) === 'open').length > 0 && (
              <span style={{ color: '#22c55e', fontWeight: 600 }}>접수중 {filtered.filter(a => getStatus(a) === 'open').length}건</span>
            )}
          </div>

          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>조건에 맞는 청약이 없습니다</div>}

          {filtered.map((apt, i) => {
            const st = getStatus(apt);
            const bd = SB[st];
            const h = apt.house_manage_no || String(apt.id);
            const ac = alertCounts[h] || 0;
            const my = myAlerts.has(h);
            const dday = !apt.rcept_bgnde ? null : Math.ceil((new Date(apt.rcept_bgnde).getTime() - Date.now()) / 86400000);

            const accentColor = st === 'open' ? '#22c55e' : st === 'upcoming' ? '#3b82f6' : 'var(--border)';
            // 간략 주소: 전체 주소에서 구+동 추출
            const shortAddr = apt.hssply_adres ? apt.hssply_adres.replace(/^[^\s]+\s/, '').split(' ').slice(0, 2).join(' ') : '';
            return (
              <Link key={apt.id} href={`/apt/${apt.house_manage_no || apt.id}`} style={{
                display: 'block', padding: '12px 16px', borderRadius: 12, marginBottom: 6,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderLeft: `4px solid ${accentColor}`,
                opacity: st === 'closed' ? 0.6 : 1,
                textDecoration: 'none', color: 'inherit',
              }}>
                {/* 1행: 상태 + D-day + 지역 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: bd.bg, color: bd.color, border: `1px solid ${bd.border}` }}>{bd.label}</span>
                  {dday !== null && dday >= 0 && st !== 'closed' && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: dday <= 2 ? '#dc2626' : dday <= 6 ? '#d97706' : 'var(--text-secondary)' }}>D-{dday}</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{apt.region_nm}</span>
                </div>
                {/* 2행: 단지명 */}
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{apt.house_nm}</div>
                {/* 3행: 간략주소 + 세대수 */}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                  {shortAddr}{apt.tot_supply_hshld_co > 0 ? ` · ${apt.tot_supply_hshld_co.toLocaleString()}세대` : ''}
                </div>
                {/* 4행: 접수 기간 */}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {fmtD(apt.rcept_bgnde)} ~ {fmtD(apt.rcept_endde)}
                </div>
              </Link>
            );
          })}

          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
            청약홈(applyhome.co.kr) 공공 데이터 기준 · 정확한 일정은 청약홈에서 확인하세요
          </p>
        </div>
      )}

      {/* ━━━ 미분양 탭 ━━━ */}
      {activeTab === 'unsold' && (() => {
        if (!unsold.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>미분양 데이터가 없습니다</div>;
        const total = unsold.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
        const regs = ['전체', ...Array.from(new Set(unsold.map((u: any) => u.region_nm || '기타'))).sort()];
        const fu = unsoldRegion === '전체' ? unsold : unsold.filter((u: any) => (u.region_nm || '기타') === unsoldRegion);

        return (
          <div>
            {/* 미분양 통계 위젯 */}
            <UnsoldStatsWidget />

            {/* 요약 */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전국 미분양</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>{total.toLocaleString()}세대</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>현장</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{unsold.length}곳</div>
              </div>
              <div style={{ flex: 1, textAlign: 'right' as const, fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'flex-end' }}>국토교통부 기준</div>
            </div>

            {/* 안내 + 필터 */}
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>최근 1년 기준 · 국토교통부 미분양주택현황 및 청약홈 공공데이터</div>
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
              {regs.map(r => pill(r, unsoldRegion, setUnsoldRegion))}
            </div>

            {/* 리스트 */}
            {fu.map((u: any, i: number) => {
              const rate = u.tot_supply_hshld_co ? Math.round((u.tot_unsold_hshld_co / u.tot_supply_hshld_co) * 100) : null;
              const pMin = u.sale_price_min ? Math.round(u.sale_price_min / 10000 * 10) / 10 : null;
              const pMax = u.sale_price_max ? Math.round(u.sale_price_max / 10000 * 10) / 10 : null;
              const priceStr = pMin ? `${pMin}억${pMax && pMax !== pMin ? `~${pMax}억` : ''}` : null;

              return (
                <div key={u.id} style={{
                  padding: '16px 16px', borderRadius: 12, marginBottom: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  transition: 'background 0.15s', cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
                >
                  {/* 줄1: 현장명 + 미분양 배지 + 분양가 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Link href={`/apt/unsold/${u.id}`} style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{u.house_nm || '미분양 단지'}</Link>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700, flexShrink: 0 }}>미분양 {(u.tot_unsold_hshld_co || 0).toLocaleString()}세대</span>
                    {priceStr && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)', marginLeft: 'auto', flexShrink: 0 }}>{priceStr}</span>}
                  </div>

                  {/* 줄2: 지역 + 세대 */}
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    {u.region_nm}{u.sigungu_nm ? ` ${u.sigungu_nm}` : ''}
                    {u.tot_supply_hshld_co && <span> · 총 {u.tot_supply_hshld_co.toLocaleString()}세대</span>}
                    {u.completion_ym && <span> · 준공 {u.completion_ym.slice(0, 4)}.{u.completion_ym.slice(4, 6)}</span>}
                  </div>

                  {/* 미분양률 바 */}
                  {rate !== null && (
                    <div style={{ position: 'relative', height: 5, background: 'var(--bg-hover)', borderRadius: 2, marginBottom: 10 }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? '#ef4444' : rate > 40 ? '#f97316' : '#eab308' }} />
                      <span style={{ position: 'absolute', right: 0, top: -14, fontSize: 10, fontWeight: 700, color: '#f87171' }}>{rate}%</span>
                    </div>
                  )}

                  {/* 줄3: pill 버튼 */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setCommentTarget({ houseKey: `unsold_${u.id}`, houseNm: u.house_nm || '미분양', houseType: 'unsold' })}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>✏️ 한줄평</button>
                    <Link href={`/apt/unsold/${u.id}`} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>자세히 →</Link>
                    {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>홈페이지 →</a>}
                  </div>
                </div>
              );
            })}

            {fu.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>해당 지역 데이터가 없습니다</div>}
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>최근 1년 미분양 현황 · 국토교통부 미분양주택현황 및 청약홈 공공데이터 기반 · 매월 갱신</p>
          </div>
        );
      })()}

      {/* 한줄평 바텀시트 */}
      {commentTarget && (
        <AptCommentSheet
          houseKey={commentTarget.houseKey}
          houseNm={commentTarget.houseNm}
          houseType={commentTarget.houseType}
          open={!!commentTarget}
          onClose={() => setCommentTarget(null)}
        />
      )}
    </div>
  );
}
