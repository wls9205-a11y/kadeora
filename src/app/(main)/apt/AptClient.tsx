'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import AptCommentSheet from '@/components/AptCommentSheet';
import { haptic } from '@/lib/haptic';
import MiniLineChart from '@/components/charts/MiniLineChart';
import MiniBarChart from '@/components/charts/MiniBarChart';
import dynamic from 'next/dynamic';

const AptPriceTrendChart = dynamic(() => import('@/components/charts/AptPriceTrendChart'), { ssr: false });
const AptReviewSection = dynamic(() => import('@/components/AptReviewSection'), { ssr: false });
import TransactionTab from './tabs/TransactionTab';
import RedevTab from './tabs/RedevTab';
import OngoingTab from './tabs/OngoingTab';
import UnsoldTab from './tabs/UnsoldTab';

const NEW_HOURS: Record<string, number> = { subscription: 24, ongoing: 168, unsold: 168, redevelopment: 168, transaction: 72 };
function isNew(item: any, type: string): boolean {
  const h = NEW_HOURS[type] || 72;
  const ts = item.created_at || item.fetched_at;
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < h * 60 * 60 * 1000;
}
const NewBadge = () => <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'var(--accent-red)', color: '#fff', marginRight: 4, animation: 'pulse 2s infinite' }}>NEW</span>;


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
// 한국시간(KST) 기준 today
function kstToday(): string { return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function kstNow(): Date { return new Date(Date.now() + 9 * 60 * 60 * 1000); }

function getStatus(apt: Apt): 'open' | 'upcoming' | 'closed' {
  // 한국시간 기준 (UTC+9)
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().slice(0, 10);
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
  open: { label: '접수중', bg: 'rgba(52,211,153,0.2)', color: '#4ADE80', border: 'var(--accent-green)' },
  upcoming: { label: '접수예정', bg: 'var(--accent-yellow-bg)', color: '#FCD34D', border: 'var(--accent-yellow)' },
  closed: { label: '마감', bg: 'transparent', color: 'var(--text-tertiary)', border: 'var(--border)' },
} as const;

const STAGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '정비구역지정': { bg: 'rgba(107,114,128,0.15)', color: '#9DB0C7', border: '#7D8DA3' },
  '조합설립': { bg: 'rgba(96,165,250,0.2)', color: '#93C5FD', border: 'var(--accent-blue)' },
  '사업시행인가': { bg: 'rgba(251,191,36,0.2)', color: '#FDE047', border: 'var(--accent-yellow)' },
  '관리처분': { bg: 'rgba(251,146,60,0.2)', color: '#FDBA74', border: 'var(--accent-orange)' },
  '착공': { bg: 'rgba(52,211,153,0.2)', color: '#86EFAC', border: 'var(--accent-green)' },
  '준공': { bg: 'rgba(37,99,235,0.15)', color: '#2563EB', border: 'var(--brand)' },
};
const STAGE_ORDER = ['정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공'];

export default function AptClient({ apts, unsold = [], redevelopment = [], transactions = [], unsoldSummary, alertCounts = {}, lastRefreshed, regionStats = [], unsoldMonthly = [], tradeMonthly = [], ongoingApts = [] }: { apts: Apt[]; unsold?: any[]; redevelopment?: any[]; transactions?: any[]; unsoldSummary?: any; alertCounts?: Record<string, number>; lastRefreshed?: string | null; regionStats?: { name: string; total: number; open: number; upcoming: number; closed: number }[]; unsoldMonthly?: any[]; tradeMonthly?: any[]; ongoingApts?: any[] }) {
  const [activeTab, setActiveTab] = useState<'sub' | 'ongoing' | 'unsold' | 'redev' | 'trade'>('sub');
  const [region, setRegion] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [aptSort, setAptSort] = useState<'date'|'supply'|'deadline'|'competition'>('date');
  const [subSearch, setSubSearch] = useState('');
  const [myAlerts, setMyAlerts] = useState<Set<string>>(new Set());
  const [aptUser, setAptUser] = useState<any>(null);
  const [commentTarget, setCommentTarget] = useState<{ houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' | 'redev' } | null>(null);
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [calOffset, setCalOffset] = useState(0); // 0=이번달, -1=지난달, 1=다음달
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [premiumListings, setPremiumListings] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/consultant/listing').then(r => r.json()).then(d => {
      const listings = d.listings || [];
      setPremiumListings(listings);
      listings.forEach((pl: any) => {
        fetch('/api/consultant/listing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: pl.id, type: 'impression' }) }).catch(() => {});
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAptUser(data.session.user);
        sb.from('apt_alerts').select('house_manage_no').eq('user_id', data.session.user.id)
          .then(({ data: a }) => { if (a) setMyAlerts(new Set(a.map(x => x.house_manage_no))); });
        sb.from('apt_watchlist').select('item_type, item_id').eq('user_id', data.session.user.id)
          .then(({ data: wl }) => setWatchlist(new Set((wl || []).map((w: any) => `${w.item_type}:${w.item_id}`))));
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

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const toggleWatchlist = async (itemType: string, itemId: string) => {
    if (!aptUser) { alert('로그인 후 이용해주세요'); return; }
    try {
      const sb = createSupabaseBrowser();
      const { data: existing } = await sb.from('apt_watchlist').select('id').eq('user_id', aptUser.id).eq('item_type', itemType).eq('item_id', itemId).maybeSingle();
      if (existing) {
        await sb.from('apt_watchlist').delete().eq('id', existing.id);
        showToast('관심단지에서 해제했습니다');
      } else {
        await sb.from('apt_watchlist').insert({ user_id: aptUser.id, item_type: itemType, item_id: itemId, notify_enabled: true });
        showToast('⭐ 관심단지 등록! 새 소식이 있으면 알림을 보내드립니다');
      }
      haptic('medium');
      const { data: wl } = await sb.from('apt_watchlist').select('item_type, item_id').eq('user_id', aptUser.id);
      setWatchlist(new Set((wl || []).map((w: any) => `${w.item_type}:${w.item_id}`)));
    } catch (e) { if (process.env.NODE_ENV === 'development') console.warn('[Apt.toggleWatchlist]', e); }
  };

  const availableRegions = useMemo(() => ['전체', ...Array.from(new Set(apts.map(a => a.region_nm).filter(Boolean))).sort()], [apts]);
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
    if (aptSort === 'deadline') f.sort((a, b) => {
      const aEnd = String(a.rcept_endde || '9999');
      const bEnd = String(b.rcept_endde || '9999');
      return aEnd.localeCompare(bEnd);
    });
    if (aptSort === 'competition') f.sort((a, b) => (Number(b.competition_rate_1st) || 0) - (Number(a.competition_rate_1st) || 0));
    return f;
  }, [apts, region, statusFilter, aptSort, subSearch]);

  const pill = (v: string, sel: string, set: (v: string) => void, label?: string) => (
    <button key={v} onClick={() => set(v)} style={{
      padding: '4px 12px', borderRadius: 16, fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
      border: `1px solid ${sel === v ? '#3B82F6' : 'var(--border)'}`,
      background: sel === v ? '#2563EB' : 'transparent',
      color: sel === v ? '#fff' : 'var(--text-tertiary)',
    }}>{label || v}</button>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🏢 부동산</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/apt/map" style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>🗺️ 지도</a>
          <a href="/apt/diagnose" style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>🎯 가점진단</a>
          <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>🏠 청약홈</a>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
        {[
          { k: 'sub' as const, l: '📅 청약', type: 'subscription', data: apts },
          { k: 'ongoing' as const, l: '🏢 분양중', type: 'ongoing', data: ongoingApts },
          { k: 'unsold' as const, l: '🏚️ 미분양', type: 'unsold', data: unsold },
          { k: 'redev' as const, l: '🏗️ 재개발', type: 'redevelopment', data: redevelopment },
          { k: 'trade' as const, l: '💰 실거래', type: 'transaction', data: transactions },
        ].map(({ k, l, type, data }) => {
          const hasNew = (data as any[]).some((item: any) => isNew(item, type));
          return (
            <button key={k} onClick={() => { setActiveTab(k); haptic('light'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', position: 'relative',
              background: activeTab === k ? '#2563EB' : 'transparent',
              color: activeTab === k ? '#fff' : 'var(--text-tertiary)', fontWeight: 600, fontSize: 'var(--fs-sm)',
              boxShadow: activeTab === k ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
            }}>
              {l}
              {data.length > 0 && <span style={{ fontSize: 'var(--fs-xs)', marginLeft: 2, opacity: 0.7 }}>{
                type === 'unsold'
                  ? (() => { const total = (data as any[]).reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0); return total > 999 ? `${(total/1000).toFixed(0)}k` : total; })()
                  : data.length > 999 ? `${(data.length/1000).toFixed(0)}k` : data.length
              }</span>}
              {hasNew && activeTab !== k && <span style={{ position: 'absolute', top: 4, right: 8, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-red)' }} />}
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
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-link)' }}>총 {apts.length}건</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
              <button onClick={() => setRegion('전체')} style={{
                padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                border: region === '전체' ? '2px solid #60A5FA' : '1px solid var(--border)',
                background: region === '전체' ? '#1E3A5F' : 'var(--bg-surface)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: region === '전체' ? '#fff' : 'var(--text-primary)' }}>{apts.length}</span>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: region === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
              </button>
              {regionStats.map(r => (
                <button key={r.name} onClick={() => setRegion(r.name === region ? '전체' : r.name)} style={{
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                  border: region === r.name ? '2px solid #60A5FA' : '1px solid var(--border)',
                  background: region === r.name ? '#1E3A5F' : 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: region === r.name ? '#fff' : 'var(--text-primary)' }}>{r.total}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: region === r.name ? '#fff' : 'var(--text-secondary)' }}>{r.name}</span>
                  <div style={{ fontSize: 10, display: 'flex', gap: 2, color: region === r.name ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>
                    {r.open > 0 && <span style={{ color: region === r.name ? '#fff' : 'var(--accent-green)' }}>접수{r.open}</span>}
                    {r.upcoming > 0 && <span style={{ color: region === r.name ? '#fff' : '#FCD34D' }}>예정{r.upcoming}</span>}
                  </div>
                  {r.total > 0 && (
                    <div style={{ width: '100%', height: 3, background: region === r.name ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 2, overflow: 'hidden', display: 'flex', marginTop: 2 }}>
                      <div style={{ height: '100%', background: 'var(--accent-green)', width: `${(r.open / r.total) * 100}%` }} />
                      <div style={{ height: '100%', background: '#FCD34D', width: `${(r.upcoming / r.total) * 100}%` }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 검색 + 정렬 + 통계 요약 */}
          <div style={{ marginBottom: 12 }}>
            <input value={subSearch} onChange={e => setSubSearch(e.target.value)} placeholder="단지명, 지역 검색..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginRight: 4 }}>정렬</span>
              {([['date', '최신순'], ['deadline', '마감임박'], ['supply', '세대수'], ['competition', '경쟁률']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setAptSort(k)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 'var(--fs-xs)', fontWeight: aptSort === k ? 700 : 500, background: aptSort === k ? 'var(--brand)' : 'var(--bg-hover)', color: aptSort === k ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>{l}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 'var(--fs-xs)' }}>
                <span style={{ color: '#34D399', fontWeight: 700 }}>접수중 {filtered.filter(a => getStatus(a) === 'open').length}</span>
                <span style={{ color: '#FCD34D', fontWeight: 700 }}>예정 {filtered.filter(a => getStatus(a) === 'upcoming').length}</span>
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
                  {upcoming.length > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 8, background: 'var(--accent-yellow-bg)', color: '#FCD34D', fontWeight: 700 }}>예정 {upcoming.length}</span>}
                </div>
                {thisWeek.slice(0, 5).map(a => {
                  const st = getStatus(a);
                  const sb = SB[st];
                  return (
                    <a key={a.id} href={`/apt/${a.house_manage_no || a.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(96,165,250,0.1)', textDecoration: 'none', color: 'inherit' }}>
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

          {/* 청약 캘린더 */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
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
                      {c.apts.length > 0 && <div style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 700 }}>{c.apts.length}건</div>}
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
                    <a key={a.id} href={`/apt/${a.house_manage_no || a.id}`} style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', padding: '6px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-link, #58a6ff)' }}>{a.house_nm}</span>
                      <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{a.region_nm} · {a.tot_supply_hshld_co?.toLocaleString() || '-'}세대</span>
                    </a>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

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
                  background: aptSort === s.key ? '#2563EB' : 'var(--bg-hover)',
                  color: aptSort === s.key ? '#fff' : 'var(--text-tertiary)', fontWeight: 600,
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>조건에 맞는 청약이 없습니다</div>}

          {filtered.map((apt, i) => {
            const st = getStatus(apt);
            const bd = SB[st];
            const h = apt.house_manage_no || String(apt.id);
            const ac = alertCounts[h] || 0;
            const my = myAlerts.has(h);
            const dday = (() => {
              if (st === 'open' && apt.rcept_endde) return Math.ceil((new Date(apt.rcept_endde).getTime() - Date.now()) / 86400000);
              if (st === 'upcoming' && apt.rcept_bgnde) return Math.ceil((new Date(apt.rcept_bgnde).getTime() - Date.now()) / 86400000);
              return null;
            })();

            const accentColor = st === 'open' ? 'var(--accent-green)' : st === 'upcoming' ? 'var(--accent-blue)' : 'var(--border)';
            // 간략 주소: 전체 주소에서 구+동 추출
            const shortAddr = apt.hssply_adres ? apt.hssply_adres.replace(/^[^\s]+\s/, '').split(' ').slice(0, 3).join(' ') : '';
            return (
              <Link key={apt.id} href={`/apt/${apt.house_manage_no || apt.id}`} style={{
                display: 'block', padding: '14px 16px 12px', borderRadius: 14, marginBottom: 8,
                background: st === 'open' ? 'linear-gradient(135deg, var(--bg-surface), rgba(96,165,250,0.04))' : 'var(--bg-surface)',
                border: st === 'open' ? '1.5px solid rgba(96,165,250,0.3)' : '1px solid var(--border)',
                opacity: st === 'closed' ? 0.55 : 1,
                textDecoration: 'none', color: 'inherit',
                transition: 'transform 0.1s, box-shadow 0.15s',
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
                  {(apt as any).MDAT_TRGET_AREA_SECD === 'Y' && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(251,146,60,0.12)', color: '#fdba74' }}>조정대상</span>}
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
                  <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: st === 'open' ? 'rgba(96,165,250,0.15)' : 'rgba(148,163,184,0.06)', color: st === 'open' ? '#93c5fd' : undefined, fontWeight: st === 'open' ? 700 : 400 }}>접수 {fmtD(apt.rcept_bgnde)}~{fmtD(apt.rcept_endde)}</div>
                  {apt.przwner_presnatn_de && <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: 'rgba(52,211,153,0.06)' }}>당첨 {fmtD(apt.przwner_presnatn_de)}</div>}
                  {apt.cntrct_cncls_bgnde && <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: 'rgba(251,191,36,0.06)' }}>계약 {fmtD(apt.cntrct_cncls_bgnde)}</div>}
                </div>
              </Link>
            );
          })}

          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
            청약홈(applyhome.co.kr) 공공데이터 · 공공데이터포털(data.go.kr) API 기준 · 매일 06시 자동 갱신 · 정확한 일정과 분양가는 반드시 청약홈에서 재확인하세요
          </p>
        </div>
      )}

      {/* ━━━ 분양중 탭 ━━━ */}
      {activeTab === 'ongoing' && (
        <OngoingTab
          ongoingApts={ongoingApts}
          premiumListings={premiumListings}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
        />
      )}

      {/* ━━━ 미분양 탭 ━━━ */}
      {activeTab === 'unsold' && (
        <UnsoldTab
          unsold={unsold}
          unsoldMonthly={unsoldMonthly}
          unsoldSummary={unsoldSummary}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
        />
      )}

      {activeTab === 'redev' && (
        <RedevTab
          redevelopment={redevelopment}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
        />
      )}

      {/* ━━━ 실거래가 탭 ━━━ */}
      {activeTab === 'trade' && (
        <TransactionTab
          transactions={transactions}
          tradeMonthly={tradeMonthly}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
        />
      )}

      {/* 실거래가 상세 모달 */}
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

      {/* 지역별 부동산 내부 링크 (SEO) */}
      <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>🏙️ 지역별 부동산 정보</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'].map(r => (
            <Link key={r} href={`/apt/region/${encodeURIComponent(r)}`} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 500,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none',
              border: '1px solid var(--border)',
            }}>{r}</Link>
          ))}
        </div>
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-elevated, #1e293b)', color: '#fff', padding: '12px 20px',
          borderRadius: 12, fontSize: 'var(--fs-sm)', fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
          animation: 'fadeIn 0.2s ease-out',
        }}>{toast}</div>
      )}
    </div>
  );
}
