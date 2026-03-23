'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Share2, Search, User } from 'lucide-react';
import type { PostWithProfile } from '@/types/database';
import { REGIONS, GRADE_EMOJI, gradeColor, gradeTitle } from '@/lib/constants';
import { getAvatarColor } from '@/lib/avatar';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import PullToRefresh from '@/components/PullToRefresh';
import EmptyState from '@/components/shared/EmptyState';
import PushNudgeBanner from '@/components/PushNudgeBanner';
import TrendingBar from '@/components/TrendingBar';
import AttendanceBanner from '@/components/AttendanceBanner';
import PersonalDashboard from '@/components/PersonalDashboard';

function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return '';
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

  const handleShare = async (e: React.MouseEvent, post: PostWithProfile) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/feed/${(post as any).slug || post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); } catch {}
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
    } catch (e) { if (process.env.NODE_ENV === 'development') console.warn('[FeedClient.loadMore]', e); } finally {
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
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
                  padding: '5px 12px', borderRadius: 999, border: `1px solid ${isActive ? '#2563EB' : 'var(--border)'}`, cursor: 'pointer', flexShrink: 0,
                  fontWeight: 600, fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                  background: isActive ? '#2563EB' : 'transparent',
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
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 'var(--fs-base)', fontWeight: 700 }}>+</div>
          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-tertiary)' }}>무슨 소문이 있나요?</span>
        </Link>
      )}

      {/* 가이드북 배너 */}
      {!currentUserId && (
        <Link href="/guide" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(96,165,250,0.08) 100%)',
          border: '1px solid rgba(167,139,250,0.15)', borderRadius: 12,
          textDecoration: 'none', marginBottom: 10,
        }}>
          <span style={{ fontSize: 'var(--fs-lg)' }}>📖</span>
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>카더라 처음이신가요?</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>가이드북에서 활용법을 확인하세요</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>→</span>
        </Link>
      )}

      {/* 트렌딩 */}
      <TrendingBar />

      {/* 🔥 실시간 인기글 */}
      {showHotBanner && hotPosts.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14, position: 'relative' }}>
          <button onClick={() => { setShowHotBanner(false); sessionStorage.setItem('kd_hot_banner_closed', '1'); }} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-base)' }}>✕</button>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--brand)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>🔥 이번 주 인기글</div>
          {hotPosts.map((hp: any, i: number) => (
            <Link key={hp.id} href={`/feed/${hp.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', textDecoration: 'none', color: 'inherit', borderBottom: i < hotPosts.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: i === 0 ? 'var(--brand)' : 'var(--text-tertiary)', minWidth: 18 }}>{i + 1}</span>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hp.title}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>♥ {hp.likes_count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 출석체크 */}
      <AttendanceBanner />

      {/* 게시글 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visiblePosts.map((post) => {
          const displayName = post.is_anonymous ? '익명' : (post.profiles?.nickname ?? '익명');
          const gradeEmoji = GRADE_EMOJI[post.profiles?.grade ?? 1] ?? '🌱';
          const displayLikes = likeCounts[post.id] ?? post.likes_count ?? 0;
          const isLiked = likedPosts.has(post.id as number);
          const postHref = `/feed/${(post as any).slug || post.id}`;
          return (
            <div key={post.id} className="animate-fadeIn"
              style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <Link href={postHref} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                {/* 1행: 아바타 + 닉네임 + 등급 + 시간 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: getAvatarColor(displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#fff' }}>
                    {displayName[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }}>{displayName}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: gradeColor(post.profiles?.grade ?? 1) }}>{gradeEmoji}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: gradeColor(post.profiles?.grade ?? 1), fontWeight: 600 }}>{gradeTitle(post.profiles?.grade ?? 1)}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>· {timeAgo(post.created_at)}</span>
                </div>

                {/* 본문: 제목 + 본문 2줄 */}
                {post.title && (
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 2 }}>
                    {post.title}
                  </div>
                )}
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                  {(post as any).excerpt || post.content}
                </div>
                {/* 이미지 썸네일 */}
                {(post as any).images && (post as any).images.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {((post as any).images as string[]).slice(0, 3).map((img: string, i: number) => (
                      <div key={i} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-hover)', position: 'relative' }}>
                        <Image src={img} alt="게시글 이미지" fill sizes="80px" style={{ objectFit: 'cover' }} loading="lazy" unoptimized={!img.includes('supabase.co')} />
                      </div>
                    ))}
                    {(post as any).images.length > 3 && (
                      <div style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        +{(post as any).images.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </Link>

              {/* 인터랙션: 좋아요 + 댓글 + 공유 (3개만) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
                <button onClick={(e) => handleUpvote(e, post.id as number)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: isLiked ? 'var(--accent-red)' : 'var(--text-tertiary)', fontWeight: isLiked ? 600 : 400, fontFamily: 'inherit', padding: 0 }}>
                  <Heart size={18} fill={isLiked ? 'var(--accent-red)' : 'none'} stroke={isLiked ? 'var(--accent-red)' : 'currentColor'} /> {displayLikes > 0 ? numFmt(displayLikes) : ''}
                </button>
                <Link href={`${postHref}#comments`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', padding: 0 }}>
                  <MessageCircle size={18} /> {(post.comments_count ?? 0) > 0 ? numFmt(post.comments_count ?? 0) : ''}
                </Link>
                <button onClick={(e) => handleShare(e, post)}
                  style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
                  <Share2 size={18} />
                </button>
              </div>
            </div>
          );
        }).reduce((acc: React.ReactNode[], card, i) => {
          acc.push(card);
          // 비로그인 시 5번째 카드 뒤 가입 유도 배너
          if (i === 4 && !currentUserId) {
            acc.push(
              <div key="signup-cta" style={{ padding: '20px 16px', margin: '8px 0', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>카더라 회원이 되면</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 16 }}>
                  관심 종목 알림 · 청약 마감 알림<br />글 전문 보기 · 댓글 참여 · 포인트 적립
                </div>
                <Link href="/login" style={{ display: 'inline-block', padding: '10px 32px', borderRadius: 12, background: '#FEE500', color: '#191919', fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none' }}>
                  카카오로 3초 가입
                </Link>
              </div>
            );
          }
          return acc;
        }, [])}
      </div>

      {hasMore && (
        <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>불러오는 중...</span>
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)' }}>
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
