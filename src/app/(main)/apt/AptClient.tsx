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
  const [unsoldRegion, setUnsoldRegion] = useState('전체');
  const [unsoldSearch, setUnsoldSearch] = useState('');
  const [ongoingRegion, setOngoingRegion] = useState('전체');
  const [ongoingPage, setOngoingPage] = useState(1);
  const [ongoingSort, setOngoingSort] = useState<'supply'|'unsold'|'price'|'competition'>('supply');
  const [ongoingSearch, setOngoingSearch] = useState('');
  const [ongoingStatus, setOngoingStatus] = useState('전체');
  const [selectedOngoing, setSelectedOngoing] = useState<any | null>(null);
  const [redevType, setRedevType] = useState('전체');
  const [redevRegion, setRedevRegion] = useState('전체');
  const [redevPage, setRedevPage] = useState(1);
  const [myAlerts, setMyAlerts] = useState<Set<string>>(new Set());
  const [aptUser, setAptUser] = useState<any>(null);
  const [commentTarget, setCommentTarget] = useState<{ houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' | 'redev' } | null>(null);
  const [selectedRedev, setSelectedRedev] = useState<any | null>(null);
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [calOffset, setCalOffset] = useState(0); // 0=이번달, -1=지난달, 1=다음달
  const [redevStage, setRedevStage] = useState('전체');
  const [redevSearch, setRedevSearch] = useState('');
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
    } catch {}
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
      {activeTab === 'ongoing' && (() => {
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
        const pipeColors = ['#7D8DA3', 'var(--accent-blue)', 'var(--accent-yellow)', 'var(--accent-orange)', 'var(--accent-green)'];

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
                  background: ongoingRegion === '전체' ? '#1E3A5F' : 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: ongoingRegion === '전체' ? '#fff' : 'var(--text-primary)' }}>{ongoingApts.length}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: ongoingRegion === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
                </button>
                {regionCounts.map(r => (
                  <button key={r.name} onClick={() => { setOngoingRegion(r.name === ongoingRegion ? '전체' : r.name); setOngoingPage(1); }} style={{
                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    border: ongoingRegion === r.name ? '2px solid #60A5FA' : '1px solid var(--border)',
                    background: ongoingRegion === r.name ? '#1E3A5F' : 'var(--bg-surface)',
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
                        <div style={{ height: '100%', background: '#60a5fa', width: `${(r.subCount / r.count) * 100}%` }} />
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
                  border: `1px solid ${ongoingSort === k ? '#2563EB' : 'var(--border)'}`,
                  background: ongoingSort === k ? '#2563EB' : 'transparent',
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
                        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: isUnsold ? 'var(--accent-red-bg)' : 'var(--accent-blue-bg)', color: isUnsold ? '#f87171' : '#60a5fa', border: `1px solid ${isUnsold ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.25)'}` }}>
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
                    border: `1px solid ${ongoingPage === p ? '#2563EB' : 'var(--border)'}`,
                    background: ongoingPage === p ? '#2563EB' : 'transparent',
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
                <>
                  <div onClick={() => setSelectedOngoing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }} />
                  <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: '12px 20px 32px', maxHeight: '75vh', overflowY: 'auto' }}>
                    <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isU ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)', color: isU ? '#f87171' : 'var(--accent-green)' }}>{isU ? '미분양' : '분양중'}</span>
                      <button onClick={() => setSelectedOngoing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-lg)', cursor: 'pointer' }}>×</button>
                    </div>
                    <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{o.house_nm}</h2>
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
                      <a href={linkH} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>자세히 보기 →</a>
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
                  </div>
                </>
              );
            })()}
          </div>
        );
      })()}

      {/* ━━━ 미분양 탭 ━━━ */}
      {activeTab === 'unsold' && (() => {
        if (!unsold.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>🏚️ 미분양 데이터를 수집 중입니다<br/><span style={{ fontSize: 'var(--fs-sm)' }}>매월 국토교통부 통계 업데이트 시 반영됩니다</span></div>;
        const total = unsold.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
        const regs = ['전체', ...Array.from(new Set(unsold.map((u: any) => u.region_nm || '기타'))).sort()];
        const fu = (unsoldRegion === '전체' ? unsold : unsold.filter((u: any) => (u.region_nm || '기타') === unsoldRegion)).filter((u: any) => {
          if (!unsoldSearch) return true;
          const q = unsoldSearch.toLowerCase();
          return (u.house_nm || '').toLowerCase().includes(q) || (u.region_nm || '').toLowerCase().includes(q) || (u.sigungu_nm || '').toLowerCase().includes(q);
        });
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
            {/* 지역별 현황 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: '#f87171' }}>총 {total.toLocaleString()}세대</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
                <button onClick={() => setUnsoldRegion('전체')} style={{
                  padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  border: unsoldRegion === '전체' ? '2px solid #F87171' : '1px solid var(--border)',
                  background: unsoldRegion === '전체' ? '#2D1520' : 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: unsoldRegion === '전체' ? '#fff' : 'var(--accent-red)' }}>{total.toLocaleString()}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: unsoldRegion === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
                  <span style={{ fontSize: 10, color: unsoldRegion === '전체' ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{unsold.length}곳</span>
                </button>
                {unsoldRegionStats.map(r => (
                  <button key={r.name} onClick={() => setUnsoldRegion(r.name === unsoldRegion ? '전체' : r.name)} style={{
                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    border: unsoldRegion === r.name ? '2px solid #F87171' : '1px solid var(--border)',
                    background: unsoldRegion === r.name ? '#2D1520' : 'var(--bg-surface)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  }}>
                    <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: unsoldRegion === r.name ? '#fff' : 'var(--accent-red)' }}>{r.unitCount.toLocaleString()}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: unsoldRegion === r.name ? '#fff' : 'var(--text-secondary)' }}>{r.name}</span>
                    <span style={{ fontSize: 10, color: unsoldRegion === r.name ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{r.siteCount}곳</span>
                    {total > 0 && (
                      <div style={{ width: '100%', height: 3, background: unsoldRegion === r.name ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                        <div style={{ height: '100%', background: unsoldRegion === r.name ? '#fff' : 'var(--accent-red)', width: `${(r.unitCount / total) * 100}%` }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 종합 현황판 */}
            {(() => {
              const filteredTotal = fu.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
              const filteredAfterCompletion = fu.reduce((s: number, u: any) => s + (u.after_completion_unsold || 0), 0);
              const capitalR = ['서울', '경기', '인천'];
              const filteredCapital = fu.filter((u: any) => capitalR.some(c => (u.region_nm || '').includes(c))).reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
              const filteredLocal = filteredTotal - filteredCapital;
              return (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>📊 {unsoldRegion !== '전체' ? `${unsoldRegion} ` : ''}미분양 현황</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{unsoldRegion !== '전체' ? unsoldRegion : '전국'}</div>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--brand)' }}>{filteredTotal.toLocaleString()}호</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>준공후(악성)</div>
                    <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-red)' }}>{filteredAfterCompletion.toLocaleString()}호</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>단지 수</div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{fu.length}곳</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평균 미분양</div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{fu.length > 0 ? Math.round(filteredTotal / fu.length).toLocaleString() : 0}호</div>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>국토교통부 통계누리 기준</div>
              </div>
              );
            })()}

            {/* 미분양 지역별 TOP5 */}
            {unsoldRegionStats.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>🏚️ 미분양 많은 지역 TOP5</div>
                {unsoldRegionStats.slice(0, 5).map((r, i) => (
                  <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', width: 20 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-red)' }}>{r.unitCount.toLocaleString()}호</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{r.siteCount}곳</span>
                  </div>
                ))}
              </div>
            )}

            {/* 지역별 현황판 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 미분양 현황</span>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--accent-red)' }}>총 {total.toLocaleString()}세대</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
                <button onClick={() => setUnsoldRegion('전체')} style={{
                  padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  border: unsoldRegion === '전체' ? '2px solid #F87171' : '1px solid var(--border)',
                  background: unsoldRegion === '전체' ? '#2D1520' : 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: unsoldRegion === '전체' ? '#fff' : 'var(--accent-red)' }}>{total.toLocaleString()}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: unsoldRegion === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
                  <span style={{ fontSize: 10, color: unsoldRegion === '전체' ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{unsold.length}곳</span>
                </button>
                {unsoldRegionStats.map(r => (
                  <button key={r.name} onClick={() => setUnsoldRegion(r.name === unsoldRegion ? '전체' : r.name)} style={{
                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    border: unsoldRegion === r.name ? '2px solid #F87171' : '1px solid var(--border)',
                    background: unsoldRegion === r.name ? '#2D1520' : 'var(--bg-surface)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  }}>
                    <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: unsoldRegion === r.name ? '#fff' : 'var(--accent-red)' }}>{r.unitCount.toLocaleString()}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: unsoldRegion === r.name ? '#fff' : 'var(--text-secondary)' }}>{r.name}</span>
                    <span style={{ fontSize: 10, color: unsoldRegion === r.name ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{r.siteCount}곳</span>
                    {total > 0 && (
                      <div style={{ width: '100%', height: 3, background: unsoldRegion === r.name ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                        <div style={{ height: '100%', background: unsoldRegion === r.name ? '#fff' : 'var(--accent-red)', width: `${(r.unitCount / total) * 100}%` }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 미분양 추이 차트 */}
            {unsoldMonthly.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📈 전국 미분양 추이 (12개월)</div>
                <MiniLineChart
                  data={(() => {
                    const months = [...new Set(unsoldMonthly.map((s: any) => s.stat_month))].slice(-12);
                    return months.map(m => {
                      const rows = unsoldMonthly.filter((s: any) => s.stat_month === m);
                      const total = rows.reduce((sum: number, r: any) => sum + (r.total_unsold || 0), 0);
                      return { label: String(m).slice(5), value: total };
                    });
                  })()}
                  color="#60A5FA"
                  secondaryData={(() => {
                    const months = [...new Set(unsoldMonthly.map((s: any) => s.stat_month))].slice(-12);
                    return months.map(m => {
                      const rows = unsoldMonthly.filter((s: any) => s.stat_month === m);
                      const total = rows.reduce((sum: number, r: any) => sum + (r.after_completion || 0), 0);
                      return { label: String(m).slice(5), value: total };
                    });
                  })()}
                  secondaryColor="#F87171"
                  height={140}
                  title=""
                />
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  <span><span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--accent-blue)', marginRight: 4, verticalAlign: 'middle' }} />전체 미분양</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--accent-red)', marginRight: 4, verticalAlign: 'middle', borderTop: '1px dashed #F87171' }} />준공후 미분양</span>
                </div>
              </div>
            )}

            {/* 안내 + 검색 + 필터 */}
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 8 }}>국토교통부 미분양주택현황 월간 통계 (2~3개월 지연) · 최근 12개월 데이터</div>
            <input value={unsoldSearch} onChange={e => setUnsoldSearch(e.target.value)} placeholder="단지명, 지역 검색..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 8, paddingBottom: 2 }}>
              {regs.map(r => pill(r, unsoldRegion, setUnsoldRegion))}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              총 <strong style={{ color: '#F87171' }}>{fu.length}</strong>건 · {fu.reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0).toLocaleString()}세대
            </div>

            {/* 리스트 */}
            {fu.map((u: any, i: number) => {
              const rate = u.tot_supply_hshld_co ? Math.round((u.tot_unsold_hshld_co / u.tot_supply_hshld_co) * 100) : null;
              const pMin = u.sale_price_min ? Math.round(u.sale_price_min / 10000 * 10) / 10 : null;
              const pMax = u.sale_price_max ? Math.round(u.sale_price_max / 10000 * 10) / 10 : null;
              const priceStr = pMin ? `${pMin}억${pMax && pMax !== pMin ? `~${pMax}억` : ''}` : null;

              const unsoldCount = u.tot_unsold_hshld_co || 0;
              const dangerColor = unsoldCount >= 1000 ? 'var(--accent-red)' : unsoldCount >= 500 ? 'var(--accent-orange)' : unsoldCount >= 100 ? 'var(--accent-yellow)' : 'var(--accent-green)';

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
                    <Link href={`/apt/unsold/${u.id}`} style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{u.house_nm && u.source !== 'molit_stat' ? u.house_nm : `${u.region_nm} ${u.sigungu_nm || ''} 미분양`}</Link>
                    <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 12, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)', fontWeight: 700, flexShrink: 0 }}>
                      {unsoldCount >= 1000 ? '🔴' : unsoldCount >= 500 ? '🟠' : unsoldCount >= 100 ? '🟡' : '🟢'} 미분양 {unsoldCount.toLocaleString()}세대
                    </span>
                    {u.after_completion_unsold > 0 && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 6px', borderRadius: 8, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', fontWeight: 600 }}>악성 {u.after_completion_unsold}호</span>}
                    {priceStr && <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--brand)', marginLeft: 'auto', flexShrink: 0 }}>{priceStr}</span>}
                    <button onClick={(e) => { e.stopPropagation(); toggleWatchlist('unsold', String(u.id)); }} style={{ fontSize: 'var(--fs-xl)', background: watchlist.has(`unsold:${u.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`unsold:${u.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', transition: 'transform 0.1s', lineHeight: 1 }}>
                      {watchlist.has(`unsold:${u.id}`) ? '⭐' : '☆'}
                    </button>
                  </div>

                  {/* 줄2: 지역 + 세대 */}
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    {u.region_nm}{u.sigungu_nm ? ` ${u.sigungu_nm}` : ''}
                    {u.tot_supply_hshld_co && <span> · 총 {u.tot_supply_hshld_co.toLocaleString()}세대</span>}
                    {u.completion_ym && <span> · 준공 {u.completion_ym.slice(0, 4)}.{u.completion_ym.slice(4, 6)}</span>}
                  </div>

                  {/* 미분양률 바 */}
                  {rate !== null && (
                    <div style={{ position: 'relative', height: 5, background: 'var(--bg-hover)', borderRadius: 2, marginBottom: 10 }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(rate, 100)}%`, background: rate > 70 ? 'var(--accent-red)' : rate > 40 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }} />
                      <span style={{ position: 'absolute', right: 0, top: -14, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-red)' }}>{rate}%</span>
                    </div>
                  )}

                  {/* 줄3: pill 버튼 */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setCommentTarget({ houseKey: `unsold_${u.id}`, houseNm: u.house_nm || '미분양', houseType: 'unsold' })}
                      style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>✏️ 한줄평</button>
                    <Link href={`/apt/unsold/${u.id}`} style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>자세히 →</Link>
                    {u.pblanc_url && <a href={u.pblanc_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>홈페이지 →</a>}
                  </div>
                </div>
              );
            })}

            {fu.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>해당 지역 데이터가 없습니다</div>}
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>📊 데이터 출처: 국토교통부 미분양주택현황 통계 (stat.molit.go.kr) · 매월 말 발표 기준, 2~3개월 지연 반영 · 개별 단지 정보는 청약홈(applyhome.co.kr) 병행 수집<br/>⚠️ 본 정보는 참고용이며 투자 권유가 아닙니다. 투자에 따른 손익은 투자자 본인에게 귀속됩니다.</p>
          </div>
        );
      })()}

      {/* ━━━ 재개발·재건축 탭 ━━━ */}
      {activeTab === 'redev' && (() => {
        if (!redevelopment.length) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>🏗️ 재개발·재건축 데이터를 수집 중입니다<br/><span style={{ fontSize: 'var(--fs-sm)' }}>각 지자체 정비사업 데이터 연동 시 표시됩니다</span></div>;

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
          if (redevStage !== '전체' && r.stage !== redevStage) return false;
          if (redevSearch) {
            const q = redevSearch.toLowerCase();
            if (!(r.district_name || '').toLowerCase().includes(q) && !(r.region || '').toLowerCase().includes(q) && !(r.sigungu || '').toLowerCase().includes(q) && !(r.constructor || '').toLowerCase().includes(q) && !(r.address || '').toLowerCase().includes(q)) return false;
          }
          return true;
        }).sort((a: any, b: any) => {
          const aOk = a.district_name && a.district_name !== '정보 준비중' && a.district_name !== '미상';
          const bOk = b.district_name && b.district_name !== '정보 준비중' && b.district_name !== '미상';
          if (aOk && !bOk) return -1;
          if (!aOk && bOk) return 1;
          return 0;
        });

        const redevCount = filteredRedev.filter((r: any) => r.project_type === '재개발').length;
        const rebuildCount = filteredRedev.filter((r: any) => r.project_type === '재건축').length;
        const stageCount: Record<string, number> = {};
        STAGE_ORDER.forEach(s => { stageCount[s] = 0; });
        filteredRedev.forEach((r: any) => {
          const s = r.stage || '정비구역지정';
          if (stageCount[s] !== undefined) stageCount[s]++;
          else stageCount['정비구역지정']++; // 알 수 없는 stage는 정비구역지정으로
        });

        const totalHouseholds = filteredRedev.reduce((s: number, r: any) => s + (r.total_households || 0), 0);

        return (
          <div>
            {/* 지역별 현황 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>지역별 현황</span>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--brand)' }}>총 {redevelopment.length}건</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
                <button onClick={() => { setRedevRegion('전체'); setRedevPage(1); }} style={{
                  padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  border: redevRegion === '전체' ? '2px solid #60A5FA' : '1px solid var(--border)',
                  background: redevRegion === '전체' ? '#1E3A5F' : 'var(--bg-surface)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: redevRegion === '전체' ? '#fff' : 'var(--text-primary)' }}>{redevelopment.length}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: redevRegion === '전체' ? '#fff' : 'var(--text-secondary)' }}>전체</span>
                </button>
                {redevRegionStats.map(r => (
                  <button key={r.name} onClick={() => { setRedevRegion(r.name === redevRegion ? '전체' : r.name); setRedevPage(1); }} style={{
                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    border: redevRegion === r.name ? '2px solid #60A5FA' : '1px solid var(--border)',
                    background: redevRegion === r.name ? '#1E3A5F' : 'var(--bg-surface)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  }}>
                    <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: redevRegion === r.name ? '#fff' : 'var(--text-primary)' }}>{r.total}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: redevRegion === r.name ? '#fff' : 'var(--text-secondary)' }}>{r.name}</span>
                    <div style={{ fontSize: 10, display: 'flex', gap: 2, color: redevRegion === r.name ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>
                      {r.redev > 0 && <span style={{ color: redevRegion === r.name ? '#fff' : 'var(--accent-blue)' }}>개발{r.redev}</span>}
                      {r.rebuild > 0 && <span style={{ color: redevRegion === r.name ? '#fff' : 'var(--accent-green)' }}>건축{r.rebuild}</span>}
                    </div>
                    {r.total > 0 && (
                      <div style={{ width: '100%', height: 3, background: redevRegion === r.name ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 2, overflow: 'hidden', display: 'flex', marginTop: 2 }}>
                        <div style={{ height: '100%', background: 'var(--accent-blue)', width: `${(r.redev / r.total) * 100}%` }} />
                        <div style={{ height: '100%', background: 'var(--accent-green)', width: `${(r.rebuild / r.total) * 100}%` }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 현황 요약 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{redevelopment.length}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>전체</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-blue)' }}>{redevCount}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>재개발</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--accent-orange)' }}>{rebuildCount}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>재건축</div>
              </div>
            </div>

            {/* 재개발 단계별 파이프라인 */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🏗️ 단계별 파이프라인</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                {STAGE_ORDER.map((stage, i) => {
                  const regionFiltered = redevRegion === '전체' ? redevelopment : redevelopment.filter((r: any) => r.region === redevRegion);
                  const count = regionFiltered.filter((r: any) => r.stage === stage).length;
                  const total = regionFiltered.length || 1;
                  const pct = Math.round((count / total) * 100);
                  const sc = STAGE_COLORS[stage] || { bg: 'var(--bg-hover)', color: 'var(--text-tertiary)', border: 'var(--border)' };
                  return (
                    <div key={stage} onClick={() => { setRedevStage(stage === redevStage ? '전체' : stage); setRedevPage(1); }} style={{ flex: Math.max(pct, 8), textAlign: 'center', padding: '10px 4px', borderRadius: 8, background: redevStage === stage ? sc.border : sc.bg, border: `1px solid ${sc.border}`, position: 'relative', minWidth: 50, cursor: 'pointer', opacity: redevStage !== '전체' && redevStage !== stage ? 0.5 : 1 }}>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: sc.color }}>{stage.replace('인가', '')}</div>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: sc.color, margin: '4px 0' }}>{count}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: sc.color, opacity: 0.7 }}>{pct}%</div>
                      {i < STAGE_ORDER.length - 1 && <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>→</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 유형 필터 + 검색 */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {pill('전체', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재개발', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {pill('재건축', redevType, (v) => { setRedevType(v); setRedevPage(1); })}
              {/* 시공사 있는 것만 필터 */}
              {(() => {
                const withConstructor = filteredRedev.filter((r: any) => r.constructor);
                return withConstructor.length > 0 ? (
                  <span style={{ fontSize: 'var(--fs-xs)', color: '#34D399', fontWeight: 600, marginLeft: 'auto' }}>시공사 확정 {withConstructor.length}건</span>
                ) : null;
              })()}
            </div>
            <input value={redevSearch} onChange={e => { setRedevSearch(e.target.value); setRedevPage(1); }} placeholder="구역명, 지역, 시공사 검색..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none', marginBottom: 8 }} />

            {/* 안내 */}
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 8 }}>서울시 정비사업 정보몽땅 · 경기도 공공데이터 · 부산시 정비사업현황 API 기준 · 매주 월요일 자동 갱신</div>

            {/* 결과 카운트 */}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              총 <strong style={{ color: 'var(--text-primary)' }}>{filteredRedev.length}</strong>건
            </div>

            {/* 카드 리스트 (20건씩 페이지네이션) */}
            {filteredRedev.slice(0, redevPage * 20).map((r: any) => {
              const sc = STAGE_COLORS[r.stage] || STAGE_COLORS['정비구역지정'];
              const stageIdx = STAGE_ORDER.indexOf(r.stage);
              const progress = stageIdx >= 0 ? Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100) : 0;
              return (
                <div key={r.id} onClick={() => setSelectedRedev(r)} style={{
                  padding: '14px 16px 12px', borderRadius: 14, marginBottom: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background 0.15s',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
                >
                  {/* 상단 진행률 바 (전체 너비) */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${sc.border}, var(--brand))` }} />
                  </div>
                  {/* 1행: 단계 + 유형 + 진행률 + 지역 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: sc.bg, color: sc.color }}>{r.stage}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: r.project_type === '재개발' ? 'rgba(96,165,250,0.1)' : 'rgba(251,146,60,0.1)', color: r.project_type === '재개발' ? '#93c5fd' : '#fdba74' }}>{r.project_type}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: sc.color }}>{progress}%</span>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{r.region}</span>
                    <button onClick={(e) => { e.stopPropagation(); toggleWatchlist('redev', String(r.id)); }} style={{ fontSize: 'var(--fs-lg)', background: watchlist.has(`redev:${r.id}`) ? 'var(--accent-yellow-bg)' : 'transparent', border: watchlist.has(`redev:${r.id}`) ? '1px solid rgba(251,191,36,0.4)' : '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', lineHeight: 1 }}>
                      {watchlist.has(`redev:${r.id}`) ? '⭐' : '☆'}
                    </button>
                  </div>
                  {/* 구역명 */}
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: (!r.district_name || r.district_name === '미상' || r.district_name === '정보 준비중') ? 'var(--text-tertiary)' : 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>
                    {r.district_name && r.district_name !== '미상' && r.district_name !== '정보 준비중' ? r.district_name : r.address || r.notes || '📋 정보 준비중'}
                  </div>
                  {/* 시군구 + 세대수 + 시공사 */}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    {r.sigungu}{r.total_households ? ` · ${r.total_households.toLocaleString()}세대` : (() => {
                      const stageMsg: Record<string, string> = {
                        '정비구역지정': ' · 세대수 미확정 (구역지정 단계)',
                        '조합설립': ' · 세대수 확정 전 (조합설립 단계)',
                        '사업시행인가': ' · 세대수 인가 후 확정 예정',
                        '관리처분': ' · 관리처분계획 참조',
                        '착공': ' · 사업시행계획 참조',
                      };
                      return stageMsg[r.stage] || ' · 세대수 미확정';
                    })()}{r.constructor ? ` · ${r.constructor}` : ''}
                  </div>
                  {/* 비고/예상준공 */}
                  {(r.notes || r.expected_completion) && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
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
                fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', marginBottom: 8,
              }}>
                더 보기 ({Math.min(redevPage * 20, filteredRedev.length)} / {filteredRedev.length}건)
              </button>
            )}

            {filteredRedev.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>조건에 맞는 프로젝트가 없습니다</div>}
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
              📊 데이터 출처: 서울시 열린데이터광장(openapi.seoul.go.kr) · 경기도 공공데이터(openapi.gg.go.kr) · 부산시 공공데이터(apis.data.go.kr) · 매주 월요일 갱신 · 실제 진행 상황은 해당 조합 또는 지자체에 직접 확인하세요<br/>⚠️ 본 정보는 참고용이며 투자 권유가 아닙니다. 투자에 따른 손익은 투자자 본인에게 귀속됩니다.
            </p>
          </div>
        );
      })()}

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
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{r.stage}</span>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: r.project_type === '재개발' ? 'rgba(96,165,250,0.1)' : 'rgba(251,146,60,0.1)', color: r.project_type === '재개발' ? '#93c5fd' : '#fdba74' }}>{r.project_type}</span>
                <button onClick={() => setSelectedRedev(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-lg)', padding: 4 }}>✕</button>
              </div>

              {/* 제목 */}
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{r.district_name && r.district_name !== '미상' ? r.district_name : r.address || r.notes || '정비사업'}</h2>
              {r.address && (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
                  📍 {r.address}
                </div>
              )}
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: r.ai_summary ? 8 : 16 }}>
                {r.region}{r.sigungu ? ` ${r.sigungu}` : ''}{r.total_households ? ` · ${r.total_households.toLocaleString()}세대` : ` · 세대수 ${r.stage === '정비구역지정' || r.stage === '조합설립' ? '미확정' : '확인 필요'}`}
              </div>
              {r.ai_summary && (
                <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-blue-bg), rgba(52,211,153,0.06))', border: '1px solid rgba(96,165,250,0.15)' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 3 }}>🤖 AI 분석</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.ai_summary}</div>
                </div>
              )}

              {/* 사업 진행률 파이프라인 */}
              {(() => {
                const currentIdx = STAGE_ORDER.indexOf(r.stage);
                const progress = currentIdx >= 0 ? Math.round(((currentIdx + 1) / STAGE_ORDER.length) * 100) : 0;
                return (
                  <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>📊 사업 진행률</span>
                      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--brand)' }}>{progress}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #60A5FA, #34D399, var(--brand))', borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {STAGE_ORDER.map((stage, i) => {
                        const isCurrent = stage === r.stage;
                        const isPast = currentIdx >= 0 && i < currentIdx;
                        const stageColor = STAGE_COLORS[stage] || STAGE_COLORS['정비구역지정'];
                        return (
                          <div key={stage} style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%', margin: '0 auto 4px',
                              background: isCurrent ? stageColor.border : isPast ? 'var(--text-tertiary)' : 'var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: isCurrent ? '2px solid var(--brand)' : 'none',
                              boxShadow: isCurrent ? '0 0 8px rgba(37,99,235,0.4)' : 'none',
                            }}>
                              {(isPast || isCurrent) && <span style={{ color: '#fff', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>✓</span>}
                            </div>
                            <div style={{ fontSize: 10, color: isCurrent ? 'var(--brand)' : isPast ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: isCurrent ? 800 : 400, lineHeight: 1.2 }}>
                              {stage.replace('사업시행인가', '시행인가').replace('정비구역지정', '구역지정').replace('관리처분', '관리처분')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                {[
                  r.address && ['📍 주소', r.address],
                  r.constructor && ['🏗️ 시공사', r.constructor],
                  r.developer && ['🏢 시행사', r.developer],
                  r.total_dong && ['🏠 동수', `${r.total_dong}개 동`],
                  r.max_floor && ['📏 최고층', `지상 ${r.max_floor}층`],
                  r.total_households && ['👥 세대수', `${r.total_households.toLocaleString()}세대`],
                  r.floor_area_ratio && ['📐 용적률', `${r.floor_area_ratio}%`],
                  r.building_coverage && ['📐 건폐율', `${r.building_coverage}%`],
                  r.land_area && ['🗺️ 부지면적', `${r.land_area.toLocaleString()}㎡`],
                  r.nearest_station && ['🚆 최근접 역', r.nearest_station],
                  r.nearest_school && ['🏫 초등학교', r.nearest_school],
                  r.estimated_move_in && ['🗓️ 입주예정', r.estimated_move_in],
                  r.expected_completion && ['🗓️ 예상 준공', r.expected_completion],
                  r.transfer_limit && ['🔒 전매제한', r.transfer_limit],
                  r.stage && ['📅 현재 단계', r.stage],
                  r.notes && ['📝 비고', r.notes],
                ].filter(Boolean).map(([label, value]: any) => (
                  <div key={label} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>
                    <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, width: 70 }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* 요약 / 핵심 특징 */}
              {(r.summary || r.key_features) ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>📋 사업 요약</div>
                  {r.key_features && <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--brand)', marginBottom: 6 }}>💡 {r.key_features}</div>}
                  {r.summary && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{r.summary}</div>}
                </div>
              ) : (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0', marginBottom: 16 }}>
                  요약 정보를 준비 중입니다
                </div>
              )}

              {/* 한줄평 */}
              <button onClick={() => { setSelectedRedev(null); setCommentTarget({ houseKey: `redev_${r.id}`, houseNm: r.district_name || '정비사업', houseType: 'redev' as any }); }} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', marginBottom: 12, fontWeight: 600 }}>
                💬 한줄평 작성하기
              </button>

              {/* 지도 버튼 */}
              {(r.address || (r.district_name && r.district_name !== '미상' && r.district_name !== '정보 준비중')) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <a href={`https://map.kakao.com/?q=${encodeURIComponent(r.address || r.district_name || '')}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 카카오맵</a>
                  <a href={`https://map.naver.com/p/search/${encodeURIComponent(r.address || r.district_name || '')}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 네이버지도</a>
                </div>
              )}

              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                본 정보는 참고용이며, 투자 판단의 근거로 사용하면 안 됩니다.
              </div>
            </div>
          </div>
        );
      })()}

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
