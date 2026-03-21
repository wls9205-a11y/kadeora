'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import AptCommentSheet from '@/components/AptCommentSheet';

const NEW_HOURS: Record<string, number> = { subscription: 24, unsold: 168, redevelopment: 168, transaction: 72 };
function isNew(item: any, type: string): boolean {
  const h = NEW_HOURS[type] || 72;
  const ts = item.created_at || item.fetched_at;
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < h * 60 * 60 * 1000;
}
const NewBadge = () => <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#ef4444', color: '#fff', marginRight: 4, animation: 'pulse 2s infinite' }}>NEW</span>;


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

const STAGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '정비구역지정': { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '#6b7280' },
  '조합설립': { bg: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '#3b82f6' },
  '사업시행인가': { bg: 'rgba(234,179,8,0.15)', color: '#fde047', border: '#eab308' },
  '관리처분': { bg: 'rgba(249,115,22,0.15)', color: '#fdba74', border: '#f97316' },
  '착공': { bg: 'rgba(34,197,94,0.15)', color: '#86efac', border: '#22c55e' },
  '준공': { bg: 'rgba(255,91,54,0.15)', color: '#ff5b36', border: 'var(--brand)' },
};
const STAGE_ORDER = ['정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공'];

export default function AptClient({ apts, unsold = [], redevelopment = [], transactions = [], unsoldSummary, alertCounts = {}, lastRefreshed, regionStats = [] }: { apts: Apt[]; unsold?: any[]; redevelopment?: any[]; transactions?: any[]; unsoldSummary?: any; alertCounts?: Record<string, number>; lastRefreshed?: string | null; regionStats?: { name: string; total: number; open: number; upcoming: number; closed: number }[] }) {
  const [activeTab, setActiveTab] = useState<'sub' | 'unsold' | 'redev' | 'trade'>('sub');
  const [region, setRegion] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [unsoldRegion, setUnsoldRegion] = useState('전체');
  const [redevType, setRedevType] = useState('전체');
  const [redevRegion, setRedevRegion] = useState('전체');
  const [redevPage, setRedevPage] = useState(1);
  const [tradeRegion, setTradeRegion] = useState('전체');
  const [tradePage, setTradePage] = useState(1);
  const [myAlerts, setMyAlerts] = useState<Set<string>>(new Set());
  const [aptUser, setAptUser] = useState<any>(null);
  const [commentTarget, setCommentTarget] = useState<{ houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' } | null>(null);
  const [selectedRedev, setSelectedRedev] = useState<any | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🏢 부동산</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/apt/diagnose" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,91,54,0.08)', border: '1px solid rgba(255,91,54,0.15)' }}>🎯 가점진단</a>
          <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>🏠 청약홈</a>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
        {[
          { k: 'sub' as const, l: '📅 청약', type: 'subscription', data: apts },
          { k: 'unsold' as const, l: '🏚️ 미분양', type: 'unsold', data: unsold },
          { k: 'redev' as const, l: '🏗️ 재개발', type: 'redevelopment', data: redevelopment },
          { k: 'trade' as const, l: '💰 실거래', type: 'transaction', data: transactions },
        ].map(({ k, l, type, data }) => {
          const hasNew = (data as any[]).some((item: any) => isNew(item, type));
          return (
            <button key={k} onClick={() => setActiveTab(k)} style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', position: 'relative',
              background: activeTab === k ? 'var(--brand)' : 'transparent',
              color: activeTab === k ? '#fff' : 'var(--text-secondary)', fontWeight: 600, fontSize: 12,
            }}>
              {l}
              {hasNew && activeTab !== k && <span style={{ position: 'absolute', top: 4, right: 8, width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />}
            </button>
          );
        })}
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
                  {r.total > 0 && (
                    <div style={{ width: '100%', height: 3, background: region === r.name ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 2, overflow: 'hidden', display: 'flex', marginTop: 2 }}>
                      <div style={{ height: '100%', background: '#22c55e', width: `${(r.open / r.total) * 100}%` }} />
                      <div style={{ height: '100%', background: '#3b82f6', width: `${(r.upcoming / r.total) * 100}%` }} />
                    </div>
                  )}
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
                  {isNew(apt, 'subscription') && <NewBadge />}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: bd.bg, color: bd.color, border: `1px solid ${bd.border}` }}>{bd.label}</span>
                  {dday !== null && dday >= 0 && st !== 'closed' && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: dday <= 2 ? '#dc2626' : dday <= 6 ? '#d97706' : 'var(--text-secondary)' }}>D-{dday}</span>
                  )}
                  {(apt as any).PARCPRC_ULS_AT === 'Y' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>분양가상한</span>}
                  {(apt as any).SPECLT_RDN_EARTH_AT === 'Y' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>투기과열</span>}
                  {(apt as any).MDAT_TRGET_AREA_SECD === 'Y' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(249,115,22,0.12)', color: '#fdba74', border: '1px solid rgba(249,115,22,0.2)' }}>조정대상</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{apt.region_nm}</span>
                </div>
                {/* 경쟁률 */}
                {(apt.competition_rate_1st != null && Number(apt.competition_rate_1st) > 0) && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: Number(apt.competition_rate_1st) >= 10 ? '#ef4444' : Number(apt.competition_rate_1st) >= 5 ? '#f97316' : '#22c55e', fontWeight: 700 }}>
                      {Number(apt.competition_rate_1st) >= 10 ? '🔥' : ''} 1순위 {Number(apt.competition_rate_1st).toFixed(1)}:1
                    </span>
                    {apt.competition_rate_2nd != null && Number(apt.competition_rate_2nd) > 0 && (
                      <span style={{ color: 'var(--text-tertiary)' }}>2순위 {Number(apt.competition_rate_2nd).toFixed(1)}:1</span>
                    )}
                  </div>
                )}
                {/* 2행: 단지명 */}
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{apt.house_nm}</div>
                {/* 3행: 간략주소 + 세대수 */}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                  {shortAddr}{apt.tot_supply_hshld_co > 0 ? ` · ${apt.tot_supply_hshld_co.toLocaleString()}세대` : ''}
                </div>
                {/* 4행: 일정 타임라인 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {apt.spsply_rcept_bgnde && <span>특별공급 {fmtD(apt.spsply_rcept_bgnde)}</span>}
                  <span>접수 {fmtD(apt.rcept_bgnde)}~{fmtD(apt.rcept_endde)}</span>
                  {apt.przwner_presnatn_de && <span>당첨발표 {fmtD(apt.przwner_presnatn_de)}</span>}
                  {apt.cntrct_cncls_bgnde && <span>계약 {fmtD(apt.cntrct_cncls_bgnde)}~{fmtD(apt.cntrct_cncls_endde)}</span>}
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
        const usRaw = unsoldSummary;
        const us: any = typeof usRaw === 'string' ? (() => { try { return JSON.parse(usRaw); } catch { return null; } })()
          : usRaw?.total != null ? usRaw
          : usRaw?.data?.total != null ? usRaw.data : null;

        // 지역별 현황판 데이터 집계
        const unsoldRegionStats = regs.filter(r => r !== '전체').map(r => {
          const items = unsold.filter((u: any) => (u.region_nm || '기타') === r);
          const unitCount = items.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
          return { name: r, siteCount: items.length, unitCount };
        }).sort((a, b) => b.unitCount - a.unitCount);

        return (
          <div>
            {/* 전국 종합 현황판 */}
            {us && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>📊 전국 미분양 현황</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전국</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>{(us.total || total).toLocaleString()}호</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>준공후(악성)</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{(us.after_completion || 0).toLocaleString()}호</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>수도권</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{(us.capital || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>지방</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{(us.local || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>{us.month ? `${us.month.slice(0,4)}.${us.month.slice(4)}` : us.year ? `${us.year}년` : ''} 기준 · 국토교통부 통계누리</div>
              </div>
            )}

            {/* 지역별 현황판 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 미분양 현황</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#f87171' }}>총 {total.toLocaleString()}세대</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
                <button onClick={() => setUnsoldRegion('전체')} style={{
                  padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  border: unsoldRegion === '전체' ? '2px solid #f87171' : '1px solid var(--border)',
                  background: unsoldRegion === '전체' ? '#f87171' : 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: unsoldRegion === '전체' ? '#fff' : '#f87171' }}>{total.toLocaleString()}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: unsoldRegion === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
                  <span style={{ fontSize: 8, color: unsoldRegion === '전체' ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{unsold.length}곳</span>
                </button>
                {unsoldRegionStats.map(r => (
                  <button key={r.name} onClick={() => setUnsoldRegion(r.name === unsoldRegion ? '전체' : r.name)} style={{
                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    border: unsoldRegion === r.name ? '2px solid #f87171' : '1px solid var(--border)',
                    background: unsoldRegion === r.name ? '#f87171' : 'var(--bg-surface)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: unsoldRegion === r.name ? '#fff' : '#f87171' }}>{r.unitCount.toLocaleString()}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: unsoldRegion === r.name ? '#fff' : 'var(--text-secondary)' }}>{r.name}</span>
                    <span style={{ fontSize: 8, color: unsoldRegion === r.name ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{r.siteCount}곳</span>
                    {total > 0 && (
                      <div style={{ width: '100%', height: 3, background: unsoldRegion === r.name ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                        <div style={{ height: '100%', background: unsoldRegion === r.name ? '#fff' : '#f87171', width: `${(r.unitCount / total) * 100}%` }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
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

              const unsoldCount = u.tot_unsold_hshld_co || 0;
              const dangerColor = unsoldCount >= 1000 ? '#ef4444' : unsoldCount >= 500 ? '#f97316' : unsoldCount >= 100 ? '#eab308' : '#22c55e';

              return (
                <div key={u.id} style={{
                  padding: '16px 16px', borderRadius: 12, marginBottom: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderLeft: `4px solid ${dangerColor}`,
                  transition: 'background 0.15s', cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
                >
                  {/* 줄1: 현장명 + 미분양 배지 + 분양가 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Link href={`/apt/unsold/${u.id}`} style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{u.house_nm && u.source !== 'molit_stat' ? u.house_nm : `${u.region_nm} ${u.sigungu_nm || ''} 미분양`}</Link>
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

      {/* ━━━ 재개발·재건축 탭 ━━━ */}
      {activeTab === 'redev' && (() => {
        if (!redevelopment.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>재개발·재건축 데이터가 없습니다</div>;

        const redevCount = redevelopment.filter((r: any) => r.project_type === '재개발').length;
        const rebuildCount = redevelopment.filter((r: any) => r.project_type === '재건축').length;
        const stageCount: Record<string, number> = {};
        STAGE_ORDER.forEach(s => { stageCount[s] = 0; });
        redevelopment.forEach((r: any) => { if (stageCount[r.stage] !== undefined) stageCount[r.stage]++; else stageCount['기타'] = (stageCount['기타'] || 0) + 1; });

        const totalHouseholds = redevelopment.reduce((s: number, r: any) => s + (r.total_households || 0), 0);

        // 지역별 현황판 데이터
        const redevRegionMap = new Map<string, { total: number; redev: number; rebuild: number; households: number }>();
        redevelopment.forEach((r: any) => {
          const region = r.region || '기타';
          const cur = redevRegionMap.get(region) || { total: 0, redev: 0, rebuild: 0, households: 0 };
          cur.total++;
          if (r.project_type === '재개발') cur.redev++; else cur.rebuild++;
          cur.households += r.total_households || 0;
          redevRegionMap.set(region, cur);
        });
        const redevRegionStats = Array.from(redevRegionMap.entries())
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.total - a.total);

        const redevRegs = ['전체', ...Array.from(new Set(redevelopment.map((r: any) => r.region || '기타'))).sort()];
        const filteredRedev = redevelopment.filter((r: any) => {
          if (redevType !== '전체' && r.project_type !== redevType) return false;
          if (redevRegion !== '전체' && r.region !== redevRegion) return false;
          return true;
        }).sort((a: any, b: any) => {
          const aOk = a.district_name && a.district_name !== '정보 준비중' && a.district_name !== '미상';
          const bOk = b.district_name && b.district_name !== '정보 준비중' && b.district_name !== '미상';
          if (aOk && !bOk) return -1;
          if (!aOk && bOk) return 1;
          return 0;
        });

        return (
          <div>
            {/* 현황 요약 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{redevelopment.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전체</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{redevCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>재개발</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f97316' }}>{rebuildCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>재건축</div>
              </div>
            </div>

            {/* 단계별 파이프라인 */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>단계별 현황</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                {STAGE_ORDER.map((stage, i) => {
                  const cnt = stageCount[stage] || 0;
                  const sc = STAGE_COLORS[stage] || STAGE_COLORS['정비구역지정'];
                  return (
                    <div key={stage} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: sc.color, marginBottom: 2 }}>{cnt}</div>
                      <div style={{ height: 4, background: sc.border, borderRadius: 2, marginBottom: 4 }} />
                      <div style={{ fontSize: 8, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>{stage.length > 4 ? stage.slice(0, 4) + '\n' + stage.slice(4) : stage}</div>
                      {i < STAGE_ORDER.length - 1 && <span />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 지역별 현황판 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>총 {totalHouseholds.toLocaleString()}세대</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
                <button onClick={() => { setRedevRegion('전체'); setRedevPage(1); }} style={{
                  padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  border: redevRegion === '전체' ? '2px solid var(--brand)' : '1px solid var(--border)',
                  background: redevRegion === '전체' ? 'var(--brand)' : 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: redevRegion === '전체' ? '#fff' : 'var(--brand)' }}>{redevelopment.length}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: redevRegion === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
                  <span style={{ fontSize: 8, color: redevRegion === '전체' ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{totalHouseholds.toLocaleString()}세대</span>
                </button>
                {redevRegionStats.map(r => (
                  <button key={r.name} onClick={() => { setRedevRegion(r.name === redevRegion ? '전체' : r.name); setRedevPage(1); }} style={{
                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    border: redevRegion === r.name ? '2px solid var(--brand)' : '1px solid var(--border)',
                    background: redevRegion === r.name ? 'var(--brand)' : 'var(--bg-surface)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: redevRegion === r.name ? '#fff' : 'var(--brand)' }}>{r.total}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: redevRegion === r.name ? '#fff' : 'var(--text-secondary)' }}>{r.name}</span>
                    <div style={{ fontSize: 8, display: 'flex', gap: 2, color: redevRegion === r.name ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>
                      {r.redev > 0 && <span style={{ color: redevRegion === r.name ? '#fff' : '#3b82f6' }}>개발{r.redev}</span>}
                      {r.rebuild > 0 && <span style={{ color: redevRegion === r.name ? '#fff' : '#22c55e' }}>건축{r.rebuild}</span>}
                    </div>
                    {r.total > 0 && (
                      <div style={{ width: '100%', height: 3, background: redevRegion === r.name ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 2, overflow: 'hidden', display: 'flex', marginTop: 2 }}>
                        <div style={{ height: '100%', background: '#3b82f6', width: `${(r.redev / r.total) * 100}%` }} />
                        <div style={{ height: '100%', background: '#22c55e', width: `${(r.rebuild / r.total) * 100}%` }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 유형 필터 */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
              {pill('전체', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재개발', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재건축', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
            </div>

            {/* 안내 */}
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>각 지자체 정비사업 공개 데이터 기준</div>

            {/* 결과 카운트 */}
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              총 <strong style={{ color: 'var(--text-primary)' }}>{filteredRedev.length}</strong>건
            </div>

            {/* 카드 리스트 (20건씩 페이지네이션) */}
            {filteredRedev.slice(0, redevPage * 20).map((r: any) => {
              const sc = STAGE_COLORS[r.stage] || STAGE_COLORS['정비구역지정'];
              return (
                <div key={r.id} onClick={() => setSelectedRedev(r)} style={{
                  padding: '12px 16px', borderRadius: 12, marginBottom: 6,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderLeft: `4px solid ${sc.border}`, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
                >
                  {/* 1행: 단계 + 유형 + 지역 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{r.stage}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: r.project_type === '재개발' ? 'rgba(59,130,246,0.1)' : 'rgba(249,115,22,0.1)', color: r.project_type === '재개발' ? '#93c5fd' : '#fdba74', border: `1px solid ${r.project_type === '재개발' ? 'rgba(59,130,246,0.2)' : 'rgba(249,115,22,0.2)'}` }}>{r.project_type}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{r.region}</span>
                  </div>
                  {/* 2행: 구역명 */}
                  <div style={{ fontSize: 15, fontWeight: 600, color: (!r.district_name || r.district_name === '미상' || r.district_name === '정보 준비중') ? 'var(--text-tertiary)' : 'var(--text-primary)', marginBottom: 2 }}>
                    {r.district_name && r.district_name !== '미상' && r.district_name !== '정보 준비중' ? r.district_name : r.address || r.notes || '📋 정보 준비중'}
                  </div>
                  {/* 3행: 시군구 + 세대수 + 시공사 */}
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    {r.sigungu}{r.total_households ? ` · ${r.total_households.toLocaleString()}세대` : ' · 세대수 미상'}{r.constructor ? ` · ${r.constructor}` : ''}
                  </div>
                  {/* 4행: 비고/예상준공 */}
                  {(r.notes || r.expected_completion) && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {r.notes}{r.expected_completion ? (r.notes ? `, ${r.expected_completion}` : r.expected_completion) : ''}
                    </div>
                  )}
                </div>
              );
            })}

            {redevPage * 20 < filteredRedev.length && (
              <button onClick={() => setRedevPage(p => p + 1)} style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8,
              }}>
                더 보기 ({Math.min(redevPage * 20, filteredRedev.length)} / {filteredRedev.length}건)
              </button>
            )}

            {filteredRedev.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>조건에 맞는 프로젝트가 없습니다</div>}
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
              각 지자체 정비사업 공개 데이터 기준 · 실제 진행 상황은 해당 조합/지자체에서 확인하세요
            </p>
          </div>
        );
      })()}

      {/* ━━━ 실거래가 탭 ━━━ */}
      {activeTab === 'trade' && (() => {
        if (!transactions.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>실거래가 데이터가 없습니다. 크론 수집 후 표시됩니다.</div>;

        const tradeRegs = ['전체', ...Array.from(new Set(transactions.map((t: any) => t.region_nm || '기타'))).sort()];
        const filteredTrades = tradeRegion === '전체' ? transactions : transactions.filter((t: any) => t.region_nm === tradeRegion);
        const pagedTrades = filteredTrades.slice(0, tradePage * 20);

        // 요약 통계
        const totalCount = filteredTrades.length;
        const avgAmount = totalCount > 0 ? Math.round(filteredTrades.reduce((s: number, t: any) => s + (t.deal_amount || 0), 0) / totalCount) : 0;

        function fmtAmount(amt: number): string {
          if (!amt) return '-';
          if (amt >= 10000) return `${(amt / 10000).toFixed(1)}억`;
          return `${amt.toLocaleString()}만`;
        }

        // 지역별 평균
        const regionAvgs: Record<string, { sum: number; cnt: number }> = {};
        filteredTrades.forEach((t: any) => {
          const r = t.region_nm || '기타';
          if (!regionAvgs[r]) regionAvgs[r] = { sum: 0, cnt: 0 };
          regionAvgs[r].sum += t.deal_amount || 0;
          regionAvgs[r].cnt++;
        });

        return (
          <div>
            {/* 대시보드 */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>📊 최근 거래 현황</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>{totalCount.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>거래 건수</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtAmount(avgAmount)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>평균 거래가</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{Object.keys(regionAvgs).length}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>지역 수</div>
                </div>
              </div>
              {Object.keys(regionAvgs).length > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(regionAvgs).sort((a, b) => b[1].sum / b[1].cnt - a[1].sum / a[1].cnt).slice(0, 3).map(([r, v]) => (
                    <span key={r} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r} 평균 <strong style={{ color: 'var(--text-secondary)' }}>{fmtAmount(Math.round(v.sum / v.cnt))}</strong></span>
                  ))}
                </div>
              )}
            </div>

            {/* 지역 필터 */}
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
              {tradeRegs.map(r => pill(r, tradeRegion, (v) => { setTradeRegion(v); setTradePage(1); }))}
            </div>

            {/* 결과 */}
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              총 <strong style={{ color: 'var(--text-primary)' }}>{filteredTrades.length}</strong>건
            </div>

            {/* 카드 리스트 */}
            {pagedTrades.map((t: any, i: number) => {
              const amt = t.deal_amount || 0;
              const borderColor = amt >= 100000 ? '#ef4444' : amt >= 50000 ? '#f97316' : amt >= 30000 ? '#eab308' : '#22c55e';
              return (
                <div key={`${t.id || i}`} onClick={() => setSelectedTrade(t)} style={{
                  padding: '12px 16px', borderRadius: 12, marginBottom: 6,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderLeft: `4px solid ${borderColor}`, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {isNew(t, 'transaction') && <NewBadge />}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>{t.trade_type || '매매'}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{t.region_nm} {t.sigungu}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{t.apt_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    전용 {t.exclusive_area}㎡ | <strong style={{ color: 'var(--text-primary)' }}>{fmtAmount(amt)}</strong> | {t.floor}층 | {t.deal_date}
                  </div>
                </div>
              );
            })}

            {tradePage * 20 < filteredTrades.length && (
              <button onClick={() => setTradePage(p => p + 1)} style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8,
              }}>
                더 보기 ({Math.min(tradePage * 20, filteredTrades.length)} / {filteredTrades.length}건)
              </button>
            )}

            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
              국토교통부 실거래가 공개시스템 기준 · 실제 거래가와 차이가 있을 수 있습니다
            </p>
          </div>
        );
      })()}

      {/* 재개발 상세 모달 */}
      {selectedRedev && (() => {
        const r = selectedRedev;
        const sc = STAGE_COLORS[r.stage] || STAGE_COLORS['정비구역지정'];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setSelectedRedev(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSelectedRedev(null); }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
            <div style={{
              position: 'relative', width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: '16px 16px 0 0', padding: 20,
            }} onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{r.stage}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: r.project_type === '재개발' ? 'rgba(59,130,246,0.1)' : 'rgba(249,115,22,0.1)', color: r.project_type === '재개발' ? '#93c5fd' : '#fdba74' }}>{r.project_type}</span>
                <button onClick={() => setSelectedRedev(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
              </div>

              {/* 제목 */}
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{r.district_name && r.district_name !== '미상' ? r.district_name : r.address || r.notes || '정비사업'}</h2>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                {r.region}{r.sigungu ? ` ${r.sigungu}` : ''}{r.total_households ? ` · ${r.total_households.toLocaleString()}세대` : ''}
              </div>

              {/* 상세 정보 */}
              <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                {[
                  r.address && ['📍 주소', r.address],
                  r.constructor && ['🏗️ 시공사', r.constructor],
                  r.area_sqm && ['📐 면적', `${r.area_sqm.toLocaleString()}㎡`],
                  r.stage && ['📅 단계', r.stage],
                  r.expected_completion && ['🗓️ 예상 준공', r.expected_completion],
                  r.notes && ['📝 비고', r.notes],
                ].filter(Boolean).map(([label, value]: any) => (
                  <div key={label} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, width: 70 }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* 요약 */}
              {r.summary ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>📋 사업 요약</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{r.summary}</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0', marginBottom: 16 }}>
                  요약 정보를 준비 중입니다
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                본 정보는 참고용이며, 투자 판단의 근거로 사용하면 안 됩니다.
              </div>
            </div>
          </div>
        );
      })()}

      {/* 실거래가 상세 모달 */}
      {selectedTrade && (() => {
        const t = selectedTrade;
        const related = transactions.filter((x: any) => x.apt_name === t.apt_name && x.dong === t.dong).slice(0, 20);
        function fmtAmt(a: number) { return a >= 10000 ? `${(a / 10000).toFixed(1)}억` : `${a.toLocaleString()}만`; }
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setSelectedTrade(null)}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
            <div style={{ position: 'relative', width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: 20 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{t.apt_name}</h2>
                <button onClick={() => setSelectedTrade(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>{t.region_nm} {t.sigungu} {t.dong}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>거래 이력 ({related.length}건)</div>
              {related.map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{r.deal_date}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{r.exclusive_area}㎡ · {r.floor}층</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtAmt(r.deal_amount)}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 12 }}>국토교통부 실거래가 공개시스템 기준</div>
            </div>
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
