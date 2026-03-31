'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, Building2, Bell, ChevronRight, Star } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { stockColor } from '@/lib/format';
import { SkeletonDashboard } from '@/components/Skeleton';
import { useAuth } from '@/components/AuthProvider';

interface WatchStock { symbol: string; name: string; price: number; change_pct: number; currency?: string; }
interface FavApt { id: number; house_nm: string; rcept_endde: string; region_nm: string; }
interface Alert { id: string; type: string; content: string; created_at: string; link?: string; }
interface RecBlog { slug: string; title: string; category: string; view_count: number; }

function kstToday(): string { return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }

function dDay(endDate: string): string {
  const today = kstToday();
  const diff = Math.ceil((new Date(endDate).getTime() - new Date(today).getTime()) / 86400000);
  if (diff < 0) return '마감';
  if (diff === 0) return 'D-Day';
  return `D-${diff}`;
}

export default function PersonalDashboard() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [watchStocks, setWatchStocks] = useState<WatchStock[]>([]);
  const [favApts, setFavApts] = useState<FavApt[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recBlogs, setRecBlogs] = useState<RecBlog[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCollapsed(localStorage.getItem('kd_dash_collapsed') === '1');
    }
  }, []);

  const { userId: authUid, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!authUid) { setLoading(false); return; }
    setUserId(authUid);

    const sb = createSupabaseBrowser();
    const uid = authUid;

    // 모든 쿼리를 병렬 실행
    Promise.allSettled([
      // [0] 관심종목
      sb.from('stock_watchlist').select('symbol').eq('user_id', uid),
      // [1] 북마크
      sb.from('apt_bookmarks').select('apt_id').eq('user_id', uid).limit(5),
      // [2] 알림
      sb.from('notifications').select('id,type,content,created_at').eq('user_id', uid).eq('is_read', false).order('created_at', { ascending: false }).limit(3),
      // [3] 인기 블로그 (폴백용)
      sb.from('blog_posts').select('slug,title,category,view_count').eq('is_published', true).order('view_count', { ascending: false }).limit(3),
    ]).then(async ([watchlistRes, bookmarkRes, notifRes, blogRes]) => {
      // 관심종목 → 시세
      const wl = watchlistRes.status === 'fulfilled' ? (watchlistRes.value.data as Record<string, unknown>[] | null) : null;
      if (wl?.length) {
        const symbols = wl.map((w: any) => w.symbol);
        const { data: stocks } = await sb.from('stock_quotes')
          .select('symbol,name,price,change_pct,currency')
          .in('symbol', symbols)
          .order('market_cap', { ascending: false })
          .limit(5);
        if (stocks) setWatchStocks(stocks as WatchStock[]);
      }

      // 북마크 → 청약 상세
      const bm = bookmarkRes.status === 'fulfilled' ? (bookmarkRes.value.data as Record<string, unknown>[] | null) : null;
      if (bm?.length) {
        const ids = bm.map((b: any) => b.apt_id);
        const { data: apts } = await sb.from('apt_subscriptions')
          .select('id,house_nm,rcept_endde,region_nm')
          .in('id', ids)
          .order('rcept_endde', { ascending: true })
          .limit(3);
        if (apts) setFavApts(apts as FavApt[]);
      }

      // 알림
      if (notifRes.status === 'fulfilled' && notifRes.value.data) {
        setAlerts(notifRes.value.data as unknown as Alert[]);
      }

      // 블로그 추천
      if (blogRes.status === 'fulfilled' && blogRes.value.data) {
        setRecBlogs(blogRes.value.data as RecBlog[]);
      }

      setLoading(false);
    });
  }, [authUid, authLoading]);

  if (loading) return <SkeletonDashboard />;
  if (!userId) return null;
  if (!watchStocks.length && !favApts.length && !alerts.length && !recBlogs.length) return null;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('kd_dash_collapsed', next ? '1' : '0');
  };

  return (
    <div style={{ marginBottom: 'var(--sp-lg)' }}>
      <button onClick={toggle} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
        color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600,
        cursor: 'pointer', padding: '4px 0', marginBottom: collapsed ? 0 : 10, width: '100%',
      }}>
        <Star size={14} /> 내 대시보드
        <ChevronRight size={14} style={{ transform: collapsed ? 'rotate(0)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
      </button>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {/* 관심 종목 카드 */}
          {watchStocks.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--card-p)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <TrendingUp size={14} color="var(--accent-blue)" />
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>관심 종목</span>
                <Link href="/stock" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>더보기 →</Link>
              </div>
              {watchStocks.slice(0, 4).map(s => {
                const isKR = s.currency !== 'USD';
                return (
                  <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 0', textDecoration: 'none', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: stockColor(s.change_pct, isKR) }}>
                      {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* 관심 청약 D-day */}
          {favApts.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--card-p)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Building2 size={14} color="var(--accent-green)" />
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>관심 청약</span>
                <Link href="/apt" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>더보기 →</Link>
              </div>
              {[...favApts].sort((a, b) => {
                const da = Math.ceil((new Date(a.rcept_endde).getTime() - Date.now()) / 86400000);
                const db = Math.ceil((new Date(b.rcept_endde).getTime() - Date.now()) / 86400000);
                return da - db;
              }).map(a => (
                <Link key={a.id} href={`/apt/${a.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 0', textDecoration: 'none', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.house_nm}
                  </span>
                  <span style={{
                    fontSize: 'var(--fs-xs)', fontWeight: 700, flexShrink: 0, marginLeft: 8,
                    padding: '2px 6px', borderRadius: 4,
                    background: dDay(a.rcept_endde).includes('D-') && parseInt(dDay(a.rcept_endde).replace('D-', '')) <= 3 ? 'var(--accent-red)' : 'var(--bg-hover)',
                    color: dDay(a.rcept_endde).includes('D-') && parseInt(dDay(a.rcept_endde).replace('D-', '')) <= 3 ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  }}>
                    {dDay(a.rcept_endde)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* 관심 청약 빈 상태 */}
          {favApts.length === 0 && watchStocks.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--card-p)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Building2 size={14} color="var(--accent-green)" />
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>관심 청약</span>
              </div>
              <Link href="/apt" style={{ display: 'block', textAlign: 'center', padding: '12px 8px', fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
                관심 청약을 등록해보세요 →
              </Link>
            </div>
          )}

          {/* 읽지 않은 알림 */}
          {alerts.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--card-p)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Bell size={14} color="var(--accent-orange)" />
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>새 알림 {alerts.length}개</span>
                <Link href="/notifications" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>보기 →</Link>
              </div>
              {alerts.map(a => (
                <Link key={a.id} href={a.link || '/notifications'} style={{
                  display: 'block', padding: '5px 0', textDecoration: 'none',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {a.content}
                </Link>
              ))}
            </div>
          )}

          {/* 추천 블로그 */}
          {recBlogs.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--card-p)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>📰</span>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>추천 읽을거리</span>
                <Link href="/blog" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>더보기 →</Link>
              </div>
              {recBlogs.map(b => (
                <Link key={b.slug} href={`/blog/${b.slug}`} style={{
                  display: 'block', padding: '5px 0', textDecoration: 'none',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {b.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
