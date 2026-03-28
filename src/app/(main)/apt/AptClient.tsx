'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import AptCommentSheet from '@/components/AptCommentSheet';
import { haptic } from '@/lib/haptic';
import RegionStackedBar from '@/components/RegionStackedBar';
import SubscriptionTab from './tabs/SubscriptionTab';
const TransactionTab = dynamic(() => import('./tabs/TransactionTab'), { ssr: false });
const RedevTab = dynamic(() => import('./tabs/RedevTab'), { ssr: false });
const OngoingTab = dynamic(() => import('./tabs/OngoingTab'), { ssr: false });
const UnsoldTab = dynamic(() => import('./tabs/UnsoldTab'), { ssr: false });
import { SkeletonList } from '@/components/Skeleton';
import { isNew } from './tabs/apt-utils';
import { useToast } from '@/components/Toast';
import SectionShareButton from '@/components/SectionShareButton';

export default function AptClient({ apts, unsold = [], redevelopment = [], transactions = [], unsoldSummary, alertCounts = {}, regionStats = [], unsoldMonthly = [], tradeMonthly = [], ongoingApts = [], redevTotalCount = 0, tradeTotalCount = 0 }: { apts: any[]; unsold?: any[]; redevelopment?: any[]; transactions?: any[]; unsoldSummary?: any; alertCounts?: Record<string, number>; lastRefreshed?: string | null; regionStats?: { name: string; total: number; open: number; upcoming: number; closed: number }[]; unsoldMonthly?: any[]; tradeMonthly?: any[]; ongoingApts?: any[]; redevTotalCount?: number; tradeTotalCount?: number }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validTabs = ['sub', 'ongoing', 'unsold', 'redev', 'trade'] as const;
  const initialTab = validTabs.includes(tabParam as typeof validTabs[number]) ? tabParam as typeof validTabs[number] : 'sub';
  const [activeTab, setActiveTab] = useState<'sub' | 'ongoing' | 'unsold' | 'redev' | 'trade'>(initialTab);
  const [aptUser, setAptUser] = useState<any>(null);
  const [commentTarget, setCommentTarget] = useState<{ houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' | 'redev' } | null>(null);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [premiumListings, setPremiumListings] = useState<any[]>([]);
  const { info } = useToast();

  // ━━━ Lazy fetch state ━━━
  const [lazyUnsold, setLazyUnsold] = useState<any[] | null>(unsold.length > 0 ? unsold : null);
  const [lazyRedev, setLazyRedev] = useState<any[] | null>(redevelopment.length > 0 ? redevelopment : null);
  const [lazyTx, setLazyTx] = useState<any[] | null>(transactions.length > 0 ? transactions : null);
  const [lazyTradeMonthly, setLazyTradeMonthly] = useState<any[]>(tradeMonthly);
  const [lazyUnsoldMonthly, setLazyUnsoldMonthly] = useState<any[]>(unsoldMonthly);
  const [lazyUnsoldSummary, setLazyUnsoldSummary] = useState<any>(unsoldSummary);
  const [tabLoading, setTabLoading] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [globalSearch, setGlobalSearch] = useState('');

  const fetchTabData = async (tab: string) => {
    setTabLoading(tab);
    try {
      const res = await fetch(`/api/apt/tab-data?tab=${tab}&limit=5000`);
      const json = await res.json();
      if (tab === 'unsold') {
        setLazyUnsold(json.data || []);
        if (json.unsoldMonthly) setLazyUnsoldMonthly(json.unsoldMonthly);
        if (json.unsoldSummary) setLazyUnsoldSummary(json.unsoldSummary);
      }
      if (tab === 'redevelopment') setLazyRedev(json.data || []);
      if (tab === 'transactions') {
        setLazyTx(json.data || []);
        if (json.tradeMonthly) setLazyTradeMonthly(json.tradeMonthly);
      }
    } catch { }
    setTabLoading(null);
  };

  const handleTabChange = (tab: 'sub' | 'ongoing' | 'unsold' | 'redev' | 'trade') => {
    setActiveTab(tab);
    haptic('light');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Lazy fetch on first click
    if (tab === 'unsold' && !lazyUnsold) fetchTabData('unsold');
    if (tab === 'redev' && !lazyRedev) fetchTabData('redevelopment');
    if (tab === 'trade' && !lazyTx) fetchTabData('transactions');
  };

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
        sb.from('apt_watchlist').select('item_type, item_id').eq('user_id', data.session.user.id)
          .then(({ data: wl }) => setWatchlist(new Set((wl || []).map((w: any) => `${w.item_type}:${w.item_id}`))));
      }
    });
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const toggleWatchlist = async (itemType: string, itemId: string) => {
    if (!aptUser) { info('로그인하면 관심 단지를 등록할 수 있어요'); return; }
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

  // Compute KPI metrics
  const openCount = apts.filter(a => {
    const now = new Date().toISOString().slice(0, 10);
    return a.rcept_bgnde && a.rcept_endde && now >= String(a.rcept_bgnde).slice(0, 10) && now <= String(a.rcept_endde).slice(0, 10);
  }).length;
  const upcomingCount = apts.filter(a => {
    const now = new Date().toISOString().slice(0, 10);
    return a.rcept_bgnde && now < String(a.rcept_bgnde).slice(0, 10);
  }).length;
  const unsoldTotal = (lazyUnsold || unsold).reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0);
  const redevCount = (lazyRedev || []).length || redevTotalCount;
  const tradeCount = lazyTx ? lazyTx.length : tradeTotalCount;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🏢 부동산</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/apt/search" className="kd-action-link">🔍 검색</Link>
        </div>
      </div>

      {/* KPI 요약 — 클릭 시 해당 탭으로 이동 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {[
          { label: '접수중', value: openCount.toLocaleString(), color: 'var(--accent-green)', bg: 'rgba(52,211,153,0.08)', tab: 'sub' as const },
          { label: '예정', value: upcomingCount.toLocaleString(), color: 'var(--accent-blue)', bg: 'rgba(91,164,245,0.08)', tab: 'sub' as const },
          { label: '분양중', value: ongoingApts.length.toLocaleString(), color: 'var(--accent-purple)', bg: 'rgba(183,148,255,0.08)', tab: 'ongoing' as const },
          { label: '미분양', value: unsoldTotal.toLocaleString(), color: 'var(--accent-red)', bg: 'rgba(255,107,107,0.08)', tab: 'unsold' as const },
          { label: '재개발', value: redevCount.toLocaleString(), color: 'var(--accent-orange)', bg: 'rgba(255,159,67,0.08)', tab: 'redev' as const },
          { label: '실거래', value: tradeCount.toLocaleString(), color: 'var(--accent-cyan)', bg: 'rgba(34,211,238,0.08)', tab: 'trade' as const },
        ].map(({ label, value, color, bg, tab }) => (
          <button key={label} onClick={() => handleTabChange(tab)} style={{
            flex: 1, textAlign: 'center', padding: '10px 2px', borderRadius: 8,
            background: activeTab === tab ? `${color}22` : bg,
            border: activeTab === tab ? `1.5px solid ${color}55` : `1px solid ${color}33`,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color, marginTop: 2, opacity: 0.7 }}>{label}</div>
          </button>
        ))}
      </div>

      {/* 지역별 스택바 현황 */}
      <RegionStackedBar
        apts={apts}
        ongoingApts={ongoingApts}
        unsold={lazyUnsold || unsold}
        redevelopment={lazyRedev || []}
        transactions={lazyTx || []}
        onRegionClick={setSelectedRegion}
        activeRegion={selectedRegion !== '전체' ? selectedRegion : undefined}
        shareButton={<SectionShareButton section="apt-region" label="청약 정보, 부동산 정보(분양/미분양/실거래/재개발재건축) 찾기 힘드시죠? 여기는 보기 편해요!" pagePath="/apt" />}
      />

      {/* 지역 필터 활성 배지 */}
      {selectedRegion !== '전체' && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
          padding: '5px 12px', borderRadius: 20, background: 'var(--brand-bg)',
          border: '1px solid var(--brand-border)', fontSize: 12, fontWeight: 600, color: 'var(--brand)',
        }}>
          📍 {selectedRegion} 필터 적용 중
          <button onClick={() => setSelectedRegion('전체')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
            fontSize: 14, padding: 0, lineHeight: 1, marginLeft: 2,
          }} aria-label="필터 해제">✕</button>
        </div>
      )}

      {/* 통합 검색창 */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>🔍</span>
        <input
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          placeholder="단지명, 지역, 시공사 통합 검색..."
          className="kd-search-input"
          style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
        />
        {globalSearch && (
          <button onClick={() => setGlobalSearch('')} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: '50%',
            width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 11, padding: 0, lineHeight: 1,
          }} aria-label="검색어 지우기">✕</button>
        )}
      </div>
      {globalSearch && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 8, marginTop: -6 }}>
          🔍 &quot;{globalSearch}&quot; — 현재 탭에서 필터링 중 · 다른 탭에서도 동일하게 적용됩니다
        </div>
      )}
      <div className="apt-pill-scroll" style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {[
          { k: 'sub' as const, l: '📅 청약', type: 'subscription', data: apts },
          { k: 'ongoing' as const, l: '🏢 분양중', type: 'ongoing', data: ongoingApts },
          { k: 'unsold' as const, l: '🏚️ 미분양', type: 'unsold', data: lazyUnsold || [] },
          { k: 'redev' as const, l: '🏗️ 재개발', type: 'redevelopment', data: lazyRedev || [] },
          { k: 'trade' as const, l: '💰 실거래', type: 'transaction', data: lazyTx || [] },
        ].map(({ k, l, type, data }) => {
          const hasNew = (data as any[]).some((item: Record<string, any>) => isNew(item, type));
          // 통합 검색 시 탭별 매칭 건수 계산
          const matchCount = globalSearch ? (() => {
            const q = globalSearch.toLowerCase();
            return (data as any[]).filter((item: Record<string, any>) => {
              const fields = [item.house_nm, item.apt_name, item.district_name, item.region_nm, item.region, item.hssply_adres, item.address, item.sigungu, item.sigungu_nm, item.constructor_nm, item.constructor, item.dong];
              return fields.some(f => f && String(f).toLowerCase().includes(q));
            }).length;
          })() : null;
          return (
            <button key={k} onClick={() => handleTabChange(k)} aria-pressed={activeTab === k} style={{
              flex: '1 0 auto', padding: '8px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', position: 'relative',
              whiteSpace: 'nowrap',
              background: activeTab === k ? 'var(--brand)' : 'transparent',
              color: activeTab === k ? 'var(--text-inverse)' : 'var(--text-tertiary)', fontWeight: 600, fontSize: 12,
              boxShadow: activeTab === k ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
            }}>
              {l}
              {globalSearch ? (
                <span style={{ fontSize: 10, marginLeft: 2, opacity: matchCount ? 1 : 0.4, fontWeight: matchCount ? 800 : 500 }}>{matchCount}</span>
              ) : (
                data.length > 0 && <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.7 }}>{
                  type === 'unsold'
                    ? (() => { const total = (data as any[]).reduce((s: number, u: any) => s + (u.tot_unsold_hshld_co || 0), 0); return total > 999 ? `${(total/1000).toFixed(0)}k` : total; })()
                    : data.length > 999 ? `${(data.length/1000).toFixed(0)}k` : data.length
                }</span>
              )}
              {hasNew && activeTab !== k && !globalSearch && <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-red)' }} />}
            </button>
          );
        })}
      </div>

      {/* ━━━ 청약 일정 탭 ━━━ */}
      {activeTab === 'sub' && (
        <SubscriptionTab
          apts={apts}
          alertCounts={alertCounts}
          regionStats={regionStats}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
          globalRegion={selectedRegion !== '전체' ? selectedRegion : undefined}
          globalSearch={globalSearch}
        />
      )}

            {activeTab === 'ongoing' && (
        <OngoingTab
          ongoingApts={ongoingApts}
          premiumListings={premiumListings}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
          globalRegion={selectedRegion !== '전체' ? selectedRegion : undefined}
          globalSearch={globalSearch}
        />
      )}

      {/* ━━━ 미분양 탭 ━━━ */}
      {activeTab === 'unsold' && (
        tabLoading === 'unsold' ? <SkeletonList count={4} type="apt" /> :
        <UnsoldTab
          unsold={lazyUnsold || []}
          unsoldMonthly={lazyUnsoldMonthly}
          unsoldSummary={lazyUnsoldSummary}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
          globalRegion={selectedRegion !== '전체' ? selectedRegion : undefined}
          globalSearch={globalSearch}
        />
      )}

      {activeTab === 'redev' && (
        tabLoading === 'redevelopment' ? <SkeletonList count={4} type="apt" /> :
        <RedevTab
          redevelopment={lazyRedev || []}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
          globalRegion={selectedRegion !== '전체' ? selectedRegion : undefined}
          globalSearch={globalSearch}
        />
      )}

      {/* ━━━ 실거래가 탭 ━━━ */}
      {activeTab === 'trade' && (
        tabLoading === 'transactions' ? <SkeletonList count={4} type="apt" /> :
        <TransactionTab
          transactions={lazyTx || []}
          tradeMonthly={lazyTradeMonthly}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
          globalRegion={selectedRegion !== '전체' ? selectedRegion : undefined}
          globalSearch={globalSearch}
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
          background: 'var(--bg-elevated, #1e293b)', color: 'var(--text-inverse)', padding: '12px 20px',
          borderRadius: 12, fontSize: 'var(--fs-sm)', fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
          animation: 'fadeIn 0.2s ease-out',
        }}>{toast}</div>
      )}
    </div>
  );
}
