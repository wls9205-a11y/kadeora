'use client';
import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { PostWithProfile, TrendingKeyword } from '@/types/database';
import { REGIONS } from '@/lib/constants';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import PullToRefresh from '@/components/PullToRefresh';
import PushNudgeBanner from '@/components/PushNudgeBanner';
import TrendingBar from '@/components/TrendingBar';
import AttendanceBanner from '@/components/AttendanceBanner';

const GRADE_EMOJI: Record<number, string> = {1:'🌱',2:'🌿',3:'🍀',4:'🌸',5:'🌻',6:'⭐',7:'🔥',8:'💎',9:'👑',10:'🚀'};

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

interface Props { posts: PostWithProfile[]; trending: TrendingKeyword[]; activeCategory: string; activeRegion?: string; }

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
  }, [posts]);

  const handleUpvote = async (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) { router.push('/login'); return; }

    const sb = createSupabaseBrowser();
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

    if (alreadyLiked) {
      await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUserId);
    } else {
      await sb.from('post_likes').insert({ post_id: postId, user_id: currentUserId });
    }
  };

  const handleComment = (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/feed/${postId}#comments`);
  };

  const handleShare = async (e: React.MouseEvent, post: PostWithProfile) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/feed/${post.id}`;

    // Try Kakao Share first
    if (typeof window !== 'undefined' && (window as any).Kakao?.Share) {
      try {
        (window as any).Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: post.title,
            description: (post.content || '').slice(0, 100),
            imageUrl: 'https://kadeora.app/og-image.svg',
            link: { mobileWebUrl: url, webUrl: url },
          },
        });
        return;
      } catch {}
    }

    // Try Web Share API
    if (navigator.share) {
      try { await navigator.share({ title: post.title, url }); return; } catch {}
    }

    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(url);
      alert('링크가 복사되었습니다!');
    } catch {}
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

  const observerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMorePosts(); },
      { threshold: 0.1 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loadMorePosts]);

  const categories = [
    { key: 'all', label: '전체' }, { key: 'local', label: '📍 우리동네' },
    { key: 'stock', label: '📊 주식' }, { key: 'apt', label: '🏢 부동산' }, { key: 'free', label: '✏️ 자유' },
  ];
  const visiblePosts = posts;

  return (
    <PullToRefresh>
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 피드 헤더 */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>피드</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/guide" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 20,
            border: '1px solid var(--border)', background: 'var(--bg-surface)',
            color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}>📖 가이드</Link>
          <button onClick={() => router.push('/search')} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '6px 14px', fontSize: 13,
            color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
          }}>🔍 검색</button>
        </div>
      </div>

      {/* 글쓰기 프롬프트 */}
      {currentUserId && (
        <a href="/write" style={{ display:'flex', gap:10, alignItems:'center', padding:'12px 0', borderBottom:'1px solid var(--border)', textDecoration:'none', marginBottom:4 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--brand)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, fontWeight:800 }}>✏</div>
          <div style={{ flex:1, background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:20, padding:'10px 16px', fontSize:14, color:'var(--text-tertiary)' }}>무슨 소문이 있나요?</div>
        </a>
      )}

      {/* 지역 미설정 배너 */}
      {showRegionBanner && (
        <div style={{
          background:'var(--brand)', color:'var(--text-inverse)',
          padding:'10px 16px', borderRadius:4, marginBottom:10,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          fontSize:13, fontWeight:600,
        }}>
          <span>📍 지역을 설정하면 우리동네 소식을 볼 수 있어요!</span>
          <a href="/onboarding" style={{
            color:'var(--text-inverse)', textDecoration:'underline', fontWeight:700, marginLeft:8,
          }}>설정하기</a>
        </div>
      )}

      {/* 안내 배너 */}
      {!tipSeen && (
        <div style={{
          background:'var(--bg-surface)', border:'1px solid var(--border)',
          borderRadius:8, padding:'10px 14px', marginBottom:8,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          fontSize:13, color:'var(--text-secondary)',
        }}>
          <span style={{ whiteSpace:'nowrap' }}>💡 ▲ 숫자를 클릭하면 좋은 글에 투표할 수 있어요!</span>
          <button onClick={() => { setTipSeen(true); localStorage.setItem('kd_tip_seen','1'); }}
            aria-label="닫기"
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)', fontSize:16, flexShrink:0, marginLeft:8 }}>✕</button>
        </div>
      )}

      {/* 알림 설정 유도 */}
      <PushNudgeBanner />

      {/* 출석체크 배너 */}
      {currentUserId && <AttendanceBanner />}

      {/* 트렌딩 키워드 */}
      <TrendingBar />

      {/* 이번주 HOT */}
      {hotPosts.length > 0 && (() => {
        return (
          <div style={{ marginBottom: 16, borderRadius: 16, background: 'linear-gradient(160deg, rgba(255,69,0,0.1) 0%, rgba(20,20,20,0) 60%)', border: '1px solid rgba(255,69,0,0.2)', overflow: 'hidden' }}>
            {/* 헤더 */}
            <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18, display: 'inline-block', animation: 'hotFlame 1.5s ease-in-out infinite' }}>🔥</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>이번주 HOT</span>
              </div>
              <Link href="/hot" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none' }}>더보기 →</Link>
            </div>

            {/* Uniform ranking list */}
            <div style={{ padding: '0 12px 12px' }}>
              {hotPosts.slice(0, 5).map((hp: any, i: number) => {
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                return (
                  <Link key={hp.id} href={`/feed/${(hp as any).slug || hp.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < Math.min(hotPosts.length, 5) - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}>
                    <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{medals[i]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hp.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{(hp.profiles as any)?.nickname ?? '익명'}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700, flexShrink: 0 }}>❤ {hp.likes_count ?? 0}</span>
                  </Link>
                );
              })}
            </div>

            <style>{`@keyframes hotFlame { 0%,100% { transform: scale(1) rotate(-3deg); } 50% { transform: scale(1.3) rotate(3deg); } }`}</style>
          </div>
        );
      })()}

      {/* 카테고리 바 */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 10,
        flexWrap: 'nowrap', overflowX: 'auto',
      }}>
        {categories.map(cat => {
          const isActive = activeCategory === cat.key;
          return (
            <button key={cat.key} aria-pressed={isActive}
              onClick={() => router.push(`/feed${cat.key !== 'all' ? `?category=${cat.key}` : ''}`)}
              style={{
                padding: '10px 16px', border: 'none', cursor: 'pointer', flexShrink: 0,
                fontWeight: isActive ? 700 : 500, fontSize: 14,
                background: 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                transition: 'all 0.1s',
                fontFamily: 'inherit',
              }}>
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 지역 탭 (우리동네 카테고리일 때만) */}
      {activeCategory === 'local' && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '6px 8px', display: 'flex', gap: 3, marginBottom: 10,
          flexWrap: 'nowrap', overflowX: 'auto',
        }}>
          {REGIONS.map(r => {
            const isActive = activeRegion === r.value || (activeRegion === 'all' && r.value === 'all');
            return (
              <button key={r.value}
                onClick={() => {
                  const params = r.value === 'all' ? '?category=local' : `?category=local&region=${r.value}`;
                  router.push(`/feed${params}`);
                }}
                style={{
                  padding: '5px 10px', borderRadius: 2, border: 'none', cursor: 'pointer', flexShrink: 0,
                  fontWeight: 600, fontSize: 12,
                  background: isActive ? 'var(--brand)' : 'transparent',
                  color: isActive ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                  transition: 'all 0.1s',
                }}>
                {r.label}
              </button>
            );
          })}
        </div>
      )}

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
          const gradeEmoji = GRADE_EMOJI[post.profiles?.grade ?? 1] ?? '🌱';
          const displayLikes = likeCounts[post.id] ?? post.likes_count ?? 0;
          return (
            <Link key={post.id} href={`/feed/${(post as any).slug || post.id}`} className="animate-fadeIn"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 6 }}>
                {post.profiles?.avatar_url ? (
                  <Image src={`${post.profiles.avatar_url}?width=80&height=80`} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-inverse, #fff)' }}>
                    {(post.profiles?.nickname ?? 'U')[0].toUpperCase()}
                  </div>
                )}
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{post.profiles?.nickname ?? '익명'}</span>
                <span>{gradeEmoji}</span>
                {catInfo && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: catInfo.bg, color: catInfo.color }}>{catInfo.label}</span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{timeAgo(post.created_at)}</span>
              </div>
              {/* Title */}
              <h2 style={{ margin: '0 0 5px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {post.title}
              </h2>
              {/* Content preview */}
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
                {post.content}
              </p>
              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-tertiary)' }}>
                <span>🤍 {numFmt(displayLikes)}</span>
                <span>💬 {numFmt(post.comments_count ?? 0)}</span>
                {(post.view_count ?? 0) > 0 && <span>조회 {numFmt(post.view_count ?? 0)}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {hasMore && (
        <div ref={observerRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ width: 22, height: 22, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%' }} className="animate-spin" />
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
          모든 글을 다 봤어요 🎉
        </div>
      )}
      {posts.length === 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>아직 게시글이 없어요</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>첫 번째 글을 작성해보세요!</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/write')} style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: 'var(--text-inverse)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>✍️ 글쓰기</button>
            <button onClick={() => router.push('/search')} style={{
              padding: '10px 20px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-hover)',
              color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>🔍 검색해보기</button>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
