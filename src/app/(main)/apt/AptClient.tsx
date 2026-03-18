'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import AptCommentSheet from '@/components/AptCommentSheet';

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

export default function AptClient({ apts, unsold = [], alertCounts = {} }: { apts: Apt[]; unsold?: any[]; alertCounts?: Record<string, number> }) {
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
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', gap: 12 }}>
          <span>전국 청약 일정과 미분양 현황</span>
          <a href="/apt/diagnose" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>🎯 가점 진단 →</a>
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
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 8, paddingBottom: 2 }}>
            {availableRegions.map(r => pill(r, region, setRegion))}
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            {pill('전체', statusFilter, setStatusFilter)}
            {pill('open', statusFilter, setStatusFilter, '접수중')}
            {pill('upcoming', statusFilter, setStatusFilter, '예정')}
            {pill('closed', statusFilter, setStatusFilter, '마감')}
          </div>

          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>조건에 맞는 청약이 없습니다</div>}

          {filtered.map((apt, i) => {
            const st = getStatus(apt);
            const bd = SB[st];
            const h = apt.house_manage_no || String(apt.id);
            const ac = alertCounts[h] || 0;
            const my = myAlerts.has(h);
            const dday = !apt.rcept_bgnde ? null : Math.ceil((new Date(apt.rcept_bgnde).getTime() - Date.now()) / 86400000);

            return (
              <div key={apt.id} style={{
                padding: '14px 0', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: st === 'closed' ? 0.7 : 1,
              }}>
                {/* 줄1: 배지 + 현장명 + 경쟁률 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: bd.bg, color: bd.color, border: `1px solid ${bd.border}` }}>{bd.label}</span>
                  {st === 'upcoming' && dday !== null && dday >= 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>D-{dday}</span>
                  )}
                  <Link href={`/apt/${apt.house_manage_no || apt.id}`} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{apt.house_nm}</Link>
                  {apt.competition_rate_1st && Number(apt.competition_rate_1st) > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 7px', borderRadius: 10 }}>
                      {Number(apt.competition_rate_1st).toFixed(1)}:1
                    </span>
                  )}
                </div>

                {/* 줄2: 주소 */}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  {apt.region_nm}{apt.hssply_adres ? ` · ${apt.hssply_adres}` : ''}
                  {apt.tot_supply_hshld_co > 0 && <span> · {apt.tot_supply_hshld_co.toLocaleString()}세대</span>}
                </div>

                {/* 줄3: 날짜 한줄 */}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  청약 {fmtD(apt.rcept_bgnde)}~{fmtD(apt.rcept_endde)} · 당첨 {fmtD(apt.przwner_presnatn_de)}
                  {apt.cntrct_cncls_bgnde && <span> · 계약 {fmtD(apt.cntrct_cncls_bgnde)}~{fmtD(apt.cntrct_cncls_endde)}</span>}
                </div>

                {/* 줄4: 조회/알림 + 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>👁 {(apt.view_count || 0).toLocaleString()}</span>
                  {ac > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>🔔 {ac}</span>}
                  <button onClick={() => setCommentTarget({ houseKey: h, houseNm: apt.house_nm, houseType: 'sub' })} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>✏️ 한줄평</button>
                  <Link href={`/apt/${apt.house_manage_no || apt.id}`} style={{ fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>자세히 →</Link>
                  <div style={{ flex: 1 }} />
                  {aptUser && (
                    <button onClick={() => toggleAlert(apt)} style={{
                      width: 32, height: 32, borderRadius: '50%', border: `1px solid ${my ? 'var(--brand)' : 'var(--border)'}`,
                      background: my ? 'rgba(255,69,0,0.12)' : 'transparent',
                      color: my ? 'var(--brand)' : 'var(--text-tertiary)',
                      cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{my ? '🔔' : '🔕'}</button>
                  )}
                </div>
              </div>
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

            {/* 필터 */}
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
                <div key={u.id} style={{ padding: '14px 0', borderBottom: i < fu.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {/* 줄1: 현장명 + 분양가 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      <Link href={`/apt/unsold/${u.id}`} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{u.house_nm || '미분양 단지'}</Link>
                    </div>
                    {priceStr && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)', flexShrink: 0, marginLeft: 8 }}>{priceStr}</span>}
                  </div>

                  {/* 줄2: 지역 + 세대 */}
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    {u.region_nm}{u.sigungu_nm ? ` ${u.sigungu_nm}` : ''}
                    {u.tot_supply_hshld_co && <span> · 총 {u.tot_supply_hshld_co.toLocaleString()}세대</span>}
                    <span style={{ color: '#f87171', fontWeight: 600 }}> · 미분양 {(u.tot_unsold_hshld_co || 0).toLocaleString()}세대</span>
                    {u.completion_ym && <span> · 준공 {u.completion_ym.slice(0, 4)}.{u.completion_ym.slice(4, 6)}</span>}
                  </div>

                  {/* 미분양률 바 */}
                  {rate !== null && (
                    <div style={{ position: 'relative', height: 4, background: 'var(--bg-hover)', borderRadius: 2, marginBottom: 8 }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? '#ef4444' : rate > 40 ? '#f97316' : '#eab308' }} />
                      <span style={{ position: 'absolute', right: 0, top: -14, fontSize: 10, fontWeight: 700, color: '#f87171' }}>{rate}%</span>
                    </div>
                  )}

                  {/* 줄3: 링크 */}
                  <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                    <button onClick={() => setCommentTarget({ houseKey: `unsold_${u.id}`, houseNm: u.house_nm || '미분양', houseType: 'unsold' })} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 11 }}>✏️ 한줄평</button>
                    <Link href={`/apt/unsold/${u.id}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>자세히 →</Link>
                    {u.contact_tel && <a href={`tel:${u.contact_tel}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>📞 전화문의</a>}
                    {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>홈페이지 →</a>}
                  </div>
                </div>
              );
            })}

            {fu.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>해당 지역 데이터가 없습니다</div>}
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>데이터는 주기적으로 업데이트됩니다 · 국토교통부 기준</p>
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
