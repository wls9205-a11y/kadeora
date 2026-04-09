'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { CATEGORY_MAP } from '@/lib/constants';

interface PostRow {
  id: number; title: string; category: string; created_at: string;
  view_count: number; likes_count: number; comments_count: number;
}

type TabType = 'posts' | 'bookmarks' | 'comments' | 'stocks' | 'apts' | 'blog_bookmarks';

interface Props {
  profileId: string;
  posts: PostRow[];
  isOwner: boolean;
}

export default function ProfileTabs({ profileId, posts, isOwner }: Props) {
  const searchParams = useSearchParams();
  const sb = useMemo(() => createSupabaseBrowser(), []);
  const paramTab = searchParams.get('tab');
  const initialTab: TabType = paramTab === 'bookmarks' ? 'bookmarks' : paramTab === 'comments' ? 'comments' : paramTab === 'stocks' ? 'stocks' : paramTab === 'apts' ? 'apts' : paramTab === 'blog_bookmarks' ? 'blog_bookmarks' : 'posts';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Posts state
  const [displayedPosts, setDisplayedPosts] = useState<PostRow[]>(posts);
  const [postsOffset, setPostsOffset] = useState(posts.length);
  const [hasMorePosts, setHasMorePosts] = useState(posts.length >= 20);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  // Comments state
  const [myComments, setMyComments] = useState<any[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  // Bookmarks state
  const [bookmarkedPosts, setBookmarkedPosts] = useState<PostRow[]>([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);

  // Watch stocks state
  const [watchStocks, setWatchStocks] = useState<any[]>([]);
  const [watchStocksLoaded, setWatchStocksLoaded] = useState(false);

  // Watch apts state
  const [watchApts, setWatchApts] = useState<any[]>([]);
  const [watchAptsLoaded, setWatchAptsLoaded] = useState(false);

  // Blog bookmarks state
  const [blogBookmarks, setBlogBookmarks] = useState<any[]>([]);
  const [blogBookmarksLoaded, setBlogBookmarksLoaded] = useState(false);

  const loadBookmarks = async () => {
    if (bookmarksLoaded) return;
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user || user.id !== profileId) return;
      const { data: bm } = await sb.from('bookmarks').select('post_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      if (!bm || bm.length === 0) { setBookmarksLoaded(true); return; }
      const ids = bm.map(b => b.post_id);
      const { data: bmPosts } = await sb.from('posts').select('id,title,category,created_at,view_count,likes_count,comments_count').in('id', ids).eq('is_deleted', false);
      setBookmarkedPosts(bmPosts ?? []);
    } catch {} finally { setBookmarksLoaded(true); }
  };

  const loadMyComments = async () => {
    if (commentsLoaded) return;
    const { data } = await sb.from('comments').select('id,content,created_at,post_id')
      .eq('author_id', profileId).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(20);
    setMyComments(data ?? []);
    setCommentsLoaded(true);
  };

  const loadWatchStocks = async () => {
    if (watchStocksLoaded) return;
    const { data: wl } = await sb.from('stock_watchlist').select('symbol').eq('user_id', profileId);
    if (wl && wl.length > 0) {
      const symbols = wl.map((w: any) => w.symbol);
      const { data: stocks } = await sb.from('stock_quotes').select('symbol, name, market, price, change_pct, currency').in('symbol', symbols);
      setWatchStocks(stocks ?? []);
    }
    setWatchStocksLoaded(true);
  };

  const loadWatchApts = async () => {
    if (watchAptsLoaded) return;
    const { data: bm } = await sb.from('apt_bookmarks').select('apt_id').eq('user_id', profileId);
    if (bm && bm.length > 0) {
      const ids = bm.map((b: any) => b.apt_id);
      // complex_profiles 우선 → subscriptions 폴백
      const { data: complexes } = await (sb as any).from('apt_complex_profiles')
        .select('id, apt_name, region_nm, sigungu').in('id', ids).limit(20);
      if (complexes?.length) {
        setWatchApts(complexes.map((c: any) => ({
          id: c.id, house_nm: c.apt_name, region_nm: `${c.region_nm || ''} ${c.sigungu || ''}`.trim(),
          rcept_bgnde: null, rcept_endde: null, tot_supply_hshld_co: null,
        })));
      } else {
        const { data: apts } = await sb.from('apt_subscriptions').select('id, house_nm, region_nm, rcept_bgnde, rcept_endde, tot_supply_hshld_co').in('id', ids);
        setWatchApts(apts ?? []);
      }
    }
    setWatchAptsLoaded(true);
  };

  const loadBlogBookmarks = async () => {
    if (blogBookmarksLoaded) return;
    try {
      const res = await fetch('/api/blog/bookmark');
      const data = await res.json();
      setBlogBookmarks(data.bookmarks || []);
    } catch {} finally { setBlogBookmarksLoaded(true); }
  };

  const loadMorePosts = async () => {
    setLoadingMorePosts(true);
    try {
      const { data } = await sb.from('posts')
        .select('id,title,category,created_at,view_count,likes_count,comments_count')
        .eq('author_id', profileId).eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(postsOffset, postsOffset + 19);
      if (data && data.length > 0) {
        setDisplayedPosts(prev => [...prev, ...data]);
        setPostsOffset(prev => prev + data.length);
        if (data.length < 20) setHasMorePosts(false);
      } else {
        setHasMorePosts(false);
      }
    } catch {} finally { setLoadingMorePosts(false); }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'bookmarks') loadBookmarks();
    if (tab === 'comments') loadMyComments();
    if (tab === 'stocks') loadWatchStocks();
    if (tab === 'apts') loadWatchApts();
    if (tab === 'blog_bookmarks') loadBlogBookmarks();
  };

  useEffect(() => {
    if (initialTab === 'bookmarks') loadBookmarks();
    if (initialTab === 'comments') loadMyComments();
    if (initialTab === 'stocks') loadWatchStocks();
    if (initialTab === 'apts') loadWatchApts();
    if (initialTab === 'blog_bookmarks') loadBlogBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs: TabType[] = ['posts', 'comments', ...(isOwner ? ['stocks', 'apts', 'bookmarks', 'blog_bookmarks'] as TabType[] : [])];
  const tabLabels: Record<TabType, string> = {
    posts: '📝 글', comments: '💬 댓글', stocks: '⭐ 관심종목', apts: '🏠 관심단지', bookmarks: '🔖 북마크', blog_bookmarks: '📑 저장한 글',
  };

  const Spinner = () => (
    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
      <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', margin: '0 auto 8px' }} className="animate-spin" />
    </div>
  );

  return (
    <>
      {/* 탭 바 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--sp-md)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', padding: 4, border: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => handleTabChange(tab)} aria-pressed={activeTab === tab} style={{
            flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            background: activeTab === tab ? 'var(--brand)' : 'transparent',
            color: activeTab === tab ? 'var(--text-inverse)' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 'var(--fs-sm)', transition: 'all var(--transition-fast)', whiteSpace: 'nowrap', minWidth: 'fit-content',
          }}>
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'clamp(14px, 3vw, 20px) clamp(14px, 3vw, 24px)' }}>
        {/* 게시글 */}
        {activeTab === 'posts' && (
          displayedPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>✏️ 첫 글을 작성해보세요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayedPosts.map((post, i) => {
                const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
                return (
                  <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < displayedPosts.length-1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'center', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 7px', borderRadius: 'var(--radius-pill)', fontWeight: 700, flexShrink: 0, background: cat.bg, color: cat.color }}>{cat.label}</span>
                      <span style={{ flex: 1, fontSize: 'var(--fs-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                      <div style={{ display: 'flex', gap: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        <span>❤️{post.likes_count}</span><span>💬{post.comments_count}</span>
                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {hasMorePosts && (
                <button onClick={loadMorePosts} disabled={loadingMorePosts}
                  style={{ marginTop: 'var(--sp-md)', padding: '10px 0', width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer' }}>
                  {loadingMorePosts ? '불러오는 중...' : '더보기'}
                </button>
              )}
            </div>
          )
        )}

        {/* 댓글 */}
        {activeTab === 'comments' && (
          !commentsLoaded ? <Spinner /> : myComments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>💬 작성한 댓글이 없어요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {myComments.filter(c => c.post_id).map((comment, i) => (
                <Link key={comment.id} href={`/feed/${comment.post_id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '12px 0', borderBottom: i < myComments.length - 1 ? '1px solid var(--border)' : 'none', transition: 'opacity 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                    <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', marginBottom: 'var(--sp-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {comment.content}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                      게시글 #{comment.post_id} · {new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* 관심종목 */}
        {activeTab === 'stocks' && (
          !watchStocksLoaded ? <Spinner /> : watchStocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 'var(--sp-sm)' }}>⭐</div>
              관심종목이 없어요<br/>
              <Link href="/stock" style={{ color: 'var(--brand)', fontSize: 'var(--fs-sm)' }}>주식 페이지에서 ☆를 눌러 추가하세요</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {watchStocks.map((s: any, i: number) => {
                const isUp = (s.change_pct || 0) >= 0;
                const color = s.market === 'KR' ? (isUp ? 'var(--accent-red)' : 'var(--accent-blue)') : (isUp ? 'var(--accent-green)' : 'var(--accent-red)');
                return (
                  <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < watchStocks.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--fs-base)' }}>{s.name}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.symbol} · {s.market}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--fs-base)' }}>
                          {s.currency === 'KRW' ? `₩${Number(s.price).toLocaleString()}` : `$${Number(s.price).toLocaleString()}`}
                        </div>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color }}>
                          {isUp ? '+' : ''}{Number(s.change_pct).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* 관심단지 */}
        {activeTab === 'apts' && (
          !watchAptsLoaded ? <Spinner /> : watchApts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 'var(--sp-sm)' }}>🏠</div>
              관심단지가 없어요<br/>
              <Link href="/apt" style={{ color: 'var(--brand)', fontSize: 'var(--fs-sm)' }}>부동산 페이지에서 북마크를 눌러 추가하세요</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {watchApts.map((a: any, i: number) => {
                const isComplex = !a.rcept_bgnde;
                const today = new Date().toISOString().slice(0, 10);
                const isOpen = !isComplex && a.rcept_bgnde && a.rcept_endde && today >= a.rcept_bgnde && today <= a.rcept_endde;
                const isClosed = !isComplex && a.rcept_endde && today > a.rcept_endde;
                const href = isComplex ? `/apt/complex/${encodeURIComponent(a.house_nm)}` : `/apt/${a.id}`;
                return (
                  <Link key={a.id} href={href} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < watchApts.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--fs-base)' }}>{a.house_nm}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                          {a.region_nm}{a.tot_supply_hshld_co ? ` · ${Number(a.tot_supply_hshld_co).toLocaleString()}세대` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {isComplex ? (
                          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>단지</span>
                        ) : (
                          <>
                            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-md)', background: isOpen ? 'rgba(52,211,153,0.2)' : isClosed ? 'var(--bg-hover)' : 'rgba(251,191,36,0.15)', color: isOpen ? 'var(--accent-green)' : isClosed ? 'var(--text-tertiary)' : 'var(--accent-yellow)' }}>
                              {isOpen ? '접수중' : isClosed ? '마감' : '접수예정'}
                            </span>
                            {a.rcept_bgnde && (
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
                                {a.rcept_bgnde} ~ {a.rcept_endde}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* 저장한 블로그 */}
        {activeTab === 'blog_bookmarks' && (
          !blogBookmarksLoaded ? <Spinner /> : blogBookmarks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>📑 저장한 블로그 글이 없어요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {blogBookmarks.map((post: any, i: number) => (
                <Link key={post.id} href={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '12px 0', borderBottom: i < blogBookmarks.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'center', transition: 'opacity 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                    <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 7px', borderRadius: 'var(--radius-pill)', fontWeight: 700, flexShrink: 0, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{post.category}</span>
                    <span style={{ flex: 1, fontSize: 'var(--fs-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                    <div style={{ display: 'flex', gap: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <span>👀{post.view_count || 0}</span>
                      <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* 북마크 */}
        {activeTab === 'bookmarks' && (
          !bookmarksLoaded ? <Spinner /> : bookmarkedPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>🔖 저장한 글이 없어요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {bookmarkedPosts.map((post, i) => {
                const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
                return (
                  <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < bookmarkedPosts.length-1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'center', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 7px', borderRadius: 'var(--radius-pill)', fontWeight: 700, flexShrink: 0, background: cat.bg, color: cat.color }}>{cat.label}</span>
                      <span style={{ flex: 1, fontSize: 'var(--fs-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                      <div style={{ display: 'flex', gap: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        <span>❤️{post.likes_count}</span><span>💬{post.comments_count}</span>
                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
}
