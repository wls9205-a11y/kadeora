'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Eye, Bookmark, Search, User } from 'lucide-react';
import type { PostWithProfile } from '@/types/database';
import { REGIONS, GRADE_EMOJI } from '@/lib/constants';
import { getAvatarColor } from '@/lib/avatar';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import PullToRefresh from '@/components/PullToRefresh';
import EmptyState from '@/components/shared/EmptyState';
import PushNudgeBanner from '@/components/PushNudgeBanner';
import TrendingBar from '@/components/TrendingBar';
import AttendanceBanner from '@/components/AttendanceBanner';
import ShareButtons from '@/components/ShareButtons';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
function numFmt(n: number) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

const PAGE_SIZE = 20;

interface Props { posts: PostWithProfile[]; activeCategory: string; activeRegion?: string; }

export default function FeedClient({ posts: initialPosts, activeCategory, activeRegion = 'all' }: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostWithProfile[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialPosts.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showRegionBanner, setShowRegionBanner] = useState(false);
  const [tipSeen, setTipSeen] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<number>>(new Set());
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [showHotBanner, setShowHotBanner] = useState(false);
  const [hotPosts, setHotPosts] = useState<any[]>([]);

  // Reset when initialPosts change (category/region switch)
  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialPosts.length >= PAGE_SIZE);
  }, [initialPosts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTipSeen(!!localStorage.getItem('kd_tip_seen'));
      setShowHotBanner(!sessionStorage.getItem('kd_hot_banner_closed'));
    }
  }, []);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.from('posts')
      .select('id,title,category,likes_count,profiles!posts_author_id_fkey(nickname)')
      .eq('is_deleted', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('likes_count', { ascending: false })
      .limit(3)
      .then(({ data }) => { if (data && data.length > 0) setHotPosts(data); });
  }, []);

  // Initialize like counts from posts data
  useEffect(() => {
    const counts: Record<number, number> = {};
    posts.forEach(p => { counts[p.id] = p.likes_count ?? 0; });
    setLikeCounts(counts);
  }, [posts]);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const userId = data.session.user.id;
        setCurrentUserId(userId);

        const { data: profile } = await sb.from('profiles')
          .select('region_text').eq('id', userId).single();
        if (profile && !profile.region_text) setShowRegionBanner(true);
        if (profile?.region_text) {
          const matched = REGIONS.find(r => r.value !== 'all' && profile.region_text.startsWith(r.value));
          if (matched) setUserRegion(matched.value);
        }

        // Load user's liked posts
        const { data: likes } = await sb.from('post_likes')
          .select('post_id')
          .eq('user_id', userId);
        if (likes) setLikedPosts(new Set(likes.map(l => l.post_id)));

        // Load user's bookmarks
        const postIds = posts.map(p => p.id);
        if (postIds.length > 0) {
          const res = await fetch(`/api/bookmarks?postIds=${postIds.join(',')}`).catch(() => null);
          if (res?.ok) {
            const d = await res.json().catch(() => null);
            if (d?.bookmarkedIds) setBookmarkedPosts(new Set(d.bookmarkedIds));
          }
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 초기 로드 1회만

  const handleUpvote = async (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) { router.push('/login'); return; }

    const alreadyLiked = likedPosts.has(postId);

    // Optimistic update
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(postId); else next.add(postId);
      return next;
    });
    setLikeCounts(prev => ({
      ...prev,
      [postId]: (prev[postId] ?? 0) + (alreadyLiked ? -1 : 1),
    }));

    // API 호출 (DB 트리거가 likes_count 자동 관리)
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      if (!res.ok) {
        // Revert on failure
        setLikedPosts(prev => {
          const next = new Set(prev);
          if (alreadyLiked) next.add(postId); else next.delete(postId);
          return next;
        });
        setLikeCounts(prev => ({
          ...prev,
          [postId]: (prev[postId] ?? 0) + (alreadyLiked ? 1 : -1),
        }));
      }
    } catch {
      // Revert on error
      setLikedPosts(prev => {
        const next = new Set(prev);
        if (alreadyLiked) next.add(postId); else next.delete(postId);
        return next;
      });
      setLikeCounts(prev => ({
        ...prev,
        [postId]: (prev[postId] ?? 0) + (alreadyLiked ? 1 : -1),
      }));
    }
  };

  const handleBookmark = async (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) { router.push('/login'); return; }

    const alreadyBookmarked = bookmarkedPosts.has(postId);
    // Optimistic update
    setBookmarkedPosts(prev => {
      const next = new Set(prev);
      if (alreadyBookmarked) next.delete(postId); else next.add(postId);
      return next;
    });

    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        // Revert
        setBookmarkedPosts(prev => {
          const next = new Set(prev);
          if (alreadyBookmarked) next.add(postId); else next.delete(postId);
          return next;
        });
      }
    } catch {
      // Revert
      setBookmarkedPosts(prev => {
        const next = new Set(prev);
        if (alreadyBookmarked) next.add(postId); else next.delete(postId);
        return next;
      });
    }
  };

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const sb = createSupabaseBrowser();
      let q = sb.from('posts')
        .select('id,title,content,category,created_at,likes_count,comments_count,view_count,is_anonymous,author_id,region_id,images, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(posts.length, posts.length + PAGE_SIZE - 1);
      if (activeCategory !== 'all') q = q.eq('category', activeCategory);
      if (activeCategory === 'local' && activeRegion !== 'all') q = q.eq('region_id', activeRegion);
      const { data } = await q;
      if (data && data.length > 0) {
        setPosts(prev => [...prev, ...data as PostWithProfile[]]);
        if (data.length < PAGE_SIZE) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch {} finally {
      setLoadingMore(false);
    }
  }, [posts.length, loadingMore, hasMore, activeCategory, activeRegion]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMorePosts(); },
      { threshold: 0.1 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loadMorePosts]);

  const categories = [
    { key: 'all', label: '전체' }, { key: 'stock', label: '주식' },
    { key: 'apt', label: '부동산' }, { key: 'local', label: '우리동네' }, { key: 'free', label: '자유' },
  ];
  const visiblePosts = posts;

  return (
    <PullToRefresh>
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '4px 0' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--brand)', margin: 0, letterSpacing: -0.5 }}>카더라</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/search" aria-label="검색" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            <Search size={20} />
          </Link>
          <Link href="/profile" aria-label="프로필" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            <User size={20} />
          </Link>
        </div>
      </div>

      {/* 카테고리 pill 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
        {categories.map(cat => {
          const isActive = activeCategory === cat.key;
          return (
            <button key={cat.key} aria-pressed={isActive}
              onClick={() => router.push(`/feed${cat.key !== 'all' ? `?category=${cat.key}` : ''}`)}
              style={{
                padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
                fontWeight: isActive ? 700 : 500, fontSize: 13,
                background: isActive ? 'var(--text-primary)' : 'var(--bg-surface)',
                color: isActive ? 'var(--bg-base, #fff)' : 'var(--text-secondary)',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 지역 필터 (우리동네만) */}
      {activeCategory === 'local' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', flexWrap: 'nowrap' }}>
          {REGIONS.map(r => {
            const isActive = activeRegion === r.value || (activeRegion === 'all' && r.value === 'all');
            return (
              <button key={r.value}
                onClick={() => router.push(`/feed${r.value === 'all' ? '?category=local' : `?category=local&region=${r.value}`}`)}
                style={{
                  padding: '5px 12px', borderRadius: 999, border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`, cursor: 'pointer', flexShrink: 0,
                  fontWeight: 600, fontSize: 11, fontFamily: 'inherit',
                  background: isActive ? 'var(--brand)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                }}>
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 글쓰기 프롬프트 */}
      {currentUserId && (
        <Link href="/write" style={{
          display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 16, textDecoration: 'none', marginBottom: 14,
        }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700 }}>+</div>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>무슨 소문이 있나요?</span>
        </Link>
      )}

      {/* 트렌딩 */}
      <TrendingBar />

      {/* 게시글 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visiblePosts.map((post) => {
          const catColors: Record<string, {bg: string; color: string; label: string}> = {
            apt: { bg: '#3b82f620', color: '#3b82f6', label: '부동산' },
            stock: { bg: '#ef444420', color: '#ef4444', label: '주식' },
            local: { bg: '#10b98120', color: '#10b981', label: '우리동네' },
            free: { bg: '#8b5cf620', color: '#8b5cf6', label: '자유' },
          };
          const catInfo = catColors[post.category] ?? null;
          const displayName = post.is_anonymous ? '익명' : (post.profiles?.nickname ?? '익명');
          const gradeEmoji = GRADE_EMOJI[post.profiles?.grade ?? 1] ?? '🌱';
          const displayLikes = likeCounts[post.id] ?? post.likes_count ?? 0;
          const isLiked = likedPosts.has(post.id as number);
          const hasImages = post.images && post.images.length > 0;
          const isNew = Date.now() - new Date(post.created_at).getTime() < 60 * 60 * 1000;
          const postHref = `/feed/${(post as any).slug || post.id}`;
          return (
            <div key={post.id} className="animate-fadeIn"
              style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              {/* Clickable area — navigates to post detail */}
              <Link href={postHref} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
                  {post.profiles?.avatar_url ? (
                    <Image src={`${post.profiles.avatar_url}?width=80&height=80`} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: getAvatarColor(displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {displayName[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{displayName}</span>
                      <span style={{ fontSize: 12 }}>{gradeEmoji}</span>
                      {catInfo && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: catInfo.bg, color: catInfo.color }}>{catInfo.label}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(post.created_at)}</span>
                      {isNew && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />}
                    </div>
                  </div>
                </div>

                {/* Content area — text left, thumbnail right */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {post.title}
                    </h2>
                    <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                      {post.content}
                    </p>
                  </div>
                  {hasImages && (
                    <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'var(--bg-hover)' }}>
                      <Image src={post.images![0]} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} />
                      {post.images!.length > 1 && (
                        <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>+{post.images!.length - 1}</div>
                      )}
                    </div>
                  )}
                </div>
              </Link>

              {/* Interaction bar — OUTSIDE Link to prevent navigation on click */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <button onClick={(e) => handleUpvote(e, post.id as number)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 16, border: 'none', background: isLiked ? '#ff444412' : 'transparent', cursor: 'pointer', fontSize: 12, color: isLiked ? '#ef4444' : 'var(--text-tertiary)', fontWeight: isLiked ? 700 : 400, fontFamily: 'inherit' }}>
                  <Heart size={14} fill={isLiked ? '#ef4444' : 'none'} stroke={isLiked ? '#ef4444' : 'currentColor'} /> {numFmt(displayLikes)}
                </button>
                <Link href={`${postHref}#comments`}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 16, textDecoration: 'none', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <MessageCircle size={14} /> {numFmt(post.comments_count ?? 0)}
                </Link>
                {(post.view_count ?? 0) > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <Eye size={14} /> {numFmt(post.view_count ?? 0)}
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={(e) => handleBookmark(e, post.id as number)}
                  style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', border: 'none', background: 'transparent', cursor: 'pointer', color: bookmarkedPosts.has(post.id as number) ? 'var(--brand)' : 'var(--text-tertiary)' }}>
                  <Bookmark size={14} fill={bookmarkedPosts.has(post.id as number) ? 'var(--brand)' : 'none'} />
                </button>
                <ShareButtons title={post.title} postId={post.id} content={post.content} />
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>불러오는 중...</span>
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
          모든 게시글을 읽었어요 ✓
        </div>
      )}
      {posts.length === 0 && (
        <EmptyState icon="📝" title="아직 게시글이 없어요" description="첫 번째 글의 주인공이 되어보세요" actionLabel="글쓰기" actionHref="/write" />
      )}
    </div>
    </PullToRefresh>
  );
}
