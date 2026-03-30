'use client';
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { MessageCircle, Share2, Search, User, TrendingUp, Clock, Users } from 'lucide-react';
import type { PostWithProfile } from '@/types/database';
import { REGIONS, GRADE_EMOJI, gradeColor, gradeTitle } from '@/lib/constants';
import { getAvatarColor } from '@/lib/avatar';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { SkeletonCard } from '@/components/Skeleton';
import PullToRefresh from '@/components/PullToRefresh';
import EmptyState from '@/components/EmptyState';
import AttendanceBanner from '@/components/AttendanceBanner';
import PersonalDashboard from '@/components/PersonalDashboard';
import DailyReportCard from '@/components/DailyReportCard';
import LiveActivityIndicator from '@/components/LiveActivityIndicator';
import MiniWatchlist from '@/components/MiniWatchlist';
import WeeklyPrediction from '@/components/WeeklyPrediction';
import PostReactions from '@/components/PostReactions';
import LoungeLivePreview from '@/components/LoungeLivePreview';
import { timeAgo, numFmt } from '@/lib/format';
import { useAuth } from '@/components/AuthProvider';

const PAGE_SIZE = 20;

// 베스트 댓글 미리보기 (카드 내부)
function BestCommentPreview({ postId }: { postId: number }) {
  const [best, setBest] = useState<{ content: string; nickname: string; likes_count: number; grade: number } | null>(null);
  useEffect(() => {
    const sb = createSupabaseBrowser();
    (sb as any).rpc('get_best_comment', { p_post_id: postId }).then(({ data }: any) => {
      if (data && data.content) setBest(data);
    });
  }, [postId]);
  if (!best) return null;
  return (
    <div style={{ marginTop: 6, padding: '5px 8px', borderLeft: '2px solid rgba(59,123,246,0.3)', background: 'var(--bg-hover)', borderRadius: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)' }}>Best</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{best.nickname} {GRADE_EMOJI[best.grade] ?? '🌱'}</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>♥ {best.likes_count}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{best.content}</div>
    </div>
  );
}

type SortKey = 'latest' | 'popular' | 'comments';

interface Props {
  posts: PostWithProfile[];
  activeCategory: string;
  activeRegion?: string;
  activeSort?: SortKey;
}

function readingTime(text: string): number {
  return Math.max(1, Math.round((text || '').replace(/<[^>]+>/g, '').length / 500));
}

function stripHtml(text: string): string {
  return (text || '').replace(/<[^>]*>/g, '').replace(/[#*_~`>]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
}

const CAT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  apt:   { label: '부동산',  color: '#2EE8A5', bg: 'rgba(52,211,153,0.1)' },
  stock: { label: '주식',    color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
  local: { label: '우리동네',color: '#FFD43B', bg: 'rgba(251,191,36,0.1)' },
  free:  { label: '자유',    color: '#B794FF', bg: 'rgba(167,139,250,0.1)' },
};

export default function FeedClient({
  posts: initialPosts,
  activeCategory,
  activeRegion = 'all',
  activeSort = 'latest',
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [posts, setPosts] = useState<PostWithProfile[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialPosts.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>(() => {
    const c: Record<number, number> = {};
    initialPosts.forEach(p => { c[p.id] = p.likes_count ?? 0; });
    return c;
  });
  const [showHotBanner, setShowHotBanner] = useState(false);
  const [hotPosts, setHotPosts] = useState<Record<string, unknown>[]>([]);
  const [hotBlog, setHotBlog] = useState<{ slug: string; title: string; view_count: number } | null>(null);
  const loadedAtRef = useRef<string>(new Date().toISOString());
  const [newCount, setNewCount] = useState(0);
  const newCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [visitedIds, setVisitedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialPosts.length >= PAGE_SIZE);
    setNewCount(0);
    setActiveTag(null);
    loadedAtRef.current = new Date().toISOString();
    const c: Record<number, number> = {};
    initialPosts.forEach(p => { c[p.id] = p.likes_count ?? 0; });
    setLikeCounts(c);
  }, [initialPosts]);

  // 읽은 글 추적 (localStorage)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kd_visited');
      if (stored) setVisitedIds(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowHotBanner(!sessionStorage.getItem('kd_hot_banner_closed'));
    }
    const sb = createSupabaseBrowser();
    sb.from('posts')
      .select('id,title,category,likes_count,profiles!posts_author_id_fkey(nickname)')
      .eq('is_deleted', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('likes_count', { ascending: false })
      .limit(3)
      .then(({ data }: { data: Record<string, unknown>[] | null }) => { if (data && data.length > 0) setHotPosts(data); });
    sb.from('blog_posts').select('slug,title,view_count').eq('is_published', true)
      .order('view_count', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: { data: { slug: string; title: string; view_count: number | null } | null }) => { if (data) setHotBlog({ slug: data.slug, title: data.title, view_count: data.view_count ?? 0 }); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 글 폴링 30초
  useEffect(() => {
    if (activeCategory === 'following') return;
    const check = async () => {
      try {
        const sb = createSupabaseBrowser();
        let q = sb.from('posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gt('created_at', loadedAtRef.current);
        if (activeCategory !== 'all') q = q.eq('category', activeCategory);
        const { count } = await q;
        if ((count ?? 0) > 0) setNewCount(count ?? 0);
      } catch { /* ignore */ }
    };
    newCheckTimerRef.current = setInterval(check, 30_000);
    return () => { if (newCheckTimerRef.current) clearInterval(newCheckTimerRef.current); };
  }, [activeCategory]);

  const { userId: authUserId } = useAuth();

  useEffect(() => {
    if (!authUserId) return;
    setCurrentUserId(authUserId);
    const sb = createSupabaseBrowser();
    sb.from('post_likes').select('post_id').eq('user_id', authUserId)
      .then(({ data: likes }: { data: { post_id: number }[] | null }) => {
        if (likes) setLikedPosts(new Set(likes.map((l: { post_id: number }) => l.post_id)));
      });
  }, [authUserId]);

  const handleUpvote = async (e: React.MouseEvent, postId: number) => {
    e.preventDefault(); e.stopPropagation();
    if (!currentUserId) { router.push(`/login?redirect=${encodeURIComponent(pathname)}`); return; }
    const alreadyLiked = likedPosts.has(postId);
    setLikedPosts((prev: Set<number>) => { const n = new Set(prev); alreadyLiked ? n.delete(postId) : n.add(postId); return n; });
    setLikeCounts((prev: Record<number, number>) => ({ ...prev, [postId]: (prev[postId] ?? 0) + (alreadyLiked ? -1 : 1) }));
    try {
      const res = await fetch('/api/likes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: postId }) });
      if (!res.ok) {
        setLikedPosts((prev: Set<number>) => { const n = new Set(prev); alreadyLiked ? n.add(postId) : n.delete(postId); return n; });
        setLikeCounts((prev: Record<number, number>) => ({ ...prev, [postId]: (prev[postId] ?? 0) + (alreadyLiked ? 1 : -1) }));
      }
    } catch {
      setLikedPosts((prev: Set<number>) => { const n = new Set(prev); alreadyLiked ? n.add(postId) : n.delete(postId); return n; });
      setLikeCounts((prev: Record<number, number>) => ({ ...prev, [postId]: (prev[postId] ?? 0) + (alreadyLiked ? 1 : -1) }));
    }
  };

  const handleShare = async (e: React.MouseEvent, post: PostWithProfile) => {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}/feed/${post.slug || post.id}`;
    let platform = 'clipboard';
    if (navigator.share) {
      try { await navigator.share({ title: post.title, url }); platform = 'native'; } catch { return; }
    } else {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    }
    fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: post.id, platform }) }).catch(() => { /* ignore */ });
  };

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const sb = createSupabaseBrowser();
      const lastPost = posts[posts.length - 1];
      const cursor = lastPost?.created_at;
      const orderCol = activeSort === 'popular' ? 'likes_count' : activeSort === 'comments' ? 'comments_count' : 'created_at';
      let q = sb.from('posts')
        .select('id,title,content,category,created_at,likes_count,comments_count,view_count,bookmarks_count,is_pinned,is_anonymous,author_id,region_id,images,slug,excerpt,tags,stock_tags,apt_tags,profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
        .eq('is_deleted', false)
        .order(orderCol, { ascending: false })
        .limit(PAGE_SIZE);
      if (cursor && activeSort === 'latest') q = q.lt('created_at', cursor);
      if (activeCategory !== 'all' && activeCategory !== 'following') q = q.eq('category', activeCategory);
      if (activeCategory === 'local' && activeRegion !== 'all') q = q.eq('region_id', activeRegion);
      const { data } = await q;
      if (data && data.length > 0) {
        setPosts((prev: PostWithProfile[]) => [...prev, ...data as unknown as PostWithProfile[]]);
        if (data.length < PAGE_SIZE) setHasMore(false);
      } else { setHasMore(false); }
    } catch { /* ignore */ } finally { setLoadingMore(false); }
  }, [posts, loadingMore, hasMore, activeCategory, activeRegion, activeSort]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMorePosts(); }, { threshold: 0.1 });
    io.observe(node);
    return () => io.disconnect();
  }, [loadMorePosts]);

  const handleRefreshNew = () => {
    setNewCount(0);
    loadedAtRef.current = new Date().toISOString();
    router.refresh();
  };

  const buildUrl = (params: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { category: activeCategory, region: activeRegion, sort: activeSort, ...params };
    if (merged.category && merged.category !== 'all') p.set('category', merged.category);
    if (merged.region && merged.region !== 'all' && merged.category === 'local') p.set('region', merged.region);
    if (merged.sort && merged.sort !== 'latest') p.set('sort', merged.sort);
    const qs = p.toString();
    return `/feed${qs ? `?${qs}` : ''}`;
  };

  const visiblePosts = useMemo(() => {
    let filtered = activeTag
      ? posts.filter((p: PostWithProfile) => {
          const tags = p.tags;
          return tags?.includes(activeTag);
        })
      : posts;
    // 핀 글 상단 고정
    const pinned = filtered.filter((p: PostWithProfile) => p.is_pinned);
    const normal = filtered.filter((p: PostWithProfile) => !p.is_pinned);
    return [...pinned, ...normal];
  }, [posts, activeTag]);

  const categories = [
    { key: 'all',       label: '전체',    icon: '📋' },
    { key: 'stock',     label: '주식',    icon: '📊' },
    { key: 'apt',       label: '부동산',  icon: '🏢' },
    { key: 'local',     label: '우리동네',icon: '📍' },
    { key: 'free',      label: '자유',    icon: '💬' },
    { key: 'following', label: '팔로잉',  icon: '👥' },
  ];

  const sortOptions: { key: SortKey; label: string; icon: React.ReactNode }[] = [
    { key: 'latest',   label: '최신순', icon: <Clock size={12} /> },
    { key: 'popular',  label: '인기순', icon: <TrendingUp size={12} /> },
    { key: 'comments', label: '댓글순', icon: <MessageCircle size={12} /> },
  ];

  return (
    <PullToRefresh>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '4px 0' }}>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--brand)', margin: 0, letterSpacing: -0.5 }}>카더라</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/search" aria-label="검색" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
              <Search size={20} />
            </Link>
            <Link href="/profile" aria-label="프로필" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
              <User size={20} />
            </Link>
          </div>
        </div>

        {/* 실시간 활동 표시 */}
        <LiveActivityIndicator />

        <PersonalDashboard />
        <MiniWatchlist />
        <DailyReportCard />
        <WeeklyPrediction />

        {/* ━━━ 카테고리 탭 ━━━ */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'nowrap', paddingBottom: 2 }}>
          {categories.map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <button key={cat.key} aria-pressed={isActive}
                onClick={() => router.push(buildUrl({ category: cat.key, region: 'all' }))}
                style={{
                  padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
                  fontWeight: isActive ? 700 : 500, fontSize: 'var(--fs-sm)',
                  background: isActive ? 'var(--text-primary)' : 'var(--bg-surface)',
                  color: isActive ? 'var(--bg-base, #fff)' : 'var(--text-secondary)',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                <span style={{ fontSize: 13 }}>{cat.icon}</span> {cat.label}
              </button>
            );
          })}
        </div>

        {/* ━━━ 정렬 옵션 ━━━ */}
        {activeCategory !== 'following' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            {sortOptions.map(opt => {
              const isActive = activeSort === opt.key;
              return (
                <button key={opt.key}
                  onClick={() => router.push(buildUrl({ sort: opt.key }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 12px', borderRadius: 999,
                    border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-xs)', fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'var(--brand-bg, rgba(37,99,235,0.08))' : 'transparent',
                    color: isActive ? 'var(--brand)' : 'var(--text-tertiary)',
                    transition: 'all 0.15s',
                  }}>
                  {opt.icon} {opt.label}
                </button>
              );
            })}
            {activeSort === 'popular' && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginLeft: 2 }}>최근 7일</span>
            )}
          </div>
        )}

        {/* 지역 필터 */}
        {activeCategory === 'local' && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'nowrap' }}>
            {REGIONS.map(r => {
              const isActive = activeRegion === r.value || (activeRegion === 'all' && r.value === 'all');
              return (
                <button key={r.value}
                  onClick={() => router.push(buildUrl({ region: r.value }))}
                  style={{
                    padding: '5px 12px', borderRadius: 999,
                    border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                    cursor: 'pointer', flexShrink: 0, fontWeight: 600, fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                    background: isActive ? 'var(--brand)' : 'transparent',
                    color: isActive ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                  }}>
                  {r.label}
                </button>
              );
            })}
          </div>
        )}

        {/* 팔로잉 비로그인 */}
        {activeCategory === 'following' && !currentUserId && (
          <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>로그인 후 팔로잉 피드를 볼 수 있어요</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>관심 유저를 팔로우하고 맞춤 피드를 만들어 보세요</div>
            <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontWeight: 700, fontSize: 'var(--fs-sm)', textDecoration: 'none' }}>
              카카오로 로그인
            </Link>
          </div>
        )}

        {/* 해시태그 활성 필터 표시 */}
        {activeTag && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '7px 12px', background: 'var(--brand-bg, rgba(37,99,235,0.08))', borderRadius: 8, border: '1px solid var(--brand-border, rgba(37,99,235,0.15))' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', fontWeight: 700 }}>#{activeTag}</span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>태그 필터 중</span>
            <button onClick={() => setActiveTag(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 4 }}>
              ✕ 해제
            </button>
          </div>
        )}

        {/* ━━━ D: 새 글 알림 바 ━━━ */}
        {newCount > 0 && (
          <button onClick={handleRefreshNew} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 0', marginBottom: 10, borderRadius: 10,
            background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
          }}>
            ↑ 새 글 {newCount}개 올라왔어요 — 새로고침
          </button>
        )}

        {/* 글쓰기 CTA */}
        {currentUserId && (
          <Link href="/write" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
            textDecoration: 'none', color: 'inherit', marginBottom: 12,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✍️</div>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>지금 무슨 생각을 하고 계세요?</span>
          </Link>
        )}

        {/* HOT 배너 */}
        {showHotBanner && hotPosts.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14, position: 'relative' }}>
            <button onClick={() => { setShowHotBanner(false); sessionStorage.setItem('kd_hot_banner_closed', '1'); }} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-base)' }} aria-label="닫기">✕</button>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--brand)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>🔥 이번 주 인기글</div>
            {hotPosts.slice(0, 3).map((hp: Record<string, unknown>, i: number) => (
              <Link key={hp.id as number} href={`/feed/${hp.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', textDecoration: 'none', color: 'inherit', borderBottom: i < hotPosts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: i === 0 ? 'var(--brand)' : 'var(--text-tertiary)', minWidth: 18 }}>{i + 1}</span>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hp.title as string}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>♥ {hp.likes_count as number}</span>
              </Link>
            ))}
            {hotBlog && (
              <Link href={`/blog/${hotBlog.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-hover)', textDecoration: 'none', color: 'inherit', marginTop: 4 }}>
                <span style={{ fontSize: 12 }}>📰</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hotBlog.title}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>👀 {hotBlog.view_count}</span>
              </Link>
            )}
            <Link href="/hot" style={{ display: 'block', textAlign: 'center', padding: '6px 0', fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, marginTop: 4 }}>전체 보기 →</Link>
          </div>
        )}

        {/* 라운지 라이브 프리뷰 */}
        <LoungeLivePreview />

        {/* ━━━ 게시글 목록 ━━━ */}
        <div className="listing-grid">
          {visiblePosts.map((post: PostWithProfile, i: number) => {
            const postExt = post;
            const displayName = post.is_anonymous ? '익명' : (post.profiles?.nickname ?? '익명');
            const gradeEmoji = GRADE_EMOJI[post.profiles?.grade ?? 1] ?? '🌱';
            const displayLikes = likeCounts[post.id] ?? post.likes_count ?? 0;
            const isLiked = likedPosts.has(post.id as number);
            const postHref = `/feed/${post.slug || post.id}`;
            const cat = CAT_STYLE[post.category] ?? CAT_STYLE.free;
            const commentCount = post.comments_count ?? 0;
            const readMin = readingTime(post.excerpt || post.content || '');
            const postTags = (postExt.tags ?? []).filter(Boolean);
            const stockTags = (postExt.stock_tags ?? []).filter(Boolean);
            const aptTags = (postExt.apt_tags ?? []).filter(Boolean);
            const isPinned = postExt.is_pinned ?? false;
            const bookmarksCount = postExt.bookmarks_count ?? 0;

            const card = (
              <div key={post.id} className={`animate-fadeIn kd-feed-card${visitedIds.has(post.id) ? ' visited' : ''}`}
                data-cat={post.category}
                style={{ padding: '12px', background: 'var(--bg-surface)', border: `1px solid ${isPinned ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 12, transition: 'all var(--transition-fast)', position: 'relative' }}>
                {/* 핀 배지 */}
                {isPinned && (
                  <div style={{ position: 'absolute', top: -1, right: 10, background: 'var(--brand)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: '0 0 6px 6px' }}>
                    📌 고정
                  </div>
                )}

                {/* 상단: 아바타 + 메타 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Link href={post.is_anonymous ? '#' : `/profile/${post.author_id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-inverse)' }}>
                      {displayName[0].toUpperCase()}
                    </div>
                  </Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{displayName}</span>
                      <span style={{ fontSize: 11, color: gradeColor(post.profiles?.grade ?? 1) }}>{gradeEmoji}<span className="grade-title-text"> {gradeTitle(post.profiles?.grade ?? 1)}</span></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: cat.bg, color: cat.color, fontWeight: 600 }}>{cat.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(post.created_at)}</span>
                      {(post.view_count ?? 0) > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {numFmt(post.view_count ?? 0)}</span>}
                      {/* E: 읽기시간 */}
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Clock size={9} /> {readMin}분
                      </span>
                    </div>
                  </div>
                </div>

                <Link href={postHref} onClick={() => {
                  const nv = new Set(visitedIds); nv.add(post.id); setVisitedIds(nv);
                  try { const arr = Array.from(nv).slice(-200); localStorage.setItem('kd_visited', JSON.stringify(arr)); } catch {}
                }} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  {post.title && (
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.45, marginBottom: 4 }}>
                      {post.title}
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                    {stripHtml(post.excerpt || post.content).slice(0, 200)}
                  </div>
                  {/* 히어로 이미지 (1장) 또는 갤러리 (2장+) */}
                  {post.images && post.images.length === 1 && (
                    <div className="kd-hero-img">
                      <Image src={(post.images as string[])[0]} alt="게시글 이미지" fill sizes="(max-width: 780px) 100vw, 600px" style={{ objectFit: 'cover' }} loading="lazy" unoptimized={!(post.images as string[])[0].includes('supabase.co')} />
                    </div>
                  )}
                  {post.images && post.images.length > 1 && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                      {(post.images as string[]).slice(0, 3).map((img, idx) => (
                        <div key={idx} style={{ width: 70, height: 70, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-hover)', position: 'relative' }}>
                          <Image src={img} alt="게시글 이미지" fill sizes="70px" style={{ objectFit: 'cover' }} loading="lazy" unoptimized={!img.includes('supabase.co')} />
                        </div>
                      ))}
                      {post.images.length > 3 && (
                        <div style={{ width: 70, height: 70, borderRadius: 10, flexShrink: 0, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                          +{post.images.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </Link>

                {/* B: 해시태그 칩 */}
                {postTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {postTags.slice(0, 5).map((tag: string) => (
                      <button key={tag}
                        onClick={(e) => { e.preventDefault(); setActiveTag(activeTag === tag ? null : tag); }}
                        style={{
                          padding: '2px 8px', borderRadius: 999,
                          border: `1px solid ${activeTag === tag ? 'var(--brand)' : 'var(--border)'}`,
                          background: activeTag === tag ? 'var(--brand-bg, rgba(37,99,235,0.08))' : 'transparent',
                          color: activeTag === tag ? 'var(--brand)' : 'var(--text-tertiary)',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                        }}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* F: stock/apt 태그 미니 칩 */}
                {(stockTags.length > 0 || aptTags.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {stockTags.slice(0, 3).map((tag: string) => (
                      <Link key={`s-${tag}`} href="/stock"
                        style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)', color: '#38BDF8', fontSize: 10, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                        📈 {tag}
                      </Link>
                    ))}
                    {aptTags.slice(0, 3).map((tag: string) => (
                      <Link key={`a-${tag}`} href="/apt"
                        style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#2EE8A5', fontSize: 10, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                        🏢 {tag}
                      </Link>
                    ))}
                  </div>
                )}

                {/* 인터랙션 바 */}
                <div className="kd-interaction-bar" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 7, borderTop: '1px solid var(--border)' }}>
                  <PostReactions postId={post.id as number} userId={currentUserId} initialLikes={displayLikes} compact />
                  <Link href={`${postHref}#comments`} aria-label="댓글"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--bg-hover)', borderRadius: 16, padding: '4px 10px' }}>
                    <MessageCircle size={14} /> {commentCount > 0 ? numFmt(commentCount) : '댓글'}
                  </Link>
                  <button onClick={(e) => handleShare(e, post)} aria-label="공유"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-hover)', border: 'none', borderRadius: 16, cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
                    <Share2 size={14} /> 공유
                  </button>
                  {/* 북마크 카운트 */}
                  {bookmarksCount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 8px' }}>
                      🔖 {numFmt(bookmarksCount)}
                    </span>
                  )}
                  {/* 팔로우 힌트 */}
                  {activeCategory !== 'following' && !post.is_anonymous && post.author_id && post.author_id !== currentUserId && (
                    <Link href={`/profile/${post.author_id}`}
                      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'none', opacity: 0.6 }}>
                      <Users size={10} /> 팔로우
                    </Link>
                  )}
                </div>

                {/* 베스트 댓글 미리보기 */}
                {commentCount >= 3 && (
                  <BestCommentPreview postId={post.id as number} />
                )}
              </div>
            );

            const nodes: React.ReactNode[] = [card];
            if (i === 2 && currentUserId) nodes.push(<AttendanceBanner key="attend" />);
            if (i === 4 && !currentUserId) {
              nodes.push(
                <div key="signup-cta" className="kd-card-glow" style={{ padding: '24px 18px', margin: '6px 0' }}>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, var(--brand), #2EE8A5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🚀</div>
                      <div>
                        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)' }}>지금 합류하세요</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>투자자들의 실시간 대화에 참여</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6, marginBottom: 16 }}>
                      {[
                        { icon: '📈', text: '관심 종목 알림' },
                        { icon: '🏠', text: '청약 마감 알림' },
                        { icon: '💬', text: '실시간 토론' },
                        { icon: '🎁', text: '포인트 적립' },
                      ].map(f => (
                        <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.08)' }}>
                          <span style={{ fontSize: 14 }}>{f.icon}</span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>{f.text}</span>
                        </div>
                      ))}
                    </div>
                    <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="kd-btn-glow" style={{ display: 'block', textAlign: 'center', width: '100%', padding: '13px 0', borderRadius: 12, fontSize: 'var(--fs-sm)', textDecoration: 'none' }}>
                      카카오로 3초 가입
                    </Link>
                  </div>
                </div>
              );
            }
            return nodes;
          })}
        </div>

        {/* 팔로잉 빈 상태 */}
        {activeCategory === 'following' && currentUserId && visiblePosts.length === 0 && !loadingMore && (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>팔로우한 사람의 글이 없어요</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>관심 있는 유저를 팔로우해보세요</div>
            <Link href="/feed" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>전체 피드 보기</Link>
          </div>
        )}

        {/* 해시태그 필터 빈 결과 */}
        {activeTag && visiblePosts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>#{activeTag} 태그 글이 없어요</div>
            <button onClick={() => setActiveTag(null)} style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>필터 해제</button>
          </div>
        )}

        {hasMore && (
          <div ref={sentinelRef} style={{ marginTop: 8 }}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)' }}>
            모든 게시글을 읽었어요 ✓
          </div>
        )}
        {posts.length === 0 && activeCategory !== 'following' && (
          <EmptyState icon="📝" title="아직 게시글이 없어요" description="첫 번째 글의 주인공이 되어보세요" action={{ label: '글쓰기', href: '/write' }} />
        )}
      </div>
    </PullToRefresh>
  );
}
