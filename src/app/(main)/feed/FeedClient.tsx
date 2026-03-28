'use client';
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Heart, MessageCircle, Share2, Search, User } from 'lucide-react';
import type { PostWithProfile } from '@/types/database';
import { REGIONS, GRADE_EMOJI, gradeColor, gradeTitle } from '@/lib/constants';
import { getAvatarColor } from '@/lib/avatar';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { SkeletonCard } from '@/components/Skeleton';
import PullToRefresh from '@/components/PullToRefresh';
import EmptyState from '@/components/EmptyState';
import AttendanceBanner from '@/components/AttendanceBanner';
import PersonalDashboard from '@/components/PersonalDashboard';
import { timeAgo, numFmt } from '@/lib/format';
import { useAuth } from '@/components/AuthProvider';
const PAGE_SIZE = 20;

interface Props { posts: PostWithProfile[]; activeCategory: string; activeRegion?: string; }

export default function FeedClient({ posts: initialPosts, activeCategory, activeRegion = 'all' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [posts, setPosts] = useState<PostWithProfile[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialPosts.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>(() => {
    const counts: Record<number, number> = {};
    initialPosts.forEach(p => { counts[p.id] = p.likes_count ?? 0; });
    return counts;
  });
  const [showHotBanner, setShowHotBanner] = useState(false);
  const [hotPosts, setHotPosts] = useState<any[]>([]);
  const [hotBlog, setHotBlog] = useState<{slug:string;title:string;view_count:number}|null>(null);

  // Reset when initialPosts change (category/region switch)
  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialPosts.length >= PAGE_SIZE);
    // Update like counts for new posts
    const counts: Record<number, number> = {};
    initialPosts.forEach(p => { counts[p.id] = p.likes_count ?? 0; });
    setLikeCounts(counts);
  }, [initialPosts]);

  // Initialize: hot banner + hot posts + auth in single effect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowHotBanner(!sessionStorage.getItem('kd_hot_banner_closed'));
    }
    const sb = createSupabaseBrowser();
    // Hot posts
    sb.from('posts')
      .select('id,title,category,likes_count,profiles!posts_author_id_fkey(nickname)')
      .eq('is_deleted', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('likes_count', { ascending: false })
      .limit(3)
      .then(({ data }) => { if (data && data.length > 0) setHotPosts(data); });
    // Hot blog post
    sb.from('blog_posts').select('slug, title, view_count').eq('is_published', true)
      .order('view_count', { ascending: false }).limit(1).maybeSingle()
      .then(({data}) => { if (data) setHotBlog({slug: data.slug, title: data.title, view_count: data.view_count ?? 0}); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize like counts from posts data
  useEffect(() => {
    const counts: Record<number, number> = {};
    posts.forEach(p => { counts[p.id] = p.likes_count ?? 0; });
    setLikeCounts(counts);
  }, [posts]);

  const { userId: authUserId } = useAuth();

  useEffect(() => {
    if (!authUserId) return;
    setCurrentUserId(authUserId);

    const sb = createSupabaseBrowser();
    sb.from('post_likes')
      .select('post_id')
      .eq('user_id', authUserId)
      .then(({ data: likes }) => {
        if (likes) setLikedPosts(new Set(likes.map(l => l.post_id)));
      });
  }, [authUserId]);

  const handleUpvote = async (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) { router.push(`/login?redirect=${encodeURIComponent(pathname)}`); return; }

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

  const handleShare = async (e: React.MouseEvent, post: PostWithProfile) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/feed/${post.slug || post.id}`;
    let platform = 'clipboard';
    if (navigator.share) {
      try { await navigator.share({ title: post.title, url }); platform = 'native'; } catch { return; }
    } else {
      try { await navigator.clipboard.writeText(url); } catch {}
    }
    // 공유 로그 + 포인트 적립
    fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: post.id, platform }) }).catch(() => {});
  };

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const sb = createSupabaseBrowser();
      // cursor 기반 페이지네이션 — offset보다 안전 (새 글 추가 시 중복 방지)
      const lastPost = posts[posts.length - 1];
      const cursor = lastPost?.created_at;
      let q = sb.from('posts')
        .select('id,title,content,category,created_at,likes_count,comments_count,view_count,is_anonymous,author_id,region_id,images,slug,excerpt, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (cursor) q = q.lt('created_at', cursor);
      if (activeCategory !== 'all') q = q.eq('category', activeCategory);
      if (activeCategory === 'local' && activeRegion !== 'all') q = q.eq('region_id', activeRegion);
      const { data } = await q;
      if (data && data.length > 0) {
        setPosts(prev => [...prev, ...data as PostWithProfile[]]);
        if (data.length < PAGE_SIZE) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (e) { if (process.env.NODE_ENV === 'development') console.warn('[FeedClient.loadMore]', e); } finally {
      setLoadingMore(false);
    }
  }, [posts, loadingMore, hasMore, activeCategory, activeRegion]);

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
    { key: 'all', label: '전체', icon: '📋' },
    { key: 'stock', label: '주식', icon: '📊' },
    { key: 'apt', label: '부동산', icon: '🏢' },
    { key: 'local', label: '우리동네', icon: '📍' },
    { key: 'free', label: '자유', icon: '💬' },
  ];
  const visiblePosts = posts;

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

      {/* 개인화 대시보드 */}
      <PersonalDashboard />

      {/* 카테고리 pill 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'nowrap', paddingBottom: 2 }}>
        {categories.map(cat => {
          const isActive = activeCategory === cat.key;
          return (
            <button key={cat.key} aria-pressed={isActive}
              onClick={() => router.push(`/feed${cat.key !== 'all' ? `?category=${cat.key}` : ''}`)}
              style={{
                padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
                fontWeight: isActive ? 700 : 500, fontSize: 'var(--fs-sm)',
                background: isActive ? 'var(--text-primary)' : 'var(--bg-surface)',
                color: isActive ? 'var(--bg-base, #fff)' : 'var(--text-secondary)',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
              {cat.icon} {cat.label}
            </button>
          );
        })}
      </div>

      {/* 지역 필터 (우리동네만) */}
      {activeCategory === 'local' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'nowrap' }}>
          {REGIONS.map(r => {
            const isActive = activeRegion === r.value || (activeRegion === 'all' && r.value === 'all');
            return (
              <button key={r.value}
                onClick={() => router.push(`/feed${r.value === 'all' ? '?category=local' : `?category=local&region=${r.value}`}`)}
                style={{
                  padding: '5px 12px', borderRadius: 999, border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`, cursor: 'pointer', flexShrink: 0,
                  fontWeight: 600, fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                  background: isActive ? 'var(--brand)' : 'transparent',
                  color: isActive ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                }}>
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 글쓰기 CTA */}
      {currentUserId && (
        <Link href="/write" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
          textDecoration: 'none', color: 'inherit', marginBottom: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--brand)', fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}>✍️</div>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            지금 무슨 생각을 하고 계세요?
          </span>
        </Link>
      )}

      {/* 🔥 이번 주 인기글 (간결하게 3개만) */}
      {showHotBanner && hotPosts.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14, position: 'relative' }}>
          <button onClick={() => { setShowHotBanner(false); sessionStorage.setItem('kd_hot_banner_closed', '1'); }} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-base)' }} aria-label="닫기">✕</button>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--brand)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>🔥 이번 주 인기글</div>
          {hotPosts.slice(0, 3).map((hp: Record<string, any>, i: number) => (
            <Link key={hp.id} href={`/feed/${hp.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', textDecoration: 'none', color: 'inherit', borderBottom: i < hotPosts.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: i === 0 ? 'var(--brand)' : 'var(--text-tertiary)', minWidth: 18 }}>{i + 1}</span>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hp.title}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>♥ {hp.likes_count}</span>
            </Link>
          ))}
          {hotBlog && (
            <Link href={`/blog/${hotBlog.slug}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8,
              background: 'var(--bg-hover)', textDecoration: 'none', color: 'inherit', marginTop: 4,
            }}>
              <span style={{ fontSize: 12 }}>📰</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hotBlog.title}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>👀 {hotBlog.view_count}</span>
            </Link>
          )}
          <Link href="/hot" style={{ display: 'block', textAlign: 'center', padding: '6px 0', fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, marginTop: 4 }}>전체 보기 →</Link>
        </div>
      )}

      {/* 게시글 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visiblePosts.map((post) => {
          const displayName = post.is_anonymous ? '익명' : (post.profiles?.nickname ?? '익명');
          const gradeEmoji = GRADE_EMOJI[post.profiles?.grade ?? 1] ?? '🌱';
          const displayLikes = likeCounts[post.id] ?? post.likes_count ?? 0;
          const isLiked = likedPosts.has(post.id as number);
          const postHref = `/feed/${post.slug || post.id}`;
          const cat = { apt: { label: '부동산', color: '#2EE8A5', bg: 'rgba(52,211,153,0.1)' }, stock: { label: '주식', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' }, local: { label: '우리동네', color: '#FFD43B', bg: 'rgba(251,191,36,0.1)' }, free: { label: '자유', color: '#B794FF', bg: 'rgba(167,139,250,0.1)' } }[post.category] || { label: '자유', color: '#B794FF', bg: 'rgba(167,139,250,0.1)' };
          const commentCount = post.comments_count ?? 0;
          return (
            <div key={post.id} className="animate-fadeIn kd-feed-card"
              style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, transition: 'all var(--transition-fast)' }}>
              {/* 상단: 아바타 + 닉네임 + 등급 + 카테고리 + 시간 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Link href={post.is_anonymous ? '#' : `/profile/${post.author_id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: getAvatarColor(displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-inverse)' }}>
                    {displayName[0].toUpperCase()}
                  </div>
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{displayName}</span>
                    <span style={{ fontSize: 11, color: gradeColor(post.profiles?.grade ?? 1) }}>{gradeEmoji}<span className="grade-title-text"> {gradeTitle(post.profiles?.grade ?? 1)}</span></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: cat.bg, color: cat.color, fontWeight: 600 }}>{cat.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(post.created_at)}</span>
                    {(post.view_count ?? 0) > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {numFmt(post.view_count ?? 0)}</span>}
                  </div>
                </div>
              </div>

              <Link href={postHref} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                {/* 제목 */}
                {post.title && (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.45, marginBottom: 4 }}>
                    {post.title}
                  </div>
                )}
                {/* 본문 미리보기 */}
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                  {post.excerpt || post.content}
                </div>
                {/* 이미지 썸네일 */}
                {post.images && post.images.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {(post.images as string[]).slice(0, 3).map((img: string, i: number) => (
                      <div key={i} style={{ width: 90, height: 90, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-hover)', position: 'relative' }}>
                        <Image src={img} alt="게시글 이미지" fill sizes="90px" style={{ objectFit: 'cover' }} loading="lazy" unoptimized={!img.includes('supabase.co')} />
                      </div>
                    ))}
                    {post.images.length > 3 && (
                      <div style={{ width: 90, height: 90, borderRadius: 10, flexShrink: 0, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        +{post.images.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </Link>

              {/* 인터랙션 바: 좋아요 + 댓글 + 공유 */}
              <div className="kd-interaction-bar" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 7, borderTop: '1px solid var(--border)' }}>
                <button onClick={(e) => handleUpvote(e, post.id as number)}
                  aria-label="좋아요"
                  className={isLiked ? 'animate-like' : ''}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: isLiked ? 'rgba(239,68,68,0.08)' : 'var(--bg-hover)', border: 'none', borderRadius: 16, cursor: 'pointer', fontSize: 11, color: isLiked ? 'var(--accent-red)' : 'var(--text-tertiary)', fontWeight: 600, fontFamily: 'inherit', padding: '4px 10px', transition: 'all var(--transition-fast)' }}>
                  <Heart size={14} fill={isLiked ? 'var(--accent-red)' : 'none'} stroke={isLiked ? 'var(--accent-red)' : 'currentColor'} /> {displayLikes > 0 ? numFmt(displayLikes) : '좋아요'}
                </button>
                <Link href={`${postHref}#comments`} aria-label="댓글"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--bg-hover)', borderRadius: 16, padding: '4px 10px' }}>
                  <MessageCircle size={14} /> {commentCount > 0 ? numFmt(commentCount) : '댓글'}
                </Link>
                <button onClick={(e) => handleShare(e, post)}
                  aria-label="공유"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-hover)', border: 'none', borderRadius: 16, cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
                  <Share2 size={14} /> 공유
                </button>
              </div>
            </div>
          );
        }).reduce((acc: React.ReactNode[], card, i) => {
          acc.push(card);
          // 3번째 카드 뒤 출석체크
          if (i === 2 && currentUserId) {
            acc.push(<AttendanceBanner key="attend" />);
          }
          // 비로그인 시 5번째 카드 뒤 가입 유도 배너
          if (i === 4 && !currentUserId) {
            acc.push(
              <div key="signup-cta" style={{ padding: '20px 16px', margin: '4px 0', background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--brand-bg, rgba(37,99,235,0.06)) 100%)', border: '1px solid var(--brand-border, rgba(37,99,235,0.15))', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💬</div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>대화에 참여해보세요</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>다른 투자자들과 함께하세요</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {['관심 종목 알림', '청약 마감 알림', '댓글 참여', '포인트 적립'].map(f => (
                    <span key={f} style={{ fontSize: 'var(--fs-xs)', padding: '3px 10px', borderRadius: 20, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 600 }}>{f}</span>
                  ))}
                </div>
                <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ display: 'block', textAlign: 'center', padding: '11px 0', borderRadius: 12, background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontWeight: 700, fontSize: 'var(--fs-sm)', textDecoration: 'none' }}>
                  카카오로 3초 가입
                </Link>
              </div>
            );
          }
          return acc;
        }, [])}
      </div>

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
      {posts.length === 0 && (
        <EmptyState icon="📝" title="아직 게시글이 없어요" description="첫 번째 글의 주인공이 되어보세요" action={{ label: "글쓰기", href: "/write" }} />
      )}
      {visiblePosts.length === 0 && !loadingMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
            아직 이 카테고리에 글이 없어요
          </div>
          <div style={{ fontSize: 'var(--fs-sm)' }}>첫 글을 작성해보세요!</div>
          {currentUserId && (
            <Link href="/write" style={{
              display: 'inline-block', marginTop: 12, padding: '8px 20px', borderRadius: 8,
              background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13,
              textDecoration: 'none',
            }}>글쓰기</Link>
          )}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
