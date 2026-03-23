'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import AptCommentSheet from '@/components/AptCommentSheet';
import { haptic } from '@/lib/haptic';
import TransactionTab from './tabs/TransactionTab';
import RedevTab from './tabs/RedevTab';
import OngoingTab from './tabs/OngoingTab';
import UnsoldTab from './tabs/UnsoldTab';
import SubscriptionTab from './tabs/SubscriptionTab';
import { SkeletonList } from '@/components/Skeleton';
import { isNew } from './tabs/apt-utils';

export default function AptClient({ apts, unsold = [], redevelopment = [], transactions = [], unsoldSummary, alertCounts = {}, regionStats = [], unsoldMonthly = [], tradeMonthly = [], ongoingApts = [] }: { apts: any[]; unsold?: any[]; redevelopment?: any[]; transactions?: any[]; unsoldSummary?: any; alertCounts?: Record<string, number>; lastRefreshed?: string | null; regionStats?: { name: string; total: number; open: number; upcoming: number; closed: number }[]; unsoldMonthly?: any[]; tradeMonthly?: any[]; ongoingApts?: any[] }) {
  const [activeTab, setActiveTab] = useState<'sub' | 'ongoing' | 'unsold' | 'redev' | 'trade'>('sub');
  const [aptUser, setAptUser] = useState<any>(null);
  const [commentTarget, setCommentTarget] = useState<{ houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' | 'redev' } | null>(null);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [premiumListings, setPremiumListings] = useState<any[]>([]);

  // ━━━ Lazy fetch state ━━━
  const [lazyUnsold, setLazyUnsold] = useState<any[] | null>(unsold.length > 0 ? unsold : null);
  const [lazyRedev, setLazyRedev] = useState<any[] | null>(redevelopment.length > 0 ? redevelopment : null);
  const [lazyTx, setLazyTx] = useState<any[] | null>(transactions.length > 0 ? transactions : null);
  const [lazyTradeMonthly, setLazyTradeMonthly] = useState<any[]>(tradeMonthly);
  const [lazyUnsoldMonthly, setLazyUnsoldMonthly] = useState<any[]>(unsoldMonthly);
  const [lazyUnsoldSummary, setLazyUnsoldSummary] = useState<any>(unsoldSummary);
  const [tabLoading, setTabLoading] = useState<string | null>(null);

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

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🏢 부동산</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/apt/map" className="kd-action-link">🗺️ 지도</Link>
          <Link href="/apt/search" className="kd-action-link">🔍 검색</Link>
          <Link href="/apt/diagnose" className="kd-action-link">🎯 진단</Link>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { k: 'sub' as const, l: '📅 청약', type: 'subscription', data: apts },
          { k: 'ongoing' as const, l: '🏢 분양중', type: 'ongoing', data: ongoingApts },
          { k: 'unsold' as const, l: '🏚️ 미분양', type: 'unsold', data: lazyUnsold || [] },
          { k: 'redev' as const, l: '🏗️ 재개발', type: 'redevelopment', data: lazyRedev || [] },
          { k: 'trade' as const, l: '💰 실거래', type: 'transaction', data: lazyTx || [] },
        ].map(({ k, l, type, data }) => {
          const hasNew = (data as any[]).some((item: any) => isNew(item, type));
          return (
            <button key={k} onClick={() => handleTabChange(k)} aria-pressed={activeTab === k} style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', position: 'relative', minWidth: 'fit-content',
              background: activeTab === k ? 'var(--brand)' : 'transparent',
              color: activeTab === k ? 'var(--text-inverse)' : 'var(--text-tertiary)', fontWeight: 600, fontSize: 'var(--fs-sm)',
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
        <SubscriptionTab
          apts={apts}
          alertCounts={alertCounts}
          regionStats={regionStats}
          aptUser={aptUser}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
          setCommentTarget={setCommentTarget}
          showToast={showToast}
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
